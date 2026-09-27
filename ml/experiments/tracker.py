import json
import datetime
import os
import uuid

class ExperimentTracker:
    def __init__(self, output_dir="artifacts/experiments"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
    def log_experiment(self, metadata: dict):
        exp_id = str(uuid.uuid4())[:8]
        timestamp = datetime.datetime.now().isoformat()
        
        record = {
            "experiment_id": exp_id,
            "timestamp": timestamp,
            **metadata
        }
        
        filepath = os.path.join(self.output_dir, f"exp_{exp_id}.json")
        with open(filepath, 'w') as f:
            json.dump(record, f, indent=4)
            
        print(f"Logged experiment {exp_id} to {filepath}")
        return exp_id
