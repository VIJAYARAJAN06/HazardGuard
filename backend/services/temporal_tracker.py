"""
HAZARDGUARD Temporal Sensor Tracker.
Maintains a rolling sliding window of sensor readings per zone to compute:
- Rate of change (d/dt) for Gas, Temperature, and Humidity
- Duration of sustained missing movement (in seconds)
- Duration of sustained threshold breaches
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
import collections

# Keep last 60 seconds of readings per zone (1 reading/sec approx)
_ZONE_BUFFERS: Dict[str, collections.deque] = collections.defaultdict(lambda: collections.deque(maxlen=60))
_INACTIVITY_TIMESTAMPS: Dict[str, Optional[datetime]] = {}
_LAST_INCIDENT_TIMESTAMPS: Dict[str, Optional[datetime]] = {}


def record_reading(zone: str, reading: Dict[str, Any]) -> Dict[str, Any]:
    """
    Appends reading to sliding window and returns temporal analysis:
    - gas_trend: 'STEADY', 'RISING', 'RAPID_SURGE', 'FALLING'
    - temp_trend: 'STEADY', 'RISING', 'FALLING'
    - humidity_trend: 'STEADY', 'RISING', 'FALLING'
    - inactivity_duration_sec: float
    - gas_rate_per_min: float
    """
    now = datetime.utcnow()
    buffer = _ZONE_BUFFERS[zone]

    item = {
        "timestamp": now,
        "gas_level": float(reading.get("gas_level", 0.0)),
        "temperature": float(reading.get("temperature", 22.0)),
        "humidity": float(reading.get("humidity", 50.0)),
        "movement": bool(reading.get("movement", True)),
        "person_detected": bool(reading.get("person_detected", True))
    }
    buffer.append(item)

    # Inactivity tracking
    if not item["movement"]:
        if zone not in _INACTIVITY_TIMESTAMPS or _INACTIVITY_TIMESTAMPS[zone] is None:
            _INACTIVITY_TIMESTAMPS[zone] = now
        inactivity_sec = (now - _INACTIVITY_TIMESTAMPS[zone]).total_seconds()
    else:
        _INACTIVITY_TIMESTAMPS[zone] = None
        inactivity_sec = 0.0

    # Trend calculation
    gas_rate = 0.0
    gas_trend = "STEADY"
    temp_trend = "STEADY"
    hum_trend = "STEADY"

    if len(buffer) >= 2:
        oldest = buffer[0]
        dt = (now - oldest["timestamp"]).total_seconds()
        if dt > 0.5:
            d_gas = item["gas_level"] - oldest["gas_level"]
            gas_rate = (d_gas / dt) * 60.0  # % per minute
            d_temp = item["temperature"] - oldest["temperature"]
            temp_rate = (d_temp / dt) * 60.0 # C per minute
            d_hum = item["humidity"] - oldest.get("humidity", 50.0)
            hum_rate = (d_hum / dt) * 60.0

            if gas_rate > 20.0:
                gas_trend = "RAPID_SURGE"
            elif gas_rate > 5.0:
                gas_trend = "RISING"
            elif gas_rate < -5.0:
                gas_trend = "FALLING"

            if temp_rate > 10.0:
                temp_trend = "RISING"
            elif temp_rate < -5.0:
                temp_trend = "FALLING"

            if hum_rate > 15.0:
                hum_trend = "RISING"
            elif hum_rate < -15.0:
                hum_trend = "FALLING"

    return {
        "gas_trend": gas_trend,
        "temp_trend": temp_trend,
        "humidity_trend": hum_trend,
        "gas_rate_per_min": round(gas_rate, 1),
        "inactivity_duration_sec": round(inactivity_sec, 1)
    }


def reset_zone_tracker(zone: str):
    if zone in _ZONE_BUFFERS:
        _ZONE_BUFFERS[zone].clear()
    _INACTIVITY_TIMESTAMPS[zone] = None
