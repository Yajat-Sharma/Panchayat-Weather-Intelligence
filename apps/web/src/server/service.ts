/** Shared lookups used by several route handlers (the helpers from apps/api/app/main.py). */
import { features } from "./data";
import { forecastDays } from "./downscale";
import { forPanchayat } from "./forecast";
import { HttpError, ValueError, errorMessage } from "./http";
import { registry, type Feat, type ModelRegistry } from "./inference";

export function requireRegistry(): ModelRegistry {
  if (!registry.loaded) throw new HttpError(503, "Downscaling inference model is not loaded or unavailable.");
  return registry;
}

export function requireFeat(gpcode: string): Feat {
  if (!Object.hasOwn(features, gpcode)) throw new HttpError(404, "Panchayat features not found.");
  return features[gpcode];
}

/** Downscaled 7-day forecast (all variables) for one Panchayat. */
export async function panchayatForecast(gpcode: string) {
  const feat = requireFeat(gpcode);
  const reg = requireRegistry();
  let coarse;
  try {
    coarse = await forPanchayat(feat);
  } catch (e) {
    if (e instanceof ValueError) throw new HttpError(400, e.message);
    throw new HttpError(502, `Failed to fetch operational forecast: ${errorMessage(e)}`);
  }
  try {
    return forecastDays(reg, gpcode, feat, coarse);
  } catch (e) {
    throw new HttpError(500, `Batch inference failed: ${errorMessage(e)}`);
  }
}
