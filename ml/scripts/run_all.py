"""
One-command, idempotent pipeline from a fresh checkout:

    uv run --project ml python ml/scripts/run_all.py            # skip steps whose outputs exist
    uv run --project ml python ml/scripts/run_all.py --force    # redo everything
    uv run --project ml python ml/scripts/run_all.py --from build_dataset

Needs ~/.cdsapirc for the ERA5 / ERA5-Land downloads (checked up front).
"""
import argparse
import runpy
import sys
import time
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS.parent.parent))

from ml.downscaling.cds import check_cds_credentials  # noqa: E402
from ml.downscaling import config as C  # noqa: E402

RAW_BOUNDARIES = C.RAW / "boundaries" / "pune_panchayats.geojson"

# (step, script, outputs that mean "already done", needs CDS)
STEPS = [
    ("download_panchayats", "download_panchayats.py", [RAW_BOUNDARIES], False),
    ("preprocess_boundaries", "preprocess_boundaries.py", [C.BOUNDARIES], False),
    ("download_dem", "download_dem.py", [C.DEM], False),
    ("download_worldcover", "download_worldcover.py", [C.WORLDCOVER], False),
    ("extract_dem_features", "extract_dem_features.py", [C.STATIC_FEATURES], False),
    ("download_era5", "download_era5.py", [C.ERA5_RAIN_NC, C.ERA5_SURFACE_NC, C.ERA5_GEOPOTENTIAL_NC], True),
    ("download_era5_land", "download_era5_land.py", [C.ERA5_LAND_NC], True),
    ("download_target", "download_target.py", [C.CHIRPS_NC], False),
    ("extract_weather", "extract_weather.py", [C.COARSE_WEATHER, C.FINE_WEATHER], False),
    ("extract_target", "extract_target.py", [C.RAIN_TARGET], False),
    ("build_dataset", "build_dataset.py", [C.DATASET], False),
    ("run_spatial_block_validation", "run_spatial_block_validation.py", [C.PREDICTIONS_DIR / "spatial_block_oof_predictions.parquet"], False),
    ("deploy_model", "deploy_model.py", [C.MODELS_DIR / "rainfall" / "model.json"], False),
]
NAMES = [s[0] for s in STEPS]


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--force", action="store_true", help="re-run steps even if outputs exist")
    p.add_argument("--from", dest="start", choices=NAMES, help="start at this step (and force it and later steps)")
    p.add_argument("--only", choices=NAMES, help="run a single step")
    a = p.parse_args()

    start = NAMES.index(a.start) if a.start else 0
    todo = [s for s in STEPS[start:] if not a.only or s[0] == a.only]

    force = a.force or bool(a.start or a.only)

    def done(outputs):
        return all(Path(o).exists() for o in outputs)

    if any(cds and (force or not done(outs)) for _, _, outs, cds in todo):
        check_cds_credentials()

    for name, script, outputs, _ in todo:
        if done(outputs) and not force:
            print(f"[skip] {name}")
            continue
        print(f"\n[run ] {name}")
        t = time.time()
        argv = sys.argv
        # download scripts skip existing files themselves unless told to force
        sys.argv = [str(SCRIPTS / script)] + (["--force"] if force and name.startswith("download_") else [])
        try:
            runpy.run_path(str(SCRIPTS / script), run_name="__main__")
        finally:
            sys.argv = argv
        print(f"[done] {name} in {time.time() - t:.0f}s")
    print("\nPipeline complete. Metrics: data/models/metrics.json")


if __name__ == "__main__":
    main()
