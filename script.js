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

const FIELD_JOB_STORE_KEY = "treevision.fieldJobs.v1";
let currentEstimate = null;

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
  canvas.width = Math.min(maxW, 900);
  canvas.height = Math.round(canvas.width * ratio);
  const W = canvas.width, H = canvas.height;

  // Draw photo
  ctx.drawImage(imgEl, 0, 0, W, H);
  // Work-zone preview style: keep the source photo readable while making
  // annotation bands legible in bright field photos.
  ctx.fillStyle = "rgba(7,24,18,0.38)";
  ctx.fillRect(0, 0, W, H);

  // Build and draw all zones
  const zones = buildAnnotationZones(input, servicePreset, riskLevel, W, H);
  zones.forEach(z => drawZone(ctx, z));

  // ISA cut-point markers (where lateral cuts apply)
  const cuts = buildCutPoints(servicePreset, W, H);
  if (cuts.length) drawCutPoints(ctx, cuts);

  // Work-zone title and ISA method banner
  const isaMethod = ISA_METHOD_LABEL[servicePreset] || "Canopy Review";
  ctx.save();
  ctx.font = "bold 12px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.textAlign = "center";
  ctx.fillText(`${servicePreset.toUpperCase()} ZONE`, W / 2, 24);
  ctx.restore();
  drawChip(ctx, `ISA: ${isaMethod}`, W - 8, 8, "right",
    "rgba(34,84,49,0.90)", "#fff");

  // Bottom disclaimer bar — Knowledge Base Visual Preview Policy
  ctx.fillStyle = "rgba(18,37,27,0.72)";
  ctx.fillRect(0, H - 32, W, 32);
  ctx.font = "bold 11px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText("TreeVision AI · Dynamic Tree Services", 10, H - 18);
  ctx.font = "9.5px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText("Illustrative preview. Final scope may vary after field inspection.", 10, H - 6);
}

function drawClientBeforeAfter(beforeCanvas, afterCanvas, imgEl, input, servicePreset, riskLevel) {
  if (!beforeCanvas || !afterCanvas || !imgEl || !imgEl.naturalWidth) return;
  const maxW = beforeCanvas.parentElement.clientWidth || 560;
  const ratio = imgEl.naturalHeight / imgEl.naturalWidth;
  const W = Math.min(maxW, 900);
  const H = Math.round(W * ratio);

  [beforeCanvas, afterCanvas].forEach(canvas => {
    canvas.width = W;
    canvas.height = H;
  });

  const beforeCtx = beforeCanvas.getContext("2d");
  const afterCtx = afterCanvas.getContext("2d");
  drawEstimateRecordPanel(beforeCtx, imgEl, input, servicePreset, riskLevel, W, H);
  drawProposedAfterPanel(afterCtx, imgEl, input, servicePreset, riskLevel, W, H);
}

function drawEstimateRecordPanel(ctx, imgEl, input, servicePreset, riskLevel, W, H) {
  ctx.drawImage(imgEl, 0, 0, W, H);
  drawPhotoVignette(ctx, W, H);
  drawPanelStamp(ctx, "BEFORE PHOTO", "Estimate-time record image", W, H, "#143b28");

  const treeId = input.scopeAnnotation.treeId || "Tree / shrub in uploaded photo";
  const target = input.scopeAnnotation.primaryRiskTarget || input.estimateAnswers.workSide || "Primary target";
  drawCallout(ctx, {
    x: W * 0.50, y: H * 0.24, tx: W * 0.08, ty: H * 0.11,
    title: "Existing canopy",
    body: servicePreset,
    color: "rgba(255,255,255,0.94)",
    accent: "rgba(34,84,49,0.95)",
  });
  drawCallout(ctx, {
    x: W * 0.50, y: H * 0.70, tx: W * 0.08, ty: H * 0.79,
    title: treeId,
    body: "Photo locked to estimate scope",
    color: "rgba(255,255,255,0.94)",
    accent: "rgba(120,75,35,0.95)",
  });
  drawCallout(ctx, {
    x: W * 0.76, y: H * 0.42, tx: W * 0.56, ty: H * 0.11,
    title: "Protect",
    body: target,
    color: "rgba(255,255,255,0.94)",
    accent: "rgba(30,90,180,0.95)",
  });
}

function drawProposedAfterPanel(ctx, imgEl, input, servicePreset, riskLevel, W, H) {
  ctx.drawImage(imgEl, 0, 0, W, H);
  const size = input.estimateAnswers.treeSizeClass || "Medium";
  const canopyH = { Small: 0.45, Medium: 0.55, Large: 0.64, "Very Large": 0.72, Shrub: 0.38 }[size] || 0.55;
  const canopy = { x: W * 0.08, y: H * 0.04, w: W * 0.84, h: H * canopyH };
  const isRemoval = /Removal/.test(servicePreset);
  const isStump = servicePreset === "Stump Grinding";
  const isShrub = servicePreset === "Shrub Trim / Shrub Removal";

  if (isRemoval) {
    paintLifelikeCanopyReduction(ctx, W, H, canopy, 0.82);
    drawMulchPatch(ctx, W * 0.50, H * 0.76, W * 0.18, H * 0.045);
    drawCallout(ctx, {
      x: W * 0.50, y: H * 0.28, tx: W * 0.07, ty: H * 0.12,
      title: "Removed",
      body: "Tree cleared to approved scope",
      color: "rgba(255,255,255,0.95)",
      accent: "rgba(160,30,30,0.95)",
    });
  } else if (isStump) {
    drawMulchPatch(ctx, W * 0.50, H * 0.77, W * 0.24, H * 0.06);
    drawCallout(ctx, {
      x: W * 0.50, y: H * 0.77, tx: W * 0.07, ty: H * 0.14,
      title: "Stump finish",
      body: "Ground below grade and cleaned",
      color: "rgba(255,255,255,0.95)",
      accent: "rgba(170,95,10,0.95)",
    });
  } else {
    const strength = servicePreset === "Light Trim" ? 0.20
      : servicePreset === "Structural / Clearance Trim" ? 0.34
      : servicePreset === "Reduction / Cutback" ? 0.46
      : isShrub ? 0.32
      : 0.28;
    paintLifelikeCanopyReduction(ctx, W, H, canopy, strength);
    drawCanopyFinishLine(ctx, canopy, servicePreset);
    drawCallout(ctx, {
      x: W * 0.70, y: H * 0.27, tx: W * 0.08, ty: H * 0.12,
      title: "Proposed finish",
      body: scopeFinishLabel(input, servicePreset),
      color: "rgba(255,255,255,0.95)",
      accent: "rgba(34,84,49,0.95)",
    });
  }

  if (/house|roof|garage|driveway|sidewalk|road|fence|utility|wire/i.test(`${input.scopeAnnotation.primaryRiskTarget} ${input.customerAnswers.accessUtilitySafetyConcerns}`)) {
    drawCallout(ctx, {
      x: W * 0.76, y: H * 0.50, tx: W * 0.56, ty: H * 0.12,
      title: "Clearance target",
      body: input.customerAnswers.clearanceGoal || "Maintain safe clearance",
      color: "rgba(255,255,255,0.95)",
      accent: "rgba(30,90,180,0.95)",
    });
  }

  drawPhotoVignette(ctx, W, H);
  drawPanelStamp(ctx, "PROPOSED AFTER", "Illustrative scope visual", W, H, "#7a3f16");
  drawScopeFooter(ctx, input, servicePreset, riskLevel, W, H);
}

function paintLifelikeCanopyReduction(ctx, W, H, canopy, strength) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 11; i++) {
    const fx = canopy.x + canopy.w * (0.08 + i * 0.085);
    const fy = canopy.y + canopy.h * (0.08 + (i % 4) * 0.11);
    const rw = canopy.w * (0.18 + (i % 3) * 0.045);
    const rh = canopy.h * (0.16 + (i % 2) * 0.05);
    const grad = ctx.createRadialGradient(fx, fy, 4, fx, fy, Math.max(rw, rh));
    grad.addColorStop(0, `rgba(210,224,213,${0.20 + strength * 0.24})`);
    grad.addColorStop(0.56, `rgba(155,185,145,${0.10 + strength * 0.12})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(fx, fy, rw, rh, (i % 5) * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.18 + strength * 0.16;
  ctx.fillStyle = "rgba(238,244,237,0.9)";
  ctx.beginPath();
  ctx.ellipse(canopy.x + canopy.w * 0.50, canopy.y + canopy.h * 0.13, canopy.w * 0.42, canopy.h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCanopyFinishLine(ctx, canopy, servicePreset) {
  ctx.save();
  ctx.setLineDash([8, 5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = servicePreset === "Reduction / Cutback" ? "rgba(180,95,0,0.86)" : "rgba(34,84,49,0.86)";
  ctx.beginPath();
  ctx.moveTo(canopy.x + canopy.w * 0.16, canopy.y + canopy.h * 0.22);
  ctx.bezierCurveTo(
    canopy.x + canopy.w * 0.32, canopy.y + canopy.h * 0.08,
    canopy.x + canopy.w * 0.66, canopy.y + canopy.h * 0.08,
    canopy.x + canopy.w * 0.84, canopy.y + canopy.h * 0.24
  );
  ctx.stroke();
  ctx.restore();
}

function drawMulchPatch(ctx, cx, cy, rx, ry) {
  ctx.save();
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
  grad.addColorStop(0, "rgba(130,78,36,0.86)");
  grad.addColorStop(0.7, "rgba(98,63,34,0.58)");
  grad.addColorStop(1, "rgba(78,52,30,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCallout(ctx, c) {
  ctx.save();
  const boxW = Math.min(210, Math.max(148, ctx.canvas.width * 0.38));
  const boxH = 52;
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(c.tx + boxW * 0.08, c.ty + boxH * 0.72);
  ctx.stroke();
  ctx.fillStyle = c.accent;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.color;
  if (ctx.roundRect) ctx.roundRect(c.tx, c.ty, boxW, boxH, 7);
  else ctx.rect(c.tx, c.ty, boxW, boxH);
  ctx.fill();
  ctx.strokeStyle = "rgba(18,37,27,0.18)";
  ctx.stroke();
  ctx.fillStyle = c.accent;
  ctx.font = "bold 11px Arial";
  ctx.fillText(c.title, c.tx + 10, c.ty + 18);
  ctx.fillStyle = "rgba(28,43,34,0.90)";
  ctx.font = "10px Arial";
  wrapCanvasText(ctx, c.body, c.tx + 10, c.ty + 34, boxW - 20, 12, 2);
  ctx.restore();
}

function drawPanelStamp(ctx, title, subtitle, W, H, color) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  if (ctx.roundRect) ctx.roundRect(10, 10, Math.min(250, W - 20), 42, 7);
  else ctx.rect(10, 10, Math.min(250, W - 20), 42);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = "bold 13px Arial";
  ctx.fillText(title, 22, 28);
  ctx.fillStyle = "rgba(75,90,80,0.95)";
  ctx.font = "10px Arial";
  ctx.fillText(subtitle, 22, 43);
  ctx.restore();
}

function drawScopeFooter(ctx, input, servicePreset, riskLevel, W, H) {
  ctx.save();
  ctx.fillStyle = "rgba(18,37,27,0.76)";
  ctx.fillRect(0, H - 42, W, 42);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px Arial";
  ctx.fillText(`${servicePreset} · ${riskLevel}`, 10, H - 25);
  ctx.font = "9.5px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  const done = input.scopeAnnotation.doneStandard || "Final scope requires estimator approval.";
  wrapCanvasText(ctx, `Client visual only. ${done}`, 10, H - 10, W - 20, 11, 1);
  ctx.restore();
}

function drawPhotoVignette(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0.12)");
  grad.addColorStop(0.35, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function wrapCanvasText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      lines++;
      if (lines >= maxLines) {
        ctx.fillText(`${line.replace(/[.,;:]$/, "")}...`, x, y);
        return;
      }
      ctx.fillText(line, x, y);
      y += lineH;
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y);
}

function scopeFinishLabel(input, servicePreset) {
  if (servicePreset === "Structural / Clearance Trim") return input.customerAnswers.clearanceGoal || "Clearance with natural form";
  if (servicePreset === "Reduction / Cutback") return "Reduced overhang, natural branch form retained";
  if (servicePreset === "Light Trim") return "Cleaned and balanced canopy";
  if (servicePreset === "Shrub Trim / Shrub Removal") return "Clean shaped ornamental finish";
  return input.scopeAnnotation.doneStandard || "Approved scope completed";
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
  const trunkY  = H * (0.55 + (canopyH - 0.55) * 0.16);
  const trunkH  = H * 0.25;

  // ════════════════════════════════════════════════════════
  // ALWAYS-PRESENT: TRUNK ZONE (Visible Trunk Review — KB p.6)
  // ════════════════════════════════════════════════════════
  const trunkLabel = /co.?dominant|split|included bark|crack|lean/.test(c)
    ? "TRUNK — INSPECT CO-DOMINANT STEMS"
    : /cavity|decay|mushroom/.test(c)
    ? "TRUNK — DECAY INDICATORS NOTED"
    : "TRUNK ZONE";
  zones.push({ x: W*0.38, y: trunkY, w: W*0.24, h: trunkH,
    fill: "rgba(120,75,35,0.16)", stroke: "rgba(90,55,20,0.65)",
    label: trunkLabel, lpos: "bottom", dash: false });

  // ════════════════════════════════════════════════════════
  // ALWAYS-PRESENT: ROOT ZONE (Visible Root Zone Review — KB p.6)
  // ════════════════════════════════════════════════════════
  const rootLabel = /underground|irrigation|septic|gas|fiber|invisible fence/.test(c)
    ? "ROOT ZONE — UNDERGROUND UTILITIES NOTED"
    : "CRITICAL ROOT ZONE — PROTECT FROM COMPACTION";
  zones.push({ x: W*0.14, y: H*0.82, w: W*0.72, h: H*0.08,
    fill: "rgba(120,75,35,0.20)", stroke: "rgba(90,55,20,0.56)",
    label: rootLabel, lpos: "bottom", dash: true });

  // ════════════════════════════════════════════════════════
  // SERVICE-SPECIFIC CANOPY ZONES — ISA BMP terminology
  // ════════════════════════════════════════════════════════
  switch (servicePreset) {

    case "Light Trim":
      // Crown cleaning + canopy balancing — outer ring only, max 25% live crown
      zones.push({ x: W*0.06, y: H*0.04, w: W*0.88, h: H*canopyH,
        fill: "rgba(40,160,70,0.09)", stroke: "rgba(30,130,55,0.58)",
        label: "CROWN CLEANING AREA", lpos: "top", dash: true });
      // Inner "do not enter" zone — protect live crown interior
      zones.push({ x: W*0.20, y: H*0.12, w: W*0.60, h: H*(canopyH*0.55),
        fill: "rgba(40,160,70,0.04)", stroke: "rgba(30,130,55,0.28)",
        label: "PRESERVE LIVE CROWN", lpos: "top", dash: true });
      break;

    case "Structural / Clearance Trim":
      // Main clearance pruning zone
      zones.push({ x: W*0.05, y: H*0.03, w: W*0.90, h: H*canopyH,
        fill: "rgba(17,55,40,0.20)", stroke: rc.stroke,
        label: "CLEARANCE PRUNING ZONE", lpos: "top", dash: false });
      // Crown raising sub-zone (lower canopy lifted)
      zones.push({ x: W*0.12, y: H*(canopyH*0.55), w: W*0.76, h: H*0.14,
        fill: "rgba(30,110,210,0.18)", stroke: "rgba(30,100,200,0.76)",
        label: "CROWN RAISING AREA", lpos: "bottom", dash: true });
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
        label: "SELECTIVE REDUCTION AREA", lpos: "top", dash: false });
      // End-weight reduction sub-zone — tips/outer canopy
      zones.push({ x: W*0.06, y: H*0.04, w: W*0.88, h: H*(canopyH*0.38),
        fill: "rgba(220,130,0,0.10)", stroke: "rgba(190,105,0,0.60)",
        label: "END-WEIGHT REMOVAL — OUTER TIPS", lpos: "top", dash: true });
      // Preserve: live crown interior
      zones.push({ x: W*0.22, y: H*(canopyH*0.38), w: W*0.56, h: H*(canopyH*0.40),
        fill: "rgba(40,160,70,0.05)", stroke: "rgba(30,130,55,0.30)",
        label: "PRESERVE LATERAL STRUCTURE", lpos: "bottom", dash: true });
      break;

    case "Small Tree Removal":
      zones.push({ x: W*0.06, y: H*0.03, w: W*0.88, h: H*(canopyH + 0.06),
        fill: "rgba(190,40,40,0.15)", stroke: "rgba(165,20,20,0.72)",
        label: "FULL REMOVAL ZONE — SMALL TREE", lpos: "top", dash: false });
      // Drop zone — size depends on target distance
      _pushDropZone(zones, dist, W, H, "Small Tree Removal");
      break;

    case "Medium / Large Tree Removal":
      zones.push({ x: W*0.04, y: H*0.02, w: W*0.92, h: H*(canopyH + 0.06),
        fill: rc.fill, stroke: rc.stroke,
        label: size === "Very Large"
          ? "FULL REMOVAL — CRANE / RIGGING LIKELY"
          : "FULL REMOVAL ZONE — RIGGING / STAGING",
        lpos: "top", dash: false });
      // Section cuts indicator
      zones.push({ x: W*0.28, y: H*(canopyH*0.25), w: W*0.44, h: H*(canopyH*0.50),
        fill: "rgba(190,40,40,0.08)", stroke: "rgba(165,20,20,0.42)",
        label: "SECTION CUTS — TOP-DOWN", lpos: "bottom", dash: true });
      _pushDropZone(zones, dist, W, H, "Medium / Large Tree Removal");
      break;

    case "Hazard / Storm Damage Review": {
      // Main hazard review zone
      zones.push({ x: W*0.04, y: H*0.02, w: W*0.92, h: H*(canopyH + 0.04),
        fill: "rgba(200,35,35,0.17)", stroke: "rgba(185,0,0,0.84)",
        label: "HAZARD REVIEW AREA", lpos: "top", dash: true });
      // Hanging / dead limb sub-zone
      if (/hanging|dead|broken|deadwood/.test(c)) {
        zones.push({ x: W*0.10, y: H*0.05, w: W*0.55, h: H*(canopyH*0.45),
          fill: "rgba(190,40,40,0.12)", stroke: "rgba(170,15,15,0.72)",
          label: "HANGING / DEAD LIMB ZONE", lpos: "top", dash: true });
      }
      // Split or crack sub-zone
      if (/split|crack|lean/.test(c)) {
        zones.push({ x: W*0.35, y: H*(canopyH*0.35), w: W*0.30, h: H*(canopyH*0.35),
          fill: "rgba(200,80,0,0.14)", stroke: "rgba(180,60,0,0.78)",
          label: "SPLIT / CRACK — STRUCTURAL CONCERN", lpos: "bottom", dash: true });
      }
      // Storm damage cleanup area
      if (/storm|uproot|broken top/.test(c)) {
        zones.push({ x: W*0.04, y: H*0.60, w: W*0.92, h: H*0.20,
          fill: "rgba(190,40,40,0.08)", stroke: "rgba(165,20,20,0.50)",
          label: "STORM DEBRIS CLEANUP AREA", lpos: "bottom", dash: true });
      }
      break;
    }

    case "Stump Grinding":
      zones.push({ x: W*0.30, y: H*0.65, w: W*0.40, h: H*0.25,
        fill: "rgba(255,165,0,0.22)", stroke: "rgba(195,110,0,0.82)",
        label: "STUMP GRIND — BELOW GRADE", lpos: "bottom", dash: false });
      // Underground utility warning if mentioned
      if (/underground|irrigation|septic|gas|fiber|invisible fence/.test(c)) {
        zones.push({ x: W*0.10, y: H*0.83, w: W*0.80, h: H*0.09,
          fill: "rgba(190,30,30,0.12)", stroke: "rgba(170,10,10,0.70)",
          label: "⚠ UNDERGROUND UTILITIES — HAND DIG / LOCATE FIRST", lpos: "bottom", dash: true });
      }
      break;

    case "Shrub Trim / Shrub Removal":
      zones.push({ x: W*0.07, y: H*0.25, w: W*0.86, h: H*0.52,
        fill: "rgba(80,180,60,0.12)", stroke: "rgba(40,140,40,0.65)",
        label: "SHRUB WORK ZONE — ORNAMENTAL PRUNING", lpos: "top", dash: false });
      // Natural form guidance
      zones.push({ x: W*0.14, y: H*0.30, w: W*0.72, h: H*0.38,
        fill: "rgba(40,160,70,0.05)", stroke: "rgba(30,130,55,0.28)",
        label: "MAINTAIN NATURAL FORM", lpos: "bottom", dash: true });
      break;

    case "Site Visit Required":
      zones.push({ x: W*0.03, y: H*0.02, w: W*0.94, h: H*(canopyH + 0.06),
        fill: "rgba(190,30,30,0.16)", stroke: "rgba(165,10,10,0.86)",
        label: "SITE VISIT REQUIRED", lpos: "top", dash: true });
      break;

    default:
      zones.push({ x: W*0.06, y: H*0.04, w: W*0.88, h: H*canopyH,
        fill: rc.fill, stroke: rc.stroke,
        label: "CANOPY WORK ZONE — PENDING CLASSIFICATION", lpos: "top", dash: false });
  }

  // ════════════════════════════════════════════════════════
  // DROP ZONE (trimming presets — based on target distance)
  // ════════════════════════════════════════════════════════
  const noDropPresets = ["Stump Grinding","Shrub Trim / Shrub Removal",
    "Small Tree Removal","Medium / Large Tree Removal","Site Visit Required"];
  if (!noDropPresets.includes(servicePreset)) {
    _pushDropZone(zones, dist, W, H, servicePreset);
  }

  // ════════════════════════════════════════════════════════
  // ACCESS CORRIDOR (Knowledge Base: access class)
  // ════════════════════════════════════════════════════════
  const accessColor = access === "Open"
    ? { fill:"rgba(40,160,70,0.10)", stroke:"rgba(30,130,55,0.55)" }
    : access === "Tight"
    ? { fill:"rgba(200,80,0,0.12)",  stroke:"rgba(175,55,0,0.68)"  }
    : { fill:"rgba(255,200,0,0.10)", stroke:"rgba(190,145,0,0.60)" };
  zones.push({
    x: access === "Tight" ? W*0.38 : W*0.03,
    y: H*0.70,
    w: access === "Tight" ? W*0.24 : W*0.30,
    h: H*0.16,
    fill: accessColor.fill, stroke: accessColor.stroke,
    label: `CREW ACCESS — ${access.toUpperCase()}`,
    lpos: "bottom", dash: access === "Tight",
  });

  // ════════════════════════════════════════════════════════
  // STRUCTURE PROTECTION ZONES (KB: Safety/Risk Flags)
  // ════════════════════════════════════════════════════════
  if (/roof|house|garage/.test(c) || /trim away|clearance|away from house/.test(work)) {
    zones.push({ x: W*0.63, y: H*0.04, w: W*0.33, h: H*0.36,
      fill: "rgba(30,110,210,0.08)", stroke: "rgba(20,90,190,0.65)",
      label: "PROTECT STRUCTURE", lpos: "bottom", dash: true });
  }
  if (/pool|car|vehicle/.test(c)) {
    zones.push({ x: W*0.60, y: H*0.55, w: W*0.36, h: H*0.22,
      fill: "rgba(30,110,210,0.08)", stroke: "rgba(20,90,190,0.60)",
      label: "PROTECT POOL / VEHICLE", lpos: "bottom", dash: true });
  }
  if (/fence|gate/.test(c)) {
    zones.push({ x: W*0.02, y: H*0.62, w: W*0.16, h: H*0.30,
      fill: "rgba(30,110,210,0.06)", stroke: "rgba(20,90,190,0.50)",
      label: "FENCE", lpos: "bottom", dash: true });
  }

  // ════════════════════════════════════════════════════════
  // UTILITY CLEARANCE ZONE — ALWAYS HIGH-PRIORITY
  // Power lines trigger site visit (KB: Automatic Triggers p.7)
  // ════════════════════════════════════════════════════════
  if (includesAnyNotNegated(c, ["power line","service drop","transformer","utility pole","wire"])) {
    zones.push({ x: W*0.04, y: H*0.01, w: W*0.92, h: H*0.12,
      fill: "rgba(190,30,30,0.18)", stroke: "rgba(165,10,10,0.88)",
      label: "⚡ UTILITY / POWER LINE — HUMAN REVIEW & CLEARANCE REQUIRED", lpos: "bottom", dash: true });
  }

  // ════════════════════════════════════════════════════════
  // RISK BADGE (top-left) — Risk Rating Matrix
  // ════════════════════════════════════════════════════════
  zones.push({ type: "badge", x: W*0.02, y: H*0.10,
    text: riskLevel === "Site Visit Required" ? "⚠ SITE VISIT REQUIRED"
        : riskLevel === "High"   ? "⚠ HIGH RISK"
        : riskLevel === "Medium" ? "● MEDIUM RISK"
        : "● LOW RISK",
    bg: rc.badge });

  return zones;
}

// Shared drop zone helper — width/position based on target distance
function _pushDropZone(zones, dist, W, H, servicePreset) {
  const isRemoval = ["Small Tree Removal","Medium / Large Tree Removal"].includes(servicePreset);
  const tight  = dist <= 5;
  const wide   = dist >= 20;
  const dropX  = tight ? W*0.20 : W*0.06;
  const dropW  = tight ? W*0.60 : wide ? W*0.92 : W*0.84;
  const dropY  = isRemoval ? H*0.54 : H*0.56;
  const dropH  = isRemoval ? H*0.16 : H*0.12;
  const lbl    = tight
    ? `TIGHT DROP — TARGET ${dist}ft AWAY`
    : wide
    ? "OPEN DROP ZONE"
    : `CONTROLLED DROP ZONE`;
  const dropFill   = tight ? "rgba(210,70,20,0.16)"  : "rgba(88,132,36,0.18)";
  const dropStroke = tight ? "rgba(185,45,10,0.78)"  : "rgba(168,178,28,0.66)";
  zones.push({ x: dropX, y: dropY, w: dropW, h: dropH,
    fill: dropFill, stroke: dropStroke, label: lbl, lpos: "bottom", dash: true });
}

function drawZone(ctx, z) {
  if (z.type === "badge") {
    ctx.save();
    ctx.font = "bold 11px Arial";
    const tw = ctx.measureText(z.text).width;
    const badgeW = z.text.includes("SITE VISIT") ? Math.max(tw + 26, 164) : tw + 18;
    ctx.fillStyle = z.bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(z.x, z.y, badgeW, 23, 5);
    else ctx.rect(z.x, z.y, badgeW, 23);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(z.text, z.x + 9, z.y + 16);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.setLineDash(z.dash ? [7, 4] : []);
  ctx.fillStyle = z.fill;
  ctx.strokeStyle = z.stroke;
  ctx.lineWidth = z.bold ? 2.5 : 1.6;

  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(z.x, z.y, z.w, z.h, 8);
  else ctx.rect(z.x, z.y, z.w, z.h);
  ctx.fill();
  ctx.stroke();

  if (z.label) {
    ctx.setLineDash([]);
    const maxTextW = Math.max(70, z.w - 16);
    ctx.font = "bold 11px Arial";
    let label = z.label;
    let tw = ctx.measureText(label).width;
    while (tw > maxTextW && label.length > 12) {
      label = `${label.slice(0, -2).trim()}…`;
      tw = ctx.measureText(label).width;
    }
    const lx = z.x + z.w / 2 - tw / 2;
    const ly = z.lpos === "top" ? z.y + 17 : z.y + z.h - 7;
    // Label pill background
    const pillColor = z.label.startsWith("⚡") || z.label.startsWith("⚠")
      ? "rgba(160,10,10,0.92)" : "rgba(18,37,27,0.84)";
    ctx.fillStyle = pillColor;
    if (ctx.roundRect) ctx.roundRect(lx - 7, ly - 15, tw + 14, 21, 5);
    else ctx.rect(lx - 7, ly - 15, tw + 14, 21);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(label, lx, ly);
  }
  ctx.restore();
}

// Chip label helper (used for ISA method banner)
function drawChip(ctx, text, x, y, align, bg, fg) {
  ctx.save();
  ctx.font = "bold 9.5px Arial";
  const tw = ctx.measureText(text).width;
  const cx = align === "right" ? x - tw - 14 : x;
  ctx.fillStyle = bg;
  if (ctx.roundRect) ctx.roundRect(cx, y, tw + 14, 20, 5);
  else ctx.rect(cx, y, tw + 14, 20);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.fillText(text, cx + 7, y + 14);
  ctx.restore();
}

// ISA Cut-point positions per service preset
// Each [fx, fy, label] = fractional x/y + short ISA cut type
function buildCutPoints(servicePreset, W, H) {
  const nocuts = ["Small Tree Removal","Medium / Large Tree Removal",
                  "Stump Grinding","Shrub Trim / Shrub Removal",
                  "Hazard / Storm Damage Review","Site Visit Required"];
  if (nocuts.includes(servicePreset)) return [];

  const defs = {
    "Light Trim": [
      [0.16,0.20,"CL"],[0.84,0.24,"CL"],[0.50,0.07,"CL"],
      [0.28,0.31,"CB"],[0.72,0.28,"CB"],[0.40,0.16,"DW"],
    ],
    "Structural / Clearance Trim": [
      [0.70,0.16,"CR"],[0.76,0.30,"CR"],[0.64,0.43,"CR"],
      [0.74,0.50,"CR"],[0.68,0.60,"RL"],[0.60,0.54,"RL"],
    ],
    "Reduction / Cutback": [
      [0.13,0.13,"SR"],[0.87,0.15,"SR"],[0.50,0.03,"SR"],
      [0.26,0.38,"EW"],[0.74,0.36,"EW"],[0.50,0.33,"EW"],
      [0.38,0.20,"SR"],[0.62,0.22,"SR"],
    ],
  };
  // Abbreviation legend: CL=Crown clean, CB=Canopy balance, DW=Deadwood,
  //   CR=Clearance/raise, RL=Remove lower limb, SR=Selective reduction, EW=End-weight
  return (defs[servicePreset] || [[0.22,0.20,""],[0.78,0.22,""],[0.50,0.07,""]])
    .map(([fx, fy, lbl]) => ({ x: W*fx, y: H*fy, lbl }));
}

function drawCutPoints(ctx, pts) {
  pts.forEach(pt => {
    ctx.save();
    // Outer glow ring
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(210,165,0,0.22)";
    ctx.fill();
    // Gold circle
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(190,145,0,0.92)";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([]);
    ctx.stroke();
    // Crosshair
    ctx.beginPath();
    ctx.moveTo(pt.x - 5, pt.y); ctx.lineTo(pt.x + 5, pt.y);
    ctx.moveTo(pt.x, pt.y - 5); ctx.lineTo(pt.x, pt.y + 5);
    ctx.strokeStyle = "rgba(175,125,0,0.95)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // ISA method abbreviation label
    if (pt.lbl) {
      ctx.font = "bold 8px Arial";
      const tw = ctx.measureText(pt.lbl).width;
      ctx.fillStyle = "rgba(34,84,49,0.88)";
      if (ctx.roundRect) ctx.roundRect(pt.x + 10, pt.y - 9, tw + 8, 14, 3);
      else ctx.rect(pt.x + 10, pt.y - 9, tw + 8, 14);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(pt.lbl, pt.x + 14, pt.y + 2);
    }
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
// Negation-aware version: "no known power lines", "not near wires" will NOT match
function includesAnyNotNegated(text, kws) {
  const t = String(text||"").toLowerCase();
  return kws.some(k => {
    let pos = 0;
    while (pos < t.length) {
      const idx = t.indexOf(k, pos);
      if (idx === -1) return false;
      const before = t.slice(Math.max(0, idx - 28), idx).trimEnd();
      if (!/\b(no|not|none|without|zero|no known|not near|not by|clear of)\b[\w\s-]*$/.test(before)) return true;
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
  const readiness = onePhotoReadiness(input);

  if (!photo.uploaded||photo.score==="Not Quote-Ready") return "Site Visit Required";
  if (servicePreset==="Site Visit Required"||servicePreset==="Hazard / Storm Damage Review") return "Site Visit Required";
  if (includesAny(concerns,SITE_VISIT_KEYWORDS)) return "Site Visit Required";
  if (readiness.missing.length >= 3) return "Site Visit Required";
  if (size==="Very Large"||access==="Tight") return "High";
  if (!isNaN(dist)&&dist<=10) return "High";
  if (readiness.missing.length >= 2) return "High";
  if (!isNaN(dist)&&dist<=25) return "Medium";
  if (size==="Large"||access==="Moderate") return "Medium";
  if (readiness.missing.length === 1) return "Medium";
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

function checkedPhotoItems() {
  return Array.from(document.querySelectorAll(".photo-check:checked")).map(el => el.value);
}

function onePhotoReadiness(input) {
  const required = ["Full crown visible", "Trunk or base visible", "Nearest target visible", "Crew access visible"];
  const checked = input.photo.checklist || [];
  const missing = required.filter(item => !checked.includes(item));
  const score = Math.round((checked.length / required.length) * 100);
  let status = "Quote-ready for preliminary scope";
  if (missing.length >= 2 || input.photo.score==="Limited") status = "Limited one-photo confidence";
  if (input.photo.score==="Not Quote-Ready" || missing.length >= 3) status = "Needs more photos or site visit";
  return { score, status, checked, missing };
}

function recommendedCrewProfile(size, servicePreset, access) {
  if (servicePreset==="Stump Grinding") return "1-2 person stump crew with grinder";
  if (servicePreset==="Shrub Trim / Shrub Removal") return "2 person detail crew with hedge tools, saws, and debris trailer";
  if (size==="Very Large" || servicePreset==="Medium / Large Tree Removal") return "4-5 person arborist crew; climbing, rigging, lift, or crane review possible";
  if (size==="Large" || access==="Tight") return "3-4 person arborist crew with rigging and controlled lowering plan";
  if (size==="Small") return "2-3 person pruning crew with pole saw, hand tools, chipper or trailer";
  return "3 person standard pruning crew with chipper/trailer support";
}

function buildObsessedScope(input, servicePreset, riskLevel, species) {
  const plant = input.photo.plantType || "Tree";
  const workSide = input.customerAnswers.workSide || "Open yard side";
  const clearance = input.customerAnswers.clearanceGoal || "Standard clearance, maintain natural form";
  const scope = input.scopeAnnotation || {};
  const isRemoval = /removal|stump/i.test(servicePreset) || /Remove to ground/i.test(clearance);
  const isShrub = /Shrub|Bush|Hedge/i.test(plant) || servicePreset==="Shrub Trim / Shrub Removal";
  const method = isRemoval
    ? "Sectional removal or ground-level removal as site conditions allow"
    : isShrub
      ? "Selective hand pruning, face reduction, deadwood cleanup, and natural shaping"
      : "ANSI A300 natural target pruning: crown cleaning, clearance pruning, crown raising, and selective reduction only";
  const finishStandard = isRemoval
    ? "Remove selected material to near grade unless stump grinding is separately approved."
    : isShrub
      ? "Even natural profile with no bald cuts into dead interior wood and no hard shearing unless approved."
      : "Maintain natural canopy architecture; no topping, flush cuts, stub cuts, lion's tailing, or removal over 25-30% live crown.";
  const included = [
    `Work item: ${scope.treeId || "Tree/shrub in uploaded one-photo record"} (${plant}).`,
    `Primary work zone: ${workSide}.`,
    `Customer finish target: ${clearance}.`,
    `Observed condition: ${scope.treeCondition || "Not specified"}.`,
    `Primary risk target: ${scope.primaryRiskTarget || "Not specified"}.`,
    `Method standard: ${method}.`,
    `Likely access/equipment: ${scope.equipmentPlan || "Not specified"}.`,
    `Utility/811 check: ${scope.utilityPlan || "Not specified"}.`,
    `Cleanup standard: ${input.customerAnswers.cleanupPreference}.`,
    `Done means: ${scope.doneStandard || "Final completion standard must be confirmed before approval."}`,
  ];
  if (species) included.push(`Species note: follow ${species.name} timing and wound-response protocol when scheduling.`);
  if (riskLevel==="Site Visit Required") included.push("Do not issue final price from photo alone; schedule estimator or qualified arborist review.");
  const excluded = [
    "No formal ISA TRAQ risk assessment from photo alone.",
    "No guarantee of tree health, structural safety, disease status, or future failure prevention.",
    "No energized utility-line work unless handled by qualified line-clearance arborists.",
    "No extra trees, shrubs, stump work, hauling change, or neighbor-side work unless added to approved scope.",
  ];
  const measurementAssumptions = [
    `Tree ID / scope tag: ${scope.treeId || "Not provided"}.`,
    `${input.estimateAnswers.treeSizeClass || "Unknown"} size class selected from intake.`,
    `${scope.dbhInches || "Unknown"} in DBH / trunk diameter used as field-check item.`,
    `${scope.estimatedHeightFeet || "Unknown"} ft estimated height used as field-check item.`,
    `${input.estimateAnswers.nearestTargetDistanceFeet || "Unknown"} ft nearest target distance used for risk and pricing.`,
    `${input.estimateAnswers.accessClass || "Unknown"} access class used for crew-hour multiplier.`,
    "One-photo pricing assumes visible canopy density and debris volume match field conditions.",
  ];
  return {
    headline: `${servicePreset} for ${plant}`,
    workZone: workSide,
    finishStandard,
    included,
    excluded,
    measurementAssumptions,
    crewProfile: recommendedCrewProfile(input.estimateAnswers.treeSizeClass, servicePreset, input.estimateAnswers.accessClass),
    approvalGate: riskLevel==="Site Visit Required"
      ? "Estimator approval required before customer price is released."
      : "Manager approval required before this becomes a final quote.",
  };
}

function buildAnnotationSpec(input, servicePreset, riskLevel) {
  const scope = input.scopeAnnotation || {};
  const treeId = scope.treeId || "T-001";
  const dbh = scope.dbhInches ? `${scope.dbhInches} in DBH` : "DBH field check required";
  const height = scope.estimatedHeightFeet ? `${scope.estimatedHeightFeet} ft height est.` : "height field check required";
  const photoMissing = onePhotoReadiness(input).missing;
  const photosNeeded = [
    "Wide record photo showing full tree, trunk/base, work area, and target",
    "Close-up of defect, deadwood, lean, stump, or requested cut area",
    "Access path photo showing driveway, gate, slope, mats, or staging area",
    "Target/risk photo showing house, wire, fence, road, vehicle, or neighbor side",
  ];
  return {
    treeId,
    title: `${treeId} - ${servicePreset}`,
    measurements: [dbh, height, `${input.estimateAnswers.nearestTargetDistanceFeet || "Unknown"} ft nearest target`],
    condition: scope.treeCondition || "Not specified",
    riskTarget: scope.primaryRiskTarget || "Not specified",
    action: input.customerAnswers.requestedWork || servicePreset,
    priority: input.estimateAnswers.urgencyLevel || "Routine",
    access: `${input.estimateAnswers.accessClass || "Unknown"} access; ${scope.equipmentPlan || "equipment plan not specified"}`,
    utility: scope.utilityPlan || "Not specified",
    cleanup: input.customerAnswers.cleanupPreference || "Not specified",
    doneStandard: scope.doneStandard || "Final done standard must be approved before quote release.",
    photoRequirements: photosNeeded,
    missingPhotoContext: photoMissing.length ? photoMissing : ["None from checklist"],
    quoteReadyGate: riskLevel==="Site Visit Required"
      ? "Not quote-ready from photo alone; site visit or qualified review required."
      : "Preliminary quote-ready after manager review and scope approval.",
  };
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
  const onePhoto = onePhotoReadiness(input);
  const obsessedScope = buildObsessedScope(input, servicePreset, riskLevel, species);
  const annotationSpec = buildAnnotationSpec(input, servicePreset, riskLevel);

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
      plantType: input.photo.plantType,
      workSide: input.customerAnswers.workSide,
      clearanceGoal: input.customerAnswers.clearanceGoal,
      urgency: input.estimateAnswers.urgencyLevel,
      completionWindow: input.estimateAnswers.completionWindow||"Not specified",
      recordPhotoReceived: input.photo.uploaded?"Yes":"No",
      accessClass: input.estimateAnswers.accessClass||"Not specified",
      treeId: input.scopeAnnotation.treeId||"Not provided",
      dbhInches: input.scopeAnnotation.dbhInches||"Not provided",
      estimatedHeightFeet: input.scopeAnnotation.estimatedHeightFeet||"Not provided",
      observedCondition: input.scopeAnnotation.treeCondition||"Not specified",
      primaryRiskTarget: input.scopeAnnotation.primaryRiskTarget||"Not specified",
      equipmentPlan: input.scopeAnnotation.equipmentPlan||"Not specified",
      utilityPlan: input.scopeAnnotation.utilityPlan||"Not specified",
      doneStandard: input.scopeAnnotation.doneStandard||"Not specified",
      concernsNoted: input.customerAnswers.accessUtilitySafetyConcerns||"None reported",
    },
    intakeCompleteness: isIntakeComplete(input)?"Complete for preliminary screening":"Incomplete — missing required fields",
    missingItems: getMissingItems(input),
    onePhotoReadiness: onePhoto,
    obsessedScope,
    annotationSpec,
    photoPacketScore: {
      singlePhotoScore: input.photo.score,
      fullPacketStatus: onePhoto.status,
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
      pricingMethod: "Industry cost-plus: crew hours + travel + fuel + equipment + disposal + overhead + risk buffer + profit margin",
      crewProfile: obsessedScope.crewProfile,
      riskLevel, siteVisitRequired, humanReviewRequired: true,
    },
  };
}

function isIntakeComplete(input) {
  return Boolean(
    input.photo.uploaded &&
    input.photo.plantType &&
    input.customerAnswers.requestedWork &&
    input.customerAnswers.workSide &&
    input.customerAnswers.clearanceGoal &&
    input.customerAnswers.cleanupPreference &&
    input.customerAnswers.accessUtilitySafetyConcerns &&
    input.estimateAnswers.treeSizeClass &&
    input.estimateAnswers.accessClass &&
    input.estimateAnswers.nearestTargetDistanceFeet !== "" &&
    input.scopeAnnotation.treeCondition &&
    input.scopeAnnotation.primaryRiskTarget &&
    input.scopeAnnotation.equipmentPlan &&
    input.scopeAnnotation.utilityPlan &&
    input.scopeAnnotation.doneStandard
  );
}

function getMissingItems(input) {
  const m = [];
  if (!input.jobInfo.customerName) m.push("Customer full name");
  if (!input.jobInfo.phone) m.push("Phone number");
  if (!input.jobInfo.email) m.push("Email address");
  if (!input.jobInfo.address) m.push("Job address / GPS");
  if (!input.scopeAnnotation.treeId) m.push("Tree ID / scope tag");
  if (!input.scopeAnnotation.dbhInches) m.push("DBH / trunk diameter field check");
  if (!input.scopeAnnotation.estimatedHeightFeet) m.push("Estimated height field check");
  if (input.photo.checklist && input.photo.checklist.length < 4) m.push("More photo context: " + onePhotoReadiness(input).missing.join(", "));
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
  if (includesAny(input.scopeAnnotation.utilityPlan || "",["wires","service drop","Line-clearance"])) flags.push("Utility plan requires extra review");
  if (includesAny(input.scopeAnnotation.equipmentPlan || "",["Crane","advanced rigging","Traffic"])) flags.push("Special equipment or control plan likely");
  if (includesAny(input.scopeAnnotation.treeCondition || "",["Dead tree","Leaning","Cracked","split","hollow","Storm damaged","hanging"])) flags.push("Condition trigger — verify structure before work");
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
  const scope = buildObsessedScope(input, servicePreset, riskLevel, guessSpecies(input.estimateAnswers.treeSpeciesGuess));
  return `Hi ${name}, thanks for sending the tree photo and answers.\n\nBased on the information provided, the likely service is: ${servicePreset}.\n\nPreliminary scope:\n  ${scope.included.join("\n  ")}\n\nYour preliminary 80% confidence estimate range is:\n  Low: ${fmt(low)}\n  Expected: ${fmt(expected)}\n  High: ${fmt(high)}\n\nRisk level: ${riskLevel}\nUrgency: ${urgency}\n${input.estimateAnswers.completionWindow?"Preferred completion: "+input.estimateAnswers.completionWindow+"\n":""}\nThis is a photo-based preliminary review, not a final inspection or final quote. Final pricing may change after human review due to access conditions, utility conflicts, limb weight, hidden decay, cleanup volume, traffic or sidewalk exposure, or field conditions that differ from the photo.\n\nRecommended next step: ${riskLevel==="Site Visit Required"?"Schedule a site visit before any pricing is confirmed.":"Manager review of this assessment before a final quote is delivered to you."}\n\nFinal scope and price require authorized company approval.`;
}

function buildCrewNotes(input, servicePreset, riskLevel, hours, debrisYards) {
  const lines = [
    `Work tree: Use uploaded record photo as reference.`,
    `Tree ID / tag: ${input.scopeAnnotation.treeId || "T-001"}`,
    `Obsessed scope headline: ${buildObsessedScope(input, servicePreset, riskLevel, guessSpecies(input.estimateAnswers.treeSpeciesGuess)).headline}`,
    `Plant type: ${input.photo.plantType}`,
    `Observed condition: ${input.scopeAnnotation.treeCondition || "Not specified"}`,
    `Work zone: ${input.customerAnswers.workSide}`,
    `Primary risk target: ${input.scopeAnnotation.primaryRiskTarget || "Not specified"}`,
    `Finish standard: ${input.customerAnswers.clearanceGoal}`,
    `Done means: ${input.scopeAnnotation.doneStandard || "Not specified"}`,
    `Requested work: ${input.customerAnswers.requestedWork}`,
    `Service preset: ${servicePreset}`,
    `Photo score: ${input.photo.score}`,
    `Tree size class: ${input.estimateAnswers.treeSizeClass}`,
    `DBH / trunk diameter: ${input.scopeAnnotation.dbhInches || "Field check required"} in`,
    `Estimated height: ${input.scopeAnnotation.estimatedHeightFeet || "Field check required"} ft`,
    `Access class: ${input.estimateAnswers.accessClass}`,
    `Equipment / access plan: ${input.scopeAnnotation.equipmentPlan || "Not specified"}`,
    `Utility / underground check: ${input.scopeAnnotation.utilityPlan || "Not specified"}`,
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
      plantType: document.getElementById("plantType").value,
      checklist: checkedPhotoItems(),
    },
    customerAnswers: {
      requestedWork: document.getElementById("requestedWork").value,
      workSide: document.getElementById("workSide").value,
      clearanceGoal: document.getElementById("clearanceGoal").value,
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
    scopeAnnotation: {
      treeId: document.getElementById("treeId").value.trim(),
      dbhInches: document.getElementById("dbhInches").value,
      estimatedHeightFeet: document.getElementById("estimatedHeightFeet").value,
      treeCondition: document.getElementById("treeCondition").value,
      primaryRiskTarget: document.getElementById("primaryRiskTarget").value,
      equipmentPlan: document.getElementById("equipmentPlan").value,
      utilityPlan: document.getElementById("utilityPlan").value,
      doneStandard: document.getElementById("doneStandard").value.trim(),
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
  currentEstimate = estimate;
  setFieldActionState(true);
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
    <div class="scope-hero">
      <div>
        <span>Obsessed One-Photo Scope</span>
        <strong>${esc(e.obsessedScope.headline)}</strong>
        <p>${esc(e.obsessedScope.finishStandard)}</p>
      </div>
      <div>
        <span>Readiness</span>
        <strong>${esc(e.onePhotoReadiness.status)}</strong>
        <p>${e.onePhotoReadiness.score}% one-photo context captured</p>
      </div>
    </div>
    <div class="price-range">
      <div class="price-card"><span>Low (80% range)</span><strong>${fmt(e.preliminaryEstimateRange.low)}</strong></div>
      <div class="price-card expected"><span>Expected</span><strong>${fmt(e.preliminaryEstimateRange.expected)}</strong></div>
      <div class="price-card"><span>High (80% range)</span><strong>${fmt(e.preliminaryEstimateRange.high)}</strong></div>
    </div>
    <div class="approval-panel">
      <h3>Recommended Approval Path</h3>
      <p>This packet is designed to help the customer approve the work faster while keeping final pricing under company control.</p>
      <div class="approval-steps">
        <div><strong>1. Confirm scope</strong><span>Customer reviews the annotated photo, cleanup choice, and included work.</span></div>
        <div><strong>2. Manager approval</strong><span>Company reviews risk, access, utility concerns, and price range before final quote.</span></div>
        <div><strong>3. Schedule once</strong><span>Crew arrives with a documented plan after the customer accepts the approved quote.</span></div>
      </div>
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
        <h3>Precise Scope of Work</h3>
        <ul>${e.obsessedScope.included.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>
        <p style="margin-top:10px"><strong>Approval gate:</strong> ${esc(e.obsessedScope.approvalGate)}</p>
      </div>
      <div class="result-section full">
        <h3>Scope Annotation Block</h3>
        <div class="annotation-spec-grid">
          <div><strong>Tree ID</strong><span>${esc(e.annotationSpec.treeId)}</span></div>
          <div><strong>Action</strong><span>${esc(e.annotationSpec.action)}</span></div>
          <div><strong>Condition</strong><span>${esc(e.annotationSpec.condition)}</span></div>
          <div><strong>Risk target</strong><span>${esc(e.annotationSpec.riskTarget)}</span></div>
          <div><strong>Priority</strong><span>${esc(e.annotationSpec.priority)}</span></div>
          <div><strong>Access / equipment</strong><span>${esc(e.annotationSpec.access)}</span></div>
          <div><strong>Utility / 811</strong><span>${esc(e.annotationSpec.utility)}</span></div>
          <div><strong>Cleanup</strong><span>${esc(e.annotationSpec.cleanup)}</span></div>
        </div>
        <p style="margin-top:10px"><strong>Done means:</strong> ${esc(e.annotationSpec.doneStandard)}</p>
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
          <li><strong>Checklist score:</strong> ${e.onePhotoReadiness.score}%</li>
          <li><strong>Missing:</strong> ${e.onePhotoReadiness.missing.length ? esc(e.onePhotoReadiness.missing.join(", ")) : "None"}</li>
        </ul>
      </div>
      <div class="result-section full">
        <h3>5. Bid-Ready Annotation Standard</h3>
        <div class="annotation-spec-grid">
          <div><strong>Title</strong><span>${esc(e.annotationSpec.title)}</span></div>
          <div><strong>Measurements</strong><span>${esc(e.annotationSpec.measurements.join(" · "))}</span></div>
          <div><strong>Condition</strong><span>${esc(e.annotationSpec.condition)}</span></div>
          <div><strong>Risk target</strong><span>${esc(e.annotationSpec.riskTarget)}</span></div>
          <div><strong>Access</strong><span>${esc(e.annotationSpec.access)}</span></div>
          <div><strong>Utility / 811</strong><span>${esc(e.annotationSpec.utility)}</span></div>
          <div><strong>Cleanup</strong><span>${esc(e.annotationSpec.cleanup)}</span></div>
          <div><strong>Quote gate</strong><span>${esc(e.annotationSpec.quoteReadyGate)}</span></div>
        </div>
        <h3 style="margin-top:14px">Required Supporting Photos</h3>
        <ul>${e.annotationSpec.photoRequirements.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>
      </div>
      <div class="result-section">
        <h3>6. Visible Tree / Shrub Review</h3>
        <ul>
          ${Object.entries(e.visibleTreeReview).map(([k,v])=>`<li><strong>${labelize(k)}:</strong> ${esc(v)}</li>`).join("")}
        </ul>
      </div>
      <div class="result-section">
        <h3>7. Recommended Service Preset</h3>
        <p><span class="badge ${dangerClass}">${esc(e.servicePreset)}</span></p>
      </div>
      <div class="result-section">
        <h3>8. Safety / Risk Flags</h3>
        <ul>${e.safetyRiskFlags.map(f=>`<li>${esc(f)}</li>`).join("")}</ul>
      </div>
      <div class="result-section">
        <h3>9. Quote Factor Breakdown</h3>
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
        <h3>10. Preliminary Estimate Range</h3>
        <ul>
          <li><strong>Low:</strong> ${fmt(e.preliminaryEstimateRange.low)}</li>
          <li><strong>Expected:</strong> ${fmt(e.preliminaryEstimateRange.expected)}</li>
          <li><strong>High:</strong> ${fmt(e.preliminaryEstimateRange.high)}</li>
          <li><strong>Estimated crew hours:</strong> ${e.meta.estimatedCrewHours}</li>
          <li><strong>Estimated debris:</strong> ${e.meta.debrisCubicYards} cu yd</li>
        </ul>
      </div>
      <div class="result-section">
        <h3>11. Confidence Level</h3>
        <ul>
          <li><strong>Photo confidence:</strong> ${esc(e.confidenceLevel.photoConfidence)}</li>
          <li><strong>Scope confidence:</strong> ${esc(e.confidenceLevel.scopeConfidence)}</li>
          <li><strong>Pricing confidence:</strong> ${esc(e.confidenceLevel.pricingConfidence)}</li>
        </ul>
      </div>
      <div class="result-section">
        <h3>12. Site Visit Decision</h3>
        <p><strong>${esc(e.siteVisitDecision.decision)}</strong></p>
        <p>${esc(e.siteVisitDecision.reason)}</p>
      </div>
      <div class="result-section full">
        <h3>13. Obsessed Scope Details</h3>
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
        <h3>14. What Could Change Final Price</h3>
        <ul>${e.priceChangeFactor.map(f=>`<li>${esc(f)}</li>`).join("")}</ul>
      </div>
      <div class="result-section full">
        <h3>15. Customer Message Draft</h3>
        <pre>${esc(e.customerMessage)}</pre>
      </div>
      <div class="result-section full">
        <h3>16. Visual Preview Instructions</h3>
        <pre>${esc(e.visualPreviewPrompt)}</pre>
      </div>
      <div class="result-section full">
        <h3>17. Human Approval Requirement</h3>
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
        <div class="crew-field"><strong>Tree ID:</strong><span>${esc(e.annotationSpec.treeId)}</span></div>
        <div class="crew-field"><strong>Obsessed scope:</strong><span>${esc(e.obsessedScope.headline)}</span></div>
        <div class="crew-field"><strong>Work zone:</strong><span>${esc(e.obsessedScope.workZone)}</span></div>
        <div class="crew-field"><strong>Condition:</strong><span>${esc(e.annotationSpec.condition)}</span></div>
        <div class="crew-field"><strong>Risk target:</strong><span>${esc(e.annotationSpec.riskTarget)}</span></div>
        <div class="crew-field"><strong>Finish:</strong><span>${esc(e.jobSnapshot.clearanceGoal)}</span></div>
        <div class="crew-field"><strong>Done means:</strong><span>${esc(e.annotationSpec.doneStandard)}</span></div>
        <div class="crew-field"><strong>Requested work:</strong><span>${esc(j.requestedWork)}</span></div>
        <div class="crew-field"><strong>Cleanup:</strong><span>${esc(j.cleanupPreference)}</span></div>
        <div class="crew-field"><strong>Risk level:</strong><span><span class="badge ${dangerClass}" style="font-size:0.78rem">${esc(e.riskLevel)}</span></span></div>
        <div class="crew-field"><strong>Photo score:</strong><span>${esc(e.photoPacketScore.singlePhotoScore)}</span></div>
        <div class="crew-field"><strong>Tree size:</strong><span>${esc(e.jobSnapshot.requestedWork.includes("Shrub")?"Shrub":e.visibleTreeReview.approximateSizeClass)}</span></div>
        <div class="crew-field"><strong>Measurements:</strong><span>${esc(e.annotationSpec.measurements.join(" · "))}</span></div>
        <div class="crew-field"><strong>Access:</strong><span>${esc(e.jobSnapshot.accessClass)}</span></div>
        <div class="crew-field"><strong>Equipment:</strong><span>${esc(e.annotationSpec.access)}</span></div>
        <div class="crew-field"><strong>Utility / 811:</strong><span>${esc(e.annotationSpec.utility)}</span></div>
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
        <h4>Required Photo / Annotation Checks</h4>
        <ul class="stop-work-list">${e.annotationSpec.photoRequirements.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>
        <p style="margin-top:10px;font-size:0.85rem"><strong>Missing photo context:</strong> ${esc(e.annotationSpec.missingPhotoContext.join(", "))}</p>
      </div>
      <div class="crew-block full">
        <h4>Internal Crew Notes</h4>
        <ul class="stop-work-list">${e.internalCrewNotes.map(n=>n==="---"?`</ul><hr style="margin:8px 0;border-color:var(--line)"><ul class="stop-work-list">`:
          `<li>${esc(n)}</li>`).join("")}</ul>
      </div>
      <div class="crew-block full">
        <h4>Field Completion Checklist</h4>
        <div class="completion-grid">
          <label><input type="checkbox"> Record photo matches the tree, target, access, and approved Tree ID</label>
          <label><input type="checkbox"> Customer-approved scope and cleanup preference reviewed before cutting</label>
          <label><input type="checkbox"> Utility, 811, traffic, and overhead-line concerns cleared or escalated</label>
          <label><input type="checkbox"> Drop zone, targets, turf protection, and equipment staging confirmed</label>
          <label><input type="checkbox"> Work completed to the "done means" standard</label>
          <label><input type="checkbox"> Final cleanup, raking, debris handling, and customer walkthrough complete</label>
        </div>
      </div>
      <div class="crew-block full">
        <h4>Owner Approval Controls</h4>
        <div class="owner-approval-grid">
          <div><strong>Status</strong><span>Pending owner review</span></div>
          <div><strong>Final price</strong><span>_______________</span></div>
          <div><strong>Approved by</strong><span>_______________</span></div>
          <div><strong>Schedule</strong><span>_______________</span></div>
        </div>
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
// FIELD APP STATE — local browser job queue
// ============================================================
function loadFieldJobs() {
  try {
    return JSON.parse(localStorage.getItem(FIELD_JOB_STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveFieldJobs(jobs) {
  localStorage.setItem(FIELD_JOB_STORE_KEY, JSON.stringify(jobs.slice(0, 40)));
  renderSavedJobs();
}

function estimateSummary(e) {
  const j = e.jobSnapshot;
  return [
    `TreeVision job ${e.jobId}`,
    `Customer: ${j.customer}`,
    `Address: ${j.address}`,
    `Service: ${e.servicePreset}`,
    `Risk: ${e.riskLevel}`,
    `Expected range: ${fmt(e.preliminaryEstimateRange.expected)} (${fmt(e.preliminaryEstimateRange.low)}-${fmt(e.preliminaryEstimateRange.high)})`,
    `Scope: ${e.obsessedScope.headline}`,
    `Done means: ${e.annotationSpec.doneStandard}`,
    `Next step: ${e.siteVisitDecision.decision}`,
  ].join("\n");
}

function buildFieldRecord(e) {
  return {
    id: e.jobId,
    savedAt: new Date().toISOString(),
    customer: e.jobSnapshot.customer,
    address: e.jobSnapshot.address,
    service: e.servicePreset,
    riskLevel: e.riskLevel,
    expectedPrice: e.preliminaryEstimateRange.expected,
    summary: estimateSummary(e),
    estimate: e,
  };
}

function setFieldActionState(enabled) {
  ["saveJob","shareJob","exportJob"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !enabled;
  });
}

function renderSavedJobs() {
  const jobs = loadFieldJobs();
  const count = document.getElementById("savedJobCount");
  const list = document.getElementById("savedJobs");
  if (count) count.textContent = `${jobs.length} local record${jobs.length === 1 ? "" : "s"}`;
  if (!list) return;
  if (!jobs.length) {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = jobs.slice(0, 5).map(job => `
    <div class="saved-job-card">
      <div>
        <strong>${esc(job.customer || "Unnamed customer")} · ${esc(job.service)}</strong>
        <span>${esc(job.address || "No address")} · ${esc(job.riskLevel)} · ${fmt(job.expectedPrice)} expected · ${new Date(job.savedAt).toLocaleString()}</span>
      </div>
      <div class="record-actions">
        <button type="button" class="secondary small-btn" data-load-job="${esc(job.id)}">Load</button>
        <button type="button" class="secondary small-btn" data-copy-job="${esc(job.id)}">Copy</button>
      </div>
    </div>`).join("");
}

function saveCurrentJob() {
  if (!currentEstimate) return;
  const jobs = loadFieldJobs().filter(job => job.id !== currentEstimate.jobId);
  jobs.unshift(buildFieldRecord(currentEstimate));
  saveFieldJobs(jobs);
}

async function shareCurrentJob() {
  if (!currentEstimate) return;
  const text = estimateSummary(currentEstimate);
  if (navigator.share) {
    await navigator.share({ title: `TreeVision ${currentEstimate.jobId}`, text });
    return;
  }
  await navigator.clipboard.writeText(text);
  alert("TreeVision summary copied.");
}

function exportCurrentJob() {
  if (!currentEstimate) return;
  const record = buildFieldRecord(currentEstimate);
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.download = `${record.id}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
}

function loadSavedJob(id) {
  const record = loadFieldJobs().find(job => job.id === id);
  if (!record) return;
  currentEstimate = record.estimate;
  setFieldActionState(true);
  renderResults(record.estimate);
}

function applyMode(mode) {
  document.body.classList.toggle("field-mode-owner", mode === "owner");
  document.body.classList.toggle("field-mode-crew", mode === "crew");
  document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
}

// ============================================================
// ACCORDION
// ============================================================
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

renderSavedJobs();
setFieldActionState(false);
applyMode("crew");

document.addEventListener("click", e => {
  const modeBtn = e.target.closest(".mode-btn");
  if (modeBtn) applyMode(modeBtn.dataset.mode);

  const loadBtn = e.target.closest("[data-load-job]");
  if (loadBtn) loadSavedJob(loadBtn.dataset.loadJob);

  const copyBtn = e.target.closest("[data-copy-job]");
  if (copyBtn) {
    const record = loadFieldJobs().find(job => job.id === copyBtn.dataset.copyJob);
    if (record) navigator.clipboard.writeText(record.summary);
  }
});

["saveJob","saveJobFromResults"].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener("click", saveCurrentJob);
});

["shareJob","shareJobFromResults"].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener("click", () => shareCurrentJob().catch(() => alert("Unable to share this job from this browser.")));
});

["exportJob","exportJobFromResults"].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener("click", exportCurrentJob);
});

document.getElementById("quickGps").addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("GPS is not available in this browser.");
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const gps = document.getElementById("gpsPin");
    gps.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
  }, () => alert("GPS permission was not granted."));
});

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
function refreshPhotoVisuals() {
  const preview = document.getElementById("photoPreview");
  if (!preview || !preview.src || preview.hidden) return;
  const input = getFormInput();
  const servicePreset = classifyService(
    input.customerAnswers.requestedWork,
    input.customerAnswers.accessUtilitySafetyConcerns
  );
  const riskLevel = determineRiskLevel(input, servicePreset);
  drawAnnotations(document.getElementById("annotationCanvas"), preview, input, servicePreset, riskLevel);
  drawClientBeforeAfter(
    document.getElementById("beforeCanvas"),
    document.getElementById("afterCanvas"),
    preview,
    input,
    servicePreset,
    riskLevel
  );
}

document.getElementById("photoUpload").addEventListener("change", evt => {
  const file = evt.target.files[0];
  const preview = document.getElementById("photoPreview");
  const wrap = document.getElementById("annotationWrap");

  if (!file) { wrap.hidden = true; preview.removeAttribute("src"); return; }

  const reader = new FileReader();
  reader.onload = re => {
    preview.src = re.target.result;
    preview.hidden = false;
    wrap.hidden = false;

    preview.onload = () => {
      refreshPhotoVisuals();
    };
  };
  reader.readAsDataURL(file);
});

// Redraw annotation when key form fields change
["requestedWork","photoScore","plantType","workSide","cleanupPreference","clearanceGoal","accessClass","treeSizeClass","concerns","nearestTargetDistanceFeet","treeId","dbhInches","estimatedHeightFeet","treeCondition","primaryRiskTarget","equipmentPlan","utilityPlan","doneStandard","urgencyLevel","completionWindow"].forEach(id => {
  document.getElementById(id).addEventListener("change", () => {
    refreshPhotoVisuals();
  });
});

document.querySelectorAll(".photo-check").forEach(box => {
  box.addEventListener("change", () => {
    refreshPhotoVisuals();
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
  if (preview.src && !preview.hidden) {
    drawAnnotations(document.getElementById("annotationCanvas"), preview, input, estimate.servicePreset, estimate.riskLevel);
    drawClientBeforeAfter(
      document.getElementById("beforeCanvas"),
      document.getElementById("afterCanvas"),
      preview,
      input,
      estimate.servicePreset,
      estimate.riskLevel
    );
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

document.getElementById("downloadClientVisual").addEventListener("click", () => {
  refreshPhotoVisuals();
  const before = document.getElementById("beforeCanvas");
  const after = document.getElementById("afterCanvas");
  if (!before.width || !after.width) return;
  const gap = 20;
  const footerH = 54;
  const out = document.createElement("canvas");
  out.width = before.width + after.width + gap;
  out.height = Math.max(before.height, after.height) + footerH;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#eef4ed";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(before, 0, 0);
  ctx.drawImage(after, before.width + gap, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, out.height - footerH, out.width, footerH);
  ctx.fillStyle = "#225431";
  ctx.font = "bold 15px Arial";
  ctx.fillText("TreeVision AI - Client Before / Proposed After Scope Visual", 16, out.height - 30);
  ctx.fillStyle = "#607065";
  ctx.font = "12px Arial";
  ctx.fillText("Generated at estimate time. Illustrative only; final appearance and price require field/manager approval.", 16, out.height - 12);
  const a = document.createElement("a");
  a.download = "treevision-client-before-after.png";
  a.href = out.toDataURL("image/png");
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
  currentEstimate = null;
  setFieldActionState(false);
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
