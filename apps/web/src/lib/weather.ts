import { CloudDrizzle, CloudLightning, CloudRain, Sun, type LucideIcon } from "lucide-react";
import type { ForecastDay, VarKey } from "./api";

export type Condition = "dry" | "light" | "moderate" | "heavy";

/** Thresholds (mm/day) match the rule set the advisory was built on. */
export const conditionFor = (mm: number): Condition => {
  if (mm > 30) return "heavy";
  if (mm > 10) return "moderate";
  if (mm > 0.5) return "light";
  return "dry";
};

export const CONDITION_ICON: Record<Condition, LucideIcon> = {
  dry: Sun,
  light: CloudDrizzle,
  moderate: CloudRain,
  heavy: CloudLightning,
};

export const HERO_GRADIENTS: Record<Condition, string> = {
  dry: "linear-gradient(165deg, #2f7fe0 0%, #5aa6f0 55%, #8cc6f7 100%)",
  light: "linear-gradient(165deg, #4d78a8 0%, #7599c2 55%, #a3bdd8 100%)",
  moderate: "linear-gradient(165deg, #34496b 0%, #56698a 55%, #7d8ea9 100%)",
  heavy: "linear-gradient(165deg, #171d2c 0%, #2b3449 55%, #454f68 100%)",
};

export const rainfallOf = (d?: ForecastDay) =>
  d && Number.isFinite(d.final_downscaled_prediction_mm) ? d.final_downscaled_prediction_mm : 0;

/** Backend returns per-day error objects when a day fails inference — keep only usable days. */
export const usableDays = (days?: ForecastDay[]) =>
  (days ?? []).filter(d => Number.isFinite(d?.final_downscaled_prediction_mm));

/** Parse an ISO date (YYYY-MM-DD) as a local calendar date, not UTC midnight. */
export const parseDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const formatMm = (mm: number, digits = 1) => (Math.abs(mm) < 0.05 ? "0" : mm.toFixed(digits));

/** Panchayat-level value of any variable (null when the backend didn't provide it). */
export const valueOf = (d: ForecastDay | undefined, v: VarKey): number | null => {
  const x = d?.[v]?.value;
  return x != null && Number.isFinite(x) ? x : null;
};

export const UNIT: Record<VarKey, string> = { rainfall: "mm", tmax: "°", tmin: "°", rh: "%", wind: "km/h" };

export const formatVar = (v: VarKey, x: number | null | undefined) => {
  if (x == null || !Number.isFinite(x)) return "—";
  if (v === "rainfall") return `${formatMm(x, x >= 10 ? 0 : 1)} mm`;
  if (v === "tmax" || v === "tmin") return `${Math.round(x)}°`;
  if (v === "rh") return `${Math.round(x)}%`;
  return `${Math.round(x)} km/h`;
};

/** p10–p90 rain range, when quantile models are deployed. */
export const rainRange = (d?: ForecastDay): [number, number] | null => {
  const r = d?.rainfall;
  return r && r.p10 != null && r.p90 != null ? [r.p10, r.p90] : null;
};

export const rainProb = (d?: ForecastDay): number | null => {
  const p = d?.rainfall?.prob;
  return p != null && Number.isFinite(p) ? p : null;
};
