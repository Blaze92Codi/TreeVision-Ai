/* ═══════════════════════════════════════════════════════════════
   TreeVision AI — Company Portal Script
   Handles all portal tabs: Dashboard, New Lead, Approvals, Metering, Account.
   Auth: requires Supabase session — redirects to login.html if not signed in.
   Approvals tab fetches live estimates and calls send-quote Edge Function.
═══════════════════════════════════════════════════════════════ */

/* ── CONFIG ──────────────────────────────────────────────────────────────── */
const CONFIG = {
  SUPABASE_URL:    "https://hydlxwjtdkzcnxxukakt.supabase.co",
  SUPABASE_KEY:    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZGx4d2p0ZGt6Y254eHVrYWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODcyNjQsImV4cCI6MjA5NTI2MzI2NH0.vXLOWjXh_6z8sSoBVqKA6wwwEKKMozjhRoIIUffwnzI",
  SEND_QUOTE_URL:  "https://hydlxwjtdkzcnxxukakt.supabase.co/functions/v1/send-quote",
  SAVE_URL:        "https://hydlxwjtdkzcnxxukakt.supabase.co/functions/v1/save-estimate",
  PROXY_URL:       "https://hydlxwjtdkzcnxxukakt.supabase.co/functions/v1/analyze",
  COMPANY_NAME:    "Dynamic Tree Service",
};

/* ══════════════════════════════════════════════════════════════════════════
   SUPABASE LOADER
   Injects the Supabase SDK if not already present, then boots the portal.
══════════════════════════════════════════════════════════════════════════ */
function loadSupabase(cb) {
  if (window.supabase && typeof window.supabase.createClient === "function") {
    cb(); return;
  }
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  s.onload = cb;
  s.onerror = () => { document.body.innerHTML = '<p style="padding:2rem;color:#c00">Failed to load Supabase SDK. Check your connection.</p>'; };
  document.head.appendChild(s);
}

loadSupabase(bootPortal);

/* ══════════════════════════════════════════════════════════════════════════
   BOOT — called after Supabase SDK is ready
══════════════════════════════════════════════════════════════════════════ */
function bootPortal() {
  const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

  /* ── Auth guard ─────────────────────────────────────────────────────────── */
  async function requireAuth() {
    const { data } = await _sb.auth.getSession();
    if (!data.session) {
      window.location.replace("login.html");
      throw new Error("Not authenticated");
    }
    return data.session;
  }

  requireAuth().then((session) => {
    const userEmailEl = document.getElementById("portalUserEmail");
    if (userEmailEl) userEmailEl.textContent = session.user.email || "";
    initPortal(_sb);
  });

  /* ── Sign-out ────────────────────────────────────────────────────────────── */
  const signOutBtn = document.getElementById("signOutBtn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      await _sb.auth.signOut();
      window.location.replace("login.html");
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   PORTAL INIT — called only after auth passes
══════════════════════════════════════════════════════════════════════════ */
function initPortal(_sb) {

/* ── In-memory demo state (Dashboard / New Lead tabs) ───────────────────── */
const state = {
  usedScans: 38,
  scanLimit: 100,
  jobs: [
    { id: "TV-1048", client: "Sarah Johnson",    address: "Maple Ridge Dr",       work: "Trim away from house",   status: "Needs Review",        risk: "Medium", estimate: "$650-$950" },
    { id: "TV-1047", client: "Henderson Realty", address: "Oak Street rental",     work: "Remove dead limbs",      status: "Approved",            risk: "Low",    estimate: "$425-$675" },
    { id: "TV-1046", client: "Mike B.",          address: "Cedar Court",           work: "Storm damage review",    status: "Site Visit Required", risk: "High",   estimate: "Field quote" },
  ],
  usage: [
    { user: "Owner",     role: "Admin",      scans: 17, active: "Today" },
    { user: "Crew Lead", role: "Estimator",  scans: 14, active: "Yesterday" },
    { user: "Office",    role: "Dispatcher", scans:  7, active: "May 18" },
  ],
};

const viewTitles = {
  dashboard: "Dashboard",
  newJob:    "New Photo Scan",
  approvals: "Client Approvals",
  metering:  "Usage Meter",
  account:   "Account",
};

/* ── DOM refs ───────────────────────────────────────────────────────────── */
const navItems       = document.querySelectorAll("[data-view], [data-view-link]");
const views          = document.querySelectorAll(".view");
const viewTitle      = document.getElementById("viewTitle");
const jobList        = document.getElementById("jobList");
const approvalList   = document.getElementById("approvalList");
const usageRows      = document.getElementById("usageRows");
const scanForm       = document.getElementById("scanForm");
const scanPhoto      = document.getElementById("scanPhoto");
const uploadPreview  = document.getElementById("uploadPreview");
const uploadedPhotoPreview = document.getElementById("uploadedPhotoPreview");
const seedJob        = document.getElementById("seedJob");
const exportUsage    = document.getElementById("exportUsage");
const companyName    = document.getElementById("companyName");
const scanLimit      = document.getElementById("scanLimit");

/* ── View switching ─────────────────────────────────────────────────────── */
function setView(viewName) {
  views.forEach((v) => v.classList.toggle("active", v.id === viewName));
  document.querySelectorAll("[data-view]").forEach((item) =>
    item.classList.toggle("active", item.dataset.view === viewName));
  if (viewTitle) viewTitle.textContent = viewTitles[viewName] || "Portal";
  if (viewName === "approvals") loadApprovalsFromDB();
}

/* ── Dashboard job list ─────────────────────────────────────────────────── */
function renderJobs() {
  if (!jobList) return;
  jobList.innerHTML = state.jobs.map((job) => `
    <div class="job-row">
      <div>
        <strong>${job.id} · ${job.client}</strong>
        <small>${job.address} · ${job.work} · ${job.estimate}</small>
      </div>
      <span class="status-pill ${job.risk === "High" ? "danger" : job.status === "Needs Review" ? "warn" : ""}">${job.status}</span>
    </div>
  `).join("");
  const mp = document.getElementById("metricPending");
  if (mp) mp.textContent = state.jobs.filter((j) => j.status !== "Approved").length;
}

/* ── Usage meter ────────────────────────────────────────────────────────── */
function renderUsage() {
  const pct = Math.min(100, Math.round((state.usedScans / state.scanLimit) * 100));
  const $ = (id) => document.getElementById(id);
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const setW = (id, w) => { const el = $(id); if (el) el.style.width = w; };
  set("usedCount", state.usedScans); set("usedCountSide", state.usedScans);
  set("limitCountSide", state.scanLimit); set("remainingCount", Math.max(0, state.scanLimit - state.usedScans));
  set("metricScans", state.usedScans); setW("miniMeterFill", `${pct}%`); setW("bigMeterFill", `${pct}%`);
  const sm = document.querySelector("#metricScans + small");
  if (sm) sm.textContent = `${Math.max(0, state.scanLimit - state.usedScans)} remaining on current plan`;
  if (usageRows) usageRows.innerHTML = state.usage.map((r) =>
    `<tr><td>${r.user}</td><td>${r.role}</td><td>${r.scans}</td><td>${r.active}</td></tr>`).join("");
}

/* ══════════════════════════════════════════════════════════════════════════
   APPROVALS TAB — live Supabase data
══════════════════════════════════════════════════════════════════════════ */
async function loadApprovalsFromDB() {
  if (!approvalList) return;
  approvalList.innerHTML = '<p style="padding:1rem;color:#666">Loading estimates…</p>';
  try {
    const res = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/estimates?select=id,customer_name,customer_email,service_type,approved_quote_low,approved_quote_high,status,created_at&status=in.(pending,approved,scheduled)&order=created_at.desc&limit=50`,
      { headers: { apikey: CONFIG.SUPABASE_KEY, Authorization: "Bearer " + CONFIG.SUPABASE_KEY, Accept: "application/json" } }
    );
    if (!res.ok) throw new Error("HTTP " + res.status);
    const rows = await res.json();
    if (!rows.length) {
      approvalList.innerHTML = '<p style="padding:1rem;color:#666">No pending estimates. Customer submissions will appear here.</p>';
      return;
    }
    approvalList.innerHTML = rows.map((est) => {
      const range = (est.approved_quote_low && est.approved_quote_high)
        ? `$${est.approved_quote_low}–$${est.approved_quote_high}` : "Pending";
      const canSend = est.status === "approved" || est.status === "scheduled";
      return `
        <div class="approval-row" id="row-${est.id}">
          <div>
            <strong>${est.customer_name || "Unknown"}</strong>
            <small>${est.service_type || "Tree service"} · <em>${est.customer_email || "no email"}</em> · ${range}</small>
          </div>
          <span class="status-pill ${est.status === "pending" ? "warn" : ""}" style="margin-right:.5rem">${est.status}</span>
          ${canSend
            ? `<button class="secondary-btn send-quote-btn" type="button" data-id="${est.id}" data-email="${est.customer_email || ''}">Send Quote</button>`
            : `<button class="secondary-btn" type="button" disabled>Awaiting Approval</button>`}
        </div>`;
    }).join("");
    approvalList.querySelectorAll(".send-quote-btn").forEach((b) => b.addEventListener("click", () => handleSendQuote(b)));
  } catch (err) {
    approvalList.innerHTML = `<p style="padding:1rem;color:#c00">Failed to load: ${err.message}</p>`;
  }
}

async function handleSendQuote(btn) {
  const id = btn.dataset.id, email = btn.dataset.email;
  if (!email) { alert("No customer email on this estimate."); return; }
  if (!confirm(`Send quote email to ${email}?`)) return;
  btn.disabled = true; btn.textContent = "Sending…";
  try {
    const res = await fetch(CONFIG.SEND_QUOTE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + CONFIG.SUPABASE_KEY },
      body: JSON.stringify({ estimate_id: id, approvedBy: "Manager" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      btn.textContent = "✓ Sent"; btn.style.background = "#2d6a2d"; btn.style.color = "#fff";
      const pill = document.querySelector("#row-" + id + " .status-pill");
      if (pill) { pill.textContent = "sent"; pill.classList.remove("warn"); }
    } else {
      btn.disabled = false; btn.textContent = "Send Quote";
      alert("Error: " + (data.error || res.status));
    }
  } catch (err) { btn.disabled = false; btn.textContent = "Send Quote"; alert("Network error: " + err.message); }
}

/* ── Demo: add job ──────────────────────────────────────────────────────── */
function addJob({ client, address, work, priority }) {
  const hi = priority === "Emergency" || /removal|storm|dead/i.test(work);
  state.jobs.unshift({ id: `TV-${1050 + state.jobs.length}`, client, address, work,
    status: hi ? "Site Visit Required" : "Needs Review", risk: hi ? "High" : "Medium",
    estimate: hi ? "Field quote" : "$575-$875" });
  state.usedScans++; state.usage[1].scans++; state.usage[1].active = "Just now";
  renderJobs(); renderUsage();
}

/* ── Event listeners ────────────────────────────────────────────────────── */
navItems.forEach((item) => item.addEventListener("click", () => setView(item.dataset.view || item.dataset.viewLink)));

if (scanPhoto) scanPhoto.addEventListener("change", () => {
  const f = scanPhoto.files?.[0];
  if (!f) { if (uploadPreview) uploadPreview.hidden = true; return; }
  if (uploadedPhotoPreview) uploadedPhotoPreview.src = URL.createObjectURL(f);
  if (uploadPreview) uploadPreview.hidden = false;
});

if (scanForm) {
  scanForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addJob({ client: document.getElementById("clientName")?.value.trim() || "New Customer",
             address: document.getElementById("jobAddress")?.value.trim() || "Address pending",
             work: document.getElementById("workType")?.value,
             priority: document.getElementById("priority")?.value });
    scanForm.reset(); if (uploadPreview) uploadPreview.hidden = true; setView("dashboard");
  });
  scanForm.addEventListener("reset", () => { if (uploadPreview) uploadPreview.hidden = true; });
}

if (seedJob) seedJob.addEventListener("click", () =>
  addJob({ client: "Demo Customer", address: "New lead from portal", work: "Raise canopy", priority: "Routine" }));

if (exportUsage) exportUsage.addEventListener("click", () => {
  const rows = [["Company","User","Role","Scans","Last Active"],
    ...state.usage.map((r) => [document.getElementById("companyNameSide")?.textContent || CONFIG.COMPANY_NAME, r.user, r.role, r.scans, r.active])];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"','""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  Object.assign(document.createElement("a"), { href: url, download: "treevision-usage.csv" }).click();
  URL.revokeObjectURL(url);
});

if (companyName) companyName.addEventListener("input", () => {
  const el = document.getElementById("companyNameSide"); if (el) el.textContent = companyName.value || "Company"; });

if (scanLimit) scanLimit.addEventListener("input", () => { state.scanLimit = Number(scanLimit.value) || 100; renderUsage(); });

/* ── Initial render ─────────────────────────────────────────────────────── */
renderJobs();
renderUsage();

} // end initPortal()
