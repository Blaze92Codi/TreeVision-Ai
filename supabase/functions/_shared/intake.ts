import { text, image, RequestError } from "./security.ts";

/** Only preliminary intake fields are accepted; approval fields are server/staff-owned. */
export function submissionRecord(body: Record<string, any>) {
    const a = body.analysis;
    if (!a || Array.isArray(a) || typeof a !== "object" || JSON.stringify(a).length > 50000)
      throw new RequestError(400, "Invalid analysis");
    const contact = body.contact;
    if (!contact || typeof contact !== "object") throw new RequestError(400, "Contact required");
    const record: Record<string, unknown> = {
      status: "pending", customer_name: text(contact.name, 200, true),
      customer_email: text(contact.email, 254), customer_phone: text(contact.phone, 40),
      job_address: text(contact.address, 500), selected_service: text(body.service, 200),
      // Client data is preliminary; never allow client-supplied approval/audit fields.
      internal_notes: text(body.internal_notes, 4000), species: text(a.common_name, 200),
      latin_name: text(a.latin_name, 200), condition: text(a.condition, 100),
      isa_risk_rating: text(a.isa_risk_rating, 100),
      est_height: text(a.est_height_ft, 100), est_dbh: text(a.est_dbh_in, 100),
      crown_spread: text(a.crown_spread_ft, 100), recommended_service: text(a.recommended_service, 200),
      recommended_pkg_key: text(a.recommended_pkg_key, 40), after_description: text(a.after_description, 4000),
      ansi_standard: text(a.ansi_standard, 500),
    };
    if (record.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(record.customer_email)))
      throw new RequestError(400, "Invalid email");
    for (const field of ["quote_low", "quote_high"]) {
      const value = a[field];
      if (value != null && (!Number.isSafeInteger(value) || value < 0 || value > 1000000))
        throw new RequestError(400, "Invalid quote range");
      record[field] = value ?? null;
    }
    if (record.quote_low != null && record.quote_high != null && Number(record.quote_high) < Number(record.quote_low))
      throw new RequestError(400, "Invalid quote range");
    for (const field of ["annotations", "cut_points"]) {
      if (a[field] != null && (!Array.isArray(a[field]) || a[field].length > 100))
        throw new RequestError(400, "Invalid annotations");
      record[field] = a[field] ?? [];
    }
    if (a.notes != null && (!Array.isArray(a.notes) || a.notes.length > 50)) throw new RequestError(400, "Invalid notes");
    record.ai_notes = (a.notes ?? []).map((n: unknown) => text(n, 1000, true));
    const photo = image(body.photo);
    return { record, photo };

}
