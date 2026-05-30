-- v2 schema: shift from single-tree quotes to multi-tree estimates rooted at contacts.
-- The v1 `quotes` and `bookings` tables are dropped; v1 has not shipped.

DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS quotes;

-- A household / property owner. One contact may run multiple estimates over time.
CREATE TABLE contacts (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  name          TEXT,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  property_notes TEXT,
  source        TEXT,             -- 'web', 'sms', 'referral', 'walk_in'
  UNIQUE (email),
  UNIQUE (phone)
);

CREATE INDEX idx_contacts_created_at ON contacts(created_at DESC);

-- An estimate is a "shopping cart" for one property walk-through. Multiple trees per estimate.
CREATE TABLE estimates (
  id              TEXT PRIMARY KEY,
  contact_id      TEXT REFERENCES contacts(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at    TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
                       -- draft | contact_provided | submitted | booked | completed | abandoned
  ip_hash         TEXT,
  total_low       INTEGER NOT NULL DEFAULT 0,
  total_high      INTEGER NOT NULL DEFAULT 0,
  bundle_discount_pct INTEGER NOT NULL DEFAULT 0,
  share_token     TEXT,           -- short token for resume links
  notes           TEXT            -- customer site notes (gate, parking, etc.)
);

CREATE INDEX idx_estimates_contact   ON estimates(contact_id);
CREATE INDEX idx_estimates_status    ON estimates(status);
CREATE INDEX idx_estimates_updated   ON estimates(updated_at DESC);
CREATE INDEX idx_estimates_token     ON estimates(share_token);

-- Each tree in an estimate.
CREATE TABLE trees (
  id              TEXT PRIMARY KEY,
  estimate_id     TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  photo_key       TEXT NOT NULL,
  label           TEXT,           -- customer-set label like "Front yard oak"
  ai_raw          TEXT NOT NULL,
  species         TEXT,
  latin_name      TEXT,
  est_height_ft   TEXT,
  est_dbh_in      TEXT,
  crown_spread_ft TEXT,
  condition       TEXT,
  risk_rating     TEXT,
  recommended_pkg TEXT,
  selected_pkg    TEXT,
  quote_low       INTEGER,
  quote_high      INTEGER,
  annotations     TEXT            -- JSON array of {type,label,bbox} for SVG overlay
);

CREATE INDEX idx_trees_estimate ON trees(estimate_id);

-- One booking per estimate.
CREATE TABLE bookings (
  id              TEXT PRIMARY KEY,
  estimate_id     TEXT NOT NULL REFERENCES estimates(id),
  contact_id      TEXT REFERENCES contacts(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  calendly_event  TEXT,
  calendly_uri    TEXT,
  scheduled_for   TEXT,
  final_price     INTEGER,
  on_site_notes   TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                       -- scheduled | completed | cancelled | no_show
);

CREATE INDEX idx_bookings_estimate ON bookings(estimate_id);
CREATE INDEX idx_bookings_contact  ON bookings(contact_id);

-- Every customer touch (sms, email, web chat, voice) logged here for the CRM.
CREATE TABLE interactions (
  id              TEXT PRIMARY KEY,
  contact_id      TEXT REFERENCES contacts(id),
  estimate_id     TEXT REFERENCES estimates(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  channel         TEXT NOT NULL,  -- 'sms_out' | 'sms_in' | 'email_out' | 'email_in' | 'chat' | 'voice' | 'system'
  direction       TEXT NOT NULL,  -- 'inbound' | 'outbound' | 'system'
  body            TEXT,
  meta            TEXT            -- JSON for provider ids etc.
);

CREATE INDEX idx_interactions_contact ON interactions(contact_id, created_at DESC);
CREATE INDEX idx_interactions_estimate ON interactions(estimate_id, created_at DESC);

-- Rate limit table re-created (we dropped quotes which doesn't affect it, but be explicit)
CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash      TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_hash, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
