# HAZARDGUARD — Intelligent Hazard-Zone Personnel Monitoring System
**Industrial Safety Operations & Personnel Telemetry Platform**

---

## Quick Launch (Windows)
- **Backend Server**: Double click [`backend/run_backend.bat`](backend/run_backend.bat) (Starts FastAPI on `http://localhost:8000`)
- **Frontend Console**: Double click [`frontend/run_frontend.bat`](frontend/run_frontend.bat) (Opens web console on `http://localhost:5500`)

---

## Locked Information Order & Page Workflow
1. **Dashboard**: Live system health, active personnel, 4 monitored zones, incident threat metrics.
2. **Live Monitoring**: Telemetry surveillance console, laptop webcam stream, stateful 120s scenario timeline, Expected vs. Actual state checks, live ML early warning risk score.
3. **Incidents & Evidence**: Persistent incident queue, multi-vector evidence breakdown, T-0 telemetry snapshots.
4. **AI Explanation**: Operational safety synthesis, root-cause assessment, tactical responder directives.
5. **Acknowledgement**: Supervisor 5-stage lifecycle portal: `OPEN` $\rightarrow$ `ACKNOWLEDGED` $\rightarrow$ `UNDER INVESTIGATION` $\rightarrow$ `RESOLVED` $\rightarrow$ `CLOSED`.
6. **Profile / Settings**: Exactly 4 primary profile slots, sensor participation masking (`DISABLED` sensors barred from severity evaluation), atmospheric/thermal thresholds.

---

## Technology Stack
- **Backend**: Python 3.11 - 3.14, FastAPI, Uvicorn, SQLAlchemy (SQLite in WAL mode), WebSockets.
- **Machine Learning**: Synthetic industrial sensor dataset (`data/sensor_training_data.csv`), Logistic Hazard Risk Gradient model artifact (`ml/hazard_guard_model.pkl`), Macro F1: 98.98%.
- **Computer Vision / Camera**: Browser webcam access (`navigator.mediaDevices.getUserMedia`) with truthful status indicators.
- **Frontend**: High-contrast industrial dark-mode UI, HTML5 `<video>` & SVG telemetry, Vanilla JavaScript (ES6+), zero build step.

See [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) for full authoritative architecture, database schemas, and hardware upgrade paths.
