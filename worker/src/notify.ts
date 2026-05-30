import type { Bindings } from "./types";

/**
 * Email + SMS notifications.
 * Email: Resend (https://resend.com) — free tier covers 3k emails/mo.
 *   Set secret RESEND_API_KEY.
 * SMS: Twilio — required only if cron follow-ups enabled.
 *   Set secrets TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN; var TWILIO_FROM_NUMBER.
 */

// ────────────────────────────────────────────────────────────
// Email
// ────────────────────────────────────────────────────────────

type EmailMsg = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail(env: Bindings, msg: EmailMsg): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — email skipped:", msg.subject);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${env.COMPANY_NAME} <${env.FROM_EMAIL}>`,
      // `to` may be a single address or several comma-separated (e.g. OPERATOR_EMAIL
      // = "a@x.com, b@y.com") — split into the array Resend expects.
      to: msg.to.split(",").map(s => s.trim()).filter(Boolean),
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      reply_to: msg.replyTo,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Resend send failed", res.status, body);
    throw new Error(`Email send failed: ${res.status}`);
  }
}

// ────────────────────────────────────────────────────────────
// SMS via Twilio
// ────────────────────────────────────────────────────────────

export async function sendSms(env: Bindings, to: string, body: string): Promise<{ sid: string } | null> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    console.warn("Twilio not configured — SMS skipped:", body.slice(0, 80));
    return null;
  }
  const form = new URLSearchParams({
    From: env.TWILIO_FROM_NUMBER,
    To: to,
    Body: body,
  });
  const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Twilio send failed", res.status, body);
    throw new Error(`SMS send failed: ${res.status}`);
  }
  const data: any = await res.json();
  return { sid: data.sid };
}

// ────────────────────────────────────────────────────────────
// Operator booking notification (replaces old single-quote builder).
// Used by the Calendly webhook handler.
// ────────────────────────────────────────────────────────────

type EstimateSummary = {
  id: string;
  total_low: number;
  total_high: number;
  trees: Array<{ id: string; species: string | null; selected_pkg: string | null; quote_low: number | null; quote_high: number | null }>;
};

type ContactSummary = {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type BookingSummary = {
  scheduled_for: string | null;
  notes: string | null;
};

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US");
}

export function buildOperatorBookingEmail(
  env: Bindings,
  estimate: EstimateSummary,
  contact: ContactSummary,
  booking: BookingSummary,
  baseUrl: string,
): EmailMsg {
  const treesHtml = estimate.trees.map(t => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #d9e6dd;">
        <img src="${baseUrl}/api/tree-photo/${t.id}" width="64" height="64"
             style="border-radius:8px;object-fit:cover;display:block;" alt="">
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #d9e6dd;">
        <strong>${t.species ?? "Unknown tree"}</strong><br>
        <span style="color:#6b7c70;font-size:12px;">${t.selected_pkg ?? "—"}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #d9e6dd;color:#1c7a42;font-weight:600;text-align:right;">
        ${fmtMoney(t.quote_low)} – ${fmtMoney(t.quote_high)}
      </td>
    </tr>
  `).join("");

  const subject = `🌳 New booking: ${contact.name ?? "Customer"} — ${estimate.trees.length} ${estimate.trees.length === 1 ? "tree" : "trees"}`;
  const html = `
<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#0f1a12;max-width:640px;margin:0 auto;padding:24px;">
  <h2 style="color:#1c7a42;margin:0 0 6px;">🌳 New booking</h2>
  <p style="color:#6b7c70;margin:0 0 20px;">${env.COMPANY_NAME} — estimate #${estimate.id.slice(0, 8)}</p>

  <h3 style="margin:8px 0;">Customer</h3>
  <table style="width:100%;font-size:14px;border-collapse:collapse;">
    <tr><td style="padding:4px 0;color:#6b7c70;width:120px;">Name</td><td><strong>${contact.name ?? "—"}</strong></td></tr>
    <tr><td style="padding:4px 0;color:#6b7c70;">Email</td><td><a href="mailto:${contact.email}">${contact.email ?? "—"}</a></td></tr>
    <tr><td style="padding:4px 0;color:#6b7c70;">Phone</td><td><a href="tel:${contact.phone}">${contact.phone ?? "—"}</a></td></tr>
    <tr><td style="padding:4px 0;color:#6b7c70;">Address</td><td>${contact.address ?? "—"}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7c70;">Scheduled</td><td><strong>${booking.scheduled_for ?? "—"}</strong></td></tr>
  </table>

  <h3 style="margin:24px 0 8px;">Trees on this estimate</h3>
  <table style="width:100%;border-collapse:collapse;border:1px solid #d9e6dd;border-radius:8px;overflow:hidden;">
    ${treesHtml}
    <tr>
      <td colspan="2" style="padding:12px;background:#eaf7ef;color:#1c7a42;font-weight:600;">Estimate total</td>
      <td style="padding:12px;background:#eaf7ef;color:#1c7a42;font-weight:700;text-align:right;">
        ${fmtMoney(estimate.total_low)} – ${fmtMoney(estimate.total_high)}
      </td>
    </tr>
  </table>

  ${booking.notes ? `<h3 style="margin:24px 0 8px;">Customer notes</h3><p style="white-space:pre-wrap;background:#f6f8f6;padding:12px;border-radius:8px;">${booking.notes}</p>` : ""}

  <p style="margin-top:24px;font-size:12px;color:#6b7c70;">Estimate ID: ${estimate.id}</p>
</body></html>
  `.trim();

  const text = [
    `New booking — ${env.COMPANY_NAME}`,
    `Customer: ${contact.name ?? "—"} <${contact.email ?? "—"}>`,
    `Phone:    ${contact.phone ?? "—"}`,
    `Address:  ${contact.address ?? "—"}`,
    `Scheduled: ${booking.scheduled_for ?? "—"}`,
    ``,
    `Trees:`,
    ...estimate.trees.map(t => `  • ${t.species ?? "Unknown"} — ${t.selected_pkg ?? "—"} — ${fmtMoney(t.quote_low)}–${fmtMoney(t.quote_high)}`),
    ``,
    `Total: ${fmtMoney(estimate.total_low)}–${fmtMoney(estimate.total_high)}`,
    ``,
    `Estimate: ${estimate.id}`,
  ].join("\n");

  return {
    to: env.OPERATOR_EMAIL,
    subject,
    html,
    text,
    replyTo: contact.email ?? undefined,
  };
}

// ────────────────────────────────────────────────────────────
// Customer-facing estimate email (sent when they submit)
// ────────────────────────────────────────────────────────────

export function buildCustomerEstimateEmail(
  env: Bindings,
  estimate: EstimateSummary,
  contact: ContactSummary,
  resumeUrl: string,
  baseUrl: string,
): EmailMsg {
  const treesHtml = estimate.trees.map(t => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #d9e6dd;vertical-align:top;width:80px;">
        <img src="${baseUrl}/api/tree-photo/${t.id}" width="64" height="64"
             style="border-radius:8px;object-fit:cover;display:block;" alt="">
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #d9e6dd;">
        <strong>${t.species ?? "Tree"}</strong><br>
        <span style="color:#6b7c70;font-size:13px;">${t.selected_pkg ?? "—"}</span>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #d9e6dd;color:#1c7a42;font-weight:600;text-align:right;white-space:nowrap;">
        ${fmtMoney(t.quote_low)}<br>– ${fmtMoney(t.quote_high)}
      </td>
    </tr>
  `).join("");

  const html = `
<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#0f1a12;background:#f6f8f6;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #d9e6dd;">
    <div style="font-size:2rem;line-height:1;margin-bottom:8px;">🌳</div>
    <h1 style="font-size:1.5rem;margin:0 0 4px;color:#0f1a12;">Your TreeVision estimate</h1>
    <p style="color:#6b7c70;margin:0 0 24px;">Hi ${contact.name ? contact.name.split(" ")[0] : "there"}, here's your estimate from ${env.COMPANY_NAME}.</p>

    <table style="width:100%;border-collapse:collapse;border:1px solid #d9e6dd;border-radius:10px;overflow:hidden;">
      ${treesHtml}
      <tr>
        <td colspan="2" style="padding:14px;background:#1c7a42;color:#fff;font-weight:600;">Total estimate</td>
        <td style="padding:14px;background:#1c7a42;color:#fff;font-weight:700;text-align:right;">
          ${fmtMoney(estimate.total_low)} – ${fmtMoney(estimate.total_high)}
        </td>
      </tr>
    </table>

    <p style="font-size:13px;color:#6b7c70;margin:14px 0;">Estimate is based on visual AI analysis. Final pricing confirmed on-site per ANSI A300 standards.</p>

    <div style="margin:28px 0;text-align:center;">
      <a href="${resumeUrl}" style="display:inline-block;background:#2faa5e;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;">
        View &amp; book your service →
      </a>
    </div>

    <p style="font-size:13px;color:#6b7c70;margin-top:24px;">Questions? Just reply to this email or call ${env.OPERATOR_PHONE}.</p>
  </div>
</body></html>
  `.trim();

  return {
    to: contact.email!,
    subject: `Your tree estimate — ${fmtMoney(estimate.total_low)}–${fmtMoney(estimate.total_high)}`,
    html,
    text: `Your TreeVision estimate from ${env.COMPANY_NAME}:\n\n${estimate.trees.map(t => `• ${t.species ?? "Tree"} — ${t.selected_pkg ?? "—"} — ${fmtMoney(t.quote_low)}–${fmtMoney(t.quote_high)}`).join("\n")}\n\nTotal: ${fmtMoney(estimate.total_low)}–${fmtMoney(estimate.total_high)}\n\nView and book: ${resumeUrl}`,
    replyTo: env.OPERATOR_EMAIL,
  };
}

export function buildFollowUpSms(env: Bindings, contact: ContactSummary, estimate: EstimateSummary, resumeUrl: string): string {
  const first = contact.name ? contact.name.split(" ")[0] : "there";
  const range = `${fmtMoney(estimate.total_low)}–${fmtMoney(estimate.total_high)}`;
  return `Hi ${first}, ${env.COMPANY_NAME} here — your tree estimate (${range}) is still waiting if you'd like to book. Anything we can answer? ${resumeUrl}`;
}
