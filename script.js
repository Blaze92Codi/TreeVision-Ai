(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const els = {
    form: $("estimateForm"),
    resultPanel: $("resultPanel"),
    output: $("estimateOutput"),
    photoInput: $("photoInput"),
    canvas: $("photoCanvas"),
    placeholder: $("canvasPlaceholder"),
    annotationLabel: $("annotationLabel"),
    annotationNote: $("annotationNote"),
    annotationList: $("annotationList"),
    undoAnnotation: $("undoAnnotation"),
    clearAnnotations: $("clearAnnotations"),
    downloadAnnotated: $("downloadAnnotated"),
    copyCustomerMessage: $("copyCustomerMessage"),
    printReport: $("printReport"),
    downloadJson: $("downloadJson"),
    resetBtn: $("resetBtn"),
  };

  const ctx = els.canvas.getContext("2d");

  const state = {
    image: null,
    fileName: "",
    annotations: [],
    lastEstimate: null,
    lastCustomerMessage: "",
  };

  const SITE_VISIT_KEYWORDS = [
    "power line",
    "powerline",
    "wire",
    "wires",
    "service drop",
    "transformer",
    "utility pole",
    "storm",
    "hanging limb",
    "hanger",
    "dead limb",
    "dead tree",
    "split",
    "crack",
    "severe lean",
    "leaning",
    "uproot",
    "roof",
    "over house",
    "touching house",
    "touching roof",
    "pool",
    "road",
    "sidewalk",
    "public",
    "neighbor",
    "tight access",
    "fence",
    "slope",
    "septic",
    "gas",
    "fiber",
    "irrigation",
    "underground",
    "invisible fence",
    "crane",
    "lift",
    "rigging",
  ];

  const HAZARD_KEYWORDS = [
    "storm",
    "hanging",
    "dead limb",
    "dead tree",
    "split",
    "crack",
    "severe lean",
    "uproot",
    "emergency",
    "broken top",
  ];

  function money(value) {
    return Math.round(Number(value || 0) / 5) * 5;
  }

  function currency(value) {
    return `$${money(value).toLocaleString()}`;
  }

  function value(id) {
    const el = $(id);
    return el ? el.value.trim() : "";
  }

  function checked(id) {
    const el = $(id);
    return Boolean(el && el.checked);
  }

  function numberValue(id, fallback = 0) {
    const n = Number(value(id));
    return Number.isFinite(n) ? n : fallback;
  }

  function includesAny(text, keywords) {
    const normalized = String(text || "").toLowerCase();
    return keywords.some((keyword) => normalized.includes(keyword));
  }

  function getRates() {
    return {
      laborRatePerCrewHour: numberValue("laborRate", 185),
      travelBaseCharge: numberValue("travelCharge", 65),
      fuelCharge: numberValue("fuelCharge", 35),
      equipmentBaseCharge: numberValue("equipmentCharge", 75),
      disposalPerCubicYard: numberValue("disposalRate", 45),
      minimumJobCharge: numberValue("minimumCharge", 350),
      materialCharge: 15,
      overheadPercent: numberValue("overheadPercent", 18) / 100,
      profitMarginPercent: numberValue("profitPercent", 22) / 100,
    };
  }

  function gradePhoto() {
    if (!state.image) return "Not Quote-Ready";

    const fullTree = checked("fullTreeVisible");
    const trunkBase = checked("trunkBaseVisible");
    const workArea = checked("workAreaVisible");
    const targets = checked("targetsVisible");

    if (fullTree && trunkBase && workArea && targets) return "Excellent";
    if (fullTree && (trunkBase || workArea)) return "Usable";
    if (fullTree || trunkBase || workArea) return "Limited";
    return "Not Quote-Ready";
  }

  function classifyService(requestedWork, concerns) {
    const request = requestedWork.toLowerCase();
    const combined = `${requestedWork} ${concerns}`.toLowerCase();

    if (includesAny(combined, HAZARD_KEYWORDS)) return "Hazard / Storm Damage Review";
    if (includesAny(combined, ["power line", "powerline", "wire", "wires", "service drop", "transformer"])) {
      return "Site Visit Required";
    }

    if (includesAny(request, ["reduce", "cut back", "overhang", "reduction", "too big"])) {
      return "Reduction / Cutback";
    }

    if (includesAny(request, ["house", "roof", "driveway", "sidewalk", "clearance", "raise canopy", "away from"])) {
      return "Structural / Clearance Trim";
    }

    if (includesAny(request, ["shape", "light trim", "clean up", "thin", "balance"])) {
      return "Light Trim";
    }

    return "Structural / Clearance Trim";
  }

  function determineRisk(photoScore, servicePreset, treeSize, accessClass, targetDistance, concerns) {
    if (photoScore === "Not Quote-Ready") return "Site Visit Required";
    if (photoScore === "Limited") return "Site Visit Required";
    if (servicePreset === "Site Visit Required" || servicePreset === "Hazard / Storm Damage Review") return "Site Visit Required";
    if (includesAny(concerns, SITE_VISIT_KEYWORDS)) return "Site Visit Required";
    if (treeSize === "Very Large") return "High";
    if (accessClass === "Tight") return "High";
    if (targetDistance !== null && targetDistance <= 10) return "High";
    if (targetDistance !== null && targetDistance <= 25) return "Medium";
    if (treeSize === "Large" || accessClass === "Moderate") return "Medium";
    return "Low";
  }

  function estimateCrewHours(servicePreset, treeSize, accessClass, photoScore) {
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

    return baseBySize[treeSize] *
      serviceMultiplier[servicePreset] *
      accessMultiplier[accessClass] *
      photoMultiplier[photoScore];
  }

  function estimateDebrisYards(servicePreset, treeSize, cleanup) {
    if (cleanup === "Leave debris onsite" || cleanup === "Customer handles cleanup") return 0;

    const baseDebris = {
      Small: 1,
      Medium: 2.5,
      Large: 5,
      "Very Large": 7,
    };

    const serviceMultiplier = {
      "Light Trim": 0.7,
      "Structural / Clearance Trim": 1,
      "Reduction / Cutback": 1.4,
      "Hazard / Storm Damage Review": 1.5,
      "Site Visit Required": 1.2,
    };

    return baseDebris[treeSize] * serviceMultiplier[servicePreset];
  }

  function riskBufferPercent(riskLevel) {
    if (riskLevel === "Low") return 0.05;
    if (riskLevel === "Medium") return 0.12;
    if (riskLevel === "High") return 0.22;
    return 0.30;
  }

  function confidenceBandPercent(photoScore, riskLevel) {
    if (riskLevel === "Site Visit Required") return 0.35;
    if (riskLevel === "High") return 0.28;
    if (photoScore === "Limited") return 0.30;
    if (photoScore === "Usable") return 0.22;
    return 0.16;
  }

  function confidenceFrom(photoScore, riskLevel) {
    const scope = photoScore === "Excellent" ? "High" : photoScore === "Usable" ? "Medium" : "Low";
    const pricing = riskLevel === "Site Visit Required" || photoScore === "Limited" || photoScore === "Not Quote-Ready"
      ? "Low"
      : riskLevel === "High" || photoScore === "Usable"
        ? "Medium"
        : "High";

    return { photo: photoScore, species: "Unknown / Low from one photo unless close-ups are provided", scope, pricing };
  }

  function collectMissingItems() {
    const missing = [];
    if (!value("customerName")) missing.push("Customer full name");
    if (!value("phone")) missing.push("Phone number");
    if (!value("email")) missing.push("Email address");
    if (!value("address")) missing.push("Job address or GPS pin");
    if (!state.image) missing.push("Record photo");
    if (!value("targetDistance")) missing.push("Nearest target distance");
    if (!value("concerns")) missing.push("Access, utility, or safety concern answer");
    return missing;
  }

  function collectSafetyFlags(riskLevel, concerns, targetDistance, photoScore, treeSize, accessClass) {
    const flags = [];
    if (photoScore === "Limited" || photoScore === "Not Quote-Ready") flags.push("Photo quality limits remote estimate");
    if (includesAny(concerns, ["power line", "powerline", "wire", "wires", "service drop", "transformer"])) flags.push("Utility clearance review required");
    if (includesAny(concerns, ["storm", "hanging", "dead limb", "dead tree", "split", "crack", "lean", "uproot"])) flags.push("Hazard / storm damage review");
    if (includesAny(concerns, ["roof", "house", "garage", "shed", "pool", "driveway", "sidewalk", "road", "neighbor", "fence"])) flags.push("Targets / structures near work zone");
    if (includesAny(concerns, ["underground", "gas", "fiber", "irrigation", "septic", "invisible fence"])) flags.push("Underground utility concern");
    if (accessClass === "Tight") flags.push("Tight access may affect equipment and labor");
    if (treeSize === "Very Large") flags.push("Very large tree requires manager review");
    if (targetDistance !== null && targetDistance <= 10) flags.push("Target within 10 feet");
    if (state.annotations.some((a) => a.label.includes("Safety"))) flags.push("Manual safety annotation added");
    if (!flags.length) flags.push("No major safety concern entered, pending human review");
    if (riskLevel === "Site Visit Required") flags.push("Site visit / human review required before final quote");
    return [...new Set(flags)];
  }

  function buildEstimate() {
    const photoScore = gradePhoto();
    const requestedWork = value("requestedWork");
    const cleanup = value("cleanupPreference");
    const concerns = value("concerns");
    const treeSize = value("treeSize");
    const accessClass = value("accessClass");
    const rawDistance = value("targetDistance");
    const targetDistance = rawDistance === "" ? null : Number(rawDistance);

    const servicePreset = classifyService(requestedWork, concerns);
    const riskLevel = determineRisk(photoScore, servicePreset, treeSize, accessClass, targetDistance, concerns);
    const rates = getRates();

    const hours = estimateCrewHours(servicePreset, treeSize, accessClass, photoScore);
    const debrisYards = estimateDebrisYards(servicePreset, treeSize, cleanup);

    const labor = hours * rates.laborRatePerCrewHour;
    const travel = rates.travelBaseCharge;
    const fuel = rates.fuelCharge;
    const equipment = rates.equipmentBaseCharge * (accessClass === "Tight" ? 1.35 : 1);
    const disposal = debrisYards * rates.disposalPerCubicYard;
    const materials = rates.materialCharge;

    const subtotalBeforeOverhead = labor + travel + fuel + equipment + disposal + materials;
    const overhead = subtotalBeforeOverhead * rates.overheadPercent;
    const riskBuffer = subtotalBeforeOverhead * riskBufferPercent(riskLevel);
    const subtotalBeforeProfit = subtotalBeforeOverhead + overhead + riskBuffer;
    const profit = subtotalBeforeProfit * rates.profitMarginPercent;

    const expected = Math.max(money(subtotalBeforeProfit + profit), rates.minimumJobCharge);
    const band = confidenceBandPercent(photoScore, riskLevel);

    const low = money(expected * (1 - band));
    const high = money(expected * (1 + band));

    const confidence = confidenceFrom(photoScore, riskLevel);
    const missingItems = collectMissingItems();
    const safetyFlags = collectSafetyFlags(riskLevel, concerns, targetDistance, photoScore, treeSize, accessClass);

    const contactComplete = ["customerName", "phone", "email", "address"].every((id) => value(id));
    const intakeComplete = contactComplete && state.image && value("targetDistance") && value("concerns") ? "Complete" : "Incomplete";

    const siteVisitDecision = riskLevel === "Site Visit Required"
      ? "Site visit required"
      : photoScore === "Excellent" || photoScore === "Usable"
        ? "Remote pre-estimate possible with human review"
        : "More photos needed";

    const customerMessage = buildCustomerMessage({
      name: value("customerName") || "there",
      servicePreset,
      photoScore,
      riskLevel,
      low,
      expected,
      high,
      siteVisitDecision,
    });

    const estimate = {
      generatedAt: new Date().toISOString(),
      jobSnapshot: {
        customer: value("customerName") || "Not provided",
        phone: value("phone") || "Not provided",
        email: value("email") || "Not provided",
        addressOrGps: value("address") || "Not provided",
        requestedWork,
        cleanupPreference: cleanup,
        urgency: value("urgency"),
        accessNotes: accessClass,
        utilityStructureConcerns: concerns || "Not provided",
        recordPhotoReceived: state.image ? "Yes" : "No",
      },
      intakeCompleteness: intakeComplete,
      missingItems,
      photoPacketScore: {
        singlePhotoScreeningScore: photoScore,
        standardQuoteReadyPacket: "Incomplete - one-photo screening only",
        reason: photoScore === "Excellent"
          ? "Record photo appears to show tree, trunk/base, work area, and targets/open work zone."
          : "Record photo or confirmation checkboxes are incomplete. More photos or site visit may be needed.",
      },
      visibleTreeReview: {
        likelySpeciesOrTreeType: "Unknown broad tree/shrub type from one photo unless close-up details are provided",
        alternatePossibilities: "Requires leaf, bark, bud, fruit/flower, and location evidence",
        speciesConfidence: "Low / Unknown",
        visibleEvidence: "Record photo and user-entered size/access details",
        missingEvidence: "Leaf/bark close-up, trunk diameter reference, canopy defect close-up, and additional side views",
        approximateSizeClass: treeSize,
        approximateAge: "Not available from one photo",
        visibleCanopyNotes: `Requested canopy scope: ${requestedWork}`,
        visibleTrunkNotes: checked("trunkBaseVisible") ? "Trunk/base marked visible in record photo" : "Trunk/base not confirmed visible",
        visibleRootZoneNotes: checked("trunkBaseVisible") ? "Ground/base area marked visible for screening" : "Root zone not confirmed visible",
        visibleHealthConcerns: "Visible symptoms only. Disease, pests, root problems, and internal decay require qualified inspection.",
      },
      recommendedServicePreset: {
        preset: servicePreset,
        reason: serviceReason(servicePreset, requestedWork, concerns),
      },
      safetyRiskFlags: safetyFlags,
      quoteFactorBreakdown: {
        labor: money(labor),
        travel: money(travel),
        fuel: money(fuel),
        equipment: money(equipment),
        disposal: money(disposal),
        materials: money(materials),
        overhead: money(overhead),
        riskBuffer: money(riskBuffer),
        profit: money(profit),
        estimatedCrewHours: Number(hours.toFixed(1)),
        estimatedDebrisCubicYards: Number(debrisYards.toFixed(1)),
      },
      preliminaryEstimateRange: {
        low,
        expected,
        high,
        pricingConfidence: confidence.pricing,
        rangeMeaning: "Designed as an approximate 80% confidence range after company rate calibration, not a guaranteed final quote.",
        whatCouldChangeFinalPrice: [
          "Actual height, limb size, and debris volume",
          "Utilities, structures, road/sidewalk exposure, or neighbor property",
          "Hidden decay, cracks, weak unions, or dead/hanging limbs",
          "Access limitations, slope, wet ground, or blocked staging area",
          "Cleanup method, hauling distance, dump fees, or added customer scope",
          "Need for climbing, rigging, lift, crane, permit, or utility coordination",
        ],
      },
      confidenceLevel: confidence,
      siteVisitDecision: {
        decision: siteVisitDecision,
        reason: riskLevel === "Site Visit Required"
          ? "One or more risk/photo/utility/access conditions require human review or site visit."
          : "Remote pre-estimate may be prepared, but final approval is still required.",
      },
      annotations: state.annotations.map((a, index) => ({
        pin: index + 1,
        label: a.label,
        note: a.note || "",
        xPercent: Math.round(a.x * 1000) / 10,
        yPercent: Math.round(a.y * 1000) / 10,
      })),
      customerMessageDraft: customerMessage,
      internalCrewNotes: buildCrewNotes(servicePreset, photoScore, riskLevel, hours, debrisYards, safetyFlags),
      visualPreviewInstructions: buildVisualPreviewInstructions(),
      humanApprovalRequirement: "Final quote, scope, pruning method, safety plan, field method, and customer-facing visual require authorized human approval.",
    };

    state.lastEstimate = estimate;
    state.lastCustomerMessage = customerMessage;
    return estimate;
  }

  function serviceReason(preset, requestedWork, concerns) {
    if (preset === "Light Trim") return "Customer request indicates minor shaping, light crown cleaning, or canopy balancing.";
    if (preset === "Structural / Clearance Trim") return "Customer request or site context indicates clearance pruning, crown raising, roof/sidewalk/driveway clearance, or structural pruning.";
    if (preset === "Reduction / Cutback") return "Customer request indicates overhang management or selective reduction. Avoid topping; use natural reduction pruning.";
    if (preset === "Hazard / Storm Damage Review") return "Storm, deadwood, hanging limb, split/crack, severe lean, or emergency concern was entered.";
    return "Utility, hazard, access, photo, or scope uncertainty requires a site visit before final pricing.";
  }

  function buildCustomerMessage(data) {
    return `Hi ${data.name}, thanks for sending the tree photo and information.

I can use this as the starting record photo for your tree estimate.

Service type: ${data.servicePreset}
Photo confidence: ${data.photoScore}
Risk level: ${data.riskLevel}

Preliminary estimate range:
Low: ${currency(data.low)}
Expected: ${currency(data.expected)}
High: ${currency(data.high)}

Recommended next step: ${data.siteVisitDecision}.

This is a photo-based preliminary review, not a final inspection or final quote. Final pricing may change if on-site conditions differ from the photo, including access, utilities, hidden decay, limb weight, cleanup volume, traffic/sidewalk exposure, or safety concerns. Final scope and pricing require authorized company approval.`;
  }

  function buildCrewNotes(servicePreset, photoScore, riskLevel, hours, debrisYards, safetyFlags) {
    return [
      `Work tree: use uploaded record photo and annotated pins.`,
      `Service preset: ${servicePreset}.`,
      `Photo score: ${photoScore}.`,
      `Risk level: ${riskLevel}.`,
      `Estimated crew hours: ${hours.toFixed(1)}.`,
      `Estimated debris: ${debrisYards.toFixed(1)} cubic yards.`,
      `Likely equipment: chainsaws, pole saw, hand tools, PPE, cleanup tools, chipper/haul setup as needed.`,
      `Pruning language: crown cleaning, crown raising, clearance pruning, structural pruning, selective reduction, end-weight reduction, canopy balancing.`,
      `Do not top, cut in half, over-prune, guarantee safety, or diagnose disease from photo.`,
      `Safety flags: ${safetyFlags.join("; ")}.`,
      `Stop-work triggers: wires closer than expected; larger limb size; hidden decay/cracks/split unions; blocked access; unsafe ground/weather; customer requests extra scope; tree does not match record photo.`,
      `Manager review required before final quote and final customer-facing visual.`,
    ];
  }

  function buildVisualPreviewInstructions() {
    const annotationText = state.annotations.length
      ? state.annotations.map((a, i) => `${i + 1}. ${a.label}${a.note ? ` - ${a.note}` : ""}`).join("\n")
      : "No annotation pins placed yet.";

    return `Illustrative only - not a guaranteed final result.

Use the uploaded full-framed record photo. Preserve the property, house, yard, driveway, fence, street, sky, landscaping, and surrounding features. Modify or mark only the selected tree according to the approved service preset and annotation notes. Keep natural form realistic. Do not show topping or excessive pruning. Do not imply the tree is structurally safe, disease-free, or guaranteed to look exactly like the preview. Add label: "Illustrative Preview - Final result may vary after field inspection."

Annotation notes:
${annotationText}`;
  }

  function renderEstimate(estimate) {
    const flags = estimate.safetyRiskFlags
      .map((flag) => {
        const cls = flag.toLowerCase().includes("site") || flag.toLowerCase().includes("utility") || flag.toLowerCase().includes("hazard")
          ? "site"
          : flag.toLowerCase().includes("target") || flag.toLowerCase().includes("tight")
            ? "medium"
            : "";
        return `<span class="flag ${cls}">${escapeHtml(flag)}</span>`;
      })
      .join("");

    els.output.innerHTML = `
      <div class="report-grid">
        ${section("Job Snapshot", dl(estimate.jobSnapshot))}
        ${section("Intake Completeness", `<p><strong>${estimate.intakeCompleteness}</strong></p>`)}
        ${section("Missing Items", listOrNone(estimate.missingItems))}
        ${section("Photo Packet Score", dl(estimate.photoPacketScore))}
        ${section("Visible Tree/Shrub Review", dl(estimate.visibleTreeReview))}
        ${section("Recommended Service Preset", dl(estimate.recommendedServicePreset))}
        ${section("Safety / Risk Flags", `<div>${flags}</div>`)}
        ${section("Quote Factor Breakdown", dlMoney(estimate.quoteFactorBreakdown))}
        ${section("Preliminary Estimate Range", `
          <div class="price-range">
            <div class="price-card"><span>Low</span><strong>${currency(estimate.preliminaryEstimateRange.low)}</strong></div>
            <div class="price-card"><span>Expected</span><strong>${currency(estimate.preliminaryEstimateRange.expected)}</strong></div>
            <div class="price-card"><span>High</span><strong>${currency(estimate.preliminaryEstimateRange.high)}</strong></div>
          </div>
          <p class="muted">${escapeHtml(estimate.preliminaryEstimateRange.rangeMeaning)}</p>
          <h3>What could change final price</h3>
          ${listOrNone(estimate.preliminaryEstimateRange.whatCouldChangeFinalPrice)}
        `)}
        ${section("Confidence Level", dl(estimate.confidenceLevel))}
        ${section("Site Visit Decision", dl(estimate.siteVisitDecision))}
        ${section("Annotation Notes", estimate.annotations.length ? annotationReport(estimate.annotations) : "<p>No annotation pins placed.</p>")}
        ${section("Customer Message Draft", `<div class="message-box">${escapeHtml(estimate.customerMessageDraft)}</div>`)}
        ${section("Internal Crew Notes", listOrNone(estimate.internalCrewNotes))}
        ${section("Visual Preview Instructions", `<div class="message-box">${escapeHtml(estimate.visualPreviewInstructions)}</div>`)}
        ${section("Human Approval Requirement", `<p><strong>${escapeHtml(estimate.humanApprovalRequirement)}</strong></p>`)}
      </div>
    `;

    els.resultPanel.classList.remove("hidden");
    els.resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function section(title, content) {
    return `<section class="report-section"><h3>${escapeHtml(title)}</h3>${content}</section>`;
  }

  function dl(obj) {
    return `<dl>${Object.entries(obj).map(([key, val]) => `
      <dt>${escapeHtml(labelize(key))}</dt>
      <dd>${Array.isArray(val) ? escapeHtml(val.join(", ")) : escapeHtml(String(val))}</dd>
    `).join("")}</dl>`;
  }

  function dlMoney(obj) {
    return `<dl>${Object.entries(obj).map(([key, val]) => {
      const isMoneyKey = !["estimatedCrewHours", "estimatedDebrisCubicYards"].includes(key);
      return `<dt>${escapeHtml(labelize(key))}</dt><dd>${isMoneyKey ? currency(val) : escapeHtml(String(val))}</dd>`;
    }).join("")}</dl>`;
  }

  function listOrNone(items) {
    if (!items || !items.length) return "<p>None noted.</p>";
    return `<ul>${items.map((item) => `<li>${escapeHtml(String(item))}</li>`).join("")}</ul>`;
  }

  function annotationReport(annotations) {
    return `<ol>${annotations.map((a) => `
      <li><strong>Pin ${a.pin}: ${escapeHtml(a.label)}</strong>${a.note ? ` - ${escapeHtml(a.note)}` : ""} <span class="muted">(${a.xPercent}% x, ${a.yPercent}% y)</span></li>
    `).join("")}</ol>`;
  }

  function labelize(key) {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .replace(/Gps/g, "GPS");
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function loadPhoto(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        state.image = img;
        state.fileName = file.name || "tree-record-photo";
        state.annotations = [];
        fitCanvasToImage(img);
        renderCanvas();
        renderAnnotationList();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function fitCanvasToImage(img) {
    const maxWidth = 1100;
    const maxHeight = 760;
    let { naturalWidth: w, naturalHeight: h } = img;

    const scale = Math.min(maxWidth / w, maxHeight / h, 1);
    els.canvas.width = Math.round(w * scale);
    els.canvas.height = Math.round(h * scale);

    els.canvas.style.display = "block";
    els.placeholder.style.display = "none";
  }

  function renderCanvas() {
    const canvas = els.canvas;
    if (!state.image) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);

    drawPreviewLabel();

    state.annotations.forEach((a, index) => {
      const x = a.x * canvas.width;
      const y = a.y * canvas.height;
      drawPin(x, y, index + 1, a.label);
    });
  }

  function drawPreviewLabel() {
    const text = "Illustrative Preview - Final result may vary after field inspection";
    const padding = 10;
    ctx.save();
    ctx.font = "bold 16px system-ui, sans-serif";
    const width = ctx.measureText(text).width + padding * 2;
    ctx.fillStyle = "rgba(16, 32, 22, 0.78)";
    ctx.fillRect(12, 12, width, 36);
    ctx.fillStyle = "white";
    ctx.fillText(text, 12 + padding, 36);
    ctx.restore();
  }

  function drawPin(x, y, num, label) {
    ctx.save();

    const isSafety = label.toLowerCase().includes("safety") || label.toLowerCase().includes("target");
    ctx.fillStyle = isSafety ? "rgba(165, 48, 48, 0.95)" : "rgba(31, 122, 79, 0.95)";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(num), x, y + 0.5);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "bold 13px system-ui, sans-serif";

    const text = label.length > 26 ? `${label.slice(0, 23)}...` : label;
    const tw = ctx.measureText(text).width;
    const boxX = Math.min(x + 18, els.canvas.width - tw - 28);
    const boxY = Math.max(12, y - 30);

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    roundedRect(ctx, boxX, boxY, tw + 18, 26, 10);
    ctx.fill();

    ctx.fillStyle = "#102016";
    ctx.fillText(text, boxX + 9, boxY + 18);

    ctx.restore();
  }

  function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  function addAnnotation(evt) {
    if (!state.image) return;

    const rect = els.canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / rect.width;
    const y = (evt.clientY - rect.top) / rect.height;

    state.annotations.push({
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      label: els.annotationLabel.value,
      note: els.annotationNote.value.trim(),
      createdAt: new Date().toISOString(),
    });

    els.annotationNote.value = "";
    renderCanvas();
    renderAnnotationList();
  }

  function renderAnnotationList() {
    if (!state.annotations.length) {
      els.annotationList.innerHTML = `<li>No pins yet. Choose a label and click the photo.</li>`;
      return;
    }

    els.annotationList.innerHTML = state.annotations.map((a, index) => `
      <li>
        <span class="tag">Pin ${index + 1}</span>
        <strong>${escapeHtml(a.label)}</strong>
        ${a.note ? `<br><span>${escapeHtml(a.note)}</span>` : ""}
      </li>
    `).join("");
  }

  function downloadAnnotatedImage() {
    if (!state.image) {
      alert("Upload a photo before downloading an annotated preview.");
      return;
    }

    renderCanvas();
    const a = document.createElement("a");
    const safeName = state.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
    a.download = `${safeName || "treevision"}-annotated-preview.png`;
    a.href = els.canvas.toDataURL("image/png");
    a.click();
  }

  function downloadJsonReport() {
    if (!state.lastEstimate) {
      alert("Generate an estimate first.");
      return;
    }

    const blob = new Blob([JSON.stringify(state.lastEstimate, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.download = `treevision-estimate-${Date.now()}.json`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function resetAll() {
    if (!confirm("Reset form, photo, annotations, and estimate?")) return;
    els.form.reset();
    $("fullTreeVisible").checked = true;
    $("trunkBaseVisible").checked = true;
    $("workAreaVisible").checked = true;
    $("targetsVisible").checked = true;
    state.image = null;
    state.fileName = "";
    state.annotations = [];
    state.lastEstimate = null;
    state.lastCustomerMessage = "";
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    els.canvas.style.display = "none";
    els.placeholder.style.display = "grid";
    els.annotationList.innerHTML = "";
    els.resultPanel.classList.add("hidden");
  }

  els.photoInput.addEventListener("change", (evt) => loadPhoto(evt.target.files[0]));
  els.canvas.addEventListener("click", addAnnotation);

  els.undoAnnotation.addEventListener("click", () => {
    state.annotations.pop();
    renderCanvas();
    renderAnnotationList();
  });

  els.clearAnnotations.addEventListener("click", () => {
    if (!state.annotations.length) return;
    if (!confirm("Clear all annotation pins?")) return;
    state.annotations = [];
    renderCanvas();
    renderAnnotationList();
  });

  els.downloadAnnotated.addEventListener("click", downloadAnnotatedImage);

  els.form.addEventListener("submit", (evt) => {
    evt.preventDefault();
    const estimate = buildEstimate();
    renderEstimate(estimate);
  });

  els.copyCustomerMessage.addEventListener("click", async () => {
    if (!state.lastCustomerMessage) {
      alert("Generate an estimate first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(state.lastCustomerMessage);
      alert("Customer message copied.");
    } catch (err) {
      alert("Could not copy automatically. Select and copy the message manually.");
    }
  });

  els.printReport.addEventListener("click", () => window.print());
  els.downloadJson.addEventListener("click", downloadJsonReport);
  els.resetBtn.addEventListener("click", resetAll);

  renderAnnotationList();
})();
