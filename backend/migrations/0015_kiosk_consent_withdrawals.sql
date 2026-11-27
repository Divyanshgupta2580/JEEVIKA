CREATE TABLE IF NOT EXISTS kiosk_consent_withdrawals (
  org_id TEXT NOT NULL,
  encounter_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('pharmacy','remote','research')),
  withdrawn_at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  PRIMARY KEY(org_id,encounter_id,purpose),
  FOREIGN KEY(org_id,encounter_id) REFERENCES encounters(org_id,id),
  FOREIGN KEY(org_id,actor_id) REFERENCES users(org_id,id)
);

CREATE TRIGGER IF NOT EXISTS kiosk_withdraw_pharmacy
AFTER INSERT ON kiosk_consent_withdrawals WHEN NEW.purpose='pharmacy'
BEGIN
  UPDATE encounter_permissions SET revoked_at=NEW.withdrawn_at
    WHERE org_id=NEW.org_id AND encounter_id=NEW.encounter_id AND purpose='pharmacy' AND revoked_at IS NULL;
  UPDATE reservations SET status='released' WHERE org_id=NEW.org_id AND status='held'
    AND prescription_id IN (SELECT id FROM signed_prescriptions WHERE org_id=NEW.org_id AND encounter_id=NEW.encounter_id);
END;

CREATE TRIGGER IF NOT EXISTS kiosk_pharmacy_at_signature
BEFORE INSERT ON signed_prescriptions
BEGIN
  SELECT RAISE(ABORT,'KIOSK_PHARMACY_CONSENT_REQUIRED')
    WHERE EXISTS (SELECT 1 FROM kiosk_intakes k
      WHERE k.org_id=NEW.org_id AND k.encounter_id=NEW.encounter_id
      AND COALESCE(json_extract(k.consent_json,'$.pharmacy'),0)<>1)
    OR EXISTS (SELECT 1 FROM kiosk_consent_withdrawals w
      WHERE w.org_id=NEW.org_id AND w.encounter_id=NEW.encounter_id AND w.purpose='pharmacy');
END;
