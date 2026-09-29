/**
 * Crop-aware agro-met advisory engine (port of advisory_service.py).
 *
 * Rules look across several forecast days and return reason *codes* with
 * parameters rather than prose, so the UI can render them in EN / HI / MR and
 * the AI copilot sees exactly the same decision.
 */
import type { ForecastDay } from "./downscale";
import type { VarName } from "./inference";

const RAIN_EVENT_MM = 2.5;
const HEAVY_RAIN_MM = 30.0;
const SPRAY_WIND_KMH = 15.0;
const RAIN_PROB_SKIP = 0.6;
const FUNGAL_RH = 85.0;
const FUNGAL_T_RANGE = [20.0, 30.0] as const;
const FUNGAL_MIN_DAYS = 2;

type Crop = { rain_need_3d_mm: number; heat_critical_c: number };

// 3-day rain (mm) that covers the crop's water need, and temperature (°C) above
// which heat stress sets in. Indicative values for Pune-region kharif/rabi practice.
const CROP_PARAMS: Record<string, Crop> = {
  rice: { rain_need_3d_mm: 25.0, heat_critical_c: 35.0 },
  soybean: { rain_need_3d_mm: 15.0, heat_critical_c: 35.0 },
  maize: { rain_need_3d_mm: 15.0, heat_critical_c: 35.0 },
  vegetables: { rain_need_3d_mm: 10.0, heat_critical_c: 32.0 },
  sugarcane: { rain_need_3d_mm: 20.0, heat_critical_c: 38.0 },
  generic: { rain_need_3d_mm: 15.0, heat_critical_c: 35.0 },
};

type Day = Partial<ForecastDay> & { error?: unknown };
type Item = { status: string; tone: string; code: string; params: Record<string, number | null>; basis?: string };

function v(day: Day, variable: VarName, key = "value"): number | null {
  const entry = (day[variable] ?? {}) as Record<string, unknown>;
  let val = entry[key];
  if ((val === null || val === undefined) && key === "p50") val = entry.value;
  return val === null || val === undefined ? null : Number(val);
}

// Python round(): works on the exact binary value (7.55 is 7.5499… -> 7.5) and rounds true halves to even.
function r(x: number | null, nd = 1): number | null {
  if (x === null) return null;
  const exact = Math.abs(x).toFixed(nd + 40);
  const cut = exact.indexOf(".") + nd + (nd > 0 ? 1 : 0);
  const kept = Number(exact.slice(0, cut));
  const rest = exact.slice(cut).replace(".", "");
  const lastEven = Number(exact.replace(".", "").slice(0, cut - (nd > 0 ? 1 : 0)).slice(-1)) % 2 === 0;
  const up = rest[0] > "5" || (rest[0] === "5" && (/[1-9]/.test(rest.slice(1)) || !lastEven));
  const abs = up ? kept + 10 ** -nd : kept;
  return Math.sign(x) * Number(abs.toFixed(nd));
}
const pct = (p: number) => r(p * 100, 0)!;

/** Classifier probability when available, otherwise a coarse proxy from the quantile band. */
function rainProbability(day: Day): [number | null, string] {
  const p = v(day, "rainfall", "prob");
  if (p !== null) return [p, "classifier"];
  const [p10, p50, p90] = (["p10", "p50", "p90"] as const).map(q => v(day, "rainfall", q));
  if (p50 === null) return [null, "none"];
  if (p10 !== null && p90 !== null) {
    if (p10 > RAIN_EVENT_MM) return [0.9, "quantile_proxy"];
    if (p50 > RAIN_EVENT_MM) return [0.6, "quantile_proxy"];
    if (p90 > RAIN_EVENT_MM) return [0.3, "quantile_proxy"];
    return [0.1, "quantile_proxy"];
  }
  return [p50 > RAIN_EVENT_MM ? 1.0 : 0.0, "deterministic"];
}

function irrigation(days: Day[], crop: Crop): Item {
  const window = days.slice(0, 3);
  const rain3 = window.reduce((a, d) => a + (v(d, "rainfall", "p50") || 0), 0);
  const need = crop.rain_need_3d_mm;
  const [prob, basis] = rainProbability(days[0]);
  const params = { mm: r(rain3), days: window.length, need };
  if ((basis === "classifier" || basis === "quantile_proxy") && prob !== null && prob >= RAIN_PROB_SKIP) {
    return { status: "skip", tone: "good", code: "irrigation.skipLikelyRain", params: { ...params, prob: pct(prob) }, basis };
  }
  if (rain3 >= need) return { status: "skip", tone: "good", code: "irrigation.skip", params };
  if (rain3 >= need / 2) return { status: "reduce", tone: "neutral", code: "irrigation.reduce", params };
  return { status: "irrigate", tone: "caution", code: "irrigation.needed", params };
}

function spraying(days: Day[]): Item {
  const d0 = days[0];
  const wind = v(d0, "wind");
  const rain = v(d0, "rainfall", "p50") || 0;
  const [prob] = rainProbability(d0);
  if (wind !== null && wind > SPRAY_WIND_KMH) {
    return { status: "avoid", tone: "caution", code: "spray.avoidWind", params: { kmh: r(wind), limit: SPRAY_WIND_KMH } };
  }
  if (rain > RAIN_EVENT_MM || (prob !== null && prob >= 0.5)) {
    return { status: "avoid", tone: "caution", code: "spray.avoidRain", params: { mm: r(rain), prob: prob === null ? null : pct(prob) } };
  }
  return { status: "ok", tone: "good", code: "spray.ok", params: { kmh: r(wind), mm: r(rain) } };
}

function heatStress(days: Day[], crop: Crop): Item {
  const crit = crop.heat_critical_c;
  const tmaxes = days
    .slice(0, 3)
    .map((d, i) => [i, v(d, "tmax")] as const)
    .filter((e): e is readonly [number, number] => e[1] !== null);
  if (!tmaxes.length) return { status: "unknown", tone: "neutral", code: "heat.unknown", params: {} };
  const [i, peak] = tmaxes.reduce((a, b) => (b[1] > a[1] ? b : a));
  const params = { t: r(peak), crit, dayOffset: i };
  if (peak >= crit) return { status: "high", tone: "caution", code: "heat.stress", params };
  if (peak >= crit - 2) return { status: "watch", tone: "neutral", code: "heat.watch", params };
  return { status: "low", tone: "good", code: "heat.ok", params };
}

function fungalRisk(days: Day[]): Item {
  const [lo, hi] = FUNGAL_T_RANGE;
  let streak = 0;
  let best = 0;
  let haveData = false;
  for (const d of days) {
    const [rh, tx, tn] = [v(d, "rh"), v(d, "tmax"), v(d, "tmin")];
    if (rh === null || tx === null || tn === null) {
      streak = 0;
      continue;
    }
    haveData = true;
    const tmean = (tx + tn) / 2;
    if (rh >= FUNGAL_RH && lo <= tmean && tmean <= hi) {
      streak += 1;
      best = Math.max(best, streak);
    } else {
      streak = 0;
    }
  }
  if (!haveData) return { status: "unknown", tone: "neutral", code: "pest.unknown", params: {} };
  const params = { days: best, rh: FUNGAL_RH, tLo: lo, tHi: hi };
  if (best >= FUNGAL_MIN_DAYS) return { status: "high", tone: "caution", code: "pest.high", params };
  if (best === 1) return { status: "watch", tone: "neutral", code: "pest.watch", params };
  return { status: "low", tone: "good", code: "pest.low", params };
}

function fieldWork(days: Day[]): Item {
  const rains = days.slice(0, 3).map((d, i) => [i, v(d, "rainfall", "p50") || 0] as const);
  const [i, peak] = rains.length ? rains.reduce((a, b) => (b[1] > a[1] ? b : a)) : ([0, 0] as const);
  const params = { mm: r(peak), dayOffset: i, limit: HEAVY_RAIN_MM };
  if (peak > HEAVY_RAIN_MM) return { status: "delay", tone: "caution", code: "field.delay", params };
  return { status: "ok", tone: "good", code: "field.ok", params };
}

const RULES: [string, (days: Day[], crop: Crop) => Item][] = [
  ["irrigation", irrigation],
  ["spraying", spraying],
  ["heat", heatStress],
  ["pest", fungalRisk],
  ["field", fieldWork],
];

/** Evaluate every rule on the forecast window starting at day `start`. */
export function buildAdvisory(days: Day[], crop?: string | null, start = 0) {
  const window = days.slice(start).filter(d => !("error" in d));
  const cropKey = (crop ?? "generic").trim().toLowerCase() || "generic";
  const known = Object.hasOwn(CROP_PARAMS, cropKey);
  const params = known ? CROP_PARAMS[cropKey] : CROP_PARAMS.generic;
  if (!window.length) return { crop: cropKey, items: [], status: "NO_FORECAST" };
  return {
    crop: cropKey,
    crop_known: known,
    date: window[0].date,
    window_days: window.length,
    items: RULES.map(([id, fn]) => ({ id, ...fn(window, params) })),
  };
}
