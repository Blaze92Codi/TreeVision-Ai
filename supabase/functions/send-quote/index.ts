import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Escape user-controlled strings before interpolating into the email HTML.
const escapeHtml = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/**
 * send-quote Edge Function
 *
 * Fetches an approved estimate from the DB, builds an HTML email,
 * and sends it to the customer via Resend.
 *
 * SECURITY:
 *   - Caller must be an authenticated staff member (owner or crew_manager).
 *     The anon key is NOT a valid caller — it carries no user identity, so
 *     supabase.auth.getUser() rejects it. This closes the previous abuse path
 *     where anyone could trigger emails through the verified Resend sender.
 *   - All customer-supplied fields are HTML-escaped before templating.
 *
 * Expected POST body (from portal.js handleSendQuote()):
 * {
 *   estimate_id: string    — UUID of the estimate (primary key)
 * }
 * Authorization header must carry the signed-in manager's access token.
 *
 * Required secrets:
 *   RESEND_API_KEY      — api.resend.com key
 *   QUOTE_FROM_EMAIL    — verified sender address (e.g. quotes@yourdomain.com)
 *   COMPANY_NAME        — company name for email branding
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY environment variable not set");

    const fromAddress = Deno.env.get("QUOTE_FROM_EMAIL") ?? "quotes@treevision.app";
    const companyName = Deno.env.get("COMPANY_NAME") ?? "Dynamic Tree Service";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Require an authenticated staff caller ────────────────────────────────
    const callerJwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user: caller }, error: callerErr } = await supabase.auth.getUser(callerJwt);
    if (callerErr || !caller) {
      return json({ error: "Unauthorized — sign in as staff to send quotes." }, 401);
    }
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", caller.id).single();
    if (!profile || !["owner", "crew_manager"].includes(profile.role)) {
      return json({ error: "Forbidden — staff role required to send quotes." }, 403);
    }
    const approvedBy = caller.email ?? "Manager";

    const body = await req.json();
    // Accept both estimate_id (portal/dashboard) and jobId (legacy)
    const estimateId = body.estimate_id || body.jobId;

    if (!estimateId) {
      return json({ error: "estimate_id is required" }, 400);
    }

    // Fetch the estimate from DB
    const { data: estimate, error: fetchError } = await supabase
      .from("estimates")
      .select("*")
      .eq("id", estimateId)
      .single();

    if (fetchError || !estimate) {
      return json({ error: `Estimate not found: ${estimateId}` }, 404);
    }

    if (!estimate.customer_email) {
      return json({ error: "Estimate has no customer email — cannot send quote" }, 400);
    }

    if (estimate.status !== "approved" && estimate.status !== "scheduled") {
      return json({
        error: `Estimate status is "${estimate.status}". Must be "approved" or "scheduled" to send.`,
      }, 409);
    }

    // Use manager-approved quote if available, otherwise fall back to AI quote
    const quoteLow  = estimate.approved_quote_low  ?? estimate.quote_low  ?? 0;
    const quoteHigh = estimate.approved_quote_high ?? estimate.quote_high ?? 0;
    const service   = estimate.selected_service    ?? estimate.recommended_service ?? "tree service";
    const notes     = Array.isArray(estimate.ai_notes) ? estimate.ai_notes as string[] : [];

    // Pre-escape every customer-controlled field used in the template.
    const eName      = escapeHtml(estimate.customer_name);
    const eAddress   = escapeHtml(estimate.job_address);
    const eService   = escapeHtml(service);
    const eSpecies   = escapeHtml(estimate.species);
    const eLatin     = escapeHtml(estimate.latin_name);
    const eCondition = escapeHtml(estimate.condition);
    const eHeight    = escapeHtml(estimate.est_height);
    const eMgrNotes  = escapeHtml(estimate.manager_notes);
    const eApprovedBy = escapeHtml(approvedBy);

    const notesHtml = notes.length
      ? `<ul style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#374151;">${notes.map((n) => `<li style="margin-bottom:4px;">${escapeHtml(n)}</li>`).join("")}</ul>`
      : "";

    const managerNotesHtml = estimate.manager_notes
      ? `<div style="background:#f0fdf4;border-left:4px solid #166534;padding:10px 14px;border-radius:4px;margin-top:8px;font-size:14px;color:#374151;">
          <strong>From our team:</strong> ${eMgrNotes}
         </div>`
      : "";

    const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Your Tree Service Estimate</title></head>
<body style="font-family:Arial,sans-serif;color:#111827;max-width:640px;margin:0 auto;padding:24px;background:#f9fafb;">

  <div style="background:#166534;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#ffffff;margin:0;font-size:22px;">${escapeHtml(companyName)}</h1>
    <p style="color:#bbf7d0;margin:6px 0 0;font-size:13px;">Professional Tree Service Estimate</p>
  </div>

  <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">

    <p style="font-size:16px;margin-top:0;">Hello${eName ? " <strong>" + eName + "</strong>" : ""},</p>
    <p style="color:#6b7280;font-size:14px;">Thank you for choosing ${escapeHtml(companyName)}. Here is your professional estimate based on our tree assessment.</p>

    ${eAddress ? `
    <p style="background:#f0fdf4;padding:10px 14px;border-left:4px solid #166534;border-radius:4px;font-weight:600;font-size:14px;margin:0 0 16px;">
      📍 ${eAddress}
    </p>` : ""}

    <h2 style="color:#166534;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">Service Estimate</h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="padding:10px;background:#f0fdf4;border:1px solid #d1fae5;font-size:13px;color:#6b7280;width:40%;">Service</td>
        <td style="padding:10px;background:#f0fdf4;border:1px solid #d1fae5;font-size:14px;font-weight:600;">${eService}</td>
      </tr>
      <tr>
        <td style="padding:10px;background:#f8fafc;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Estimate Range</td>
        <td style="padding:10px;background:#f8fafc;border:1px solid #e5e7eb;font-size:18px;font-weight:700;color:#166534;">
          $${quoteLow.toLocaleString()} – $${quoteHigh.toLocaleString()}
        </td>
      </tr>
      ${eSpecies ? `<tr>
        <td style="padding:10px;background:#f0fdf4;border:1px solid #d1fae5;font-size:13px;color:#6b7280;">Tree Species</td>
        <td style="padding:10px;background:#f0fdf4;border:1px solid #d1fae5;font-size:14px;">${eSpecies}${eLatin ? " <em style='color:#6b7280;font-size:12px;'>(" + eLatin + ")</em>" : ""}</td>
      </tr>` : ""}
      ${eCondition ? `<tr>
        <td style="padding:10px;background:#f8fafc;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Condition</td>
        <td style="padding:10px;background:#f8fafc;border:1px solid #e5e7eb;font-size:14px;">${eCondition}</td>
      </tr>` : ""}
      ${eHeight ? `<tr>
        <td style="padding:10px;background:#f0fdf4;border:1px solid #d1fae5;font-size:13px;color:#6b7280;">Est. Height</td>
        <td style="padding:10px;background:#f0fdf4;border:1px solid #d1fae5;font-size:14px;">${eHeight}</td>
      </tr>` : ""}
    </table>

    ${notesHtml ? `
    <h2 style="color:#166534;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">Assessment Notes</h2>
    ${notesHtml}` : ""}

    ${managerNotesHtml}

    <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:14px 16px;margin-top:24px;font-size:13px;">
      <strong>Important:</strong> This is a preliminary estimate based on a photo assessment.
      Final price is confirmed at the time of service. All work performed per ANSI A300 standards by licensed, insured crew.
    </div>

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
      <p style="font-size:14px;margin:0 0 8px;">Ready to schedule? Give us a call or reply to this email.</p>
      <p style="font-size:13px;color:#6b7280;margin:0;">Best regards,<br><strong>${escapeHtml(companyName)} Team</strong></p>
    </div>

    <p style="font-size:11px;color:#9ca3af;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:12px;">
      Reference: ${escapeHtml(String(estimate.id).substring(0, 8).toUpperCase())} · Approved by: ${eApprovedBy}
    </p>
  </div>
</body>
</html>`;

    // Send via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [estimate.customer_email],
        // Strip CR/LF from header-bound values to avoid header injection.
        subject: `Your Tree Service Estimate — ${service}${estimate.job_address ? " at " + estimate.job_address : ""}`.replace(/[\r\n]+/g, " "),
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      throw new Error(`Resend API error ${resendResponse.status}: ${errText}`);
    }

    const resendData = await resendResponse.json();

    // Mark as sent in DB
    await supabase
      .from("estimates")
      .update({
        quote_sent_at: new Date().toISOString(),
        quote_email_id: resendData.id ?? null,
        approved_by: approvedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estimateId);

    return json({
      success: true,
      emailId: resendData.id,
      sentTo: estimate.customer_email,
      estimateId,
    });
  } catch (err) {
    console.error("send-quote error:", err);
    return json({ error: err.message ?? "Internal server error" }, 500);
  }
});
