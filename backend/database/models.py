"""
SQLAlchemy ORM models for HAZARDGUARD:
- User (Role-Based Authentication: ADMIN, SAFETY_OPERATIONS, VIEWER)
- Worker
- Zone
- Profile (Exactly 4 slots)
- Incident (with 5-stage lifecycle)
- IncidentTransition (audit trail)
- SensorReadingHistory
- SystemLog
- AuditLog (Privileged action logging)
"""

from datetime import datetime
import json
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from database.connection import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(128), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    full_name = Column(String(128), nullable=False)
    role = Column(String(32), nullable=False) # "ADMIN", "SAFETY_OPERATIONS", "VIEWER"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class Zone(Base):
    __tablename__ = "zones"

    id = Column(String(32), primary_key=True)  # e.g., "Zone 01"
    name = Column(String(128), nullable=False)
    description = Column(String(256), default="")
    hazard_type = Column(String(64), default="General Industrial")
    created_at = Column(DateTime, default=datetime.utcnow)

    workers = relationship("Worker", back_populates="zone_rel")
    profiles = relationship("Profile", back_populates="zone_rel")


class Worker(Base):
    __tablename__ = "workers"

    id = Column(String(32), primary_key=True)  # e.g. "W-101"
    name = Column(String(128), nullable=False)
    role = Column(String(64), nullable=False)
    zone_id = Column(String(32), ForeignKey("zones.id"), nullable=True)
    profile_id = Column(String(32), nullable=True)
    connection_status = Column(String(32), default="ONLINE")  # ONLINE, OFFLINE
    active_status = Column(String(32), default="ACTIVE")      # ACTIVE, ATTENTION, INACTIVE
    current_posture = Column(String(32), default="STANDING")  # STANDING, SITTING, DOWN
    current_movement = Column(String(32), default="NORMAL")   # NORMAL, LOW, ABSENT
    last_seen = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    zone_rel = relationship("Zone", back_populates="workers")


class Profile(Base):
    __tablename__ = "profiles"

    # Fixed 4 slots: "slot_1", "slot_2", "slot_3", "slot_4"
    id = Column(String(32), primary_key=True)
    slot_number = Column(Integer, unique=True, nullable=False)
    name = Column(String(128), nullable=False)
    assigned_zone = Column(String(32), ForeignKey("zones.id"), nullable=True)
    status = Column(String(32), default="REGISTERED")  # ACTIVE, REGISTERED, INACTIVE

    # JSON stored as text
    enabled_sensors = Column(Text, default="[]")       # ["gas", "temperature", "humidity", "movement", "camera"]
    thresholds = Column(Text, default="{}")            # {"gas_warning": 30, "gas_critical": 60, "temp_warning": 35, "temp_critical": 50, "humidity_warning": 70}
    expected_events = Column(Text, default="[]")       # ["entry_detected", "periodic_movement", "exit_confirmed"]
    alert_contacts = Column(Text, default="[]")        # ["supervisor@example.com"]
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    zone_rel = relationship("Zone", back_populates="profiles")

    def get_enabled_sensors(self):
        try:
            return json.loads(self.enabled_sensors or "[]")
        except Exception:
            return []

    def get_thresholds(self):
        try:
            return json.loads(self.thresholds or "{}")
        except Exception:
            return {
                "gas_warning": 30.0, "gas_critical": 60.0,
                "temp_warning": 35.0, "temp_critical": 50.0,
                "humidity_warning": 70.0, "humidity_critical": 85.0
            }

    def get_expected_events(self):
        try:
            return json.loads(self.expected_events or "[]")
        except Exception:
            return []

    def get_alert_contacts(self):
        try:
            return json.loads(self.alert_contacts or "[]")
        except Exception:
            return []


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_code = Column(String(32), unique=True, nullable=False, index=True) # e.g. "INC-1001"
    zone = Column(String(32), nullable=False)
    worker_id = Column(String(32), nullable=True)
    worker_name = Column(String(128), nullable=True)
    severity = Column(String(32), nullable=False)   # Normal, Warning, High, Critical
    incident_type = Column(String(128), nullable=False)
    status = Column(String(32), default="OPEN")     # OPEN, ACKNOWLEDGED, UNDER INVESTIGATION, RESOLVED, CLOSED
    
    evidence_json = Column(Text, default="[]")
    mechanisms_json = Column(Text, default="[]")
    recommended_action = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    sensor_snapshot = Column(Text, default="{}")

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String(128), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(128), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    transitions = relationship("IncidentTransition", back_populates="incident_rel", cascade="all, delete-orphan")

    def get_evidence(self):
        try:
            return json.loads(self.evidence_json or "[]")
        except Exception:
            return []

    def get_mechanisms(self):
        try:
            return json.loads(self.mechanisms_json or "[]")
        except Exception:
            return []

    def get_sensor_snapshot(self):
        try:
            return json.loads(self.sensor_snapshot or "{}")
        except Exception:
            return {}


class IncidentTransition(Base):
    __tablename__ = "incident_transitions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    from_status = Column(String(32), nullable=False)
    to_status = Column(String(32), nullable=False)
    performed_by = Column(String(128), nullable=False)
    action_notes = Column(Text, default="")
    timestamp = Column(DateTime, default=datetime.utcnow)

    incident_rel = relationship("Incident", back_populates="transitions")


class SensorReadingHistory(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone = Column(String(32), nullable=False, index=True)
    worker_id = Column(String(32), nullable=True)
    gas_level = Column(Float, default=0.0)
    temperature = Column(Float, default=22.0)
    humidity = Column(Float, default=50.0)
    movement = Column(Boolean, default=True)
    person_detected = Column(Boolean, default=True)
    posture = Column(String(32), default="STANDING")
    severity_assessed = Column(String(32), default="Normal")
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(64), nullable=False)
    message = Column(Text, nullable=False)
    level = Column(String(16), default="INFO")
    timestamp = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String(64), nullable=False)
    role = Column(String(32), nullable=False)
    action = Column(String(64), nullable=False) # e.g. "UPDATE_PROFILE", "ACKNOWLEDGE_INCIDENT", "ASSIGN_WORKER"
    target = Column(String(128), nullable=False) # e.g. "Profile slot_1", "Incident INC-1002"
    notes = Column(Text, default="")
    outcome = Column(String(32), default="SUCCESS")
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
