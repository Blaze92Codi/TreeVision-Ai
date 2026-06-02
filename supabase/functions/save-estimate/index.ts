import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * save-estimate Edge Function
 *
 * Receives the AI analysis result + customer contact details from index.html
 * and persists them to the estimates table.
 *
 * Expected POST body (from index.html saveEstimate()):
 * {
 *   analysis: { ... }           — full AI response object from callClaude()
 *   service: string             — selected service name e.g. "Trimming & Pruning"
 *   photo_url: string | null    — Supabase Storage URL of uploaded photo
 *   contact: {
 *     name: string
 *     phone: string
 *     email: string
 *     address: string
 *   }
 *   internal_notes: string      — estimator-only notes
 * }
 *
 * Returns: { id: string }       — UUID of the created/updated estimate
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { analysis, service, photo_url, contact, internal_notes } = body;

    if (!analysis) {
      return new Response(
        JSON.stringify({ error: "analysis is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const record = {
      // Status starts as pending — manager reviews in dashboard.html
      status: "pending",

      // Customer contact
      customer_name:  contact?.name    || null,
      customer_phone: contact?.phone   || null,
      customer_email: contact?.email   || null,
      job_address:    contact?.address || null,

      // AI analysis fields — mirror the JSON keys from callClaude() response
      species:                  analysis.common_name           || null,
      latin_name:               analysis.latin_name            || null,
      id_confidence:            analysis.id_confidence         || null,
      est_height:               analysis.est_height_ft         || null,
      est_dbh:                  analysis.est_dbh_in            || null,
      crown_spread:             analysis.crown_spread_ft       || null,
      condition:                analysis.condition             || null,
      isa_risk_rating:          analysis.isa_risk_rating       || null,
      recommended_service:      analysis.recommended_service   || service || null,
      recommended_pkg_key:      analysis.recommended_pkg_key   || null,
      ansi_standard:            analysis.ansi_standard         || null,
      after_description:        analysis.after_description     || null,
      live_crown_retained_pct:  analysis.live_crown_retained_pct ?? null,
      ai_notes:                 Array.isArray(analysis.notes) ? analysis.notes : [],
      annotations:              Array.isArray(analysis.annotations) ? analysis.annotations : [],
      cut_points:               Array.isArray(analysis.cut_points) ? analysis.cut_points : [],

      // Preliminary quote from AI
      quote_low:  typeof analysis.quote_low  === "number" ? analysis.quote_low  : null,
      quote_high: typeof analysis.quote_high === "number" ? analysis.quote_high : null,

      // Selected service (from package picker)
      selected_service: service || null,

      // Photo
      photo_url: photo_url || null,

      // Internal notes
      internal_notes: internal_notes || null,
    };

    const { data, error } = await supabase
      .from("estimates")
      .insert(record)
      .select("id")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("save-estimate error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
