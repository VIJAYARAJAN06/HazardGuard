"""
HAZARDGUARD Model Definition Module.
Defines the LogisticHazardRiskModel class in its own module so that
pickle serialization and deserialization work uniformly across training and inference.
"""

import numpy as np


class LogisticHazardRiskModel:
    """
    Multinomial / Multi-Class Logistic Regression Model with L2 regularization.
    """
    def __init__(self, n_features: int = 7, n_classes: int = 3, lr: float = 0.05, reg: float = 0.001):
        self.weights = np.zeros((n_features, n_classes))
        self.bias = np.zeros(n_classes)
        self.mean = np.zeros(n_features)
        self.std = np.ones(n_features)
        self.lr = lr
        self.reg = reg
        self.feature_names = [
            "gas_level", "temperature", "humidity", "movement",
            "gas_rate_per_min", "inactivity_duration_sec", "posture_code"
        ]

    def fit(self, X: np.ndarray, y: np.ndarray, epochs: int = 300):
        self.mean = np.mean(X, axis=0)
        self.std = np.std(X, axis=0)
        self.std[self.std == 0] = 1.0
        X_scaled = (X - self.mean) / self.std

        n_samples, n_features = X.shape
        n_classes = len(np.unique(y))
        self.weights = np.random.randn(n_features, n_classes) * 0.01
        self.bias = np.zeros(n_classes)

        Y_onehot = np.zeros((n_samples, n_classes))
        Y_onehot[np.arange(n_samples), y] = 1.0

        for epoch in range(epochs):
            scores = np.dot(X_scaled, self.weights) + self.bias
            exp_scores = np.exp(scores - np.max(scores, axis=1, keepdims=True))
            probs = exp_scores / np.sum(exp_scores, axis=1, keepdims=True)

            d_scores = (probs - Y_onehot) / n_samples
            d_weights = np.dot(X_scaled.T, d_scores) + self.reg * self.weights
            d_bias = np.sum(d_scores, axis=0)

            self.weights -= self.lr * d_weights
            self.bias -= self.lr * d_bias

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        X_scaled = (X - self.mean) / self.std
        scores = np.dot(X_scaled, self.weights) + self.bias
        exp_scores = np.exp(scores - np.max(scores, axis=1, keepdims=True))
        return exp_scores / np.sum(exp_scores, axis=1, keepdims=True)

    def predict(self, X: np.ndarray) -> np.ndarray:
        probs = self.predict_proba(X)
        return np.argmax(probs, axis=1)
