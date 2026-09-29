/**
 * Panchayat AI Copilot (port of assistant_service.py, context_service.py and
 * llm_provider.py). Groq (OpenAI-compatible, JSON mode) by default; set
 * LLM_PROVIDER=gemini with LLM_API_KEY to use Gemini instead.
 */
import { buildAdvisory } from "./advisory";
import { features } from "./data";
import { forecastDays, VALIDATION_SCOPE, type ForecastDay } from "./downscale";
import { forPanchayat } from "./forecast";
import { registry } from "./inference";

type Msg = { role: string; content: string };

interface LLMProvider {
  generate(systemPrompt: string, context: string, userMessage: string, history: Msg[]): Promise<string>;
}

class GroqProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly model = process.env.MODEL_NAME || "llama-3.3-70b-versatile";

  constructor() {
    const key = process.env.GROQ_API_KEY || process.env.LLM_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY environment variable is missing.");
    this.apiKey = key;
  }

  async generate(systemPrompt: string, context: string, userMessage: string, history: Msg[]) {
    const messages = [
      {
        role: "system",
        content: `${systemPrompt}\n\nCONTEXT:\n${context}\n\nRespond with a JSON object of the form {"answer": "<your reply>"}.`,
      },
      ...history.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content ?? "" })),
      { role: "user", content: userMessage },
    ];
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.2, // keep low to prevent hallucination
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) throw new Error(`Groq returned HTTP ${resp.status}: ${await resp.text()}`);
    const content = (await resp.json()).choices[0].message.content;
    return String(JSON.parse(content).answer);
  }
}

class GeminiProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly model = process.env.MODEL_NAME || "gemini-2.5-flash";

  constructor() {
    const key = process.env.LLM_API_KEY;
    if (!key) throw new Error("LLM_API_KEY environment variable is missing.");
    this.apiKey = key;
  }

  async generate(systemPrompt: string, context: string, userMessage: string, history: Msg[]) {
    const contents = [
      ...history.map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content ?? "" }] })),
      { role: "user", parts: [{ text: userMessage }] },
    ];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${systemPrompt}\n\nCONTEXT:\n${context}` }] },
        contents,
        generationConfig: {
          temperature: 0.2, // keep low to prevent hallucination
          responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { answer: { type: "STRING" } }, required: ["answer"] },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) throw new Error(`Gemini returned HTTP ${resp.status}: ${await resp.text()}`);
    const text = (await resp.json()).candidates[0].content.parts[0].text;
    return String(JSON.parse(text).answer);
  }
}

function getProvider(): LLMProvider {
  const name = (process.env.LLM_PROVIDER || "groq").toLowerCase();
  if (name === "groq") return new GroqProvider();
  if (name === "gemini") return new GeminiProvider();
  throw new Error(`Unsupported LLM provider: ${name}`);
}

/** Trim a forecast day to what the LLM needs. */
function compact(day: ForecastDay) {
  const out: Record<string, unknown> = { date: day.date };
  for (const [k, val] of Object.entries(day)) {
    if (val && typeof val === "object" && "value" in val) {
      const entry = val as unknown as Record<string, unknown>;
      out[k] = Object.fromEntries(
        (["coarse", "value", "p10", "p90", "prob", "unit"] as const)
          .map(f => [f, entry[f]])
          .filter(([, x]) => x !== null && x !== undefined),
      );
    }
  }
  return out;
}

/** Panchayat metadata, downscaled forecast and the rule-based advisory (same one the UI shows). */
async function panchayatContext(gpcode: string, crop: string | null) {
  const feat = features[gpcode];
  const context: Record<string, unknown> = {
    gpcode,
    panchayat_name: feat.GPNAME ?? "Unknown",
    block_name: feat.blkname ?? "Unknown",
    district_name: feat.dtname ?? "Unknown",
    state_name: feat.stname ?? "Unknown",
    elevation_mean_meters: feat.elevation_mean ?? 0,
    area_sqkm: feat.area_sqkm ?? 0,
  };
  let days: ForecastDay[] = [];
  if (registry.loaded) {
    try {
      days = forecastDays(registry, gpcode, feat, await forPanchayat(feat));
    } catch (e) {
      console.error("Failed to fetch forecast for context:", e);
    }
  }
  if (days.length) {
    context["7_day_operational_forecast"] = days.map(compact);
    context.forecast_notes =
      "coarse = ECMWF IFS 0.25° grid-cell value; value = Panchayat-level downscaled value; " +
      "p10/p90 = 80% uncertainty range; prob = probability of rain > 2.5 mm.";
    context.advisory = buildAdvisory(days, crop);
  } else {
    context.weather_status = "Operational forecast currently unavailable.";
  }
  if (Object.keys(registry.metrics).length) {
    context.model_validation = { scope: VALIDATION_SCOPE, metrics: registry.metrics };
  }
  return context;
}

export async function chat({ gpcode, crop, language, message, history }: {
  gpcode: string;
  crop: string | null;
  language: string;
  message: string;
  history: Msg[];
}) {
  if (!Object.hasOwn(features, gpcode)) {
    return { answer: "Please select a valid Panchayat.", panchayat: { gpcode }, context_used: [], disclaimer: "" };
  }
  let llm: LLMProvider;
  try {
    llm = getProvider();
  } catch (e) {
    console.error("LLM Provider initialization failed:", e);
    return {
      answer: "The Panchayat AI is temporarily unavailable due to missing LLM configuration (e.g. GROQ_API_KEY).",
      panchayat: { gpcode },
      context_used: [],
      disclaimer: "System configuration error.",
    };
  }

  const context = await panchayatContext(gpcode, crop);
  context.user_crop_context = crop || "No specific crop selected.";

  let langInstruction = "";
  if (language === "hi") langInstruction = "13. YOU MUST REPLY IN HINDI (हिंदी). Your entire response must be in Hindi.";
  else if (language === "mr") langInstruction = "13. YOU MUST REPLY IN MARATHI (मराठी). Your entire response must be in Marathi.";

  const systemPrompt = `ROLE:
You are Mausam IQ Copilot. You help users understand weather information and agricultural decision-support information for their selected Panchayat.

RULES:
1. Use only the supplied CONTEXT.
2. NEVER invent or fabricate weather values (rainfall, temperature, etc.).
3. NEVER claim unavailable forecasts exist. If \`7_day_operational_forecast\` is missing, state clearly that you don't have forecast data.
4. Distinguish historical data from forecasts.
5. Use "CHIRPS reference" rather than "ground truth".
6. Explain technical information in simple language. Be concise and use farmer-friendly language.
7. Mention uncertainty when appropriate. Do not present prototype advisory logic as guaranteed agronomic recommendations.
8. If data is missing, say so.
9. Do not claim the model is universally accurate. It is an experimental XGBoost residual model trained on 2023 Pune data; accuracy numbers come from a 2023 historical test, not from verified live forecasts.
10. Do not claim the system replaces IMD or agricultural experts.
11. If the user asks about the model performance, quote only the numbers in \`model_validation\` (2023 spatial-block cross-validation). If it is missing, say the numbers are unavailable.
12a. When giving farm advice, follow the \`advisory\` block (its codes and parameters are the same ones the app shows) and explain it; do not contradict it. Mention the p10–p90 range or rain probability when uncertainty matters.
12. If the user asks about their specific crop, tailor your advice based on the supplied context and weather. If no crop is selected, ask them what they are growing.
${langInstruction}
`;

  try {
    const answer = await llm.generate(systemPrompt, JSON.stringify(context, null, 2), message, history);
    return {
      answer,
      panchayat: { gpcode, name: context.panchayat_name, block: context.block_name, district: context.district_name },
      context_used: ["weather", "crop", "panchayat_metadata"],
      disclaimer:
        "This is a prototype decision-support tool. Always combine AI insights with local field conditions and official IMD warnings.",
    };
  } catch (e) {
    console.error("Assistant generation failed:", e);
    return {
      answer: "The Panchayat AI is temporarily unavailable. Please try again.",
      panchayat: { gpcode },
      context_used: [],
      disclaimer: "Error occurred during generation.",
    };
  }
}
