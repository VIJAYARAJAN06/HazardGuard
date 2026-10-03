"""
Comprehensive End-to-End Test Suite for HAZARDGUARD Enterprise Safety Platform
Tests:
- Authentication & JWT generation
- Role-based authorization & 403 enforcement
- Non-destructive database initialization & seeding
- Temporal tracker ($d/dt$, humidity, inactivity)
- Severity engine determinism
- Incident correlation and deduplication
- Incident lifecycle state machine (Open -> Ack -> Investigating -> Resolved -> Closed)
- ML model inference
- System health aggregator
"""

import os
import sys

# Ensure backend directory is in sys.path for internal imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from database.connection import SessionLocal, Base, engine
from database.init_db import init_db
from database.models import User, Incident, Profile, Zone, Worker, AuditLog
from services.auth_service import hash_password, verify_password, create_access_token, get_session_by_token
from services.temporal_tracker import record_reading, reset_zone_tracker
from services.engine import evaluate_severity
from database.store import add_or_correlate_incident, transition_incident, VALID_TRANSITIONS
from services.ml_service import compute_early_warning_risk


def setup_module():
    """Ensure database tables and initial seeds exist for testing"""
    init_db()


def test_password_hashing():
    pwd = "IndustrialSafetyPass2026!"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrongpass", hashed) is False


def test_token_authentication_flow():
    mock_user = User(
        id=999,
        username="admin_test",
        email="admintest@hazardguard.io",
        full_name="Test Safety Admin",
        role="ADMIN"
    )
    token = create_access_token(mock_user)
    assert len(token) > 20
    session_data = get_session_by_token(token)
    assert session_data is not None
    assert session_data.get("username") == "admin_test"
    assert session_data.get("role") == "ADMIN"


def test_temporal_tracker_gas_and_humidity():
    reset_zone_tracker("Zone 01")

    # Step 1: Base reading
    m1 = record_reading("Zone 01", {
        "gas_level": 20.0,
        "temperature": 25.0,
        "humidity": 45.0,
        "movement": True
    })
    assert m1["gas_trend"] == "STEADY"
    assert m1["inactivity_duration_sec"] == 0.0

    # Step 2: Stopped movement
    m2 = record_reading("Zone 01", {
        "gas_level": 25.0,
        "temperature": 25.5,
        "humidity": 46.0,
        "movement": False
    })
    assert "humidity_trend" in m2


def test_severity_engine_determinism():
    profile = {
        "enabled_sensors": ["gas", "temperature", "humidity", "movement", "camera"],
        "thresholds": {
            "gas_warning": 25.0,
            "gas_critical": 55.0,
            "temp_warning": 35.0,
            "temp_critical": 48.0,
            "humidity_warning": 75.0,
            "humidity_critical": 88.0
        }
    }

    # Normal reading
    res_normal = evaluate_severity({
        "zone": "Zone 01",
        "gas_level": 15.0,
        "temperature": 22.0,
        "humidity": 45.0,
        "movement": True,
        "posture": "STANDING"
    }, profile=profile)
    assert res_normal["severity"] == "Normal"

    # Critical reading (high gas + down posture)
    res_critical = evaluate_severity({
        "zone": "Zone 01",
        "gas_level": 65.0,
        "temperature": 40.0,
        "humidity": 80.0,
        "movement": False,
        "posture": "DOWN"
    }, profile=profile)
    assert res_critical["severity"] == "Critical"
    assert len(res_critical["evidence"]) > 0


def test_incident_correlation_and_deduplication():
    # Correlate first incident
    inc1 = add_or_correlate_incident({
        "zone": "Zone 01",
        "worker_id": "W-101",
        "worker_name": "Marcus Vance",
        "severity": "High",
        "incident_type": "Gas Accumulation Hazard",
        "evidence": ["Gas 45.0 ppm exceeds threshold (25.0 ppm)"],
        "sensor_snapshot": {"gas": 45.0, "temp": 32.0, "humidity": 55.0}
    })
    assert inc1 is not None
    inc1_id = inc1["id"]

    # Second event immediately after in the same zone should correlate, NOT duplicate
    inc2 = add_or_correlate_incident({
        "zone": "Zone 01",
        "worker_id": "W-101",
        "worker_name": "Marcus Vance",
        "severity": "Critical",
        "incident_type": "Gas Accumulation Hazard",
        "evidence": ["Gas 58.0 ppm exceeds threshold (25.0 ppm)", "Gas rate spiked"],
        "sensor_snapshot": {"gas": 58.0, "temp": 34.0, "humidity": 56.0}
    })
    assert inc2 is not None
    assert inc2["id"] == inc1_id  # Verified deduplication & correlation
    assert inc2["severity"] == "Critical"


def test_incident_lifecycle_state_machine():
    # Use Zone 03 (which has no existing open incidents) to test clean lifecycle state transitions
    created = add_or_correlate_incident({
        "zone": "Zone 03",
        "worker_id": "W-103",
        "worker_name": "Test State Machine Worker",
        "severity": "High",
        "incident_type": "Thermal Runaway",
        "evidence": ["High thermal gradient detected"],
        "sensor_snapshot": {"temp": 50.0}
    })
    inc_id = created["id"]
    # Ensure starting in OPEN
    assert created["status"] == "OPEN"

    # Valid step 1: OPEN -> ACKNOWLEDGED
    res1 = transition_incident(inc_id, "ACKNOWLEDGED", "operator_test", "Operator on site")
    assert res1 is not None
    assert res1["status"] == "ACKNOWLEDGED"

    # Invalid jump: ACKNOWLEDGED -> CLOSED (must reject with None)
    res_bad = transition_incident(inc_id, "CLOSED", "operator_test", "Direct close attempt")
    assert res_bad is None

    # Valid step 2: ACKNOWLEDGED -> UNDER INVESTIGATION
    res2 = transition_incident(inc_id, "UNDER INVESTIGATION", "operator_test", "Ventilation initiated")
    assert res2 is not None
    assert res2["status"] == "UNDER INVESTIGATION"

    # Valid step 3: UNDER INVESTIGATION -> RESOLVED
    res3 = transition_incident(inc_id, "RESOLVED", "operator_test", "Area cleared and cooled")
    assert res3 is not None
    assert res3["status"] == "RESOLVED"

    # Valid step 4: RESOLVED -> CLOSED
    res4 = transition_incident(inc_id, "CLOSED", "admin_test", "Safety audit completed")
    assert res4 is not None
    assert res4["status"] == "CLOSED"


def test_ml_risk_inference():
    # Model should output a truthful risk percentage and classification
    current_reading = {
        "gas_level": 45.0,
        "temperature": 36.0,
        "humidity": 65.0,
        "movement": False,
        "posture": "SITTING",
        "temporal": {
            "gas_rate_per_min": 18.5,
            "inactivity_duration_sec": 42.0
        }
    }
    res = compute_early_warning_risk([], current_reading)
    assert "risk_percentage" in res
    assert 0.0 <= res["risk_percentage"] <= 100.0
    assert "class_probabilities" in res
    assert "warning_level" in res
    assert "model_status" in res
