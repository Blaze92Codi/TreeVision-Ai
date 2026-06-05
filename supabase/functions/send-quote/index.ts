import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * send-quote Edge Function
 *
 * Fetches an approved estimate from the DB (deployed schema), builds an
 * HTML email, and sends it to the customer via Resend.
 *
 * Expected POST body (from dashboard.html sendQuote()):
 * {
 *   estimate_id: string    — UUID of the estimate (primary key)
 *   approvedBy?: string    — name/email of the approving manager
 * }
 *
 * Required secrets:
 *   RESEND_API_KEY      — api.resend.com key
 *   QUOTE_FROM_EMAIL    — verified sender address
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

    const body = await req.json();
    const estimateId = body.estimate_id || body.jobId;
    const approvedBy = body.approvedBy || "Manager";

    if (!estimateId) {
      return new Response(
        JSON.stringify({ error: "estimate_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: estimate, error: fetchError } = await supabase
      .from("estimates")
      .select("*")
      .eq("id", estimateId)
      .single();

    if (fetchError || !estimate) {
      return new Response(
        JSON.stringify({ error: `Estimate not found: ${estimateId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!estimate.client_email) {
      return new Response(
        JSON.stringify({ error: "Estimate has no customer email — cannot send quote" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (estimate.status !== "approved" && estimate.status !== "scheduled") {
      return new Response(
        JSON.stringify({
          error: `Estimate status is "${estimate.status}". Must be "approved" or "scheduled" to send.`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Manager-approved range takes priority, fall back to AI's price range
    const quoteLow  = estimate.approved_quote_low  ?? estimate.price_range_low  ?? 0;
    const quoteHigh = estimate.approved_quote_high ?? estimate.price_range_high ?? 0;

    const services = Array.isArray(estimate.recommended_services)
      ? estimate.recommended_services
      : (estimate.recommended_services ? [estimate.recommended_services] : []);
    const service = services[0] ?? "tree service";

    const hazards = Array.isArray(estimate.hazard_flags)
      ? estimate.hazard_flags
      : (estimate.hazard_flags ? [estimate.hazard_flags] : []);

    // tree_species stored as "Common Name (Latin name)" — split for display.
    const speciesRaw = (estimate.tree_species || "").trim();
    const speciesMatch = speciesRaw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const commonName = speciesMatch ? speciesMatch[1].trim() : speciesRaw;
    const latinName  = speciesMatch ? speciesMatch[2].trim() : (estimate.scientific_name || "");

    const heightStr = estimate.estimated_height_ft ? `${estimate.estimated_height_ft} ft` : "";

    const escapeHtml = (s: string) =>
      String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const managerNotesHtml = estimate.manager_notes
      ? `<div style="background:#f0fdf4;border-left:4px solid #166534;padding:10px 14px;border-radius:4px;margin-top:8px;font-size:14px;color:#374151;">
          <strong>From our team:</strong> ${escapeHtml(estimate.manager_notes)}
         </div>`
      : "";

    const hazardsHtml = hazards.length
      ? `<tr>
          <td style="padding:10px;background:#fef9c3;border:1px solid #fde68a;font-size:13px;color:#6b7280;">Risk Flags</td>
          <td style="padding:10px;background:#fef9c3;border:1px solid #fde68a;font-size:14px;">${hazards.map((h: string) => escapeHtml(h)).join(", ")}</td>
        </tr>`
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

    <p style="font-size:16px;margin-top:0;">Hello${estimate.client_name ? " <strong>" + escapeHtml(estimate.client_name) + "</strong>" : ""},</p>
    <p style="color:#6b7280;font-size:14px;">Thank you for choosing ${escapeHtml(companyName)}. Here is your professional estimate based on our tree assessment.</p>

    ${estimate.client_address ? `
    <p style="background:#f0fdf4;padding:10px 14px;border-left:4px solid #166534;border-radius:4px;font-weight:600;font-size:14px;margin:0 0 16px;">
      📍 ${escapeHtml(estimate.client_address)}
    </p>` : ""}

    <h2 style="color:#166534;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">Service Estimate</h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="padding:10px;background:#f0fdf4;border:1px solid #d1fae5;font-size:13px;color:#6b7280;width:40%;">Service</td>
        <td style="padding:10px;background:#f0fdf4;border:1px solid #d1fae5;font-size:14px;font-weight:600;">${escapeHtml(service)}</td>
      </tr>
      <tr>
        <td style="padding:10px;background:#f8fafc;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Estimate Range</td>
        <td style="padding:10px;background:#f8fafc;border:1px solid #e5e7eb;font-size:18px;font-weight:700;color:#166534;">
          $${Number(quoteLow).toLocaleString()} – $${Number(quoteHigh).toLocaleString()}
        </td>
      </tr>
      ${commonName ? `<tr>
        <td style="padding:10px;background:#f0fdf4;border:1px solid #d1fae5;font-size:13px;color:#6b7280;">Tree Species</td>
        <td style="padding:10px;background:#f0fdf4;border:1px solid #d1fae5;font-size:14px;">${escapeHtml(commonName)}${latinName ? " <em style='color:#6b7280;font-size:12px;'>(" + escapeHtml(latinName) + ")</em>" : ""}</td>
      </tr>` : ""}
      ${estimate.health_summary ? `<tr>
        <td style="padding:10px;background:#f8fafc;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Condition</td>
        <td style="padding:10px;background:#f8fafc;border:1px solid #e5e7eb;font-size:14px;">${escapeHtml(estimate.health_summary)}</td>
      </tr>` : ""}
      ${heightStr ? `<tr>
        <td style="padding:10px;background:#f0fdf4;border:1px solid #d1fae5;font-size:13px;color:#6b7280;">Est. Height</td>
        <td style="padding:10px;background:#f0fdf4;border:1px solid #d1fae5;font-size:14px;">${escapeHtml(heightStr)}</td>
      </tr>` : ""}
      ${hazardsHtml}
    </table>

    ${estimate.scope_description ? `
    <h2 style="color:#166534;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">Scope</h2>
    <p style="font-size:14px;color:#374151;margin:8px 0 16px;">${escapeHtml(estimate.scope_description)}</p>
    ` : ""}

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
      Reference: ${String(estimate.id).substring(0, 8).toUpperCase()} · Approved by: ${escapeHtml(approvedBy)}
    </p>
  </div>
</body>
</html>`;

    const subjectAddress = estimate.client_address ? " at " + estimate.client_address : "";
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [estimate.client_email],
        subject: `Your Tree Service Estimate — ${service}${subjectAddress}`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      throw new Error(`Resend API error ${resendResponse.status}: ${errText}`);
    }

    const resendData = await resendResponse.json();

    // Don't mutate status — caller already moved it to approved/scheduled and
    // dashboard tracks delivery via quote_sent_at timestamp.
    await supabase
      .from("estimates")
      .update({
        quote_sent_at: new Date().toISOString(),
        quote_email_id: resendData.id ?? null,
        approved_by: approvedBy,
      })
      .eq("id", estimateId);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: resendData.id,
        sentTo: estimate.client_email,
        estimateId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-quote error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
