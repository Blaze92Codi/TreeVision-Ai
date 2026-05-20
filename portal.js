const state = {
  usedScans: 38,
  scanLimit: 100,
  jobs: [
    {
      id: "TV-1048",
      client: "Sarah Johnson",
      address: "Maple Ridge Dr",
      work: "Trim away from house",
      status: "Needs Review",
      risk: "Medium",
      estimate: "$650-$950",
    },
    {
      id: "TV-1047",
      client: "Henderson Realty",
      address: "Oak Street rental",
      work: "Remove dead limbs",
      status: "Approved",
      risk: "Low",
      estimate: "$425-$675",
    },
    {
      id: "TV-1046",
      client: "Mike B.",
      address: "Cedar Court",
      work: "Storm damage review",
      status: "Site Visit Required",
      risk: "High",
      estimate: "Field quote",
    },
  ],
  usage: [
    { user: "Owner", role: "Admin", scans: 17, active: "Today" },
    { user: "Crew Lead", role: "Estimator", scans: 14, active: "Yesterday" },
    { user: "Office", role: "Dispatcher", scans: 7, active: "May 18" },
  ],
};

const viewTitles = {
  dashboard: "Dashboard",
  newJob: "New Photo Scan",
  approvals: "Client Approvals",
  metering: "Usage Meter",
  account: "Account",
};

const navItems = document.querySelectorAll("[data-view], [data-view-link]");
const views = document.querySelectorAll(".view");
const viewTitle = document.getElementById("viewTitle");
const jobList = document.getElementById("jobList");
const approvalList = document.getElementById("approvalList");
const usageRows = document.getElementById("usageRows");
const scanForm = document.getElementById("scanForm");
const scanPhoto = document.getElementById("scanPhoto");
const uploadPreview = document.getElementById("uploadPreview");
const uploadedPhotoPreview = document.getElementById("uploadedPhotoPreview");
const seedJob = document.getElementById("seedJob");
const exportUsage = document.getElementById("exportUsage");
const companyName = document.getElementById("companyName");
const scanLimit = document.getElementById("scanLimit");

function setView(viewName) {
  views.forEach((view) => view.classList.toggle("active", view.id === viewName));
  document.querySelectorAll("[data-view]").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewName);
  });
  viewTitle.textContent = viewTitles[viewName] || "Portal";
}

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

  approvalList.innerHTML = state.jobs.map((job) => `
    <div class="approval-row">
      <div>
        <strong>${job.client}</strong>
        <small>${job.work} · Risk: ${job.risk} · Estimate: ${job.estimate}</small>
      </div>
      <button class="secondary-btn" type="button">Review Package</button>
    </div>
  `).join("");

  document.getElementById("metricPending").textContent = state.jobs
    .filter((job) => job.status !== "Approved").length;
}

function renderUsage() {
  const percent = Math.min(100, Math.round((state.usedScans / state.scanLimit) * 100));
  document.getElementById("usedCount").textContent = state.usedScans;
  document.getElementById("usedCountSide").textContent = state.usedScans;
  document.getElementById("limitCountSide").textContent = state.scanLimit;
  document.getElementById("remainingCount").textContent = Math.max(0, state.scanLimit - state.usedScans);
  document.getElementById("metricScans").textContent = state.usedScans;
  document.getElementById("miniMeterFill").style.width = `${percent}%`;
  document.getElementById("bigMeterFill").style.width = `${percent}%`;

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

function addJob({ client, address, work, priority }) {
  const nextId = `TV-${1050 + state.jobs.length}`;
  const highRisk = priority === "Emergency" || /removal|storm|dead/i.test(work);
  state.jobs.unshift({
    id: nextId,
    client,
    address,
    work,
    status: highRisk ? "Site Visit Required" : "Needs Review",
    risk: highRisk ? "High" : "Medium",
    estimate: highRisk ? "Field quote" : "$575-$875",
  });
  state.usedScans += 1;
  state.usage[1].scans += 1;
  state.usage[1].active = "Just now";
  renderJobs();
  renderUsage();
}

navItems.forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view || item.dataset.viewLink));
});

scanPhoto.addEventListener("change", () => {
  const file = scanPhoto.files && scanPhoto.files[0];
  if (!file) {
    uploadPreview.hidden = true;
    return;
  }
  uploadedPhotoPreview.src = URL.createObjectURL(file);
  uploadPreview.hidden = false;
});

scanForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addJob({
    client: document.getElementById("clientName").value.trim() || "New Customer",
    address: document.getElementById("jobAddress").value.trim() || "Address pending",
    work: document.getElementById("workType").value,
    priority: document.getElementById("priority").value,
  });
  scanForm.reset();
  uploadPreview.hidden = true;
  setView("dashboard");
});

scanForm.addEventListener("reset", () => {
  uploadPreview.hidden = true;
});

seedJob.addEventListener("click", () => {
  addJob({
    client: "Demo Customer",
    address: "New lead from portal",
    work: "Raise canopy",
    priority: "Routine",
  });
});

exportUsage.addEventListener("click", () => {
  const rows = [
    ["Company", "User", "Role", "Scans", "Last Active"],
    ...state.usage.map((row) => [
      document.getElementById("companyNameSide").textContent,
      row.user,
      row.role,
      row.scans,
      row.active,
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
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

renderJobs();
renderUsage();
