CREATE TABLE IF NOT EXISTS access_grants (
  id TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  label TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'visitor',
  notes TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  max_uses INTEGER NOT NULL DEFAULT 25,
  max_ips INTEGER NOT NULL DEFAULT 3,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS access_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grant_id TEXT,
  result TEXT NOT NULL,
  ip TEXT NOT NULL,
  city TEXT,
  region TEXT,
  country TEXT,
  latitude TEXT,
  longitude TEXT,
  postal_code TEXT,
  asn TEXT,
  user_agent TEXT,
  client_meta TEXT,
  requested_path TEXT,
  occurred_at INTEGER NOT NULL,
  FOREIGN KEY (grant_id) REFERENCES access_grants(id)
);

CREATE INDEX IF NOT EXISTS access_events_ip_time
  ON access_events(ip, occurred_at);

CREATE INDEX IF NOT EXISTS access_events_grant_time
  ON access_events(grant_id, occurred_at);
