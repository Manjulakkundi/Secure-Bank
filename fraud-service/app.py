"""
fraud-service/app.py
SecureBank ML-Ready Fraud Analysis Microservice
Stack: Python 3.11 · Flask · Pandas · Scikit-Learn (Isolation Forest)

Exposes POST /fraud/predict — called by the Node.js backend.
Currently runs a MOCK mode (no training data yet).
Once transaction data is accumulated, swap mock_predict for isolation_forest_predict.

Integration points:
  Node.js backend → POST http://fraud-service:5001/fraud/predict
  Response feeds into fraud_alerts table risk_score field.
"""

from flask import Flask, request, jsonify
from datetime import datetime
import logging
import os

# Optional ML imports — gracefully degrade if not installed
try:
    import numpy as np
    import pandas as pd
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    logging.warning("scikit-learn/numpy not installed — running in MOCK mode")

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Feature Engineering ──────────────────────────────────────────────────────

FEATURE_NAMES = [
    "transaction_amount",    # Raw amount in ₹
    "transaction_frequency", # Number of transactions in last hour
    "beneficiary_age_hours", # How long ago was beneficiary added (0 if new)
    "failed_attempts",       # Failed transfer attempts in last hour
    "daily_volume",          # Total ₹ transferred today
]

def build_feature_vector(data: dict) -> list:
    """Transform raw input into ML feature vector."""
    return [
        float(data.get("transaction_amount",    0)),
        float(data.get("transaction_frequency", 0)),
        float(data.get("beneficiary_age_hours", 999)),  # 999 = established beneficiary
        float(data.get("failed_attempts",       0)),
        float(data.get("daily_volume",          0)),
    ]

# ─── Mock Prediction (rule-based probability estimate) ────────────────────────

def mock_predict(features: list) -> dict:
    """
    Heuristic fraud probability when no ML model is trained yet.
    Mimics what Isolation Forest would output.
    Returns a value in [0.0, 1.0].
    """
    amount, frequency, bene_age, failed, daily = features

    score = 0.0
    reasons = []

    if amount > 50000:
        score += 0.30; reasons.append("high_value")
    if frequency >= 5:
        score += 0.25; reasons.append("rapid_transactions")
    if daily > 100000:
        score += 0.20; reasons.append("daily_limit")
    if failed >= 3:
        score += 0.30; reasons.append("multiple_failures")
    if bene_age < 24 and amount > 20000:
        score += 0.25; reasons.append("new_beneficiary_risk")

    fraud_probability = min(score, 1.0)

    # Convert to 0–100 risk score
    risk_score = int(fraud_probability * 100)

    if risk_score >= 71:
        risk_level      = "HIGH"
        recommendation  = "BLOCK — Require additional authentication"
    elif risk_score >= 31:
        risk_level      = "MEDIUM"
        recommendation  = "FLAG — Log and monitor closely"
    else:
        risk_level      = "LOW"
        recommendation  = "ALLOW — Normal transaction"

    return {
        "fraud_probability": round(fraud_probability, 4),
        "risk_score":        risk_score,
        "risk_level":        risk_level,
        "recommendation":    recommendation,
        "triggered_features": reasons,
        "model":             "mock_heuristic_v1",
    }

# ─── Isolation Forest Prediction (activated when model is trained) ────────────

_model   = None
_scaler  = None

def train_isolation_forest(transaction_data: list):
    """
    Train Isolation Forest on historical transaction data.
    Call this endpoint with enough data (500+ transactions recommended).

    Isolation Forest:
    - Unsupervised anomaly detection
    - No labelled fraud data needed
    - Isolates anomalies by randomly partitioning features
    - Anomalies require fewer splits → shorter path length
    """
    global _model, _scaler

    if not ML_AVAILABLE:
        raise RuntimeError("scikit-learn not installed")

    df = pd.DataFrame(transaction_data, columns=FEATURE_NAMES)
    _scaler = StandardScaler()
    X = _scaler.fit_transform(df)

    # contamination = expected fraction of fraudulent transactions (~1–2%)
    _model = IsolationForest(
        n_estimators=200,
        contamination=0.02,
        random_state=42,
        n_jobs=-1,
    )
    _model.fit(X)
    logger.info(f"Isolation Forest trained on {len(transaction_data)} samples")

def isolation_forest_predict(features: list) -> dict:
    """Use trained Isolation Forest to score a transaction."""
    if _model is None or _scaler is None:
        return mock_predict(features)

    X = _scaler.transform([features])
    # score_samples returns negative — more negative = more anomalous
    anomaly_score = _model.score_samples(X)[0]
    # Normalise to 0–100 risk score (invert: more negative → higher risk)
    normalised = max(0, min(100, int((-anomaly_score + 0.5) * 100)))

    return {
        "fraud_probability": round(normalised / 100, 4),
        "risk_score":        normalised,
        "risk_level":        "HIGH" if normalised >= 71 else "MEDIUM" if normalised >= 31 else "LOW",
        "recommendation":    "BLOCK" if normalised >= 90 else "FLAG" if normalised >= 31 else "ALLOW",
        "triggered_features": [],
        "model":             "isolation_forest_v1",
    }

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":       "ok",
        "ml_available": ML_AVAILABLE,
        "model_trained": _model is not None,
        "timestamp":    datetime.utcnow().isoformat(),
    })

@app.route("/fraud/predict", methods=["POST"])
def predict():
    """
    POST /fraud/predict
    Input:
      {
        "transaction_amount":    float,   # ₹ amount
        "transaction_frequency": int,     # txns in last hour
        "beneficiary_age_hours": float,   # hours since beneficiary added
        "failed_attempts":       int,     # failed attempts last hour
        "daily_volume":          float    # total ₹ transferred today
      }
    Output:
      {
        "fraud_probability": 0.0–1.0,
        "risk_score":        0–100,
        "risk_level":        "LOW" | "MEDIUM" | "HIGH",
        "recommendation":    "ALLOW" | "FLAG" | "BLOCK",
        "triggered_features": [...],
        "model":             "mock_heuristic_v1" | "isolation_forest_v1"
      }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    required = ["transaction_amount"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    try:
        features = build_feature_vector(data)
        # Use ML model if trained, else mock
        result = isolation_forest_predict(features) if _model else mock_predict(features)
        logger.info(f"Fraud predict: amount={data.get('transaction_amount')} → score={result['risk_score']} ({result['risk_level']})")
        return jsonify(result)
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({"error": "Prediction failed", "detail": str(e)}), 500

@app.route("/fraud/train", methods=["POST"])
def train():
    """
    POST /fraud/train
    Accepts historical transaction data to train the Isolation Forest model.
    Body: { "transactions": [[amount, freq, bene_age, failed, daily_vol], ...] }
    """
    if not ML_AVAILABLE:
        return jsonify({"error": "scikit-learn not installed in this environment"}), 503

    data = request.get_json(silent=True)
    if not data or "transactions" not in data:
        return jsonify({"error": "transactions array required"}), 400

    try:
        train_isolation_forest(data["transactions"])
        return jsonify({"status": "trained", "samples": len(data["transactions"])})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/fraud/features", methods=["GET"])
def feature_info():
    """Returns feature schema — useful for integration documentation."""
    return jsonify({
        "features":     FEATURE_NAMES,
        "description": {
            "transaction_amount":    "Amount in ₹",
            "transaction_frequency": "Number of transactions in last 60 minutes",
            "beneficiary_age_hours": "Hours since beneficiary was added (999 if not a beneficiary txn)",
            "failed_attempts":       "Failed transfer attempts in last 60 minutes",
            "daily_volume":          "Total ₹ transferred today (all successful transfers)",
        },
        "future_features": [
            "geo_velocity",          # Impossible travel detection
            "device_fingerprint",    # New device flag
            "hour_of_day",           # 2AM transactions are suspicious
            "weekend_flag",          # Weekend large transfers
            "account_age_days",      # New accounts are higher risk
        ]
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    debug = os.environ.get("FLASK_ENV") == "development"
    logger.info(f"SecureBank Fraud Service starting on port {port} (ML: {ML_AVAILABLE})")
    app.run(host="0.0.0.0", port=port, debug=debug)
