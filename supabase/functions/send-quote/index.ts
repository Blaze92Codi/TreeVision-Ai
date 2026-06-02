import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendQuotePayload {
  jobId: string;
  approvedBy: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY environment variable not set");

    const fromAddress = Deno.env.get("QUOTE_FROM_EMAIL") ?? "quotes@treevision.app";
    const companyName = Deno.env.get("COMPANY_NAME") ?? "TreeVision";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: SendQuotePayload = await req.json();

    if (!payload.jobId) {
      return new Response(
        JSON.stringify({ error: "jobId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload.approvedBy) {
      return new Response(
        JSON.stringify({ error: "approvedBy is required — a human must authorize sending" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: estimate, error: fetchError } = await supabase
      .from("estimates")
      .select("*")
      .eq("job_id", payload.jobId)
      .single();

    if (fetchError || !estimate) {
      return new Response(
        JSON.stringify({ error: `Estimate not found for jobId: ${payload.jobId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (estimate.status !== "approved") {
      return new Response(
        JSON.stringify({
          error: `Estimate status is "${estimate.status}". Only "approved" estimates can be sent.`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const treeSummaryRows = (estimate.trees as any[])
      .map((t: any, i: number) =>
        `<tr style="background:${i % 2 === 0 ? "#f9fafb" : "#ffffff"}">
          <td style="padding:8px 12px;border:1px solid #e5e7eb">${t.treeId ?? `Tree ${i + 1}`}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb">${t.sizeClass ?? "—"}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb">${t.condition ?? "—"}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb">${t.priority ?? "—"}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb">${t.doneMeans ?? "—"}</td>
        </tr>`
      )
      .join("");

    const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Preliminary Tree Trim Estimate</title></head>
<body style="font-family:Arial,sans-serif;color:#111827;max-width:680px;margin:0 auto;padding:24px">
  <div style="background:#166534;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="color:#ffffff;margin:0;font-size:22px">${companyName}</h1>
    <p style="color:#bbf7d0;margin:4px 0 0;font-size:14px">Preliminary Canopy Trim Estimate</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <p style="font-size:16px">Hello <strong>${estimate.customer_name}</strong>,</p>
    <p>Thank you for your inquiry. Below is your <strong>preliminary estimate</strong> for tree work at:</p>
    <p style="background:#f0fdf4;padding:10px 14px;border-left:4px solid #166534;border-radius:4px;font-weight:bold">
      ${estimate.service_address}
    </p>
    <h2 style="color:#166534;font-size:16px;margin-top:28px">Work Requested</h2>
    <p>${estimate.desired_work}</p>
    <p><strong>Cleanup:</strong> ${estimate.cleanup_request}</p>
    ${estimate.access_safety_concerns ? `<p><strong>Access / Safety Notes:</strong> ${estimate.access_safety_concerns}</p>` : ""}
    <h2 style="color:#166534;font-size:16px;margin-top:28px">Estimate Range</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <tr>
        <td style="padding:12px 16px;background:#f0fdf4;border:1px solid #d1fae5;font-size:22px;font-weight:bold;text-align:center;width:50%">
          Low: $${estimate.estimate_low.toLocaleString()}
        </td>
        <td style="padding:12px 16px;background:#f0fdf4;border:1px solid #d1fae5;font-size:22px;font-weight:bold;text-align:center;width:50%">
          High: $${estimate.estimate_high.toLocaleString()}
        </td>
      </tr>
    </table>
    <p style="font-size:12px;color:#6b7280">
      This is a <strong>preliminary range only</strong>, based on a single-photo intake.
      Final price, scope, and work method require an on-site visit and authorized human approval.
    </p>
    <h2 style="color:#166534;font-size:16px;margin-top:28px">Scope Summary</h2>
    <p>${estimate.customer_message ?? "Please contact us to discuss your full scope."}</p>
    <h2 style="color:#166534;font-size:16px;margin-top:28px">Tree / Item Breakdown</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead>
        <tr style="background:#166534;color:#ffffff">
          <th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb">ID</th>
          <th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb">Size</th>
          <th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb">Condition</th>
          <th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb">Priority</th>
          <th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb">"Done Means"</th>
        </tr>
      </thead>
      <tbody>${treeSummaryRows}</tbody>
    </table>
    ${
      estimate.site_triggers?.length
        ? `<h2 style="color:#b45309;font-size:16px;margin-top:28px">&#9888; Safety / Site-Visit Flags</h2>
           <ul>${(estimate.site_triggers as string[]).map((t) => `<li>${t}</li>`).join("")}</ul>`
        : ""
    }
    <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:14px 16px;margin-top:28px">
      <strong>Important Disclaimer</strong><br>
      This estimate is preliminary and does not constitute a final quote, arborist inspection,
      utility clearance, or insurance decision. Final scope, price, and work method require
      authorized human approval before any work begins.
    </div>
    <p style="margin-top:28px">We'll be in touch shortly to schedule a site visit and finalize your quote.</p>
    <p>Best regards,<br><strong>${companyName} Team</strong></p>
    <p style="font-size:11px;color:#9ca3af;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:12px">
      Estimate reference: ${estimate.job_id} &nbsp;|&nbsp; Approved by: ${payload.approvedBy}
    </p>
  </div>
</body>
</html>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [estimate.customer_email],
        subject: `Your Preliminary Tree Trim Estimate — ${estimate.service_address}`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      throw new Error(`Resend API error ${resendResponse.status}: ${errText}`);
    }

    const resendData = await resendResponse.json();

    const { error: updateError } = await supabase
      .from("estimates")
      .update({
        status: "sent",
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", payload.jobId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        emailId: resendData.id,
        sentTo: estimate.customer_email,
        jobId: payload.jobId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-quote error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
