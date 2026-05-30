import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import type { Bindings, PkgKey, Annotation, EstimateRow, TreeRow, ContactRow } from "./types";
import { analyzeTreePhoto } from "./analyze";
import { computePrices, computeEstimateTotal, bundleDiscountPct } from "./pricing";
import { checkAndRecord, hashIp, verifyTurnstile } from "./ratelimit";
import { extractBookingFields, verifyCalendlySignature } from "./calendly";
import {
  buildOperatorBookingEmail, buildCustomerEstimateEmail, buildFollowUpSms,
  sendEmail, sendSms,
} from "./notify";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", logger());
app.use("/api/*", async (c, next) => {
  const origin = c.env.ALLOWED_ORIGINS || "*";
  return cors({
    origin: origin === "*" ? "*" : origin.split(",").map(s => s.trim()),
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })(c, next);
});

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_TREES_PER_ESTIMATE = 12;

function uuid(): string { return crypto.randomUUID(); }
function shortToken(): string {
  // 16-char url-safe token
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function clientIp(c: any): string {
  return c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}

// ────────────────────────────────────────────────────────────
// PUBLIC CONFIG
// ────────────────────────────────────────────────────────────
app.get("/api/config", c => {
  return c.json({
    company_name: c.env.COMPANY_NAME,
    operator_phone: c.env.OPERATOR_PHONE,
    calendly_url: c.env.CALENDLY_URL,
    isa_cert: c.env.ISA_CERT,
    turnstile_required: !!c.env.TURNSTILE_SECRET,
    bundle_tiers: [
      { min_trees: 2, pct: 5 },
      { min_trees: 3, pct: 10 },
    ],
  });
});

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────
async function loadEstimate(env: Bindings, id: string): Promise<EstimateRow | null> {
  return env.DB.prepare(
    "SELECT id, contact_id, status, total_low, total_high, bundle_discount_pct, share_token, notes, created_at, updated_at FROM estimates WHERE id = ?"
  ).bind(id).first<EstimateRow>();
}

async function loadEstimateByToken(env: Bindings, token: string): Promise<EstimateRow | null> {
  return env.DB.prepare(
    "SELECT id, contact_id, status, total_low, total_high, bundle_discount_pct, share_token, notes, created_at, updated_at FROM estimates WHERE share_token = ?"
  ).bind(token).first<EstimateRow>();
}

async function loadTrees(env: Bindings, estimateId: string): Promise<TreeRow[]> {
  const res = await env.DB.prepare(
    `SELECT id, estimate_id, photo_key, label, species, latin_name, est_height_ft, est_dbh_in,
            crown_spread_ft, condition, risk_rating, recommended_pkg, selected_pkg,
            quote_low, quote_high, annotations
     FROM trees WHERE estimate_id = ? ORDER BY created_at ASC`
  ).bind(estimateId).all<TreeRow & { annotations: string | null }>();
  return res.results.map(r => ({
    ...r,
    annotations: r.annotations ? safeJson(r.annotations) : null,
  })) as TreeRow[];
}

function safeJson<T = any>(s: string): T | null { try { return JSON.parse(s); } catch { return null; } }

async function recomputeEstimateTotals(env: Bindings, estimateId: string) {
  const trees = await loadTrees(env, estimateId);
  const totals = computeEstimateTotal(trees);
  await env.DB.prepare(
    "UPDATE estimates SET total_low = ?, total_high = ?, bundle_discount_pct = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(totals.total_low, totals.total_high, totals.discount_pct, estimateId).run();
  return totals;
}

async function loadContact(env: Bindings, id: string): Promise<ContactRow | null> {
  return env.DB.prepare(
    "SELECT id, name, email, phone, address, property_notes FROM contacts WHERE id = ?"
  ).bind(id).first<ContactRow>();
}

async function logInteraction(env: Bindings, args: {
  contactId?: string | null; estimateId?: string | null;
  channel: string; direction: string; body?: string | null; meta?: any;
}) {
  await env.DB.prepare(
    "INSERT INTO interactions (id, contact_id, estimate_id, channel, direction, body, meta) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    uuid(), args.contactId ?? null, args.estimateId ?? null,
    args.channel, args.direction, args.body ?? null,
    args.meta ? JSON.stringify(args.meta) : null,
  ).run();
}

// At request time the incoming request's origin is always the correct public
// URL (workers.dev or custom domain — whatever the customer actually hit).
// We also persist it so the background cron can build absolute links later.
function publicBase(c: any): string {
  const origin = new URL(c.req.url).origin;
  // Fire-and-forget: keep app_settings.base_url current without blocking the response.
  c.executionCtx?.waitUntil?.(recordBaseUrl(c.env, origin));
  return origin;
}

async function recordBaseUrl(env: Bindings, origin: string): Promise<void> {
  if (!/^https?:\/\//i.test(origin)) return;
  try {
    await env.DB.prepare(
      `INSERT INTO app_settings (key, value) VALUES ('base_url', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
       WHERE app_settings.value != excluded.value`
    ).bind(origin).run();
  } catch (err: any) {
    console.warn("recordBaseUrl failed", err?.message);
  }
}

async function getSetting(env: Bindings, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

function shapeTree(t: TreeRow) {
  // Strip ai_raw, expose annotations as parsed array
  const { ai_raw, ...rest } = t;
  return rest;
}

// ────────────────────────────────────────────────────────────
// POST /api/estimate — start a new estimate session
// ────────────────────────────────────────────────────────────
app.post("/api/estimate", async c => {
  const ip = clientIp(c);
  const ipHash = await hashIp(ip);
  const id = uuid();
  const token = shortToken();
  await c.env.DB.prepare(
    "INSERT INTO estimates (id, status, ip_hash, share_token) VALUES (?, 'draft', ?, ?)"
  ).bind(id, ipHash, token).run();
  return c.json({ estimate_id: id, share_token: token });
});

// ────────────────────────────────────────────────────────────
// GET /api/estimate/:id (or by ?token=)
// ────────────────────────────────────────────────────────────
async function loadBookingForEstimate(env: Bindings, estimateId: string) {
  return env.DB.prepare(
    "SELECT id, scheduled_for, status, final_price FROM bookings WHERE estimate_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(estimateId).first<{ id: string; scheduled_for: string | null; status: string; final_price: number | null }>();
}

app.get("/api/estimate/:id", async c => {
  const id = c.req.param("id");
  const estimate = await loadEstimate(c.env, id);
  if (!estimate) throw new HTTPException(404, { message: "Estimate not found" });
  const trees = await loadTrees(c.env, id);
  const contact = estimate.contact_id ? await loadContact(c.env, estimate.contact_id) : null;
  const booking = await loadBookingForEstimate(c.env, id);
  return c.json({ estimate, trees: trees.map(shapeTree), contact, booking });
});

app.get("/api/estimate/by-token/:token", async c => {
  const token = c.req.param("token");
  const estimate = await loadEstimateByToken(c.env, token);
  if (!estimate) throw new HTTPException(404, { message: "Estimate not found" });
  const trees = await loadTrees(c.env, estimate.id);
  const contact = estimate.contact_id ? await loadContact(c.env, estimate.contact_id) : null;
  const booking = await loadBookingForEstimate(c.env, estimate.id);
  return c.json({ estimate, trees: trees.map(shapeTree), contact, booking });
});

// ────────────────────────────────────────────────────────────
// POST /api/estimate/:id/tree — add a tree (photo upload + AI)
// ────────────────────────────────────────────────────────────
app.post("/api/estimate/:id/tree", async c => {
  const estimateId = c.req.param("id");
  const estimate = await loadEstimate(c.env, estimateId);
  if (!estimate) throw new HTTPException(404, { message: "Estimate not found" });
  if (estimate.status !== "draft" && estimate.status !== "contact_provided") {
    throw new HTTPException(400, { message: "This estimate is locked." });
  }

  const form = await c.req.formData().catch(() => null);
  if (!form) throw new HTTPException(400, { message: "Expected multipart/form-data" });
  // workers-types declares FormData.get() as string|null, but at runtime a
  // multipart file field is a File. Cast, then guard on a File-only method.
  const photo = form.get("photo") as unknown as File | null;
  const turnstileToken = (form.get("turnstile_token") as string) || "";
  const label = ((form.get("label") as string) || "").slice(0, 80) || null;

  if (!photo || typeof photo.arrayBuffer !== "function") throw new HTTPException(400, { message: "Missing photo file" });
  if (photo.size === 0) throw new HTTPException(400, { message: "Empty photo upload" });
  if (photo.size > MAX_IMAGE_BYTES) throw new HTTPException(413, { message: `Photo too large (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB)` });
  if (!ALLOWED_MIME.has(photo.type)) throw new HTTPException(415, { message: `Unsupported image type "${photo.type}".` });

  // Enforce per-estimate tree cap
  const treeCount = await c.env.DB.prepare("SELECT COUNT(*) as n FROM trees WHERE estimate_id = ?").bind(estimateId).first<{ n: number }>();
  if ((treeCount?.n ?? 0) >= MAX_TREES_PER_ESTIMATE) {
    throw new HTTPException(400, { message: `Maximum ${MAX_TREES_PER_ESTIMATE} trees per estimate.` });
  }

  const ip = clientIp(c);
  if (c.env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(c.env.TURNSTILE_SECRET, turnstileToken, ip);
    if (!ok) throw new HTTPException(403, { message: "Bot-check failed." });
  }

  const ipHash = await hashIp(ip);
  const rl = await checkAndRecord(c.env.DB, ipHash, {
    perHour: parseInt(c.env.RATE_LIMIT_PER_HOUR, 10) || 8,
    perDay:  parseInt(c.env.RATE_LIMIT_PER_DAY,  10) || 30,
  });
  if (!rl.allowed) return c.json({ error: rl.reason }, 429, { "Retry-After": String(rl.retryAfterSec) });

  const buf = await photo.arrayBuffer();
  const bytes = new Uint8Array(buf);

  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  const base64 = btoa(bin);

  const treeId = uuid();
  const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
  const photoKey = `trees/${treeId}.${ext}`;
  const r2Put = c.env.PHOTOS.put(photoKey, bytes, { httpMetadata: { contentType: photo.type } });

  // Run analyze in parallel with the R2 upload. If analyze fails, await the
  // upload and delete the orphan so failed photos don't accumulate in R2.
  let analysis;
  try {
    analysis = await analyzeTreePhoto(c.env.ANTHROPIC_API_KEY, base64, photo.type);
    await r2Put;
  } catch (err) {
    await r2Put.then(
      () => c.env.PHOTOS.delete(photoKey).catch(e => console.warn("R2 cleanup failed", e?.message)),
      () => {/* upload already failed, nothing to clean up */},
    );
    throw err;
  }

  const prices = computePrices(analysis);
  const recPkg: PkgKey = (analysis.recommended_pkg_key as PkgKey) || "trim";
  const quoteLow  = prices[recPkg].low;
  const quoteHigh = prices[recPkg].high;
  const annotations: Annotation[] = Array.isArray(analysis.annotations) ? analysis.annotations.slice(0, 6) : [];

  await c.env.DB.prepare(`
    INSERT INTO trees (
      id, estimate_id, photo_key, label, ai_raw,
      species, latin_name, est_height_ft, est_dbh_in, crown_spread_ft,
      condition, risk_rating, recommended_pkg, selected_pkg, quote_low, quote_high, annotations
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    treeId, estimateId, photoKey, label,
    JSON.stringify(analysis),
    analysis.common_name ?? null, analysis.latin_name ?? null,
    analysis.est_height_ft ?? null, analysis.est_dbh_in ?? null, analysis.crown_spread_ft ?? null,
    analysis.condition ?? null, analysis.isa_risk_rating ?? null,
    recPkg, recPkg, quoteLow, quoteHigh,
    JSON.stringify(annotations),
  ).run();

  const totals = await recomputeEstimateTotals(c.env, estimateId);

  return c.json({
    tree: shapeTree({
      id: treeId, estimate_id: estimateId, photo_key: photoKey, label,
      species: analysis.common_name, latin_name: analysis.latin_name,
      est_height_ft: analysis.est_height_ft, est_dbh_in: analysis.est_dbh_in,
      crown_spread_ft: analysis.crown_spread_ft,
      condition: analysis.condition, risk_rating: analysis.isa_risk_rating,
      recommended_pkg: recPkg, selected_pkg: recPkg,
      quote_low: quoteLow, quote_high: quoteHigh, annotations,
    }),
    prices,
    full_analysis: {
      recommended_service: analysis.recommended_service,
      photo_quality: analysis.photo_quality,
      size_class: analysis.size_class,
      confidence: analysis.confidence,
      ansi_standard: analysis.ansi_standard,
      site_assessment: analysis.site_assessment,
      hazard_review: analysis.hazard_review,
      scope_summary: analysis.scope_summary,
      notes: analysis.notes,
      standard_note: analysis.standard_note,
    },
    totals,
  });
});

// ────────────────────────────────────────────────────────────
// PATCH /api/estimate/:id/tree/:treeId — update selected package / label
// ────────────────────────────────────────────────────────────
app.patch("/api/estimate/:id/tree/:treeId", async c => {
  const estimateId = c.req.param("id");
  const treeId = c.req.param("treeId");
  const body = await c.req.json().catch(() => ({} as any));
  const { selected_pkg, label } = body as { selected_pkg?: PkgKey; label?: string };

  const tree = await c.env.DB.prepare(
    "SELECT id, ai_raw FROM trees WHERE id = ? AND estimate_id = ?"
  ).bind(treeId, estimateId).first<{ id: string; ai_raw: string }>();
  if (!tree) throw new HTTPException(404, { message: "Tree not found" });

  const updates: string[] = [];
  const params: any[] = [];
  if (selected_pkg) {
    if (!["trim", "removal", "stump", "treatment"].includes(selected_pkg)) {
      throw new HTTPException(400, { message: "Invalid pkg" });
    }
    const analysis = safeJson<any>(tree.ai_raw);
    const prices = analysis ? computePrices(analysis) : null;
    if (!prices) throw new HTTPException(500, { message: "Analysis missing" });
    updates.push("selected_pkg = ?, quote_low = ?, quote_high = ?");
    params.push(selected_pkg, prices[selected_pkg].low, prices[selected_pkg].high);
  }
  if (typeof label === "string") {
    updates.push("label = ?"); params.push(label.slice(0, 80) || null);
  }
  if (!updates.length) return c.json({ ok: true });
  params.push(treeId);
  await c.env.DB.prepare(`UPDATE trees SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
  const totals = await recomputeEstimateTotals(c.env, estimateId);
  return c.json({ ok: true, totals });
});

// ────────────────────────────────────────────────────────────
// DELETE /api/estimate/:id/tree/:treeId
// ────────────────────────────────────────────────────────────
app.delete("/api/estimate/:id/tree/:treeId", async c => {
  const estimateId = c.req.param("id");
  const treeId = c.req.param("treeId");
  const tree = await c.env.DB.prepare(
    "SELECT id, photo_key FROM trees WHERE id = ? AND estimate_id = ?"
  ).bind(treeId, estimateId).first<{ id: string; photo_key: string }>();
  if (!tree) throw new HTTPException(404, { message: "Tree not found" });
  await c.env.DB.prepare("DELETE FROM trees WHERE id = ?").bind(treeId).run();
  // Best-effort R2 cleanup
  c.env.PHOTOS.delete(tree.photo_key).catch(err => console.warn("R2 delete failed", err?.message));
  const totals = await recomputeEstimateTotals(c.env, estimateId);
  return c.json({ ok: true, totals });
});

// ────────────────────────────────────────────────────────────
// POST /api/estimate/:id/contact — capture lead info
// Body: { name, email, phone, address, property_notes? }
// ────────────────────────────────────────────────────────────
app.post("/api/estimate/:id/contact", async c => {
  const estimateId = c.req.param("id");
  const estimate = await loadEstimate(c.env, estimateId);
  if (!estimate) throw new HTTPException(404, { message: "Estimate not found" });

  const body = await c.req.json().catch(() => ({} as any));
  const name    = String(body.name    ?? "").trim().slice(0, 120);
  const email   = String(body.email   ?? "").trim().toLowerCase().slice(0, 200);
  const phone   = String(body.phone   ?? "").trim().slice(0, 32);
  const address = String(body.address ?? "").trim().slice(0, 300);
  const propertyNotes = String(body.property_notes ?? "").trim().slice(0, 1000) || null;

  if (!name || !email || !phone) {
    throw new HTTPException(400, { message: "Name, email, and phone are required" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HTTPException(400, { message: "Invalid email" });
  }

  // Upsert contact by email or phone (idempotent for returning customers)
  let contact = await c.env.DB.prepare(
    "SELECT id FROM contacts WHERE email = ? OR phone = ?"
  ).bind(email, phone).first<{ id: string }>();

  let contactId: string;
  if (contact) {
    contactId = contact.id;
    await c.env.DB.prepare(
      "UPDATE contacts SET name = ?, email = ?, phone = ?, address = ?, property_notes = COALESCE(?, property_notes) WHERE id = ?"
    ).bind(name, email, phone, address, propertyNotes, contactId).run();
  } else {
    contactId = uuid();
    await c.env.DB.prepare(
      "INSERT INTO contacts (id, name, email, phone, address, property_notes, source) VALUES (?, ?, ?, ?, ?, ?, 'web')"
    ).bind(contactId, name, email, phone, address, propertyNotes).run();
  }

  await c.env.DB.prepare(
    "UPDATE estimates SET contact_id = ?, status = 'contact_provided', updated_at = datetime('now') WHERE id = ?"
  ).bind(contactId, estimateId).run();

  await logInteraction(c.env, {
    contactId, estimateId, channel: "system", direction: "system",
    body: `Contact captured on estimate ${estimateId.slice(0, 8)}`,
  });

  return c.json({ ok: true, contact_id: contactId });
});

// ────────────────────────────────────────────────────────────
// POST /api/estimate/:id/submit — lock & email
// ────────────────────────────────────────────────────────────
app.post("/api/estimate/:id/submit", async c => {
  const estimateId = c.req.param("id");
  const estimate = await loadEstimate(c.env, estimateId);
  if (!estimate) throw new HTTPException(404, { message: "Estimate not found" });
  if (!estimate.contact_id) throw new HTTPException(400, { message: "Contact info required before submitting" });
  if (estimate.status === "submitted" || estimate.status === "booked" || estimate.status === "completed") {
    return c.json({ ok: true, status: estimate.status });
  }

  const trees = await loadTrees(c.env, estimateId);
  if (trees.length === 0) throw new HTTPException(400, { message: "Add at least one tree before submitting" });

  await c.env.DB.prepare(
    "UPDATE estimates SET status = 'submitted', submitted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).bind(estimateId).run();

  const contact = await loadContact(c.env, estimate.contact_id);
  if (contact?.email) {
    const refreshed = await loadEstimate(c.env, estimateId);
    const summary = {
      id: estimateId,
      total_low: refreshed!.total_low,
      total_high: refreshed!.total_high,
      trees: trees.map(t => ({ id: t.id, species: t.species, selected_pkg: t.selected_pkg, quote_low: t.quote_low, quote_high: t.quote_high })),
    };
    const resumeUrl = `${publicBase(c)}/?token=${estimate.share_token}`;
    try {
      const msg = buildCustomerEstimateEmail(c.env, summary, contact, resumeUrl, publicBase(c));
      await sendEmail(c.env, msg);
      await logInteraction(c.env, {
        contactId: contact.id, estimateId, channel: "email_out", direction: "outbound",
        body: `Estimate email sent (${msg.subject})`,
      });
    } catch (err: any) { console.error("Estimate email failed", err?.message); }
  }

  return c.json({ ok: true, status: "submitted" });
});

// ────────────────────────────────────────────────────────────
// Photo proxy — both /api/tree-photo/:id and legacy /api/photo/:id
// ────────────────────────────────────────────────────────────
app.get("/api/tree-photo/:id", async c => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT photo_key FROM trees WHERE id = ?").bind(id).first<{ photo_key: string }>();
  if (!row) throw new HTTPException(404, { message: "Not found" });
  const obj = await c.env.PHOTOS.get(row.photo_key);
  if (!obj) throw new HTTPException(404, { message: "Photo not found" });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("cache-control", "private, max-age=86400");
  return new Response(obj.body, { headers });
});

// ────────────────────────────────────────────────────────────
// CALENDLY WEBHOOK
// ────────────────────────────────────────────────────────────
app.post("/api/webhooks/calendly", async c => {
  const raw = await c.req.text();
  const sigHeader = c.req.header("calendly-webhook-signature");
  const ok = await verifyCalendlySignature(c.env.CALENDLY_WEBHOOK_SIGNING_KEY || "", sigHeader ?? null, raw);
  if (!ok) throw new HTTPException(401, { message: "Bad signature" });

  let body: any;
  try { body = JSON.parse(raw); } catch { throw new HTTPException(400, { message: "Bad JSON" }); }
  if (body?.event !== "invitee.created") return c.json({ ok: true, ignored: body?.event });

  const tracking = body?.payload?.tracking ?? {};
  const estimateId = tracking.utm_content || null;
  const fields = extractBookingFields(body);

  let estimate: EstimateRow | null = null;
  let trees: TreeRow[] = [];
  let contact: ContactRow | null = null;
  if (estimateId) {
    estimate = await loadEstimate(c.env, estimateId);
    if (estimate) {
      trees = await loadTrees(c.env, estimateId);
      if (estimate.contact_id) contact = await loadContact(c.env, estimate.contact_id);
    }
  }

  const bookingId = uuid();
  await c.env.DB.prepare(`
    INSERT INTO bookings (id, estimate_id, contact_id, calendly_event, calendly_uri, scheduled_for, status)
    VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
  `).bind(
    bookingId,
    estimateId,
    contact?.id ?? null,
    fields.calendlyEvent,
    fields.calendlyUri,
    fields.scheduledFor,
  ).run();

  if (estimateId) {
    await c.env.DB.prepare("UPDATE estimates SET status = 'booked', updated_at = datetime('now') WHERE id = ?").bind(estimateId).run();
  }
  if (contact?.id) {
    await logInteraction(c.env, {
      contactId: contact.id, estimateId,
      channel: "system", direction: "system",
      body: `Booked Calendly slot ${fields.scheduledFor ?? "(time TBD)"}`,
    });
  }

  // Operator email
  if (estimate && contact) {
    try {
      const msg = buildOperatorBookingEmail(
        c.env,
        { id: estimate.id, total_low: estimate.total_low, total_high: estimate.total_high,
          trees: trees.map(t => ({ id: t.id, species: t.species, selected_pkg: t.selected_pkg, quote_low: t.quote_low, quote_high: t.quote_high })) },
        contact,
        { scheduled_for: fields.scheduledFor, notes: fields.notes },
        publicBase(c),
      );
      await sendEmail(c.env, msg);
    } catch (err: any) { console.error("Operator email failed", err?.message); }
  }

  return c.json({ ok: true, booking_id: bookingId, estimate_id: estimateId });
});

// ────────────────────────────────────────────────────────────
// ADMIN — bearer-token auth
// ────────────────────────────────────────────────────────────
function requireAdmin(c: any): void {
  const auth = c.req.header("authorization") ?? "";
  const expected = `Bearer ${c.env.ADMIN_TOKEN}`;
  if (!c.env.ADMIN_TOKEN || auth !== expected) throw new HTTPException(401, { message: "Unauthorized" });
}

app.get("/api/admin/leads", async c => {
  requireAdmin(c);
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 300);
  const rows = await c.env.DB.prepare(`
    SELECT e.id as estimate_id, e.created_at, e.status, e.total_low, e.total_high,
           e.bundle_discount_pct,
           (SELECT COUNT(*) FROM trees WHERE estimate_id = e.id) as tree_count,
           c.id as contact_id, c.name as contact_name, c.email as contact_email,
           c.phone as contact_phone, c.address as contact_address,
           b.id as booking_id, b.scheduled_for, b.final_price
    FROM estimates e
    LEFT JOIN contacts c ON c.id = e.contact_id
    LEFT JOIN bookings b ON b.estimate_id = e.id
    ORDER BY e.updated_at DESC
    LIMIT ?
  `).bind(limit).all();
  return c.json({ leads: rows.results });
});

app.get("/api/admin/contacts", async c => {
  requireAdmin(c);
  const limit = Math.min(parseInt(c.req.query("limit") || "200", 10), 500);
  const rows = await c.env.DB.prepare(`
    SELECT c.id, c.name, c.email, c.phone, c.address, c.created_at,
           (SELECT COUNT(*) FROM estimates WHERE contact_id = c.id) as estimate_count,
           (SELECT COUNT(*) FROM bookings  WHERE contact_id = c.id) as booking_count,
           (SELECT SUM(final_price) FROM bookings WHERE contact_id = c.id AND final_price IS NOT NULL) as lifetime_value,
           (SELECT MAX(created_at) FROM estimates WHERE contact_id = c.id) as last_estimate_at
    FROM contacts c
    ORDER BY last_estimate_at DESC NULLS LAST, c.created_at DESC
    LIMIT ?
  `).bind(limit).all();
  return c.json({ contacts: rows.results });
});

app.get("/api/admin/contact/:id", async c => {
  requireAdmin(c);
  const id = c.req.param("id");
  const contact = await loadContact(c.env, id);
  if (!contact) throw new HTTPException(404, { message: "Contact not found" });

  const estimates = await c.env.DB.prepare(`
    SELECT e.id, e.status, e.total_low, e.total_high, e.created_at, e.updated_at,
           (SELECT COUNT(*) FROM trees WHERE estimate_id = e.id) as tree_count,
           b.id as booking_id, b.scheduled_for, b.final_price
    FROM estimates e LEFT JOIN bookings b ON b.estimate_id = e.id
    WHERE e.contact_id = ?
    ORDER BY e.created_at DESC
  `).bind(id).all();

  const interactions = await c.env.DB.prepare(`
    SELECT id, created_at, channel, direction, body
    FROM interactions WHERE contact_id = ? ORDER BY created_at DESC LIMIT 200
  `).bind(id).all();

  return c.json({ contact, estimates: estimates.results, interactions: interactions.results });
});

app.get("/api/admin/estimate/:id", async c => {
  requireAdmin(c);
  const id = c.req.param("id");
  const estimate = await loadEstimate(c.env, id);
  if (!estimate) throw new HTTPException(404, { message: "Estimate not found" });
  const trees = await loadTrees(c.env, id);
  const contact = estimate.contact_id ? await loadContact(c.env, estimate.contact_id) : null;
  const booking = await c.env.DB.prepare("SELECT * FROM bookings WHERE estimate_id = ?").bind(id).first();
  return c.json({ estimate, trees: trees.map(shapeTree), contact, booking });
});

app.post("/api/admin/booking/:id/final-price", async c => {
  requireAdmin(c);
  const id = c.req.param("id");
  const { final_price, notes } = await c.req.json<{ final_price: number; notes?: string }>();
  if (typeof final_price !== "number" || final_price < 0) {
    throw new HTTPException(400, { message: "final_price must be a non-negative number" });
  }
  await c.env.DB.prepare(
    "UPDATE bookings SET final_price = ?, on_site_notes = COALESCE(?, on_site_notes), status = 'completed' WHERE id = ?"
  ).bind(final_price, notes ?? null, id).run();
  await c.env.DB.prepare(
    "UPDATE estimates SET status = 'completed', updated_at = datetime('now') WHERE id = (SELECT estimate_id FROM bookings WHERE id = ?)"
  ).bind(id).run();
  return c.json({ ok: true });
});

// ────────────────────────────────────────────────────────────
// CRON — runs once an hour. Sends 48h SMS follow-up to submitted estimates
// that never got a booking.
// ────────────────────────────────────────────────────────────
export async function runFollowUpCron(env: Bindings): Promise<{ sent: number; skipped: number }> {
  // SMS without an absolute URL is unclickable in most clients; skip the run rather
  // than send a confusing message and falsely log it as "sent" in interactions.
  // Prefer the URL the app discovered at request time; fall back to the env var.
  const baseUrl = (await getSetting(env, "base_url")) || env.PUBLIC_BASE_URL || "";
  if (!/^https?:\/\//i.test(baseUrl)) {
    console.warn("runFollowUpCron: no absolute base URL known yet — skipping (the app records it on first web request).");
    return { sent: 0, skipped: 0 };
  }
  // Estimates submitted >= 48h ago, status='submitted' (not yet booked), with a contact + phone,
  // that haven't already received a follow-up SMS.
  const stale = await env.DB.prepare(`
    SELECT e.id as estimate_id, e.share_token, e.total_low, e.total_high,
           c.id as contact_id, c.name, c.email, c.phone
    FROM estimates e
    JOIN contacts c ON c.id = e.contact_id
    WHERE e.status = 'submitted'
      AND e.submitted_at <= datetime('now', '-48 hours')
      AND c.phone IS NOT NULL AND c.phone != ''
      AND NOT EXISTS (
        SELECT 1 FROM interactions i
        WHERE i.estimate_id = e.id AND i.channel = 'sms_out'
      )
    LIMIT 50
  `).all<any>();

  let sent = 0, skipped = 0;
  for (const row of stale.results) {
    const trees = await env.DB.prepare(
      "SELECT id, species, selected_pkg, quote_low, quote_high FROM trees WHERE estimate_id = ?"
    ).bind(row.estimate_id).all<{ id: string; species: string | null; selected_pkg: string | null; quote_low: number | null; quote_high: number | null }>();

    const summary = {
      id: row.estimate_id, total_low: row.total_low, total_high: row.total_high,
      trees: trees.results,
    };
    const contact = { name: row.name, email: row.email, phone: row.phone, address: null };
    const resumeUrl = `${baseUrl}/?token=${row.share_token}`;
    const msg = buildFollowUpSms(env, contact, summary, resumeUrl);

    try {
      const result = await sendSms(env, row.phone, msg);
      if (result) {
        await env.DB.prepare(
          "INSERT INTO interactions (id, contact_id, estimate_id, channel, direction, body, meta) VALUES (?, ?, ?, 'sms_out', 'outbound', ?, ?)"
        ).bind(uuid(), row.contact_id, row.estimate_id, msg, JSON.stringify({ sid: result.sid })).run();
        sent++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      console.error("Follow-up SMS failed for", row.estimate_id, err?.message);
      skipped++;
    }
  }
  return { sent, skipped };
}

// Manual trigger for the cron (admin-only) — useful for testing
app.post("/api/admin/run-followups", async c => {
  requireAdmin(c);
  const result = await runFollowUpCron(c.env);
  return c.json(result);
});

// ────────────────────────────────────────────────────────────
// ERRORS
// ────────────────────────────────────────────────────────────
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error("Unhandled error", err);
  return c.json({ error: err.message || "Internal error" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings) {
    await runFollowUpCron(env);
  },
};
