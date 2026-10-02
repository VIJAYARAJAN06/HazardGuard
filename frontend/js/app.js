/* ==============================================================================
   HAZARDGUARD — Master Frontend Application Logic
   Software-First Industrial Hazard-Zone Personnel Monitoring System
   
   STRICT INFORMATION ORDER (LOCKED):
   1. Dashboard            (System overview, active workers, zone health, incidents)
   2. Live Monitoring      (Primary ops, video webcam / fallback, scenario engine, telemetry, expected vs actual)
   3. Incidents & Evidence (Complete incident history, filters, audit trail, evidence breakdown)
   4. AI Explanation       (Operational safety advisory, correlated evidence analysis)
   5. Acknowledgement      (Supervisor action portal: Open -> Acknowledged -> Investigating -> Resolved -> Closed)
   6. Profile / Settings   (4 primary profile slots, worker/zone assignments, sensor thresholds)
   ============================================================================== */

const API = window.location.port === '8000' || window.location.pathname.startsWith('/api') || window.location.origin.includes('render.com') || window.location.origin.includes('railway.app') || window.location.origin.includes('onrender.com')
  ? window.location.origin
  : 'http://localhost:8000';

// STRICT LOCKED NAVIGATION ORDER
const PAGES = [
  { id: 'dashboard',   label: 'Dashboard',            icon: '📊' },
  { id: 'monitoring',  label: 'Live Monitoring',       icon: '📡' },
  { id: 'incidents',   label: 'Incidents & Evidence', icon: '📋' },
  { id: 'ai',          label: 'AI Explanation',       icon: '🤖' },
  { id: 'ack',         label: 'Acknowledgement',      icon: '🛡️' },
  { id: 'settings',    label: 'Profile / Settings',   icon: '⚙️' },
];

let currentPage = 'dashboard';
let wsConn = null;
let activeWebcamStream = null;

// Navigation builder
function buildNav() {
  document.getElementById('nav').innerHTML = PAGES.map(p => `
    <button onclick="navigate('${p.id}')" class="${p.id === currentPage ? 'active' : ''}">
      <span class="icon">${p.icon}</span>
      <span>${p.label}</span>
    </button>`).join('');
}

function navigate(id) {
  // Clean up existing live listeners if leaving monitoring
  if (wsConn && id !== 'monitoring') {
    wsConn.close();
    wsConn = null;
  }
  if (activeWebcamStream && id !== 'monitoring') {
    activeWebcamStream.getTracks().forEach(t => t.stop());
    activeWebcamStream = null;
  }

  currentPage = id;
  buildNav();
  renderPage(id);
}

function renderPage(id) {
  const el = document.getElementById('page-content');
  el.innerHTML = '';
  const routes = {
    dashboard: renderDashboard,
    monitoring: renderMonitoring,
    incidents: renderIncidents,
    ai: renderAI,
    ack: renderAcknowledgement,
    settings: renderSettings
  };
  (routes[id] || renderDashboard)(el);
}

// Global modal helpers
window.confirmReset = () => { document.getElementById('reset-modal').style.display = 'flex'; };
window.doReset = async () => {
  document.getElementById('reset-modal').style.display = 'none';
  await apiFetch('/api/reset', { method: 'POST' });
  navigate('dashboard');
};

// Formatting helpers
function badge(l) {
  const c = {
    Critical: 'badge-critical',
    High:     'badge-high',
    Warning:  'badge-warning',
    Normal:   'badge-normal'
  }[l] || 'badge-neutral';
  return `<span class="badge ${c}">${l || 'Nominal'}</span>`;
}

function sc(l) {
  return {
    Critical: 'sev-critical',
    High:     'sev-high',
    Warning:  'sev-warning',
    Normal:   'sev-normal'
  }[l] || '';
}

function col(l) {
  return {
    Critical: '#ef4444',
    High:     '#f97316',
    Warning:  '#f59e0b',
    Normal:   '#10b981'
  }[l] || '#64748b';
}

function ft(ts) {
  try { return new Date(ts).toLocaleTimeString(); } catch { return ts || ''; }
}

function fdt(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return ts || ''; }
}

async function apiFetch(path, opts) {
  try {
    const r = await fetch(API + path, opts);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// 1. DASHBOARD (Locked Position 1)
// ══════════════════════════════════════════════════════════════════════════════
async function renderDashboard(el) {
  el.innerHTML = `
    <div class="header-banner">
      <div>
        <div class="page-title">Hazard Operations Dashboard</div>
        <div class="page-sub">Real-time status overview, personnel tracking, and active incident telemetry</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary btn-sm" onclick="navigate('monitoring')">▶ Open Live Monitoring</button>
      </div>
    </div>

    <!-- Live Severity KPIs -->
    <div class="grid4" id="d-kpis">
      <div class="kpi kpi-critical"><div class="num" id="kpi-Critical" style="color:var(--sev-critical)">–</div><div class="lbl">Critical Threats</div></div>
      <div class="kpi kpi-high"><div class="num" id="kpi-High" style="color:var(--sev-high)">–</div><div class="lbl">High Hazards</div></div>
      <div class="kpi kpi-warning"><div class="num" id="kpi-Warning" style="color:var(--sev-warning)">–</div><div class="lbl">Warnings Active</div></div>
      <div class="kpi kpi-normal"><div class="num" id="kpi-Normal" style="color:var(--sev-normal)">–</div><div class="lbl">Normal Baseline</div></div>
    </div>

    <!-- Monitored Zones & Active Workers -->
    <div class="grid2" style="margin-top:18px">
      <div class="card">
        <h2>
          <span>Monitored Hazard Zones (4)</span>
          <span style="font-size:11px;color:var(--text-dim)">PERSISTENT SQLITE REPOSITORY</span>
        </h2>
        <div id="d-zones" style="display:flex;flex-direction:column;gap:8px">Loading zones…</div>
      </div>

      <div class="card">
        <h2>
          <span>Assigned Personnel</span>
          <span id="d-worker-count" style="font-size:11px;color:var(--text-dim)"></span>
        </h2>
        <div id="d-workers" style="display:flex;flex-direction:column;gap:8px">Loading personnel…</div>
      </div>
    </div>

    <!-- Recent Incidents -->
    <div class="card" style="margin-top:18px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h2>Recent Critical & Warning Events</h2>
        <button class="btn btn-outline btn-sm" onclick="navigate('incidents')">View All Incidents →</button>
      </div>
      <div id="d-recent">Loading recent incidents…</div>
    </div>
  `;

  async function loadData() {
    const [dash, workers, status] = await Promise.all([
      apiFetch('/api/dashboard'),
      apiFetch('/api/workers'),
      apiFetch('/api/status')
    ]);

    if (!dash) {
      document.getElementById('d-recent').innerHTML = `
        <div class="empty">
          <div class="ico">⚠️</div>
          <p>HAZARDGUARD Backend unreachable at <b>${API}</b>.<br>Launch FastAPI server via <code>py -3.14 main.py</code> in backend directory.</p>
        </div>`;
      return;
    }

    // Update KPIs
    const sum = dash.summary || {};
    ['Critical', 'High', 'Warning', 'Normal'].forEach(s => {
      const elNum = document.getElementById('kpi-' + s);
      if (elNum) elNum.textContent = sum[s] || 0;
    });

    // Update Zones
    const zonesEl = document.getElementById('d-zones');
    if (zonesEl) {
      zonesEl.innerHTML = (dash.zones || []).map(z => `
        <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 14px;display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-weight:700;font-size:13px">${z.name}</div>
            <div style="font-size:11px;color:var(--text-dim)">Hazard: ${z.hazard_type} · Profile: ${z.active_profile}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:12px;color:var(--text-muted)">👥 ${z.personnel} Assigned</span>
            ${badge(z.status)}
          </div>
        </div>`).join('');
    }

    // Update Workers
    const workersEl = document.getElementById('d-workers');
    const workerCountEl = document.getElementById('d-worker-count');
    if (workersEl && workers?.workers) {
      workerCountEl.textContent = `${workers.workers.length} Personnel Registered`;
      workersEl.innerHTML = workers.workers.map(w => `
        <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:9px 12px;display:flex;align-items:center;justify-content:space-between">
          <div>
            <span style="font-weight:700;font-size:12px;color:#60a5fa">${w.id}</span>
            <span style="font-weight:600;font-size:13px;margin-left:6px">${w.name}</span>
            <div style="font-size:11px;color:var(--text-dim)">${w.role} · ${w.zone_id || 'Unassigned'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:10px;padding:2px 8px;border-radius:4px;background:${w.connection_status === 'ONLINE' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'};color:${w.connection_status === 'ONLINE' ? '#34d399' : '#f87171'}">${w.connection_status}</span>
            <span style="font-size:11px;color:var(--text-muted)">${w.current_posture}</span>
          </div>
        </div>`).join('');
    }

    // Update Recent Incidents
    const recEl = document.getElementById('d-recent');
    const recent = dash.recent_incidents || [];
    if (recEl) {
      if (recent.length === 0) {
        recEl.innerHTML = `
          <div class="empty" style="padding:24px">
            <div class="ico">🛡️</div>
            <p>No active incidents recorded. System in nominal state.<br>Navigate to <b>Live Monitoring</b> to run controlled scenarios.</p>
          </div>`;
      } else {
        recEl.innerHTML = recent.slice(0, 5).map(inc => `
          <div class="card ${sc(inc.severity)}" style="padding:12px 16px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:12px">
              ${badge(inc.severity)}
              <span style="font-weight:700;font-size:13px">${inc.incident_code || '#' + inc.id}</span>
              <span style="font-weight:600;font-size:13px">${inc.incident_type}</span>
              <span style="color:var(--text-dim);font-size:12px">${inc.zone} · Worker: ${inc.worker_name || 'N/A'}</span>
              <span style="margin-left:auto;font-size:11px;color:var(--text-dim)">${fdt(inc.created_at || inc.timestamp)}</span>
              <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(255,255,255,0.08)">${inc.status}</span>
            </div>
          </div>`).join('');
      }
    }
  }

  loadData();
  const poll = setInterval(() => {
    if (currentPage === 'dashboard') loadData();
    else clearInterval(poll);
  }, 4000);
}


// ══════════════════════════════════════════════════════════════════════════════
// 2. LIVE MONITORING (Locked Position 2)
// ══════════════════════════════════════════════════════════════════════════════
function renderMonitoring(el) {
  let selectedZone = 'Zone 01';
  let isWebcamActive = false;

  el.innerHTML = `
    <div class="header-banner">
      <div>
        <div class="page-title">Live Operational Monitoring</div>
        <div class="page-sub">Telemetry surveillance, real webcam integration, expected-state verification, and scenario simulation</div>
      </div>
      <!-- Scenario Timeline Controls -->
      <div style="display:flex;align-items:center;gap:10px;background:var(--bg-surface);padding:8px 14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
        <span style="font-size:11px;font-weight:700;color:var(--text-dim)">TIMELINE:</span>
        <span id="sc-timer" style="font-family:monospace;font-size:14px;font-weight:700;color:#60a5fa">00:00</span>
        <button class="btn btn-outline btn-sm" onclick="controlScenario('restart')" title="Restart Timeline">⏮ Restart</button>
        <button id="sc-pause-btn" class="btn btn-outline btn-sm" onclick="controlScenario('toggle-pause')">⏸ Pause</button>
        <div style="border-left:1px solid var(--border-subtle);height:20px;margin:0 4px"></div>
        <span style="font-size:11px;font-weight:700;color:var(--text-dim)">PRESETS:</span>
        <button class="btn btn-sm btn-primary" onclick="loadScenarioPreset('timeline')" style="margin-left:4px">
          ▶ 120s TIMELINE
        </button>
        ${['normal', 'warning', 'high', 'critical'].map(s => `
          <button class="btn btn-sm btn-outline" onclick="loadScenarioPreset('${s}')" style="border-color:${col(s.charAt(0).toUpperCase() + s.slice(1))};color:${col(s.charAt(0).toUpperCase() + s.slice(1))}">
            ${s.toUpperCase()}
          </button>`).join('')}
      </div>
    </div>

    <!-- Active Stage Banner -->
    <div id="stage-banner" style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 16px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="pulse-dot"></span>
        <span style="font-size:12px;font-weight:700;color:var(--text-dim)">CURRENT SIMULATION STAGE:</span>
        <span id="sc-stage" style="font-size:13px;font-weight:700;color:#fff">NORMAL: Routine Baseline Surveillance</span>
      </div>
      <div id="ml-badge-container">
        <span class="badge badge-normal">ML RISK: 4.2% (STABLE BASELINE)</span>
      </div>
    </div>

    <!-- Operational View (2 Columns) -->
    <div class="grid2">
      <!-- LEFT COLUMN: Sensors & Expected State -->
      <div>
        <!-- Target Selection -->
        <div class="card">
          <h2>Surveillance Target & Profile</h2>
          <div class="grid2">
            <div>
              <label class="fl">Monitored Zone</label>
              <select id="mon-zone-select" onchange="onZoneChange(this.value)">
                ${['Zone 01', 'Zone 02', 'Zone 03', 'Zone 04'].map(z => `<option value="${z}">${z}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="fl">Assigned Personnel</label>
              <div id="mon-worker-tag" style="padding:8px 12px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);font-size:13px;font-weight:600">
                Arun Kumar (W-101)
              </div>
            </div>
          </div>
        </div>

        <!-- Live Telemetry Readouts -->
        <div class="card">
          <h2>Live Sensor Telemetry</h2>
          <div class="grid3" style="margin-bottom:12px">
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--text-dim);font-weight:700">GAS SENSOR (MQ)</div>
              <div id="tel-gas" style="font-size:22px;font-weight:800;color:var(--text-main);margin:4px 0">8.0%</div>
              <div id="tel-gas-trend" style="font-size:10px;color:#34d399">STEADY (ACTIVE)</div>
            </div>
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--text-dim);font-weight:700">TEMPERATURE</div>
              <div id="tel-temp" style="font-size:22px;font-weight:800;color:var(--text-main);margin:4px 0">24.5°C</div>
              <div id="tel-temp-status" style="font-size:10px;color:#34d399">NORMAL (ACTIVE)</div>
            </div>
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--text-dim);font-weight:700">HUMIDITY</div>
              <div id="tel-hum" style="font-size:22px;font-weight:800;color:var(--text-main);margin:4px 0">48.0%</div>
              <div style="font-size:10px;color:var(--text-dim)">ACTIVE</div>
            </div>
          </div>

          <!-- Movement & Posture -->
          <div class="grid2">
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px;display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:10px;color:var(--text-dim);font-weight:700">WORKER DISPLACEMENT</div>
                <div id="tel-move" style="font-size:14px;font-weight:700;color:#34d399">ACTIVE MOVEMENT</div>
              </div>
              <div id="tel-inactivity" style="font-size:11px;color:var(--text-dim)">Inactivity: 0s</div>
            </div>
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px;display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:10px;color:var(--text-dim);font-weight:700">CLASSIFIED POSTURE</div>
                <div id="tel-posture" style="font-size:14px;font-weight:700;color:#60a5fa">STANDING</div>
              </div>
              <div style="font-size:11px;color:var(--text-dim)">Vision / IMU</div>
            </div>
          </div>
        </div>

        <!-- Expected vs Actual State Comparison -->
        <div class="card">
          <h2>Expected vs Actual State Verification</h2>
          <div style="margin-bottom:10px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px">EXPECTED BASELINE:</div>
            <div id="m-expected" style="font-size:12px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:8px 12px;color:#cbd5e1">
              Continuous movement; Atmospheric gas < 30%; Temp < 35°C
            </div>
          </div>
          <div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px">OBSERVED ACTUAL:</div>
            <div id="m-actual" style="font-size:12px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:8px 12px;color:#cbd5e1">
              Personnel: Present (STANDING); Movement: Active; Gas: 8.0%
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Real Laptop Camera & Threat Assessment -->
      <div>
        <!-- Camera Panel (Real getUserMedia + Honest Status) -->
        <div class="card" style="padding:0;overflow:hidden">
          <div style="background:#0f172a;padding:10px 16px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:12px;font-weight:700;color:#cbd5e1">📷 WEBCAM SURVEILLANCE FEED</span>
            <div id="cam-status-badge">
              <span class="badge badge-neutral">INITIALIZING FEED</span>
            </div>
          </div>

          <div style="position:relative;background:#000;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;overflow:hidden">
            <video id="webcam-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;display:none"></video>
            <div id="cam-fallback" style="text-align:center;padding:20px">
              <div style="font-size:42px;margin-bottom:10px">📷</div>
              <div style="font-size:13px;font-weight:700;color:#cbd5e1">Real Camera Stream</div>
              <p style="font-size:11px;color:var(--text-dim);margin-top:4px">
                Click below to connect your real laptop webcam via browser permissions.
              </p>
              <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="connectWebcam()">Connect Laptop Webcam</button>
            </div>
          </div>

          <div style="background:#0f172a;padding:8px 14px;border-top:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;font-size:11px">
            <span style="color:var(--text-dim)">CV INFERENCE ENGINE:</span>
            <span id="cv-label" style="font-weight:700;color:#60a5fa">SIMULATION TESTBENCH (NO RANDOM FAKE BOUNDING BOXES)</span>
          </div>
        </div>

        <!-- Intelligence Threat Card -->
        <div id="threat-card" class="card sev-normal">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <span id="sev-badge">${badge('Normal')}</span>
              <span id="threat-title" style="font-weight:800;font-size:15px">Normal Safe Operations</span>
            </div>
            <span id="threat-zone" style="font-size:12px;color:var(--text-dim)">Zone 01</span>
          </div>

          <div id="ev-container" style="margin-bottom:12px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:6px">Empirical Evidence Points</div>
            <div id="ev-list" style="font-size:12px;color:#34d399">✓ All active sensors operate within baseline tolerances.</div>
          </div>

          <div id="mech-container" style="margin-bottom:12px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:6px">Triggered Mechanisms</div>
            <div id="mech-list" style="font-size:12px;color:var(--text-dim)">None</div>
          </div>

          <div style="background:rgba(0,0,0,0.25);border-radius:var(--radius-sm);padding:10px 14px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px">Tactical Responder Directive</div>
            <div id="tactical-directive" style="font-size:13px;font-weight:600">All atmospheric, thermal, and personnel activity indicators are within safe operating limits.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Connect WebSocket to backend stream
  connectLiveWebSocket();
}

function connectLiveWebSocket() {
  if (wsConn) return;
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = (window.location.port === '8000' || window.location.origin.includes('render.com') || window.location.origin.includes('railway.app') || window.location.origin.includes('onrender.com'))
    ? window.location.host
    : 'localhost:8000';
  wsConn = new WebSocket(`${wsProto}//${wsHost}/ws/live`);

  wsConn.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      updateMonitoringUI(data);
    } catch (e) {
      console.error('Error parsing WS message:', e);
    }
  };

  wsConn.onclose = () => {
    console.log('WS disconnected. Reconnecting in 3s...');
    setTimeout(() => {
      if (currentPage === 'monitoring') connectLiveWebSocket();
    }, 3000);
  };
}

function updateMonitoringUI(data) {
  const r = data.reading || {};
  const a = data.assessment || {};
  const m = data.scenario_metadata || {};
  const w = data.worker || {};

  // 1. Timer & Stage
  const timerEl = document.getElementById('sc-timer');
  if (timerEl && m.time_display) timerEl.textContent = m.time_display;

  const stageEl = document.getElementById('sc-stage');
  if (stageEl && m.stage) stageEl.textContent = m.stage;

  // 2. Telemetry
  const telGas = document.getElementById('tel-gas');
  if (telGas) telGas.textContent = `${r.gas_level}%`;

  const telGasTrend = document.getElementById('tel-gas-trend');
  if (telGasTrend && a.temporal) {
    telGasTrend.textContent = `${a.temporal.gas_trend} (${a.sensor_status?.gas || 'ACTIVE'})`;
    telGasTrend.style.color = a.temporal.gas_trend === 'RAPID_SURGE' ? '#ef4444' : a.temporal.gas_trend === 'RISING' ? '#f59e0b' : '#34d399';
  }

  const telTemp = document.getElementById('tel-temp');
  if (telTemp) telTemp.textContent = `${r.temperature}°C`;

  const telMove = document.getElementById('tel-move');
  if (telMove) {
    telMove.textContent = r.movement ? 'ACTIVE MOVEMENT' : 'NO MOVEMENT DETECTED';
    telMove.style.color = r.movement ? '#34d399' : '#ef4444';
  }

  const telInact = document.getElementById('tel-inactivity');
  if (telInact && a.temporal) {
    telInact.textContent = `Inactivity: ${a.temporal.inactivity_duration_sec}s`;
  }

  const telPosture = document.getElementById('tel-posture');
  if (telPosture) telPosture.textContent = r.posture || 'STANDING';

  // 3. Expected vs Actual
  const expEl = document.getElementById('m-expected');
  if (expEl && a.expected_state) expEl.textContent = a.expected_state;

  const actEl = document.getElementById('m-actual');
  if (actEl && a.actual_state) actEl.textContent = a.actual_state;

  // 4. ML Early Warning Risk Badge
  const mlContainer = document.getElementById('ml-badge-container');
  if (mlContainer && a.ml_risk) {
    const risk = a.ml_risk.risk_percentage;
    const badgeClass = risk >= 70 ? 'badge-critical' : risk >= 40 ? 'badge-warning' : 'badge-normal';
    mlContainer.innerHTML = `<span class="badge ${badgeClass}">ML RISK: ${risk}% (${a.ml_risk.trend})</span>`;
  }

  // 5. Threat Assessment Card
  const tc = document.getElementById('threat-card');
  if (tc) {
    tc.className = `card ${sc(a.severity)}`;
    document.getElementById('sev-badge').innerHTML = badge(a.severity);
    document.getElementById('threat-title').textContent = a.incident_type || 'Operations';
    document.getElementById('threat-zone').textContent = r.zone || 'Zone 01';

    // Evidence
    const evList = document.getElementById('ev-list');
    if (evList) {
      if (a.evidence && a.evidence.length > 0) {
        evList.innerHTML = a.evidence.map(e => `<div style="color:#f87171;margin-bottom:3px">⚠️ ${e}</div>`).join('');
      } else {
        evList.innerHTML = '<span style="color:#34d399">✓ All active sensors operate within baseline tolerances.</span>';
      }
    }

    // Mechanisms
    const mechList = document.getElementById('mech-list');
    if (mechList) {
      if (a.mechanisms && a.mechanisms.length > 0) {
        mechList.innerHTML = a.mechanisms.map(m => `<div style="color:#fbbf24;margin-bottom:3px">⚡ ${m}</div>`).join('');
      } else {
        mechList.innerHTML = '<span style="color:var(--text-dim)">None</span>';
      }
    }

    // Tactical Directive
    const td = document.getElementById('tactical-directive');
    if (td && a.recommended_action) td.textContent = a.recommended_action;
  }
}

// Laptop Webcam Access via getUserMedia
window.connectWebcam = async () => {
  const video = document.getElementById('webcam-video');
  const fallback = document.getElementById('cam-fallback');
  const badgeEl = document.getElementById('cam-status-badge');

  try {
    activeWebcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = activeWebcamStream;
    video.style.display = 'block';
    fallback.style.display = 'none';
    badgeEl.innerHTML = '<span class="badge badge-normal">REAL WEBCAM CONNECTED</span>';
    document.getElementById('cv-label').textContent = 'WEBCAM ACTIVE · CV ANALYSIS: NOT AVAILABLE (PHASE 2)';
  } catch (err) {
    badgeEl.innerHTML = '<span class="badge badge-warning">WEBCAM PERMISSION DENIED</span>';
    alert('Webcam access was denied or unavailable. Running in honest testbench mode.');
  }
};

window.controlScenario = async (action) => {
  let act = action;
  if (action === 'toggle-pause') {
    const btn = document.getElementById('sc-pause-btn');
    if (btn.textContent.includes('Pause')) {
      act = 'pause';
      btn.textContent = '▶ Resume';
    } else {
      act = 'resume';
      btn.textContent = '⏸ Pause';
    }
  }
  await apiFetch('/api/scenario/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: act })
  });
};

window.loadScenarioPreset = async (name) => {
  const zone = document.getElementById('mon-zone-select')?.value || 'Zone 01';
  await apiFetch(`/api/simulate?scenario=${name}&zone=${zone}`);
};

window.onZoneChange = async (zone) => {
  const dash = await apiFetch('/api/dashboard');
  const zData = (dash?.zones || []).find(z => z.id === zone);
  const tagEl = document.getElementById('mon-worker-tag');
  if (tagEl && zData) {
    if (zData.workers && zData.workers.length > 0) {
      tagEl.textContent = `${zData.workers[0].name} (${zData.workers[0].id})`;
    } else {
      tagEl.textContent = 'Unassigned Personnel';
    }
  }
  window.loadScenarioPreset('normal');
};


// ══════════════════════════════════════════════════════════════════════════════
// 3. INCIDENTS & EVIDENCE (Locked Position 3)
// ══════════════════════════════════════════════════════════════════════════════
async function renderIncidents(el) {
  let incidents = [];
  let selected = null;
  let activeFilter = 'All';

  el.innerHTML = `
    <div class="header-banner">
      <div>
        <div class="page-title">Incidents & Evidence Repository</div>
        <div class="page-sub">Persistent incident event registry, multi-vector evidence logs, and sensor snapshots</div>
      </div>
      <div style="display:flex;gap:6px">
        ${['All', 'Critical', 'High', 'Warning', 'Normal'].map(f => `
          <button class="btn btn-outline btn-sm filter-pill ${f === 'All' ? 'btn-primary' : ''}" onclick="setIncidentFilter('${f}', this)">
            ${f}
          </button>`).join('')}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:360px 1fr;gap:18px">
      <!-- Incident List -->
      <div class="card" style="padding:12px;height:calc(100vh - 180px);display:flex;flex-direction:column">
        <h2 style="margin-bottom:10px">
          <span>Incident Queue</span>
          <span id="inc-count" style="font-size:11px;color:var(--text-dim)"></span>
        </h2>
        <div id="inc-list" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px">Loading incidents…</div>
      </div>

      <!-- Incident Detail -->
      <div id="inc-detail" class="card" style="height:calc(100vh - 180px);overflow-y:auto">
        <div class="empty">
          <div class="ico">📋</div>
          <p>Select an incident from the queue to view full audit logs, empirical evidence, and snapshots.</p>
        </div>
      </div>
    </div>
  `;

  window.setIncidentFilter = (f, btn) => {
    activeFilter = f;
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('btn-primary'));
    btn.classList.add('btn-primary');
    renderList();
  };

  window.selectIncident = (id) => {
    selected = incidents.find(i => i.id === id);
    renderDetail();
  };

  async function load() {
    const res = await apiFetch('/api/incidents');
    incidents = res?.incidents || [];
    renderList();
    if (incidents.length > 0 && !selected) {
      selectIncident(incidents[0].id);
    }
  }

  function renderList() {
    const listEl = document.getElementById('inc-list');
    const filtered = activeFilter === 'All' ? incidents : incidents.filter(i => i.severity === activeFilter);
    document.getElementById('inc-count').textContent = `${filtered.length} Recorded`;

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty" style="padding:20px"><p>No incidents match filter.</p></div>';
      return;
    }

    listEl.innerHTML = filtered.map(inc => `
      <div onclick="selectIncident(${inc.id})" style="background:var(--bg-surface);border:1px solid ${selected?.id === inc.id ? 'var(--border-active)' : 'var(--border-subtle)'};border-radius:var(--radius-sm);padding:10px 12px;cursor:pointer;transition:border-color 0.15s">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-weight:700;font-size:12px;color:#60a5fa">${inc.incident_code || '#' + inc.id}</span>
          ${badge(inc.severity)}
        </div>
        <div style="font-weight:600;font-size:13px;margin-bottom:2px">${inc.incident_type}</div>
        <div style="font-size:11px;color:var(--text-dim);display:flex;justify-content:space-between">
          <span>${inc.zone}</span>
          <span>${ft(inc.created_at || inc.timestamp)}</span>
        </div>
      </div>`).join('');
  }

  function renderDetail() {
    const dtEl = document.getElementById('inc-detail');
    if (!selected) return;
    const inc = selected;
    const snap = inc.sensor_snapshot || {};

    dtEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle)">
        <div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:18px;font-weight:800;color:#fff">${inc.incident_code}</span>
            ${badge(inc.severity)}
            <span class="badge badge-neutral">${inc.status}</span>
          </div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:4px">
            Zone: ${inc.zone} · Worker: ${inc.worker_name || 'N/A'} (${inc.worker_id || 'N/A'}) · Detected: ${fdt(inc.created_at)}
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="navigate('ack')">🛡️ Manage in Acknowledgement</button>
          <button class="btn btn-outline btn-sm" onclick="navigate('ai')">🤖 View AI Advisory</button>
        </div>
      </div>

      <!-- Evidence Breakdown -->
      <div style="margin-bottom:18px">
        <h2 style="font-size:12px">Empirical Evidence Points</h2>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${(inc.evidence || []).map(e => `
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:8px 12px;font-size:12px;color:#f87171">
              ⚠️ ${e}
            </div>`).join('')}
        </div>
      </div>

      <!-- Triggered Mechanisms -->
      <div style="margin-bottom:18px">
        <h2 style="font-size:12px">Failure & Hazard Mechanisms Triggered</h2>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${(inc.mechanisms || []).map(m => `
            <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:8px 12px;font-size:12px;color:#fbbf24">
              ⚡ ${m}
            </div>`).join('')}
        </div>
      </div>

      <!-- Sensor Snapshot at Incident Time -->
      <div style="margin-bottom:18px">
        <h2 style="font-size:12px">Telemetry Snapshot at T-0</h2>
        <div class="grid4">
          <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px;text-align:center">
            <div style="font-size:10px;color:var(--text-dim)">GAS LEVEL</div>
            <div style="font-size:16px;font-weight:700">${snap.gas_level !== undefined ? snap.gas_level + '%' : '—'}</div>
          </div>
          <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px;text-align:center">
            <div style="font-size:10px;color:var(--text-dim)">TEMPERATURE</div>
            <div style="font-size:16px;font-weight:700">${snap.temperature !== undefined ? snap.temperature + '°C' : '—'}</div>
          </div>
          <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px;text-align:center">
            <div style="font-size:10px;color:var(--text-dim)">MOVEMENT</div>
            <div style="font-size:16px;font-weight:700">${snap.movement ? 'ACTIVE' : 'ABSENT'}</div>
          </div>
          <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px;text-align:center">
            <div style="font-size:10px;color:var(--text-dim)">POSTURE</div>
            <div style="font-size:16px;font-weight:700">${snap.posture || 'STANDING'}</div>
          </div>
        </div>
      </div>

      <!-- Tactical Directive -->
      <div style="background:rgba(37,99,235,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:var(--radius-sm);padding:12px 16px">
        <div style="font-size:11px;font-weight:700;color:#93c5fd;margin-bottom:4px">OPERATIONAL DIRECTIVE</div>
        <div style="font-size:13px;line-height:1.5">${inc.recommended_action}</div>
      </div>
    `;
  }

  load();
}


// ══════════════════════════════════════════════════════════════════════════════
// 4. AI EXPLANATION (Locked Position 4)
// ══════════════════════════════════════════════════════════════════════════════
async function renderAI(el) {
  let incidents = [];
  let selected = null;

  el.innerHTML = `
    <div class="header-banner">
      <div>
        <div class="page-title">AI Safety Advisory & Synthesis</div>
        <div class="page-sub">Evidence-based operational narrative synthesis and root-cause advisory</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:320px 1fr;gap:18px">
      <!-- Incidents list -->
      <div class="card" style="padding:12px;height:calc(100vh - 180px);display:flex;flex-direction:column">
        <h2>Select Event to Synthesize</h2>
        <div id="ai-inc-list" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px">Loading…</div>
      </div>

      <!-- AI Synthesis Output -->
      <div id="ai-synthesis" class="card" style="height:calc(100vh - 180px);overflow-y:auto">
        <div class="empty">
          <div class="ico">🤖</div>
          <p>Select an incident to generate an operational intelligence advisory.</p>
        </div>
      </div>
    </div>
  `;

  window.selectAiIncident = async (id) => {
    selected = incidents.find(i => i.id === id);
    const synthEl = document.getElementById('ai-synthesis');
    synthEl.innerHTML = '<div class="empty"><div class="ico">⏳</div><p>Generating operational safety synthesis…</p></div>';

    const adv = await apiFetch(`/api/incidents/${id}/ai-explain`);
    if (!adv) {
      synthEl.innerHTML = '<div class="empty"><p>Advisory generation failed.</p></div>';
      return;
    }

    synthEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle)">
        <div>
          <div style="font-weight:800;font-size:16px">${selected.incident_code}: ${selected.incident_type}</div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:2px">Zone: ${selected.zone} · Worker: ${selected.worker_name}</div>
        </div>
        <span class="badge ${adv.mode === 'GENAI_CONNECTED' ? 'badge-normal' : 'badge-warning'}">
          ${adv.mode === 'GENAI_CONNECTED' ? 'OPENAI GPT-4o' : 'DETERMINISTIC ADVISORY ENGINE'}
        </span>
      </div>

      <!-- Architecture Pipeline Breadcrumbs -->
      <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;font-size:11px">
        <div style="font-weight:700;color:var(--text-dim);margin-bottom:6px">PROCESSING PIPELINE:</div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${['Sensor Intake', '→', 'Temporal d/dt', '→', 'Expected vs Actual', '→', 'Evidence Correlation', '→', 'Severity Scoring', '→', 'Advisory Synthesis'].map(s => s === '→' ? `<span style="color:var(--text-dim)">→</span>` : `<span style="background:rgba(37,99,235,0.2);color:#93c5fd;padding:2px 8px;border-radius:4px;font-weight:600">${s}</span>`).join('')}
        </div>
      </div>

      <!-- Structured Q&A Advisory -->
      <div style="display:flex;flex-direction:column;gap:12px">
        ${(adv.structured_qa || []).map(item => `
          <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:12px 16px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#60a5fa;margin-bottom:4px">${item.q}</div>
            <div style="font-size:13px;line-height:1.6;color:var(--text-main)">${item.a}</div>
          </div>`).join('')}
      </div>
    `;
  };

  async function load() {
    const res = await apiFetch('/api/incidents');
    incidents = res?.incidents || [];
    const listEl = document.getElementById('ai-inc-list');
    if (incidents.length === 0) {
      listEl.innerHTML = '<div class="empty" style="padding:20px"><p>No incidents found.</p></div>';
      return;
    }
    listEl.innerHTML = incidents.map(inc => `
      <div onclick="selectAiIncident(${inc.id})" style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px;cursor:pointer">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="font-weight:700;font-size:12px;color:#60a5fa">${inc.incident_code}</span>
          ${badge(inc.severity)}
        </div>
        <div style="font-weight:600;font-size:12px">${inc.incident_type}</div>
        <div style="font-size:11px;color:var(--text-dim)">${inc.zone} · ${ft(inc.created_at)}</div>
      </div>`).join('');

    if (incidents.length > 0) selectAiIncident(incidents[0].id);
  }

  load();
}


// ══════════════════════════════════════════════════════════════════════════════
// 5. ACKNOWLEDGEMENT (Locked Position 5)
// ══════════════════════════════════════════════════════════════════════════════
async function renderAcknowledgement(el) {
  el.innerHTML = `
    <div class="header-banner">
      <div>
        <div class="page-title">Supervisor Incident Acknowledgement & Lifecycle</div>
        <div class="page-sub">5-Stage Response Workflow: OPEN → ACKNOWLEDGED → UNDER INVESTIGATION → RESOLVED → CLOSED</div>
      </div>
    </div>

    <!-- Workflow Progress Bar -->
    <div class="card" style="margin-bottom:18px">
      <h2>Standard Operational Response Lifecycle</h2>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;flex-wrap:wrap">
        ${['1. OPEN (Detected)', '→', '2. ACKNOWLEDGED', '→', '3. UNDER INVESTIGATION', '→', '4. RESOLVED', '→', '5. CLOSED (Audited)'].map(s => s === '→' ? `<span style="color:var(--text-dim)">→</span>` : `<span style="background:var(--bg-surface);border:1px solid var(--border-subtle);padding:6px 14px;border-radius:var(--radius-sm);font-weight:700">${s}</span>`).join('')}
      </div>
    </div>

    <div class="grid2">
      <!-- Active Incidents Awaiting Action -->
      <div class="card">
        <h2>Action Queue (Open & Acknowledged)</h2>
        <div id="ack-queue" style="display:flex;flex-direction:column;gap:12px">Loading queue…</div>
      </div>

      <!-- Action Log / Audit History -->
      <div class="card">
        <h2>Resolution Audit History</h2>
        <div id="ack-history" style="display:flex;flex-direction:column;gap:12px">Loading history…</div>
      </div>
    </div>
  `;

  window.transitionIncidentAction = async (id, newStatus) => {
    const responder = document.getElementById(`resp-${id}`)?.value?.trim() || 'Control Room Supervisor';
    const notes = document.getElementById(`notes-${id}`)?.value?.trim() || `Status advanced to ${newStatus}`;

    await apiFetch('/api/incidents/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incident_id: id,
        new_status: newStatus,
        performed_by: responder,
        action_notes: notes
      })
    });

    loadQueue();
  };

  async function loadQueue() {
    const res = await apiFetch('/api/incidents');
    const all = res?.incidents || [];
    const pending = all.filter(i => ['OPEN', 'ACKNOWLEDGED', 'UNDER INVESTIGATION', 'RESOLVED'].includes(i.status));
    const resolved = all.filter(i => ['CLOSED'].includes(i.status));

    const queueEl = document.getElementById('ack-queue');
    if (pending.length === 0) {
      queueEl.innerHTML = '<div class="empty" style="padding:24px"><div class="ico">🛡️</div><p>Action queue empty. All incidents addressed.</p></div>';
    } else {
      queueEl.innerHTML = pending.map(inc => `
        <div class="card ${sc(inc.severity)}" style="padding:14px;margin-bottom:0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span style="font-weight:800;font-size:14px">${inc.incident_code} · ${inc.zone}</span>
            <div style="display:flex;gap:6px">
              ${badge(inc.severity)}
              <span class="badge badge-neutral">${inc.status}</span>
            </div>
          </div>
          <div style="font-size:13px;font-weight:600;margin-bottom:6px">${inc.incident_type}</div>
          <div style="font-size:12px;color:var(--text-dim);margin-bottom:12px">${(inc.evidence || []).join('; ')}</div>

          <div class="grid2" style="margin-bottom:10px">
            <div>
              <label class="fl">Responder ID / Name</label>
              <input type="text" id="resp-${inc.id}" value="${inc.acknowledged_by || 'Lead Supervisor'}" />
            </div>
            <div>
              <label class="fl">Mitigation Action Notes</label>
              <input type="text" id="notes-${inc.id}" placeholder="e.g. Ventilated corridor, confirmed worker exit" />
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${inc.status === 'OPEN' ? `
              <button class="btn btn-warning btn-sm" onclick="transitionIncidentAction(${inc.id}, 'ACKNOWLEDGED')">
                ✓ Acknowledge Alert
              </button>` : ''}
            ${inc.status === 'ACKNOWLEDGED' ? `
              <button class="btn btn-primary btn-sm" onclick="transitionIncidentAction(${inc.id}, 'UNDER INVESTIGATION')">
                🔍 Dispatch Investigation
              </button>` : ''}
            ${['ACKNOWLEDGED', 'UNDER INVESTIGATION'].includes(inc.status) ? `
              <button class="btn btn-success btn-sm" onclick="transitionIncidentAction(${inc.id}, 'RESOLVED')">
                ✅ Mark Resolved
              </button>` : ''}
            ${inc.status === 'RESOLVED' ? `
              <button class="btn btn-outline btn-sm" onclick="transitionIncidentAction(${inc.id}, 'CLOSED')">
                🔒 Archive & Close
              </button>` : ''}
          </div>
        </div>`).join('');
    }

    const histEl = document.getElementById('ack-history');
    if (resolved.length === 0) {
      histEl.innerHTML = '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:24px">No closed incidents in audit log.</div>';
    } else {
      histEl.innerHTML = resolved.map(inc => `
        <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <span style="font-weight:700;font-size:13px">${inc.incident_code}</span>
            <span class="badge badge-normal">${inc.status}</span>
          </div>
          <div style="font-size:12px;color:var(--text-dim)">Resolved by: ${inc.resolved_by || 'Supervisor'} · ${fdt(inc.resolved_at)}</div>
          <div style="font-size:12px;margin-top:4px;color:var(--text-muted)">Notes: ${inc.resolution_notes || 'Resolved according to protocol'}</div>
        </div>`).join('');
    }
  }

  loadQueue();
}


// ══════════════════════════════════════════════════════════════════════════════
// 6. PROFILE / SETTINGS (Locked Position 6)
// ══════════════════════════════════════════════════════════════════════════════
async function renderSettings(el) {
  let profiles = [];
  let selectedSlot = 'slot_1';

  el.innerHTML = `
    <div class="header-banner">
      <div>
        <div class="page-title">Profile Slots & System Configuration</div>
        <div class="page-sub">Configure the 4 primary profile slots, sensor participation masks, and threshold parameters</div>
      </div>
    </div>

    <!-- Exactly 4 Primary Profile Slots -->
    <div class="grid4" id="slot-pills" style="margin-bottom:18px"></div>

    <div class="grid2">
      <!-- Profile Slot Details -->
      <div class="card" id="slot-editor">
        <h2>Slot Parameters</h2>
        <div id="slot-form">Loading profile details…</div>
      </div>

      <!-- Sensor Configuration & Masking -->
      <div class="card">
        <h2>Sensor Enable / Disable Configuration</h2>
        <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px">
          Disabled sensors receive status <b>DISABLED</b> and are strictly masked from participation in deterministic severity calculations.
        </p>
        <div id="sensor-toggles" style="display:flex;flex-direction:column;gap:10px">Loading toggles…</div>
        <button class="btn btn-primary" style="width:100%;margin-top:18px" onclick="saveActiveSlot()">
          💾 Save Profile Configuration to SQLite
        </button>
      </div>
    </div>
  `;

  window.selectProfileSlot = (slotId) => {
    selectedSlot = slotId;
    renderSlotPills();
    renderSlotEditor();
  };

  async function loadProfiles() {
    const res = await apiFetch('/api/profiles');
    profiles = res?.profiles || [];
    renderSlotPills();
    renderSlotEditor();
  }

  function renderSlotPills() {
    const container = document.getElementById('slot-pills');
    container.innerHTML = profiles.map(p => `
      <div onclick="selectProfileSlot('${p.id}')" style="background:${p.id === selectedSlot ? 'rgba(37,99,235,0.2)' : 'var(--bg-card)'};border:1px solid ${p.id === selectedSlot ? 'var(--border-active)' : 'var(--border-subtle)'};border-radius:var(--radius-sm);padding:12px;cursor:pointer;text-align:center">
        <div style="font-size:10px;font-weight:700;color:#60a5fa;text-transform:uppercase">SLOT 0${p.slot_number}</div>
        <div style="font-weight:700;font-size:13px;margin:4px 0">${p.name}</div>
        <span class="badge ${p.status === 'ACTIVE' ? 'badge-normal' : 'badge-neutral'}">${p.status}</span>
      </div>`).join('');
  }

  function renderSlotEditor() {
    const p = profiles.find(x => x.id === selectedSlot) || profiles[0];
    if (!p) return;
    const formEl = document.getElementById('slot-form');
    formEl.innerHTML = `
      <label class="fl">Profile Name</label>
      <input type="text" id="prof-name" value="${p.name}" />

      <div class="grid2">
        <div>
          <label class="fl">Assigned Hazard Zone</label>
          <select id="prof-zone">
            ${['Zone 01', 'Zone 02', 'Zone 03', 'Zone 04'].map(z => `<option value="${z}" ${z === p.assigned_zone ? 'selected' : ''}>${z}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="fl">Operational Status</label>
          <select id="prof-status">
            <option value="ACTIVE" ${p.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
            <option value="REGISTERED" ${p.status === 'REGISTERED' ? 'selected' : ''}>REGISTERED / INACTIVE</option>
          </select>
        </div>
      </div>

      <div class="grid2">
        <div>
          <label class="fl">Gas Warning Threshold (%)</label>
          <input type="text" id="th-gas-warn" value="${p.thresholds?.gas_warning || 30}" />
        </div>
        <div>
          <label class="fl">Gas Critical Limit (%)</label>
          <input type="text" id="th-gas-crit" value="${p.thresholds?.gas_critical || 60}" />
        </div>
      </div>
    `;

    // Render sensor toggles
    const allSensors = ['gas', 'temperature', 'humidity', 'movement', 'camera'];
    const togglesEl = document.getElementById('sensor-toggles');
    const enabled = p.enabled_sensors || p.inputs || [];

    togglesEl.innerHTML = allSensors.map(s => {
      const isChecked = enabled.includes(s);
      return `
        <label style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 14px;cursor:pointer">
          <div>
            <span style="font-weight:700;font-size:13px;text-transform:uppercase">${s} SENSOR</span>
            <div style="font-size:11px;color:var(--text-dim)">Status: ${isChecked ? 'ACTIVE' : 'DISABLED'}</div>
          </div>
          <input type="checkbox" id="sens-${s}" ${isChecked ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary)" />
        </label>`;
    }).join('');
  }

  window.saveActiveSlot = async () => {
    const allSensors = ['gas', 'temperature', 'humidity', 'movement', 'camera'];
    const selectedSensors = allSensors.filter(s => document.getElementById(`sens-${s}`)?.checked);

    const payload = {
      name: document.getElementById('prof-name')?.value,
      assigned_zone: document.getElementById('prof-zone')?.value,
      status: document.getElementById('prof-status')?.value,
      enabled_sensors: selectedSensors,
      inputs: selectedSensors,
      thresholds: {
        gas_warning: parseFloat(document.getElementById('th-gas-warn')?.value) || 30.0,
        gas_critical: parseFloat(document.getElementById('th-gas-crit')?.value) || 60.0,
        temp_warning: 35.0,
        temp_critical: 50.0
      }
    };

    await apiFetch(`/api/profiles/${selectedSlot}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    alert('Profile slot updated and saved to SQLite database.');
    loadProfiles();
  };

  loadProfiles();
}


// ── INITIAL BOOT ─────────────────────────────────────────────────────────────
buildNav();
renderPage('dashboard');
