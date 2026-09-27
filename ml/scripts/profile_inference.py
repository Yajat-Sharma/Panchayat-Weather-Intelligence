import time
import requests
import statistics

API_URL = "http://127.0.0.1:8000"

def run_performance_test():
    print("Testing API latency and throughput...")
    
    # 1. Fetch valid gpcodes
    try:
        resp = requests.get(f"{API_URL}/api/v1/panchayats")
        resp.raise_for_status()
        data = resp.json()
        gpcodes = [feat['properties']['GPCODE'] for feat in data.get("features", []) if feat['properties'].get("GPCODE")]
    except Exception as e:
        print(f"Failed to fetch Panchayats: {e}")
        return
        
    print(f"Loaded {len(gpcodes)} valid Panchayats.")
    
    # 2. Test single inference latency
    print("Running 50 single inference tests...")
    latencies = []
    for i in range(50):
        gpcode = gpcodes[i % len(gpcodes)]
        start = time.perf_counter()
        r = requests.get(f"{API_URL}/api/v1/panchayats/{gpcode}/weather/live?date=2023-07-15&era5_rainfall_mm=10.5")
        end = time.perf_counter()
        latencies.append((end - start) * 1000) # ms
        
    print(f"Single Inference Latency: Mean = {statistics.mean(latencies):.2f} ms, Median = {statistics.median(latencies):.2f} ms")
    
    # 3. Test batch inference throughput
    print("Testing Batch Inference...")
    batch_payload = [
        {"gpcode": gpcode, "date": "2023-07-15", "era5_rainfall_mm": 15.0} 
        for gpcode in gpcodes
    ]
    
    start = time.perf_counter()
    r = requests.post(f"{API_URL}/api/v1/panchayats/weather/batch", json=batch_payload)
    end = time.perf_counter()
    
    batch_time = (end - start) * 1000
    r.raise_for_status()
    results = r.json().get("results", [])
    
    print(f"Batch Inference Processed {len(results)} items in {batch_time:.2f} ms")
    print(f"Throughput: {(len(results) / (batch_time / 1000)):.2f} predictions / second")

if __name__ == "__main__":
    run_performance_test()
