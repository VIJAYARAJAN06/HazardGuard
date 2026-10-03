# HAZARDGUARD — Intelligent Hazard-Zone Personnel Monitoring System
**Enterprise Industrial Safety Operations & Personnel Telemetry Platform**

*Safer People. Safer Workplaces.*

---

## 1. Product Overview

**HAZARDGUARD** is a professional, software-first safety monitoring web application engineered for industrial environments (confined spaces, chemical refining, furnace rooms, switchyards). It tracks worker biometrics, environmental gases, temperature, humidity, movement, and camera surveillance in real time, delivering automated hazard correlation, deterministic severity classification, ML Early Warning Risk scoring, and formal 5-stage incident lifecycle management.

---

## 2. Strict Locked Page Order

The application enforces a permanently locked 6-page navigation order:

1. **Dashboard**: High-level KPIs, 4-zone overview, incident severity distribution donut, worker status grid, telemetry sparklines, and recent incidents.
2. **Live Monitoring**: High-frequency operational console, live laptop webcam feed, truthful CV analysis state, 120s timeline player (Normal $\rightarrow$ Warning $\rightarrow$ High $\rightarrow$ Critical), Expected vs. Actual state checks, and ML early warning risk indicator.
3. **Incidents & Evidence**: Master-detail incident audit table, multi-parameter filtering, full telemetry snapshot at detection, and correlated evidence trees.
4. **AI Explanation**: Professional safety investigation report (What Happened, Why Detected, Correlated Telemetry, Recommended Actions, Precautionary Directives, and transparent mode disclosure).
5. **Acknowledgement**: Supervisor operational workspace with an enforced 5-stage lifecycle state machine (`OPEN` $\rightarrow$ `ACKNOWLEDGED` $\rightarrow$ `UNDER INVESTIGATION` $\rightarrow$ `RESOLVED` $\rightarrow$ `CLOSED`).
6. **Profile / Settings**: Exactly 4 primary profile slots, zone mappings, sensor state masking (`ACTIVE` vs. `NO SIGNAL` vs. `DISABLED`), and configurable thresholds.

---

## 3. Role-Based Authentication & Authorization

HAZARDGUARD features real server-side role-based authentication and security:

| Role | Target Users | Default Landing | Write Permissions |
| :--- | :--- | :--- | :--- |
| **MANAGEMENT / ADMIN** | Plant Manager, System Admin, Project Lead | **Dashboard** | Full system access, threshold updates, user management, system reset |
| **SAFETY OPERATIONS** | Control Room Operator, Safety Supervisor | **Live Monitoring** | Operational access, incident acknowledge, investigate, and resolve |
| **VIEWER / AUDITOR** | Compliance Auditor, Project Evaluator | **Dashboard** | Read-only across all 6 views (`403 Forbidden` on all write attempts) |

### Pre-Configured Demo Credentials
- **Admin**: `admin` / `admin123`
- **Operator**: `operator` / `operator123`
- **Auditor**: `auditor` / `auditor123`

---

## 4. Key Architectural Capabilities

- **Zero-Hardware Simulation**: Deterministic 120-second scenario engine advancing through baseline surveillance, atmospheric buildup, worker immobility, and critical emergency states.
- **Incident Deduplication & Correlation**: Prevents continuous WebSocket telemetry from spamming duplicate records; groups continuing hazards by zone and updates evidence windows.
- **End-to-End Humidity**: First-class citizen across database schema, sensor simulation, temporal rate calculation ($d/dt$), REST APIs, and Live Monitoring views.
- **Truthful Hardware & CV States**: Never fabricates bounding boxes or poses. Real browser webcam integration via `getUserMedia` displays honest operational status: `REAL CAMERA CONNECTED`, `CAMERA NOT CONNECTED`, or `CV ANALYSIS UNAVAILABLE`.
- **Database Abstraction**: SQLite WAL mode locally, PostgreSQL in cloud production via `DATABASE_URL`. Non-destructive database initialization preserves data across restarts.
- **ML Early Warning Classifier**: Multinomial Risk Classifier trained on industrial sensor profiles (`backend/ml/hazard_guard_model.pkl`) evaluating live rate of change, inactivity duration, posture, gas, temperature, and humidity.
- **AI Safety Advisory**: Supports live OpenAI/LLM synthesis when an API key is provided, or discloses **DETERMINISTIC SAFETY ADVISORY** with full audit details when no key is present.

---

## 5. Local Quickstart

### Prerequisites
- Python 3.11+
- Modern Web Browser (Chrome, Edge, Firefox)

### 1. Launch Backend API & WebSocket Server
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
API runs on `http://localhost:8000`.

### 2. Launch Frontend Console
Serve the `frontend/` directory using any static file server:
```bash
cd frontend
python -m http.server 5500
```
Open `http://localhost:5500` in your web browser.

---

## 6. Automated Testing

Run the automated test suite covering authentication, authorization, temporal tracking, severity determinism, deduplication, and lifecycle transitions:
```bash
pytest -v backend/tests
```

---

## 7. Production Deployment (Render)

HAZARDGUARD includes production deployment definitions:
- **`render.yaml`**: Web service and PostgreSQL database configuration with automatic health check at `/api/health`.
- **`.github/workflows/ci.yml`**: GitHub Actions automated CI testing on all push/PR events.
