"""
Database initialization and default seeding for HAZARDGUARD.
Seeds 4 primary hazard zones, exactly 4 profile slots, industrial workers,
and default role-based accounts (Admin, Safety Operator, Viewer/Auditor) if not already populated.
Non-destructive: Never overwrites or deletes existing records on restart.
"""

import json
from datetime import datetime
from database.connection import engine, Base, SessionLocal
from database.models import Zone, Worker, Profile, User, SystemLog
from services.auth_service import hash_password


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Seed 3 Role-Based Accounts if none exist
        if db.query(User).count() == 0:
            default_users = [
                User(
                    username="admin",
                    email="admin@hazardguard.io",
                    password_hash=hash_password("admin123"),
                    full_name="Plant Safety Administrator",
                    role="ADMIN",
                    is_active=True
                ),
                User(
                    username="operator",
                    email="operator@hazardguard.io",
                    password_hash=hash_password("operator123"),
                    full_name="Control Room Lead Operator",
                    role="SAFETY_OPERATIONS",
                    is_active=True
                ),
                User(
                    username="auditor",
                    email="auditor@hazardguard.io",
                    password_hash=hash_password("auditor123"),
                    full_name="Workplace Compliance Auditor",
                    role="VIEWER",
                    is_active=True
                ),
            ]
            db.add_all(default_users)
            db.commit()

        # 2. Seed 4 Zones
        if db.query(Zone).count() == 0:
            zones_data = [
                Zone(id="Zone 01", name="Zone 01 - Confined Space Tank", hazard_type="Confined Space / Hypoxia", description="Storage vessel interior. High risk of gas accumulation."),
                Zone(id="Zone 02", name="Zone 02 - Chemical Processing Area", hazard_type="Toxic Gas / VOC", description="Refining column perimeter. Volatile organic vapor zone."),
                Zone(id="Zone 03", name="Zone 03 - High Temp Furnace Room", hazard_type="Extreme Heat / Combustion", description="Smelting furnace corridor. Heat exhaustion and fire danger."),
                Zone(id="Zone 04", name="Zone 04 - High Voltage Switchyard", hazard_type="Arc Flash / Electrocution", description="Main sub-station power distribution yard."),
            ]
            db.add_all(zones_data)
            db.commit()

        # 3. Seed exactly 4 Profile Slots
        if db.query(Profile).count() == 0:
            profiles_data = [
                Profile(
                    id="slot_1",
                    slot_number=1,
                    name="Confined Space Entry",
                    assigned_zone="Zone 01",
                    status="ACTIVE",
                    enabled_sensors=json.dumps(["gas", "temperature", "humidity", "movement", "camera"]),
                    thresholds=json.dumps({"gas_warning": 25.0, "gas_critical": 55.0, "temp_warning": 35.0, "temp_critical": 48.0, "humidity_warning": 70.0, "humidity_critical": 85.0}),
                    expected_events=json.dumps(["entry_detected", "periodic_movement", "exit_confirmed"]),
                    alert_contacts=json.dumps(["safety.supervisor@hazardguard.io", "+1-800-555-SAFE"])
                ),
                Profile(
                    id="slot_2",
                    slot_number=2,
                    name="Chemical Handling & Refinement",
                    assigned_zone="Zone 02",
                    status="ACTIVE",
                    enabled_sensors=json.dumps(["gas", "temperature", "humidity", "movement", "camera"]),
                    thresholds=json.dumps({"gas_warning": 30.0, "gas_critical": 60.0, "temp_warning": 38.0, "temp_critical": 50.0, "humidity_warning": 75.0, "humidity_critical": 90.0}),
                    expected_events=json.dumps(["periodic_movement", "ppe_check"]),
                    alert_contacts=json.dumps(["chem.lead@hazardguard.io"])
                ),
                Profile(
                    id="slot_3",
                    slot_number=3,
                    name="Furnace Corridor Maintenance",
                    assigned_zone="Zone 03",
                    status="ACTIVE",
                    enabled_sensors=json.dumps(["temperature", "humidity", "movement"]),
                    thresholds=json.dumps({"gas_warning": 40.0, "gas_critical": 70.0, "temp_warning": 42.0, "temp_critical": 55.0, "humidity_warning": 65.0, "humidity_critical": 80.0}),
                    expected_events=json.dumps(["periodic_movement", "cool_down_break"]),
                    alert_contacts=json.dumps(["plant.engineer@hazardguard.io"])
                ),
                Profile(
                    id="slot_4",
                    slot_number=4,
                    name="Lone Worker Switchyard",
                    assigned_zone="Zone 04",
                    status="REGISTERED",
                    enabled_sensors=json.dumps(["movement", "camera"]),
                    thresholds=json.dumps({"gas_warning": 30.0, "gas_critical": 60.0, "temp_warning": 35.0, "temp_critical": 50.0, "humidity_warning": 80.0, "humidity_critical": 95.0}),
                    expected_events=json.dumps(["periodic_movement", "scheduled_heartbeat"]),
                    alert_contacts=json.dumps(["switchyard.ops@hazardguard.io"])
                ),
            ]
            db.add_all(profiles_data)
            db.commit()

        # 4. Seed Workers with realistic identities and zone distribution
        if db.query(Worker).count() == 0:
            workers_data = [
                Worker(id="W-101", name="Arun Kumar", role="Senior Inspection Tech", zone_id="Zone 01", profile_id="slot_1", connection_status="ONLINE", active_status="ACTIVE", current_posture="STANDING", current_movement="NORMAL"),
                Worker(id="W-102", name="Priya Sharma", role="Chemical Process Operator", zone_id="Zone 02", profile_id="slot_2", connection_status="ONLINE", active_status="ACTIVE", current_posture="STANDING", current_movement="NORMAL"),
                Worker(id="W-103", name="Vikram Singh", role="Safety & Hazmat Specialist", zone_id="Zone 02", profile_id="slot_2", connection_status="ONLINE", active_status="ACTIVE", current_posture="STANDING", current_movement="NORMAL"),
                Worker(id="W-104", name="Marcus Vance", role="Furnace Maintenance Tech", zone_id="Zone 03", profile_id="slot_3", connection_status="ONLINE", active_status="ACTIVE", current_posture="SITTING", current_movement="NORMAL"),
                Worker(id="W-105", name="Elena Rostova", role="Substation Electrical Engineer", zone_id="Zone 04", profile_id="slot_4", connection_status="OFFLINE", active_status="INACTIVE", current_posture="STANDING", current_movement="ABSENT"),
            ]
            db.add_all(workers_data)
            db.commit()

        # Log system boot
        db.add(SystemLog(category="SYSTEM", message="HAZARDGUARD Database Initialized and Verified", level="INFO"))
        db.commit()
    finally:
        db.close()
