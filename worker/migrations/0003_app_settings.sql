-- Key-value store for runtime-discovered config (e.g. the app's own public URL),
-- so background jobs like the follow-up cron can build absolute links without
-- the operator having to hardcode the workers.dev / custom-domain URL anywhere.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
