import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TreeAnnotation {
  treeId: string;
  dbh: number;
  estimatedHeightFt: number;
  sizeClass: "small" | "medium" | "large" | "extra-large";
  condition: "good" | "fair" | "poor" | "critical";
  primaryRiskTarget: string;
  equipmentMethod: string;
  utilityCheck: boolean;
  cleanupLevel: string;
  priority: "low" | "medium" | "high" | "urgent";
  doneMeans: string;
  requiredPhotos: string[];
}

interface EstimatePayload {
  jobId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  serviceAddress: string;
  desiredWork: string;
  cleanupRequest: string;
  accessOrSafetyConcerns?: string;
  photoScore: number;
  photoUrl?: string;
  servicePreset: string;
  siteTriggers: string[];
  trees: TreeAnnotation[];
  estimateLow: number;
  estimateHigh: number;
  crewProfile: string;
  stopWorkTriggers: string[];
  approvedPruningLanguage: string;
  forbiddenPruningLanguage: string;
  status: "draft" | "pending_approval" | "approved" | "sent" | "rejected";
  internalNotes?: string;
  customerMessage?: string;
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

    const payload: EstimatePayload = await req.json();

    const required: (keyof EstimatePayload)[] = [
      "customerName",
      "customerEmail",
      "serviceAddress",
      "desiredWork",
      "cleanupRequest",
      "trees",
      "estimateLow",
      "estimateHigh",
      "status",
    ];
    for (const field of required) {
      if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (payload.estimateLow > payload.estimateHigh) {
      return new Response(
        JSON.stringify({ error: "estimateLow must be <= estimateHigh" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(payload.trees) || payload.trees.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one tree annotation is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const record = {
      job_id: payload.jobId ?? crypto.randomUUID(),
      customer_name: payload.customerName,
      customer_email: payload.customerEmail,
      customer_phone: payload.customerPhone ?? null,
      service_address: payload.serviceAddress,
      desired_work: payload.desiredWork,
      cleanup_request: payload.cleanupRequest,
      access_safety_concerns: payload.accessOrSafetyConcerns ?? null,
      photo_score: payload.photoScore,
      photo_url: payload.photoUrl ?? null,
      service_preset: payload.servicePreset,
      site_triggers: payload.siteTriggers,
      trees: payload.trees,
      estimate_low: payload.estimateLow,
      estimate_high: payload.estimateHigh,
      crew_profile: payload.crewProfile,
      stop_work_triggers: payload.stopWorkTriggers,
      approved_pruning_language: payload.approvedPruningLanguage,
      forbidden_pruning_language: payload.forbiddenPruningLanguage,
      status: payload.status,
      internal_notes: payload.internalNotes ?? null,
      customer_message: payload.customerMessage ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("estimates")
      .upsert(record, { onConflict: "job_id" })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, estimate: data }),
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
