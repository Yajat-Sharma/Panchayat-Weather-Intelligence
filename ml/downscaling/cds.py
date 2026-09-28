"""Copernicus Climate Data Store helpers (requires ~/.cdsapirc)."""
import calendar
import os
import shutil
import tempfile
from pathlib import Path

import xarray as xr
import yaml

from .config import BASE_DIR

CDSAPIRC = Path.home() / ".cdsapirc"


def check_cds_credentials() -> None:
    if not CDSAPIRC.exists() and not os.environ.get("CDSAPI_KEY"):
        raise SystemExit(
            "Missing Copernicus CDS credentials.\n"
            "  1. Register at https://cds.climate.copernicus.eu and accept the ERA5 / ERA5-Land licences.\n"
            "  2. Create ~/.cdsapirc containing:\n"
            "       url: https://cds.climate.copernicus.eu/api\n"
            "       key: <your-personal-access-token>\n"
        )


def study_area() -> list:
    with open(BASE_DIR / "configs" / "study_area.yaml") as f:
        bbox = yaml.safe_load(f)["study_area"]["weather_bbox"]
    return [bbox["north"], bbox["west"], bbox["south"], bbox["east"]]


def retrieve_year(dataset: str, variables: list, year: str, output_path: Path, product_type="reanalysis") -> Path:
    """Hourly data for a whole year, fetched month by month and merged into one NetCDF."""
    import cdsapi

    check_cds_credentials()
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    client = cdsapi.Client()
    area = study_area()
    tmp = Path(tempfile.mkdtemp())
    files = []
    try:
        for month in range(1, 13):
            _, n = calendar.monthrange(int(year), month)
            target = tmp / f"{dataset}_{year}_{month:02d}.nc"
            print(f"[{dataset}] {', '.join(variables)} {year}-{month:02d} ...")
            request = {
                "variable": variables,
                "year": year,
                "month": f"{month:02d}",
                "day": [f"{d:02d}" for d in range(1, n + 1)],
                "time": [f"{h:02d}:00" for h in range(24)],
                "area": area,
                "data_format": "netcdf",
                "download_format": "unarchived",
            }
            if product_type:
                request["product_type"] = product_type
            client.retrieve(dataset, request, str(target))
            files.append(target)
        # Jan 1 IST starts at 18:30 UTC on Dec 31, so daily_ist() drops that partial first day.
        ds = xr.open_mfdataset([str(f) for f in files], combine="by_coords")
        ds.to_netcdf(output_path)
        ds.close()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"Saved {output_path}")
    return output_path


def retrieve_invariant(dataset: str, variable: str, output_path: Path) -> Path:
    """A time-invariant field (e.g. ERA5 geopotential = grid-cell orography)."""
    import cdsapi

    check_cds_credentials()
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cdsapi.Client().retrieve(dataset, {
        "product_type": "reanalysis", "variable": variable,
        "year": "2023", "month": "01", "day": "01", "time": "00:00",
        "area": study_area(), "data_format": "netcdf", "download_format": "unarchived",
    }, str(output_path))
    print(f"Saved {output_path}")
    return output_path
