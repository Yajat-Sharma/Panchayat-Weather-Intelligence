/** Static Panchayat features exported by scripts/export_web_data.py, keyed by normalised GPCODE. */
import featuresJson from "../../data/features.json";
import type { Feat } from "./inference";

export const features = featuresJson as unknown as Record<string, Feat>;
