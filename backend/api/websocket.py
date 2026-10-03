"""
WebSocket streaming handler for HAZARDGUARD.
Streams live sensor readings, worker states, ML risk gradient, and scenario ticks every second.
Persists live sensor telemetry to database history and automatically correlates & persists
incidents to SQLite/PostgreSQL whenever hazard conditions are detected (deduplicated).
"""

import asyncio
from datetime import datetime
from typing import List
from fastapi import WebSocket, WebSocketDisconnect

from services.engine import evaluate_severity
from services.scenario_player import player
from services.ml_service import compute_early_warning_risk
from database import store


class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict) -> None:
        for ws in list(self.active):
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(ws)


manager = ConnectionManager()


async def live_feed(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            # 1. Advance scenario player tick by 1 second
            reading = player.tick(1.0)
            zone = reading.get("zone", "Zone 01")

            # 2. Get profile for active zone
            profiles = store.get_all_profiles()
            matched_profile = next((p for p in profiles if p["assigned_zone"] == zone), profiles[0] if profiles else None)

            # 3. Evaluate severity deterministically with temporal tracker
            assessment = evaluate_severity(reading, matched_profile)

            # 4. Attach temporal features to reading for ML inference
            reading_with_temporal = dict(reading)
            reading_with_temporal["temporal"] = assessment.get("temporal", {})

            # 5. Compute ML Early Warning Risk using live temporal features
            ml_risk = compute_early_warning_risk([], reading_with_temporal)
            assessment["ml_risk"] = ml_risk

            # 6. Fetch associated worker
            workers = store.get_workers_by_zone(zone)
            assigned_worker = next((w for w in workers if w["id"] == reading.get("worker_id")), workers[0] if workers else None)

            # 7. Persist sensor reading to database history
            severity = assessment.get("severity", "Normal")
            store.record_live_sensor_reading(reading, severity=severity)

            # 8. Automatically correlate & persist incident if severity is not Normal
            created_or_updated_incident = None
            if severity != "Normal":
                incident_payload = {
                    "zone": zone,
                    "worker_id": assigned_worker["id"] if assigned_worker else None,
                    "worker_name": assigned_worker["name"] if assigned_worker else "Unassigned Personnel",
                    "severity": severity,
                    "incident_type": assessment.get("incident_type", "Hazard Alert"),
                    "evidence": assessment.get("evidence", []),
                    "mechanisms": assessment.get("mechanisms", []),
                    "recommended_action": assessment.get("recommended_action", "Maintain safety protocol."),
                    "explanation": assessment.get("explanation", ""),
                    "sensor_snapshot": reading
                }
                created_or_updated_incident = store.add_or_correlate_incident(incident_payload)

            payload = {
                "reading": reading,
                "assessment": assessment,
                "worker": assigned_worker,
                "incident": created_or_updated_incident,
                "scenario_metadata": reading.get("scenario_metadata", {})
            }

            await manager.broadcast(payload)
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
