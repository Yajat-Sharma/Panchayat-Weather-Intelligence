# Spatial Block Validation Methodology (Phase 6.2)

## 1. Objective
To rigorously assess whether the experimental XGBoost downscaling model can generalize to unseen geographic regions in Pune, eliminating the risk of spatial autocorrelation leakage present in random Panchayat holdouts.

## 2. Geographic K-Means Clustering
We utilized K-Means clustering (K=5) on the physical `(centroid_lat, centroid_lon)` coordinates of all 1,351 unique Gram Panchayats. This approach natively partitions the dataset into 5 contiguous, macroscopic geographic blocks (e.g., North, South, East, West, Central). 

## 3. K-Fold Cross-Validation Design
A 5-fold cross-validation was implemented. For each fold `k` (0 to 4):
- **Test Set:** All Panchayats belonging to block `k`.
- **Training Set:** All Panchayats belonging to the other 4 blocks.
- **Strict Separation:** A Panchayat appears in exactly ONE test fold. No Panchayat appears in both train and test sets simultaneously. All 365 daily observations for a test Panchayat are held out.

## 4. Leakage Prevention
- **Spatial Leakage:** Neighboring Panchayats (which often share similar microclimates and terrain) do not cross the train/test boundary because the test set is a contiguous macroscopic block.
- **Feature Leakage:** The target residual is completely withheld from the input feature space. 
- **Integrity Validation:** Cryptographic unit tests (`ml/tests/test_spatial_validation.py`) programmatically enforce that the intersection of training and testing `GPCODE` sets is entirely empty for every single fold.
