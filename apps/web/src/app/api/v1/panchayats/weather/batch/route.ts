import { features } from "@/server/data";
import { HttpError, handle, errorMessage } from "@/server/http";
import { parseDate } from "@/server/inference";
import { requireRegistry } from "@/server/service";

type Item = { gpcode?: unknown; date?: unknown; era5_rainfall_mm?: unknown };

/** Batch rainfall inference: [{gpcode, date, era5_rainfall_mm}, ...]. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => null);
    if (!Array.isArray(body)) throw new HttpError(422, "Body must be a list of {gpcode, date, era5_rainfall_mm}.");
    const model = requireRegistry().get("rainfall")!;
    if (!body.length) throw new HttpError(400, "Empty request list.");
    const results = (body as Item[]).map(item => {
      try {
        const gpcode = String(item.gpcode);
        if (!Object.hasOwn(features, gpcode)) throw new Error(`GPCODE ${gpcode} not found.`);
        const rain = Number(item.era5_rainfall_mm);
        if (!Number.isFinite(rain)) throw new Error("ERA5 rainfall input must be a finite number.");
        if (rain < 0) throw new Error("ERA5 rainfall input cannot be negative.");
        const date = String(item.date);
        parseDate(date);
        const out = model.predict(rain, features[gpcode], date);
        return {
          gpcode: item.gpcode,
          date,
          era5_baseline_input_mm: rain,
          model_residual_correction_mm: out.correction,
          final_downscaled_prediction_mm: out.value,
          model_version: model.version,
          prediction_type: "historical_experimental_inference",
        };
      } catch (e) {
        return { gpcode: item.gpcode, date: item.date, error: errorMessage(e) };
      }
    });
    return { results };
  });
}
