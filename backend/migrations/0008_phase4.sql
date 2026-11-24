CREATE TABLE IF NOT EXISTS ayush_case_notes (
  org_id TEXT NOT NULL,
  encounter_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  practitioner_id TEXT NOT NULL,
  details_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (org_id, encounter_id, practitioner_id),
  FOREIGN KEY (org_id, clinic_id) REFERENCES clinics(org_id, id),
  FOREIGN KEY (org_id, practitioner_id) REFERENCES users(org_id, id)
);

CREATE TABLE IF NOT EXISTS swarm_activity (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  findings INTEGER NOT NULL CHECK(findings >= 0),
  PRIMARY KEY (org_id, id)
);
CREATE INDEX IF NOT EXISTS swarm_activity_recent ON swarm_activity(org_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS prune_gateway_events (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  event TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  simulated INTEGER NOT NULL CHECK(simulated IN (0, 1)),
  PRIMARY KEY (org_id, id)
);
CREATE INDEX IF NOT EXISTS prune_gateway_events_recent ON prune_gateway_events(org_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS prune_cache_generation (
  org_id TEXT PRIMARY KEY,
  generation INTEGER NOT NULL CHECK(generation >= 0)
);

CREATE TABLE IF NOT EXISTS prune_gateway_cache (
  org_id TEXT NOT NULL,
  model TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (org_id, model)
);
