# ml/ — Machine Learning Module (Phase 2)

This directory is reserved for future ML/AI model integration.

## Current Status
**Phase 1 (Software Demo):** All "AI" processing is rule-based simulation inside `backend/services/engine.py`.
No real ML models are used yet.

## Planned Phase 2 Components

### Anomaly Detection
- **Model:** Isolation Forest or LSTM Autoencoder
- **Input:** Time-series sensor readings (temperature, gas, motion, pressure)
- **Output:** Anomaly score per reading
- **Integration point:** `backend/services/engine.py` → `evaluate_severity()`

### Predictive Alert
- **Model:** Gradient Boosted Trees (XGBoost / LightGBM)
- **Input:** Rolling window of sensor readings + zone profile
- **Output:** Probability of incident in next N minutes
- **Integration point:** New endpoint `GET /api/predict`

### Evidence Correlation
- **Model:** Rule-based → upgrade to Bayesian Network
- **Input:** Multi-sensor event stream
- **Output:** Correlated evidence list attached to incident
- **Integration point:** `backend/services/engine.py` → `correlate_evidence()`

## Directory Structure (when populated)
```
ml/
├── models/          — trained model files (.pkl, .onnx)
├── training/        — training scripts and notebooks
├── evaluation/      — metrics, confusion matrices, ROC curves
└── README.md        — this file
```

## Dependencies (Phase 2)
```
scikit-learn>=1.3
numpy>=1.24
pandas>=2.0
xgboost>=2.0
```
> Note: scikit-learn and numpy are incompatible with Python 3.14 as of Phase 1.
> Upgrade Python to 3.11 or 3.12 before Phase 2 ML work.
