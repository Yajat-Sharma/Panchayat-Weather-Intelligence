import { handle } from "@/server/http";
import { requireFeat } from "@/server/service";

export async function GET(_req: Request, ctx: RouteContext<"/api/v1/panchayats/[gpcode]">) {
  const { gpcode } = await ctx.params;
  return handle(() => requireFeat(gpcode));
}
