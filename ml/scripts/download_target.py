import os
import requests
import yaml
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def load_study_area():
    base_dir = Path(__file__).resolve().parent.parent.parent
    config_path = base_dir / "configs" / "study_area.yaml"
    with open(config_path, "r") as f:
        return yaml.safe_load(f)

def download_chirps_2023():
    base_dir = Path(__file__).resolve().parent.parent.parent
    target_dir = base_dir / "data" / "raw" / "target"
    target_dir.mkdir(parents=True, exist_ok=True)
    
    output_file = target_dir / "chirps_p05_2023.nc"
    
    if output_file.exists():
        logger.info(f"File already exists: {output_file}")
        # Note: In a real system, you'd check checksums. We skip re-download if present.
        return output_file
        
    url = "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/netcdf/p05/chirps-v2.0.2023.days_p05.nc"
    
    logger.info(f"Downloading CHIRPS 2023 daily from {url}")
    logger.info(f"This is a large file (~800MB). Please wait...")
    
    # Use streaming to avoid high memory usage
    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        with open(output_file, 'wb') as f:
            downloaded = 0
            for chunk in r.iter_content(chunk_size=8192): 
                f.write(chunk)
                downloaded += len(chunk)
                if downloaded % (50 * 1024 * 1024) == 0:
                    logger.info(f"Downloaded {downloaded / (1024*1024):.1f} MB")
                    
    logger.info(f"Download complete: {output_file}")
    return output_file

if __name__ == "__main__":
    download_chirps_2023()
