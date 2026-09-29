import { VALIDATION_SCOPE } from "@/server/downscale";
import { registry } from "@/server/inference";

/** Spatial-block cross-validation results per variable (from data/models/metrics.json). */
export function GET() {
  return Response.json({
    validation_scope: VALIDATION_SCOPE,
    variables_loaded: Object.keys(registry.models).sort(),
    metrics: registry.metrics,
  });
}
