import { chat } from "@/server/assistant";
import { HttpError, handle } from "@/server/http";

/** Panchayat AI Copilot: context-aware backend for the ChatbotDrawer. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.gpcode !== "string" || typeof body.message !== "string") {
      throw new HttpError(422, "gpcode and message are required.");
    }
    const history = Array.isArray(body.history)
      ? body.history.map((m: { role?: unknown; content?: unknown }) => ({ role: String(m?.role ?? ""), content: String(m?.content ?? "") }))
      : [];
    return chat({
      gpcode: body.gpcode,
      crop: typeof body.crop === "string" ? body.crop : null,
      language: typeof body.language === "string" ? body.language : "en",
      message: body.message,
      history,
    });
  });
}
