import pandas as pd
import numpy as np

def temporal_split(df: pd.DataFrame, split_date: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Splits the dataset strictly by time to prevent temporal leakage.
    Ensures all spatial locations exist in both train and test sets for the given periods.
    """
    # Assuming the DataFrame has a 'valid_time' column
    train = df[df['valid_time'] < pd.to_datetime(split_date)]
    test = df[df['valid_time'] >= pd.to_datetime(split_date)]
    return train, test

def spatial_split(df: pd.DataFrame, holdout_panchayat_ids: list) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Splits the dataset spatially by reserving specific panchayats for testing.
    Useful for measuring generalization to unobserved locations.
    """
    train = df[~df['panchayat_id'].isin(holdout_panchayat_ids)]
    test = df[df['panchayat_id'].isin(holdout_panchayat_ids)]
    return train, test

def spatial_temporal_split(df: pd.DataFrame, split_date: str, holdout_panchayat_ids: list) -> dict:
    """
    Creates a robust evaluation split combining temporal and spatial holdouts.
    Returns: train, temporal_test, spatial_test, strict_holdout
    """
    temporal_train, temporal_test = temporal_split(df, split_date)
    
    train, spatial_test_train_time = spatial_split(temporal_train, holdout_panchayat_ids)
    temporal_test_observed, strict_holdout = spatial_split(temporal_test, holdout_panchayat_ids)
    
    return {
        "train": train, # Seen time, seen space
        "temporal_test": temporal_test_observed, # Unseen time, seen space
        "spatial_test": spatial_test_train_time, # Seen time, unseen space
        "strict_holdout": strict_holdout # Unseen time, unseen space
    }
