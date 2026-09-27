# Spatial Validation Audit

## 1. Split Methodology
The current ML dataset uses a **20% spatial holdout** (train/test split based on `GPCODE`).
- **Total Unique Panchayats:** 1,351
- **Training Panchayats:** 1,080 (80%)
- **Testing Panchayats:** 271 (20%)

The split was implemented using `sklearn.model_selection.train_test_split(..., random_state=42)`. This constitutes a **random spatial holdout**. The geographic extent covers all of Pune district for both training and testing sets, as they are uniformly randomly distributed across the region.

## 2. Stronger Spatial Validation Recommendation
While a random spatial split guarantees that the exact test Panchayat coordinates and terrain are unseen during training, it is susceptible to **spatial autocorrelation leakage**. Neighboring Panchayats (e.g., adjacent villages) are highly correlated in microclimate, terrain, and CHIRPS grid observations.

Because neighboring Panchayats often cross the train/test boundaries in a random split, the model might artificially inflate its performance by interpolating from adjacent training Panchayats rather than learning a generalized physical mapping.

**Recommendation:**
In future iterations, implement **Spatial Block Cross-Validation (e.g., k-fold geographic clustering)**.
- Divide Pune district into contiguous macroscopic blocks (e.g., North, South, East, West, Central).
- Hold out a complete, contiguous macroscopic block during testing.
- This ensures the model is evaluated on its ability to generalize to an entirely new, unseen geographic region rather than interpolating from immediate neighbors.
