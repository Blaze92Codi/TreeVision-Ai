import type { Analysis } from "./types";

const PROMPT = `You are a professional ISA Certified Arborist producing a visual "scope of work" assessment from a single photo, in line with ANSI A300 standards, ISA Best Management Practices, and TCIA safety practices. This is a preliminary visual estimate, NOT a certified arborist report.

Analyze this photo and return ONLY a valid JSON object (no markdown, no backticks, no preamble):
{
  "is_tree": true,
  "photo_quality": "one of: Poor | Usable | Good",
  "common_name": "string — common name e.g. White Oak (prefix with 'Possible ' if uncertain)",
  "latin_name": "string — binomial e.g. Quercus alba",
  "est_height_ft": "string range e.g. 45-55 ft",
  "est_dbh_in": "string — diameter at breast height e.g. 18-22 in",
  "crown_spread_ft": "string e.g. 30-40 ft",
  "size_class": "one of: Small | Medium | Medium to Large | Large",
  "condition": "one of: Excellent | Good | Fair | Poor | Dead/Hazardous",
  "confidence": "one of: Low | Medium | High — your confidence in this assessment given photo quality/angle",
  "isa_risk_rating": "one of: Low | Moderate | High | Extreme",
  "recommended_service": "one of: Trimming & Pruning | Full Removal | Stump Grinding | Health & Treatment",
  "recommended_pkg_key": "one of: trim | removal | stump | treatment",
  "ansi_standard": "relevant ANSI A300 part e.g. ANSI A300 Part 1 — Pruning",
  "site_assessment": "2-3 sentences: tree type, canopy density, primary needs, what to avoid (e.g. topping)",
  "hazard_review": "1-2 sentences on visible structural defects, or note they can't be confirmed from photo",
  "scope_summary": ["4-6 short scope-of-work bullets, e.g. 'Selective pruning and canopy shape-up'"],
  "notes": ["3-5 short professional arborist observations"],
  "standard_note": "1-2 sentences on the applicable arboricultural standard for this tree",
  "annotations": [
    {
      "type": "one of: trim | clearance | deadwood | cleanup | review",
      "label": "short phrase e.g. 'Selective shape-up of outer canopy'",
      "bbox": [x, y, w, h]
    }
  ]
}

The annotations drive a lettered A–E overlay the customer sees on their photo. They are REQUIRED:
- Return between 3 and 6 annotations for any photo containing a tree. Only return an empty array if there is genuinely no tree.
- Every annotation MUST include "type", "label", and "bbox". Never omit "bbox".
- The five types map to fixed categories the customer sees as letters:
    "trim"      (Ⓐ Trim / Shape Area)        — outer canopy edges to shape/balance
    "clearance" (Ⓑ Clearance Area)           — raise/clear canopy over lawn, driveway, walkways, utilities
    "deadwood"  (Ⓒ Deadwood / Hazard Limb)   — dead/dying limbs, decay, codominant union, lean
    "cleanup"   (Ⓓ Cleanup / Haul-Away Zone) — ground area for debris/limb/leaf cleanup (put near base)
    "review"    (Ⓔ Review Concern)           — dense canopy / limited visibility / roadside exposure needing on-site review
- Include at least one "trim" or "clearance" and one "cleanup". Add "deadwood" and "review" where the photo warrants.
- "bbox" is EXACTLY [x, y, w, h] as FRACTIONS 0.0–1.0 (x,y = top-left corner). Example: outer canopy upper-right = [0.6, 0.15, 0.3, 0.25].
- Spread boxes across the real features; each should frame the thing it describes (a canopy region, a limb, the ground cleanup zone, the trunk).
- Keep labels under 50 characters, specific and customer-readable.
- If there is genuinely NO tree, set is_tree to false and annotations to [].`;

export async function analyzeTreePhoto(
  apiKey: string,
  base64: string,
  mediaType: string,
): Promise<Analysis> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 30_000);

  // Single retry on 5xx / overload (529)
  const attempt = async () => fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    signal: ctrl.signal,
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: PROMPT },
        ],
      }],
    }),
  });

  let response: Response;
  try {
    response = await attempt();
    if (!response.ok && (response.status === 529 || response.status >= 500)) {
      await new Promise(r => setTimeout(r, 1500));
      response = await attempt();
    }
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errData: any = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Anthropic API error ${response.status}`);
  }

  const data: any = await response.json();
  const text: string = data.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
  const clean = text.replace(/```json|```/g, "").trim();

  let parsed: Analysis;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error("Could not parse AI response. Please try a clearer photo.");
  }

  if (!parsed.is_tree) {
    throw new Error("No tree detected. Please upload a photo showing a clear view of a tree.");
  }
  return parsed;
}
