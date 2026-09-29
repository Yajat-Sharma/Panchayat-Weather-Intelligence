"""
Download ERA5-Land (0.1°) hourly 2 m temperature, dew point and 10 m wind for the Pune
bounding box. This is the fine-resolution reference for Tmax, Tmin, RH and wind.

Caveat: ERA5-Land is driven by ERA5 atmospheric forcing, so it is not independent of the
coarse input. What the model learns against it is terrain-driven refinement (elevation,
lapse rate, land surface), not an independent error correction. See
docs/methodology/multi-variable-downscaling.md.

Requires ~/.cdsapirc.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ml.downscaling.cds import retrieve_year  # noqa: E402
from ml.downscaling.config import ERA5_LAND_NC, YEAR  # noqa: E402
from ml.scripts.download_era5 import SURFACE_VARIABLES  # noqa: E402

DATASET = "reanalysis-era5-land"


def download_era5_land(year=YEAR, output_path=ERA5_LAND_NC):
    # ERA5-Land has no product_type
    return retrieve_year(DATASET, SURFACE_VARIABLES, year, output_path, product_type=None)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--year", default=YEAR)
    p.add_argument("--force", action="store_true")
    a = p.parse_args()
    if ERA5_LAND_NC.exists() and not a.force:
        print(f"skip: {ERA5_LAND_NC} exists")
    else:
        download_era5_land(a.year)
