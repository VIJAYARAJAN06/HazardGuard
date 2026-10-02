# camera/ — Computer Vision Module (Phase 2)

This directory is reserved for real camera-based person detection integration.

## Current Status
**Phase 1 (Software Demo):** Camera feed is fully simulated in the frontend (`js/app.js`).
Bounding boxes, person counts, and zone violations are drawn onto a `<canvas>` element
using mock data — no real video or model inference runs.

## Planned Phase 2 Components

### Person Detection
- **Model:** YOLOv8n (nano) — lightweight, real-time capable on edge hardware
- **Input:** RTSP stream or USB webcam via OpenCV
- **Output:** Bounding boxes + person count per frame
- **Integration point:** New WebSocket endpoint `ws://localhost:8000/ws/camera`

### Zone Violation Detection
- **Logic:** Polygon-based zone overlay; check if detected person centroid falls inside defined hazard zone
- **Input:** YOLO detections + zone polygon coordinates from profile
- **Output:** `zone_violation: bool`, `persons_in_zone: int`
- **Integration point:** `backend/services/engine.py` — add to evidence list

### PPE Compliance (Future)
- **Model:** Custom YOLOv8 fine-tuned on PPE dataset
- **Detects:** Hard hat, safety vest, gloves
- **Output:** Compliance flag per detected person

## Hardware Requirements
- USB webcam (minimum 720p) OR IP camera with RTSP support
- NVIDIA GPU recommended for real-time inference (CPU fallback available with YOLOv8n)
- ESP32-CAM module for wireless embedded camera feed (see `backend/` Phase 2 notes)

## Directory Structure (when populated)
```
camera/
├── models/          — YOLOv8 .pt / .onnx weight files
├── scripts/         — inference scripts, stream capture
├── zones/           — zone polygon definition files (.json)
└── README.md        — this file
```

## Dependencies (Phase 2)
```
ultralytics>=8.0
opencv-python>=4.8
```
