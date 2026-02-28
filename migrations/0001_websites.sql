-- websites: maps a human-readable slug (used in app URLs) to the canonical origin.
-- e.g.  id = "plato-stanford-edu",  origin = "https://plato.stanford.edu"
CREATE TABLE IF NOT EXISTS websites (
  id         TEXT PRIMARY KEY,   -- slug derived from hostname, e.g. "plato-stanford-edu"
  origin     TEXT NOT NULL UNIQUE, -- normalized scheme+host, e.g. "https://plato.stanford.edu"
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
