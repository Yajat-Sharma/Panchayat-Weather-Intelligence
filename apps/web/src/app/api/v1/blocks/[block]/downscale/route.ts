import { features } from "@/server/data";
import { areaWeightedMean, blockMembers, canonicalBlockName, downscaleBlock, VALIDATION_SCOPE, type CoarseValues } from "@/server/downscale";
import { HttpError, handle } from "@/server/http";
import { parseDate, VARIABLES, type VarName } from "@/server/inference";
import { requireRegistry } from "@/server/service";

// Field bounds, same as the API's BlockDay model.
const BOUNDS: Record<VarName, [number, number]> = {
  rainfall: [0, Infinity],
  tmax: [-20, 60],
  tmin: [-20, 60],
  rh: [0, 100],
  wind: [0, 300],
};

function parseDays(body: unknown): ({ date: string } & CoarseValues)[] {
  const days = (body as { days?: unknown })?.days;
  if (!Array.isArray(days) || days.length < 1 || days.length > 16) {
    throw new HttpError(422, "days must be a list of 1 to 16 entries.");
  }
  return days.map((d: Record<string, unknown>) => {
    if (typeof d?.date !== "string") throw new HttpError(422, "Each day needs a date (YYYY-MM-DD).");
    const day: { date: string } & CoarseValues = { date: d.date };
    for (const v of VARIABLES) {
      const x = d[v];
      if (x === null || x === undefined) continue;
      const n = Number(x);
      if (typeof x === "boolean" || !Number.isFinite(n) || n < BOUNDS[v][0] || n > BOUNDS[v][1]) {
        throw new HttpError(422, `${v} on ${d.date} is out of range.`);
      }
      day[v] = n;
    }
    return day;
  });
}

/**
 * Downscale a user-supplied block-level forecast (e.g. from an IMD block agro-met
 * bulletin) to every Panchayat in the block.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/v1/blocks/[block]/downscale">) {
  const { block } = await ctx.params;
  return handle(async () => {
    const reg = requireRegistry();
    const name = block;
    const members = blockMembers(features, name);
    if (!Object.keys(members).length) throw new HttpError(404, `Block '${name}' not found.`);
    const days = parseDays(await req.json().catch(() => null));
    for (const d of days) {
      try {
        parseDate(d.date);
      } catch {
        throw new HttpError(400, `Invalid date '${d.date}'.`);
      }
      if (VARIABLES.every(v => d[v] === undefined)) throw new HttpError(400, `Day ${d.date} has no values.`);
    }
    const feats = Object.values(members);
    const weights = feats.map(f => Number(f.area_sqkm) || 0);
    // A bulletin value represents the block as a whole, so it sits at the block's mean elevation.
    const blockElev = areaWeightedMean(feats.map(f => (f.elevation_mean === null || f.elevation_mean === undefined ? null : Number(f.elevation_mean))), weights);
    const result = downscaleBlock(reg, members, days, blockElev);
    return {
      block: canonicalBlockName(members),
      district: feats[0].dtname,
      panchayat_count: feats.length,
      input: "user_supplied_block_forecast",
      validation_scope: VALIDATION_SCOPE,
      ...result,
    };
  });
}
