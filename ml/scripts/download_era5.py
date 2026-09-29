"""
Download ERA5 (0.25°) hourly single-level data for the Pune bounding box.

    python ml/scripts/download_era5.py                 # precipitation + surface variables + geopotential
    python ml/scripts/download_era5.py --only precip   # just total precipitation (the v1 input)

Requires ~/.cdsapirc.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ml.downscaling.cds import retrieve_invariant, retrieve_year  # noqa: E402
from ml.downscaling.config import ERA5_GEOPOTENTIAL_NC, ERA5_RAIN_NC, ERA5_SURFACE_NC, YEAR  # noqa: E402

DATASET = "reanalysis-era5-single-levels"
SURFACE_VARIABLES = [
    "2m_temperature",
    "2m_dewpoint_temperature",
    "10m_u_component_of_wind",
    "10m_v_component_of_wind",
]


def download_era5_precipitation(year=YEAR, output_path=ERA5_RAIN_NC):
    return retrieve_year(DATASET, ["total_precipitation"], year, output_path)


def download_era5_surface(year=YEAR, output_path=ERA5_SURFACE_NC, variables=SURFACE_VARIABLES):
    return retrieve_year(DATASET, list(variables), year, output_path)


def download_era5_geopotential(output_path=ERA5_GEOPOTENTIAL_NC):
    """Surface geopotential / g = the elevation ERA5 assumes for each 0.25° cell."""
    return retrieve_invariant(DATASET, "geopotential", output_path)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--year", default=YEAR)
    p.add_argument("--only", choices=["precip", "surface", "geopotential"])
    p.add_argument("--force", action="store_true", help="re-download even if the file exists")
    a = p.parse_args(argv)
    jobs = {
        "precip": (ERA5_RAIN_NC, lambda: download_era5_precipitation(a.year)),
        "surface": (ERA5_SURFACE_NC, lambda: download_era5_surface(a.year)),
        "geopotential": (ERA5_GEOPOTENTIAL_NC, download_era5_geopotential),
    }
    for name, (path, fn) in jobs.items():
        if a.only and name != a.only:
            continue
        if Path(path).exists() and not a.force:
            print(f"skip {name}: {path} exists")
            continue
        fn()


if __name__ == "__main__":
    main()
