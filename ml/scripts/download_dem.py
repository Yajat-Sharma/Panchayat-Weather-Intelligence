import os
import boto3
import rasterio
from rasterio.merge import merge
import glob
from botocore import UNSIGNED
from botocore.config import Config

def download_and_mosaic_dem():
    print("Starting Copernicus GLO-30 DEM Download...")
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw", "terrain"))
    os.makedirs(output_dir, exist_ok=True)
    
    # Pune approx bounding box: 17N - 19N, 73E - 75E
    # Let's get tiles for N17, N18, N19 and E073, E074, E075
    lats = [17, 18, 19]
    lons = [73, 74, 75]
    
    s3 = boto3.client('s3', config=Config(signature_version=UNSIGNED))
    bucket = "copernicus-dem-30m"
    
    downloaded_files = []
    
    for lat in lats:
        for lon in lons:
            # Format: Copernicus_DSM_COG_10_N18_00_E073_00_DEM
            prefix = f"Copernicus_DSM_COG_10_N{lat:02d}_00_E{lon:03d}_00_DEM"
            key = f"{prefix}/{prefix}.tif"
            local_path = os.path.join(output_dir, f"{prefix}.tif")
            
            try:
                if not os.path.exists(local_path):
                    print(f"Downloading {key}...")
                    s3.download_file(bucket, key, local_path)
                else:
                    print(f"File {local_path} already exists, skipping download.")
                downloaded_files.append(local_path)
            except Exception as e:
                print(f"Failed to download tile {prefix}: {e}")
                
    if not downloaded_files:
        print("No DEM tiles downloaded.")
        return
        
    print("Merging downloaded tiles into pune_dem.tif...")
    src_files_to_mosaic = []
    for f in downloaded_files:
        src = rasterio.open(f)
        src_files_to_mosaic.append(src)
        
    mosaic, out_trans = merge(src_files_to_mosaic)
    out_meta = src_files_to_mosaic[0].meta.copy()
    out_meta.update({
        "driver": "GTiff",
        "height": mosaic.shape[1],
        "width": mosaic.shape[2],
        "transform": out_trans,
        "crs": src_files_to_mosaic[0].crs
    })
    
    final_output = os.path.join(output_dir, "pune_dem.tif")
    with rasterio.open(final_output, "w", **out_meta) as dest:
        dest.write(mosaic)
        
    print(f"Successfully saved merged DEM to {final_output}")
    
    # Close resources
    for src in src_files_to_mosaic:
        src.close()
        
    # Clean up individual tiles to save space (optional, but requested to preserve original files)
    print("Preserving original 1x1 degree tiles in terrain folder.")

if __name__ == "__main__":
    download_and_mosaic_dem()
