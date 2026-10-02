# data/ — Data Storage Module (Phase 2)

This directory is reserved for persistent data storage and logging.

## Current Status
**Phase 1 (Software Demo):** All data is stored in-memory inside `backend/database/store.py`.
Data resets when the backend restarts. There is no file or database persistence.

## Planned Phase 2 Components

### Time-Series Sensor Log
- **Format:** CSV or Parquet files, one per session/day
- **Content:** Timestamped sensor readings (temperature, gas, motion, pressure, zone)
- **Purpose:** Training data for Phase 2 ML models; audit trail
- **Integration point:** `backend/database/store.py` → `add_reading()` — write to file alongside in-memory list

### Incident Archive
- **Format:** SQLite database (lightweight, no server required) OR JSON files
- **Tables/Collections:** `incidents`, `evidence`, `acknowledgements`
- **Purpose:** Persistent incident history across restarts; report generation
- **Integration point:** `backend/database/store.py` → replace in-memory list with DB queries

### Profile Persistence
- **Format:** JSON file (`data/profiles.json`)
- **Content:** Zone profiles, thresholds, personnel assignments
- **Purpose:** Survive backend restarts; multi-profile management
- **Integration point:** `backend/database/store.py` → `update_profile()` — write to file

### Export / Reporting
- **Format:** PDF or CSV incident reports
- **Tool:** `reportlab` (PDF) or built-in `csv` module
- **Trigger:** `GET /api/incidents/export`

## Directory Structure (when populated)
```
data/
├── logs/            — raw sensor reading CSVs (one per day)
├── incidents/       — incident JSON archives
├── profiles/        — saved zone profile JSON files
├── exports/         — generated PDF/CSV reports
└── README.md        — this file
```

## Dependencies (Phase 2)
```
sqlalchemy>=2.0     # ORM for SQLite/PostgreSQL
aiosqlite>=0.19     # async SQLite driver
reportlab>=4.0      # PDF report generation
```
