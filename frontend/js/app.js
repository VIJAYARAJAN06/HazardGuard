/* ==============================================================================
   HAZARDGUARD — Enterprise Master Frontend Application Controller
   Modern Minimal White Theme · Pure Modular Architecture · Real Backend Data
   
   STRICT INFORMATION ORDER (LOCKED & PRESERVED):
   1. Dashboard            (KPIs, Zone Overview, Recent Incidents, Severity Donut, Trends, Workers)
   2. Live Monitoring      (Live Webcam / Honest CV, Telemetry Grid, Multi-line Graph, Expected vs Actual, Evidence, ML Risk, 120s Timeline Player)
   3. Incidents & Evidence (Enterprise Incident Data Table, Filters, Master-Detail Audit Drawer, Telemetry Snapshot, Evidence Tree)
   4. AI Explanation       (Structured Incident Safety Report, Root-Cause Analysis, Transparent Mode Disclosure)
   5. Acknowledgement      (Supervisor Operational Workspace, 5-Stage Lifecycle Stepper, Mitigation Notes)
   6. Profile / Settings   (4 Primary Profile Slots, Real Sensor Masks, Worker/Zone Assignments, Thresholds)
   ============================================================================== */

const API = window.location.port === '8000' || window.location.pathname.startsWith('/api') || window.location.origin.includes('render.com') || window.location.origin.includes('railway.app') || window.location.origin.includes('onrender.com')
  ? window.location.origin
  : 'http://localhost:8000';

// EXACT LOCKED 6-PAGE NAVIGATION ORDER
const PAGES = [
  { id: 'dashboard',   label: 'Dashboard',            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>` },
  { id: 'monitoring',  label: 'Live Monitoring',       icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/></svg>` },
  { id: 'incidents',   label: 'Incidents & Evidence', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>` },
  { id: 'ai',          label: 'AI Explanation',       icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>` },
  { id: 'ack',         label: 'Acknowledgement',      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>` },
  { id: 'settings',    label: 'Profile / Settings',   icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>` },
];

let currentPage = 'dashboard';
let wsConn = null;
let activeWebcamStream = null;
// AUTHENTICATION & ROLE STATE
let authToken = localStorage.getItem('hazardguard_token') || '';
let currentUser = null;
try {
  const cachedUser = localStorage.getItem('hazardguard_user');
  if (cachedUser) currentUser = JSON.parse(cachedUser);
} catch {
  currentUser = null;
}

// ── SHARED UTILITIES & FETCH WRAPPER ─────────────────────────────────────────

async function apiFetch(path, options = {}) {
  try {
    const headers = options.headers || {};
    if (authToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    options.headers = headers;

    const res = await fetch(`${API}${path}`, options);
    if (res.status === 401) {
      // Token expired or invalid
      logoutUser();
      return null;
    }
    if (res.status === 403) {
      alert("Permission Denied: Your assigned role does not have authorization for this action.");
      return null;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`API Error [${path}]:`, err);
    return null;
  }
}

// ── AUTHENTICATION LIFECYCLE & ACCESS CONTROL ─────────────────────────────

async function checkAuthSession() {
  const overlay = document.getElementById('auth-overlay');
  const loginForm = document.getElementById('login-form');
  const setupForm = document.getElementById('setup-form');
  const modalSub = document.getElementById('auth-modal-sub');

  try {
    const statusData = await fetch(`${API}/api/auth/setup-status`).then(r => r.json());
    if (!statusData.initialized) {
      // Show First-Time Setup Wizard
      if (overlay) overlay.style.display = 'flex';
      if (loginForm) loginForm.style.display = 'none';
      if (setupForm) setupForm.style.display = 'block';
      if (modalSub) modalSub.textContent = 'System Initial Setup — Create Primary Safety Administrator';
      return false;
    }
  } catch (err) {
    console.warn('Setup status check failed:', err);
  }

  if (!authToken || !currentUser) {
    if (overlay) overlay.style.display = 'flex';
    if (loginForm) loginForm.style.display = 'block';
    if (setupForm) setupForm.style.display = 'none';
    if (modalSub) modalSub.textContent = 'Intelligent Hazard-Zone Personnel Monitoring System';
    return false;
  }

  // Verify token with backend
  try {
    const meRes = await fetch(`${API}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!meRes.ok) {
      logoutUser();
      return false;
    }
    currentUser = await meRes.json();
    localStorage.setItem('hazardguard_user', JSON.stringify(currentUser));
  } catch {
    // If backend unreachable temporarily keep cached user
  }

  if (overlay) overlay.style.display = 'none';
  updateUserUI();
  return true;
}

window.fillLogin = (username, password) => {
  const uEl = document.getElementById('login-username');
  const pEl = document.getElementById('login-password');
  if (uEl) uEl.value = username;
  if (pEl) pEl.value = password;
};

window.handleLoginSubmit = async (e) => {
  e.preventDefault();
  const errBox = document.getElementById('auth-error-alert');
  if (errBox) errBox.style.display = 'none';

  const username = document.getElementById('login-username')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      if (errBox) {
        errBox.textContent = data.detail || 'Authentication failed. Please verify credentials.';
        errBox.style.display = 'block';
      }
      return;
    }

    authToken = data.access_token;
    currentUser = data.user;
    localStorage.setItem('hazardguard_token', authToken);
    localStorage.setItem('hazardguard_user', JSON.stringify(currentUser));

    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'none';

    updateUserUI();

    // Role-appropriate Landing page:
    // SAFETY OPERATIONS lands on Live Monitoring
    // ADMIN / VIEWER lands on Dashboard
    if (currentUser.role === 'SAFETY_OPERATIONS') {
      navigate('monitoring');
    } else {
      navigate('dashboard');
    }
  } catch (err) {
    if (errBox) {
      errBox.textContent = 'Network error contacting HazardGuard auth service.';
      errBox.style.display = 'block';
    }
  }
};

window.handleSetupSubmit = async (e) => {
  e.preventDefault();
  const errBox = document.getElementById('auth-error-alert');
  if (errBox) errBox.style.display = 'none';

  const full_name = document.getElementById('setup-fullname')?.value.trim();
  const email = document.getElementById('setup-email')?.value.trim();
  const username = document.getElementById('setup-username')?.value.trim();
  const password = document.getElementById('setup-password')?.value;

  try {
    const res = await fetch(`${API}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, email, username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      if (errBox) {
        errBox.textContent = data.detail || 'Initial setup failed.';
        errBox.style.display = 'block';
      }
      return;
    }

    authToken = data.access_token;
    currentUser = data.user;
    localStorage.setItem('hazardguard_token', authToken);
    localStorage.setItem('hazardguard_user', JSON.stringify(currentUser));

    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'none';

    updateUserUI();
    navigate('dashboard');
  } catch (err) {
    if (errBox) {
      errBox.textContent = 'Setup submission network error.';
      errBox.style.display = 'block';
    }
  }
};

window.logoutUser = () => {
  authToken = '';
  currentUser = null;
  localStorage.removeItem('hazardguard_token');
  localStorage.removeItem('hazardguard_user');

  const overlay = document.getElementById('auth-overlay');
  const loginForm = document.getElementById('login-form');
  const setupForm = document.getElementById('setup-form');
  if (overlay) overlay.style.display = 'flex';
  if (loginForm) loginForm.style.display = 'block';
  if (setupForm) setupForm.style.display = 'none';
};

window.handleUserMenuToggle = () => {
  if (confirm(`Active Account: ${currentUser?.full_name || 'User'} (${currentUser?.role || 'Guest'})\n\nWould you like to sign out?`)) {
    logoutUser();
  }
};

function updateUserUI() {
  if (!currentUser) return;
  const nameEl = document.getElementById('header-user-name');
  const roleEl = document.getElementById('header-user-role');
  const avatarEl = document.getElementById('header-user-avatar');
  const resetBtn = document.getElementById('sidebar-reset-btn');

  if (nameEl) nameEl.textContent = currentUser.full_name || currentUser.username;
  if (roleEl) {
    const roleLabels = {
      'ADMIN': 'System / Plant Admin',
      'SAFETY_OPERATIONS': 'Safety Supervisor',
      'VIEWER': 'Auditor / Read-Only'
    };
    roleEl.textContent = roleLabels[currentUser.role] || currentUser.role;
  }
  if (avatarEl) {
    const initials = (currentUser.full_name || currentUser.username || 'HG')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    avatarEl.innerHTML = `<span>${initials}</span>`;
  }

  // Restrict Admin-only Reset button on sidebar for non-admins
  if (resetBtn) {
    resetBtn.style.display = currentUser.role === 'ADMIN' ? 'flex' : 'none';
  }
}

function fdt(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoStr;
  }
}

function ft(isoStr) {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoStr;
  }
}

function badgeHtml(severity) {
  const s = severity || 'Normal';
  const c = {
    Critical: 'badge-critical',
    High:     'badge-high',
    Warning:  'badge-warning',
    Normal:   'badge-normal'
  }[s] || 'badge-neutral';
  return `<span class="badge ${c}">● ${s}</span>`;
}

// ── NAVIGATION CONTROLLER ───────────────────────────────────────────────────

function buildNav() {
  const navEl = document.getElementById('nav');
  if (!navEl) return;
  navEl.innerHTML = PAGES.map(p => `
    <button type="button" onclick="navigate('${p.id}')" class="${p.id === currentPage ? 'active' : ''}">
      <span class="nav-icon">${p.icon}</span>
      <span>${p.label}</span>
      ${p.id === 'incidents' ? `<span class="nav-badge" id="nav-inc-badge">0</span>` : ''}
    </button>
  `).join('');
}

function navigate(id) {
  if (wsConn && id !== 'monitoring') {
    wsConn.close();
    wsConn = null;
  }
  if (activeWebcamStream && id !== 'monitoring') {
    activeWebcamStream.getTracks().forEach(t => t.stop());
    activeWebcamStream = null;
  }

  currentPage = id;
  const p = PAGES.find(x => x.id === id);
  const titleEl = document.getElementById('header-page-title');
  if (titleEl && p) titleEl.textContent = p.label;

  buildNav();
  renderCurrentPage();
}

function renderCurrentPage() {
  const container = document.getElementById('page-content');
  if (!container) return;
  container.innerHTML = '';

  const views = {
    dashboard: renderDashboard,
    monitoring: renderMonitoring,
    incidents: renderIncidents,
    ai: renderAI,
    ack: renderAcknowledgement,
    settings: renderSettings
  };

  (views[currentPage] || renderDashboard)(container);
}

// ── GLOBAL SEARCH & CLOCK ───────────────────────────────────────────────────

function initClock() {
  setInterval(() => {
    const el = document.getElementById('live-clock');
    if (el) {
      const now = new Date();
      el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }, 1000);
}

window.onGlobalSearch = (query) => {
  const q = query.trim().toLowerCase();
  if (!q) return;
  // If user searches on another page, navigate to incidents search
  if (currentPage !== 'incidents') {
    navigate('incidents');
    setTimeout(() => {
      const filterInput = document.getElementById('inc-search-input');
      if (filterInput) {
        filterInput.value = q;
        filterInput.dispatchEvent(new Event('input'));
      }
    }, 150);
  }
};

window.confirmReset = () => {
  const modal = document.getElementById('reset-modal');
  if (modal) modal.style.display = 'flex';
};

window.doReset = async () => {
  const modal = document.getElementById('reset-modal');
  if (modal) modal.style.display = 'none';
  await apiFetch('/api/reset', { method: 'POST' });
  navigate('dashboard');
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. DASHBOARD — (LOCKED POSITION 1)
// ══════════════════════════════════════════════════════════════════════════════
async function renderDashboard(el) {
  el.innerHTML = `
    <!-- Top Header Overview -->
    <div class="page-header">
      <div class="page-title-wrap">
        <h1 class="page-title">Safety Operations Dashboard</h1>
        <div class="page-sub">Real-time status overview of active personnel, hazard zones, and system telemetry</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary" onclick="navigate('incidents')">View All Incidents</button>
        <button class="btn btn-primary" onclick="navigate('monitoring')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Open Live Monitoring
        </button>
      </div>
    </div>

    <!-- 1. TOP KPI ROW -->
    <div class="kpi-grid">
      <!-- Active Workers -->
      <div class="kpi-card">
        <div class="kpi-top-row">
          <span class="kpi-label">Active Workers</span>
          <div class="kpi-icon-wrapper blue">👥</div>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value" id="kpi-active-workers">—</span>
          <span class="kpi-delta good" id="kpi-worker-ratio">100% online</span>
        </div>
        <div class="kpi-footnote">Real-time biometric & telemetry link</div>
      </div>

      <!-- Monitored Zones -->
      <div class="kpi-card">
        <div class="kpi-top-row">
          <span class="kpi-label">Monitored Zones</span>
          <div class="kpi-icon-wrapper green">🏭</div>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value" id="kpi-monitored-zones">4</span>
          <span class="kpi-delta good">4 / 4 Active</span>
        </div>
        <div class="kpi-footnote">Primary industrial hazard quadrants</div>
      </div>

      <!-- High / Critical Threats -->
      <div class="kpi-card">
        <div class="kpi-top-row">
          <span class="kpi-label">High / Critical Threats</span>
          <div class="kpi-icon-wrapper red">⚠️</div>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value" id="kpi-critical-incidents">—</span>
          <span class="kpi-delta warn" id="kpi-threat-tag">0 Active</span>
        </div>
        <div class="kpi-footnote">Requires supervisor intervention</div>
      </div>

      <!-- System Health -->
      <div class="kpi-card">
        <div class="kpi-top-row">
          <span class="kpi-label">System Health</span>
          <div class="kpi-icon-wrapper blue">🛡️</div>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value" style="font-size:20px;color:#10b981">OPERATIONAL</span>
        </div>
        <div class="kpi-footnote" id="kpi-engine-tag">Deterministic + ML Model</div>
      </div>
    </div>

    <!-- 2. ZONE OVERVIEW (4 PRIMARY ZONES) -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Hazard Zone Status & Personnel Distribution</div>
          <div class="card-subtitle">Active surveillance perimeters with assigned profiles and real-time threat ratings</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="navigate('settings')">Configure Profiles →</button>
      </div>
      <div class="zone-grid" id="dash-zone-cards">Loading zones…</div>
    </div>

    <!-- 3. MIDDLE SECTION: INCIDENT TRENDS & SEVERITY DONUT -->
    <div class="grid-split-7-5" style="margin-bottom:24px">
      <!-- Zone Comparison Bar Chart -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Zone Personnel & Alert Distribution</div>
            <div class="card-subtitle">Comparative allocation of active personnel across monitored industrial zones</div>
          </div>
          <span class="badge badge-neutral">4 Zones Monitored</span>
        </div>
        <div id="dash-bar-chart-container" style="height:190px"></div>
      </div>

      <!-- Severity Donut & ML Risk Score -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Incident Severity Distribution</div>
            <div class="card-subtitle">Recorded events by operational severity</div>
          </div>
          <span class="badge badge-neutral" id="dash-total-inc-badge">0 Events</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-around;height:190px" id="dash-donut-container">
          Loading chart…
        </div>
      </div>
    </div>

    <!-- 4. BOTTOM SECTION: RECENT INCIDENTS & WORKER OVERVIEW -->
    <div class="grid-2">
      <!-- Recent Incidents Table -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Recent Critical & Warning Events</div>
            <div class="card-subtitle">Live events logged in SQLite WAL database</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="navigate('incidents')">View All →</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Zone</th>
                <th>Worker</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="dash-recent-table-body">
              <tr><td colspan="5" class="empty-state">Loading incidents…</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Worker Overview Table -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Personnel Telemetry Status</div>
            <div class="card-subtitle">Active monitored technicians and assigned zones</div>
          </div>
          <span class="badge badge-neutral" id="dash-worker-count-badge">5 Registered</span>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Zone</th>
                <th>Connection</th>
                <th>Posture</th>
                <th>Movement</th>
              </tr>
            </thead>
            <tbody id="dash-worker-table-body">
              <tr><td colspan="5" class="empty-state">Loading workers…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Fetch and hydrate real backend data
  async function hydrateDashboard() {
    const [dash, workersData, statusData] = await Promise.all([
      apiFetch('/api/dashboard'),
      apiFetch('/api/workers'),
      apiFetch('/api/status')
    ]);

    if (!dash) return;

    // 1. Update KPIs
    const totalWorkers = dash.total_workers || 0;
    const activeWorkers = dash.active_workers || 0;
    const sum = dash.summary || {};
    const criticals = (sum.Critical || 0) + (sum.High || 0);

    const elW = document.getElementById('kpi-active-workers');
    if (elW) elW.textContent = `${activeWorkers} / ${totalWorkers}`;

    const elWratio = document.getElementById('kpi-worker-ratio');
    if (elWratio) elWratio.textContent = `${totalWorkers > 0 ? Math.round((activeWorkers/totalWorkers)*100) : 0}% Online`;

    const elCrit = document.getElementById('kpi-critical-incidents');
    if (elCrit) elCrit.textContent = criticals;

    const elCritTag = document.getElementById('kpi-threat-tag');
    if (elCritTag) {
      elCritTag.textContent = criticals > 0 ? `${criticals} Alert(s)` : '0 Active';
      elCritTag.className = criticals > 0 ? 'kpi-delta warn' : 'kpi-delta good';
    }

    const headerNotif = document.getElementById('header-alert-count');
    if (headerNotif) headerNotif.textContent = criticals;

    // 2. Render Zone Cards
    const zonesContainer = document.getElementById('dash-zone-cards');
    if (zonesContainer && dash.zones) {
      zonesContainer.innerHTML = dash.zones.map(z => `
        <div class="zone-card" onclick="navigate('monitoring')">
          <div class="zone-header">
            <span class="zone-id">${z.id}</span>
            ${badgeHtml(z.status)}
          </div>
          <div class="zone-title">${z.name}</div>
          <div class="zone-hazard">
            <span>⚠️</span> ${z.hazard_type}
          </div>
          <div class="zone-footer">
            <span class="zone-personnel">👥 ${z.personnel} Assigned</span>
            <span style="color:var(--text-muted);font-size:10px">${z.active_profile}</span>
          </div>
        </div>
      `).join('');
    }

    // 3. Render Zone Comparison Bar Chart (SVG)
    const barChartEl = document.getElementById('dash-bar-chart-container');
    if (barChartEl && dash.zones) {
      const zones = dash.zones;
      const maxPersonnel = Math.max(...zones.map(z => z.personnel), 3);
      barChartEl.innerHTML = `
        <div style="display:flex;align-items:flex-end;justify-content:space-around;height:140px;padding-top:20px;border-bottom:1px solid var(--border-subtle)">
          ${zones.map(z => {
            const h = Math.round((z.personnel / maxPersonnel) * 110) + 12;
            const barColor = z.status === 'Critical' ? 'var(--sev-critical)' : z.status === 'Warning' ? 'var(--sev-warning)' : 'var(--primary)';
            return `
              <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:60px">
                <span style="font-size:11px;font-weight:700;color:var(--text-secondary)">${z.personnel} wkr</span>
                <div style="width:28px;height:${h}px;background:${barColor};border-radius:4px 4px 0 0;transition:height 0.3s ease"></div>
                <span style="font-size:11px;font-weight:600;color:var(--text-muted);white-space:nowrap">${z.id}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:center;gap:18px;margin-top:10px;font-size:11px;color:var(--text-muted)">
          <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;background:var(--primary);border-radius:2px"></span> Assigned Workers</span>
          <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;background:var(--sev-normal);border-radius:2px"></span> Baseline Normal</span>
        </div>
      `;
    }

    // 4. Render Severity Donut Chart (SVG)
    const donutEl = document.getElementById('dash-donut-container');
    if (donutEl) {
      const n = sum.Normal || 0;
      const w = sum.Warning || 0;
      const h = sum.High || 0;
      const c = sum.Critical || 0;
      const total = n + w + h + c;

      const totalBadge = document.getElementById('dash-total-inc-badge');
      if (totalBadge) totalBadge.textContent = `${total} Events`;

      // SVG Donut calculation
      const r = 40;
      const cLength = 2 * Math.PI * r;
      const getOffset = (val) => total > 0 ? (val / total) * cLength : 0;

      const pN = getOffset(n);
      const pW = getOffset(w);
      const pH = getOffset(h);
      const pC = getOffset(c);

      donutEl.innerHTML = `
        <div style="position:relative;width:110px;height:110px">
          <svg width="110" height="110" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="14"/>
            <!-- Normal -->
            <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--sev-normal)" stroke-width="14"
              stroke-dasharray="${pN} ${cLength}" stroke-dashoffset="0" transform="rotate(-90 50 50)"/>
            <!-- Warning -->
            <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--sev-warning)" stroke-width="14"
              stroke-dasharray="${pW} ${cLength}" stroke-dashoffset="${-pN}" transform="rotate(-90 50 50)"/>
            <!-- High -->
            <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--sev-high)" stroke-width="14"
              stroke-dasharray="${pH} ${cLength}" stroke-dashoffset="${-(pN+pW)}" transform="rotate(-90 50 50)"/>
            <!-- Critical -->
            <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--sev-critical)" stroke-width="14"
              stroke-dasharray="${pC} ${cLength}" stroke-dashoffset="${-(pN+pW+pH)}" transform="rotate(-90 50 50)"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <span style="font-size:18px;font-weight:800;color:var(--text-primary)">${total}</span>
            <span style="font-size:9px;color:var(--text-muted);font-weight:700">EVENTS</span>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;font-size:11px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:10px;height:10px;border-radius:2px;background:var(--sev-normal)"></span>
            <span style="color:var(--text-secondary);width:60px">Normal:</span>
            <span style="font-weight:700">${n}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:10px;height:10px;border-radius:2px;background:var(--sev-warning)"></span>
            <span style="color:var(--text-secondary);width:60px">Warning:</span>
            <span style="font-weight:700">${w}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:10px;height:10px;border-radius:2px;background:var(--sev-high)"></span>
            <span style="color:var(--text-secondary);width:60px">High:</span>
            <span style="font-weight:700">${h}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:10px;height:10px;border-radius:2px;background:var(--sev-critical)"></span>
            <span style="color:var(--text-secondary);width:60px">Critical:</span>
            <span style="font-weight:700">${c}</span>
          </div>
        </div>
      `;
    }

    // 5. Render Recent Incidents Table
    const recentBody = document.getElementById('dash-recent-table-body');
    if (recentBody) {
      const recents = dash.recent_incidents || [];
      if (recents.length === 0) {
        recentBody.innerHTML = `<tr><td colspan="5" class="empty-state">No incidents recorded. System nominal.</td></tr>`;
      } else {
        recentBody.innerHTML = recents.slice(0, 5).map(inc => `
          <tr>
            <td class="cell-mono">${inc.incident_code || '#' + inc.id}</td>
            <td><b>${inc.zone}</b></td>
            <td>${inc.worker_name || 'Unassigned'}</td>
            <td>${badgeHtml(inc.severity)}</td>
            <td><span class="badge badge-neutral">${inc.status}</span></td>
          </tr>
        `).join('');
      }
    }

    // 6. Render Worker Table
    const workerBody = document.getElementById('dash-worker-table-body');
    if (workerBody && workersData?.workers) {
      workerBody.innerHTML = workersData.workers.map(w => `
        <tr>
          <td>
            <div style="font-weight:600;color:var(--text-primary)">${w.name}</div>
            <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono)">${w.id} · ${w.role}</div>
          </td>
          <td><b>${w.zone_id || 'Unassigned'}</b></td>
          <td>
            <span class="badge ${w.connection_status === 'ONLINE' ? 'badge-normal' : 'badge-neutral'}">
              ${w.connection_status}
            </span>
          </td>
          <td><span style="font-size:11px;font-weight:600">${w.current_posture}</span></td>
          <td><span style="font-size:11px;color:var(--text-secondary)">${w.current_movement}</span></td>
        </tr>
      `).join('');
    }
  }

  hydrateDashboard();
  const timer = setInterval(() => {
    if (currentPage === 'dashboard') hydrateDashboard();
    else clearInterval(timer);
  }, 4000);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. LIVE MONITORING — (LOCKED POSITION 2)
// ══════════════════════════════════════════════════════════════════════════════
function renderMonitoring(el) {
  el.innerHTML = `
    <!-- Top Header -->
    <div class="page-header">
      <div class="page-title-wrap">
        <h1 class="page-title">Live Operational Monitoring</h1>
        <div class="page-sub">Telemetry surveillance, real webcam integration, expected-state verification, and scenario player</div>
      </div>
      <!-- Mode Badge -->
      <div style="display:flex;align-items:center;gap:10px">
        <span class="badge badge-blue" id="mon-ml-badge">ML RISK: 4.2% (STEADY)</span>
      </div>
    </div>

    <!-- Scenario Timeline Controller Bar -->
    <div class="timeline-control-bar">
      <div class="timer-readout">
        <span style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase">TIMELINE:</span>
        <span class="timer-digits" id="sc-timer">00:00</span>
        <span class="stage-pill" id="sc-stage">NORMAL: Baseline Surveillance (00:00 - 00:30)</span>
      </div>

      <!-- Controls -->
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="controlScenario('restart')" title="Restart Timeline">⏮ Restart</button>
        <button class="btn btn-secondary btn-sm" id="sc-pause-btn" onclick="controlScenario('toggle-pause')">⏸ Pause</button>
        <div style="border-left:1px solid var(--border-medium);height:20px;margin:0 4px"></div>
        <span style="font-size:11px;font-weight:700;color:var(--text-muted)">PRESETS:</span>
        <button class="btn btn-primary btn-sm" onclick="loadScenarioPreset('timeline')">▶ 120s TIMELINE</button>
        <button class="btn btn-secondary btn-sm" onclick="loadScenarioPreset('normal')">Normal</button>
        <button class="btn btn-secondary btn-sm" onclick="loadScenarioPreset('warning')">Warning</button>
        <button class="btn btn-secondary btn-sm" onclick="loadScenarioPreset('high')">High</button>
        <button class="btn btn-secondary btn-sm" onclick="loadScenarioPreset('critical')">Critical</button>
      </div>
    </div>

    <!-- MAIN TWO-COLUMN SPLIT (7:5) -->
    <div class="grid-split-7-5">
      <!-- LEFT COLUMN: Sensors, Expected vs Actual, Multi-line Telemetry Chart -->
      <div>
        <!-- Target Selector & Active Worker -->
        <div class="card" style="margin-bottom:18px">
          <div class="card-header">
            <div class="card-title">Surveillance Target & Profile</div>
            <span class="badge badge-neutral" id="mon-profile-tag">Profile: Confined Space Entry</span>
          </div>
          <div class="grid-2">
            <div>
              <label class="form-label">Monitored Zone</label>
              <select class="form-select" id="mon-zone-select" onchange="onZoneSelectChange(this.value)">
                <option value="Zone 01" selected>Zone 01 - Confined Space Tank</option>
                <option value="Zone 02">Zone 02 - Chemical Processing Area</option>
                <option value="Zone 03">Zone 03 - High Temp Furnace Room</option>
                <option value="Zone 04">Zone 04 - High Voltage Switchyard</option>
              </select>
            </div>
            <div>
              <label class="form-label">Assigned Personnel</label>
              <div id="mon-worker-tag" style="padding:8px 12px;background:var(--bg-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);font-size:12px;font-weight:600">
                Arun Kumar (W-101) · Senior Inspection Tech
              </div>
            </div>
          </div>
        </div>

        <!-- 4-Sensor Telemetry Readouts -->
        <div class="card" style="margin-bottom:18px">
          <div class="card-header">
            <div class="card-title">Live Sensor Telemetry Grid</div>
            <span class="badge badge-normal" id="mon-sensor-status">4 Active Sensors</span>
          </div>
          <div class="grid-4" style="margin-bottom:16px">
            <!-- Gas -->
            <div class="telemetry-tile">
              <span class="tl-label">Gas Concentration</span>
              <span class="tl-val" id="tl-gas">8.0%</span>
              <span class="tl-status" id="tl-gas-trend" style="color:var(--sev-normal)">STEADY (ACTIVE)</span>
            </div>
            <!-- Temp -->
            <div class="telemetry-tile">
              <span class="tl-label">Temperature</span>
              <span class="tl-val" id="tl-temp">24.0°C</span>
              <span class="tl-status" id="tl-temp-status" style="color:var(--sev-normal)">NORMAL</span>
            </div>
            <!-- Movement -->
            <div class="telemetry-tile">
              <span class="tl-label">Movement / IMU</span>
              <span class="tl-val" id="tl-move" style="font-size:16px">ACTIVE</span>
              <span class="tl-status" id="tl-inact-sec" style="color:var(--text-muted)">Inactivity: 0s</span>
            </div>
            <!-- Posture -->
            <div class="telemetry-tile">
              <span class="tl-label">Worker Posture</span>
              <span class="tl-val" id="tl-posture" style="font-size:16px">STANDING</span>
              <span class="tl-status" style="color:var(--sev-normal)">PASS Connected</span>
            </div>
          </div>

          <!-- Multi-line SVG Telemetry Graph (Gas & Temperature over time) -->
          <div style="border-top:1px solid var(--border-subtle);padding-top:14px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase">Live Telemetry Trend (Last 30 Seconds)</span>
              <div style="display:flex;gap:14px;font-size:11px;color:var(--text-muted)">
                <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:2px;background:#ef4444"></span> Gas Level (%)</span>
                <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:2px;background:#f59e0b"></span> Temperature (°C)</span>
              </div>
            </div>
            <div class="chart-container" style="height:120px" id="live-telemetry-svg">
              <!-- Rendered via JS -->
            </div>
          </div>
        </div>

        <!-- Expected vs Actual State Comparison -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Expected vs. Observed Operational State</div>
            <span class="badge badge-neutral">Rule Verification</span>
          </div>
          <div class="grid-2">
            <div style="background:var(--bg-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:12px">
              <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">EXPECTED PROTOCOL BASELINE</div>
              <div id="mon-expected" style="font-size:12px;color:var(--text-secondary);line-height:1.5">
                Continuous personnel movement; Atmospheric gas &lt; 25%; Temp &lt; 35°C
              </div>
            </div>
            <div style="background:var(--bg-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:12px">
              <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">OBSERVED TELEMETRY STATE</div>
              <div id="mon-actual" style="font-size:12px;color:var(--text-primary);font-weight:600;line-height:1.5">
                Personnel: Present (STANDING); Movement: Active; Gas: 8.0%
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Real Laptop Webcam + Threat Assessment Card -->
      <div>
        <!-- Real Laptop Webcam Surveillance Frame -->
        <div class="camera-box" style="margin-bottom:18px">
          <div class="camera-header">
            <span>📷 CAMERA SURVEILLANCE FEED</span>
            <span class="badge badge-neutral" id="cam-status-pill">INITIALIZING</span>
          </div>

          <div class="camera-viewport">
            <video id="webcam-video" autoplay playsinline muted style="display:none"></video>
            <div class="camera-placeholder" id="cam-fallback">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
              <div style="font-size:13px;font-weight:700;color:#f8fafc">Laptop Video Feed</div>
              <div style="font-size:11px;color:#94a3b8;margin:4px 0 12px 0">Connect your local device webcam for live control-room testing</div>
              <button class="btn btn-primary btn-sm" onclick="connectWebcam()">Connect Laptop Webcam</button>
            </div>
          </div>

          <div class="camera-footer">
            <span>COMPUTER VISION ANALYSIS:</span>
            <span style="font-weight:700;color:#60a5fa" id="cv-engine-tag">TESTBENCH (NO RANDOM FAKE BOUNDING BOXES)</span>
          </div>
        </div>

        <!-- Real-Time Threat Assessment Card -->
        <div class="card" id="mon-threat-card" style="border-left:4px solid var(--sev-normal)">
          <div class="card-header">
            <div>
              <div style="display:flex;align-items:center;gap:8px">
                <span id="mon-sev-badge">${badgeHtml('Normal')}</span>
                <span id="mon-threat-title" style="font-size:15px;font-weight:800;color:var(--text-primary)">Normal Safe Operations</span>
              </div>
              <div class="card-subtitle" id="mon-threat-zone" style="margin-top:2px">Zone 01 · Baseline Operations</div>
            </div>
          </div>

          <!-- Correlated Evidence List -->
          <div style="margin-bottom:14px">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Empirical Evidence Points</div>
            <div id="mon-evidence-list" style="font-size:12px;color:var(--sev-normal-text);background:var(--sev-normal-bg);padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--sev-normal-border)">
              ✓ All active sensors operate within baseline tolerances.
            </div>
          </div>

          <!-- Triggered Failure Mechanisms -->
          <div style="margin-bottom:14px">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Triggered Mechanisms</div>
            <div id="mon-mech-list" style="font-size:12px;color:var(--text-muted)">None (Nominal)</div>
          </div>

          <!-- Tactical Directive -->
          <div style="background:var(--bg-subtle);border-radius:var(--radius-md);padding:12px;border:1px solid var(--border-subtle)">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Tactical Responder Directive</div>
            <div id="mon-directive" style="font-size:12px;font-weight:600;color:var(--text-primary);line-height:1.4">
              All atmospheric, thermal, and personnel activity indicators are within safe operating limits.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

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
  const telGas = document.getElementById('tl-gas');
  if (telGas) telGas.textContent = `${r.gas_level}%`;

  const telGasTrend = document.getElementById('tl-gas-trend');
  if (telGasTrend && a.temporal) {
    telGasTrend.textContent = `${a.temporal.gas_trend} (${a.sensor_status?.gas || 'ACTIVE'})`;
    telGasTrend.style.color = a.temporal.gas_trend === 'RAPID_SURGE' ? 'var(--sev-critical)' : a.temporal.gas_trend === 'RISING' ? 'var(--sev-warning)' : 'var(--sev-normal)';
  }

  const telTemp = document.getElementById('tl-temp');
  if (telTemp) telTemp.textContent = `${r.temperature}°C`;

  const telMove = document.getElementById('tl-move');
  if (telMove) {
    telMove.textContent = r.movement ? 'ACTIVE' : 'NO MOVEMENT';
    telMove.style.color = r.movement ? 'var(--sev-normal)' : 'var(--sev-critical)';
  }

  const telInact = document.getElementById('tl-inact-sec');
  if (telInact && a.temporal) {
    telInact.textContent = `Inactivity: ${a.temporal.inactivity_duration_sec}s`;
  }

  const telPosture = document.getElementById('tl-posture');
  if (telPosture) telPosture.textContent = r.posture || 'STANDING';

  // 3. Expected vs Actual
  const expEl = document.getElementById('mon-expected');
  if (expEl && a.expected_state) expEl.textContent = a.expected_state;

  const actEl = document.getElementById('mon-actual');
  if (actEl && a.actual_state) actEl.textContent = a.actual_state;

  // 4. ML Early Warning Risk Badge
  const mlBadge = document.getElementById('mon-ml-badge');
  if (mlBadge && a.ml_risk) {
    const risk = a.ml_risk.risk_percentage;
    const badgeClass = risk >= 70 ? 'badge-critical' : risk >= 40 ? 'badge-warning' : 'badge-normal';
    mlBadge.className = `badge ${badgeClass}`;
    mlBadge.textContent = `ML RISK: ${risk}% (${a.ml_risk.trend})`;
  }

  // 5. Threat Assessment Card
  const tc = document.getElementById('mon-threat-card');
  if (tc) {
    const sevColor = a.severity === 'Critical' ? 'var(--sev-critical)' : a.severity === 'High' ? 'var(--sev-high)' : a.severity === 'Warning' ? 'var(--sev-warning)' : 'var(--sev-normal)';
    tc.style.borderLeftColor = sevColor;

    document.getElementById('mon-sev-badge').innerHTML = badgeHtml(a.severity);
    document.getElementById('mon-threat-title').textContent = a.incident_type || 'Operations';
    document.getElementById('mon-threat-zone').textContent = `${r.zone || 'Zone 01'} · Monitored Worker: ${w.name || 'Unassigned'}`;

    // Evidence
    const evList = document.getElementById('mon-evidence-list');
    if (evList) {
      if (a.evidence && a.evidence.length > 0) {
        evList.style.background = 'var(--sev-critical-bg)';
        evList.style.color = 'var(--sev-critical-text)';
        evList.style.borderColor = 'var(--sev-critical-border)';
        evList.innerHTML = a.evidence.map(e => `<div style="margin-bottom:3px">⚠️ ${e}</div>`).join('');
      } else {
        evList.style.background = 'var(--sev-normal-bg)';
        evList.style.color = 'var(--sev-normal-text)';
        evList.style.borderColor = 'var(--sev-normal-border)';
        evList.innerHTML = '✓ All active sensors operate within baseline tolerances.';
      }
    }

    // Mechanisms
    const mechList = document.getElementById('mon-mech-list');
    if (mechList) {
      if (a.mechanisms && a.mechanisms.length > 0) {
        mechList.innerHTML = a.mechanisms.map(m => `<div style="color:var(--sev-warning-text);font-weight:600;margin-bottom:3px">⚡ ${m}</div>`).join('');
      } else {
        mechList.innerHTML = '<span style="color:var(--text-muted)">None (Nominal)</span>';
      }
    }

    // Tactical Directive
    const td = document.getElementById('mon-directive');
    if (td && a.recommended_action) td.textContent = a.recommended_action;
  }

  // 6. Update Rolling Telemetry SVG Chart
  liveTelemetryHistory.push({
    gas: r.gas_level || 0,
    temp: r.temperature || 20
  });
  if (liveTelemetryHistory.length > 30) liveTelemetryHistory.shift();
  renderTelemetryChart();
}

function renderTelemetryChart() {
  const container = document.getElementById('live-telemetry-svg');
  if (!container || liveTelemetryHistory.length < 2) return;

  const w = container.clientWidth || 400;
  const h = 120;
  const n = liveTelemetryHistory.length;

  const maxGas = 80;
  const maxTemp = 60;

  // Build SVG polyline points
  const gasPoints = liveTelemetryHistory.map((d, i) => {
    const x = (i / (n - 1)) * w;
    const y = h - ((d.gas / maxGas) * (h - 10));
    return `${x},${y}`;
  }).join(' ');

  const tempPoints = liveTelemetryHistory.map((d, i) => {
    const x = (i / (n - 1)) * w;
    const y = h - ((d.temp / maxTemp) * (h - 10));
    return `${x},${y}`;
  }).join(' ');

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${w} ${h}">
      <!-- Grid lines -->
      <line x1="0" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="#f1f5f9" stroke-width="1"/>
      <line x1="0" y1="${h-1}" x2="${w}" y2="${h-1}" stroke="#e2e8f0" stroke-width="1"/>
      <!-- Polylines -->
      <polyline points="${tempPoints}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
      <polyline points="${gasPoints}" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

window.connectWebcam = async () => {
  const video = document.getElementById('webcam-video');
  const fallback = document.getElementById('cam-fallback');
  const badgeEl = document.getElementById('cam-status-pill');

  try {
    activeWebcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = activeWebcamStream;
    video.style.display = 'block';
    fallback.style.display = 'none';
    badgeEl.className = 'badge badge-normal';
    badgeEl.textContent = 'REAL CAMERA CONNECTED';
    document.getElementById('cv-engine-tag').textContent = 'WEBCAM ACTIVE · CV ANALYSIS: NOT AVAILABLE (PHASE 2)';
  } catch (err) {
    badgeEl.className = 'badge badge-warning';
    badgeEl.textContent = 'PERMISSION DENIED';
    alert('Webcam access was denied or is unavailable. Running in testbench simulation mode.');
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

window.onZoneSelectChange = async (zone) => {
  const dash = await apiFetch('/api/dashboard');
  const zData = (dash?.zones || []).find(z => z.id === zone);
  const tagEl = document.getElementById('mon-worker-tag');
  if (tagEl && zData) {
    if (zData.workers && zData.workers.length > 0) {
      tagEl.textContent = `${zData.workers[0].name} (${zData.workers[0].id}) · ${zData.workers[0].role || 'Specialist'}`;
    } else {
      tagEl.textContent = 'Unassigned Personnel';
    }
  }
  window.loadScenarioPreset('timeline');
};

// ══════════════════════════════════════════════════════════════════════════════
// 3. INCIDENTS & EVIDENCE — (LOCKED POSITION 3)
// ══════════════════════════════════════════════════════════════════════════════
async function renderIncidents(el) {
  let incidents = [];
  let selected = null;
  let activeFilter = 'All';

  el.innerHTML = `
    <!-- Top Header -->
    <div class="page-header">
      <div class="page-title-wrap">
        <h1 class="page-title">Incidents & Evidence Repository</h1>
        <div class="page-sub">Comprehensive audit trail of detected safety events, multi-vector evidence logs, and telemetry snapshots</div>
      </div>
      <!-- Severity Filter Buttons -->
      <div style="display:flex;gap:6px">
        ${['All', 'Critical', 'High', 'Warning', 'Normal'].map(f => `
          <button class="btn btn-secondary btn-sm inc-filter-btn ${f === 'All' ? 'btn-primary' : ''}" onclick="filterIncidents('${f}', this)">
            ${f}
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Master-Detail Grid -->
    <div class="grid-split-7-5">
      <!-- LEFT: Main Incident Table -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-weight:700;font-size:13px">Recorded Incidents</span>
            <span class="badge badge-neutral" id="inc-table-count">0 Events</span>
          </div>
          <div style="width:200px">
            <input type="text" class="form-input" id="inc-search-input" placeholder="Filter code/worker..." oninput="onIncidentSearch(this.value)" style="padding:5px 10px;font-size:11px"/>
          </div>
        </div>

        <div class="table-container" style="border:none;max-height:calc(100vh - 280px);overflow-y:auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Zone</th>
                <th>Worker</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody id="incidents-table-body">
              <tr><td colspan="6" class="empty-state">Loading repository…</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- RIGHT: Incident Detail Inspector Drawer -->
      <div class="card" id="inc-detail-card" style="max-height:calc(100vh - 280px);overflow-y:auto">
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">Select an incident from the table to inspect empirical evidence, telemetry snapshots, and lifecycle audit records.</div>
        </div>
      </div>
    </div>
  `;

  async function loadData() {
    const res = await apiFetch('/api/incidents');
    incidents = res?.incidents || [];
    renderTable();
  }

  function renderTable(searchTerm = '') {
    const countBadge = document.getElementById('inc-table-count');
    let filtered = incidents;

    if (activeFilter !== 'All') {
      filtered = filtered.filter(i => i.severity === activeFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(i =>
        (i.incident_code || '').toLowerCase().includes(q) ||
        (i.worker_name || '').toLowerCase().includes(q) ||
        (i.zone || '').toLowerCase().includes(q) ||
        (i.incident_type || '').toLowerCase().includes(q)
      );
    }

    if (countBadge) countBadge.textContent = `${filtered.length} Events`;

    const body = document.getElementById('incidents-table-body');
    if (!body) return;

    if (filtered.length === 0) {
      body.innerHTML = `<tr><td colspan="6" class="empty-state">No incidents matching criteria.</td></tr>`;
      return;
    }

    body.innerHTML = filtered.map(inc => `
      <tr onclick="selectIncidentRow(${inc.id})" style="cursor:pointer;background:${selected?.id === inc.id ? 'var(--primary-light)' : 'transparent'}">
        <td class="cell-mono">${inc.incident_code || '#' + inc.id}</td>
        <td><b>${inc.zone}</b></td>
        <td>${inc.worker_name || 'N/A'}</td>
        <td>${badgeHtml(inc.severity)}</td>
        <td><span class="badge badge-neutral">${inc.status}</span></td>
        <td class="cell-meta">${ft(inc.created_at || inc.timestamp)}</td>
      </tr>
    `).join('');

    if (!selected && filtered.length > 0) {
      selectIncidentRow(filtered[0].id);
    }
  }

  window.selectIncidentRow = (id) => {
    selected = incidents.find(i => i.id === id);
    renderTable(document.getElementById('inc-search-input')?.value || '');
    renderDetailView();
  };

  window.filterIncidents = (filter, btn) => {
    activeFilter = filter;
    document.querySelectorAll('.inc-filter-btn').forEach(b => {
      b.classList.remove('btn-primary');
      b.classList.add('btn-secondary');
    });
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary');
    renderTable(document.getElementById('inc-search-input')?.value || '');
  };

  window.onIncidentSearch = (query) => {
    renderTable(query);
  };

  function renderDetailView() {
    const detailEl = document.getElementById('inc-detail-card');
    if (!detailEl || !selected) return;

    const snap = selected.sensor_snapshot || {};
    const transitions = selected.transitions || [];

    detailEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border-subtle)">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="cell-mono" style="font-size:14px">${selected.incident_code}</span>
            ${badgeHtml(selected.severity)}
          </div>
          <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-top:2px">${selected.incident_type}</div>
          <div style="font-size:11px;color:var(--text-muted)">${selected.zone} · Worker: ${selected.worker_name || 'Unassigned'}</div>
        </div>
        <span class="badge badge-neutral" style="font-size:12px">${selected.status}</span>
      </div>

      <!-- Evidence Points -->
      <div style="margin-bottom:16px">
        <div class="form-label">Correlated Evidence Points</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${(selected.evidence || []).map(e => `
            <div style="background:var(--sev-critical-bg);border:1px solid var(--sev-critical-border);color:var(--sev-critical-text);border-radius:var(--radius-sm);padding:8px 12px;font-size:12px">
              ⚠️ ${e}
            </div>
          `).join('') || '<div style="color:var(--text-muted);font-size:12px">Baseline nominal event</div>'}
        </div>
      </div>

      <!-- Telemetry Snapshot at T-0 -->
      <div style="margin-bottom:16px">
        <div class="form-label">Telemetry Snapshot at T-0</div>
        <div class="grid-4">
          <div class="telemetry-tile">
            <span class="tl-label">Gas Level</span>
            <span class="tl-val">${snap.gas_level !== undefined ? snap.gas_level + '%' : '—'}</span>
          </div>
          <div class="telemetry-tile">
            <span class="tl-label">Temperature</span>
            <span class="tl-val">${snap.temperature !== undefined ? snap.temperature + '°C' : '—'}</span>
          </div>
          <div class="telemetry-tile">
            <span class="tl-label">Movement</span>
            <span class="tl-val" style="font-size:14px">${snap.movement ? 'ACTIVE' : 'ABSENT'}</span>
          </div>
          <div class="telemetry-tile">
            <span class="tl-label">Posture</span>
            <span class="tl-val" style="font-size:14px">${snap.posture || 'STANDING'}</span>
          </div>
        </div>
      </div>

      <!-- Directive -->
      <div style="background:var(--primary-light);border:1px solid var(--primary-border);border-radius:var(--radius-md);padding:12px;margin-bottom:16px">
        <div style="font-size:10px;font-weight:700;color:var(--primary);text-transform:uppercase;margin-bottom:4px">OPERATIONAL DIRECTIVE</div>
        <div style="font-size:12px;color:var(--text-primary);line-height:1.4">${selected.recommended_action || 'Inspect area and ensure safety.'}</div>
      </div>

      <!-- Lifecycle Stepper / Transitions -->
      <div>
        <div class="form-label">Incident Lifecycle & Audit Trail</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${transitions.length > 0 ? transitions.map(t => `
            <div style="background:var(--bg-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:8px 12px;display:flex;align-items:center;justify-content:space-between;font-size:11px">
              <span><b>${t.from_status} → ${t.to_status}</b> (${t.performed_by})</span>
              <span class="cell-meta">${ft(t.timestamp)}</span>
            </div>
          `).join('') : `
            <div style="font-size:12px;color:var(--text-muted)">Initial creation state logged. No status changes.</div>
          `}
        </div>
      </div>
    `;
  }

  loadData();
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. AI EXPLANATION — (LOCKED POSITION 4)
// ══════════════════════════════════════════════════════════════════════════════
async function renderAI(el) {
  let incidents = [];
  let selected = null;

  el.innerHTML = `
    <!-- Top Header -->
    <div class="page-header">
      <div class="page-title-wrap">
        <h1 class="page-title">AI Safety Advisory & Synthesis</h1>
        <div class="page-sub">Evidence-based operational narrative synthesis and root-cause safety advisory</div>
      </div>
      <span class="badge badge-neutral" id="ai-mode-pill">DETERMINISTIC SAFETY ADVISORY</span>
    </div>

    <div class="grid-split-7-5">
      <!-- AI Synthesis Report Panel -->
      <div class="card" id="ai-report-card">
        <div class="empty-state">
          <div class="empty-state-icon">🤖</div>
          <div class="empty-state-text">Select an incident from the event list to generate a structured safety analysis report.</div>
        </div>
      </div>

      <!-- Incidents Event Selector -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border-subtle)">
          <div class="card-title">Select Incident to Synthesize</div>
          <div class="card-subtitle">Choose an incident record for operational explanation</div>
        </div>
        <div id="ai-inc-list" style="max-height:calc(100vh - 280px);overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px">
          Loading events…
        </div>
      </div>
    </div>
  `;

  async function loadData() {
    const res = await apiFetch('/api/incidents');
    incidents = res?.incidents || [];
    const listEl = document.getElementById('ai-inc-list');
    if (!listEl) return;

    if (incidents.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No incidents available.</div>';
      return;
    }

    listEl.innerHTML = incidents.map(inc => `
      <div class="card" onclick="selectAiIncident(${inc.id})" style="padding:12px;cursor:pointer;border-color:${selected?.id === inc.id ? 'var(--primary)' : 'var(--border-subtle)'};background:${selected?.id === inc.id ? 'var(--primary-light)' : '#ffffff'}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span class="cell-mono">${inc.incident_code}</span>
          ${badgeHtml(inc.severity)}
        </div>
        <div style="font-weight:700;font-size:12px;color:var(--text-primary)">${inc.incident_type}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${inc.zone} · ${ft(inc.created_at)}</div>
      </div>
    `).join('');

    if (incidents.length > 0) {
      selectAiIncident(incidents[0].id);
    }
  }

  window.selectAiIncident = async (id) => {
    selected = incidents.find(i => i.id === id);
    const reportCard = document.getElementById('ai-report-card');
    if (!reportCard) return;

    reportCard.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⏳</div>
        <div class="empty-state-text">Synthesizing operational safety report for ${selected.incident_code}…</div>
      </div>
    `;

    const adv = await apiFetch(`/api/incidents/${id}/ai-explain`);
    if (!adv) {
      reportCard.innerHTML = '<div class="empty-state">Synthesis generation failed.</div>';
      return;
    }

    const modePill = document.getElementById('ai-mode-pill');
    if (modePill) {
      if (adv.mode === 'GENAI_CONNECTED') {
        modePill.className = 'badge badge-normal';
        modePill.textContent = 'OPENAI GPT-4o-MINI ACTIVE';
      } else {
        modePill.className = 'badge badge-warning';
        modePill.textContent = 'DETERMINISTIC SAFETY ADVISORY — NO LLM KEY CONFIGURED';
      }
    }

    reportCard.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border-subtle)">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text-primary)">${selected.incident_code}: ${selected.incident_type}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Zone: ${selected.zone} · Worker: ${selected.worker_name || 'N/A'} · Severity: ${selected.severity}</div>
        </div>
        <span class="badge ${adv.mode === 'GENAI_CONNECTED' ? 'badge-normal' : 'badge-neutral'}">
          ${adv.mode === 'GENAI_CONNECTED' ? 'LLM Synthesized' : 'Deterministic Advisory'}
        </span>
      </div>

      <!-- Structured Report Sections -->
      <div style="display:flex;flex-direction:column;gap:14px">
        ${(adv.structured_qa || []).map(item => `
          <div style="background:var(--bg-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:14px">
            <div style="font-size:11px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px">
              ${item.q}
            </div>
            <div style="font-size:13px;color:var(--text-primary);line-height:1.5">
              ${item.a}
            </div>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border-subtle);font-size:11px;color:var(--text-muted)">
        Engine: ${adv.engine}
      </div>
    `;
  };

  loadData();
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. ACKNOWLEDGEMENT — (LOCKED POSITION 5)
// ══════════════════════════════════════════════════════════════════════════════
async function renderAcknowledgement(el) {
  el.innerHTML = `
    <!-- Top Header -->
    <div class="page-header">
      <div class="page-title-wrap">
        <h1 class="page-title">Supervisor Incident Acknowledgement</h1>
        <div class="page-sub">5-Stage Response Lifecycle: OPEN → ACKNOWLEDGED → UNDER INVESTIGATION → RESOLVED → CLOSED</div>
      </div>
    </div>

    <!-- 5-Stage Stepper Guide -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div class="card-title">Standard Operating Procedure Lifecycle</div>
        <span class="badge badge-neutral">OSHA Compliance Workflow</span>
      </div>
      <div class="lifecycle-stepper">
        <div class="step-line"></div>
        <div class="step-node">
          <div class="step-circle active">1</div>
          <span class="step-label active">OPEN</span>
        </div>
        <div class="step-node">
          <div class="step-circle">2</div>
          <span class="step-label">ACKNOWLEDGED</span>
        </div>
        <div class="step-node">
          <div class="step-circle">3</div>
          <span class="step-label">INVESTIGATION</span>
        </div>
        <div class="step-node">
          <div class="step-circle">4</div>
          <span class="step-label">RESOLVED</span>
        </div>
        <div class="step-node">
          <div class="step-circle">5</div>
          <span class="step-label">CLOSED</span>
        </div>
      </div>
    </div>

    <!-- Active Action Queue & Audit Log Grid -->
    <div class="grid-2">
      <!-- Action Queue -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Active Action Queue (Open & Acknowledged)</div>
          <span class="badge badge-warning" id="ack-queue-count">Pending</span>
        </div>
        <div id="ack-queue-container" style="display:flex;flex-direction:column;gap:12px">Loading…</div>
      </div>

      <!-- Closed & Archived Incidents -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Resolution & Audit History (Closed)</div>
          <span class="badge badge-normal" id="ack-closed-count">Archived</span>
        </div>
        <div id="ack-history-container" style="display:flex;flex-direction:column;gap:10px">Loading…</div>
      </div>
    </div>
  `;

  async function loadData() {
    const res = await apiFetch('/api/incidents');
    const all = res?.incidents || [];
    const pending = all.filter(i => ['OPEN', 'ACKNOWLEDGED', 'UNDER INVESTIGATION', 'RESOLVED'].includes(i.status));
    const closed = all.filter(i => i.status === 'CLOSED');

    const qCount = document.getElementById('ack-queue-count');
    if (qCount) qCount.textContent = `${pending.length} Pending`;

    const cCount = document.getElementById('ack-closed-count');
    if (cCount) cCount.textContent = `${closed.length} Archived`;

    const queueEl = document.getElementById('ack-queue-container');
    if (queueEl) {
      if (pending.length === 0) {
        queueEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🛡️</div>
            <div class="empty-state-text">Action queue is clear. No unacknowledged incidents.</div>
          </div>
        `;
      } else {
        queueEl.innerHTML = pending.map(inc => `
          <div class="card" style="border-left:4px solid ${inc.severity === 'Critical' ? 'var(--sev-critical)' : inc.severity === 'Warning' ? 'var(--sev-warning)' : 'var(--primary)'};margin-bottom:0">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span class="cell-mono" style="font-size:13px">${inc.incident_code} · ${inc.zone}</span>
              <div style="display:flex;gap:6px">
                ${badgeHtml(inc.severity)}
                <span class="badge badge-neutral">${inc.status}</span>
              </div>
            </div>
            <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px">${inc.incident_type}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">${(inc.evidence || []).join('; ') || 'Baseline exception'}</div>

            <!-- Response Inputs -->
            <div class="grid-2" style="margin-bottom:12px">
              <div>
                <label class="form-label">Responder Name</label>
                <input type="text" class="form-input" id="resp-${inc.id}" value="${inc.acknowledged_by || 'Control Room Supervisor'}" style="padding:6px 10px;font-size:12px"/>
              </div>
              <div>
                <label class="form-label">Action Notes</label>
                <input type="text" class="form-input" id="notes-${inc.id}" placeholder="e.g. Ventilated tank, confirmed safe" style="padding:6px 10px;font-size:12px"/>
              </div>
            </div>

            <!-- Action Transition Buttons -->
            <div class="btn-group">
              ${inc.status === 'OPEN' ? `
                <button class="btn btn-primary btn-sm" onclick="transitionIncident(${inc.id}, 'ACKNOWLEDGED')">
                  ✓ Acknowledge Alert
                </button>
              ` : ''}
              ${inc.status === 'ACKNOWLEDGED' ? `
                <button class="btn btn-secondary btn-sm" onclick="transitionIncident(${inc.id}, 'UNDER INVESTIGATION')">
                  🔍 Dispatch Investigation
                </button>
              ` : ''}
              ${['ACKNOWLEDGED', 'UNDER INVESTIGATION'].includes(inc.status) ? `
                <button class="btn btn-primary btn-sm" style="background:var(--sev-normal);border-color:var(--sev-normal)" onclick="transitionIncident(${inc.id}, 'RESOLVED')">
                  ✅ Mark Resolved
                </button>
              ` : ''}
              ${inc.status === 'RESOLVED' ? `
                <button class="btn btn-secondary btn-sm" onclick="transitionIncident(${inc.id}, 'CLOSED')">
                  🔒 Archive & Close
                </button>
              ` : ''}
            </div>
          </div>
        `).join('');
      }
    }

    const histEl = document.getElementById('ack-history-container');
    if (histEl) {
      if (closed.length === 0) {
        histEl.innerHTML = '<div class="empty-state"><div class="empty-state-text">No closed incidents in audit log.</div></div>';
      } else {
        histEl.innerHTML = closed.map(inc => `
          <div style="background:var(--bg-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 14px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <span class="cell-mono">${inc.incident_code}</span>
              <span class="badge badge-normal">CLOSED</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted)">Resolved by: ${inc.resolved_by || 'Supervisor'} · ${fdt(inc.resolved_at)}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Notes: ${inc.resolution_notes || 'Resolved per procedure'}</div>
          </div>
        `).join('');
      }
    }
  }

  window.transitionIncident = async (id, status) => {
    const resp = document.getElementById(`resp-${id}`)?.value || 'Supervisor';
    const notes = document.getElementById(`notes-${id}`)?.value || `Status advanced to ${status}`;
    await apiFetch('/api/incidents/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incident_id: id,
        new_status: status,
        performed_by: resp,
        action_notes: notes
      })
    });
    loadData();
  };

  loadData();
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. PROFILE / SETTINGS — (LOCKED POSITION 6)
// ══════════════════════════════════════════════════════════════════════════════
async function renderSettings(el) {
  let profiles = [];
  let selectedSlot = 'slot_1';

  el.innerHTML = `
    <!-- Top Header -->
    <div class="page-header">
      <div class="page-title-wrap">
        <h1 class="page-title">Profile Slots & System Configuration</h1>
        <div class="page-sub">Configure the 4 primary profile slots, sensor participation masks, and threshold parameters</div>
      </div>
    </div>

    <!-- EXACTLY 4 PRIMARY PROFILE SLOTS -->
    <div class="grid-4" id="slot-pill-grid" style="margin-bottom:24px"></div>

    <div class="grid-2">
      <!-- Profile Slot Details & Thresholds -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Slot Parameters & Thresholds</div>
          <span class="badge badge-neutral" id="slot-num-badge">SLOT 01</span>
        </div>
        <div id="slot-editor-form">Loading form…</div>
      </div>

      <!-- Sensor Participation Mask -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Sensor Enable / Disable Configuration</div>
          <span class="badge badge-neutral">Masking Logic</span>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">
          Disabled sensors receive state <b>DISABLED</b> and are strictly barred from participating in deterministic severity calculations.
        </p>
        <div id="sensor-toggle-list" style="display:flex;flex-direction:column;gap:8px">Loading toggles…</div>
        <button class="btn btn-primary" style="width:100%;margin-top:20px" onclick="saveActiveSlot()">
          💾 Save Profile Configuration to SQLite
        </button>
      </div>
    </div>
  `;

  async function loadProfiles() {
    const res = await apiFetch('/api/profiles');
    profiles = res?.profiles || [];
    renderSlotCards();
    renderSlotEditor();
  }

  function renderSlotCards() {
    const container = document.getElementById('slot-pill-grid');
    if (!container) return;

    container.innerHTML = profiles.map(p => `
      <div class="card" onclick="selectSlot('${p.id}')" style="cursor:pointer;border-color:${p.id === selectedSlot ? 'var(--primary)' : 'var(--border-subtle)'};background:${p.id === selectedSlot ? 'var(--primary-light)' : '#ffffff'};box-shadow:${p.id === selectedSlot ? 'var(--shadow-sm)' : 'var(--shadow-xs)'}">
        <div style="font-size:10px;font-weight:700;color:var(--primary);text-transform:uppercase">SLOT 0${p.slot_number}</div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin:4px 0">${p.name}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
          <span style="font-size:11px;color:var(--text-muted)">${p.assigned_zone}</span>
          <span class="badge ${p.status === 'ACTIVE' ? 'badge-normal' : 'badge-neutral'}">${p.status}</span>
        </div>
      </div>
    `).join('');
  }

  window.selectSlot = (slotId) => {
    selectedSlot = slotId;
    renderSlotCards();
    renderSlotEditor();
  };

  function renderSlotEditor() {
    const p = profiles.find(x => x.id === selectedSlot) || profiles[0];
    if (!p) return;

    const numBadge = document.getElementById('slot-num-badge');
    if (numBadge) numBadge.textContent = `SLOT 0${p.slot_number}`;

    const formEl = document.getElementById('slot-editor-form');
    if (formEl) {
      formEl.innerHTML = `
        <div class="form-group">
          <label class="form-label">Profile Name</label>
          <input type="text" class="form-input" id="prof-name" value="${p.name}" />
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Assigned Hazard Zone</label>
            <select class="form-select" id="prof-zone">
              ${['Zone 01', 'Zone 02', 'Zone 03', 'Zone 04'].map(z => `<option value="${z}" ${z === p.assigned_zone ? 'selected' : ''}>${z}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Operational Status</label>
            <select class="form-select" id="prof-status">
              <option value="ACTIVE" ${p.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
              <option value="REGISTERED" ${p.status === 'REGISTERED' ? 'selected' : ''}>REGISTERED</option>
              <option value="INACTIVE" ${p.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option>
            </select>
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Gas Warning Limit (%)</label>
            <input type="number" class="form-input" id="th-gas-warn" value="${p.thresholds?.gas_warning || 25}" />
          </div>
          <div class="form-group">
            <label class="form-label">Gas Critical Limit (%)</label>
            <input type="number" class="form-input" id="th-gas-crit" value="${p.thresholds?.gas_critical || 55}" />
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Temp Warning Limit (°C)</label>
            <input type="number" class="form-input" id="th-temp-warn" value="${p.thresholds?.temp_warning || 35}" />
          </div>
          <div class="form-group">
            <label class="form-label">Temp Critical Limit (°C)</label>
            <input type="number" class="form-input" id="th-temp-crit" value="${p.thresholds?.temp_critical || 48}" />
          </div>
        </div>
      `;
    }

    // Render sensor toggles
    const allSensors = ['gas', 'temperature', 'humidity', 'movement', 'camera'];
    const togglesEl = document.getElementById('sensor-toggle-list');
    const enabled = p.enabled_sensors || p.inputs || [];

    if (togglesEl) {
      togglesEl.innerHTML = allSensors.map(s => {
        const isChecked = enabled.includes(s);
        return `
          <label style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-subtle);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 14px;cursor:pointer">
            <div>
              <span style="font-weight:700;font-size:12px;text-transform:uppercase">${s} SENSOR</span>
              <div style="font-size:11px;color:var(--text-muted)">State: ${isChecked ? 'ACTIVE' : 'DISABLED'}</div>
            </div>
            <input type="checkbox" id="sens-${s}" ${isChecked ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary)" />
          </label>
        `;
      }).join('');
    }
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
        gas_warning: parseFloat(document.getElementById('th-gas-warn')?.value) || 25.0,
        gas_critical: parseFloat(document.getElementById('th-gas-crit')?.value) || 55.0,
        temp_warning: parseFloat(document.getElementById('th-temp-warn')?.value) || 35.0,
        temp_critical: parseFloat(document.getElementById('th-temp-crit')?.value) || 48.0
      }
    };

    await apiFetch(`/api/profiles/${selectedSlot}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    alert('Profile slot updated and persisted to SQLite WAL database.');
    loadProfiles();
  };

  loadProfiles();
}

// ── INITIAL BOOT ─────────────────────────────────────────────────────────────
initClock();
buildNav();

(async () => {
  const isAuthed = await checkAuthSession();
  if (isAuthed && currentUser) {
    if (currentUser.role === 'SAFETY_OPERATIONS') {
      navigate('monitoring');
    } else {
      navigate('dashboard');
    }
  } else {
    renderCurrentPage();
  }
})();
