/**
 * Shared coarse-forecast service (port of apps/api/app/services/forecast_service.py).
 *
 * Every Panchayat centroid is snapped to its ECMWF IFS 0.25° grid cell, and all
 * cells are fetched from Open-Meteo in one multi-location request with
 * `elevation=nan` (no Open-Meteo elevation correction), so the value fed to the
 * downscaler really is the coarse grid-cell value. Cached per server instance
 * for one hour; the whole district is always fetched so one request covers it.
 */
import { features } from "./data";
import { ValueError } from "./http";
import type { Feat, VarName } from "./inference";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const GRID_DEG = 0.25;
const CACHE_TTL_MS = 3_600_000;
export const SOURCE_LABEL = "ECMWF IFS 0.25 (via Open-Meteo)";

const DAILY_VARS: Record<string, VarName> = {
  precipitation_sum: "rainfall",
  temperature_2m_max: "tmax",
  temperature_2m_min: "tmin",
  relative_humidity_2m_mean: "rh",
  wind_speed_10m_mean: "wind",
};

export type CoarseDay = { date: string } & Partial<Record<VarName, number | null>>;
export interface CellForecast {
  cell_elevation_m: number | null;
  days: CoarseDay[];
}
export interface CoarseForecast extends CellForecast {
  cell: { lat: number; lon: number };
}

type Cell = [number, number];
const round4 = (x: number) => Math.round(x * 1e4) / 1e4;
const key = (c: Cell) => `${c[0]},${c[1]}`;

// Python's round() is round-half-to-even; match it so cells line up with the API.
function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

export function snapToGrid(lat: number, lon: number, step = GRID_DEG): Cell {
  return [round4(roundHalfEven(lat / step) * step), round4(roundHalfEven(lon / step) * step)];
}

export function cellFor(feat: Feat): Cell | null {
  const { centroid_lat: lat, centroid_lon: lon } = feat;
  if (lat === null || lat === undefined || lon === null || lon === undefined) return null;
  return snapToGrid(Number(lat), Number(lon));
}

async function fetchCells(cells: Cell[]): Promise<Map<string, CellForecast>> {
  const params = new URLSearchParams({
    latitude: cells.map(c => c[0]).join(","),
    longitude: cells.map(c => c[1]).join(","),
    elevation: cells.map(() => "nan").join(","),
    daily: Object.keys(DAILY_VARS).join(","),
    models: "ecmwf_ifs025",
    timezone: "Asia/Kolkata",
  });
  const resp = await fetch(`${OPEN_METEO_URL}?${params}`, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!resp.ok) throw new Error(`Open-Meteo returned HTTP ${resp.status}`);
  let payload = await resp.json();
  if (!Array.isArray(payload)) payload = [payload]; // single location returns an object
  if (payload.length !== cells.length) throw new Error("Open-Meteo returned a different number of locations than requested.");

  const out = new Map<string, CellForecast>();
  cells.forEach((cell, ci) => {
    const loc = payload[ci];
    const daily = loc.daily ?? {};
    const dates: string[] = daily.time ?? [];
    if (!dates.length) throw new Error("Open-Meteo returned no daily data.");
    const days = dates.map((date, i) => {
      const day: CoarseDay = { date };
      for (const [omKey, name] of Object.entries(DAILY_VARS)) {
        const v = (daily[omKey] ?? [])[i];
        day[name] = v === null || v === undefined ? null : Number(v);
      }
      return day;
    });
    out.set(key(cell), { cell_elevation_m: loc.elevation ?? null, days });
  });
  return out;
}

// Every Panchayat's cell is registered up front so the first fetch covers the district.
const knownCells = new Map<string, Cell>();
for (const f of Object.values(features)) {
  const c = cellFor(f);
  if (c) knownCells.set(key(c), c);
}
let cache: Map<string, CellForecast> = new Map();
let fetchedAt = 0;
let inflight: Promise<Map<string, CellForecast>> | null = null;

async function getCells(wanted: Cell[]): Promise<Map<string, CellForecast>> {
  for (const c of wanted) knownCells.set(key(c), c);
  const fresh = Date.now() - fetchedAt < CACHE_TTL_MS;
  if (!(fresh && wanted.every(c => cache.has(key(c))))) {
    if (!inflight) {
      const all = [...knownCells.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      inflight = fetchCells(all)
        .then(data => {
          cache = data;
          fetchedAt = Date.now();
          return data;
        })
        .finally(() => (inflight = null));
    }
    await inflight;
  }
  return cache;
}

export async function forPanchayat(feat: Feat): Promise<CoarseForecast> {
  const cell = cellFor(feat);
  if (!cell) throw new ValueError("Panchayat is missing centroid coordinates.");
  const data = await getCells([cell]);
  return { cell: { lat: cell[0], lon: cell[1] }, ...data.get(key(cell))! };
}

/** gpcode -> coarse forecast for many Panchayats (still one upstream request). */
export async function forPanchayats(feats: Record<string, Feat>): Promise<Record<string, CoarseForecast>> {
  const cells = Object.entries(feats)
    .map(([gp, f]) => [gp, cellFor(f)] as const)
    .filter((e): e is readonly [string, Cell] => e[1] !== null);
  const data = await getCells(cells.map(([, c]) => c));
  return Object.fromEntries(cells.map(([gp, c]) => [gp, { cell: { lat: c[0], lon: c[1] }, ...data.get(key(c))! }]));
}
