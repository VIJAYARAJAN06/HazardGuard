"""
HAZARDGUARD Monitoring & Intelligence Engine.
Deterministic multi-factor severity evaluation, multi-source evidence correlation,
Expected vs. Actual state checks, and temporal duration reasoning.
"""

from typing import Dict, Any, List, Optional
from services.temporal_tracker import record_reading


def evaluate_severity(reading: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Evaluate sensor reading against profile thresholds, expected behavior,
    and temporal sliding window analysis.

    Returns:
        severity       : Normal | Warning | High | Critical
        evidence       : list of specific empirical observations
        mechanisms     : list of triggered failure/hazard mechanisms
        expected_state : description of expected personnel/environmental conditions
        actual_state   : description of observed state
        mismatch_found : bool
        incident_type  : specific operational classification
        recommended_action : actionable tactical guideline
        explanation    : comprehensive operational synthesis
        temporal       : rate of change and duration metrics
        sensor_status  : map of active/disabled status per sensor
    """
    zone = reading.get("zone", "Zone 01")
    temporal = record_reading(zone, reading)

    # 1. Determine active sensor mask from Profile
    enabled_sensors = ["gas", "temperature", "humidity", "movement", "camera"]
    thresholds = {
        "gas_warning": 30.0,
        "gas_critical": 60.0,
        "temp_warning": 35.0,
        "temp_critical": 50.0
    }
    expected_events = ["entry_detected", "periodic_movement", "exit_confirmed"]

    if profile:
        enabled_sensors = profile.get("enabled_sensors", profile.get("inputs", enabled_sensors))
        thresholds = profile.get("thresholds", thresholds)
        expected_events = profile.get("expected_events", expected_events)

    sensor_status = {
        "gas": "ACTIVE" if "gas" in enabled_sensors else "DISABLED",
        "temperature": "ACTIVE" if "temperature" in enabled_sensors else "DISABLED",
        "humidity": "ACTIVE" if "humidity" in enabled_sensors else "DISABLED",
        "movement": "ACTIVE" if "movement" in enabled_sensors else "DISABLED",
        "camera": "ACTIVE" if "camera" in enabled_sensors else "DISABLED",
    }

    evidence: List[str] = []
    mechanisms: List[str] = []

    # 2. Extract values
    person_detected = bool(reading.get("person_detected", True))
    movement = bool(reading.get("movement", True))
    gas = float(reading.get("gas_level", 0.0))
    temp = float(reading.get("temperature", 22.0))
    posture = str(reading.get("posture", "STANDING")).upper()

    # 3. Expected State Definition
    expected_items = []
    if "periodic_movement" in expected_events:
        expected_items.append("Continuous/periodic personnel movement")
    if "entry_detected" in expected_events:
        expected_items.append("Monitored personnel presence in designated safe zone")
    expected_items.append(f"Safe atmospheric gas < {thresholds.get('gas_warning', 30.0)}%")
    expected_items.append(f"Thermal levels < {thresholds.get('temp_warning', 35.0)}°C")
    expected_state_str = "; ".join(expected_items)

    # 4. Actual State Definition
    inactivity_dur = temporal["inactivity_duration_sec"]
    actual_items = []
    actual_items.append(f"Personnel: {'Present' if person_detected else 'Absent'} ({posture})")
    actual_items.append(f"Movement: {'Active' if movement else f'Absent for {inactivity_dur}s'}")
    if sensor_status["gas"] == "ACTIVE":
        actual_items.append(f"Gas: {gas:.1f}% ({temporal['gas_trend']})")
    else:
        actual_items.append("Gas: Sensor Disabled")
    if sensor_status["temperature"] == "ACTIVE":
        actual_items.append(f"Temp: {temp:.1f}°C")
    actual_state_str = "; ".join(actual_items)

    # 5. Sensor Evaluation (Only ACTIVE sensors participate)
    gas_elevated = False
    gas_critical = False
    temp_elevated = False
    temp_critical = False

    if sensor_status["gas"] == "ACTIVE":
        if gas >= thresholds.get("gas_critical", 60.0):
            gas_critical = True
            evidence.append(f"Critical Atmospheric Hazard: Gas concentration at {gas:.1f}% exceeds danger limit ({thresholds.get('gas_critical', 60.0)}%)")
        elif gas >= thresholds.get("gas_warning", 30.0):
            gas_elevated = True
            evidence.append(f"Elevated Atmospheric Hazard: Gas at {gas:.1f}% exceeds warning threshold ({thresholds.get('gas_warning', 30.0)}%)")

        if temporal["gas_trend"] == "RAPID_SURGE":
            evidence.append(f"Rapid surge detected: Gas rising at {temporal['gas_rate_per_min']}%/min")

    if sensor_status["temperature"] == "ACTIVE":
        if temp >= thresholds.get("temp_critical", 50.0):
            temp_critical = True
            evidence.append(f"Critical Thermal Hazard: Temperature at {temp:.1f}°C exceeds threshold ({thresholds.get('temp_critical', 50.0)}°C)")
        elif temp >= thresholds.get("temp_warning", 35.0):
            temp_elevated = True
            evidence.append(f"Elevated Temperature: {temp:.1f}°C exceeds threshold ({thresholds.get('temp_warning', 35.0)}°C)")

    # 6. Worker & Movement Evaluation
    no_movement = False
    if sensor_status["movement"] == "ACTIVE":
        if not movement or temporal["inactivity_duration_sec"] > 10.0:
            no_movement = True
            evidence.append(f"Worker Inactivity: Lack of movement sustained for {max(temporal['inactivity_duration_sec'], 15.0):.0f} seconds")
            mechanisms.append("Mechanism 1: Expected periodic worker movement missing")

    if posture in ("DOWN", "LYING"):
        evidence.append("Camera / IMU detection: Worker posture identified as DOWN / UNRESPONSIVE")
        mechanisms.append("Mechanism 4: Postural collapse / person-down condition detected")

    if not person_detected and "entry_detected" in expected_events:
        evidence.append("Expected personnel presence not detected in designated zone")

    # 7. Multi-source Correlation
    env_abnormal = (gas_elevated or gas_critical or temp_elevated or temp_critical)

    if env_abnormal and no_movement and person_detected:
        mechanisms.append("Mechanism 3: Abnormal toxic/thermal environment correlated with worker immobility (Personnel Distress)")

    if (gas_elevated or gas_critical) and no_movement and person_detected:
        mechanisms.append("Mechanism 2: Active atmospheric hazard present without evacuation response")

    mismatch_found = len(mechanisms) > 0 or len(evidence) > 0

    # 8. Deterministic Severity Classification
    # Score calculation
    critical_signals = sum([
        gas_critical,
        temp_critical,
        (no_movement and env_abnormal),
        (posture in ("DOWN", "LYING")),
        (temporal["inactivity_duration_sec"] >= 45.0 and env_abnormal)
    ])

    high_signals = sum([
        gas_elevated and no_movement,
        gas_critical,
        temp_critical,
        no_movement and temporal["inactivity_duration_sec"] >= 30.0,
        temp_elevated and no_movement
    ])

    if critical_signals >= 2 or (gas_critical and no_movement) or (posture in ("DOWN", "LYING") and env_abnormal):
        severity = "Critical"
    elif high_signals >= 1 or critical_signals == 1:
        severity = "High"
    elif len(evidence) >= 1:
        severity = "Warning"
    else:
        severity = "Normal"

    # 9. Recommended Tactical Action
    recommended = {
        "Critical": "IMMEDIATE EMERGENCY EVACUATION. Sound zone alarms and dispatch rapid response rescue team with breathing apparatus.",
        "High":     "HAZARD ESCALATION. Verify personnel status via comms immediately. Prepare rescue squad for staging.",
        "Warning":  "ELEVATED RISK. Instruct technician to inspect sensor perimeter and verify ventilation airflow.",
        "Normal":   "All atmospheric, thermal, and personnel activity indicators are within safe operating limits."
    }.get(severity, "Maintain standard continuous monitoring.")

    # 10. Operational Narrative Explanation
    explanation = _build_explanation(zone, severity, evidence, mechanisms, temporal, sensor_status)

    # 11. Incident Type
    incident_type = {
        "Critical": "Personnel Incapacitation / Severe Atmospheric Breach",
        "High":     "Escalating Hazard — Worker At Risk",
        "Warning":  "Parameter Threshold Advisory",
        "Normal":   "Normal Safe Operations"
    }.get(severity, "Normal Operations")

    return {
        "severity": severity,
        "evidence": evidence,
        "mechanisms": mechanisms,
        "expected_state": expected_state_str,
        "actual_state": actual_state_str,
        "mismatch_found": mismatch_found,
        "incident_type": incident_type,
        "recommended_action": recommended,
        "explanation": explanation,
        "temporal": temporal,
        "sensor_status": sensor_status
    }


def _build_explanation(zone: str, severity: str, evidence: List[str], mechanisms: List[str], temporal: Dict[str, Any], sensor_status: Dict[str, str]) -> str:
    if not evidence:
        return f"Routine surveillance in {zone}: All active sensors operate within baseline tolerances. No physiological or environmental anomalies present."

    ev_text = " | ".join(evidence)
    mech_text = " • ".join(mechanisms) if mechanisms else "Single-sensor threshold breach without multi-vector failure."

    return (
        f"HAZARDGUARD System Alert for {zone} (Assessed: {severity.upper()}). "
        f"Observed Evidence: {ev_text}. "
        f"Failure Mechanisms Triggered: {mech_text}. "
        f"Dynamic Analysis: Gas vector is {temporal['gas_trend']} ({temporal['gas_rate_per_min']}%/min), "
        f"Worker inactivity sustained at {temporal['inactivity_duration_sec']}s. "
        "Deterministic correlation indicates immediate operational intervention required."
    )
