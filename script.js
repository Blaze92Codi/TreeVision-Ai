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
// ANNOTATION ENGINE
// ============================================================
function drawAnnotations(canvas, imgEl, input, servicePreset, riskLevel) {
  const ctx = canvas.getContext("2d");
  const maxW = canvas.parentElement.clientWidth || 560;
  const ratio = imgEl.naturalHeight / imgEl.naturalWidth;
  canvas.width = Math.min(maxW, 700);
  canvas.height = Math.round(canvas.width * ratio);
  const W = canvas.width, H = canvas.height;

  ctx.drawImage(imgEl, 0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  ctx.fillRect(0, 0, W, H);

  const zones = buildAnnotationZones(input, servicePreset, riskLevel, W, H);
  zones.forEach(z => drawZone(ctx, z));

  const cuts = buildCutPoints(servicePreset, W, H);
  if (cuts.length) drawCutPoints(ctx, cuts);

  // Branding / disclaimer
  const disclaimerY = H - 2;
  ctx.font = "bold 11px Arial";
  const brandW = ctx.measureText("TreeVision AI · Dynamic Tree").width;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, H - 32, W, 32);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText("TreeVision AI · Dynamic Tree", 10, H - 18);
  ctx.font = "9px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText("Illustrative Preview — Final result may vary after field inspection.", 10, H - 6);
}

function buildAnnotationZones(input, servicePreset, riskLevel, W, H) {
  const zones = [];
  const concerns = (input.customerAnswers.accessUtilitySafetyConcerns || "").toLowerCase();
  const access = input.estimateAnswers.accessClass;
  const work = (input.customerAnswers.requestedWork || "").toLowerCase();

  // Always: trunk zone
  zones.push({ x: W*0.38, y: H*0.62, w: W*0.24, h: H*0.28,
    fill: "rgba(120,75,35,0.18)", stroke: "rgba(90,55,20,0.65)",
    label: "TRUNK ZONE", lpos: "bottom", dash: false });

  // Always: root zone
  zones.push({ x: W*0.18, y: H*0.87, w: W*0.64, h: H*0.10,
    fill: "rgba(120,75,35,0.10)", stroke: "rgba(90,55,20,0.40)",
    label: "ROOT ZONE — PROTECT", lpos: "bottom", dash: true });

  // Service-specific work zones
  switch (servicePreset) {
    case "Light Trim":
      zones.push({ x: W*0.07, y: H*0.04, w: W*0.86, h: H*0.54,
        fill: "rgba(255,165,0,0.10)", stroke: "rgba(255,140,0,0.60)",
        label: "LIGHT TRIM — OUTER CANOPY ONLY", lpos: "top", dash: true });
      break;

    case "Structural / Clearance Trim":
      zones.push({ x: W*0.06, y: H*0.03, w: W*0.88, h: H*0.56,
        fill: "rgba(255,165,0,0.16)", stroke: "rgba(255,140,0,0.72)",
        label: "CANOPY WORK ZONE — CLEARANCE PRUNING", lpos: "top", dash: false });
      if (concerns.includes("house") || concerns.includes("roof") || work.includes("house") || work.includes("trim away")) {
        zones.push({ x: W*0.66, y: H*0.08, w: W*0.30, h: H*0.52,
          fill: "rgba(30,110,210,0.10)", stroke: "rgba(30,100,200,0.70)",
          label: "CLEARANCE TARGET", lpos: "top", dash: true });
      }
      if (concerns.includes("driveway") || concerns.includes("sidewalk")) {
        zones.push({ x: W*0.04, y: H*0.72, w: W*0.40, h: H*0.20,
          fill: "rgba(30,110,210,0.08)", stroke: "rgba(30,100,200,0.60)",
          label: "PAVEMENT CLEARANCE", lpos: "bottom", dash: true });
      }
      break;

    case "Reduction / Cutback":
      zones.push({ x: W*0.04, y: H*0.02, w: W*0.92, h: H*0.62,
        fill: "rgba(255,140,0,0.20)", stroke: "rgba(220,100,0,0.78)",
        label: "SELECTIVE REDUCTION ZONE — END-WEIGHT REMOVAL", lpos: "top", dash: false });
      break;

    case "Small Tree Removal":
    case "Medium / Large Tree Removal":
      zones.push({ x: W*0.05, y: H*0.02, w: W*0.90, h: H*0.62,
        fill: "rgba(190,40,40,0.14)", stroke: "rgba(170,25,25,0.68)",
        label: servicePreset === "Small Tree Removal" ? "REMOVAL ZONE — SMALL TREE" : "REMOVAL ZONE — LARGE TREE · RIGGING LIKELY",
        lpos: "top", dash: false });
      zones.push({ x: W*0.08, y: H*0.58, w: W*0.84, h: H*0.18,
        fill: "rgba(190,190,0,0.10)", stroke: "rgba(160,160,0,0.55)",
        label: "CONTROLLED DROP ZONE", lpos: "bottom", dash: true });
      break;

    case "Hazard / Storm Damage Review":
      zones.push({ x: W*0.04, y: H*0.02, w: W*0.92, h: H*0.62,
        fill: "rgba(200,40,40,0.18)", stroke: "rgba(190,0,0,0.80)",
        label: "HAZARD REVIEW ZONE — SITE VISIT REQUIRED", lpos: "top", dash: true });
      break;

    case "Stump Grinding":
      zones.push({ x: W*0.32, y: H*0.68, w: W*0.36, h: H*0.22,
        fill: "rgba(255,165,0,0.22)", stroke: "rgba(200,110,0,0.78)",
        label: "STUMP GRIND ZONE", lpos: "bottom", dash: false });
      break;

    case "Shrub Trim / Shrub Removal":
      zones.push({ x: W*0.08, y: H*0.28, w: W*0.84, h: H*0.50,
        fill: "rgba(80,180,60,0.12)", stroke: "rgba(40,140,40,0.62)",
        label: "SHRUB WORK ZONE", lpos: "top", dash: false });
      break;

    default:
      zones.push({ x: W*0.07, y: H*0.04, w: W*0.86, h: H*0.54,
        fill: "rgba(255,165,0,0.14)", stroke: "rgba(255,140,0,0.65)",
        label: "CANOPY WORK ZONE", lpos: "top", dash: false });
  }

  // Drop zone (not stump/shrub)
  if (!["Stump Grinding","Shrub Trim / Shrub Removal"].includes(servicePreset) &&
      !["Small Tree Removal","Medium / Large Tree Removal"].includes(servicePreset)) {
    zones.push({ x: W*0.06, y: H*0.57, w: W*0.88, h: H*0.14,
      fill: "rgba(190,190,0,0.08)", stroke: "rgba(160,160,0,0.50)",
      label: "DROP ZONE", lpos: "bottom", dash: true });
  }

  // Access corridor
  zones.push({
    x: access === "Tight" ? W*0.40 : W*0.04,
    y: H*0.73,
    w: access === "Tight" ? W*0.20 : W*0.28,
    h: H*0.24,
    fill: "rgba(40,160,70,0.10)", stroke: "rgba(30,130,55,0.60)",
    label: `ACCESS: ${access.toUpperCase()}`, lpos: "bottom",
    dash: access === "Tight",
  });

  // Structure protection zone
  if (/roof|house|pool|fence|garage|shed/.test(concerns)) {
    zones.push({ x: W*0.63, y: H*0.04, w: W*0.33, h: H*0.38,
      fill: "rgba(200,40,40,0.10)", stroke: "rgba(180,25,25,0.68)",
      label: "PROTECT STRUCTURE", lpos: "top", dash: true });
  }

  // Risk badge
  if (riskLevel === "Site Visit Required" || riskLevel === "High") {
    zones.push({ type: "badge", x: W*0.02, y: H*0.02,
      text: `⚠ ${riskLevel.toUpperCase()}`,
      bg: riskLevel === "Site Visit Required" ? "rgba(190,30,30,0.90)" : "rgba(220,120,0,0.90)" });
  }

  return zones;
}

function drawZone(ctx, z) {
  if (z.type === "badge") {
    ctx.save();
    ctx.font = "bold 11px Arial";
    const tw = ctx.measureText(z.text).width;
    ctx.fillStyle = z.bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(z.x, z.y, tw + 16, 22, 4);
    else ctx.rect(z.x, z.y, tw + 16, 22);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(z.text, z.x + 8, z.y + 15);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.setLineDash(z.dash ? [7, 4] : []);
  ctx.fillStyle = z.fill;
  ctx.strokeStyle = z.stroke;
  ctx.lineWidth = 2;

  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(z.x, z.y, z.w, z.h, 8);
  else ctx.rect(z.x, z.y, z.w, z.h);
  ctx.fill();
  ctx.stroke();

  if (z.label) {
    ctx.setLineDash([]);
    ctx.font = "bold 10px Arial";
    const tw = ctx.measureText(z.label).width;
    const lx = z.x + z.w / 2 - tw / 2;
    const ly = z.lpos === "top" ? z.y + 15 : z.y + z.h - 5;
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    if (ctx.roundRect) ctx.roundRect(lx - 5, ly - 13, tw + 10, 17, 3);
    else ctx.rect(lx - 5, ly - 13, tw + 10, 17);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(z.label, lx, ly);
  }
  ctx.restore();
}

function buildCutPoints(servicePreset, W, H) {
  if (["Small Tree Removal","Medium / Large Tree Removal","Stump Grinding","Shrub Trim / Shrub Removal","Hazard / Storm Damage Review"].includes(servicePreset)) return [];
  const pts = {
    "Light Trim": [[0.18,0.22],[0.82,0.26],[0.50,0.08],[0.30,0.30],[0.70,0.28]],
    "Structural / Clearance Trim": [[0.68,0.18],[0.75,0.32],[0.62,0.44],[0.72,0.50]],
    "Reduction / Cutback": [[0.15,0.15],[0.85,0.17],[0.50,0.04],[0.28,0.38],[0.72,0.36],[0.50,0.35]],
  };
  return (pts[servicePreset] || [[0.22,0.20],[0.78,0.22],[0.50,0.07]]).map(([fx,fy]) => ({ x: W*fx, y: H*fy }));
}

function drawCutPoints(ctx, pts) {
  pts.forEach(pt => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(210,165,0,0.28)";
    ctx.fill();
    ctx.strokeStyle = "rgba(190,145,0,0.90)";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pt.x - 5, pt.y); ctx.lineTo(pt.x + 5, pt.y);
    ctx.moveTo(pt.x, pt.y - 5); ctx.lineTo(pt.x, pt.y + 5);
    ctx.strokeStyle = "rgba(180,130,0,0.95)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  });
}

// ============================================================
// UTILITY HELPERS
// ============================================================
function money(v) { return Math.round(v / 5) * 5; }
function fmt(v) { return "$" + Number(v).toLocaleString(); }
function esc(v) {
  return String(v)
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function includesAny(text, kws) {
  const t = String(text||"").toLowerCase();
  return kws.some(k => t.includes(k));
}
// Negation-aware version: "no power lines", "not near wires" will NOT match
function includesAnyNotNegated(text, kws) {
  const t = String(text||"").toLowerCase();
  return kws.some(k => {
    let pos = 0;
    while (pos < t.length) {
      const idx = t.indexOf(k, pos);
      if (idx === -1) return false;
      const before = t.slice(Math.max(0, idx - 12), idx).trimEnd();
      if (!/\b(no|not|none|without|zero)\s*$/.test(before)) return true;
      pos = idx + 1;
    }
    return false;
  });
}
function generateJobId() {
  const n = new Date();
  const p = v => String(v).padStart(2,"0");
  return `DT-${n.getFullYear()}${p(n.getMonth()+1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}`;
}
function labelize(key) { return key.replace(/([A-Z])/g," $1").replace(/^./,s=>s.toUpperCase()); }

// ============================================================
// SERVICE CLASSIFICATION — 9 PRESETS
// ============================================================
function classifyService(requestedWork, concerns) {
  const work = String(requestedWork||"").toLowerCase();
  const combined = `${requestedWork} ${concerns}`.toLowerCase();

  if (includesAny(combined,["storm","hanging","split","crack","dead tree","emergency","uprooting","broken top"])) return "Hazard / Storm Damage Review";
  if (includesAnyNotNegated(combined,["power line","power lines","wires","service drop","transformer","utility pole"])) return "Site Visit Required";
  if (includesAny(work,["stump"])) return "Stump Grinding";
  if (includesAny(work,["shrub"])) return "Shrub Trim / Shrub Removal";
  if (includesAny(work,["medium or large","medium / large"])) return "Medium / Large Tree Removal";
  if (includesAny(work,["full tree removal (small)","removal (small"])) return "Small Tree Removal";
  if (includesAny(work,["full tree removal"])) return "Medium / Large Tree Removal";
  if (includesAny(work,["reduce","cut back","overhang","reduction","reduce overhang"])) return "Reduction / Cutback";
  if (includesAny(work,["house","roof","driveway","sidewalk","clearance","raise canopy","lift canopy","away from","trim away"])) return "Structural / Clearance Trim";
  if (includesAny(work,["shape","light trim","clean up","thin","balance","dead or hanging"])) return "Light Trim";
  return "Structural / Clearance Trim";
}

// ============================================================
// CREW HOURS — ALL 9 PRESETS
// ============================================================
function estimateCrewHours(servicePreset, size, access, photoScore) {
  const baseBySize = { Small:1.5, Medium:3, Large:5, "Very Large":7, Shrub:1.0 };
  const svcMult = {
    "Light Trim":0.85, "Structural / Clearance Trim":1.15, "Reduction / Cutback":1.45,
    "Small Tree Removal":1.40, "Medium / Large Tree Removal":2.40,
    "Hazard / Storm Damage Review":1.9, "Stump Grinding":0.75,
    "Shrub Trim / Shrub Removal":0.80, "Site Visit Required":1.6,
  };
  const accessMult = { Easy:1, Moderate:1.2, Tight:1.55 };
  const photoMult = { Excellent:1, Usable:1.1, Limited:1.25, "Not Quote-Ready":1.4 };
  const base = baseBySize[size] || 3;
  return base * (svcMult[servicePreset]||1.15) * (accessMult[access]||1) * (photoMult[photoScore]||1.1);
}

function estimateDebrisYards(servicePreset, size, cleanup) {
  if (cleanup==="Leave debris onsite"||cleanup==="Customer handles cleanup") return 0;
  const base = { Small:1, Medium:2.5, Large:5, "Very Large":7, Shrub:0.8 };
  const mult = {
    "Light Trim":0.70, "Structural / Clearance Trim":1.00, "Reduction / Cutback":1.40,
    "Small Tree Removal":2.20, "Medium / Large Tree Removal":3.80,
    "Hazard / Storm Damage Review":1.50, "Stump Grinding":0.25,
    "Shrub Trim / Shrub Removal":0.80, "Site Visit Required":1.20,
  };
  return (base[size]||2.5) * (mult[servicePreset]||1);
}

// ============================================================
// RISK
// ============================================================
function determineRiskLevel(input, servicePreset) {
  const concerns = input.customerAnswers.accessUtilitySafetyConcerns;
  const size = input.estimateAnswers.treeSizeClass;
  const access = input.estimateAnswers.accessClass;
  const dist = Number(input.estimateAnswers.nearestTargetDistanceFeet);
  const photo = input.photo;

  if (!photo.uploaded||photo.score==="Not Quote-Ready") return "Site Visit Required";
  if (servicePreset==="Site Visit Required"||servicePreset==="Hazard / Storm Damage Review") return "Site Visit Required";
  if (includesAny(concerns,SITE_VISIT_KEYWORDS)) return "Site Visit Required";
  if (size==="Very Large"||access==="Tight") return "High";
  if (!isNaN(dist)&&dist<=10) return "High";
  if (!isNaN(dist)&&dist<=25) return "Medium";
  if (size==="Large"||access==="Moderate") return "Medium";
  if (photo.score==="Limited") return "Medium";
  return "Low";
}

function riskBufferPct(rl) {
  return { Low:0.05, Medium:0.12, High:0.22 }[rl] ?? 0.30;
}

function bandPct(photoScore, rl) {
  if (rl==="Site Visit Required") return 0.38;
  if (rl==="High") return 0.28;
  if (photoScore==="Limited") return 0.32;
  if (photoScore==="Usable") return 0.22;
  return 0.16;
}

function pricingConfidence(photoScore, rl) {
  if (rl==="Site Visit Required"||photoScore==="Limited"||photoScore==="Not Quote-Ready") return "Low";
  if (rl==="High"||photoScore==="Usable") return "Medium";
  return "High";
}

// ============================================================
// BUILD ESTIMATE
// ============================================================
function buildEstimate(input, rates=DEFAULT_RATES) {
  const servicePreset = classifyService(
    input.customerAnswers.requestedWork,
    input.customerAnswers.accessUtilitySafetyConcerns
  );
  const riskLevel = determineRiskLevel(input, servicePreset);
  const siteVisitRequired = riskLevel==="Site Visit Required";

  const hours = estimateCrewHours(servicePreset, input.estimateAnswers.treeSizeClass, input.estimateAnswers.accessClass, input.photo.score);
  const debrisYards = estimateDebrisYards(servicePreset, input.estimateAnswers.treeSizeClass, input.customerAnswers.cleanupPreference);

  const labor = hours * rates.laborRatePerCrewHour;
  const travel = rates.travelBaseCharge;
  const fuel = rates.fuelCharge;
  const equip = rates.equipmentBaseCharge * (input.estimateAnswers.accessClass==="Tight"?1.35:1);
  const disposal = debrisYards * rates.disposalPerCubicYard;
  const materials = rates.materialCharge;
  const permit = rates.permitCoordination;
  const urgencyMult = input.estimateAnswers.urgencyLevel==="Emergency"?1.25:input.estimateAnswers.urgencyLevel==="Priority"?1.10:1;

  const subtotal = (labor+travel+fuel+equip+disposal+materials+permit) * urgencyMult;
  const overhead = subtotal * rates.overheadPercent;
  const buffer = subtotal * riskBufferPct(riskLevel);
  const beforeProfit = subtotal + overhead + buffer;
  const profit = beforeProfit * rates.profitMarginPercent;
  const expected = Math.max(money(beforeProfit+profit), rates.minimumJobCharge);
  const band = bandPct(input.photo.score, riskLevel);
  const low = money(expected*(1-band));
  const high = money(expected*(1+band));

  const species = guessSpecies(input.estimateAnswers.treeSpeciesGuess);

  return {
    servicePreset,
    riskLevel,
    siteVisitRequired,
    species,
    jobId: generateJobId(),
    jobSnapshot: {
      customer: input.jobInfo.customerName||"Not provided",
      phone: input.jobInfo.phone||"Not provided",
      email: input.jobInfo.email||"Not provided",
      address: input.jobInfo.address||"Not provided",
      gps: input.jobInfo.gpsPin||"Not provided",
      preferredContact: input.jobInfo.preferredContact||"Not specified",
      requestedWork: input.customerAnswers.requestedWork,
      cleanupPreference: input.customerAnswers.cleanupPreference,
      urgency: input.estimateAnswers.urgencyLevel,
      completionWindow: input.estimateAnswers.completionWindow||"Not specified",
      recordPhotoReceived: input.photo.uploaded?"Yes":"No",
      accessClass: input.estimateAnswers.accessClass||"Not specified",
      concernsNoted: input.customerAnswers.accessUtilitySafetyConcerns||"None reported",
    },
    intakeCompleteness: isIntakeComplete(input)?"Complete for preliminary screening":"Incomplete — missing required fields",
    missingItems: getMissingItems(input),
    photoPacketScore: {
      singlePhotoScore: input.photo.score,
      fullPacketStatus: "Incomplete — one record photo only (standard quote-ready packet requires 12 photos)",
      reason: photoScoreReason(input.photo.score),
    },
    visibleTreeReview: {
      likelySpecies: species ? `${species.name} (${species.scientific})` : "Unknown — not provided or not recognized",
      speciesConfidence: species ? "Low–Medium (form-input only, no photo analysis)" : "Unknown",
      approximateSizeClass: input.estimateAnswers.treeSizeClass,
      visibleCanopyNotes: "Canopy assessment based on customer-selected scope. Photo annotation zones are illustrative.",
      visibleHealthConcerns: "Visible symptoms cannot be diagnosed from form inputs alone. Human review required.",
    },
    safetyRiskFlags: buildRiskFlags(input, riskLevel),
    quoteFactors: {
      labor: money(labor*urgencyMult),
      travel: money(travel),
      fuel: money(fuel),
      equipment: money(equip),
      disposal: money(disposal),
      materials: money(materials),
      permitCoordination: permit,
      overhead: money(overhead),
      riskBuffer: money(buffer),
      profit: money(profit),
    },
    preliminaryEstimateRange: { low, expected, high },
    confidenceLevel: {
      photoConfidence: input.photo.score,
      scopeConfidence: input.photo.score==="Excellent"?"High":input.photo.score==="Usable"?"Medium":"Low",
      pricingConfidence: pricingConfidence(input.photo.score, riskLevel),
    },
    priceChangeFactor: buildPriceChangeFactors(input, servicePreset, riskLevel),
    siteVisitDecision: {
      decision: siteVisitRequired?"Site visit required before any pricing":"Remote pre-estimate possible with human approval",
      reason: siteVisitRequired
        ?"A safety, utility, hazard, photo-quality, or access trigger was found in the provided answers."
        :"No automatic site-visit trigger was detected in the provided answers. Human review still required before final quote.",
    },
    customerMessage: buildCustomerMessage(input, servicePreset, riskLevel, low, expected, high),
    internalCrewNotes: buildCrewNotes(input, servicePreset, riskLevel, hours, debrisYards),
    visualPreviewPrompt: buildVisualPreviewPrompt(input, servicePreset),
    humanApprovalRequirement: "Final quote, scope, pruning method, utility clearance review, safety review, and customer-facing visual require authorized human approval before any customer communication or work order.",
    meta: {
      estimatedCrewHours: +hours.toFixed(1),
      debrisCubicYards: +debrisYards.toFixed(1),
      riskLevel, siteVisitRequired, humanReviewRequired: true,
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
  const m = [];
  if (!input.jobInfo.customerName) m.push("Customer full name");
  if (!input.jobInfo.phone) m.push("Phone number");
  if (!input.jobInfo.email) m.push("Email address");
  if (!input.jobInfo.address) m.push("Job address / GPS");
  m.push("Full 12-photo packet required for final quote readiness");
  m.push("Manager or estimator approval before final price delivery");
  return m;
}

function photoScoreReason(score) {
  const r = {
    Excellent:"Full tree, trunk/base, work area, access area, and nearby targets appear well-documented.",
    Usable:"Tree and main work area visible, but some detail may still need review.",
    Limited:"Tree is visible, but trunk, scale, access, structure, or obstacle details may be unclear.",
    "Not Quote-Ready":"Photo does not show enough detail for responsible pricing. More photos or site visit required.",
  };
  return r[score]||r["Not Quote-Ready"];
}

function buildRiskFlags(input, riskLevel) {
  const flags = [];
  const c = input.customerAnswers.accessUtilitySafetyConcerns;
  if (includesAnyNotNegated(c,["power line","wire","service drop","transformer"])) flags.push("Utility clearance concern — site visit required");
  if (includesAny(c,["roof","house","garage","pool","shed","fence","driveway","road","sidewalk"])) flags.push("Nearby structure or target concern");
  if (includesAny(c,["storm","hanging","dead","split","crack","lean","uproot"])) flags.push("Hazard or storm damage concern");
  if (input.estimateAnswers.accessClass==="Tight") flags.push("Tight crew access");
  if (riskLevel==="Site Visit Required") flags.push("Automatic site visit / human review trigger activated");
  if (!flags.length) flags.push("No major concern reported — subject to photo and field review");
  return flags;
}

function buildPriceChangeFactors(input, servicePreset, riskLevel) {
  const f = [];
  f.push("Access or ground conditions differ from photo");
  f.push("Utility or wire proximity discovered during field review");
  if (input.estimateAnswers.treeSizeClass==="Large"||input.estimateAnswers.treeSizeClass==="Very Large") f.push("Limb weight or canopy density greater than estimated from photo");
  f.push("Hidden decay, cracks, split unions, or cavities discovered on-site");
  f.push("Cleanup volume larger or smaller than estimated debris yards");
  if (servicePreset==="Medium / Large Tree Removal") f.push("Crane, rigging, or traffic control required");
  if (input.customerAnswers.cleanupPreference!=="Leave debris onsite") f.push("Debris disposal costs vary with actual volume");
  f.push("Permit or utility coordination fees if required by municipality");
  return f;
}

function buildCustomerMessage(input, servicePreset, riskLevel, low, expected, high) {
  const name = input.jobInfo.customerName||"there";
  const urgency = input.estimateAnswers.urgencyLevel;
  return `Hi ${name}, thanks for sending the tree photo and answers.\n\nBased on the information provided, the likely service is: ${servicePreset}.\n\nYour preliminary 80% confidence estimate range is:\n  Low: ${fmt(low)}\n  Expected: ${fmt(expected)}\n  High: ${fmt(high)}\n\nRisk level: ${riskLevel}\nUrgency: ${urgency}\n${input.estimateAnswers.completionWindow?"Preferred completion: "+input.estimateAnswers.completionWindow+"\n":""}\nThis is a photo-based preliminary review, not a final inspection or final quote. Final pricing may change after human review due to access conditions, utility conflicts, limb weight, hidden decay, cleanup volume, traffic or sidewalk exposure, or field conditions that differ from the photo.\n\nRecommended next step: ${riskLevel==="Site Visit Required"?"Schedule a site visit before any pricing is confirmed.":"Manager review of this assessment before a final quote is delivered to you."}\n\nFinal scope and price require authorized company approval.`;
}

function buildCrewNotes(input, servicePreset, riskLevel, hours, debrisYards) {
  const lines = [
    `Work tree: Use uploaded record photo as reference.`,
    `Requested work: ${input.customerAnswers.requestedWork}`,
    `Service preset: ${servicePreset}`,
    `Photo score: ${input.photo.score}`,
    `Tree size class: ${input.estimateAnswers.treeSizeClass}`,
    `Access class: ${input.estimateAnswers.accessClass}`,
    `Nearest target: ${input.estimateAnswers.nearestTargetDistanceFeet} ft`,
    `Cleanup preference: ${input.customerAnswers.cleanupPreference}`,
    `Urgency: ${input.estimateAnswers.urgencyLevel}`,
    `Concerns noted: ${input.customerAnswers.accessUtilitySafetyConcerns||"None reported"}`,
    `Estimated crew hours: ${hours.toFixed(1)}`,
    `Estimated debris: ${debrisYards.toFixed(1)} cubic yards`,
    `Risk level: ${riskLevel}`,
    `---`,
    `PRUNING METHODS (use only these):`,
    `  Clearance pruning · Crown cleaning · Crown raising · Selective reduction`,
    `  Structural pruning · Deadwood removal · End-weight reduction · Canopy balancing`,
    `DO NOT: Top the tree. Flush cut. Lion's tail. Remove more than 25–30% live crown.`,
    `---`,
    `Human review and manager approval required before delivering final quote or scope.`,
  ];
  return lines;
}

function buildVisualPreviewPrompt(input, servicePreset) {
  const serviceDesc = {
    "Light Trim":"minor light shaping and selective outer-canopy trimming",
    "Structural / Clearance Trim":"structural clearance pruning trimming branches away from the structure on the property",
    "Reduction / Cutback":"selective crown reduction reducing overall canopy size with natural lateral cuts",
    "Small Tree Removal":"complete small tree removal with clean stump cut",
    "Medium / Large Tree Removal":"complete large tree removal showing cleared space",
    "Hazard / Storm Damage Review":"hazard limb removal and storm damage cleanup",
    "Stump Grinding":"stump grinding showing the stump removed to below grade",
    "Shrub Trim / Shrub Removal":"professional shrub trimming and shaping",
    "Site Visit Required":"light illustrative trimming (full scope requires site visit)",
  };
  return `Create a realistic illustrative before-and-after preview using the uploaded full-framed property photo. Preserve the house, yard, driveway, fence, street, sky, landscaping, and surrounding property exactly as shown. Modify only the selected tree. Show a natural professional result for: ${serviceDesc[servicePreset]||"professional tree trimming"}. Keep the tree's natural branching form realistic — do not show topping, excessive pruning, or artificial shape. Do not imply the tree is structurally safe, disease-free, or guaranteed to look exactly like the preview. Add a small, visible label in the corner: "Illustrative Preview - Final result may vary after field inspection." This is for customer communication only — not a final inspection or guarantee.`;
}

// ============================================================
// FORM INPUT READER
// ============================================================
function getFormInput() {
  return {
    photo: {
      uploaded: document.getElementById("photoUpload").files.length>0,
      score: document.getElementById("photoScore").value,
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
      treeSpeciesGuess: document.getElementById("treeSpeciesGuess").value,
      urgencyLevel: document.getElementById("urgencyLevel").value,
      completionWindow: document.getElementById("completionWindow").value,
    },
    jobInfo: {
      customerName: document.getElementById("customerName").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim(),
      address: document.getElementById("address").value.trim(),
      gpsPin: document.getElementById("gpsPin").value.trim(),
      preferredContact: document.getElementById("preferredContact").value,
    },
  };
}

// ============================================================
// RENDER — 4 TABS
// ============================================================
function renderResults(estimate) {
  document.getElementById("resultsTitle").textContent = estimate.servicePreset;
  const dangerClass = estimate.siteVisitRequired?"danger":estimate.riskLevel==="High"?"high":estimate.riskLevel==="Medium"?"warning":"success";

  renderCustomerTab(estimate, dangerClass);
  renderAssessmentTab(estimate, dangerClass);
  renderCrewTab(estimate, dangerClass);
  renderScienceTab(estimate);

  const results = document.getElementById("results");
  results.hidden = false;
  results.scrollIntoView({ behavior:"smooth", block:"start" });
}

function renderCustomerTab(e, dangerClass) {
  document.getElementById("tab-customer").innerHTML = `
    <div class="result-header-row">
      <div>
        <p class="eyebrow">Likely Service</p>
        <h3 style="margin:0;font-size:1.2rem">${esc(e.servicePreset)}</h3>
      </div>
      <span class="badge ${dangerClass}">${esc(e.riskLevel)}</span>
    </div>
    <div class="price-range">
      <div class="price-card"><span>Low (80% range)</span><strong>${fmt(e.preliminaryEstimateRange.low)}</strong></div>
      <div class="price-card expected"><span>Expected</span><strong>${fmt(e.preliminaryEstimateRange.expected)}</strong></div>
      <div class="price-card"><span>High (80% range)</span><strong>${fmt(e.preliminaryEstimateRange.high)}</strong></div>
    </div>
    <div class="section-grid">
      <div class="result-section">
        <h3>Confidence Level</h3>
        <ul>
          <li><strong>Photo:</strong> ${esc(e.confidenceLevel.photoConfidence)}</li>
          <li><strong>Scope:</strong> ${esc(e.confidenceLevel.scopeConfidence)}</li>
          <li><strong>Pricing:</strong> ${esc(e.confidenceLevel.pricingConfidence)}</li>
        </ul>
      </div>
      <div class="result-section">
        <h3>Site Visit Decision</h3>
        <p><strong>${esc(e.siteVisitDecision.decision)}</strong></p>
        <p>${esc(e.siteVisitDecision.reason)}</p>
      </div>
      <div class="result-section full">
        <h3>Customer Message Draft</h3>
        <pre>${esc(e.customerMessage)}</pre>
        <button class="copy-btn" onclick="copyText(this,'${btoa(encodeURIComponent(e.customerMessage))}')">Copy Message</button>
      </div>
      <div class="result-section full">
        <h3>AI Visual Preview Prompt</h3>
        <p style="color:var(--muted);font-size:0.85rem">Paste this into an AI image generator (DALL-E, Midjourney, etc.) along with the uploaded tree photo to generate an illustrative before/after preview. The result requires human review before showing to any customer.</p>
        <pre>${esc(e.visualPreviewPrompt)}</pre>
        <button class="copy-btn" onclick="copyText(this,'${btoa(encodeURIComponent(e.visualPreviewPrompt))}')">Copy Prompt</button>
      </div>
    </div>`;
}

function renderAssessmentTab(e, dangerClass) {
  const qf = e.quoteFactors;
  document.getElementById("tab-assessment").innerHTML = `
    <div class="section-grid">
      <div class="result-section">
        <h3>1. Job Snapshot</h3>
        <ul>
          ${Object.entries(e.jobSnapshot).map(([k,v])=>`<li><strong>${labelize(k)}:</strong> ${esc(v)}</li>`).join("")}
        </ul>
      </div>
      <div class="result-section">
        <h3>2. Intake Completeness</h3>
        <p><strong>${esc(e.intakeCompleteness)}</strong></p>
        <h3 style="margin-top:14px">3. Missing Items</h3>
        <ul>${e.missingItems.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>
      </div>
      <div class="result-section">
        <h3>4. Photo Packet Score</h3>
        <ul>
          <li><strong>Single-photo score:</strong> ${esc(e.photoPacketScore.singlePhotoScore)}</li>
          <li><strong>Full packet status:</strong> ${esc(e.photoPacketScore.fullPacketStatus)}</li>
          <li><strong>Reason:</strong> ${esc(e.photoPacketScore.reason)}</li>
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
        <h3>12. What Could Change Final Price</h3>
        <ul>${e.priceChangeFactor.map(f=>`<li>${esc(f)}</li>`).join("")}</ul>
      </div>
      <div class="result-section full">
        <h3>13. Customer Message Draft</h3>
        <pre>${esc(e.customerMessage)}</pre>
      </div>
      <div class="result-section full">
        <h3>14. Visual Preview Instructions</h3>
        <pre>${esc(e.visualPreviewPrompt)}</pre>
      </div>
      <div class="result-section full">
        <h3>15. Human Approval Requirement</h3>
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
["requestedWork","photoScore","accessClass","treeSizeClass","concerns","nearestTargetDistanceFeet"].forEach(id => {
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
