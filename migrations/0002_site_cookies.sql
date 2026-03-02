-- site_cookies: optional stored Cookie header for a registered site
CREATE TABLE IF NOT EXISTS site_cookies (
  site_id    TEXT PRIMARY KEY, -- matches websites.id
  cookie     TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
