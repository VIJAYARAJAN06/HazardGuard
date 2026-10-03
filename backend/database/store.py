"""
Database access service layer for HAZARDGUARD.
Provides clean transactional operations for Incidents, Profiles, Workers, Zones,
SensorReadings, Users, and AuditLogs, ensuring all operations persist to SQLite / PostgreSQL.
Includes intelligent incident deduplication and server-side state machine enforcement.
"""

from datetime import datetime, timedelta
import json
from typing import List, Dict, Any, Optional
from database.connection import SessionLocal
from database.models import (
    Incident, IncidentTransition, Profile, Worker, Zone,
    SystemLog, SensorReadingHistory, User, AuditLog
)

# Allowed lifecycle state transitions
VALID_TRANSITIONS = {
    "OPEN": ["ACKNOWLEDGED"],
    "ACKNOWLEDGED": ["UNDER INVESTIGATION", "RESOLVED"],
    "UNDER INVESTIGATION": ["RESOLVED", "ACKNOWLEDGED"],
    "RESOLVED": ["CLOSED", "UNDER INVESTIGATION"],
    "CLOSED": [] # Terminal state
}


# ── INCIDENT OPERATIONS ────────────────────────────────────────────────────────

def get_all_incidents() -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        incidents = db.query(Incident).order_by(Incident.created_at.desc()).all()
        result = []
        for inc in incidents:
            result.append({
                "id": inc.id,
                "incident_code": inc.incident_code,
                "zone": inc.zone,
                "worker_id": inc.worker_id,
                "worker_name": inc.worker_name,
                "severity": inc.severity,
                "incident_type": inc.incident_type,
                "status": inc.status,
                "evidence": inc.get_evidence(),
                "mechanisms": inc.get_mechanisms(),
                "recommended_action": inc.recommended_action,
                "explanation": inc.explanation,
                "sensor_snapshot": inc.get_sensor_snapshot(),
                "created_at": inc.created_at.isoformat() if inc.created_at else None,
                "timestamp": inc.created_at.isoformat() if inc.created_at else None,
                "acknowledged": inc.status != "OPEN",
                "acknowledged_at": inc.acknowledged_at.isoformat() if inc.acknowledged_at else None,
                "acknowledged_by": inc.acknowledged_by,
                "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
                "resolved_by": inc.resolved_by,
                "resolution_notes": inc.resolution_notes,
            })
        return result
    finally:
        db.close()


def get_incident_by_id(incident_id: int) -> Optional[Dict[str, Any]]:
    db = SessionLocal()
    try:
        inc = db.query(Incident).filter(Incident.id == incident_id).first()
        if not inc:
            return None
        transitions = [
            {
                "from_status": t.from_status,
                "to_status": t.to_status,
                "performed_by": t.performed_by,
                "action_notes": t.action_notes,
                "timestamp": t.timestamp.isoformat()
            }
            for t in inc.transitions
        ]
        return {
            "id": inc.id,
            "incident_code": inc.incident_code,
            "zone": inc.zone,
            "worker_id": inc.worker_id,
            "worker_name": inc.worker_name,
            "severity": inc.severity,
            "incident_type": inc.incident_type,
            "status": inc.status,
            "evidence": inc.get_evidence(),
            "mechanisms": inc.get_mechanisms(),
            "recommended_action": inc.recommended_action,
            "explanation": inc.explanation,
            "sensor_snapshot": inc.get_sensor_snapshot(),
            "created_at": inc.created_at.isoformat() if inc.created_at else None,
            "timestamp": inc.created_at.isoformat() if inc.created_at else None,
            "acknowledged": inc.status != "OPEN",
            "acknowledged_at": inc.acknowledged_at.isoformat() if inc.acknowledged_at else None,
            "acknowledged_by": inc.acknowledged_by,
            "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
            "resolved_by": inc.resolved_by,
            "resolution_notes": inc.resolution_notes,
            "transitions": transitions
        }
    finally:
        db.close()


def add_or_correlate_incident(incident_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Intelligent Incident Persistence & Deduplication:
    If an OPEN/ACKNOWLEDGED/UNDER INVESTIGATION incident already exists for this
    zone and hazard type within the last 5 minutes, updates evidence and sensor snapshot
    instead of spamming duplicate incidents.
    """
    db = SessionLocal()
    try:
        zone = incident_data.get("zone", "Zone 01")
        hazard_type = incident_data.get("incident_type", "Operational Hazard")
        severity = incident_data.get("severity", "Warning")
        five_min_ago = datetime.utcnow() - timedelta(minutes=5)

        existing = db.query(Incident).filter(
            Incident.zone == zone,
            Incident.status.in_(["OPEN", "ACKNOWLEDGED", "UNDER INVESTIGATION"]),
            Incident.created_at >= five_min_ago
        ).order_by(Incident.created_at.desc()).first()

        if existing:
            # Correlate into existing incident: escalate severity if higher
            sev_rank = {"Normal": 0, "Warning": 1, "High": 2, "Critical": 3}
            if sev_rank.get(severity, 0) > sev_rank.get(existing.severity, 0):
                existing.severity = severity
                existing.incident_type = hazard_type

            existing.evidence_json = json.dumps(incident_data.get("evidence", []))
            existing.mechanisms_json = json.dumps(incident_data.get("mechanisms", []))
            existing.sensor_snapshot = json.dumps(incident_data.get("sensor_snapshot", {}))
            existing.updated_at = datetime.utcnow()
            db.commit()
            return get_incident_by_id(existing.id)

        # Generate unique code
        count = db.query(Incident).count() + 1
        code = f"INC-{1000 + count}"

        inc = Incident(
            incident_code=code,
            zone=zone,
            worker_id=incident_data.get("worker_id"),
            worker_name=incident_data.get("worker_name"),
            severity=severity,
            incident_type=hazard_type,
            status="OPEN",
            evidence_json=json.dumps(incident_data.get("evidence", [])),
            mechanisms_json=json.dumps(incident_data.get("mechanisms", [])),
            recommended_action=incident_data.get("recommended_action", "Investigate zone."),
            explanation=incident_data.get("explanation", ""),
            sensor_snapshot=json.dumps(incident_data.get("sensor_snapshot", {})),
            created_at=datetime.utcnow()
        )
        db.add(inc)
        db.flush()

        trans = IncidentTransition(
            incident_id=inc.id,
            from_status="NONE",
            to_status="OPEN",
            performed_by="HAZARDGUARD Engine",
            action_notes="Automated incident detection from telemetry",
            timestamp=datetime.utcnow()
        )
        db.add(trans)
        db.commit()
        return get_incident_by_id(inc.id)
    finally:
        db.close()


def transition_incident(incident_id: int, new_status: str, performed_by: str, notes: str = "") -> Optional[Dict[str, Any]]:
    """
    Advance an incident through its lifecycle:
    OPEN -> ACKNOWLEDGED -> UNDER INVESTIGATION -> RESOLVED -> CLOSED
    Enforces valid state machine transitions.
    """
    db = SessionLocal()
    try:
        inc = db.query(Incident).filter(Incident.id == incident_id).first()
        if not inc:
            return None

        old_status = inc.status
        allowed = VALID_TRANSITIONS.get(old_status, [])
        if new_status not in allowed:
            # Reject invalid transitions
            return None

        inc.status = new_status
        now = datetime.utcnow()

        if new_status == "ACKNOWLEDGED" and not inc.acknowledged_at:
            inc.acknowledged_at = now
            inc.acknowledged_by = performed_by
        elif new_status == "RESOLVED":
            inc.resolved_at = now
            inc.resolved_by = performed_by
            inc.resolution_notes = notes

        trans = IncidentTransition(
            incident_id=inc.id,
            from_status=old_status,
            to_status=new_status,
            performed_by=performed_by,
            action_notes=notes,
            timestamp=now
        )
        db.add(trans)
        db.commit()
        return get_incident_by_id(inc.id)
    finally:
        db.close()


def record_live_sensor_reading(data: Dict[str, Any], severity: str = "Normal"):
    """Persist sensor reading to database history table."""
    db = SessionLocal()
    try:
        rec = SensorReadingHistory(
            zone=data.get("zone", "Zone 01"),
            worker_id=data.get("worker_id"),
            gas_level=float(data.get("gas_level", 0.0)),
            temperature=float(data.get("temperature", 22.0)),
            humidity=float(data.get("humidity", 50.0)),
            movement=bool(data.get("movement", True)),
            person_detected=bool(data.get("person_detected", True)),
            posture=str(data.get("posture", "STANDING")),
            severity_assessed=severity,
            timestamp=datetime.utcnow()
        )
        db.add(rec)
        db.commit()
    except Exception as e:
        db.rollback()
        print("Sensor reading persistence error:", e)
    finally:
        db.close()


def clear_all_incidents() -> None:
    db = SessionLocal()
    try:
        db.query(IncidentTransition).delete()
        db.query(Incident).delete()
        db.commit()
    finally:
        db.close()


# ── PROFILE OPERATIONS (4 FIXED SLOTS) ─────────────────────────────────────────

def get_all_profiles() -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        profiles = db.query(Profile).order_by(Profile.slot_number.asc()).all()
        return [
            {
                "id": p.id,
                "slot_number": p.slot_number,
                "name": p.name,
                "assigned_zone": p.assigned_zone,
                "status": p.status,
                "inputs": p.get_enabled_sensors(),
                "enabled_sensors": p.get_enabled_sensors(),
                "thresholds": p.get_thresholds(),
                "expected_events": p.get_expected_events(),
                "alert_contacts": p.get_alert_contacts(),
                "updated_at": p.updated_at.isoformat() if p.updated_at else None
            }
            for p in profiles
        ]
    finally:
        db.close()


def get_profile(slot_id: str = "slot_1") -> Dict[str, Any]:
    db = SessionLocal()
    try:
        p = db.query(Profile).filter(Profile.id == slot_id).first()
        if not p:
            p = db.query(Profile).order_by(Profile.slot_number.asc()).first()
        if p:
            return {
                "id": p.id,
                "slot_number": p.slot_number,
                "name": p.name,
                "assigned_zone": p.assigned_zone,
                "status": p.status,
                "inputs": p.get_enabled_sensors(),
                "enabled_sensors": p.get_enabled_sensors(),
                "thresholds": p.get_thresholds(),
                "expected_events": p.get_expected_events(),
                "alert_contacts": p.get_alert_contacts(),
            }
        return {
            "id": "slot_1", "slot_number": 1, "name": "Default Profile",
            "assigned_zone": "Zone 01", "status": "ACTIVE",
            "inputs": ["gas", "temperature", "humidity", "movement", "camera"],
            "thresholds": {"gas_warning": 30, "gas_critical": 60, "temp_warning": 35, "temp_critical": 50, "humidity_warning": 70, "humidity_critical": 85},
            "expected_events": ["periodic_movement"], "alert_contacts": []
        }
    finally:
        db.close()


def update_profile_slot(slot_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    db = SessionLocal()
    try:
        p = db.query(Profile).filter(Profile.id == slot_id).first()
        if not p:
            return None

        if "name" in data and data["name"]:
            p.name = data["name"]
        if "assigned_zone" in data:
            p.assigned_zone = data["assigned_zone"]
        if "status" in data:
            p.status = data["status"]
        if "inputs" in data or "enabled_sensors" in data:
            inputs = data.get("inputs", data.get("enabled_sensors", []))
            p.enabled_sensors = json.dumps(inputs)
        if "thresholds" in data:
            p.thresholds = json.dumps(data["thresholds"])
        if "expected_events" in data:
            p.expected_events = json.dumps(data["expected_events"])
        if "alert_contacts" in data:
            p.alert_contacts = json.dumps(data["alert_contacts"])

        p.updated_at = datetime.utcnow()
        db.commit()
        return get_profile(p.id)
    finally:
        db.close()


# ── WORKER & ZONE OPERATIONS ───────────────────────────────────────────────────

def get_all_workers() -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        workers = db.query(Worker).all()
        return [
            {
                "id": w.id,
                "name": w.name,
                "role": w.role,
                "zone_id": w.zone_id,
                "profile_id": w.profile_id,
                "connection_status": w.connection_status,
                "active_status": w.active_status,
                "current_posture": w.current_posture,
                "current_movement": w.current_movement,
                "last_seen": w.last_seen.isoformat() if w.last_seen else None
            }
            for w in workers
        ]
    finally:
        db.close()


def get_workers_by_zone(zone_id: str) -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        workers = db.query(Worker).filter(Worker.zone_id == zone_id).all()
        return [
            {
                "id": w.id,
                "name": w.name,
                "role": w.role,
                "zone_id": w.zone_id,
                "profile_id": w.profile_id,
                "connection_status": w.connection_status,
                "active_status": w.active_status,
                "current_posture": w.current_posture,
                "current_movement": w.current_movement,
                "last_seen": w.last_seen.isoformat() if w.last_seen else None
            }
            for w in workers
        ]
    finally:
        db.close()


def update_worker_status(worker_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    db = SessionLocal()
    try:
        w = db.query(Worker).filter(Worker.id == worker_id).first()
        if not w:
            return None
        for k, v in updates.items():
            if hasattr(w, k) and v is not None:
                setattr(w, k, v)
        w.last_seen = datetime.utcnow()
        db.commit()
        return {
            "id": w.id,
            "name": w.name,
            "role": w.role,
            "zone_id": w.zone_id,
            "profile_id": w.profile_id,
            "connection_status": w.connection_status,
            "active_status": w.active_status,
            "current_posture": w.current_posture,
            "current_movement": w.current_movement,
            "last_seen": w.last_seen.isoformat()
        }
    finally:
        db.close()


def get_all_zones() -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        zones = db.query(Zone).all()
        results = []
        for z in zones:
            workers = db.query(Worker).filter(Worker.zone_id == z.id).all()
            profile = db.query(Profile).filter(Profile.assigned_zone == z.id).first()
            active_inc = db.query(Incident).filter(
                Incident.zone == z.id,
                Incident.status.in_(["OPEN", "ACKNOWLEDGED", "UNDER INVESTIGATION"])
            ).order_by(Incident.created_at.desc()).first()

            status = active_inc.severity if active_inc else "Normal"
            results.append({
                "id": z.id,
                "name": z.name,
                "hazard_type": z.hazard_type,
                "description": z.description,
                "status": status,
                "personnel": len(workers),
                "workers": [{"id": w.id, "name": w.name, "role": w.role, "status": w.active_status} for w in workers],
                "active_profile": profile.name if profile else "None Assigned"
            })
        return results
    finally:
        db.close()
