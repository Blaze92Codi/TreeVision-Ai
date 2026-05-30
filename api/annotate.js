export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        message: "TreeVision annotate API is live. Use POST with image_url and customer_request."
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed. Use POST."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_VISION_MODEL || "gpt-4o";
    const publicBaseUrl = process.env.PUBLIC_BASE_URL || "https://tree-vision-ai.vercel.app";

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY is missing in Vercel environment variables."
      });
    }

    const {
      image_url,
      customer_request = "No written request provided.",
      zip_code = "",
      service_type = ""
    } = req.body || {};

    if (!image_url) {
      return res.status(400).json({
        ok: false,
        error: "Missing image_url. Send a POST body with image_url."
      });
    }

    const prompt = `
You are TreeVision AI, a tree-service photo assessment assistant.

Create a preliminary photo-based A-E annotation map for a tree-service estimate.

Customer request:
${customer_request}

ZIP code:
${zip_code || "Not provided"}

Requested service type:
${service_type || "Not provided"}

Rules:
- Do not claim this is a final arborist inspection.
- Do not provide chainsaw, climbing, rigging, crane, bucket truck, or powerline work instructions.
- Use preliminary estimate language only.
- Flag onsite review if wires, structures, severe lean, storm damage, poor access, or large removal risk is visible or described.

Return this exact structure:

TREEVISION PRELIMINARY PHOTO ANNOTATION

Service Type:
[service type]

Visible Complexity:
[Simple / Moderate / Complex / High-Risk]

A-E Annotation Map:
A = Trim / shape area:
[description]

B = Canopy raise / clearance area:
[description]

C = Deadwood / hazard limb:
[description]

D = Brush / haul-away zone:
[description]

E = Onsite review concern:
[description]

Preliminary Scope:
[short scope]

Next Best Step:
[1-3 missing photos/details]

Scheduling Readiness:
[Ready for preliminary review / Needs more photos / Onsite review recommended]

Safety Note:
This is a preliminary photo-based scope only. Final pricing and work approval should be confirmed by Dynamic Tree Service.
`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: { url: image_url }
              }
            ]
          }
        ],
        max_tokens: 900
      })
    });

    const raw = await openaiResponse.text();

    if (!openaiResponse.ok) {
      return res.status(500).json({
        ok: false,
        error: "OpenAI request failed.",
        details: raw
      });
    }

    const data = JSON.parse(raw);
    let formattedText = data?.choices?.[0]?.message?.content || "";

    if (!formattedText) {
      formattedText = "TreeVision analysis completed, but no text output was returned.";
    }

    const annotatedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <rect width="1200" height="800" fill="#f4f4f4"/>
  <image href="${image_url}" x="0" y="0" width="1200" height="800" preserveAspectRatio="xMidYMid meet"/>
  <rect x="30" y="30" width="420" height="250" fill="white" opacity="0.92" rx="18"/>
  <text x="55" y="75" font-size="34" font-family="Arial" font-weight="bold" fill="#123">
    TreeVision A-E Markup
  </text>
  <text x="55" y="120" font-size="24" font-family="Arial" fill="#123">A = Trim / shape area</text>
  <text x="55" y="155" font-size="24" font-family="Arial" fill="#123">B = Canopy raise / clearance</text>
  <text x="55" y="190" font-size="24" font-family="Arial" fill="#123">C = Deadwood / hazard limb</text>
  <text x="55" y="225" font-size="24" font-family="Arial" fill="#123">D = Brush / haul-away zone</text>
  <text x="55" y="260" font-size="24" font-family="Arial" fill="#123">E = Onsite review concern</text>
</svg>`;

    const encodedSvg = Buffer.from(annotatedSvg).toString("base64");
    const annotatedImageUrl = `data:image/svg+xml;base64,${encodedSvg}`;

    return res.status(200).json({
      ok: true,
      formatted_text: formattedText,
      annotated_image_url: annotatedImageUrl,
      public_base_url: publicBaseUrl
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
}
