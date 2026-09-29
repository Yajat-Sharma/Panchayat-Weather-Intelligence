import { features } from "@/server/data";
import { listBlocks } from "@/server/downscale";

export function GET() {
  return Response.json({ blocks: listBlocks(features) });
}
