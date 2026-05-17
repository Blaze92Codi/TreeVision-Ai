/*
  TreeVision Canopy Trim Estimator
  Static browser version: no build step, no dependencies.

  This tool provides a preliminary estimate range only.
  It should be calibrated with company rates and completed job history.
*/

const DEFAULT_RATES = {
  laborRatePerCrewHour: 185,
  travelBaseCharge: 65,
  fuelCharge: 35,
  equipmentBaseCharge: 75,
  disposalPerCubicYard: 45,
  materialCharge: 15,
  overheadPercent: 0.18,
  profitMarginPercent: 0.22,
  minimumJobCharge: 350,
};

const SITE_VISIT_KEYWORDS = [
  "power line",
  "power lines",
  "wire",
  "wires",
  "service drop",
  "transformer",
  "storm",
  "hanging limb",
  "hanging limbs",
  "dead limb",
  "dead limbs",
  "dead tree",
  "split",
  "crack",
  "lean",
  "uproot",
  "roof",
  "over house",
  "pool",
  "road",
  "sidewalk",
  "neighbor",
  "tight access",
  "fence",
  "septic",
  "gas",
  "fiber",
  "irrigation",
  "underground",
  "public right of way",
];

function money(value) {
  return Math.round(value / 5) * 5;
}

function formatMoney(value) {
  return `$${Number(value).toLocaleString()}`;
}

function includesAny(text, keywords) {
  const normalized = String(text || "").toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function classifyService(requestedWork, concerns) {
  const request = String(requestedWork || "").toLowerCase();
  const combined = `${requestedWork} ${concerns}`.toLowerCase();

  if (
    includesAny(combined, [
      "storm",
      "hanging",
      "split",
      "crack",
      "severe lean",
      "dead tree",
      "emergency",
    ])
  ) {
    return "Hazard / Storm Damage Review";
  }

  if (
    includesAny(combined, [
      "power line",
      "power lines",
      "wires",
      "service drop",
      "transformer",
    ])
  ) {
    return "Site Visit Required";
  }

  if (
    includesAny(request, [
      "reduce",
      "cut back",
      "overhang",
      "reduction",
      "too big",
    ])
  ) {
    return "Reduction / Cutback";
  }

  if (
    includesAny(request, [
      "house",
      "roof",
      "driveway",
      "sidewalk",
      "clearance",
      "raise canopy",
      "lift canopy",
      "away from",
    ])
  ) {
    return "Structural / Clearance Trim";
  }

  if (
    includesAny(request, [
      "shape",
      "light trim",
      "clean up",
      "thin",
      "balance",
    ])
  ) {
    return "Light Trim";
  }

  return "Structural / Clearance Trim";
}

function determineScopeConfidence(photoScore) {
  if (photoScore === "Excellent") return "High";
  if (photoScore === "Usable") return "Medium";
  return "Low";
}

function determineRiskLevel(input, servicePreset) {
  const concerns = input.customerAnswers.accessUtilitySafetyConcerns;
  const photo = input.photo;
  const size = input.estimateAnswers.treeSizeClass;
  const access = input.estimateAnswers.accessClass;
  const targetDistance = Number(input.estimateAnswers.nearestTargetDistanceFeet);

  if (!photo.uploaded || photo.score === "Not Quote-Ready") return "Site Visit Required";
  if (!photo.fullTreeVisible || !photo.trunkBaseVisible || !photo.workAreaVisible) {
    return "Site Visit Required";
  }

  if (servicePreset === "Site Visit Required" || servicePreset === "Hazard / Storm Damage Review") {
    return "Site Visit Required";
  }

  if (includesAny(concerns, SITE_VISIT_KEYWORDS)) return "Site Visit Required";

  if (size === "Very Large" || access === "Tight") return "High";
  if (!Number.isNaN(targetDistance) && targetDistance <= 10) return "High";
  if (!Number.isNaN(targetDistance) && targetDistance <= 25) return "Medium";
  if (size === "Large" || access === "Moderate") return "Medium";

  return "Low";
}

function estimateCrewHours(servicePreset, size, access, photoScore) {
  const baseBySize = {
    Small: 1.5,
    Medium: 3,
    Large: 5,
    "Very Large": 7,
  };

  const serviceMultiplier = {
    "Light Trim": 0.85,
    "Structural / Clearance Trim": 1.15,
    "Reduction / Cutback": 1.45,
    "Hazard / Storm Damage Review": 1.9,
    "Site Visit Required": 1.6,
  };

  const accessMultiplier = {
    Easy: 1,
    Moderate: 1.2,
    Tight: 1.55,
  };

  const photoMultiplier = {
    Excellent: 1,
    Usable: 1.1,
    Limited: 1.25,
    "Not Quote-Ready": 1.4,
  };

  return (
    baseBySize[size] *
    serviceMultiplier[servicePreset] *
    accessMultiplier[access] *
    photoMultiplier[photoScore]
  );
}

function estimateDebrisYards(servicePreset, size, cleanup) {
  if (cleanup === "Leave debris onsite" || cleanup === "Customer handles cleanup") return 0;

  const baseDebris = {
    Small: 1,
    Medium: 2.5,
    Large: 5,
    "Very Large": 7,
  };

  const serviceDebrisMultiplier = {
    "Light Trim": 0.7,
    "Structural / Clearance Trim": 1,
    "Reduction / Cutback": 1.4,
    "Hazard / Storm Damage Review": 1.5,
    "Site Visit Required": 1.2,
  };

  return baseDebris[size] * serviceDebrisMultiplier[servicePreset];
}

function riskBufferPercent(riskLevel) {
  switch (riskLevel) {
    case "Low":
      return 0.05;
    case "Medium":
      return 0.12;
    case "High":
      return 0.22;
    default:
      return 0.3;
  }
}

function confidenceBandPercent(photoScore, riskLevel) {
  if (riskLevel === "Site Visit Required") return 0.35;
  if (riskLevel === "High") return 0.28;
  if (photoScore === "Limited") return 0.3;
  if (photoScore === "Usable") return 0.22;
  return 0.16;
}

function pricingConfidence(photoScore, riskLevel) {
  if (riskLevel === "Site Visit Required" || photoScore === "Limited" || photoScore === "Not Quote-Ready") {
    return "Low";
  }
  if (riskLevel === "High" || photoScore === "Usable") return "Medium";
  return "High";
}

function buildEstimate(input, rates = DEFAULT_RATES) {
  const servicePreset = classifyService(
    input.customerAnswers.requestedWork,
    input.customerAnswers.accessUtilitySafetyConcerns
  );

  const riskLevel = determineRiskLevel(input, servicePreset);
  const siteVisitRequired = riskLevel === "Site Visit Required";

  const hours = estimateCrewHours(
    servicePreset,
    input.estimateAnswers.treeSizeClass,
    input.estimateAnswers.accessClass,
    input.photo.score
  );

  const debrisYards = estimateDebrisYards(
    servicePreset,
    input.estimateAnswers.treeSizeClass,
    input.customerAnswers.cleanupPreference
  );

  const labor = hours * rates.laborRatePerCrewHour;
  const travel = rates.travelBaseCharge;
  const fuel = rates.fuelCharge;
  const equipment = rates.equipmentBaseCharge * (input.estimateAnswers.accessClass === "Tight" ? 1.35 : 1);
  const disposal = debrisYards * rates.disposalPerCubicYard;
  const materials = rates.materialCharge;

  const subtotalBeforeOverhead = labor + travel + fuel + equipment + disposal + materials;
  const overhead = subtotalBeforeOverhead * rates.overheadPercent;
  const riskBuffer = subtotalBeforeOverhead * riskBufferPercent(riskLevel);
  const subtotalBeforeProfit = subtotalBeforeOverhead + overhead + riskBuffer;
  const profit = subtotalBeforeProfit * rates.profitMarginPercent;

  const expected = Math.max(money(subtotalBeforeProfit + profit), rates.minimumJobCharge);
  const band = confidenceBandPercent(input.photo.score, riskLevel);

  const low = money(expected * (1 - band));
  const high = money(expected * (1 + band));

  return {
    jobSnapshot: {
      customer: input.jobInfo.customerName || "Not provided",
      phone: input.jobInfo.phone || "Not provided",
      email: input.jobInfo.email || "Not provided",
      address: input.jobInfo.address || "Not provided",
      requestedWork: input.customerAnswers.requestedWork,
      cleanupPreference: input.customerAnswers.cleanupPreference,
      recordPhotoReceived: input.photo.uploaded ? "Yes" : "No",
    },
    intakeCompleteness: isIntakeComplete(input) ? "Complete for preliminary screening" : "Incomplete",
    missingItems: getMissingItems(input),
    photoPacketScore: {
      singlePhotoScreeningScore: input.photo.score,
      standardQuoteReadyPacket: "Incomplete - one record photo only",
      reason: photoScoreReason(input.photo.score),
    },
    visibleTreeReview: {
      likelyTreeType: "Unknown from form-only logic. Use estimator/photo review for species notes.",
      speciesConfidence: "Unknown",
      approximateSizeClass: input.estimateAnswers.treeSizeClass,
      visibleCanopyNotes: "Canopy trimming estimate created from customer-selected scope and risk inputs.",
      healthConcerns: "Visible symptoms cannot be diagnosed by this calculator. Human review required.",
    },
    recommendedServicePreset: servicePreset,
    safetyRiskFlags: buildRiskFlags(input, riskLevel),
    quoteFactors: {
      labor: money(labor),
      travel: money(travel),
      fuel: money(fuel),
      equipment: money(equipment),
      disposal: money(disposal),
      materials: money(materials),
      overhead: money(overhead),
      riskBuffer: money(riskBuffer),
      profit: money(profit),
    },
    preliminaryEstimateRange: {
      low,
      expected,
      high,
    },
    confidenceLevel: {
      photoConfidence: input.photo.score,
      scopeConfidence: determineScopeConfidence(input.photo.score),
      pricingConfidence: pricingConfidence(input.photo.score, riskLevel),
    },
    siteVisitDecision: {
      decision: siteVisitRequired ? "Site visit required" : "Remote pre-estimate possible with human approval",
      reason: siteVisitRequired
        ? "Safety, utility, hazard, access, or photo-quality trigger found."
        : "No automatic site-visit trigger was found in the provided answers.",
    },
    customerMessage: buildCustomerMessage(input, servicePreset, riskLevel, low, expected, high),
    internalCrewNotes: buildCrewNotes(input, servicePreset, riskLevel, hours, debrisYards),
    visualPreviewInstructions:
      'Illustrative preview only. Preserve property context and modify only the selected tree. Show a natural professional result for the selected service. Add label: "Illustrative Preview - Final result may vary after field inspection."',
    humanApprovalRequirement:
      "Final quote, scope, pruning method, safety review, and customer-facing visual require authorized human approval.",
    meta: {
      estimatedCrewHours: Number(hours.toFixed(1)),
      debrisCubicYards: Number(debrisYards.toFixed(1)),
      riskLevel,
      siteVisitRequired,
      humanReviewRequired: true,
    },
  };
}

function isIntakeComplete(input) {
  return Boolean(
    input.photo.uploaded &&
      input.customerAnswers.requestedWork &&
      input.customerAnswers.cleanupPreference &&
      input.customerAnswers.accessUtilitySafetyConcerns &&
      input.estimateAnswers.treeSizeClass &&
      input.estimateAnswers.accessClass &&
      input.estimateAnswers.nearestTargetDistanceFeet !== ""
  );
}

function getMissingItems(input) {
  const missing = [];
  if (!input.jobInfo.customerName) missing.push("Customer full name");
  if (!input.jobInfo.phone) missing.push("Phone number");
  if (!input.jobInfo.email) missing.push("Email");
  if (!input.jobInfo.address) missing.push("Job address / GPS");
  missing.push("Full 12-photo packet for final quote readiness");
  missing.push("Manager approval before final price");
  return missing;
}

function photoScoreReason(score) {
  switch (score) {
    case "Excellent":
      return "Full tree, trunk/base, work area, access area, and nearby targets appear documented.";
    case "Usable":
      return "Tree and main work area are visible, but some detail may still need review.";
    case "Limited":
      return "Tree is visible, but trunk, scale, access, structure, or obstacle details may be unclear.";
    default:
      return "Photo does not show enough detail for responsible pricing without more photos or a site visit.";
  }
}

function buildRiskFlags(input, riskLevel) {
  const flags = [];
  const concerns = input.customerAnswers.accessUtilitySafetyConcerns;

  if (includesAny(concerns, ["power line", "power lines", "wire", "wires", "service drop", "transformer"])) {
    flags.push("Utility clearance concern");
  }
  if (includesAny(concerns, ["roof", "house", "garage", "pool", "shed", "fence", "driveway", "road", "sidewalk"])) {
    flags.push("Nearby structure/target concern");
  }
  if (includesAny(concerns, ["storm", "hanging", "dead", "split", "crack", "lean", "uproot"])) {
    flags.push("Hazard or storm concern");
  }
  if (input.estimateAnswers.accessClass === "Tight") flags.push("Tight access");
  if (riskLevel === "Site Visit Required") flags.push("Automatic site visit/human review trigger");
  if (flags.length === 0) flags.push("No major concern reported, subject to photo and field review");

  return flags;
}

function buildCustomerMessage(input, servicePreset, riskLevel, low, expected, high) {
  const name = input.jobInfo.customerName || "there";
  return `Hi ${name}, thanks for sending the tree photo and answers.

Based on the information provided, the likely service is: ${servicePreset}.

Your preliminary 80% confidence estimate range is:
Low: ${formatMoney(low)}
Expected: ${formatMoney(expected)}
High: ${formatMoney(high)}

Risk level: ${riskLevel}

This is a photo-based preliminary review, not a final inspection or final quote. Final pricing may change after human review due to access, utility conflicts, limb weight, hidden decay, cleanup volume, traffic/sidewalk exposure, or field conditions. Final scope and price require authorized company approval.`;
}

function buildCrewNotes(input, servicePreset, riskLevel, hours, debrisYards) {
  return [
    "Use uploaded image as the record photo.",
    `Requested work: ${input.customerAnswers.requestedWork}`,
    `Service preset: ${servicePreset}`,
    `Photo score: ${input.photo.score}`,
    `Tree size class: ${input.estimateAnswers.treeSizeClass}`,
    `Access class: ${input.estimateAnswers.accessClass}`,
    `Cleanup preference: ${input.customerAnswers.cleanupPreference}`,
    `Estimated crew hours: ${hours.toFixed(1)}`,
    `Estimated debris: ${debrisYards.toFixed(1)} cubic yards`,
    `Risk level: ${riskLevel}`,
    "Do not top the tree. Use crown cleaning, crown raising, clearance pruning, structural pruning, selective reduction, and end-weight reduction.",
    "Human review required before final quote.",
  ];
}

function stopWorkTriggers() {
  return [
    "Wires are closer than expected",
    "Limb size or canopy weight is larger than expected",
    "Roof, gutter, fence, vehicle, road, sidewalk, or neighbor risk is higher than expected",
    "Hidden decay, cracks, split unions, cavities, or unstable limbs are observed",
    "Customer requests work outside approved scope",
    "Access is blocked or ground conditions are unsafe",
    "Weather changes safety conditions",
    "Tree does not match record photo",
  ];
}

function getFormInput() {
  return {
    photo: {
      uploaded: document.getElementById("photoUpload").files.length > 0,
      score: document.getElementById("photoScore").value,
      fullTreeVisible: document.getElementById("photoScore").value !== "Not Quote-Ready",
      trunkBaseVisible: document.getElementById("photoScore").value !== "Not Quote-Ready",
      workAreaVisible: document.getElementById("photoScore").value !== "Not Quote-Ready",
      nearbyTargetsVisible: true,
    },
    customerAnswers: {
      requestedWork: document.getElementById("requestedWork").value,
      cleanupPreference: document.getElementById("cleanupPreference").value,
      accessUtilitySafetyConcerns: document.getElementById("concerns").value,
    },
    estimateAnswers: {
      treeSizeClass: document.getElementById("treeSizeClass").value,
      accessClass: document.getElementById("accessClass").value,
      nearestTargetDistanceFeet: document.getElementById("nearestTargetDistanceFeet").value,
    },
    jobInfo: {
      customerName: document.getElementById("customerName").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim(),
      address: document.getElementById("address").value.trim(),
    },
  };
}

function renderResults(estimate) {
  const results = document.getElementById("results");
  const dangerClass = estimate.meta.siteVisitRequired ? "danger" : "";

  results.innerHTML = `
    <div class="result-header">
      <div>
        <p class="eyebrow">Preliminary Estimate</p>
        <h2>${escapeHtml(estimate.recommendedServicePreset)}</h2>
      </div>
      <span class="badge ${dangerClass}">${escapeHtml(estimate.meta.riskLevel)}</span>
    </div>

    <div class="price-range">
      <div class="price-card">
        <span>Low</span>
        <strong>${formatMoney(estimate.preliminaryEstimateRange.low)}</strong>
      </div>
      <div class="price-card">
        <span>Expected</span>
        <strong>${formatMoney(estimate.preliminaryEstimateRange.expected)}</strong>
      </div>
      <div class="price-card">
        <span>High</span>
        <strong>${formatMoney(estimate.preliminaryEstimateRange.high)}</strong>
      </div>
    </div>

    <div class="section-grid">
      <div class="result-section">
        <h3>Job Snapshot</h3>
        ${objectList(estimate.jobSnapshot)}
      </div>

      <div class="result-section">
        <h3>Confidence Level</h3>
        ${objectList(estimate.confidenceLevel)}
      </div>

      <div class="result-section">
        <h3>Safety / Risk Flags</h3>
        ${arrayList(estimate.safetyRiskFlags)}
      </div>

      <div class="result-section">
        <h3>Quote Factor Breakdown</h3>
        ${objectList(Object.fromEntries(Object.entries(estimate.quoteFactors).map(([key, value]) => [key, formatMoney(value)])))}
      </div>

      <div class="result-section">
        <h3>Site Visit Decision</h3>
        <p><strong>${escapeHtml(estimate.siteVisitDecision.decision)}</strong></p>
        <p>${escapeHtml(estimate.siteVisitDecision.reason)}</p>
      </div>

      <div class="result-section">
        <h3>Internal Crew Notes</h3>
        ${arrayList(estimate.internalCrewNotes)}
      </div>

      <div class="result-section full">
        <h3>Customer Message Draft</h3>
        <pre>${escapeHtml(estimate.customerMessage)}</pre>
      </div>

      <div class="result-section full">
        <h3>Human Approval Requirement</h3>
        <p>${escapeHtml(estimate.humanApprovalRequirement)}</p>
      </div>

      <div class="result-section full">
        <h3>Crew Stop-Work Triggers</h3>
        ${arrayList(stopWorkTriggers())}
      </div>
    </div>
  `;

  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function objectList(obj) {
  return `<ul>${Object.entries(obj)
    .map(([key, value]) => `<li><strong>${labelize(key)}:</strong> ${escapeHtml(String(value))}</li>`)
    .join("")}</ul>`;
}

function arrayList(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(String(item))}</li>`).join("")}</ul>`;
}

function labelize(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.getElementById("photoUpload").addEventListener("change", (event) => {
  const file = event.target.files[0];
  const preview = document.getElementById("photoPreview");

  if (!file) {
    preview.hidden = true;
    preview.removeAttribute("src");
    return;
  }

  const reader = new FileReader();
  reader.onload = (readerEvent) => {
    preview.src = readerEvent.target.result;
    preview.hidden = false;
  };
  reader.readAsDataURL(file);
});

document.getElementById("estimateForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = getFormInput();
  const estimate = buildEstimate(input);
  renderResults(estimate);
});

document.getElementById("resetButton").addEventListener("click", () => {
  document.getElementById("estimateForm").reset();
  document.getElementById("photoPreview").hidden = true;
  document.getElementById("results").hidden = true;
});
