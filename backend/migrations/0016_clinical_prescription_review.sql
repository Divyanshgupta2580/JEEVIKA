CREATE TABLE clinical_quote_keys (
  org_id TEXT NOT NULL, clinic_id TEXT NOT NULL, secret TEXT NOT NULL,
  PRIMARY KEY(org_id,clinic_id),
  FOREIGN KEY(org_id,clinic_id) REFERENCES clinics(org_id,id)
);
INSERT INTO clinical_quote_keys(org_id,clinic_id,secret)
SELECT org_id,id,lower(hex(randomblob(32))) FROM clinics;
CREATE TRIGGER initialize_clinical_quote_key AFTER INSERT ON clinics BEGIN
  INSERT OR IGNORE INTO clinical_quote_keys(org_id,clinic_id,secret)
  VALUES(NEW.org_id,NEW.id,lower(hex(randomblob(32))));
END;

CREATE TABLE clinical_reviews (
  org_id TEXT NOT NULL, encounter_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
  actor_id TEXT NOT NULL, reviewed_at TEXT NOT NULL, note TEXT NOT NULL, details_json TEXT NOT NULL,
  PRIMARY KEY(org_id,encounter_id,revision),
  FOREIGN KEY(org_id,encounter_id) REFERENCES encounters(org_id,id),
  FOREIGN KEY(org_id,actor_id) REFERENCES users(org_id,id)
);
CREATE TABLE clinician_prescription_drafts (
  org_id TEXT NOT NULL, encounter_id TEXT NOT NULL, actor_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision>0), draft_json TEXT NOT NULL,
  PRIMARY KEY(org_id,encounter_id,actor_id),
  FOREIGN KEY(org_id,encounter_id) REFERENCES encounters(org_id,id),
  FOREIGN KEY(org_id,actor_id) REFERENCES users(org_id,id)
);
INSERT INTO clinical_reviews(org_id,encounter_id,revision,actor_id,reviewed_at,note,details_json)
SELECT org_id,id,1,reviewed_by,reviewed_at,review_note,'{}'
FROM encounters WHERE status='reviewed' AND reviewed_by IS NOT NULL
  AND reviewed_at IS NOT NULL AND review_note IS NOT NULL;
CREATE TRIGGER clinical_review_projection AFTER INSERT ON clinical_reviews BEGIN
  UPDATE encounters SET status='reviewed',reviewed_by=NEW.actor_id,
    reviewed_at=NEW.reviewed_at,review_note=NEW.note
  WHERE org_id=NEW.org_id AND id=NEW.encounter_id;
END;
CREATE TRIGGER clinical_review_immutable BEFORE UPDATE ON clinical_reviews BEGIN
  SELECT RAISE(ABORT,'CLINICAL_REVIEW_IMMUTABLE');
END;
CREATE TRIGGER clinical_review_no_delete BEFORE DELETE ON clinical_reviews BEGIN
  SELECT RAISE(ABORT,'CLINICAL_REVIEW_IMMUTABLE');
END;

ALTER TABLE signed_prescriptions ADD COLUMN clinical_snapshot_json TEXT;
CREATE TRIGGER prescription_review_current BEFORE INSERT ON signed_prescriptions
WHEN NEW.clinical_snapshot_json IS NOT NULL BEGIN
  SELECT RAISE(ABORT,'PRESCRIPTION_REVIEW_CHANGED') WHERE NOT EXISTS (
    SELECT 1 FROM encounters e JOIN patients p ON p.org_id=e.org_id AND p.id=e.patient_id
    WHERE e.org_id=NEW.org_id AND e.clinic_id=NEW.clinic_id AND e.id=NEW.encounter_id
      AND p.allergies_json IS json_extract(NEW.clinical_snapshot_json,'$.profileAllergiesJson')
      AND (SELECT MAX(r.revision) FROM clinical_reviews r
           WHERE r.org_id=e.org_id AND r.encounter_id=e.id)
        =json_extract(NEW.clinical_snapshot_json,'$.revision')
  );
END;

CREATE TRIGGER current_medicine_safety_during_checkout BEFORE INSERT ON reservation_lines BEGIN
  SELECT RAISE(ABORT,'APPROVED_MEDICINE_REQUIRED') WHERE NOT EXISTS (
    SELECT 1 FROM prescription_lines l JOIN inventory_batches b ON b.org_id=l.org_id AND b.sku_id=l.sku_id
    WHERE l.org_id=NEW.org_id AND l.id=NEW.line_id AND b.id=NEW.batch_id
      AND l.course_end>=date('now','+330 minutes')
  );
  SELECT RAISE(ABORT,'RECORDED_MEDICINE_ALLERGY') WHERE EXISTS (
    SELECT 1 FROM reservations r
    JOIN signed_prescriptions rx ON rx.org_id=r.org_id AND rx.id=r.prescription_id
    JOIN encounters e ON e.org_id=rx.org_id AND e.id=rx.encounter_id
    JOIN patients p ON p.org_id=e.org_id AND p.id=e.patient_id
    JOIN inventory_batches b ON b.org_id=r.org_id AND b.id=NEW.batch_id
    JOIN sku s ON s.org_id=b.org_id AND s.id=b.sku_id
    WHERE r.org_id=NEW.org_id AND r.id=NEW.reservation_id
      AND EXISTS (
        SELECT 1 FROM (
          SELECT value FROM json_each(p.allergies_json)
          UNION ALL
          SELECT value FROM json_each(rx.allergies_json)
          UNION ALL
          SELECT value FROM json_each((
            SELECT json_extract(cr.details_json,'$.allergies') FROM clinical_reviews cr
            WHERE cr.org_id=e.org_id AND cr.encounter_id=e.id
            ORDER BY cr.revision DESC LIMIT 1
          ))
        ) a WHERE lower(trim(a.value)) IN (lower(trim(s.salt)),lower(trim(s.brand)))
      )
  );
END;

CREATE TABLE clinical_stock_writeoffs (
  org_id TEXT NOT NULL, id TEXT NOT NULL, clinic_id TEXT NOT NULL, batch_id TEXT NOT NULL,
  actor_id TEXT NOT NULL, command_key TEXT NOT NULL, request_hash TEXT NOT NULL,
  recorded_at TEXT NOT NULL, stock_before INTEGER NOT NULL, units INTEGER NOT NULL CHECK(units>0 AND units<=stock_before),
  cost_paise INTEGER NOT NULL CHECK(typeof(cost_paise)='integer' AND cost_paise>=0),
  reason TEXT NOT NULL CHECK(length(trim(reason))>=3),
  PRIMARY KEY(org_id,id), UNIQUE(org_id,actor_id,command_key),
  FOREIGN KEY(org_id,clinic_id) REFERENCES clinics(org_id,id),
  FOREIGN KEY(org_id,batch_id) REFERENCES inventory_batches(org_id,id),
  FOREIGN KEY(org_id,actor_id) REFERENCES users(org_id,id)
);
CREATE INDEX clinical_stock_writeoffs_batch ON clinical_stock_writeoffs(org_id,clinic_id,batch_id,recorded_at);
CREATE TRIGGER apply_clinical_stock_writeoff AFTER INSERT ON clinical_stock_writeoffs BEGIN
  SELECT RAISE(ABORT,'PERIOD_LOCKED') WHERE
    date(NEW.recorded_at,'+330 minutes')<=COALESCE((SELECT lock_date FROM accounting_settings WHERE org_id=NEW.org_id),'');
  UPDATE inventory_batches SET qty_units=qty_units-NEW.units
    WHERE org_id=NEW.org_id AND clinic_id=NEW.clinic_id AND id=NEW.batch_id
      AND qty_units=NEW.stock_before AND qty_units-reserved_units>=NEW.units
      AND NEW.cost_paise=NEW.units*cost_paise;
  SELECT RAISE(ABORT,'STOCK_CHANGED') WHERE changes()<>1;
  INSERT INTO journals(org_id,id,clinic_id,ref_type,ref_id,date,status)
    SELECT NEW.org_id,NEW.id,NEW.clinic_id,'stock-writeoff',NEW.id,date(NEW.recorded_at,'+330 minutes'),'draft'
    WHERE NEW.cost_paise>0;
  INSERT INTO journal_lines(org_id,id,journal_id,account,debit_paise,credit_paise)
    SELECT NEW.org_id,lower(hex(randomblob(16))),NEW.id,'inventory_writeoff_loss',NEW.cost_paise,0 WHERE NEW.cost_paise>0
    UNION ALL
    SELECT NEW.org_id,lower(hex(randomblob(16))),NEW.id,'inventory',0,NEW.cost_paise WHERE NEW.cost_paise>0;
  UPDATE journals SET status='posted' WHERE org_id=NEW.org_id AND id=NEW.id AND NEW.cost_paise>0;
END;
CREATE TRIGGER clinical_stock_writeoff_immutable BEFORE UPDATE ON clinical_stock_writeoffs BEGIN
  SELECT RAISE(ABORT,'STOCK_WRITEOFF_IMMUTABLE');
END;
CREATE TRIGGER clinical_stock_writeoff_no_delete BEFORE DELETE ON clinical_stock_writeoffs BEGIN
  SELECT RAISE(ABORT,'STOCK_WRITEOFF_IMMUTABLE');
END;
