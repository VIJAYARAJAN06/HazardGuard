# HAZARDGUARD — Free Cloud Deployment & GitHub Setup Guide

This guide explains how to push your complete HAZARDGUARD project to **GitHub** and deploy it to a **100% Free Cloud Host** (such as **Render.com** or **Railway.app**) with zero hosting costs.

The codebase is already configured as a **unified single-service architecture**:
FastAPI serves the complete frontend UI, WebSockets, REST APIs, ML model inference, and persistent SQLite database from a single server port.

---

## Part 1: Push Project to Your GitHub Account (One-Time)

### Step 1: Create a New Repository on GitHub
1. Log into your GitHub account at [https://github.com](https://github.com).
2. Click the **`+`** icon (top right) $\rightarrow$ **New repository**.
3. Name it: `hazardguard` (or `hazard-zone-monitoring`).
4. Set visibility to **Public** or **Private** (both work with free deployment).
5. **Do NOT** check "Add a README" or ".gitignore" (these are already configured in your project).
6. Click **Create repository**.
7. Copy the repository URL (e.g., `https://github.com/YOUR_USERNAME/hazardguard.git`).

### Step 2: Push Local Code to GitHub
Open PowerShell in your project folder (`hazard-monitor`):
```powershell
cd c:\Users\vijay\Downloads\Hazard_Monitor_Phase1_Modular\hazard-monitor

# Add your GitHub repository as remote origin (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/hazardguard.git

# Set the default branch to main
git branch -M main

# Push the complete project
git push -u origin main
```
*(GitHub will prompt you to authenticate via your browser or a Personal Access Token).*

---

## Part 2: Deploy Free on Render.com (100% Free — Recommended)

Render provides free hosting for web services with automatic HTTPS and WebSocket support.

### Step 1: Sign Up / Sign In
1. Go to [https://render.com](https://render.com) and sign up / log in with your **GitHub** account.

### Step 2: Create a New Web Service
1. In the Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Select **Build and deploy from a Git repository**.
3. Select your `hazardguard` repository.
4. Fill in the deployment settings:
   - **Name**: `hazardguard` (or any name you prefer)
   - **Region**: Choose the closest region (e.g., Oregon, Frankfurt, Singapore)
   - **Branch**: `main`
   - **Root Directory**: *(leave blank)*
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r backend/requirements.txt && cd backend && python ml/train.py
     ```
   - **Start Command**:
     ```bash
     cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type**: Select **Free** ($0.00/month).

### Step 3: Click "Deploy Web Service"
Render will automatically:
1. Clone your GitHub repository.
2. Install all dependencies from `requirements.txt`.
3. Train and verify the ML risk model (`ml/train.py`).
4. Launch the FastAPI server with frontend static mounts and WebSockets.
5. Provide you with a live URL (e.g., `https://hazardguard.onrender.com`).

---

## Part 3: Deploy Free on Railway.app (Alternative Free Option)

1. Go to [https://railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** $\rightarrow$ **Deploy from GitHub repo**.
3. Select your `hazardguard` repo.
4. Railway will automatically detect the [`Procfile`](Procfile) and launch the service:
   ```bash
   cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
5. In your Railway service settings $\rightarrow$ **Networking**, click **Generate Domain**.
6. Your app is live at `https://hazardguard-production.up.railway.app`.

---

## What Works Out-of-the-Box on Free Deployment:
- **Unified Single-Port Web App**: Accessing the root URL (`https://your-app.onrender.com/`) immediately serves the complete dark-mode control room UI.
- **REST APIs**: `https://your-app.onrender.com/api/status`, `https://your-app.onrender.com/api/zones`, etc.
- **Interactive Swagger Docs**: `https://your-app.onrender.com/docs`.
- **Live WebSocket Streaming**: Dynamically switches to `wss://` on HTTPS domains for live telemetry streaming.
- **Machine Learning Early Warning**: Real ML model loaded and computing live risk gradients.
- **Deterministic Scenario Player**: 120-second progression (Normal $\rightarrow$ Warning $\rightarrow$ High $\rightarrow$ Critical).
- **Incident Lifecycle Portal**: 5-stage supervisor workflow (Open $\rightarrow$ Ack $\rightarrow$ Investigate $\rightarrow$ Resolve $\rightarrow$ Close).
- **Persistent SQLite Database**: Automatically initialized and seeded on boot.
