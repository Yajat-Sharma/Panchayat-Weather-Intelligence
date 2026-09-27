import pandas as pd

class ClimatologyBaseline:
    """Baseline model predicting using historical climatological averages."""
    
    def __init__(self, historical_data: pd.DataFrame):
        """
        Initialize the climatology baseline.
        :param historical_data: DataFrame containing historical observations per panchayat.
                                Must contain 'panchayat_id', 'day_of_year', and weather variables.
        """
        self.historical_data = historical_data
        self.climatology = self._compute_climatology()

    def _compute_climatology(self) -> pd.DataFrame:
        """Computes the mean historical value for each day of the year per panchayat."""
        return self.historical_data.groupby(['panchayat_id', 'day_of_year']).mean().reset_index()

    def predict(self, target_df: pd.DataFrame, variable: str) -> pd.DataFrame:
        """
        Predicts the weather variable for the target DataFrame based on climatology.
        
        :param target_df: DataFrame with 'panchayat_id' and 'day_of_year'.
        :param variable: The variable to predict (e.g., 'temperature').
        :return: DataFrame with predictions.
        """
        predictions = target_df.merge(self.climatology[['panchayat_id', 'day_of_year', variable]], 
                                      on=['panchayat_id', 'day_of_year'], 
                                      how='left')
        return predictions
