import axios from "axios";
import type { FeatureCollection, Geometry } from "geojson";

// Same-origin by default: the API is served by this Next.js app (src/app/api). Set NEXT_PUBLIC_API_URL
// only to point the UI at another deployment, e.g. the Python API at http://localhost:8000/api/v1.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export type SystemStatus = Record<string, string>;

export interface PanchayatProps {
  GPCODE?: number | string;
  GPNAME?: string;
  blkname?: string;
  dtname?: string;
  area_sqkm?: number;
}

export type PanchayatCollection = FeatureCollection<Geometry, PanchayatProps>;

export interface PanchayatDetails {
  GPCODE?: number;
  GPNAME?: string;
  blkname?: string;
  dtname?: string;
  area_sqkm?: number;
  elevation_mean?: number;
  elevation_min?: number;
  elevation_max?: number;
  centroid_lat?: number;
  centroid_lon?: number;
}

export const VARIABLES = ["rainfall", "tmax", "tmin", "rh", "wind"] as const;
export type VarKey = (typeof VARIABLES)[number];

/** One variable on one day: coarse grid value, Panchayat-level value and its 80% range. */
export interface VarValue {
  coarse: number | null;
  baseline: number | null;
  correction: number | null;
  value: number | null;
  unit: string;
  downscaled: boolean;
  model_version?: string | null;
  model_variant?: string;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  /** Rainfall only: P(rain > 2.5 mm). */
  prob?: number | null;
  prob_source?: string | null;
}

export interface ForecastDay extends Partial<Record<VarKey, VarValue>> {
  gpcode: string;
  date: string;
  // Legacy flat rainfall fields (kept by the API for one release).
  era5_baseline_input_mm: number;
  model_residual_correction_mm: number;
  final_downscaled_prediction_mm: number;
  model_version?: string;
  operational_source?: string;
}

export interface OperationalForecast {
  gpcode: string;
  status: string;
  source?: string;
  validation_scope?: string;
  forecast: ForecastDay[];
}

export type AdvisoryTone = "good" | "neutral" | "caution";
export interface AdvisoryItem {
  id: "irrigation" | "spraying" | "heat" | "pest" | "field";
  status: string;
  tone: AdvisoryTone;
  code: string;
  params: Record<string, number | null>;
  basis?: string;
}
export interface Advisory {
  gpcode: string;
  crop: string;
  crop_known?: boolean;
  date?: string;
  window_days?: number;
  items: AdvisoryItem[];
  status?: string;
}

export interface PointMetrics {
  baseline_rmse: number;
  model_rmse: number;
  baseline_mae: number;
  model_mae: number;
  rmse_reduction_percent: number;
  mae_reduction_percent: number;
}
export interface VariableMetrics {
  unit: string;
  reference: string;
  feature_set?: string;
  panchayats?: number;
  point: PointMetrics;
  random_holdout?: { rmse_reduction_percent: number };
  interval?: { nominal: number; coverage: number; mean_width: number } | null;
  rain_probability?: { brier: number; brier_climatology: number; auc: number | null } | null;
  block_input?: Partial<PointMetrics> | null;
}
export interface MetricsResponse {
  validation_scope: string;
  variables_loaded: string[];
  metrics: { source?: string; validation?: string; period?: string; variables?: Partial<Record<VarKey, VariableMetrics>> };
}

export interface MapForecast {
  date: string;
  dates: string[];
  variable: VarKey;
  unit: string;
  downscaled: boolean;
  values: Record<string, { coarse: number | null; value: number | null; p10: number | null; p90: number | null }>;
}

export interface BlockSummary {
  block: string;
  district?: string;
  panchayat_count: number;
  area_sqkm: number;
}
export interface BlockPanchayat extends Partial<Record<VarKey, VarValue>> {
  gpcode: string;
  name?: string;
}
export interface BlockDay {
  date: string;
  block_value: Partial<Record<VarKey, number | null>>;
  spread: Partial<Record<VarKey, { min: number; max: number; mean: number; std: number } | null>>;
  panchayats: BlockPanchayat[];
}
export interface BlockForecast {
  block: string;
  district?: string;
  panchayat_count: number;
  input: "area_weighted_block_mean" | "user_supplied_block_forecast";
  validation_scope?: string;
  days: BlockDay[];
}
export type BlockInputDay = { date: string } & Partial<Record<VarKey, number>>;

export interface HistoricalPoint {
  date: string;
  era5_rainfall_mm: number;
  downscaled_rainfall_mm: number;
  target_rainfall_mm: number;
}

export interface HistoricalWeather {
  status: "AVAILABLE" | "BLOCKED";
  timeseries?: HistoricalPoint[];
  message?: string;
}

/** A panchayat as it appears in search: GPCODE-deduplicated (split polygons share one code). */
export interface PanchayatEntry {
  gpcode: string;
  name: string;
  block?: string;
  district?: string;
}

export const normalizeGpcode = (code: unknown): string | null => {
  if (code === null || code === undefined || String(code).trim() === "") return null;
  const n = Math.floor(Number(code));
  return Number.isFinite(n) ? String(n) : null;
};

const get = <T,>(path: string, signal?: AbortSignal) =>
  axios.get<T>(`${API_BASE}${path}`, { signal }).then(r => r.data);

export const api = {
  status: (signal?: AbortSignal) => get<SystemStatus>("/status", signal),
  panchayats: (signal?: AbortSignal) => get<PanchayatCollection>("/panchayats", signal),
  details: (gp: string, signal?: AbortSignal) => get<PanchayatDetails>(`/panchayats/${gp}`, signal),
  history: (gp: string, signal?: AbortSignal) => get<HistoricalWeather>(`/panchayats/${gp}/weather`, signal),
  forecast: (gp: string, signal?: AbortSignal) => get<OperationalForecast>(`/panchayats/${gp}/weather/forecast`, signal),
  advisory: (gp: string, crop: string | null, day: number, signal?: AbortSignal) =>
    get<Advisory>(`/panchayats/${gp}/advisory?day=${day}${crop ? `&crop=${encodeURIComponent(crop)}` : ""}`, signal),
  metrics: (signal?: AbortSignal) => get<MetricsResponse>("/metrics", signal),
  mapForecast: (variable: VarKey, date: string | null, signal?: AbortSignal) =>
    get<MapForecast>(`/map/forecast?var=${variable}${date ? `&date=${date}` : ""}`, signal),
  blocks: (signal?: AbortSignal) => get<{ blocks: BlockSummary[] }>("/blocks", signal),
  blockForecast: (block: string, signal?: AbortSignal) =>
    get<BlockForecast>(`/blocks/${encodeURIComponent(block)}/forecast`, signal),
  blockDownscale: (block: string, days: BlockInputDay[]) =>
    axios.post<BlockForecast>(`${API_BASE}/blocks/${encodeURIComponent(block)}/downscale`, { days }).then(r => r.data),
  chat: (body: {
    gpcode: string;
    crop: string;
    language: string;
    message: string;
    history: { role: string; content: string }[];
  }) => axios.post<{ answer: string }>(`${API_BASE}/assistant/chat`, body).then(r => r.data),
};
