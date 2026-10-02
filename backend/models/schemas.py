"""
Pydantic request/response schemas for HAZARDGUARD.
Defines types for Workers, Profiles (4 slots), Incidents, Lifecycle Transitions,
Sensors, and Scenarios.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class SensorReading(BaseModel):
    zone: str = "Zone 01"
    worker_id: Optional[str] = "W-101"
    person_detected: bool = True
    movement: bool = True
    posture: str = "STANDING"
    gas_level: float = 0.0
    temperature: float = 22.0
    humidity: float = 50.0
    heart_rate: Optional[float] = None
    spo2: Optional[float] = None
    timestamp: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    assigned_zone: Optional[str] = None
    status: Optional[str] = None
    inputs: Optional[List[str]] = None
    enabled_sensors: Optional[List[str]] = None
    thresholds: Optional[Dict[str, float]] = None
    expected_events: Optional[List[str]] = None
    alert_contacts: Optional[List[str]] = None


class IncidentTransitionRequest(BaseModel):
    incident_id: int
    new_status: str # "ACKNOWLEDGED", "UNDER INVESTIGATION", "RESOLVED", "CLOSED"
    performed_by: str
    action_notes: Optional[str] = ""


class AcknowledgeRequest(BaseModel):
    incident_id: int
    acknowledged_by: str
    notes: Optional[str] = ""


class WorkerUpdate(BaseModel):
    zone_id: Optional[str] = None
    connection_status: Optional[str] = None
    active_status: Optional[str] = None
    current_posture: Optional[str] = None
    current_movement: Optional[str] = None


class ScenarioControl(BaseModel):
    action: str # "start", "pause", "resume", "restart", "stop"
    scenario: Optional[str] = "normal"
    zone: Optional[str] = "Zone 01"
    worker_id: Optional[str] = "W-101"
