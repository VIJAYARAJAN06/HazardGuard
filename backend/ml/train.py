"""
HAZARDGUARD Machine Learning Pipeline.
Generates an industrial sensor dataset, trains a multi-feature Logistic Hazard Risk Model
and Anomaly Estimator using pure numpy/standard libraries (guaranteeing cross-platform portability),
evaluates metrics (Accuracy, Precision, Recall, F1, Loss), and saves model weights to disk.
"""

import sys
import os
import json
import math
import pickle
from datetime import datetime, timezone
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from ml.model_def import LogisticHazardRiskModel

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ml"))
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

DATASET_PATH = os.path.join(DATA_DIR, "sensor_training_data.csv")
MODEL_PATH = os.path.join(MODEL_DIR, "hazard_guard_model.pkl")
METRICS_PATH = os.path.join(MODEL_DIR, "model_metrics.json")


def generate_synthetic_dataset(num_samples: int = 2500) -> str:
    """
    Generates synthetic industrial hazard time-series telemetry data:
    Features:
    0: gas_level (0 - 100%)
    1: temperature (15 - 75C)
    2: humidity (20 - 90%)
    3: movement (0 = inactive, 1 = active)
    4: gas_rate_per_min (-10 to +50%/min)
    5: inactivity_duration_sec (0 to 120s)
    6: posture_code (0 = DOWN, 1 = SITTING, 2 = STANDING)

    Target:
    hazard_label: 0 (Normal), 1 (Warning), 2 (High/Critical Threat)
    """
    np.random.seed(42)

    # 1. Normal operating conditions (60% of data)
    n_normal = int(num_samples * 0.60)
    gas_norm = np.random.uniform(5.0, 22.0, n_normal)
    temp_norm = np.random.uniform(20.0, 32.0, n_normal)
    hum_norm = np.random.uniform(40.0, 60.0, n_normal)
    move_norm = np.random.choice([1, 0], size=n_normal, p=[0.95, 0.05])
    rate_norm = np.random.normal(0.0, 1.5, n_normal)
    inact_norm = np.random.exponential(3.0, n_normal)
    posture_norm = np.random.choice([2, 1], size=n_normal, p=[0.85, 0.15])
    label_norm = np.zeros(n_normal, dtype=int)

    # 2. Warning conditions (25% of data)
    n_warn = int(num_samples * 0.25)
    gas_warn = np.random.uniform(25.0, 48.0, n_warn)
    temp_warn = np.random.uniform(33.0, 42.0, n_warn)
    hum_warn = np.random.uniform(50.0, 75.0, n_warn)
    move_warn = np.random.choice([1, 0], size=n_warn, p=[0.70, 0.30])
    rate_warn = np.random.normal(6.0, 3.0, n_warn)
    inact_warn = np.random.exponential(12.0, n_warn)
    posture_warn = np.random.choice([2, 1, 0], size=n_warn, p=[0.60, 0.35, 0.05])
    label_warn = np.ones(n_warn, dtype=int)

    # 3. High / Critical Hazard (15% of data)
    n_crit = num_samples - n_normal - n_warn
    gas_crit = np.random.uniform(52.0, 95.0, n_crit)
    temp_crit = np.random.uniform(43.0, 68.0, n_crit)
    hum_crit = np.random.uniform(65.0, 88.0, n_crit)
    move_crit = np.random.choice([1, 0], size=n_crit, p=[0.10, 0.90])
    rate_crit = np.random.normal(18.0, 6.0, n_crit)
    inact_crit = np.random.uniform(25.0, 120.0, n_crit)
    posture_crit = np.random.choice([0, 1], size=n_crit, p=[0.70, 0.30])
    label_crit = np.full(n_crit, 2, dtype=int)

    # Concatenate
    X = np.vstack([
        np.column_stack([gas_norm, temp_norm, hum_norm, move_norm, rate_norm, inact_norm, posture_norm]),
        np.column_stack([gas_warn, temp_warn, hum_warn, move_warn, rate_warn, inact_warn, posture_warn]),
        np.column_stack([gas_crit, temp_crit, hum_crit, move_crit, rate_crit, inact_crit, posture_crit])
    ])
    y = np.concatenate([label_norm, label_warn, label_crit])

    # Shuffle
    indices = np.arange(len(y))
    np.random.shuffle(indices)
    X = X[indices]
    y = y[indices]

    # Save to CSV
    header = "gas_level,temperature,humidity,movement,gas_rate_per_min,inactivity_duration_sec,posture_code,hazard_label\n"
    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        f.write(header)
        for row, label in zip(X, y):
            f.write(f"{','.join(map(str, row))},{label}\n")

    return DATASET_PATH



def train_and_evaluate_model():
    dataset_file = generate_synthetic_dataset(num_samples=3000)

    # Load dataset
    data = np.loadtxt(dataset_file, delimiter=",", skiprows=1)
    X = data[:, :-1]
    y = data[:, -1].astype(int)

    # Train / Test split (80% train, 20% test)
    n_samples = len(y)
    n_train = int(n_samples * 0.8)
    X_train, X_test = X[:n_train], X[n_train:]
    y_train, y_test = y[:n_train], y[n_train:]

    # Train model
    model = LogisticHazardRiskModel(n_features=X.shape[1], n_classes=3, lr=0.08)
    model.fit(X_train, y_train, epochs=400)

    # Evaluate on test set
    preds = model.predict(X_test)
    accuracy = float(np.mean(preds == y_test))

    # Compute per-class precision, recall, F1
    classes = [0, 1, 2]
    class_names = ["Normal Baseline", "Warning State", "Critical Threat"]
    f1_scores = []
    precisions = []
    recalls = []

    for c in classes:
        tp = np.sum((preds == c) & (y_test == c))
        fp = np.sum((preds == c) & (y_test != c))
        fn = np.sum((preds != c) & (y_test == c))

        prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = float(2 * (prec * rec) / (prec + rec)) if (prec + rec) > 0 else 0.0

        precisions.append(prec)
        recalls.append(rec)
        f1_scores.append(f1)

    macro_f1 = float(np.mean(f1_scores))
    macro_prec = float(np.mean(precisions))
    macro_rec = float(np.mean(recalls))

    metrics = {
        "model_architecture": "Multinomial Logistic Risk Gradient Classifier",
        "dataset_samples": n_samples,
        "train_samples": n_train,
        "test_samples": len(y_test),
        "test_accuracy": round(accuracy * 100.0, 2),
        "macro_precision": round(macro_prec * 100.0, 2),
        "macro_recall": round(macro_rec * 100.0, 2),
        "macro_f1_score": round(macro_f1 * 100.0, 2),
        "class_breakdown": {
            class_names[i]: {
                "precision": round(precisions[i] * 100.0, 2),
                "recall": round(recalls[i] * 100.0, 2),
                "f1": round(f1_scores[i] * 100.0, 2)
            }
            for i in range(3)
        },
        "trained_at": datetime.utcnow().isoformat(),
        "features_evaluated": model.feature_names
    }

    # Save model artifact
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

    # Save metrics JSON
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    return metrics


if __name__ == "__main__":
    m = train_and_evaluate_model()
    print("Model Training & Evaluation Complete:")
    print(json.dumps(m, indent=2))
