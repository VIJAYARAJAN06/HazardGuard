"""
WebSocket streaming handler for HAZARDGUARD.
Streams live sensor readings, worker states, and scenario ticks every second.
Uses deterministic ScenarioPlayer (no random jitter).
"""

import asyncio
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

            # 2. Get profile for active zone
            profiles = store.get_all_profiles()
            matched_profile = next((p for p in profiles if p["assigned_zone"] == reading.get("zone")), profiles[0] if profiles else None)

            # 3. Evaluate severity deterministically
            assessment = evaluate_severity(reading, matched_profile)

            # 4. Compute ML Early Warning Risk
            ml_risk = compute_early_warning_risk([], reading)
            assessment["ml_risk"] = ml_risk

            # 5. Fetch associated worker
            workers = store.get_workers_by_zone(reading.get("zone", "Zone 01"))
            assigned_worker = next((w for w in workers if w["id"] == reading.get("worker_id")), workers[0] if workers else None)

            payload = {
                "reading": reading,
                "assessment": assessment,
                "worker": assigned_worker,
                "scenario_metadata": reading.get("scenario_metadata", {})
            }

            await manager.broadcast(payload)
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
