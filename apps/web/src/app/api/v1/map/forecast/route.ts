import type { NextRequest } from "next/server";
import { features } from "@/server/data";
import { downscale, VALIDATION_SCOPE, type Row } from "@/server/downscale";
import { forPanchayats } from "@/server/forecast";
import { HttpError, handle, errorMessage } from "@/server/http";
import { VARIABLE_SPECS, type VarName } from "@/server/inference";
import { requireRegistry } from "@/server/service";

/** Coarse and downscaled value of one variable for every Panchayat on one date (map layer). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const v = (req.nextUrl.searchParams.get("var") ?? "rainfall") as VarName;
    if (!Object.hasOwn(VARIABLE_SPECS, v)) throw new HttpError(400, `Unknown variable '${v}'.`);
    const reg = requireRegistry();
    if (!Object.keys(features).length) throw new HttpError(404, "Panchayat features not found.");
    let coarse;
    try {
      coarse = await forPanchayats(features);
    } catch (e) {
      throw new HttpError(502, `Failed to fetch operational forecast: ${errorMessage(e)}`);
    }
    const gps = Object.keys(coarse);
    const dates = coarse[gps[0]].days.map(d => d.date);
    const date = req.nextUrl.searchParams.get("date") || dates[0];
    const di = dates.indexOf(date);
    if (di < 0) throw new HttpError(400, `Date must be one of ${JSON.stringify(dates)}.`);

    const rows: Row[] = gps.map(gp => ({
      feat: features[gp],
      date,
      coarse: { [v]: coarse[gp].days[di][v] ?? null },
      cell_elevation_m: coarse[gp].cell_elevation_m,
    }));
    const values: Record<string, unknown> = {};
    downscale(reg, rows).forEach((vals, i) => {
      const e = vals[v];
      if (e) values[gps[i]] = { coarse: e.coarse, value: e.value, p10: e.p10, p90: e.p90 };
    });
    return {
      date,
      dates,
      variable: v,
      unit: VARIABLE_SPECS[v].unit,
      downscaled: v in reg.models,
      validation_scope: VALIDATION_SCOPE,
      values,
    };
  });
}
