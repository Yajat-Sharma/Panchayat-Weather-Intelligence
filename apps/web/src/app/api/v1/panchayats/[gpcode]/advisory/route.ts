import type { NextRequest } from "next/server";
import { buildAdvisory } from "@/server/advisory";
import { VALIDATION_SCOPE } from "@/server/downscale";
import { HttpError, handle } from "@/server/http";
import { panchayatForecast } from "@/server/service";

/** Crop-aware advisory built from the downscaled multi-day forecast. Returns reason codes, not prose. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/panchayats/[gpcode]/advisory">) {
  const { gpcode } = await ctx.params;
  return handle(async () => {
    const crop = req.nextUrl.searchParams.get("crop");
    const day = Number(req.nextUrl.searchParams.get("day") ?? 0);
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new HttpError(422, "day must be an integer from 0 to 6.");
    const days = await panchayatForecast(gpcode);
    return { gpcode, validation_scope: VALIDATION_SCOPE, ...buildAdvisory(days, crop, day) };
  });
}
