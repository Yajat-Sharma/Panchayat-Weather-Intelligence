import cdsapi
import os
import calendar
import tempfile
import xarray as xr

import yaml

def download_era5_precipitation(year="2023", output_path=None):
    """
    Download total precipitation for Pune using the CDS API.
    Note: Requires ~/.cdsapirc to be configured.
    """
    config_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "configs", "study_area.yaml"))
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    bbox = config['study_area']['weather_bbox']
    area = [bbox['north'], bbox['west'], bbox['south'], bbox['east']]

    if output_path is None:
        output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw", "weather", f"era5_pune_{year}.nc"))
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    print(f"Requesting ERA5 Total Precipitation for {year} with BBox {area}...")
    c = cdsapi.Client()
    
    temp_dir = tempfile.mkdtemp()
    monthly_files = []
    
    for month in range(1, 13):
        # Determine valid days for this month and year
        _, num_days = calendar.monthrange(int(year), month)
        days = [f"{day:02d}" for day in range(1, num_days + 1)]
        month_str = f"{month:02d}"
        
        print(f"Downloading data for {year}-{month_str}...")
        temp_file = os.path.join(temp_dir, f"era5_pune_{year}_{month_str}.nc")
        
        c.retrieve(
            'reanalysis-era5-single-levels',
            {
                'product_type': 'reanalysis',
                'format': 'netcdf',
                'variable': 'total_precipitation',
                'year': year,
                'month': month_str,
                'day': days,
                'time': [
                    f"{hour:02d}:00" for hour in range(24)
                ],
                # Bounding box for Pune (N, W, S, E)
                'area': area,
            },
            temp_file)
            
        monthly_files.append(temp_file)
        
    print("Merging monthly datasets into final NetCDF...")
    ds = xr.open_mfdataset(monthly_files, combine='by_coords')
    ds.to_netcdf(output_path)
    ds.close()
    
    # Cleanup
    for f in monthly_files:
        os.remove(f)
    os.rmdir(temp_dir)
        
    print(f"Downloaded ERA5 NetCDF to {output_path}")

if __name__ == "__main__":
    download_era5_precipitation()
