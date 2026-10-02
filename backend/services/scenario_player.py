"""
HAZARDGUARD Stateful Deterministic Scenario Player.
Replaces random jitter with a controlled, realistic timeline player:
- Normal Scenario
- Warning Scenario
- High Scenario
- Critical Scenario
- Realistic gradual progression over 120 seconds:
    00:00 - 00:30 : Normal (Gas 8 -> 10%, Temp 25 -> 26C, Movement Active)
    00:30 - 00:60 : Warning (Gas 12 -> 35%, Temp 27 -> 36C, Movement begins reducing)
    00:60 - 00:90 : High (Gas 36 -> 55%, Temp 37 -> 44C, Movement low/sporadic)
    00:90 - 01:20 : Critical (Gas 56 -> 78%, Temp 45 -> 54C, Movement absent, Posture DOWN)

Supports: Start, Pause, Resume, Restart, Stop, and Step.
"""

from datetime import datetime
import threading
import time
from typing import Dict, Any, Optional

class ScenarioPlayer:
    def __init__(self):
        self.lock = threading.Lock()
        self.scenario_name = "normal"
        self.elapsed_seconds = 0
        self.max_duration = 120
        self.is_running = False
        self.is_paused = False
        self.zone = "Zone 01"
        self.worker_id = "W-101"
        self.last_update = datetime.utcnow()

    def set_scenario(self, name: str, zone: str = "Zone 01", worker_id: str = "W-101"):
        with self.lock:
            self.scenario_name = name.lower()
            self.elapsed_seconds = 0
            self.zone = zone
            self.worker_id = worker_id
            self.is_running = True
            self.is_paused = False
            self.last_update = datetime.utcnow()

    def pause(self):
        with self.lock:
            self.is_paused = True

    def resume(self):
        with self.lock:
            self.is_paused = False
            self.last_update = datetime.utcnow()

    def restart(self):
        with self.lock:
            self.elapsed_seconds = 0
            self.is_paused = False
            self.is_running = True
            self.last_update = datetime.utcnow()

    def stop(self):
        with self.lock:
            self.is_running = False
            self.is_paused = False
            self.elapsed_seconds = 0

    def tick(self, step_sec: float = 1.0) -> Dict[str, Any]:
        """Advance time by step_sec and compute deterministic readings."""
        with self.lock:
            if self.is_running and not self.is_paused:
                self.elapsed_seconds = min(self.max_duration, self.elapsed_seconds + step_sec)

            return self._calculate_current_state()

    def get_current_reading(self) -> Dict[str, Any]:
        with self.lock:
            return self._calculate_current_state()

    def _calculate_current_state(self) -> Dict[str, Any]:
        s = self.scenario_name
        t = self.elapsed_seconds

        # 1. Preset Scenarios vs Dynamic Timeline
        if s == "timeline":
            # 2. Gradual 120-second Scenario Timeline (Default dynamic progression)
            # 0-30s Normal, 30-60s Warning, 60-90s High, 90-120s Critical
            if t < 30:
                prog = t / 30.0
                gas = 8.0 + prog * 4.0        # 8 -> 12%
                temp = 24.0 + prog * 2.0      # 24 -> 26C
                hum = 45.0 + prog * 5.0
                movement = True
                posture = "STANDING"
                stage = "NORMAL: Routine Baseline Surveillance (00:00 - 00:30)"
            elif t < 60:
                prog = (t - 30.0) / 30.0
                gas = 12.0 + prog * 24.0      # 12 -> 36%
                temp = 26.0 + prog * 10.0     # 26 -> 36C
                hum = 50.0 + prog * 8.0
                movement = True
                posture = "STANDING"
                stage = "WARNING: Atmospheric Hazard Escalation (00:30 - 01:00)"
            elif t < 90:
                prog = (t - 60.0) / 30.0
                gas = 36.0 + prog * 20.0      # 36 -> 56%
                temp = 36.0 + prog * 9.0      # 36 -> 45C
                hum = 58.0 + prog * 12.0
                movement = (t % 4 == 0)        # Intermittent / sluggish movement
                posture = "SITTING"
                stage = "HIGH: Toxic Accumulation & Worker Distress (01:00 - 01:30)"
            else:
                prog = (t - 90.0) / 30.0
                gas = 56.0 + prog * 22.0      # 56 -> 78%
                temp = 45.0 + prog * 11.0     # 45 -> 56C
                hum = 70.0 + prog * 12.0
                movement = False
                posture = "DOWN"
                stage = "CRITICAL: Severe Hazard & Worker Incapacitation (01:30 - 02:00)"
        elif s == "normal":
            gas = 8.0 + (t % 10) * 0.2
            temp = 24.5 + (t % 8) * 0.1
            hum = 48.0
            movement = True
            posture = "STANDING"
            stage = "NORMAL BASELINE PRESET"
        elif s == "warning":
            gas = 34.0 + (t % 10) * 0.3
            temp = 37.0 + (t % 8) * 0.2
            hum = 55.0
            movement = True
            posture = "STANDING"
            stage = "WARNING ADVISORY PRESET"
        elif s == "high":
            gas = 54.0 + (t % 10) * 0.4
            temp = 44.0 + (t % 8) * 0.2
            hum = 65.0
            movement = False
            posture = "SITTING"
            stage = "HIGH THREAT ESCALATION PRESET"
        elif s == "critical":
            gas = 76.0 + (t % 10) * 0.5
            temp = 56.0 + (t % 8) * 0.3
            hum = 75.0
            movement = False
            posture = "DOWN"
            stage = "CRITICAL EMERGENCY PRESET"
        else:
            gas = 8.0
            temp = 24.0
            hum = 45.0
            movement = True
            posture = "STANDING"
            stage = "BASELINE"

        return {
            "zone": self.zone,
            "worker_id": self.worker_id,
            "gas_level": round(gas, 1),
            "temperature": round(temp, 1),
            "humidity": round(hum, 1),
            "movement": movement,
            "person_detected": True,
            "posture": posture,
            "timestamp": datetime.utcnow().isoformat(),
            "scenario_metadata": {
                "scenario_name": self.scenario_name,
                "elapsed_seconds": int(t),
                "max_duration": self.max_duration,
                "stage": stage,
                "is_running": self.is_running,
                "is_paused": self.is_paused,
                "time_display": f"{int(t)//60:02d}:{int(t)%60:02d}"
            }
        }

# Global singleton scenario player
player = ScenarioPlayer()
