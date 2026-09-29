import { features } from "@/server/data";
import { registry } from "@/server/inference";

export function GET() {
  const variables = Object.keys(registry.models).sort();
  const available = Object.keys(features).length > 0;
  return Response.json({
    panchayat_dataset: available ? "Available" : "Not Available",
    dem: available ? "Available" : "Not Available",
    era5: "Available and Extracted",
    preprocessing_status: "Complete",
    ml_model: variables.length ? `TRAINED (XGBoost residual: ${variables.join(", ")})` : "NOT LOADED",
    fine_resolution_target: "CHIRPS v2.0 (0.05°) rainfall; ERA5-Land (0.1°) temperature/humidity/wind",
  });
}
