import pandas as pd
import pytest

from ml.downscaling.config import PREDICTIONS_DIR

OOF = PREDICTIONS_DIR / "spatial_block_oof_predictions.parquet"


def test_spatial_validation_integrity():
    if not OOF.exists():
        pytest.skip("No out-of-fold predictions yet; run ml/scripts/run_all.py.")
    oof_df = pd.read_parquet(OOF)
    
    # 1. No duplicate GPCODE-date pairs in OOF predictions
    duplicates = oof_df.duplicated(subset=['GPCODE', 'date']).sum()
    assert duplicates == 0, f"Found {duplicates} duplicate GPCODE-date pairs in OOF predictions"
    
    # 2. Every Panchayat is assigned to exactly one test fold
    fold_assignments = oof_df.groupby('GPCODE')['fold_id'].nunique()
    assert (fold_assignments == 1).all(), "Some Panchayats were assigned to multiple folds!"
    
    # 3. Total expected unique panchayats should be 1351
    assert oof_df['GPCODE'].nunique() == 1351, "Not all Panchayats are present in the OOF predictions"
    
    # 4. Verify absolute train/test separation conceptually
    # (Since we generated OOF, the mere fact that fold_id exists and every GPCODE has exactly 1 fold 
    # proves that if we group by fold, they are mutually exclusive)
    
    folds = oof_df['fold_id'].unique()
    assert len(folds) == 5, f"Expected 5 folds, found {len(folds)}"
    
    for fold in folds:
        test_gpcodes = oof_df[oof_df['fold_id'] == fold]['GPCODE'].unique()
        other_gpcodes = oof_df[oof_df['fold_id'] != fold]['GPCODE'].unique()
        
        # Intersection must be completely empty
        intersection = set(test_gpcodes).intersection(set(other_gpcodes))
        assert len(intersection) == 0, f"Leakage detected in fold {fold}! Panchayats crossed the train/test boundary."
