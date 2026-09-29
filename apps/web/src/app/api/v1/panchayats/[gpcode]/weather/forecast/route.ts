import { VALIDATION_SCOPE } from "@/server/downscale";
import { SOURCE_LABEL } from "@/server/forecast";
import { handle } from "@/server/http";
import { VARIABLES } from "@/server/inference";
import { panchayatForecast } from "@/server/service";

/** Live 7-day forecast: ECMWF IFS 0.25° grid-cell values downscaled per Panchayat, per variable. */
export async function GET(_req: Request, ctx: RouteContext<"/api/v1/panchayats/[gpcode]/weather/forecast">) {
  const { gpcode } = await ctx.params;
  return handle(async () => ({
    gpcode,
    status: "AVAILABLE",
    source: SOURCE_LABEL,
    validation_scope: VALIDATION_SCOPE,
    variables: VARIABLES,
    forecast: await panchayatForecast(gpcode),
  }));
}
