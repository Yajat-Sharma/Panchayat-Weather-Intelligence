import { features } from "@/server/data";
import { areaWeightedMean, blockMembers, canonicalBlockName, downscaleBlock, VALIDATION_SCOPE } from "@/server/downscale";
import { forPanchayats, SOURCE_LABEL } from "@/server/forecast";
import { HttpError, handle, errorMessage } from "@/server/http";
import { VARIABLES } from "@/server/inference";
import { requireRegistry } from "@/server/service";

/**
 * Block-level coarse forecast (area-weighted mean of the grid-cell values over the
 * block's Panchayats) and every Panchayat's downscaled value, with within-block spread.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/v1/blocks/[block]/forecast">) {
  const { block } = await ctx.params;
  return handle(async () => {
    const reg = requireRegistry();
    const members = blockMembers(features, block);
    if (!Object.keys(members).length) throw new HttpError(404, `Block '${block}' not found.`);
    let coarse;
    try {
      coarse = await forPanchayats(members);
    } catch (e) {
      throw new HttpError(502, `Failed to fetch operational forecast: ${errorMessage(e)}`);
    }
    const gps = Object.keys(members).filter(gp => gp in coarse);
    const weights = gps.map(gp => Number(members[gp].area_sqkm) || 0);
    const blockDays = coarse[gps[0]].days.map((d, di) => ({
      date: d.date,
      ...Object.fromEntries(VARIABLES.map(v => [v, areaWeightedMean(gps.map(gp => coarse[gp].days[di][v]), weights)])),
    }));
    const cellElev = areaWeightedMean(gps.map(gp => coarse[gp].cell_elevation_m), weights);
    const result = downscaleBlock(reg, Object.fromEntries(gps.map(gp => [gp, members[gp]])), blockDays, cellElev);
    return {
      block: canonicalBlockName(members),
      district: members[gps[0]].dtname,
      panchayat_count: gps.length,
      source: SOURCE_LABEL,
      input: "area_weighted_block_mean",
      validation_scope: VALIDATION_SCOPE,
      ...result,
    };
  });
}
