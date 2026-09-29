/**
 * Turns coarse daily values into Panchayat-level downscaled values for every
 * variable the registry has a model for (port of downscale_service.py).
 */
import type { CoarseForecast } from "./forecast";
import { SOURCE_LABEL } from "./forecast";
import { lapseRateBaseline, VARIABLE_SPECS, VARIABLES, type Feat, type ModelRegistry, type VarName, type VarPrediction } from "./inference";

export const VALIDATION_SCOPE = "historical_2023";

export interface VarEntry {
  coarse: number | null;
  baseline: number | null;
  correction: number | null;
  value: number | null;
  unit: string;
  downscaled: boolean;
  model_version: string | null;
  model_variant: string;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  prob?: number | null;
  prob_source?: string | null;
}
export type Downscaled = Partial<Record<VarName, VarEntry>>;
export type CoarseValues = Partial<Record<VarName, number | null>>;

export interface Row {
  feat: Feat;
  date: string;
  coarse: CoarseValues;
  cell_elevation_m?: number | null;
}

export function num(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Math.round(v * 100) / 100;
}

export function downscale(registry: ModelRegistry, rows: Row[], blockInput = false): Downscaled[] {
  const results: Downscaled[] = rows.map(() => ({}));
  for (const v of VARIABLES) {
    const spec = VARIABLE_SPECS[v];
    let model = registry.get(v);
    let variant = "point_input";
    if (model && blockInput) {
      if (model.blockModel) [model, variant] = [model.blockModel, "block_input"];
      else variant = "point_input_fallback";
    }
    if (!model) variant = "baseline_only";

    rows.forEach((row, i) => {
      const c = row.coarse[v];
      if (c === null || c === undefined) return;
      let out: VarPrediction;
      if (model) {
        out = model.predict(c, row.feat, row.date, row.cell_elevation_m);
      } else {
        // No trained model: physically-based baseline only (lapse rate for temperature).
        const cell = row.cell_elevation_m ?? NaN;
        const base = spec.baseline === "lapse" ? lapseRateBaseline(c, Number(row.feat.elevation_mean) || NaN, cell) : c;
        out = { baseline: base, correction: 0, value: base };
      }
      const entry: VarEntry = {
        coarse: num(c),
        baseline: num(out.baseline),
        correction: num(out.correction),
        value: num(out.value),
        unit: spec.unit,
        downscaled: !!model,
        model_version: model ? model.version : null,
        model_variant: variant,
        p10: num(out.p10),
        p50: num(out.p50),
        p90: num(out.p90),
      };
      if (v === "rainfall") {
        entry.prob = out.prob === undefined ? null : num(out.prob);
        entry.prob_source = out.prob === undefined ? null : "classifier";
      }
      results[i][v] = entry;
    });
  }
  return results;
}

export type ForecastDay = Downscaled & {
  gpcode: string;
  date: string;
  era5_baseline_input_mm?: number | null;
  model_residual_correction_mm?: number | null;
  final_downscaled_prediction_mm?: number | null;
  model_version?: string | null;
  prediction_type: string;
  operational_source: string;
};

/** Downscaled operational forecast for one Panchayat in the multi-variable schema. */
export function forecastDays(registry: ModelRegistry, gpcode: string, feat: Feat, coarse: CoarseForecast): ForecastDay[] {
  const rows: Row[] = coarse.days.map(d => ({
    feat,
    date: d.date,
    coarse: Object.fromEntries(VARIABLES.map(v => [v, d[v] ?? null])),
    cell_elevation_m: coarse.cell_elevation_m,
  }));
  return downscale(registry, rows).map((vals, i) => {
    const day: ForecastDay = { gpcode, date: rows[i].date, ...vals, prediction_type: "", operational_source: "" };
    const rain = vals.rainfall;
    if (rain) {
      // Legacy flat fields — kept for one release while the UI migrates.
      day.era5_baseline_input_mm = rain.coarse;
      day.model_residual_correction_mm = rain.correction;
      day.final_downscaled_prediction_mm = rain.value;
      day.model_version = rain.model_version;
    }
    day.prediction_type = "live_operational_forecast";
    day.operational_source = SOURCE_LABEL;
    return day;
  });
}

export function areaWeightedMean(values: (number | null | undefined)[], weights: number[]): number | null {
  let tot = 0;
  let acc = 0;
  values.forEach((v, i) => {
    if (v === null || v === undefined) return;
    const w = weights[i] > 0 ? weights[i] : 1;
    tot += w;
    acc += v * w;
  });
  return tot ? acc / tot : null;
}

const mostCommon = (names: string[]) => {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
};

export function blockMembers(features: Record<string, Feat>, block: string): Record<string, Feat> {
  const k = block.trim().toLowerCase();
  return Object.fromEntries(Object.entries(features).filter(([, f]) => String(f.blkname ?? "").trim().toLowerCase() === k));
}

export const canonicalBlockName = (members: Record<string, Feat>) =>
  mostCommon(Object.values(members).map(f => String(f.blkname ?? "").trim()));

/** Blocks grouped case-insensitively (the source mixes 'HAVELI' and 'Haveli'); shows the commonest spelling. */
export function listBlocks(features: Record<string, Feat>) {
  const blocks = new Map<string, { spellings: string[]; district: unknown; panchayat_count: number; area_sqkm: number }>();
  for (const f of Object.values(features)) {
    const name = String(f.blkname ?? "").trim();
    if (!name) continue;
    const k = name.toLowerCase();
    if (!blocks.has(k)) blocks.set(k, { spellings: [], district: f.dtname, panchayat_count: 0, area_sqkm: 0 });
    const b = blocks.get(k)!;
    b.spellings.push(name);
    b.panchayat_count += 1;
    b.area_sqkm += Number(f.area_sqkm) || 0;
  }
  return [...blocks.values()]
    .map(b => ({ block: mostCommon(b.spellings), district: b.district, panchayat_count: b.panchayat_count, area_sqkm: Math.round(b.area_sqkm * 10) / 10 }))
    .sort((a, b) => (a.block.toLowerCase() < b.block.toLowerCase() ? -1 : a.block.toLowerCase() > b.block.toLowerCase() ? 1 : 0));
}

function spread(values: (number | null | undefined)[]) {
  const arr = values.filter((v): v is number => v !== null && v !== undefined);
  if (!arr.length) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
  return { min: num(Math.min(...arr)), max: num(Math.max(...arr)), mean: num(mean), std: num(std) };
}

/**
 * blockDays: one block-level value per variable per day.
 * Returns per-day block values, per-Panchayat downscaled values and within-block spread.
 */
export function downscaleBlock(registry: ModelRegistry, members: Record<string, Feat>, blockDays: ({ date: string } & CoarseValues)[], blockCellElevation: number | null) {
  const gps = Object.keys(members);
  const rows: Row[] = blockDays.flatMap(d =>
    gps.map(gp => ({
      feat: members[gp],
      date: d.date,
      coarse: Object.fromEntries(VARIABLES.map(v => [v, d[v] ?? null])),
      cell_elevation_m: blockCellElevation,
    })),
  );
  const out = downscale(registry, rows, true);
  const n = gps.length;
  const days = blockDays.map((d, di) => {
    const pan = gps.map((gp, k) => ({ gpcode: gp, name: members[gp].GPNAME, ...out[di * n + k] }));
    return {
      date: d.date,
      block_value: Object.fromEntries(VARIABLES.map(v => [v, num(d[v])])),
      spread: Object.fromEntries(VARIABLES.map(v => [v, spread(pan.map(p => p[v]?.value))])),
      panchayats: pan,
    };
  });
  return { days };
}
