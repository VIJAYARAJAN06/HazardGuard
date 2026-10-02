"""
Demo scenario simulator.

Provides pre-defined sensor readings for the four demonstration scenarios.
This is simulation-only code for Phase 1 demonstrations.

Phase 2: this module will be replaced by real sensor acquisition.
The API endpoint (/api/simulate) will remain for testing even after
real hardware is connected.
"""

import random
import datetime
from typing import Dict, Any


# ── Static scenarios ───────────────────────────────────────────────────────────
SCENARIOS: Dict[str, Dict[str, Any]] = {
    "normal": {
        "person_detected": True,
        "movement": True,
        "gas_level": 5.0,
        "temperature": 24.0,
        "humidity": 48.0,
        "heart_rate": 72.0,
        "spo2": 98.0,
        "zone": "Zone 01",
    },
    "warning": {
        "person_detected": True,
        "movement": True,
        "gas_level": 35.0,
        "temperature": 38.0,
        "humidity": 60.0,
        "heart_rate": 90.0,
        "spo2": 95.0,
        "zone": "Zone 02",
    },
    "high": {
        "person_detected": True,
        "movement": False,
        "gas_level": 55.0,
        "temperature": 45.0,
        "humidity": 70.0,
        "heart_rate": 50.0,
        "spo2": 91.0,
        "zone": "Zone 03",
    },
    "critical": {
        "person_detected": True,
        "movement": False,
        "gas_level": 75.0,
        "temperature": 58.0,
        "humidity": 80.0,
        "heart_rate": 38.0,
        "spo2": 84.0,
        "zone": "Zone 02",
    },
}


def get_scenario(name: str) -> Dict[str, Any]:
    """Return a copy of a named scenario dict, or 'normal' if not found."""
    reading = dict(SCENARIOS.get(name, SCENARIOS["normal"]))
    reading["timestamp"] = datetime.datetime.utcnow().isoformat()
    return reading


def generate_live_reading() -> Dict[str, Any]:
    """
    Generate a randomised live sensor reading for the WebSocket feed.

    This replaces real sensor input in Phase 1.
    Phase 2: this function is removed; the WebSocket handler reads from
    the MQTT/hardware acquisition layer instead.
    """
    return {
        "person_detected": True,
        "movement": random.random() > 0.1,
        "gas_level": round(random.uniform(2, 80), 1),
        "temperature": round(random.uniform(20, 60), 1),
        "humidity": round(random.uniform(30, 85), 1),
        "heart_rate": round(random.uniform(40, 110), 0),
        "spo2": round(random.uniform(82, 99), 0),
        "zone": random.choice(["Zone 01", "Zone 02", "Zone 03"]),
        "timestamp": datetime.datetime.utcnow().isoformat(),
    }
