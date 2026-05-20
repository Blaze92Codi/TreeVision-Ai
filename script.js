Total output lines: 1593

/*
  TreeVision AI — Dynamic Tree Canopy Estimator
  Full rebuild: ISA arborist science, ANSI A300, photo annotation canvas,
  9 service presets, 15-section output, 4-tab results, crew package.
  Static browser app — no build step, no dependencies.
*/

// ============================================================
// RATES
// ============================================================
const DEFAULT_RATES = {
  laborRatePerCrewHour: 185,
  travelBaseCharge: 65,
  fuelCharge: 35,
  equipmentBaseCharge: 75,
  disposalPerCubicYard: 45,
  materialCharge: 15,
  permitCoordination: 0,
  overheadPercent: 0.18,
  profitMarginPercent: 0.22,
  minimumJobCharge: 350,
};

// ============================================================
// SITE VISIT KEYWORDS
// ============================================================
const SITE_VISIT_KEYWORDS = [
  "power line","power lines","wire","wires","service drop","transformer",
  "utility pole","storm","hanging limb","hanging limbs","dead limb","dead limbs",
  "dead tree","split","crack","lean","uproot","roof","over house","pool","road",
  "sidewalk","neighbor","tight access","fence","septic","gas","fiber","irrigation",
  "underground","public right of way","crane","rigging","lift required",
];

// ============================================================
// SPECIES DATABASE
// ============================================================
const SPECIES_DB = {
  oak: {
    key: "oak", name: "Oak", scientific: "Quercus spp.",
    pruningWindow: "Late winter / full dormancy (Dec–Mar). CRITICAL: Avoid April–June in red/black oak group.",
    primaryRisk: "Oak wilt (Bretziella fagacearum) — lethal fungal disease spread by bark beetles during spring.",
    alert: "Never prune red/black oak April–June. Seal all wounds immediately if emergency spring cut required. Remove cut wood from site — do not leave as beetle habitat.",
    maxRemoval: "25% of live crown per season (ISA BMP)",
    codit: "Good — oaks compartmentalize well with proper collar cuts.",
    bestPractices: [
      "Prune only during full dormancy (December–March) for maximum safety",
      "If emergency spring pruning required: seal all wounds immediately with latex paint or commercial sealant",
      "Remove and transport cut branches away from site promptly",
      "Structural pruning at young age prevents co-dominant stem failures",
      "Good CODIT response when cuts respect branch collar",
    ],
    commonIssues: "Oak wilt, gall formation, two-lined chestnut borer, anthracnose, hypoxylon canker",
    rootZone: "Oaks very sensitive to root zone disturbance. Maintain CRZ = 1 ft radius per inch DBH minimum.",
  },
  maple: {
    key: "maple", name: "Maple", scientific: "Acer spp.",
    pruningWindow: "Late winter (dormant) OR midsummer (Jul–Aug). Avoid early spring and fall.",
    primaryRisk: "Heavy sap bleed in early spring; poor wound closure in fall creates decay entry points.",
    alert: null,
    maxRemoval: "25% of live crown per season",
    codit: "Moderate — good collar cuts close reasonably well in summer.",
    bestPractices: [
      "Avoid early spring pruning — sap pressure causes excessive bleeding (not harmful but concerning to customers)",
      "Avoid fall pruning — wound closure is poor; decay fungi active",
      "Midsummer pruning: wounds dry quickly, good CODIT response",
      "Watch for co-dominant stems with included bark in silver maple — structural pruning critical",
      "Asian longhorned beetle risk in some regions — confirm before transporting wood",
    ],
    commonIssues: "Verticillium wilt, Asian longhorned beetle, tar spot, scale insects, chlorosis",
    rootZone: "Shallow root systems — protect from compaction, grade change, and heat stress.",
  },
  pine: {
    key: "pine", name: "Pine", scientific: "Pinus spp.",
    pruningWindow: "Early summer during candle stage OR late winter. Avoid late summer through fall.",
    primaryRisk: "Pine wilt nematode in stressed trees; bark beetles in declining trees.",
    alert: "Never cut back into old wood — pines have no latent buds. Bare stubs die back. Dead pine = beetle habitat — prompt removal recommended.",
    maxRemoval: "Remove no more than ⅓ of annual growth. Do not cut back to bare wood.",
    codit: "Moderate — resin response helps seal small wounds; large cuts prone to decay.",
    bestPractices: [
      "Candle pruning (pinching new growth during early summer) controls size without stubbing",
      "Never cut back into old wood — pines lack latent buds and bare stubs die",
      "Remove dead lower branches at the collar (natural shedding zone)",
      "Maintain live crown ratio above 50%",
    ],
    commonIssues: "Pine wilt, bark beetles, pine needle scale, Diplodia tip blight",
    rootZone: "Tap root system — less sensitive to compaction than shallow-rooted species, but protect CRZ.",
  },
  elm: {
    key: "elm", name: "Elm", scientific: "Ulmus spp.",
    pruningWindow: "Late fall through winter only. CRITICAL: Avoid spring through early summer.",
    primaryRisk: "Dutch elm disease (Ophiostoma novo-ulmi) — lethal; spread by elm bark beetles and root grafts.",
    alert: "Prune ONLY during cold weather when beetles are inactive (Nov–Mar). Sterilize all tools between trees with 10% bleach or 70% isopropyl. DED is lethal and spreads via root grafts to neighboring elms.",
    maxRemoval: "25% of live crown per season",
    codit: "Moderate — good collar cuts compartmentalize well when timed correctly.",
    bestPractices: [
      "Prune only during cold weather — bark beetles inactive November through March",
      "Sterilize all tools between trees",
      "Watch for sudden crown dieback or brown streaking in sapwood — DED symptoms",
      "Remove all cut elm wood promptly from site — do not leave as beetle breeding habitat",
      "Injection treatments available for high-value trees — refer to ISA-certified arborist",
    ],
    commonIssues: "Dutch elm disease, elm yellows, elm bark beetle, elm leaf beetle",
    rootZone: "Aggressive root systems. Root grafts can transmit DED to neighboring elms.",
  },
  ash: {
    key: "ash", name: "Ash", scientific: "Fraxinus spp.",
    pruningWindow: "Any time, ideally winter.",
    primaryRisk: "Emerald Ash Borer (EAB, Agrilus planipennis) — invasive, lethal to all native North American ash.",
    alert: "Dead ash is extremely brittle and dangerous for removal — EAB-killed trees require elevated caution and experienced crew. D-shaped exit holes, serpentine galleries, top-down crown dieback = EAB confirmed. Do not transport ash wood from quarantine zones.",
    maxRemoval: "25% of live crown per season",
    codit: "Moderate — declining trees compartmentalize poorly.",
    bestPractices: [
      "Confirm EAB presence in your region before assuming decline is EAB-related",
      "Dead ash is extremely brittle — elevated caution for removal, experienced crew only",
      "Trunk injections with emamectin benzoate can protect high-value trees — refer to arborist",
      "Do not transport ash wood or bark out of quarantine zones",
    ],
    commonIssues: "Emerald ash borer, ash yellows, ash anthracnose",
    rootZone: "Moderate sensitivity to root zone disturbance.",
  },
  birch: {
    key: "birch", name: "Birch", scientific: "Betula spp.",
    pruningWindow: "Late summer (August) or winter. Avoid spring (heavy bleed) and early summer.",
    primaryRisk: "Bronze birch borer (Agrilus anxius) — attacks stressed trees; highly lethal.",
    alert: "Maintain vigorous tree health — stressed birch = high borer risk. River birch significantly more borer-resistant than white birch.",
    maxRemoval: "25% of live crown per season",
    codit: "Poor — birch do not compartmentalize as effectively. Minimize cuts.",
    bestPractices: [
      "Avoid drought stress — mulch and water during dry periods",
      "Prune late summer to avoid spring beetle flight and sap bleed",
      "Remove dead wood promptly — borer habitat",
      "Avoid overpruning — birch recover poorly from heavy cuts",
    ],
    commonIssues: "Bronze birch borer, birch leafminer, birch dieback, aphids",
    rootZone: "Shallow, moisture-sensitive roots. Very sensitive to soil compaction and heat stress.",
  },
  bradford_pear: {
    key: "bradford_pear", name: "Bradford / Callery Pear", scientific: "Pyrus calleryana",
    pruningWindow: "Dormant winter.",
    primaryRisk: "Inherent structural weakness — V-angle co-dominant stems fail catastrophically at maturity.",
    alert: "Structurally problematic species. Co-dominant stems with included bark are extremely prone to splitting. Structural pruning critical at young age. Full removal often recommended at maturity or after first large structural failure.",
    maxRemoval: "25% of live crown per season",
    codit: "Poor structural response — wood is brittle.",
    bestPractices: [
      "Structural pruning at young age (under 10 ft) to select dominant leader",
      "Remove co-dominant stems early before they reach failure size",
      "Full removal often the economically correct recommendation at maturity",
      "Fire blight risk — sterilize tools",
    ],
    commonIssues: "Co-dominant stem failure, fire blight, short lifespan (15–25 years at failure risk)",
    rootZone: "Moderate sensitivity.",
  },
  magnolia: {
    key: "magnolia", name: "Magnolia", scientific: "Magnolia spp.",
    pruningWindow: "Right after bloom or midsummer. Avoid fall and winter cuts.",
    primaryRisk: "Slow wound closure — magnolias compartmentalize poorly relative to most hardwoods.",
    alert: "Minimize cuts. Magnolias do not tolerate heavy pruning. Remove dead branches only when needed.",
    maxRemoval: "15–20% maximum — minimize cuts on magnolias",
    codit: "Poor — wound closure is slow; large cuts prone to decay entry.",
    bestPractices: [
      "Remove dead branches and keep cuts small — magnolias compartmentalize poorly",
      "Prune right after bloom for best wound response",
      "Avoid fall and winter cuts — very slow wound closure increases decay risk",
      "Do not perform heavy reduction cuts",
    ],
    commonIssues: "Scale insects, magnolia borer, canker diseases, leaf spots",
    rootZone: "Large, fleshy roots sensitive to compaction and grade change.",
  },
};

function guessSpecies(input) {
  const s = (input || "").toLowerCase();
  if (/oak|quercus|live oak|red oak|white oak|pin oak|bur oak/.test(s)) return SPECIES_DB.oak;
  if (/maple|acer|sugar maple|red maple|silver maple/.test(s)) return SPECIES_DB.maple;
  if (/pine|pinus/.test(s)) return SPECIES_DB.pine;
  if (/elm|ulmus/.test(s)) return SPECIES_DB.elm;
  if (/ash|fraxinus/.test(s)) return SPECIES_DB.ash;
  if (/birch|betula/.test(s)) return SPECIES_DB.birch;
  if (/bradford|callery|pear/.test(s)) return SPECIES_DB.bradford_pear;
  if (/magnolia/.test(s)) return SPECIES_DB.magnolia;
  return null;
}

// ============================================================
// ANNOTATION ENGINE — ISA/ANSI A300 · Knowledge Base aligned
// Visual Preview Policy: Illustrative only. Preserves structure.
// Zones use ISA BMP language. Risk colors match Risk Rating Matrix.
// Never implies guaranteed cuts, tree health, or structural safety.
// ============================================================

// Risk Rating Matrix colors (Knowledge Base p.8)
const RISK_COLOR = {
  "Low":              { fill: "rgba(40,160,70,0.13)",  stroke: "rgba(30,130,55,0.72)",  badge: "rgba(30,130,55,0.90)"  },
  "Medium":           { fill: "rgba(255,165,0,0.15)",  stroke: "rgba(200,120,0,0.78)",  badge: "rgba(190,110,0,0.90)"  },
  "High":             { fill: "rgba(210,70,20,0.18)",  stroke: "rgba(185,45,10,0.82)",  badge: "rgba(180,40,10,0.90)"  },
  "Site Visit Required":{ fill:"rgba(190,30,30,0.18)", stroke: "rgba(165,15,15,0.88)",  badge: "rgba(160,10,10,0.94)"  },
};

function drawAnnotations(canvas, imgEl, input, servicePreset, riskLevel) {
  const ctx = canvas.getContext("2d");
  const maxW = canvas.parentElement.clientWidth || 560;
  const ratio = imgEl.naturalHeight / imgEl.naturalWidth;
  canvas.width = Math.min(maxW, 700);
  canvas.height = Math.round(canvas.width * ratio);
  const W = canvas.width, H = canvas.height;

  // Draw photo
  ctx.drawImage(imgEl, 0, 0, W, H);
  // Subtle dark vignette so labels pop
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(0, 0, W, H);

  // Build and draw all zones
  const zones = buildAnnotationZones(input, servicePreset, riskLevel, W, H);
  zones.forEach(z => drawZone(ctx, z));

  // ISA cut-point markers (where lateral cuts apply)
  const cuts = buildCutPoints(servicePreset, W, H);
  if (cuts.length) drawCutPoints(ctx, cuts);

  // ISA method banner — top-right corner chip
  const isaMethod = ISA_METHOD_LABEL[servicePreset] || "Canopy Review";
  drawChip(ctx, `ISA: ${isaMethod}`, W - 8, 8, "right",
    "rgba(34,84,49,0.90)", "#fff");

  // Bottom disclaimer bar — Knowledge Base Visual Preview Policy
  ctx.fillStyle = "rgba(0,0,0,0.54)";
  ctx.fillRect(0, H - 36, W, 36);
  ctx.font = "bold 10.5px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText("🌳 TreeVision AI · Dynamic Tree Services", 10, H - 21);
  ctx.font = "9px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("Illustrative Preview — Final result may vary. Not a final arborist inspection, utility clearance, or guaranteed outcome.", 10, H - 7);
}

// ISA BMP pruning method per service preset (Knowledge Base p.15)
const ISA_METHOD_LABEL = {
  "Light Trim":                  "Crown Cleaning · Canopy Balancing",
  "Structural / Clearance Trim": "Clearance Pruning · Crown Raising",
  "Reduction / Cutback":         "Selective Reduction · End-Weight Removal",
  "Small Tree Removal":          "Full Removal — Low Complexity",
  "Medium / Large Tree Removal": "Full Removal — Rigging / Staging",
  "Hazard / Storm Damage Review":"Hazard Assessment — Human Review",
  "Stump Grinding":              "Stump Grinding — Below Grade",
  "Shrub Trim / Shrub Removal":  "Shrub Pruning · Ornamental Cleanup",
  "Site Visit Required":         "Site Visit Required — No Remote Estimate",
};

function buildAnnotationZones(input, servicePreset, riskLevel, W, H) {
  const zones = [];
  const c      = (input.customerAnswers.accessUtilitySafetyConcerns || "").toLowerCase();
  const work   = (input.customerAnswers.requestedWork || "").toLowerCase();
  const access = input.estimateAnswers.accessClass || "Moderate";
  const size   = input.estimateAnswers.treeSizeClass || "Medium";
  const dist   = parseFloat(input.estimateAnswers.nearestTargetDistanceFeet) || 15;
  const rc     = RISK_COLOR[riskLevel] || RISK_COLOR["Medium"];

  // ── Canopy depth by size class (Knowledge Base: size class definitions) ──
  const canopyH = { Small: 0.45, Medium: 0.55, Large: 0.64, "Very Large": 0.72 }[size] || 0.55;
  const trunkY  = H * (0.58 + (canopyH - 0.55) * 0.2);
  const trunkH  = H * 0.30;

  // ════════════════════════════════════════════════════════
  // ALWAYS-PRESENT: TRUNK ZONE (Visible Trunk Review — KB p.6)
  // ════════════════════════════════════════════════════════
  const trunkLabel = /co.?dominant|split|included bark|crack|lean/.test(c)
    ? "TRUNK — INSPECT CO-DOMINANT STEMS"
    : /cavity|decay|mushroom/.test(c)
    ? "TRUNK — DECAY INDICATORS NOTED"
    : "TRUNK ZONE — BRANCH COLLAR CUTS";
  zones.push({ x: W*0.38, y: trunkY, w: W*0.24, h: trunkH,
    fill: "rgba(120,75,35,0.16)", stroke: "rgba(90,55,20,0.65)",
    label: trunkLabel, lpos: "bottom", dash: false });

  // ════════════════════════════════════════════════════════
  // ALWAYS-PRESENT: ROOT ZONE (Visible Root Zone Review — KB p.6)
  // ════════════════════════════════════════════════════════
  const rootLabel = /underground|irrigation|septic|gas|fiber|invisible fence/.test(c)
    ? "ROOT ZONE — UNDERGROUND UTILITIES NOTED"
    : "CRITICAL ROOT ZONE — PROTECT FROM COMPACTION";
  zones.push({ x: W*0.14, y: H*0.87, w: W*0.72, h: H*0.09,
    fill: "rgba(120,75,35,0.10)", stroke: "rgba(90,55,20,0.40)",
    label: rootLabel, lpos: "bottom", dash: true });

  // ════════════════════════════════════════════════════════
  // SERVICE-SPECIFIC CANOPY ZONES — ISA BMP terminology
  // ════════════════════════════════════════════════════════
  switch (servicePreset) {

    case "Light Trim":
      // Crown cleaning + canopy balancing — outer ring only, max 25% live crown
      zones.push({ x: W*0.06, y: H*0.04, w: W*0.88, h: H*canopyH,
        fill: "rgba(40,160,70,0.09)", stroke: "rgba(30,130,55,0.58)",
        label: "CROWN CLEANING · OUTER CANOPY ONLY", lpos: "top", dash: true });
      // Inner "do not enter" zone — protect live crown interior
      zones.push({ x: W*0.20, y: H*0.12, w: W*0.60, h: H*(canopyH*0.55),
        fill: "rgba(40,160,70,0.04)", stroke: "rgba(30,130,55,0.28)",
        label: "LIVE CROWN INTERIOR — DO NOT REMOVE", lpos: "top", dash: true });
      break;

    case "Structural / Clearance Trim":
      // Main clearance pruning zone
      zones.push({ x: W*0.05, y: H*0.03, w: W*0.90, h: H*canopyH,
        fill: rc.fill, stroke: rc.stroke,
        label: "CLEARANCE PRUNING ZONE", lpos: "top", dash: false });
      // Crown raising sub-zone (lower canopy lifted)
      zones.push({ x: W*0.12, y: H*(canopyH*0.55), w: W*0.76, h: H*0.14,
        fill: "rgba(30,110,210,0.10)", stroke: "rgba(30,100,200,0.65)",
        label: "CROWN RAISING — LOWER LIMB REMOVAL", lpos: "bottom", dash: true });
      // Roof or house clearance target
      if (/house|roof|garage|trim away/.test(work + " " + c)) {
        zones.push({ x: W*0.64, y: H*0.06, w: W*0.32, h: H*0.50,
          fill: "rgba(30,110,210,0.09)", stroke: "rgba(20,90,190,0.72)",
          label: "ROOF CLEARANCE TARGET", lpos: "top", dash: true });
      }
      // Driveway / sidewalk clearance
      if (/driveway|sidewalk|road/.test(c)) {
        zones.push({ x: W*0.03, y: H*0.74, w: W*0.38, h: H*0.16,
          fill: "rgba(30,110,210,0.08)", stroke: "rgba(30,100,200,0.55)",
          label: "PAVEMENT CLEARANCE ZONE", lpos: "bottom", dash: true });
      }
      break;

    case "Reduction / Cutback":
      // Selective reduction — lateral cuts to live branches only
      zones.push({ x: W*0.03, y: H*0.02, w: W*0.94, h: H*canopyH,
        fill: rc.fill, stroke: rc.stroke,
        label: "SELECTIVE REDUCTION — LATERAL CUTS TO LIVE BRANCHES", lpos: "top", dash: false });
      // End-weight reduction sub-zone — tips/outer canopy
      zones.push({ x: W*0.06, y: H*0.04, w: W*0.88, h: H*(canopyH*0.38),
        fill: "rgba(220,130,0,0.10)", stroke: "rgba(190,105,0,0.60)",
        label: "END-WEIGHT REMOVAL — OUTER TIPS", lpos: "top", dash: true });
      // Preserve: live crown interior
      zones.push({ x: W*0.22, y: H*(canopyH*0.38), w: W*0.56, h: H*(canopyH*0.40),
        fill: "rgba(40,160,70,0.05)", stroke: "rgba(30,130,55,0.30)",
        label: "LIVE CROWN — PRESERVE LATERAL STRUCTURE", lpos: "bottom", dash: true });
      break;

    case "Small Tree Removal":
      zones.push({ x: W*0.06, y: H*0.03, w: W*0.88, h: H*(canopyH + 0.06),
        fill: "rgba(190,40,40,0.15)", stroke: "rgba(165,20,20,0.…11022 tokens truncated…e:</strong> ${esc(e.photoPacketScore.singlePhotoScore)}</li>
          <li><strong>Full packet status:</strong> ${esc(e.photoPacketScore.fullPacketStatus)}</li>
          <li><strong>Reason:</strong> ${esc(e.photoPacketScore.reason)}</li>
          <li><strong>Checklist score:</strong> ${e.onePhotoReadiness.score}%</li>
          <li><strong>Missing:</strong> ${e.onePhotoReadiness.missing.length ? esc(e.onePhotoReadiness.missing.join(", ")) : "None"}</li>
        </ul>
      </div>
      <div class="result-section">
        <h3>5. Visible Tree / Shrub Review</h3>
        <ul>
          ${Object.entries(e.visibleTreeReview).map(([k,v])=>`<li><strong>${labelize(k)}:</strong> ${esc(v)}</li>`).join("")}
        </ul>
      </div>
      <div class="result-section">
        <h3>6. Recommended Service Preset</h3>
        <p><span class="badge ${dangerClass}">${esc(e.servicePreset)}</span></p>
      </div>
      <div class="result-section">
        <h3>7. Safety / Risk Flags</h3>
        <ul>${e.safetyRiskFlags.map(f=>`<li>${esc(f)}</li>`).join("")}</ul>
      </div>
      <div class="result-section">
        <h3>8. Quote Factor Breakdown</h3>
        <ul>
          <li><strong>Labor:</strong> ${fmt(qf.labor)}</li>
          <li><strong>Travel:</strong> ${fmt(qf.travel)}</li>
          <li><strong>Fuel:</strong> ${fmt(qf.fuel)}</li>
          <li><strong>Equipment:</strong> ${fmt(qf.equipment)}</li>
          <li><strong>Disposal:</strong> ${fmt(qf.disposal)}</li>
          <li><strong>Materials:</strong> ${fmt(qf.materials)}</li>
          <li><strong>Overhead:</strong> ${fmt(qf.overhead)}</li>
          <li><strong>Risk buffer:</strong> ${fmt(qf.riskBuffer)}</li>
          <li><strong>Profit margin:</strong> ${fmt(qf.profit)}</li>
        </ul>
      </div>
      <div class="result-section">
        <h3>9. Preliminary Estimate Range</h3>
        <ul>
          <li><strong>Low:</strong> ${fmt(e.preliminaryEstimateRange.low)}</li>
          <li><strong>Expected:</strong> ${fmt(e.preliminaryEstimateRange.expected)}</li>
          <li><strong>High:</strong> ${fmt(e.preliminaryEstimateRange.high)}</li>
          <li><strong>Estimated crew hours:</strong> ${e.meta.estimatedCrewHours}</li>
          <li><strong>Estimated debris:</strong> ${e.meta.debrisCubicYards} cu yd</li>
        </ul>
      </div>
      <div class="result-section">
        <h3>10. Confidence Level</h3>
        <ul>
          <li><strong>Photo confidence:</strong> ${esc(e.confidenceLevel.photoConfidence)}</li>
          <li><strong>Scope confidence:</strong> ${esc(e.confidenceLevel.scopeConfidence)}</li>
          <li><strong>Pricing confidence:</strong> ${esc(e.confidenceLevel.pricingConfidence)}</li>
        </ul>
      </div>
      <div class="result-section">
        <h3>11. Site Visit Decision</h3>
        <p><strong>${esc(e.siteVisitDecision.decision)}</strong></p>
        <p>${esc(e.siteVisitDecision.reason)}</p>
      </div>
      <div class="result-section full">
        <h3>12. Obsessed Scope Details</h3>
        <div class="scope-columns">
          <div>
            <h4>Included</h4>
            <ul>${e.obsessedScope.included.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>
          </div>
          <div>
            <h4>Excluded / Requires Approval</h4>
            <ul>${e.obsessedScope.excluded.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>
          </div>
          <div>
            <h4>Pricing Assumptions</h4>
            <ul>${e.obsessedScope.measurementAssumptions.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>
          </div>
        </div>
      </div>
      <div class="result-section full">
        <h3>13. What Could Change Final Price</h3>
        <ul>${e.priceChangeFactor.map(f=>`<li>${esc(f)}</li>`).join("")}</ul>
      </div>
      <div class="result-section full">
        <h3>14. Customer Message Draft</h3>
        <pre>${esc(e.customerMessage)}</pre>
      </div>
      <div class="result-section full">
        <h3>15. Visual Preview Instructions</h3>
        <pre>${esc(e.visualPreviewPrompt)}</pre>
      </div>
      <div class="result-section full">
        <h3>16. Human Approval Requirement</h3>
        <p>${esc(e.humanApprovalRequirement)}</p>
      </div>
    </div>`;
}

function renderCrewTab(e, dangerClass) {
  const j = e.jobSnapshot;
  document.getElementById("tab-crew").innerHTML = `
    <div class="crew-company-header">
      <div class="crew-company-logo">🌳 Dynamic Tree</div>
      <div class="crew-company-details">
        <span><strong>Dynamic Tree Services</strong></span>
        <span>Licensed &amp; Insured · ISA Certified Arborists</span>
        <span>📞 (555) 555-5555 · dynamictreeservices.com</span>
      </div>
      <div class="crew-job-id">
        <span class="crew-job-id-label">Job ID</span>
        <span class="crew-job-id-value">${esc(e.jobId)}</span>
      </div>
    </div>
    <div class="crew-grid">
      <div class="crew-block">
        <h4>Job Information</h4>
        <div class="crew-field"><strong>Customer:</strong><span>${esc(j.customer)}</span></div>
        <div class="crew-field"><strong>Phone:</strong><span>${esc(j.phone)}</span></div>
        <div class="crew-field"><strong>Email:</strong><span>${esc(j.email)}</span></div>
        <div class="crew-field"><strong>Address:</strong><span>${esc(j.address)}</span></div>
        <div class="crew-field"><strong>GPS:</strong><span>${esc(j.gps)}</span></div>
        <div class="crew-field"><strong>Contact pref:</strong><span>${esc(j.preferredContact)}</span></div>
        <div class="crew-field"><strong>Urgency:</strong><span>${esc(j.urgency)}</span></div>
        <div class="crew-field"><strong>Completion:</strong><span>${esc(j.completionWindow)}</span></div>
      </div>
      <div class="crew-block">
        <h4>Scope &amp; Classification</h4>
        <div class="crew-field"><strong>Service preset:</strong><span>${esc(e.servicePreset)}</span></div>
        <div class="crew-field"><strong>Obsessed scope:</strong><span>${esc(e.obsessedScope.headline)}</span></div>
        <div class="crew-field"><strong>Work zone:</strong><span>${esc(e.obsessedScope.workZone)}</span></div>
        <div class="crew-field"><strong>Finish:</strong><span>${esc(e.jobSnapshot.clearanceGoal)}</span></div>
        <div class="crew-field"><strong>Requested work:</strong><span>${esc(j.requestedWork)}</span></div>
        <div class="crew-field"><strong>Cleanup:</strong><span>${esc(j.cleanupPreference)}</span></div>
        <div class="crew-field"><strong>Risk level:</strong><span><span class="badge ${dangerClass}" style="font-size:0.78rem">${esc(e.riskLevel)}</span></span></div>
        <div class="crew-field"><strong>Photo score:</strong><span>${esc(e.photoPacketScore.singlePhotoScore)}</span></div>
        <div class="crew-field"><strong>Tree size:</strong><span>${esc(e.jobSnapshot.requestedWork.includes("Shrub")?"Shrub":e.visibleTreeReview.approximateSizeClass)}</span></div>
        <div class="crew-field"><strong>Access:</strong><span>${esc(e.jobSnapshot.accessClass)}</span></div>
        <div class="crew-field"><strong>Species guess:</strong><span>${esc(e.visibleTreeReview.likelySpecies)}</span></div>
      </div>
      <div class="crew-block">
        <h4>Estimate &amp; Resources</h4>
        <div class="crew-field"><strong>Est. crew hours:</strong><span>${e.meta.estimatedCrewHours}</span></div>
        <div class="crew-field"><strong>Crew profile:</strong><span>${esc(e.meta.crewProfile)}</span></div>
        <div class="crew-field"><strong>Est. debris:</strong><span>${e.meta.debrisCubicYards} cu yd</span></div>
        <div class="crew-field"><strong>Price low:</strong><span>${fmt(e.preliminaryEstimateRange.low)}</span></div>
        <div class="crew-field"><strong>Price expected:</strong><span>${fmt(e.preliminaryEstimateRange.expected)}</span></div>
        <div class="crew-field"><strong>Price high:</strong><span>${fmt(e.preliminaryEstimateRange.high)}</span></div>
        <div class="crew-field"><strong>Approved scope:</strong><span>_______________</span></div>
        <div class="crew-field"><strong>Approved price:</strong><span>_______________</span></div>
        <div class="crew-field"><strong>Human reviewer:</strong><span>_______________</span></div>
        <div class="crew-field"><strong>Date approved:</strong><span>_______________</span></div>
      </div>
      <div class="crew-block">
        <h4>Safety Flags &amp; Concerns</h4>
        <ul class="stop-work-list">${e.safetyRiskFlags.map(f=>`<li>${esc(f)}</li>`).join("")}</ul>
        <p style="margin-top:10px;font-size:0.85rem"><strong>Concerns noted:</strong> ${esc(e.jobSnapshot.concernsNoted)}</p>
      </div>
      <div class="crew-block full">
        <h4>Internal Crew Notes</h4>
        <ul class="stop-work-list">${e.internalCrewNotes.map(n=>n==="---"?`</ul><hr style="margin:8px 0;border-color:var(--line)"><ul class="stop-work-list">`:
          `<li>${esc(n)}</li>`).join("")}</ul>
      </div>
      <div class="crew-block full danger-block">
        <h4>Crew Stop-Work Triggers — Stop and call manager if:</h4>
        <ul class="stop-work-list">
          <li>Wires are closer than expected or work zone is near energized lines</li>
          <li>Limb size, weight, or canopy density is larger than estimated</li>
          <li>Roof, gutter, fence, vehicle, road, sidewalk, or neighbor property risk is higher than expected</li>
          <li>Tree has hidden decay, cracks, split unions, cavities, or unstable limbs</li>
          <li>Customer requests extra work not in approved scope</li>
          <li>Access is blocked or ground conditions are unsafe</li>
          <li>Weather changes safety conditions (wind, ice, rain)</li>
          <li>Tree does not match record photo — size, condition, or structure is significantly different</li>
          <li>Any situation where crew member is not confident about safe execution</li>
        </ul>
      </div>
      <div class="crew-block full">
        <h4>Use These Terms — Never These Terms</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <p style="color:var(--brand-dark);font-weight:700;margin:0 0 6px">APPROVED LANGUAGE</p>
            <ul class="stop-work-list">
              <li>Clearance pruning</li><li>Crown cleaning</li><li>Crown raising</li>
              <li>Selective reduction</li><li>Structural pruning</li><li>Deadwood removal</li>
              <li>End-weight reduction</li><li>Canopy balancing</li><li>Roof clearance</li>
              <li>Natural target pruning</li><li>Reduction cut to lateral</li>
            </ul>
          </div>
          <div>
            <p style="color:#8a2722;font-weight:700;margin:0 0 6px">NEVER USE</p>
            <ul class="stop-work-list">
              <li>Top the tree</li><li>Hack it back</li><li>Cut in half</li>
              <li>Remove most of the canopy</li><li>Make it safe, guaranteed</li>
              <li>Fix the tree</li><li>Cure disease</li><li>Lion's tail</li>
              <li>Flush cut</li><li>Stub out</li>
            </ul>
          </div>
        </div>
      </div>
    </div>`;
}

function renderScienceTab(e) {
  const sp = e.species;
  let speciesHtml = sp ? `
    <div class="species-science-card">
      <h3>${esc(sp.name)}</h3>
      <div class="latin">${esc(sp.scientific)}</div>
      ${sp.alert ? `<div class="science-alert">⚠ ${esc(sp.alert)}</div>` : ""}
      <div class="science-grid">
        <div class="science-item"><h4>Best Pruning Window</h4><p>${esc(sp.pruningWindow)}</p></div>
        <div class="science-item"><h4>Primary Risk</h4><p>${esc(sp.primaryRisk)}</p></div>
        <div class="science-item"><h4>Max Live Crown Removal</h4><p>${esc(sp.maxRemoval)}</p></div>
        <div class="science-item"><h4>CODIT Response</h4><p>${esc(sp.codit)}</p></div>
        <div class="science-item"><h4>Best Practices</h4><ul>${sp.bestPractices.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></div>
        <div class="science-item"><h4>Common Issues</h4><p>${esc(sp.commonIssues)}</p></div>
        <div class="science-item"><h4>Root Zone</h4><p>${esc(sp.rootZone)}</p></div>
      </div>
    </div>` : `<p style="color:var(--muted);margin-bottom:20px">No species was identified from the form input. Enter a species in the form to receive species-specific arborist science notes here.</p>`;

  document.getElementById("tab-science").innerHTML = `
    ${speciesHtml}
    <div class="visual-preview-box">
      <h4>AI Visual Preview Prompt (for this job)</h4>
      <p style="font-size:0.85rem;color:var(--muted)">Use with DALL-E, Midjourney, Stable Diffusion, or similar. Always review with manager before sharing with customer.</p>
      <pre>${esc(e.visualPreviewPrompt)}</pre>
      <button class="copy-btn" onclick="copyText(this,'${btoa(encodeURIComponent(e.visualPreviewPrompt))}')">Copy Prompt</button>
    </div>
    <div style="margin-top:20px">
      <h3 style="color:var(--brand-dark);margin-bottom:12px">ISA Standard Pruning Rules (Quick Reference)</h3>
      <ul class="ref-list">
        <li><strong>25% Rule:</strong> Never remove more than 25–30% of live crown in one growing season.</li>
        <li><strong>Branch collar:</strong> Cut just outside the collar — never flush, never into it.</li>
        <li><strong>3-cut method:</strong> Required for all limbs over 2 inches diameter.</li>
        <li><strong>CODIT:</strong> Trees compartmentalize, not heal. Good cuts = good walling response.</li>
        <li><strong>Root zone:</strong> CRZ = 1 ft radius per inch DBH. Protect it during all operations.</li>
        <li><strong>Utility clearance:</strong> Within 10 ft of energized lines = OSHA qualified crew only.</li>
        <li><strong>No topping. No lion's tailing. No stub cuts. No flush cuts.</strong></li>
      </ul>
    </div>`;
}

// ============================================================
// COPY HELPER
// ============================================================
function copyText(btn, encoded) {
  const text = decodeURIComponent(atob(encoded));
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = orig; }, 1800);
  });
}

// ============================================================
// ACCORDION
// ============================================================
document.addEventListener("click", e => {
  const btn = e.target.closest(".accordion-btn");
  if (!btn) return;
  const target = btn.dataset.target;
  const body = document.getElementById(target);
  if (!body) return;
  const open = !body.hidden;
  body.hidden = open;
  btn.classList.toggle("open", !open);
});

// ============================================================
// PHOTO UPLOAD + ANNOTATION
// ============================================================
document.getElementById("photoUpload").addEventListener("change", evt => {
  const file = evt.target.files[0];
  const preview = document.getElementById("photoPreview");
  const wrap = document.getElementById("annotationWrap");
  const canvas = document.getElementById("annotationCanvas");

  if (!file) { wrap.hidden = true; preview.removeAttribute("src"); return; }

  const reader = new FileReader();
  reader.onload = re => {
    preview.src = re.target.result;
    preview.hidden = false;
    wrap.hidden = false;

    preview.onload = () => {
      const input = getFormInput();
      const servicePreset = classifyService(
        input.customerAnswers.requestedWork,
        input.customerAnswers.accessUtilitySafetyConcerns
      );
      const riskLevel = determineRiskLevel(input, servicePreset);
      drawAnnotations(canvas, preview, input, servicePreset, riskLevel);
    };
  };
  reader.readAsDataURL(file);
});

// Redraw annotation when key form fields change
["requestedWork","photoScore","plantType","workSide","clearanceGoal","accessClass","treeSizeClass","concerns","nearestTargetDistanceFeet"].forEach(id => {
  document.getElementById(id).addEventListener("change", () => {
    const preview = document.getElementById("photoPreview");
    const canvas = document.getElementById("annotationCanvas");
    if (!preview.src || preview.hidden) return;
    const input = getFormInput();
    const sp = classifyService(input.customerAnswers.requestedWork, input.customerAnswers.accessUtilitySafetyConcerns);
    const rl = determineRiskLevel(input, sp);
    drawAnnotations(canvas, preview, input, sp, rl);
  });
});

document.querySelectorAll(".photo-check").forEach(box => {
  box.addEventListener("change", () => {
    const preview = document.getElementById("photoPreview");
    const canvas = document.getElementById("annotationCanvas");
    if (!preview.src || preview.hidden) return;
    const input = getFormInput();
    const sp = classifyService(input.customerAnswers.requestedWork, input.customerAnswers.accessUtilitySafetyConcerns);
    const rl = determineRiskLevel(input, sp);
    drawAnnotations(canvas, preview, input, sp, rl);
  });
});

// ============================================================
// FORM SUBMIT
// ============================================================
document.getElementById("estimateForm").addEventListener("submit", evt => {
  evt.preventDefault();
  const input = getFormInput();
  const estimate = buildEstimate(input);

  // Redraw final annotation
  const preview = document.getElementById("photoPreview");
  const canvas = document.getElementById("annotationCanvas");
  if (preview.src && !preview.hidden) {
    drawAnnotations(canvas, preview, input, estimate.servicePreset, estimate.riskLevel);
  }

  renderResults(estimate);
});

// ============================================================
// DOWNLOAD ANNOTATION
// ============================================================
document.getElementById("downloadAnnotation").addEventListener("click", () => {
  const canvas = document.getElementById("annotationCanvas");
  const a = document.createElement("a");
  a.download = "treevision-annotation.png";
  a.href = canvas.toDataURL("image/png");
  a.click();
});

// ============================================================
// TAB SWITCHING
// ============================================================
document.addEventListener("click", e => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  const tab = btn.dataset.tab;

  document.querySelectorAll(".tab-btn").forEach(b => { b.classList.remove("active"); b.setAttribute("aria-selected","false"); });
  document.querySelectorAll(".tab-panel").forEach(p => { p.hidden = true; });

  btn.classList.add("active");
  btn.setAttribute("aria-selected","true");
  const panel = document.getElementById("tab-"+tab);
  if (panel) panel.hidden = false;
});

// ============================================================
// RESET
// ============================================================
document.getElementById("resetButton").addEventListener("click", () => {
  document.getElementById("estimateForm").reset();
  document.getElementById("photoPreview").hidden = true;
  document.getElementById("annotationWrap").hidden = true;
  document.getElementById("results").hidden = true;
  // Reset tabs
  document.querySelectorAll(".tab-btn").forEach((b,i) => { b.classList.toggle("active",i===0); });
  document.querySelectorAll(".tab-panel").forEach((p,i) => { p.hidden = i!==0; });
});

// ============================================================
// PRINT CREW PACKAGE
// ============================================================
document.getElementById("printCrew").addEventListener("click", () => {
  // Activate crew tab before printing
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => { p.hidden = true; });
  document.querySelector('[data-tab="crew"]').classList.add("active");
  document.getElementById("tab-crew").hidden = false;
  setTimeout(() => window.print(), 120);
});
