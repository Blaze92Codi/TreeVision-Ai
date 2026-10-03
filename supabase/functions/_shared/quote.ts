/** Support both current intake records and retained legacy deployments. */
export function quoteDetails(estimate: Record<string, any>) {
  const legacyServices = Array.isArray(estimate.recommended_services)
    ? estimate.recommended_services : [estimate.recommended_services];
  const service = estimate.selected_service || estimate.recommended_service || legacyServices[0] || "tree service";
  const hazards = Array.isArray(estimate.hazard_flags) ? estimate.hazard_flags
    : estimate.hazard_flags ? [estimate.hazard_flags]
    : estimate.isa_risk_rating ? [estimate.isa_risk_rating] : [];
  const raw = String(estimate.species || estimate.tree_species || estimate.common_name || "").trim();
  const match = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return {
    service, hazards, commonName: match ? match[1].trim() : raw,
    latinName: estimate.latin_name || (match ? match[2].trim() : ""),
    condition: estimate.condition || estimate.health_summary || "",
    heightStr: estimate.est_height || (estimate.estimated_height_ft ? `${estimate.estimated_height_ft} ft` : ""),
  };
}

/** Retry the same payload until delivery is recorded; then permit a new send.
 * Payload changes also create a distinct key, avoiding conflicts on adjusted quotes.
 * https://resend.com/changelog/idempotency-keys
 */
export async function quoteDeliveryKey(estimate: Record<string, any>, emailPayload: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify([estimate.quote_sent_at || null, emailPayload]));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hash = Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
  return `quote-${estimate.id}-${hash}`;
}
