/**
 * Multi-variable downscaling inference (port of apps/api/app/inference.py).
 *
 *     final = clip(baseline + XGBoost(features))
 *
 * `baseline` is the coarse value, or for temperature the coarse value corrected
 * by a standard lapse rate for the Panchayat-vs-grid-cell elevation difference.
 * Models come from data/models.json (scripts/export_web_data.py).
 */
import modelsJson from "../../data/models.json";
import { predict, type CompactBooster } from "./xgboost";

export const LAPSE_RATE_C_PER_M = -0.0065;
export const QUANTILES = ["p10", "p50", "p90"] as const;
export type Quantile = (typeof QUANTILES)[number];

export type VarName = "rainfall" | "tmax" | "tmin" | "rh" | "wind";
type Bounds = [number | null, number | null];

export const VARIABLE_SPECS: Record<VarName, { coarse_feature: string; clip: Bounds; baseline: "coarse" | "lapse"; unit: string }> = {
  rainfall: { coarse_feature: "era5_rainfall_mm", clip: [0, null], baseline: "coarse", unit: "mm" },
  tmax: { coarse_feature: "era5_tmax_c", clip: [null, null], baseline: "lapse", unit: "°C" },
  tmin: { coarse_feature: "era5_tmin_c", clip: [null, null], baseline: "lapse", unit: "°C" },
  rh: { coarse_feature: "era5_rh_pct", clip: [0, 100], baseline: "coarse", unit: "%" },
  wind: { coarse_feature: "era5_wind_kmh", clip: [0, null], baseline: "coarse", unit: "km/h" },
};
export const VARIABLES = Object.keys(VARIABLE_SPECS) as VarName[];

export type Feat = Record<string, string | number | null | undefined>;
type Cell = number | null | undefined;

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? NaN : Number(v));

export function lapseRateBaseline(coarse: number, panchayatElev: number, cellElev: number): number {
  const diff = panchayatElev - cellElev;
  return coarse + LAPSE_RATE_C_PER_M * (Number.isNaN(diff) ? 0 : diff);
}

function clip(v: number, [lo, hi]: Bounds): number {
  if (lo !== null && v < lo) return lo;
  if (hi !== null && v > hi) return hi;
  return v;
}

export function parseDate(date: string): { doy: number; month: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!m || !d || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    throw new Error(`time data '${date}' does not match format '%Y-%m-%d'`);
  }
  const doy = Math.floor((d.getTime() - Date.UTC(+m[1], 0, 1)) / 86_400_000) + 1;
  return { doy, month: +m[2] };
}

/** One feature row per (Panchayat, day), in the model's feature order. */
export function buildFeatureRow(order: string[], coarseFeature: string, coarse: number, feat: Feat, date: string, cellElev: Cell): number[] {
  const { doy, month } = parseDate(date);
  const panElev = num(feat.elevation_mean) || 0;
  const cell = cellElev === null || cellElev === undefined || Number.isNaN(cellElev) ? panElev : cellElev;
  return order.map(col => {
    if (col === coarseFeature) return coarse;
    if (col === "day_of_year") return doy;
    if (col === "month") return month;
    if (col === "cell_elevation_m") return cell;
    if (col === "elev_diff_m") return panElev - cell;
    const v = num(feat[col]);
    return Number.isNaN(v) ? 0 : v;
  });
}

interface ExportedVariable {
  version: string;
  feature_order: string[];
  point: CompactBooster;
  quantiles?: Record<Quantile, CompactBooster>;
  prob?: CompactBooster;
  block?: ExportedVariable;
}

export interface VarPrediction {
  baseline: number;
  correction: number;
  value: number;
  p10?: number;
  p50?: number;
  p90?: number;
  prob?: number;
}

export class VariableModel {
  readonly spec;
  readonly version: string;
  readonly featureOrder: string[];
  readonly blockModel: VariableModel | null;

  constructor(readonly variable: VarName, private readonly m: ExportedVariable) {
    this.spec = VARIABLE_SPECS[variable];
    this.version = m.version;
    this.featureOrder = m.feature_order;
    this.blockModel = m.block ? new VariableModel(variable, m.block) : null;
  }

  baseline(coarse: number, feat: Feat, cellElev: Cell): number {
    if (this.spec.baseline !== "lapse") return coarse;
    const cell = cellElev === null || cellElev === undefined ? NaN : cellElev;
    return lapseRateBaseline(coarse, num(feat.elevation_mean) || NaN, cell);
  }

  predict(coarse: number, feat: Feat, date: string, cellElev?: Cell): VarPrediction {
    const x = buildFeatureRow(this.featureOrder, this.spec.coarse_feature, coarse, feat, date, cellElev);
    const base = this.baseline(coarse, feat, cellElev);
    const correction = predict(this.m.point, x);
    const out: VarPrediction = { baseline: base, correction, value: clip(base + correction, this.spec.clip) };
    if (this.m.quantiles) {
      // Sorted to enforce p10 <= p50 <= p90 (quantile crossing).
      const qs = QUANTILES.map(q => clip(base + predict(this.m.quantiles![q], x), this.spec.clip)).sort((a, b) => a - b);
      QUANTILES.forEach((q, i) => (out[q] = qs[i]));
    }
    if (this.m.prob) out.prob = predict(this.m.prob, x);
    return out;
  }
}

export class ModelRegistry {
  readonly models: Partial<Record<VarName, VariableModel>> = {};
  readonly metrics: Record<string, unknown>;

  constructor(data: { metrics?: Record<string, unknown>; variables: Partial<Record<string, ExportedVariable>> }) {
    for (const v of VARIABLES) {
      const m = data.variables[v];
      if (m) this.models[v] = new VariableModel(v, m);
    }
    this.metrics = data.metrics ?? {};
  }

  get loaded(): boolean {
    return "rainfall" in this.models;
  }

  get(v: VarName): VariableModel | undefined {
    return this.models[v];
  }
}

export const registry = new ModelRegistry(modelsJson as unknown as ConstructorParameters<typeof ModelRegistry>[0]);
