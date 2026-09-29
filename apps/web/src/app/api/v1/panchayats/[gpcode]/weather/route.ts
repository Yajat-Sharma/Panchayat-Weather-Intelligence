/**
 * Historical out-of-fold predictions. The parquet they live in is not shipped with the
 * web deployment, so this reports BLOCKED exactly like the Python API does without it.
 */
export function GET() {
  return Response.json({
    status: "BLOCKED",
    message: "Historical weather extraction and ML downscaling are not completed yet.",
  });
}
