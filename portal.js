/* ═══════════════════════════════════════════════════════════════
   TreeVision AI — Company Portal Script
   Handles all portal tabs: Dashboard, New Lead, Approvals, Metering, Account.
   Approvals tab now fetches live estimates from Supabase and calls
   the send-quote Edge Function when the manager clicks "Send Quote".
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

/* ── In-memory demo state (used for Dashboard / New Lead tabs) ──────────── */
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
  views.forEach((view) => view.classList.toggle("active", view.id === viewName));
  document.querySelectorAll("[data-view]").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewName);
  });
  viewTitle.textContent = viewTitles[viewName] || "Portal";
  if (viewName === "approvals") loadApprovalsFromDB();
}

/* ── Dashboard job list (demo data) ─────────────────────────────────────── */
function renderJobs() {
  jobList.innerHTML = state.jobs.map((job) => `
    <div class="job-row">
      <div>
        <strong>${job.id} · ${job.client}</strong>
        <small>${job.address} · ${job.work} · ${job.estimate}</small>
      </div>
      <span class="status-pill ${job.risk === "High" ? "danger" : job.status === "Needs Review" ? "warn" : ""}">${job.status}</span>
    </div>
  `).join("");

  document.getElementById("metricPending").textContent = state.jobs
    .filter((job) => job.status !== "Approved").length;
}

/* ── Usage meter ────────────────────────────────────────────────────────── */
function renderUsage() {
  const percent = Math.min(100, Math.round((state.usedScans / state.scanLimit) * 100));
  document.getElementById("usedCount").textContent          = state.usedScans;
  document.getElementById("usedCountSide").textContent      = state.usedScans;
  document.getElementById("limitCountSide").textContent     = state.scanLimit;
  document.getElementById("remainingCount").textContent     = Math.max(0, state.scanLimit - state.usedScans);
  document.getElementById("metricScans").textContent        = state.usedScans;
  document.getElementById("miniMeterFill").style.width      = `${percent}%`;
  document.getElementById("bigMeterFill").style.width       = `${percent}%`;

  const metricScanSmall = document.querySelector("#metricScans + small");
  if (metricScanSmall) {
    metricScanSmall.textContent = `${Math.max(0, state.scanLimit - state.usedScans)} remaining on current plan`;
  }

  usageRows.innerHTML = state.usage.map((row) => `
    <tr>
      <td>${row.user}</td>
      <td>${row.role}</td>
      <td>${row.scans}</td>
      <td>${row.active}</td>
    </tr>
  `).join("");
}

/* ══════════════════════════════════════════════════════════════════════════
   APPROVALS TAB — Live data from Supabase
══════════════════════════════════════════════════════════════════════════ */

/**
 * Fetch estimates with status 'pending' or 'approved' from Supabase,
 * then render them in the Approvals list with a "Send Quote" button.
 */
async function loadApprovalsFromDB() {
  if (!approvalList) return;
  approvalList.innerHTML = '<p style="padding:1rem;color:#666;">Loading estimates…</p>';

  try {
    const res = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/estimates?select=id,customer_name,customer_email,service_type,approved_quote_low,approved_quote_high,status,created_at&status=in.(pending,approved,scheduled)&order=created_at.desc&limit=50`,
      {
        headers: {
          "apikey":        CONFIG.SUPABASE_KEY,
          "Authorization": "Bearer " + CONFIG.SUPABASE_KEY,
          "Accept":        "application/json",
        },
      }
    );

    if (!res.ok) throw new Error("HTTP " + res.status);
    const rows = await res.json();

    if (!rows.length) {
      approvalList.innerHTML = '<p style="padding:1rem;color:#666;">No pending estimates. New customer submissions will appear here.</p>';
      return;
    }

    approvalList.innerHTML = rows.map((est) => {
      const lowHigh = (est.approved_quote_low && est.approved_quote_high)
        ? `$${est.approved_quote_low}–$${est.approved_quote_high}`
        : "Estimate pending";
      const statusClass = est.status === "approved" ? "" : est.status === "pending" ? "warn" : "";
      const canSend = est.status === "approved" || est.status === "scheduled";
      return `
        <div class="approval-row" id="row-${est.id}">
          <div>
            <strong>${est.customer_name || "Unknown"}</strong>
            <small>
              ${est.service_type || "Tree service"} ·
              <em>${est.customer_email || "no email"}</em> ·
              Estimate: ${lowHigh}
            </small>
          </div>
          <span class="status-pill ${statusClass}" style="margin-right:.5rem">${est.status}</span>
          ${canSend
            ? `<button class="secondary-btn send-quote-btn" type="button" data-id="${est.id}" data-email="${est.customer_email || ''}">Send Quote</button>`
            : `<button class="secondary-btn" type="button" disabled title="Set status to approved first">Awaiting Approval</button>`
          }
        </div>
      `;
    }).join("");

    // Wire up all Send Quote buttons
    approvalList.querySelectorAll(".send-quote-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleSendQuote(btn));
    });

  } catch (err) {
    approvalList.innerHTML = `<p style="padding:1rem;color:#c00;">Failed to load estimates: ${err.message}</p>`;
  }
}

/**
 * Call the send-quote Edge Function for a given estimate row.
 * Disables the button while in-flight, shows success/error inline.
 */
async function handleSendQuote(btn) {
  const estimateId = btn.dataset.id;
  const email      = btn.dataset.email;

  if (!email) {
    alert("This estimate has no customer email — cannot send quote.");
    return;
  }

  const confirmed = window.confirm(
    `Send quote email to ${email}?\n\nThis will mark the estimate as sent and email the customer their price range.`
  );
  if (!confirmed) return;

  btn.disabled = true;
  btn.textContent = "Sending…";

  try {
    const res = await fetch(CONFIG.SEND_QUOTE_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + CONFIG.SUPABASE_KEY,
      },
      body: JSON.stringify({ estimate_id: estimateId, approvedBy: "Manager" }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      btn.textContent = "✓ Sent";
      btn.style.background = "#2d6a2d";
      btn.style.color = "#fff";
      // Update the status pill in this row
      const row = document.getElementById("row-" + estimateId);
      const pill = row && row.querySelector(".status-pill");
      if (pill) { pill.textContent = "sent"; pill.classList.remove("warn"); }
    } else {
      btn.disabled = false;
      btn.textContent = "Send Quote";
      alert("Error sending quote: " + (data.error || res.status));
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Send Quote";
    alert("Network error: " + err.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Demo: add a job (New Lead tab)
══════════════════════════════════════════════════════════════════════════ */
function addJob({ client, address, work, priority }) {
  const nextId  = `TV-${1050 + state.jobs.length}`;
  const highRisk = priority === "Emergency" || /removal|storm|dead/i.test(work);
  state.jobs.unshift({
    id:       nextId,
    client,
    address,
    work,
    status:   highRisk ? "Site Visit Required" : "Needs Review",
    risk:     highRisk ? "High" : "Medium",
    estimate: highRisk ? "Field quote" : "$575-$875",
  });
  state.usedScans     += 1;
  state.usage[1].scans += 1;
  state.usage[1].active = "Just now";
  renderJobs();
  renderUsage();
}

/* ── Event listeners ────────────────────────────────────────────────────── */
navItems.forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view || item.dataset.viewLink));
});

scanPhoto.addEventListener("change", () => {
  const file = scanPhoto.files && scanPhoto.files[0];
  if (!file) { uploadPreview.hidden = true; return; }
  uploadedPhotoPreview.src = URL.createObjectURL(file);
  uploadPreview.hidden = false;
});

scanForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addJob({
    client:   document.getElementById("clientName").value.trim()  || "New Customer",
    address:  document.getElementById("jobAddress").value.trim()  || "Address pending",
    work:     document.getElementById("workType").value,
    priority: document.getElementById("priority").value,
  });
  scanForm.reset();
  uploadPreview.hidden = true;
  setView("dashboard");
});

scanForm.addEventListener("reset", () => { uploadPreview.hidden = true; });

seedJob.addEventListener("click", () => {
  addJob({ client: "Demo Customer", address: "New lead from portal", work: "Raise canopy", priority: "Routine" });
});

exportUsage.addEventListener("click", () => {
  const rows = [
    ["Company", "User", "Role", "Scans", "Last Active"],
    ...state.usage.map((row) => [
      document.getElementById("companyNameSide").textContent,
      row.user, row.role, row.scans, row.active,
    ]),
  ];
  const csv  = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = "treevision-usage.csv";
  link.click();
  URL.revokeObjectURL(url);
});

companyName.addEventListener("input", () => {
  document.getElementById("companyNameSide").textContent = companyName.value || "Company";
});

scanLimit.addEventListener("input", () => {
  state.scanLimit = Number(scanLimit.value) || 100;
  renderUsage();
});

/* ── Initial render ─────────────────────────────────────────────────────── */
renderJobs();
renderUsage();
