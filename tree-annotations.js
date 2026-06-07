/* ============================================================================
 * tree-annotations.js  —  Dynamic Tree Service / TreeOS
 * Canvas-based before / annotated / after photo rendering for tree trimming
 * and removal estimates, with ISA-aligned annotation + scope content.
 *
 * ZERO dependencies. Pure browser canvas API. Drop in via <script> or import.
 *
 * --------------------------------------------------------------------------
 * INPUT CONTRACT  (the `analysis` object you pass in)
 * --------------------------------------------------------------------------
 * Field names below MATCH the names already used in your TreeVision-Ai
 * commits. If your object differs, remap once in `normalizeAnalysis()` at the
 * bottom — that is the ONLY place field names are read.
 *
 *   common_name        string   e.g. "Northern Red Oak"
 *   latin_name         string   e.g. "Quercus rubra"
 *   est_height_ft      number|string  e.g. 65  or "60-70 ft"
 *   isa_risk_rating    string   "Low" | "Moderate" | "High" | "Extreme"
 *   quote_low          number
 *   quote_high         number
 *   after_description  string   (optional) narrative shown on the After view
 *   service_type       string   "trim" | "removal" | "prune" | ...  (optional)
 *   annotations        Array<Annotation>   (optional; see below)
 *
 *   Annotation = {
 *     type:  one of ANNOTATION_TYPES keys (see below)
 *     // geometry is in NORMALIZED coords (0..1) so it scales to any image size
 *     x, y:        normalized point (for pin/label callouts)
 *     // OR a normalized box:
 *     box: { x, y, w, h }
 *     // OR a normalized polygon (array of {x,y}) for removal/preserve zones:
 *     poly: [ {x,y}, ... ]
 *     label: string   (optional; defaults to the type's label)
 *     note:  string   (optional; small sub-text)
 *   }
 *
 * If `annotations` is omitted, the module renders a clean labeled view from
 * the species/height/risk fields alone, so it degrades gracefully.
 *
 * --------------------------------------------------------------------------
 * PUBLIC API
 * --------------------------------------------------------------------------
 *   await TreeAnnotations.generateAnnotatedPhoto(img, analysis, canvas)
 *   await TreeAnnotations.generateAfterRendering(img, analysis, canvas)
 *   await TreeAnnotations.generateBefore(img, analysis, canvas)   // clean + watermark
 *   TreeAnnotations.buildScope(analysis)        -> { summary, lineItems[], afterText }
 *   TreeAnnotations.ANNOTATION_TYPES            -> the legend/dictionary
 *
 *   `img`    : a loaded HTMLImageElement (naturalWidth>0) OR a URL string
 *   `canvas` : target HTMLCanvasElement (sized automatically to the image)
 * ========================================================================== */

(function (root) {
  'use strict';

  /* ---- Design tokens ------------------------------------------------------ */
  const C = {
    cut:      '#F4B400', // amber  — selective cuts / pruning targets
    remove:   '#E5484D', // red    — removal zones / whole-tree removal
    preserve: '#30A46C', // green  — preserved structure / final crown
    hazard:   '#FF6B00', // orange — defects, deadwood, hazards
    clearance:'#3E63DD', // blue   — clearance / structures / utility lines
    ink:      '#0B1F17', // near-black green for text
    paper:    '#FFFFFF',
    haze:     'rgba(11,31,23,0.55)',
    brand:    '#2F7D32',
  };

  // Industry-standard annotation dictionary (ISA-aligned terminology).
  const ANNOTATION_TYPES = {
    crown_clean:    { label: 'Crown Cleaning',   color: C.cut,       desc: 'Removal of dead, dying, diseased, and weakly attached branches.' },
    crown_thin:     { label: 'Crown Thinning',   color: C.cut,       desc: 'Selective removal of live branches to reduce density and wind load.' },
    crown_raise:    { label: 'Crown Raising',    color: C.cut,       desc: 'Removal of lower limbs for clearance over structures, drives, walkways.' },
    crown_reduce:   { label: 'Crown Reduction',  color: C.cut,       desc: 'Reducing height/spread to live laterals; preserves natural form.' },
    deadwood:       { label: 'Deadwood',         color: C.hazard,    desc: 'Standing dead limbs flagged for removal (ISA hazard).' },
    structural:     { label: 'Structural Defect',color: C.hazard,    desc: 'Included bark, cavity, crack, or co-dominant stem of concern.' },
    removal_zone:   { label: 'Removal Zone',     color: C.remove,    desc: 'Material slated for complete removal.' },
    whole_removal:  { label: 'Full Removal',     color: C.remove,    desc: 'Entire stem removed to grade; stump per scope.' },
    preserve_zone:  { label: 'Preserved Crown',  color: C.preserve,  desc: 'Healthy structure retained after service.' },
    clearance:      { label: 'Clearance',        color: C.clearance, desc: 'Required clearance from roof, line, or structure.' },
    target:         { label: 'Protected Target', color: C.clearance, desc: 'Structure/vehicle below the work zone.' },
  };

  /* ---- small canvas helpers ---------------------------------------------- */

  function loadImage(src) {
    if (src && src.naturalWidth) return Promise.resolve(src);
    return new Promise((res, rej) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('Image failed to load'));
      im.src = src;
    });
  }

  function fitCanvas(canvas, img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    canvas.width = w;
    canvas.height = h;
    return canvas.getContext('2d');
  }

  // px from normalized
  const PX = (n, dim) => n * dim;

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // A label chip with a leader dot. Scales with image width.
  function drawChip(ctx, px, py, text, sub, color, W) {
    const s = Math.max(W / 1100, 0.65);          // scale factor
    const padX = 14 * s, padY = 9 * s;
    const fz = 26 * s, sfz = 18 * s;
    ctx.font = `700 ${fz}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    const tw = ctx.measureText(text).width;
    let sw = 0;
    if (sub) { ctx.font = `500 ${sfz}px ui-sans-serif, system-ui, sans-serif`; sw = ctx.measureText(sub).width; }
    const boxW = Math.max(tw, sw) + padX * 2;
    const boxH = (sub ? fz + sfz + 6 * s : fz) + padY * 2;

    // leader dot + stem
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.arc(px, py, 7 * s, 0, Math.PI * 2); ctx.fill();

    // place chip up-right of the dot, clamped to canvas
    let bx = px + 16 * s, by = py - boxH - 10 * s;
    if (bx + boxW > ctx.canvas.width)  bx = px - boxW - 16 * s;
    if (by < 4 * s)                    by = py + 14 * s;

    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx + 8 * s, by + boxH / 2); ctx.stroke();

    // chip body
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 12 * s; ctx.shadowOffsetY = 3 * s;
    ctx.fillStyle = C.paper;
    roundRect(ctx, bx, by, boxW, boxH, 10 * s); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // color accent bar
    ctx.fillStyle = color;
    roundRect(ctx, bx, by, 6 * s, boxH, 3 * s); ctx.fill();

    ctx.textBaseline = 'top';
    ctx.fillStyle = C.ink;
    ctx.font = `700 ${fz}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(text, bx + padX, by + padY);
    if (sub) {
      ctx.fillStyle = 'rgba(11,31,23,0.62)';
      ctx.font = `500 ${sfz}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(sub, bx + padX, by + padY + fz + 4 * s);
    }
  }

  function drawBox(ctx, b, color, W, dashed) {
    const s = Math.max(W / 1100, 0.65);
    const x = PX(b.x, ctx.canvas.width), y = PX(b.y, ctx.canvas.height);
    const w = PX(b.w, ctx.canvas.width), h = PX(b.h, ctx.canvas.height);
    ctx.save();
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = color;
    if (dashed) ctx.setLineDash([14 * s, 10 * s]);
    roundRect(ctx, x, y, w, h, 8 * s); ctx.stroke();
    ctx.globalAlpha = 0.12; ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }

  function drawPoly(ctx, poly, color, W, fade) {
    if (!poly || poly.length < 2) return;
    ctx.save();
    ctx.beginPath();
    poly.forEach((p, i) => {
      const x = PX(p.x, ctx.canvas.width), y = PX(p.y, ctx.canvas.height);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    const s = Math.max(W / 1100, 0.65);
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = color;
    ctx.globalAlpha = fade ? 0.85 : 1;
    ctx.stroke();
    ctx.globalAlpha = fade ? 0.28 : 0.14;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // top banner with title + risk pill
  function drawHeader(ctx, title, subtitle, riskRating) {
    const W = ctx.canvas.width;
    const s = Math.max(W / 1100, 0.65);
    const h = 96 * s;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(11,31,23,0.82)');
    g.addColorStop(1, 'rgba(11,31,23,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, h);

    ctx.textBaseline = 'top';
    ctx.fillStyle = C.paper;
    ctx.font = `800 ${30 * s}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(title, 24 * s, 16 * s);
    if (subtitle) {
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = `500 ${20 * s}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(subtitle, 24 * s, 52 * s);
    }
    if (riskRating) {
      const map = { low: C.preserve, moderate: C.cut, high: C.hazard, extreme: C.remove };
      const col = map[String(riskRating).toLowerCase()] || C.cut;
      const txt = `ISA RISK: ${String(riskRating).toUpperCase()}`;
      ctx.font = `700 ${18 * s}px ui-sans-serif, system-ui, sans-serif`;
      const tw = ctx.measureText(txt).width;
      const pw = tw + 28 * s, ph = 32 * s, px = W - pw - 24 * s, py = 18 * s;
      ctx.fillStyle = col;
      roundRect(ctx, px, py, pw, ph, ph / 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, px + 14 * s, py + 7 * s);
    }
  }

  // legend strip along bottom for the types actually used
  function drawLegend(ctx, usedTypes) {
    if (!usedTypes.length) return;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const s = Math.max(W / 1100, 0.65);
    const rowH = 34 * s, pad = 16 * s;
    const h = usedTypes.length * rowH + pad;
    const g = ctx.createLinearGradient(0, H - h - 30 * s, 0, H);
    g.addColorStop(0, 'rgba(11,31,23,0)');
    g.addColorStop(1, 'rgba(11,31,23,0.86)');
    ctx.fillStyle = g; ctx.fillRect(0, H - h - 30 * s, W, h + 30 * s);

    ctx.textBaseline = 'middle';
    usedTypes.forEach((t, i) => {
      const y = H - h + pad / 2 + i * rowH + rowH / 2;
      ctx.fillStyle = ANNOTATION_TYPES[t].color;
      roundRect(ctx, 24 * s, y - 9 * s, 18 * s, 18 * s, 4 * s); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${19 * s}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(ANNOTATION_TYPES[t].label, 52 * s, y);
    });
  }

  function brandWatermark(ctx) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const s = Math.max(W / 1100, 0.65);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${16 * s}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8 * s;
    ctx.fillText('Dynamic Tree Service · ISA Certified', 24 * s, H - 10 * s);
    ctx.restore();
  }

  /* ---- PUBLIC: BEFORE ----------------------------------------------------- */
  async function generateBefore(imgSrc, analysisRaw, canvas) {
    const a = normalizeAnalysis(analysisRaw);
    const img = await loadImage(imgSrc);
    const ctx = fitCanvas(canvas, img);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawHeader(ctx, 'BEFORE SERVICE', `${a.common_name}${a.latin_name ? '  ·  ' + a.latin_name : ''}`, a.isa_risk_rating);
    brandWatermark(ctx);
    return canvas;
  }

  /* ---- PUBLIC: ANNOTATED -------------------------------------------------- */
  async function generateAnnotatedPhoto(imgSrc, analysisRaw, canvas) {
    const a = normalizeAnalysis(analysisRaw);
    const img = await loadImage(imgSrc);
    const ctx = fitCanvas(canvas, img);
    const W = canvas.width;
    ctx.drawImage(img, 0, 0, W, canvas.height);

    // subtle darkening for contrast of overlays
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, 0, W, canvas.height);

    const used = new Set();
    // zones first (under chips)
    a.annotations.forEach(an => {
      const def = ANNOTATION_TYPES[an.type]; if (!def) return;
      used.add(an.type);
      if (an.poly) drawPoly(ctx, an.poly, def.color, W, false);
      else if (an.box) drawBox(ctx, an.box, def.color, W, an.type === 'clearance');
    });
    // chips on top
    a.annotations.forEach(an => {
      const def = ANNOTATION_TYPES[an.type]; if (!def) return;
      let px, py;
      if (an.box) { px = PX(an.box.x + an.box.w / 2, W); py = PX(an.box.y, canvas.height); }
      else if (an.poly) {
        const cx = an.poly.reduce((s, p) => s + p.x, 0) / an.poly.length;
        const cy = Math.min(...an.poly.map(p => p.y));
        px = PX(cx, W); py = PX(cy, canvas.height);
      } else { px = PX(an.x ?? 0.5, W); py = PX(an.y ?? 0.5, canvas.height); }
      drawChip(ctx, px, py, an.label || def.label, an.note || '', def.color, W);
    });

    drawHeader(ctx, 'WORK PLAN', `Est. height ${fmtHeight(a.est_height_ft)}`, a.isa_risk_rating);
    drawLegend(ctx, [...used]);
    brandWatermark(ctx);
    return canvas;
  }

  /* ---- PUBLIC: AFTER ------------------------------------------------------ */
  async function generateAfterRendering(imgSrc, analysisRaw, canvas) {
    const a = normalizeAnalysis(analysisRaw);
    const img = await loadImage(imgSrc);
    const ctx = fitCanvas(canvas, img);
    const W = canvas.width, H = canvas.height;
    ctx.drawImage(img, 0, 0, W, H);

    // Conceptual "after": fade removed material, outline retained crown.
    // We can't truly repaint foliage, so we communicate the result:
    //  - removal zones get a heavy desaturating veil
    //  - preserved crown gets a confident green outline
    const removals  = a.annotations.filter(x => /remov|deadwood|whole/.test(x.type));
    const preserves = a.annotations.filter(x => x.type === 'preserve_zone');

    removals.forEach(an => {
      const region = an.poly || (an.box ? boxToPoly(an.box) : null);
      if (!region) return;
      ctx.save();
      ctx.beginPath();
      region.forEach((p, i) => { const x = PX(p.x, W), y = PX(p.y, H); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = 'rgba(245,247,246,0.78)';      // wash out removed area
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      drawPoly(ctx, region, C.remove, W, false);
    });

    if (preserves.length) {
      preserves.forEach(an => drawPoly(ctx, an.poly || boxToPoly(an.box), C.preserve, W, true));
    } else {
      // no explicit preserve zone — outline a centered "final crown" hint
      const hint = [
        {x:0.30,y:0.18},{x:0.70,y:0.18},{x:0.80,y:0.45},
        {x:0.66,y:0.72},{x:0.34,y:0.72},{x:0.20,y:0.45}
      ];
      drawPoly(ctx, hint, C.preserve, W, true);
    }

    drawHeader(ctx, 'AFTER SERVICE', a.service_label, a.isa_risk_rating);

    // after description card
    if (a.after_description) drawCaptionCard(ctx, a.after_description);
    brandWatermark(ctx);
    return canvas;
  }

  function boxToPoly(b) {
    return [{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}];
  }

  function drawCaptionCard(ctx, text) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const s = Math.max(W / 1100, 0.65);
    const pad = 18 * s, fz = 20 * s, maxW = W * 0.6;
    ctx.font = `500 ${fz}px ui-sans-serif, system-ui, sans-serif`;
    const lines = wrap(ctx, text, maxW - pad * 2);
    const cardH = lines.length * (fz + 6 * s) + pad * 2;
    const cardW = maxW, x = 24 * s, y = H - cardH - 60 * s;
    ctx.fillStyle = 'rgba(11,31,23,0.86)';
    roundRect(ctx, x, y, cardW, cardH, 12 * s); ctx.fill();
    ctx.fillStyle = C.preserve;
    roundRect(ctx, x, y, 6 * s, cardH, 3 * s); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
    lines.forEach((ln, i) => ctx.fillText(ln, x + pad, y + pad + i * (fz + 6 * s)));
  }

  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/), lines = []; let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 6);
  }

  function fmtHeight(h) {
    if (h == null) return '—';
    if (typeof h === 'number') return h + ' ft';
    return /ft/i.test(h) ? h : h + ' ft';
  }

  /* ---- PUBLIC: SCOPE CONTENT (the written side) --------------------------- */
  function buildScope(analysisRaw) {
    const a = normalizeAnalysis(analysisRaw);
    const items = [];
    const seen = new Set();
    a.annotations.forEach(an => {
      const def = ANNOTATION_TYPES[an.type];
      if (!def || seen.has(an.type)) return;
      seen.add(an.type);
      items.push({ label: def.label, detail: an.note || def.desc, color: def.color });
    });
    // sensible defaults if AI returned no annotations
    if (!items.length) {
      if (a.service_type === 'removal') {
        items.push({ label: ANNOTATION_TYPES.whole_removal.label, detail: ANNOTATION_TYPES.whole_removal.desc, color: C.remove });
      } else {
        items.push({ label: ANNOTATION_TYPES.crown_clean.label, detail: ANNOTATION_TYPES.crown_clean.desc, color: C.cut });
      }
    }
    const summary =
      `${a.common_name}${a.latin_name ? ` (${a.latin_name})` : ''}, est. ${fmtHeight(a.est_height_ft)}, ` +
      `ISA risk rating ${a.isa_risk_rating || 'Moderate'}. Scope: ${items.map(i => i.label.toLowerCase()).join(', ')}.`;
    const afterText = a.after_description ||
      (a.service_type === 'removal'
        ? 'Tree removed to grade; site cleared of all debris. Adjacent canopy and turf protected throughout.'
        : 'Crown cleaned and balanced to ISA pruning standards, deadwood removed, and required clearances established while preserving the tree’s natural structure and long-term health.');
    return { summary, lineItems: items, afterText };
  }

  /* Translate the legacy annotation shape produced by the customer-facing
     intake prompt (region/shape/client_label/technical_standard with types
     like "remove" | "clearance" | "final-crown" | "protect" | "drop-zone")
     into the shape this renderer expects (box/poly + ANNOTATION_TYPES keys).
     Annotations already in the new shape are returned unchanged. */
  const LEGACY_TYPE_MAP = {
    remove:        'removal_zone',
    deadwood:      'deadwood',
    clearance:     'clearance',
    'final-crown': 'preserve_zone',
    preserve:      'preserve_zone',
    protect:       'target',
    'drop-zone':   'target',
  };
  function adaptAnnotation(an) {
    if (!an || typeof an !== 'object') return null;
    if (an.box || an.poly || typeof an.x === 'number') return an;
    if (an.region) {
      const r = an.region;
      return {
        type:  LEGACY_TYPE_MAP[an.type] || an.type || 'crown_clean',
        box:   { x: +r.x, y: +r.y, w: +r.w, h: +r.h },
        label: an.client_label || an.label || undefined,
        note:  an.technical_standard || an.note || undefined,
      };
    }
    return an;
  }

  /* ---- normalization: the ONLY place field names are read ---------------- */
  function normalizeAnalysis(raw) {
    raw = raw || {};
    const svcSource = raw.service_type || raw.servicePreset
                   || raw.recommended_service || raw.recommended_pkg_key || '';
    const svc = String(svcSource).toLowerCase();
    const isRemoval = /remov/.test(svc);
    const annotationsRaw = Array.isArray(raw.annotations) ? raw.annotations
                         : Array.isArray(raw.annotation)  ? raw.annotation
                         : [];
    return {
      common_name:    raw.common_name || raw.species || 'Tree',
      latin_name:     raw.latin_name || raw.scientific_name || '',
      est_height_ft:  raw.est_height_ft ?? raw.estimated_height_ft ?? raw.est_height ?? null,
      isa_risk_rating:raw.isa_risk_rating || raw.risk || raw.observedCondition
                    || (Array.isArray(raw.hazard_flags) && raw.hazard_flags[0]) || '',
      quote_low:      raw.quote_low ?? raw.price_range_low ?? raw.approved_quote_low  ?? null,
      quote_high:     raw.quote_high ?? raw.price_range_high ?? raw.approved_quote_high ?? null,
      after_description: raw.after_description || raw.afterDescription || '',
      service_type:   isRemoval ? 'removal' : (svc || 'trim'),
      service_label:  isRemoval ? 'Full removal · site cleared' : 'Trimmed to ISA standard',
      annotations:    annotationsRaw.map(adaptAnnotation).filter(Boolean),
    };
  }

  /* ---- export ------------------------------------------------------------- */
  const API = {
    generateBefore,
    generateAnnotatedPhoto,
    generateAfterRendering,
    buildScope,
    ANNOTATION_TYPES,
    normalizeAnalysis,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.TreeAnnotations = API;
})(typeof window !== 'undefined' ? window : this);
