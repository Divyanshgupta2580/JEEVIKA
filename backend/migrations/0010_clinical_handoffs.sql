CREATE TABLE IF NOT EXISTS staff_clinic_roles (
  org_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('CLINIC_ADMIN','STAT_NURSE')),
  PRIMARY KEY (org_id,clinic_id,user_id),
  FOREIGN KEY (org_id,clinic_id) REFERENCES clinics(org_id,id),
  FOREIGN KEY (org_id,user_id) REFERENCES users(org_id,id)
);
CREATE TABLE IF NOT EXISTS care_locations (
  org_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('bed','bay')),
  room TEXT NOT NULL,
  label TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'available' CHECK(state IN ('available','cleaning','maintenance')),
  PRIMARY KEY(org_id, clinic_id, id),
  FOREIGN KEY(org_id, clinic_id) REFERENCES clinics(org_id, id)
);
CREATE TABLE IF NOT EXISTS care_admissions (
  org_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  id TEXT NOT NULL,
  encounter_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  admitted_by TEXT NOT NULL,
  admitted_at TEXT NOT NULL,
  discharged_by TEXT,
  discharged_at TEXT,
  PRIMARY KEY(org_id, id),
  FOREIGN KEY(org_id, clinic_id, location_id) REFERENCES care_locations(org_id, clinic_id, id),
  FOREIGN KEY(org_id, doctor_id) REFERENCES users(org_id, id),
  FOREIGN KEY(org_id, encounter_id) REFERENCES encounters(org_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS care_location_occupant ON care_admissions(org_id,clinic_id,location_id) WHERE discharged_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS care_encounter_admission ON care_admissions(org_id,encounter_id) WHERE discharged_at IS NULL;

CREATE TABLE IF NOT EXISTS ipd_distress_events (
  org_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  id TEXT NOT NULL,
  admission_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  triggered_at TEXT NOT NULL,
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  latency_ms INTEGER,
  resolved_by TEXT,
  resolved_at TEXT,
  PRIMARY KEY(org_id,id),
  FOREIGN KEY(org_id,admission_id) REFERENCES care_admissions(org_id,id),
  FOREIGN KEY(org_id,reporter_id) REFERENCES users(org_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS active_admission_distress ON ipd_distress_events(org_id,admission_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS distress_clinic_active ON ipd_distress_events(org_id,clinic_id,triggered_at) WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS nurse_outreach (
  org_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  id TEXT NOT NULL,
  admission_id TEXT NOT NULL,
  check_in_day TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('stable','medication-reviewed','opd-requested','transfer-reported')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(org_id,id),
  UNIQUE(org_id,admission_id,check_in_day),
  FOREIGN KEY(org_id,admission_id) REFERENCES care_admissions(org_id,id),
  FOREIGN KEY(org_id,actor_id) REFERENCES users(org_id,id)
);

CREATE TRIGGER IF NOT EXISTS clean_location_after_discharge
AFTER UPDATE OF discharged_at ON care_admissions
WHEN OLD.discharged_at IS NULL AND NEW.discharged_at IS NOT NULL
BEGIN
  UPDATE care_locations SET state='cleaning'
  WHERE org_id=NEW.org_id AND clinic_id=NEW.clinic_id AND id=NEW.location_id;
END;
