CREATE TABLE IF NOT EXISTS patient_otp_challenges (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('home', 'kiosk')),
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  remaining INTEGER NOT NULL CHECK(remaining BETWEEN 0 AND 5),
  PRIMARY KEY (org_id, id)
);

CREATE TABLE IF NOT EXISTS kiosk_intakes (
  org_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  encounter_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  token_number TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_json TEXT NOT NULL,
  identity_id TEXT,
  document_text TEXT,
  complaint_text TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (org_id, clinic_id, request_id),
  UNIQUE (org_id, identity_id),
  UNIQUE (org_id, receipt_id),
  FOREIGN KEY (org_id, clinic_id) REFERENCES clinics(org_id,id)
);
CREATE INDEX IF NOT EXISTS kiosk_patient_encounter ON kiosk_intakes(org_id, encounter_id);
CREATE INDEX IF NOT EXISTS kiosk_recent_requests ON kiosk_intakes(org_id, clinic_id, created_at);

CREATE TRIGGER IF NOT EXISTS limit_kiosk_intake_rate
BEFORE INSERT ON kiosk_intakes
WHEN (SELECT COUNT(*) FROM kiosk_intakes
      WHERE org_id=NEW.org_id AND clinic_id=NEW.clinic_id
        AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 minute')) >= 10
BEGIN
  SELECT RAISE(ABORT, 'KIOSK_RATE_LIMIT');
END;

CREATE TABLE IF NOT EXISTS patient_check_ins (
  org_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  observations_json TEXT NOT NULL,
  PRIMARY KEY (org_id, patient_id, day)
);

-- Fresh clinical D1 installations reuse the patient session contract with a tenant-scoped key.
CREATE TABLE IF NOT EXISTS patient_sessions (
  org_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  device_name TEXT,
  platform TEXT CHECK(platform IN ('ANDROID','IOS','WEB')),
  fcm_token TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (org_id, token_hash),
  FOREIGN KEY (org_id,patient_id) REFERENCES patients(org_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_patient_sessions_patient ON patient_sessions(org_id, patient_id);
