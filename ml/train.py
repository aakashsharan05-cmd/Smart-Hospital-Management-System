"""
Model Training Script for Hospital Wait-Time Prediction
Trains a RandomForestRegressor model with ColumnTransformer preprocessing,
evaluates against baseline models, and saves the trained pipeline with Joblib.
"""

import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

RANDOM_SEED = 42

FEATURE_COLS = ["queue_length", "day_of_week", "hour", "department", "doctor_experience"]
NUMERICAL_COLS = ["queue_length", "day_of_week", "hour", "doctor_experience"]
CATEGORICAL_COLS = ["department"]
TARGET_COL = "actual_wait_minutes"

def load_data(data_path: str) -> pd.DataFrame:
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset not found at {data_path}. Run generate_data.py first.")
    df = pd.read_csv(data_path)
    return df

def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERICAL_COLS),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_COLS),
        ],
        remainder="drop",
    )

    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )

    pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("regressor", model),
    ])

    return pipeline

def evaluate_predictions(y_true, y_pred):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)
    return {
        "mae": round(float(mae), 3),
        "rmse": round(float(rmse), 3),
        "r2": round(float(r2), 4),
    }

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, "data", "synthetic_hospital_wait_data.csv")
    models_dir = os.path.join(script_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    print("--- Phase 3: Model Training ---")
    print(f"Loading dataset from: {data_path}")
    df = load_data(data_path)
    print(f"Dataset records: {len(df)}")

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=RANDOM_SEED
    )
    print(f"Train set: {len(X_train)} samples, Test set: {len(X_test)} samples")

    # 1. Baseline Model 1: Mean Baseline (DummyRegressor)
    dummy = DummyRegressor(strategy="mean")
    dummy.fit(X_train, y_train)
    dummy_preds = dummy.predict(X_test)
    dummy_metrics = evaluate_predictions(y_test, dummy_preds)

    # 2. Baseline Model 2: Simple Heuristic Formula (5 + 8 * queue_length)
    heuristic_preds = 5.0 + 8.0 * X_test["queue_length"].values
    heuristic_metrics = evaluate_predictions(y_test, heuristic_preds)

    # 3. Baseline Model 3: Linear Regression
    lin_preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERICAL_COLS),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_COLS),
        ]
    )
    lin_model = Pipeline([("pre", lin_preprocessor), ("reg", LinearRegression())])
    lin_model.fit(X_train, y_train)
    lin_preds = lin_model.predict(X_test)
    lin_metrics = evaluate_predictions(y_test, lin_preds)

    # 4. Primary Model: RandomForestRegressor Pipeline
    print("\nTraining RandomForestRegressor pipeline...")
    rf_pipeline = build_pipeline()
    rf_pipeline.fit(X_train, y_train)
    rf_preds = rf_pipeline.predict(X_test)
    rf_metrics = evaluate_predictions(y_test, rf_preds)

    # Print comparison
    print("\n================ MODEL EVALUATION SUMMARY ================")
    print(f"1. Dummy Mean Baseline  : MAE = {dummy_metrics['mae']:.2f} min, RMSE = {dummy_metrics['rmse']:.2f} min, R² = {dummy_metrics['r2']:.4f}")
    print(f"2. Heuristic Formula    : MAE = {heuristic_metrics['mae']:.2f} min, RMSE = {heuristic_metrics['rmse']:.2f} min, R² = {heuristic_metrics['r2']:.4f}")
    print(f"3. Linear Regression    : MAE = {lin_metrics['mae']:.2f} min, RMSE = {lin_metrics['rmse']:.2f} min, R² = {lin_metrics['r2']:.4f}")
    print(f"4. RandomForest Pipeline: MAE = {rf_metrics['mae']:.2f} min, RMSE = {rf_metrics['rmse']:.2f} min, R² = {rf_metrics['r2']:.4f}")
    print("==========================================================")

    # Improvement calculation
    mae_improvement = ((heuristic_metrics['mae'] - rf_metrics['mae']) / heuristic_metrics['mae']) * 100
    print(f"\nRandomForest improves MAE over Heuristic baseline by {mae_improvement:.1f}%")

    # Save artifacts
    model_artifact_path = os.path.join(models_dir, "wait_time_model.joblib")
    metrics_path = os.path.join(models_dir, "metrics.json")

    joblib.dump(rf_pipeline, model_artifact_path)
    print(f"Saved trained model artifact to: {model_artifact_path}")

    metadata = {
        "model_type": "RandomForestRegressor",
        "random_seed": RANDOM_SEED,
        "n_samples": len(df),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "features": FEATURE_COLS,
        "metrics": {
            "random_forest": rf_metrics,
            "linear_regression": lin_metrics,
            "heuristic_formula": heuristic_metrics,
            "mean_baseline": dummy_metrics,
        },
        "mae_improvement_over_heuristic_pct": round(mae_improvement, 2),
    }

    with open(metrics_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved evaluation metrics to: {metrics_path}")

if __name__ == "__main__":
    main()
