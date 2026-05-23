
function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodePayload(d) {
  try {
    const json = Buffer.from(String(d || ""), "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function clamp(n, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, v));
}

export default function handler(req, res) {
  const payload = decodePayload(req.query.d);

  if (!payload?.imageUrl) {
    res.status(400).send("Missing render payload");
    return;
  }

  const imageUrl = escapeXml(payload.imageUrl);
  const labels = Array.isArray(payload.labels) ? payload.labels : [];

  const labelSvg = labels.map((raw, index) => {
    const code = escapeXml(raw.code || String.fromCharCode(65 + index));
    const title = escapeXml(raw.title || "Review area");
    const desc = escapeXml(raw.description || "");
    const x = clamp(raw.x, 50);
    const y = clamp(raw.y, 50);
    const w = clamp(raw.w, 18);
    const h = clamp(raw.h, 12);
    const tx = Math.min(92, x + w / 2 + 2);
    const ty = Math.max(8, y - h / 2);

    return `
      <rect x="${x - w/2}" y="${y - h/2}" width="${w}" height="${h}" rx="1.5"
        fill="none" stroke="#ffcc00" stroke-width="0.9" stroke-dasharray="1.4 1.1"/>
      <circle cx="${x}" cy="${y}" r="2.7" fill="#ffcc00" stroke="#111" stroke-width="0.5"/>
      <text x="${x}" y="${y + 1.1}" text-anchor="middle" font-size="3.4" font-family="Arial, sans-serif"
        font-weight="700" fill="#111">${code}</text>
      <line x1="${x + 2.8}" y1="${y}" x2="${tx - 1}" y2="${ty}" stroke="#ffcc00" stroke-width="0.7"/>
      <rect x="${tx}" y="${ty - 4.2}" width="34" height="8.8" rx="1.2"
        fill="rgba(0,0,0,0.72)" stroke="#ffcc00" stroke-width="0.35"/>
      <text x="${tx + 1.4}" y="${ty - 1.2}" font-size="2.4" font-family="Arial, sans-serif"
        font-weight="700" fill="#fff">${code}: ${title.slice(0, 28)}</text>
      <text x="${tx + 1.4}" y="${ty + 2.2}" font-size="1.8" font-family="Arial, sans-serif"
        fill="#fff">${desc.slice(0, 38)}</text>
    `;
  }).join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1200" height="1200">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0.5" dy="0.8" stdDeviation="0.5" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <image href="${imageUrl}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="100" height="100" fill="none" stroke="#ffcc00" stroke-width="0.6"/>
  <g filter="url(#shadow)">
    ${labelSvg}
  </g>
  <rect x="2" y="2" width="44" height="7" rx="1.5" fill="rgba(0,0,0,0.72)" stroke="#ffcc00" stroke-width="0.35"/>
  <text x="4" y="6.6" font-size="3.4" font-family="Arial, sans-serif" font-weight="700" fill="#fff">
    TreeVision Preliminary Markup
  </text>
  <text x="4" y="96" font-size="2.2" font-family="Arial, sans-serif" fill="#fff"
    stroke="#000" stroke-width="0.15" paint-order="stroke">
    Preliminary concept only. Final scope/pricing requires Dynamic Tree Service review.
  </text>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(svg);
}
