export type Bindings = {
  DB: D1Database;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;

  // Secrets
  ANTHROPIC_API_KEY: string;
  TURNSTILE_SECRET?: string;
  CALENDLY_WEBHOOK_SIGNING_KEY?: string;
  ADMIN_TOKEN: string;
  RESEND_API_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;

  // Vars
  COMPANY_NAME: string;
  OPERATOR_EMAIL: string;
  OPERATOR_PHONE: string;
  FROM_EMAIL: string;
  CALENDLY_URL: string;
  ISA_CERT: string;
  ALLOWED_ORIGINS: string;
  RATE_LIMIT_PER_HOUR: string;
  RATE_LIMIT_PER_DAY: string;
  PUBLIC_BASE_URL: string;
  TWILIO_FROM_NUMBER?: string;
};

export type PkgKey = "trim" | "removal" | "stump" | "treatment";

export type Annotation = {
  // A–E scope-of-work categories shown as lettered markers on the photo
  type: "trim" | "clearance" | "deadwood" | "cleanup" | "review";
  label: string;
  bbox: [number, number, number, number]; // x, y, w, h as 0..1 fractions of image
};

export type Analysis = {
  is_tree: boolean;
  photo_quality?: string;
  common_name: string;
  latin_name: string;
  est_height_ft: string;
  est_dbh_in: string;
  crown_spread_ft: string;
  size_class?: string;
  condition: string;
  confidence?: string;
  isa_risk_rating: string;
  recommended_service: string;
  recommended_pkg_key: PkgKey;
  ansi_standard?: string;
  site_assessment?: string;
  hazard_review?: string;
  scope_summary?: string[];
  notes?: string[];
  standard_note?: string;
  annotations?: Annotation[];
};

export type PriceTable = Record<PkgKey, { name: string; icon: string; low: number; high: number }>;

export type TreeRow = {
  id: string;
  estimate_id: string;
  photo_key: string;
  label: string | null;
  species: string | null;
  latin_name: string | null;
  est_height_ft: string | null;
  est_dbh_in: string | null;
  crown_spread_ft: string | null;
  condition: string | null;
  risk_rating: string | null;
  recommended_pkg: PkgKey | null;
  selected_pkg: PkgKey | null;
  quote_low: number | null;
  quote_high: number | null;
  annotations: Annotation[] | null;
  ai_raw?: string;
};

export type EstimateRow = {
  id: string;
  contact_id: string | null;
  status: "draft" | "contact_provided" | "submitted" | "booked" | "completed" | "abandoned";
  total_low: number;
  total_high: number;
  bundle_discount_pct: number;
  share_token: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  property_notes: string | null;
};
