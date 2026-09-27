import os
import requests
import json
import urllib3

# Suppress insecure request warnings for NIC servers
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def download_panchayats():
    url = 'https://grammanchitragis.nic.in/grammanchitra/rest/services/panchayat/panchayat_admin/MapServer/3/query'
    params = {
        'where': "UPPER(stname) = 'MAHARASHTRA' AND UPPER(dtname) = 'PUNE'",
        'outFields': '*',
        'returnGeometry': 'true',
        'f': 'geojson',
        'outSR': '4326',
        'resultRecordCount': 2000
    }
    
    print(f"Querying Gram Manchitra ArcGIS REST: {url}")
    response = requests.get(url, params=params, verify=False, timeout=60)
    response.raise_for_status()
    
    data = response.json()
    
    # Check for error in response
    if 'error' in data:
        raise ValueError(f"API Error: {data['error']}")
        
    features = data.get('features', [])
    print(f"Downloaded {len(features)} features.")
    
    if len(features) == 0:
        raise ValueError("No features were returned by the query.")
        
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    
    # Save raw original response
    raw_dir = os.path.join(base, "data", "raw", "original", "panchayat")
    os.makedirs(raw_dir, exist_ok=True)
    raw_path = os.path.join(raw_dir, "raw.json")
    with open(raw_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f"Saved raw response to {raw_path}")
    
    # Save the GeoJSON for spatial processing
    boundary_dir = os.path.join(base, "data", "raw", "boundaries")
    os.makedirs(boundary_dir, exist_ok=True)
    boundary_path = os.path.join(boundary_dir, "pune_panchayats.geojson")
    with open(boundary_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f"Saved GeoJSON to {boundary_path}")

if __name__ == "__main__":
    download_panchayats()
