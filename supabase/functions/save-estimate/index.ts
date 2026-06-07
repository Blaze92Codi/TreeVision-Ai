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
 * and persists them to the `estimates` table using the deployed schema:
 *   client_name, client_email, client_address, customer_phone,
 *   tree_species, scientific_name,
 *   estimated_height_ft, estimated_dbh_in, crown_diameter_ft,
 *   health_summary, health_score, hazard_flags[],
 *   recommended_services[], price_range_low, price_range_high,
 *   scope_description, photo_urls[], status
 *
 * Expected POST body (from index.html saveEstimate()):
 * {
 *   analysis: { ... }           — full AI response object from callClaude()
 *   service: string             — selected service name e.g. "Trimming & Pruning"
 *   photo_url: string | null    — Supabase Storage URL of uploaded photo
 *   contact: { name, phone, email, address }
 *   internal_notes: string      — estimator-only notes
 * }
 *
 * Returns: { id: string }       — UUID of the created estimate
 */

function parseLeadingInt(s: unknown): number | null {
  if (s == null) return null;
  const m = String(s).match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function conditionToScore(c: unknown): number | null {
  if (!c) return null;
  const map: Record<string, number> = {
    "Excellent": 10,
    "Good": 8,
    "Fair": 6,
    "Poor": 4,
    "Dead/Hazardous": 2,
  };
  return map[String(c)] ?? null;
}

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

    // Dashboard parses tree_species as "Common Name (Latin name)" — store both forms.
    const treeSpecies = analysis.common_name
      ? (analysis.latin_name
          ? `${analysis.common_name} (${analysis.latin_name})`
          : analysis.common_name)
      : null;

    const recommendedService = analysis.recommended_service || service || null;

    const record = {
      status: "draft",

      // Customer contact
      client_name:    contact?.name    || null,
      client_email:   contact?.email   || null,
      client_address: contact?.address || null,
      client_phone:   contact?.phone   || null,
      customer_phone: contact?.phone   || null,

      // Tree identification (deployed schema has both formatted + separated)
      tree_species: treeSpecies,
      common_name:  analysis.common_name || null,
      latin_name:   analysis.latin_name  || null,
      id_confidence: analysis.id_confidence || null,
      id_notes:      analysis.id_notes      || null,
      is_tree:       analysis.is_tree === false ? false : true,

      // Measurements — keep both the integer columns (dashboard reads these)
      // and the original text ranges (annotation renderer / customer view).
      estimated_height_ft: parseLeadingInt(analysis.est_height_ft),
      crown_diameter_ft:   parseLeadingInt(analysis.crown_spread_ft),
      est_height_ft:       analysis.est_height_ft   || null,
      est_dbh_in:          analysis.est_dbh_in      || null,
      crown_spread_ft:     analysis.crown_spread_ft || null,

      // Health & risk
      health_summary:  analysis.condition || null,
      health_score:    conditionToScore(analysis.condition),
      condition:       analysis.condition       || null,
      hazard_flags:    analysis.isa_risk_rating ? [analysis.isa_risk_rating] : [],
      isa_risk_rating: analysis.isa_risk_rating || null,

      // Service recommendation
      recommended_services: recommendedService ? [recommendedService] : [],
      recommended_service:  recommendedService || null,
      recommended_pkg_key:  analysis.recommended_pkg_key || null,

      // Quote range
      price_range_low:  typeof analysis.quote_low  === "number" ? analysis.quote_low  : null,
      price_range_high: typeof analysis.quote_high === "number" ? analysis.quote_high : null,
      quote_low:        analysis.quote_low  != null ? String(analysis.quote_low)  : null,
      quote_high:       analysis.quote_high != null ? String(analysis.quote_high) : null,

      // Rich AI outputs used by the dashboard's annotated-photo viewer and
      // the customer-facing After-service description. Stored as jsonb /
      // text so the original shape is preserved.
      annotations:             Array.isArray(analysis.annotations) ? analysis.annotations : null,
      cut_points:              Array.isArray(analysis.cut_points)  ? analysis.cut_points  : null,
      after_description:       analysis.after_description || null,
      live_crown_retained_pct: typeof analysis.live_crown_retained_pct === "number"
                                 ? analysis.live_crown_retained_pct : null,
      ansi_standard:           analysis.ansi_standard || null,
      standard_note:           analysis.standard_note || null,
      ai_notes:                Array.isArray(analysis.notes) ? analysis.notes.join("\n")
                                 : (analysis.notes || null),

      // Photo (array column even with a single URL)
      photo_urls: photo_url ? [photo_url] : [],
      photo_url:  photo_url || null,

      // Estimator notes
      scope_description: internal_notes || null,
      internal_notes:    internal_notes || null,
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
      JSON.stringify({ error: (err as Error).message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
