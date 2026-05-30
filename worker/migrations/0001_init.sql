CREATE TABLE quotes (
  id              TEXT PRIMARY KEY,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  photo_key       TEXT NOT NULL,
  ip_hash         TEXT,
  user_agent      TEXT,
  ai_raw          TEXT NOT NULL,
  species         TEXT,
  latin_name      TEXT,
  est_height_ft   TEXT,
  est_dbh_in      TEXT,
  crown_spread_ft TEXT,
  condition       TEXT,
  risk_rating     TEXT,
  recommended_pkg TEXT,
  quote_low       INTEGER,
  quote_high      INTEGER,
  selected_pkg    TEXT,
  status          TEXT NOT NULL DEFAULT 'generated'
);

CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX idx_quotes_status     ON quotes(status);

CREATE TABLE bookings (
  id              TEXT PRIMARY KEY,
  quote_id        TEXT REFERENCES quotes(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  calendly_event  TEXT,
  calendly_uri    TEXT,
  customer_name   TEXT,
  customer_email  TEXT,
  customer_phone  TEXT,
  address         TEXT,
  scheduled_for   TEXT,
  final_price     INTEGER,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled'
);

CREATE INDEX idx_bookings_quote_id    ON bookings(quote_id);
CREATE INDEX idx_bookings_created_at  ON bookings(created_at DESC);

-- Per-IP rate limit counters. Rows older than 1 day pruned by query.
CREATE TABLE rate_limits (
  ip_hash      TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_hash, window_start)
);

CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);
