"""
REST API route handlers for HAZARDGUARD.
Connects SQLite/PostgreSQL operations, intelligence engine, scenario player,
ML risk inference, AI safety advisory, role-based auth, and audit logging.
"""

from datetime import datetime
import os
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends, status
from sqlalchemy.orm import Session

from models.schemas import (
    LoginRequest, SetupAdminRequest, SensorReading, ProfileUpdate,
    AcknowledgeRequest, IncidentTransitionRequest, WorkerUpdate, ScenarioControl
)
from database.connection import get_db, is_sqlite
from database.models import User, AuditLog
from services.auth_service import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_current_user_optional, require_role, log_audit_event
)
from services.engine import evaluate_severity
from services.scenario_player import player
from services.ml_service import compute_early_warning_risk, get_model_metrics
from services.ai_advisor import generate_incident_explanation
from database import store

router = APIRouter()


# ── AUTHENTICATION & SETUP ─────────────────────────────────────────────────────

@router.get("/api/auth/setup-status")
def get_setup_status(db: Session = Depends(get_db)):
    """Check if any users exist. If not, initial setup wizard is required."""
    has_users = db.query(User).count() > 0
    return {
        "is_setup_completed": has_users,
        "default_roles": ["ADMIN", "SAFETY_OPERATIONS", "VIEWER"]
    }


@router.post("/api/auth/setup")
def initial_setup(req: SetupAdminRequest, db: Session = Depends(get_db)):
    """First-time setup: creates initial administrator account."""
    if db.query(User).count() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System is already configured. Please sign in."
        )

    admin_user = User(
        username=req.username.strip(),
        email=req.email.strip().lower(),
        password_hash=hash_password(req.password),
        full_name=req.full_name.strip(),
        role="ADMIN",
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    token = create_access_token(admin_user)
    log_audit_event(db, {"username": admin_user.username, "role": "ADMIN", "user_id": admin_user.id},
                    "INITIAL_SETUP", "System Initialized", "Created primary administrator account")

    return {
        "status": "SETUP_COMPLETED",
        "token": token,
        "user": {
            "id": admin_user.id,
            "username": admin_user.username,
            "full_name": admin_user.full_name,
            "email": admin_user.email,
            "role": admin_user.role,
            "landing_page": "dashboard"
        }
    }


@router.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate with username/email and password. Returns JWT/bearer token and role."""
    uname = req.username.strip()
    user = db.query(User).filter(
        (User.username == uname) | (User.email == uname.lower())
    ).first()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify username/email and password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact system administrator."
        )

    user.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token(user)

    # Role-based landing page (Management/Admin -> dashboard, Safety Ops -> live monitoring, Viewer -> dashboard)
    landing = "monitoring" if user.role == "SAFETY_OPERATIONS" else "dashboard"

    log_audit_event(db, {"username": user.username, "role": user.role, "user_id": user.id},
                    "LOGIN", "User Session", f"Signed in successfully. Role: {user.role}")

    return {
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "landing_page": landing
        }
    }


@router.get("/api/auth/me")
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """Return authenticated user profile and permissions."""
    landing = "monitoring" if user.role == "SAFETY_OPERATIONS" else "dashboard"
    return {
        "user": user,
        "landing_page": landing
    }


# ── SYSTEM HEALTH & STATUS ─────────────────────────────────────────────────────

@router.get("/api")
@router.get("/api/health")
def api_health(db: Session = Depends(get_db)):
    """Comprehensive component health checks."""
    db_status = "HEALTHY"
    try:
        db.query(User).count()
    except Exception:
        db_status = "DEGRADED"

    ml_metrics = get_model_metrics()
    ml_status = "ONLINE (Trained Classifier)" if ml_metrics.get("status") != "NOT_TRAINED" else "READY"
    ai_status = "ONLINE (OpenAI GPT-4o-mini)" if os.getenv("OPENAI_API_KEY", "").strip() else "DETERMINISTIC ADVISORY ENGINE"

    return {
        "system": "HAZARDGUARD Intelligent Safety Monitoring Core",
        "version": "2.0.0",
        "status": "OPERATIONAL",
        "database": f"{'SQLite (hazardguard.db)' if is_sqlite else 'PostgreSQL'} - {db_status}",
        "components": {
            "backend": "HEALTHY",
            "database": db_status,
            "websocket": "READY (/ws/live)",
            "camera": "BROWSER WEBCAM COMPLIANT (CV: TESTBENCH)",
            "ml_engine": ml_status,
            "ai_advisor": ai_status
        }
    }


@router.get("/api/ml/metrics")
def get_ml_metrics_route():
    return get_model_metrics()


@router.get("/api/status")
def get_status():
    all_incidents = store.get_all_incidents()
    active_threats = [i for i in all_incidents if i.get("severity") in ("Critical", "High") and i.get("status") in ("OPEN", "ACKNOWLEDGED", "UNDER INVESTIGATION")]
    profiles = store.get_all_profiles()
    active_profile = next((p for p in profiles if p["status"] == "ACTIVE"), profiles[0] if profiles else None)
    workers = store.get_all_workers()
    online_workers = [w for w in workers if w["connection_status"] == "ONLINE"]

    return {
        "system_status": "ONLINE",
        "total_incidents": len(all_incidents),
        "active_critical_high": len(active_threats),
        "zones_monitored": len(store.get_all_zones()),
        "active_workers": len(online_workers),
        "total_workers": len(workers),
        "active_profile": active_profile["name"] if active_profile else "None",
        "timestamp": datetime.utcnow().isoformat()
    }


# ── DASHBOARD (ACCESSIBLE TO ALL AUTHENTICATED ROLES) ───────────────────────────

@router.get("/api/dashboard")
def get_dashboard():
    all_incidents = store.get_all_incidents()
    counts = {"Normal": 0, "Warning": 0, "High": 0, "Critical": 0}
    for inc in all_incidents:
        sev = inc.get("severity", "Normal")
        if sev in counts:
            counts[sev] += 1

    recent = all_incidents[:6]
    zones = store.get_all_zones()
    profiles = store.get_all_profiles()
    workers = store.get_all_workers()

    active_profile = next((p for p in profiles if p["status"] == "ACTIVE"), profiles[0] if profiles else None)

    return {
        "summary": counts,
        "recent_incidents": recent,
        "zones": zones,
        "profile": active_profile["name"] if active_profile else "General",
        "active_profile": active_profile,
        "total_workers": len(workers),
        "active_workers": len([w for w in workers if w["connection_status"] == "ONLINE"]),
    }


# ── SENSOR INTAKE & INFERENCE ──────────────────────────────────────────────────

@router.post("/api/sensor")
def post_sensor(reading: SensorReading):
    data = reading.model_dump()
    data["timestamp"] = datetime.utcnow().isoformat()
    zone = data.get("zone", "Zone 01")

    # Match zone profile
    profiles = store.get_all_profiles()
    matched_profile = next((p for p in profiles if p["assigned_zone"] == zone), profiles[0] if profiles else None)

    # 1. Evaluate with deterministic intelligence engine
    assessment = evaluate_severity(data, matched_profile)

    # 2. Attach temporal features and evaluate ML Risk
    data_with_temporal = dict(data)
    data_with_temporal["temporal"] = assessment.get("temporal", {})
    ml_risk = compute_early_warning_risk([], data_with_temporal)
    assessment["ml_risk"] = ml_risk

    # 3. Associate worker details
    workers = store.get_workers_by_zone(zone)
    assigned_worker = next((w for w in workers if w["id"] == data.get("worker_id")), workers[0] if workers else None)

    # 4. Persist sensor reading to database history
    store.record_live_sensor_reading(data, severity=assessment.get("severity", "Normal"))

    # 5. Automatically correlate & persist incident if Severity is not Normal
    created_incident = None
    if assessment["severity"] != "Normal":
        incident_payload = {
            "zone": zone,
            "worker_id": assigned_worker["id"] if assigned_worker else None,
            "worker_name": assigned_worker["name"] if assigned_worker else "Unassigned Personnel",
            "severity": assessment["severity"],
            "incident_type": assessment["incident_type"],
            "evidence": assessment["evidence"],
            "mechanisms": assessment["mechanisms"],
            "recommended_action": assessment["recommended_action"],
            "explanation": assessment["explanation"],
            "sensor_snapshot": data
        }
        created_incident = store.add_or_correlate_incident(incident_payload)

    return {
        "reading": data,
        "assessment": assessment,
        "worker": assigned_worker,
        "incident": created_incident
    }


# ── SCENARIO ENGINE & DEMO CONTROLLER ──────────────────────────────────────────

@router.get("/api/simulate")
def simulate_reading(scenario: str = "normal", zone: str = "Zone 01", worker_id: str = "W-101"):
    """Trigger or query deterministic scenario state."""
    player.set_scenario(scenario, zone, worker_id)
    reading_data = player.get_current_reading()

    profiles = store.get_all_profiles()
    matched_profile = next((p for p in profiles if p["assigned_zone"] == zone), profiles[0] if profiles else None)

    assessment = evaluate_severity(reading_data, matched_profile)

    reading_with_temp = dict(reading_data)
    reading_with_temp["temporal"] = assessment.get("temporal", {})
    ml_risk = compute_early_warning_risk([], reading_with_temp)
    assessment["ml_risk"] = ml_risk

    workers = store.get_workers_by_zone(zone)
    assigned_worker = next((w for w in workers if w["id"] == worker_id), workers[0] if workers else None)

    # Persist sensor reading
    store.record_live_sensor_reading(reading_data, severity=assessment.get("severity", "Normal"))

    created_incident = None
    if assessment["severity"] != "Normal":
        incident_payload = {
            "zone": zone,
            "worker_id": assigned_worker["id"] if assigned_worker else "W-101",
            "worker_name": assigned_worker["name"] if assigned_worker else "Arun Kumar",
            "severity": assessment["severity"],
            "incident_type": assessment["incident_type"],
            "evidence": assessment["evidence"],
            "mechanisms": assessment["mechanisms"],
            "recommended_action": assessment["recommended_action"],
            "explanation": assessment["explanation"],
            "sensor_snapshot": reading_data
        }
        created_incident = store.add_or_correlate_incident(incident_payload)

    return {
        "reading": reading_data,
        "assessment": assessment,
        "worker": assigned_worker,
        "incident": created_incident,
        "scenario_metadata": reading_data.get("scenario_metadata", {})
    }


@router.post("/api/scenario/control")
def control_scenario(ctrl: ScenarioControl):
    action = ctrl.action.lower()
    if action == "start":
        player.set_scenario(ctrl.scenario or "normal", ctrl.zone or "Zone 01", ctrl.worker_id or "W-101")
    elif action == "pause":
        player.pause()
    elif action == "resume":
        player.resume()
    elif action == "restart":
        player.restart()
    elif action == "stop":
        player.stop()

    return {"status": f"Scenario {action} executed", "current_state": player.get_current_reading()}


# ── WORKER ENDPOINTS ───────────────────────────────────────────────────────────

@router.get("/api/workers")
def list_workers():
    return {"workers": store.get_all_workers()}


@router.put("/api/workers/{worker_id}")
def update_worker(
    worker_id: str,
    updates: WorkerUpdate,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    # Enforce role permission if user is signed in: Viewers cannot edit
    if user and user["role"] == "VIEWER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Role 'VIEWER' is not permitted to modify worker records."
        )

    updated = store.update_worker_status(worker_id, updates.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Worker not found")

    if user:
        log_audit_event(db, user, "UPDATE_WORKER", f"Worker {worker_id}", f"Updated status: {updates.model_dump(exclude_unset=True)}")

    return {"status": "Worker updated", "worker": updated}


# ── ZONE ENDPOINTS ─────────────────────────────────────────────────────────────

@router.get("/api/zones")
def list_zones():
    return {"zones": store.get_all_zones()}


# ── PROFILE SLOTS (EXACTLY 4 SLOTS) ───────────────────────────────────────────

@router.get("/api/profiles")
def list_profiles():
    return {"profiles": store.get_all_profiles()}


@router.get("/api/profile")
def get_active_profile():
    profiles = store.get_all_profiles()
    active = next((p for p in profiles if p["status"] == "ACTIVE"), profiles[0] if profiles else None)
    return active or store.get_profile("slot_1")


@router.put("/api/profile")
def update_profile(
    profile_req: ProfileUpdate,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    if user and user["role"] == "VIEWER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Role 'VIEWER' is not permitted to modify profile configurations."
        )

    updated = store.update_profile_slot("slot_1", profile_req.model_dump(exclude_unset=True))
    if user:
        log_audit_event(db, user, "UPDATE_PROFILE", "Slot 1 Profile", "Modified thresholds/sensors")
    return {"status": "Profile updated", "profile": updated}


@router.put("/api/profiles/{slot_id}")
def update_profile_slot(
    slot_id: str,
    profile_req: ProfileUpdate,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    if user and user["role"] == "VIEWER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Role 'VIEWER' is not permitted to modify profile configurations."
        )

    updated = store.update_profile_slot(slot_id, profile_req.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail=f"Profile slot {slot_id} not found")

    if user:
        log_audit_event(db, user, "UPDATE_PROFILE", f"Profile {slot_id}", f"Updated parameters for {slot_id}")

    return {"status": f"Profile slot {slot_id} updated", "profile": updated}


# ── INCIDENTS & LIFECYCLE ──────────────────────────────────────────────────────

@router.get("/api/incidents")
def get_incidents():
    return {"incidents": store.get_all_incidents()}


@router.get("/api/incidents/{incident_id}")
def get_incident(incident_id: int):
    inc = store.get_incident_by_id(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return inc


@router.post("/api/incidents/transition")
def transition_incident_route(
    req: IncidentTransitionRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    # Enforce role permission: Viewers cannot advance lifecycle
    if user and user["role"] == "VIEWER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Role 'VIEWER' is not permitted to transition incident lifecycle states."
        )

    performed_by = req.performed_by or (user["full_name"] if user else "Control Room Supervisor")
    updated = store.transition_incident(
        incident_id=req.incident_id,
        new_status=req.new_status,
        performed_by=performed_by,
        notes=req.action_notes or ""
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transition request. State transition to '{req.new_status}' is not permitted from current incident state."
        )

    if user:
        log_audit_event(db, user, "TRANSITION_INCIDENT", f"Incident #{req.incident_id}", f"Advanced to {req.new_status}")

    return {"status": f"Transitioned to {req.new_status}", "incident": updated}


@router.post("/api/acknowledge")
def acknowledge_incident(
    req: AcknowledgeRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    if user and user["role"] == "VIEWER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Role 'VIEWER' is not permitted to acknowledge incidents."
        )

    performed_by = req.acknowledged_by or (user["full_name"] if user else "Supervisor")
    updated = store.transition_incident(
        incident_id=req.incident_id,
        new_status="ACKNOWLEDGED",
        performed_by=performed_by,
        notes=req.notes or ""
    )
    if not updated:
        raise HTTPException(status_code=400, detail="Cannot acknowledge incident (must be currently OPEN)")

    if user:
        log_audit_event(db, user, "ACKNOWLEDGE_INCIDENT", f"Incident #{req.incident_id}", "Acknowledged alert")

    return {"status": "Acknowledged", "incident": updated}


# ── AI SAFETY ADVISORY ─────────────────────────────────────────────────────────

@router.get("/api/incidents/{incident_id}/ai-explain")
async def ai_explain_incident(incident_id: int):
    inc = store.get_incident_by_id(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    advisory = await generate_incident_explanation(inc)
    return advisory


# ── AUDIT LOGS ─────────────────────────────────────────────────────────────────

@router.get("/api/audit-logs")
def get_audit_logs(
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Retrieve system audit logs for administrative review."""
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100).all()
    return {
        "logs": [
            {
                "id": log.id,
                "username": log.username,
                "role": log.role,
                "action": log.action,
                "target": log.target,
                "notes": log.notes,
                "outcome": log.outcome,
                "timestamp": log.timestamp.isoformat()
            }
            for log in logs
        ]
    }


# ── RESET (EXPLICIT ADMIN DEMO ACTION) ─────────────────────────────────────────

@router.post("/api/reset")
def reset_data(
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    if user and user["role"] != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only role 'ADMIN' is authorized to reset incident data."
        )

    store.clear_all_incidents()
    player.stop()

    if user:
        log_audit_event(db, user, "SYSTEM_RESET", "All Incidents", "Cleared incident history and reset demo scenario")

    return {"status": "All incident records cleared; scenario reset to baseline."}
