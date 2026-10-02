# HAZARDGUARD — Intelligent Hazard-Zone Personnel Monitoring System
**Authoritative Architectural Specification & Project Documentation**

---

## 1. Product Purpose & Overview
**HAZARDGUARD** is an industrial safety surveillance platform designed for high-risk work environments (confined space tanks, chemical refining columns, high-temperature furnace rooms, and electrical switchyards).

The software correlates multi-sensor environmental telemetry (gas concentration, temperature, humidity), worker physiological & kinetic indicators (movement, posture, sustained inactivity), and visual camera streams to detect failure mechanisms, compute deterministic severity levels, and generate structured operational advisories for control room supervisors.

---

## 2. Locked Page & Information Order

The project enforces a **strictly locked information and navigation sequence**:

1. **Dashboard** (`Page 1`):
   - Global severity KPIs (Critical, High, Warning, Normal).
   - Real-time status of 4 monitored hazard zones.
   - Active worker registry with connection statuses.
   - Recent incident event feed.
2. **Live Monitoring** (`Page 2`):
   - Primary operational command console.
   - Monitored zone and worker assignment selector.
   - Live sensor readouts (Gas %, Temperature °C, Humidity %, Displacement, Posture).
   - Expected State vs. Actual State comparison.
   - Real laptop webcam video ingestion via `navigator.mediaDevices.getUserMedia`.
   - Stateful 120-second deterministic scenario player (Restart, Pause, Resume) with instant presets.
   - Live ML Early Warning Risk percentage and trend indicator.
   - Dynamic incident threat card with empirical evidence points and tactical directives.
3. **Incidents & Evidence** (`Page 3`):
   - Filterable incident repository (All, Critical, High, Warning, Normal).
   - Correlated empirical evidence points and triggered failure mechanisms.
   - Telemetry snapshot recorded at T-0 of incident creation.
4. **AI Explanation** (`Page 4`):
   - Operational safety advisory synthesis.
   - If an OpenAI API key is configured, invokes `gpt-4o-mini`.
   - If no API key is present, transparently displays **DETERMINISTIC SAFETY ADVISORY (NO LLM KEY CONFIGURED)** with structured root-cause assessment, tactical directives, and preventative audit steps.
5. **Acknowledgement** (`Page 5`):
   - Supervisor action portal implementing the 5-stage incident lifecycle:
     $$\text{OPEN} \longrightarrow \text{ACKNOWLEDGED} \longrightarrow \text{UNDER INVESTIGATION} \longrightarrow \text{RESOLVED} \longrightarrow \text{CLOSED}$$
   - Persistent audit log of all transitions, responder IDs, and action notes.
6. **Profile / Settings** (`Page 6`):
   - Exactly 4 primary profile slots (`slot_1` to `slot_4`).
   - Granular sensor participation toggles (Gas, Temperature, Humidity, Movement, Camera).
   - Sensor masking: Disabled sensors receive `DISABLED` state and are excluded from severity calculation.
   - Atmospheric and thermal threshold configuration saved directly to SQLite.

---

## 3. System Architecture & Data Pipeline

```
[ Worker Telemetry ]  +  [ Zone Sensor Telemetry ]  +  [ Real Laptop Camera ]
                          │
                          ▼
            [ Temporal Tracker (d/dt, Inactivity) ]
                          │
                          ▼
             [ Expected vs. Actual Comparison ]
                          │
                          ▼
            [ Sensor Participation Masking ]
            (Disabled sensors masked out)
                          │
                          ▼
       [ Multi-Source Evidence Correlation Engine ]
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
 [ Deterministic Severity ]   [ ML Early Warning ]
 (Normal/Warning/High/Crit)   (Logistic Gradient Model)
             │                         │
             └────────────┬────────────┘
                          ▼
              [ Auto-Incident Creation ]
              (Stored in hazardguard.db)
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
   [ Real-Time WebSocket ]   [ 5-Stage Lifecycle ]
  (Live Monitoring Console)  (Ack -> Investigate -> Resolve -> Close)
             │                         │
             └────────────┬────────────┘
                          ▼
           [ AI Safety Advisory Synthesis ]
       (LLM if key present, else Deterministic)
```

---

## 4. Database Schema (`data/hazardguard.db`)

HAZARDGUARD uses a persistent SQLite database with WAL mode and foreign key enforcement:

- `zones`: `id` (PK, e.g. "Zone 01"), `name`, `hazard_type`, `description`, `created_at`.
- `workers`: `id` (PK, e.g. "W-101"), `name`, `role`, `zone_id` (FK), `profile_id`, `connection_status`, `active_status`, `current_posture`, `current_movement`, `last_seen`.
- `profiles`: `id` (PK, "slot_1" to "slot_4"), `slot_number`, `name`, `assigned_zone` (FK), `status`, `enabled_sensors` (JSON), `thresholds` (JSON), `expected_events` (JSON), `alert_contacts` (JSON).
- `incidents`: `id` (PK, int), `incident_code` (e.g. "INC-1001"), `zone`, `worker_id`, `worker_name`, `severity`, `incident_type`, `status`, `evidence_json`, `mechanisms_json`, `recommended_action`, `explanation`, `sensor_snapshot` (JSON), timestamps.
- `incident_transitions`: `id` (PK), `incident_id` (FK), `from_status`, `to_status`, `performed_by`, `action_notes`, `timestamp`.
- `sensor_readings`: Time-series archive of sensor telemetry.
- `system_logs`: Audit log of system boot and initialization events.

---

## 5. Machine Learning Early Warning System

- **Training Pipeline**: [`backend/ml/train.py`](backend/ml/train.py) trains a Multinomial Logistic Risk Gradient Classifier on 3,000 synthetic industrial telemetry samples.
- **Artifact**: Saved model weights at [`backend/ml/hazard_guard_model.pkl`](backend/ml/hazard_guard_model.pkl).
- **Features Evaluated**:
  1. `gas_level`: Gas concentration percentage ($0 - 100\%$)
  2. `temperature`: Ambient temperature ($15 - 75^\circ\text{C}$)
  3. `humidity`: Relative humidity ($20 - 90\%$)
  4. `movement`: Binary worker displacement ($0$ or $1$)
  5. `gas_rate_per_min`: Rate of change $dGas/dt$ computed by temporal tracker
  6. `inactivity_duration_sec`: Elapsed seconds of worker immobility
  7. `posture_code`: Classified posture ($0 = \text{DOWN}, 1 = \text{SITTING}, 2 = \text{STANDING}$)
- **Evaluated Test Metrics**:
  - Test Accuracy: **99.33%**
  - Macro F1-Score: **98.98%**
  - Macro Precision: **98.99%**
  - Macro Recall: **98.98%**

---

## 6. How to Run HAZARDGUARD

### Prerequisites
- Python 3.11, 3.12, or 3.14
- Any modern web browser (Chrome, Edge, Firefox, Safari)

### Quick Launch (Windows)
1. Double-click `backend/run_backend.bat` to launch the API server (`http://localhost:8000`).
2. Double-click `frontend/run_frontend.bat` to launch the frontend web server (`http://localhost:5500`).

### Manual Launch
```powershell
# Terminal 1: Backend
cd hazard-monitor/backend
pip install -r requirements.txt
python main.py

# Terminal 2: Frontend
cd hazard-monitor/frontend
python -m http.server 5500
# Then open http://localhost:5500 in your browser
```

---

## 7. Future Hardware Integration (ESP32)

Physical hardware integration requires **zero changes** to the frontend or core intelligence:
1. Flash ESP32 with sensors: MQ-4/MQ-135 (Gas), DHT22 (Temp/Hum), MPU6050 (Motion/IMU).
2. Direct ESP32 HTTP POST requests to `http://localhost:8000/api/sensor` with matching JSON payload:
   ```json
   {
     "zone": "Zone 01",
     "worker_id": "W-101",
     "gas_level": 28.4,
     "temperature": 31.2,
     "humidity": 52.0,
     "movement": true,
     "posture": "STANDING"
   }
   ```
3. The existing temporal tracker, intelligence engine, deterministic severity classifier, ML early warning predictor, and incident lifecycle will process the hardware readings identically to the software simulation.
