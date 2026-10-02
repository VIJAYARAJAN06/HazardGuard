"""
REST API route handlers for HAZARDGUARD.
Connects SQLite database operations, intelligence engine, scenario player,
ML risk inference, and AI safety advisory.
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from models.schemas import (
    SensorReading, ProfileUpdate, AcknowledgeRequest,
    IncidentTransitionRequest, WorkerUpdate, ScenarioControl
)
from services.engine import evaluate_severity
from services.scenario_player import player
from services.ml_service import compute_early_warning_risk, get_model_metrics
from services.ai_advisor import generate_incident_explanation
from database import store

router = APIRouter()


# ── HEALTH / SYSTEM STATUS ─────────────────────────────────────────────────────

@router.get("/")
def root():
    return {
        "system": "HAZARDGUARD Intelligent Safety Monitoring Core",
        "version": "2.0.0",
        "status": "OPERATIONAL",
        "database": "SQLite (hazardguard.db)",
        "engine": "Deterministic Intelligence + Anomaly Risk + GenAI Advisory"
    }


@router.get("/api/ml/metrics")
def get_ml_metrics():
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


# ── DASHBOARD ──────────────────────────────────────────────────────────────────

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

    # Find matching zone profile if exists
    profiles = store.get_all_profiles()
    matched_profile = next((p for p in profiles if p["assigned_zone"] == data.get("zone")), profiles[0] if profiles else None)

    # 1. Evaluate with deterministic intelligence engine
    assessment = evaluate_severity(data, matched_profile)

    # 2. Evaluate with ML Early Warning Risk model
    ml_risk = compute_early_warning_risk([], data)
    assessment["ml_risk"] = ml_risk

    # 3. Associate worker details
    workers = store.get_workers_by_zone(data.get("zone", "Zone 01"))
    assigned_worker = next((w for w in workers if w["id"] == data.get("worker_id")), workers[0] if workers else None)

    # 4. Automatically persist incident if Severity is not Normal
    created_incident = None
    if assessment["severity"] != "Normal":
        incident_payload = {
            "zone": data.get("zone", "Zone 01"),
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
        created_incident = store.add_incident(incident_payload)

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

    # Pass through standard sensor intake pipeline
    profiles = store.get_all_profiles()
    matched_profile = next((p for p in profiles if p["assigned_zone"] == zone), profiles[0] if profiles else None)

    assessment = evaluate_severity(reading_data, matched_profile)
    ml_risk = compute_early_warning_risk([], reading_data)
    assessment["ml_risk"] = ml_risk

    workers = store.get_workers_by_zone(zone)
    assigned_worker = next((w for w in workers if w["id"] == worker_id), workers[0] if workers else None)

    # If critical/high/warning, create incident record
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
        created_incident = store.add_incident(incident_payload)

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
def update_worker(worker_id: str, updates: WorkerUpdate):
    updated = store.update_worker_status(worker_id, updates.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"status": "Worker updated", "worker": updated}


# ── ZONE ENDPOINTS ─────────────────────────────────────────────────────────────

@router.get("/api/zones")
def list_zones():
    return {"zones": store.get_all_zones()}


# ── PROFILE SLOTS (4 SLOTS) ────────────────────────────────────────────────────

@router.get("/api/profiles")
def list_profiles():
    return {"profiles": store.get_all_profiles()}


@router.get("/api/profile")
def get_active_profile():
    profiles = store.get_all_profiles()
    active = next((p for p in profiles if p["status"] == "ACTIVE"), profiles[0] if profiles else None)
    return active or store.get_profile("slot_1")


@router.put("/api/profile")
def update_profile(profile_req: ProfileUpdate):
    # Backward compatibility with v1
    updated = store.update_profile_slot("slot_1", profile_req.model_dump(exclude_unset=True))
    return {"status": "Profile updated", "profile": updated}


@router.put("/api/profiles/{slot_id}")
def update_profile_slot(slot_id: str, profile_req: ProfileUpdate):
    updated = store.update_profile_slot(slot_id, profile_req.model_dump(exclude_unset=True))
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
def transition_incident_route(req: IncidentTransitionRequest):
    updated = store.transition_incident(
        incident_id=req.incident_id,
        new_status=req.new_status,
        performed_by=req.performed_by,
        notes=req.action_notes or ""
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"status": f"Transitioned to {req.new_status}", "incident": updated}


@router.post("/api/acknowledge")
def acknowledge_incident(req: AcknowledgeRequest):
    updated = store.acknowledge_incident(
        incident_id=req.incident_id,
        acknowledged_by=req.acknowledged_by,
        acknowledged_at=datetime.utcnow().isoformat(),
        notes=req.notes or "",
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"status": "Acknowledged", "incident": updated}


@router.get("/api/acknowledgements")
def get_acknowledgements():
    return store.get_acknowledgements()


# ── AI SAFETY ADVISORY ─────────────────────────────────────────────────────────

@router.get("/api/incidents/{incident_id}/ai-explain")
async def ai_explain_incident(incident_id: int):
    inc = store.get_incident_by_id(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    advisory = await generate_incident_explanation(inc)
    return advisory


# ── RESET ──────────────────────────────────────────────────────────────────────

@router.post("/api/reset")
def reset_data():
    store.clear_all_incidents()
    player.stop()
    return {"status": "All incident records cleared; scenario reset to baseline."}
