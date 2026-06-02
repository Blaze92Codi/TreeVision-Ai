import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzePayload {
  imageBase64: string;
  mimeType?: string;
  treeType?: string;
  desiredWork?: string;
}

interface PhotoScore {
  score: number;
  passesThreshold: boolean;
  weaknesses: string[];
  strengths: string[];
}

interface AnalyzeResult {
  photoScore: PhotoScore;
  servicePreset: string;
  observedCondition: string;
  primaryRiskTarget: string;
  estimatedSizeClass: string;
  estimatedHeightFt: number | null;
  estimatedDBH: number | null;
  siteTriggers: string[];
  scopeSummary: string;
  requiredAdditionalPhotos: string[];
  crewNotes: string;
  rawModelResponse: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OPENAI_API_KEY environment variable not set");

    const payload: AnalyzePayload = await req.json();

    if (!payload.imageBase64) {
      return new Response(
        JSON.stringify({ error: "imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mimeType = payload.mimeType ?? "image/jpeg";
    const dataUri = payload.imageBase64.startsWith("data:")
      ? payload.imageBase64
      : `data:${mimeType};base64,${payload.imageBase64}`;

    const systemPrompt = `You are an expert arborist and tree service estimator with 20+ years of field experience.
You analyze tree and landscape photos to produce preliminary scoping data for cost-plus estimates.
You never fabricate unsafe assumptions. When a photo is insufficient, you say so clearly.
Always respond with valid JSON matching the schema exactly — no markdown, no prose outside JSON.`;

    const userPrompt = `Analyze this tree/landscape photo for a preliminary trim estimate.
${payload.treeType ? `Tree/plant type hint: ${payload.treeType}` : ""}
${payload.desiredWork ? `Customer's desired work: ${payload.desiredWork}` : ""}

Return a JSON object with EXACTLY these fields:
{
  "photoScore": {
    "score": <integer 0-100>,
    "passesThreshold": <boolean, true if score >= 60>,
    "strengths": [<strings describing what the photo does well>],
    "weaknesses": [<strings describing what is missing or unclear>]
  },
  "servicePreset": <one of: "canopy_trim", "crown_reduction", "deadwood_removal", "hedge_shaping", "stump_removal", "hazard_removal", "full_removal", "structural_prune", "clearance_prune", "mixed">,
  "observedCondition": <one of: "good", "fair", "poor", "critical">,
  "primaryRiskTarget": <string, e.g. "structure", "power line", "pedestrian zone", "none visible">,
  "estimatedSizeClass": <one of: "small", "medium", "large", "extra-large">,
  "estimatedHeightFt": <integer or null if not determinable>,
  "estimatedDBH": <integer inches or null if not determinable>,
  "siteTriggers": [<strings, safety/site-visit flags e.g. "utility lines within 10ft", "lean toward structure", "root zone concern">],
  "scopeSummary": <string, 2-3 sentence plain-English preliminary scope>,
  "requiredAdditionalPhotos": [<strings describing shots needed for a responsible final quote>],
  "crewNotes": <string, internal notes for crew — access, hazards, equipment suggestions>
}`;

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1200,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: dataUri, detail: "high" } },
            ],
          },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text();
      throw new Error(`OpenAI API error ${openAiResponse.status}: ${errText}`);
    }

    const openAiData = await openAiResponse.json();
    const rawContent: string = openAiData.choices?.[0]?.message?.content ?? "";

    let parsed: Omit<AnalyzeResult, "rawModelResponse">;
    try {
      const cleaned = rawContent.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`Model returned non-JSON response: ${rawContent.slice(0, 300)}`);
    }

    const result: AnalyzeResult = { ...parsed, rawModelResponse: rawContent };

    return new Response(
      JSON.stringify({ success: true, analysis: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("analyze error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
