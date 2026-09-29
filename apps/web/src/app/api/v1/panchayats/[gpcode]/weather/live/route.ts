import type { NextRequest } from "next/server";
import { HttpError, handle, errorMessage } from "@/server/http";
import { parseDate } from "@/server/inference";
import { requireFeat, requireRegistry } from "@/server/service";

/** Live execution of the rainfall downscaler for an arbitrary date and ERA5 coarse value. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/panchayats/[gpcode]/weather/live">) {
  const { gpcode } = await ctx.params;
  return handle(() => {
    const date = req.nextUrl.searchParams.get("date");
    const rawRain = req.nextUrl.searchParams.get("era5_rainfall_mm");
    if (date === null || rawRain === null) throw new HttpError(422, "date and era5_rainfall_mm are required.");
    const rain = Number(rawRain);
    const feat = requireFeat(gpcode);
    const model = requireRegistry().get("rainfall")!;
    try {
      if (!Number.isFinite(rain)) throw new Error("ERA5 rainfall input must be a finite number.");
      if (rain < 0) throw new Error("ERA5 rainfall input cannot be negative.");
      parseDate(date);
    } catch (e) {
      throw new HttpError(400, `Invalid input data: ${errorMessage(e)}`);
    }
    const out = model.predict(rain, feat, date);
    return {
      gpcode,
      date,
      era5_baseline_input_mm: rain,
      model_residual_correction_mm: out.correction,
      final_downscaled_prediction_mm: out.value,
      model_version: model.version,
      prediction_type: "historical_experimental_inference",
    };
  });
}
