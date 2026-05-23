
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function jsonResponse(res, status, body) {
  cors(res);
  res.status(status).json(body);
}

function safeJsonParse(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
  }
  return null;
}

function clampLabel(label) {
  const n = (v, fallback) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return fallback;
    return Math.max(0, Math.min(100, x));
  };

  return {
    code: String(label.code || "E").slice(0, 1).toUpperCase(),
    title: String(label.title || "Review area").slice(0, 80),
    description: String(label.description || "").slice(0, 220),
    x: n(label.x, 50),
    y: n(label.y, 50),
    w: n(label.w, 18),
    h: n(label.h, 12)
  };
}

function buildFormattedText(result, annotatedImageUrl) {
  const risks = Array.isArray(result.risk_flags) && result.risk_flags.length
    ? result.risk_flags.join(", ")
    : "None clearly visible from the photo.";

  const labelText = (result.labels || [])
    .map(l => `${l.code} = ${l.title}:\n${l.description || "No additional detail provided."}`)
    .join("\n\n");

  return `TREEVISION PRELIMINARY PHOTO ANNOTATION

Service Type:
${result.service_type || "Photo-based tree-service review"}

Visible Complexity:
${result.complexity || "Needs review"}

A-E Annotation Map:
${labelText || "A-E map could not be generated from the available photo."}

Visible Risk Flags:
${risks}

Preliminary Scope:
${result.preliminary_scope || "Preliminary scope should be confirmed by Dynamic Tree Service."}

Next Best Step:
${result.next_best_step || "Confirm service requested, haul-away preference, location/ZIP, timeline, and any nearby wires or structures."}

Scheduling Readiness:
${result.scheduling_readiness || "Needs review"}

Annotated Concept Link:
${annotatedImageUrl}

Safety Note:
This is a preliminary photo-based scope only. Final pricing and work approval should be confirmed by Dynamic Tree Service.`;
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return jsonResponse(res, 405, { error: "Use POST /api/annotate" });
  }

  try {
    const {
      image_url,
      customer_request = "",
      zip_code = "",
      service_type = ""
    } = req.body || {};

    if (!image_url || typeof image_url !== "string" || !image_url.startsWith("http")) {
      return jsonResponse(res, 400, {
        error: "Missing valid image_url. The image must be a public https URL."
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return jsonResponse(res, 500, {
        error: "OPENAI_API_KEY is not configured in Vercel environment variables."
      });
    }

    const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

    const prompt = `
You are TreeVision AI, a preliminary tree-service photo assessment assistant for Dynamic Tree Service.

Analyze the uploaded tree-service photo and customer request. Return JSON only.

Important safety rules:
- This is preliminary photo-based intake only.
- Do not guarantee final pricing or tree safety.
- Do not provide chainsaw, climbing, rigging, crane, bucket truck, or powerline instructions.
- Recommend onsite review when power lines, large removals, severe lean, storm damage, structure risk, hanging limbs, limited access, or unclear photo quality are present.

Customer request: ${customer_request || "No written request provided."}
ZIP/location: ${zip_code || "Not provided"}
Requested service type: ${service_type || "Not provided"}

Return exactly this JSON shape:
{
  "service_type": "light trim | shape-up | canopy raise | clearance trim | deadwood removal | hazard limb removal | storm cleanup | removal | stump grinding | haul-away | onsite review required",
  "complexity": "Simple | Moderate | Complex | High-Risk",
  "risk_flags": ["short risk flag strings"],
  "labels": [
    {
      "code": "A",
      "title": "Trim / shape area",
      "description": "specific visible area or if not visible, say not clearly visible",
      "x": 50,
      "y": 35,
      "w": 20,
      "h": 12
    },
    {
      "code": "B",
      "title": "Canopy raise / clearance area",
      "description": "specific visible area or not applicable",
      "x": 50,
      "y": 65,
      "w": 20,
      "h": 12
    },
    {
      "code": "C",
      "title": "Deadwood or hazard limb",
      "description": "specific visible concern or none clearly visible",
      "x": 65,
      "y": 40,
      "w": 18,
      "h": 12
    },
    {
      "code": "D",
      "title": "Brush / haul-away zone",
      "description": "cleanup area or haul-away note",
      "x": 50,
      "y": 85,
      "w": 25,
      "h": 10
    },
    {
      "code": "E",
      "title": "Onsite review concern",
      "description": "wires, structures, lean, access, photo quality, or none clearly visible",
      "x": 80,
      "y": 20,
      "w": 18,
      "h": 12
    }
  ],
  "preliminary_scope": "short professional scope summary",
  "next_best_step": "ask for only 1-3 missing photos/details",
  "scheduling_readiness": "Ready for preliminary review | Needs more photos | Onsite review recommended",
  "onsite_review_required": true
}

Coordinate rules:
- x, y, w, h are approximate percentages from 0 to 100.
- Put labels near visible areas if possible.
- If the exact area is unclear, place label near the general tree zone and explain uncertainty.
`.trim();

    const ai = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url }
          ]
        }
      ]
    });

    const parsed = safeJsonParse(ai.output_text);

    if (!parsed) {
      return jsonResponse(res, 502, {
        error: "Vision model did not return valid JSON.",
        raw: ai.output_text
      });
    }

    const labels = Array.isArray(parsed.labels) ? parsed.labels.map(clampLabel) : [];
    const result = { ...parsed, labels };

    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = process.env.PUBLIC_BASE_URL || `${proto}://${host}`;

    const renderPayload = Buffer.from(
      JSON.stringify({ imageUrl: image_url, labels }),
      "utf8"
    ).toString("base64url");

    const annotatedImageUrl = `${baseUrl}/api/render?d=${renderPayload}`;
    const formattedText = buildFormattedText(result, annotatedImageUrl);

    return jsonResponse(res, 200, {
      ok: true,
      annotated_image_url: annotatedImageUrl,
      formatted_text: formattedText,
      service_type: result.service_type,
      complexity: result.complexity,
      risk_flags: result.risk_flags || [],
      labels,
      preliminary_scope: result.preliminary_scope,
      next_best_step: result.next_best_step,
      scheduling_readiness: result.scheduling_readiness,
      onsite_review_required: Boolean(result.onsite_review_required)
    });
  } catch (error) {
    return jsonResponse(res, 500, {
      error: "TreeVision annotation failed.",
      detail: error?.message || String(error)
    });
  }
}
