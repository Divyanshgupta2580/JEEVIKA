CREATE VIEW continuity_fulfillments AS
SELECT e.org_id,e.clinic_id,e.id AS encounter_id,e.patient_id,r.id AS prescription_id,
       r.signed_by,s.id AS sale_id,s.created_at
FROM signed_prescriptions r
JOIN encounters e ON e.org_id=r.org_id AND e.id=r.encounter_id AND e.clinic_id=r.clinic_id
JOIN consents c ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.purpose='care' AND c.revoked_at IS NULL
JOIN encounter_permissions p ON p.org_id=e.org_id AND p.encounter_id=e.id AND p.purpose='pharmacy' AND p.revoked_at IS NULL
JOIN reservations v ON v.org_id=r.org_id AND v.prescription_id=r.id AND v.clinic_id=r.clinic_id AND v.status='dispensed'
JOIN sales s ON s.org_id=v.org_id AND s.reservation_id=v.id AND s.clinic_id=v.clinic_id AND s.status='completed'
JOIN journals j ON j.org_id=s.org_id AND j.clinic_id=s.clinic_id AND j.ref_type='sale' AND j.ref_id=s.id AND j.status='posted';

CREATE VIEW continuity_remote_encounters AS
SELECT e.org_id,e.clinic_id,e.id AS encounter_id,e.patient_id,e.reviewed_by
FROM encounters e
JOIN consents c ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.purpose='care' AND c.revoked_at IS NULL
WHERE e.status='reviewed'
  AND EXISTS(SELECT 1 FROM kiosk_intakes k WHERE k.org_id=e.org_id AND k.clinic_id=e.clinic_id
    AND k.encounter_id=e.id AND json_extract(k.consent_json,'$.remote')=1)
  AND NOT EXISTS(SELECT 1 FROM kiosk_consent_withdrawals w WHERE w.org_id=e.org_id AND w.encounter_id=e.id AND w.purpose='remote');

CREATE TABLE recovery_plans (
  org_id TEXT NOT NULL, encounter_id TEXT NOT NULL, clinic_id TEXT NOT NULL, approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL, expires_on TEXT NOT NULL,
  criterion TEXT NOT NULL CHECK(criterion='sustained-systolic-v1'),
  PRIMARY KEY(org_id,encounter_id),
  FOREIGN KEY(org_id,encounter_id) REFERENCES encounters(org_id,id),
  FOREIGN KEY(org_id,clinic_id) REFERENCES clinics(org_id,id),
  FOREIGN KEY(org_id,approved_by) REFERENCES users(org_id,id)
);

CREATE TABLE recovery_outreach (
  org_id TEXT NOT NULL, id TEXT NOT NULL, encounter_id TEXT NOT NULL, clinic_id TEXT NOT NULL,
  patient_id TEXT NOT NULL, check_in_day TEXT NOT NULL, trigger_day TEXT NOT NULL, detected_at TEXT NOT NULL,
  baseline REAL NOT NULL, systolic INTEGER NOT NULL,
  acknowledged_by TEXT, acknowledged_at TEXT, outcome TEXT, closed_by TEXT, closed_at TEXT,
  CHECK((acknowledged_by IS NULL)=(acknowledged_at IS NULL)),
  CHECK((closed_at IS NULL AND outcome IS NULL AND closed_by IS NULL)
    OR (closed_at IS NOT NULL AND acknowledged_at IS NOT NULL AND closed_by IS NOT NULL
       AND outcome IN ('stable','medication-reviewed','opd-requested','transfer-reported'))),
  PRIMARY KEY(org_id,id), UNIQUE(org_id,encounter_id,check_in_day),
  FOREIGN KEY(org_id,encounter_id) REFERENCES recovery_plans(org_id,encounter_id),
  FOREIGN KEY(org_id,clinic_id) REFERENCES clinics(org_id,id),
  FOREIGN KEY(org_id,patient_id,check_in_day) REFERENCES patient_check_ins(org_id,patient_id,day),
  FOREIGN KEY(org_id,patient_id,trigger_day) REFERENCES patient_check_ins(org_id,patient_id,day),
  FOREIGN KEY(org_id,acknowledged_by) REFERENCES users(org_id,id),
  FOREIGN KEY(org_id,closed_by) REFERENCES users(org_id,id)
);
CREATE INDEX recovery_open_by_clinic ON recovery_outreach(org_id,clinic_id,check_in_day) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX recovery_open_by_plan ON recovery_outreach(org_id,encounter_id) WHERE closed_at IS NULL;

CREATE VIEW continuity_dispensed_lines AS
SELECT f.*, l.id AS line_id,l.units,l.sku_id,k.brand AS medicine
FROM continuity_fulfillments f
JOIN prescription_lines l ON l.org_id=f.org_id AND l.prescription_id=f.prescription_id
JOIN sku k ON k.org_id=l.org_id AND k.id=l.sku_id
WHERE NOT EXISTS (
  SELECT 1 FROM encounters e
  JOIN patients p ON p.org_id=e.org_id AND p.id=e.patient_id
  JOIN signed_prescriptions rx ON rx.org_id=e.org_id AND rx.encounter_id=e.id
  JOIN json_each(p.allergies_json) a
  WHERE e.org_id=f.org_id AND e.id=f.encounter_id
    AND lower(trim(a.value)) IN (lower(trim(k.salt)),lower(trim(k.brand)))
) AND NOT EXISTS (
  SELECT 1 FROM signed_prescriptions rx
  JOIN json_each(rx.allergies_json) a
  WHERE rx.org_id=f.org_id AND rx.id=f.prescription_id
    AND lower(trim(a.value)) IN (lower(trim(k.salt)),lower(trim(k.brand)))
) AND NOT EXISTS (
  SELECT 1 FROM json_each((
    SELECT json_extract(cr.details_json,'$.allergies') FROM clinical_reviews cr
    WHERE cr.org_id=f.org_id AND cr.encounter_id=f.encounter_id ORDER BY cr.revision DESC LIMIT 1
  )) a WHERE lower(trim(a.value)) IN (lower(trim(k.salt)),lower(trim(k.brand)))
);

CREATE TABLE refill_approvals (
  org_id TEXT NOT NULL, line_id TEXT NOT NULL, clinic_id TEXT NOT NULL, approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL, request_through TEXT NOT NULL, course_end TEXT NOT NULL,
  CHECK(course_end>=request_through),
  PRIMARY KEY(org_id,line_id),
  FOREIGN KEY(org_id,line_id) REFERENCES prescription_lines(org_id,id),
  FOREIGN KEY(org_id,clinic_id) REFERENCES clinics(org_id,id),
  FOREIGN KEY(org_id,approved_by) REFERENCES users(org_id,id)
);

CREATE TABLE refill_requests (
  org_id TEXT NOT NULL, id TEXT NOT NULL, line_id TEXT NOT NULL, clinic_id TEXT NOT NULL,
  patient_id TEXT NOT NULL, requested_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','held','released')),
  held_by TEXT, held_at TEXT, held_until TEXT, released_by TEXT, released_at TEXT,
  release_reason TEXT CHECK(release_reason IN ('expired','consent-withdrawn','safety-recheck','patient-cancelled','pharmacy-released')),
  CHECK((held_by IS NULL AND held_at IS NULL AND held_until IS NULL)
    OR (held_by IS NOT NULL AND held_at IS NOT NULL AND held_until>held_at)),
  CHECK((status='requested' AND held_at IS NULL AND released_at IS NULL AND release_reason IS NULL)
    OR (status='held' AND held_at IS NOT NULL AND released_at IS NULL AND release_reason IS NULL)
    OR (status='released' AND released_at IS NOT NULL AND release_reason IS NOT NULL)),
  PRIMARY KEY(org_id,id), UNIQUE(org_id,line_id),
  FOREIGN KEY(org_id,line_id) REFERENCES refill_approvals(org_id,line_id),
  FOREIGN KEY(org_id,clinic_id) REFERENCES clinics(org_id,id),
  FOREIGN KEY(org_id,patient_id) REFERENCES patients(org_id,id),
  FOREIGN KEY(org_id,held_by) REFERENCES users(org_id,id),
  FOREIGN KEY(org_id,released_by) REFERENCES users(org_id,id)
);
CREATE INDEX refill_clinic_active ON refill_requests(org_id,clinic_id,status,requested_at) WHERE status<>'released';

CREATE TABLE refill_hold_lines (
  org_id TEXT NOT NULL, request_id TEXT NOT NULL, batch_id TEXT NOT NULL,
  units INTEGER NOT NULL CHECK(typeof(units)='integer' AND units>0),
  PRIMARY KEY(org_id,request_id,batch_id),
  FOREIGN KEY(org_id,request_id) REFERENCES refill_requests(org_id,id),
  FOREIGN KEY(org_id,batch_id) REFERENCES inventory_batches(org_id,id)
);

CREATE TRIGGER refill_allocate AFTER UPDATE OF status ON refill_requests
WHEN OLD.status='requested' AND NEW.status='held'
BEGIN
  SELECT RAISE(ABORT,'REFILL_NOT_ELIGIBLE') WHERE NOT EXISTS (
    SELECT 1 FROM refill_approvals a JOIN continuity_dispensed_lines d ON d.org_id=a.org_id AND d.line_id=a.line_id
    WHERE a.org_id=NEW.org_id AND a.line_id=NEW.line_id AND a.clinic_id=NEW.clinic_id
      AND d.clinic_id=NEW.clinic_id AND d.patient_id=NEW.patient_id
      AND a.request_through>=date(NEW.held_at,'+330 minutes')
  );
  INSERT INTO refill_hold_lines(org_id,request_id,batch_id,units)
  SELECT NEW.org_id,NEW.id,x.id,MIN(x.available,x.required-x.previous)
  FROM (
    SELECT b.id,b.qty_units-b.reserved_units AS available,l.units AS required,
      COALESCE(SUM(b.qty_units-b.reserved_units) OVER
        (ORDER BY b.expiry,b.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS previous
    FROM refill_approvals a
    JOIN prescription_lines l ON l.org_id=a.org_id AND l.id=a.line_id
    JOIN inventory_batches b ON b.org_id=a.org_id AND b.clinic_id=a.clinic_id AND b.sku_id=l.sku_id
    WHERE a.org_id=NEW.org_id AND a.line_id=NEW.line_id
      AND b.expiry>=date(a.course_end,'+14 days') AND b.qty_units>b.reserved_units
  ) x WHERE x.previous<x.required;
  SELECT RAISE(ABORT,'REFILL_STOCK_UNAVAILABLE') WHERE
    COALESCE((SELECT SUM(units) FROM refill_hold_lines WHERE org_id=NEW.org_id AND request_id=NEW.id),0)
      <>(SELECT units FROM prescription_lines WHERE org_id=NEW.org_id AND id=NEW.line_id);
  UPDATE inventory_batches SET reserved_units=reserved_units+
    (SELECT h.units FROM refill_hold_lines h WHERE h.org_id=inventory_batches.org_id AND h.batch_id=inventory_batches.id AND h.request_id=NEW.id)
  WHERE inventory_batches.org_id=NEW.org_id AND EXISTS(
    SELECT 1 FROM refill_hold_lines h WHERE h.org_id=inventory_batches.org_id AND h.batch_id=inventory_batches.id AND h.request_id=NEW.id
  );
END;

CREATE TRIGGER refill_release_lots AFTER UPDATE OF status ON refill_requests
WHEN OLD.status='held' AND NEW.status='released'
BEGIN
  UPDATE inventory_batches SET reserved_units=reserved_units-
    (SELECT h.units FROM refill_hold_lines h WHERE h.org_id=inventory_batches.org_id AND h.batch_id=inventory_batches.id AND h.request_id=NEW.id)
  WHERE inventory_batches.org_id=NEW.org_id AND EXISTS(
    SELECT 1 FROM refill_hold_lines h WHERE h.org_id=inventory_batches.org_id AND h.batch_id=inventory_batches.id AND h.request_id=NEW.id
  );
END;

CREATE TRIGGER refill_release_on_pharmacy_withdrawal AFTER UPDATE OF revoked_at ON encounter_permissions
WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL AND NEW.purpose='pharmacy'
BEGIN
  UPDATE refill_requests SET status='released',released_at=NEW.revoked_at,release_reason='consent-withdrawn'
   WHERE org_id=NEW.org_id AND status IN ('held','requested') AND line_id IN (
     SELECT l.id FROM prescription_lines l JOIN signed_prescriptions r ON r.org_id=l.org_id AND r.id=l.prescription_id
     WHERE l.org_id=NEW.org_id AND r.encounter_id=NEW.encounter_id
   );
END;

CREATE TABLE continuity_wellness_shares (
  org_id TEXT NOT NULL, id TEXT NOT NULL, clinic_id TEXT NOT NULL, encounter_id TEXT NOT NULL,
  patient_id TEXT NOT NULL, doctor_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('her','vitalis')),
  granted_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT,
  PRIMARY KEY(org_id,id),
  FOREIGN KEY(org_id,clinic_id) REFERENCES clinics(org_id,id),
  FOREIGN KEY(org_id,encounter_id) REFERENCES encounters(org_id,id),
  FOREIGN KEY(org_id,patient_id) REFERENCES patients(org_id,id),
  FOREIGN KEY(org_id,doctor_id) REFERENCES users(org_id,id)
);
CREATE UNIQUE INDEX one_active_wellness_share ON continuity_wellness_shares(org_id,encounter_id,kind) WHERE revoked_at IS NULL;

CREATE TRIGGER end_her_wellness_shares AFTER INSERT ON her_consents
WHEN NEW.consent_type='symptom_tracking' AND (NEW.granted=0 OR NEW.revoked_at IS NOT NULL)
BEGIN
  UPDATE continuity_wellness_shares SET revoked_at=COALESCE(NEW.revoked_at,NEW.granted_at)
  WHERE org_id=NEW.org_id AND patient_id=NEW.patient_id AND kind='her' AND revoked_at IS NULL;
END;

CREATE TRIGGER end_vitalis_wellness_shares AFTER INSERT ON vitalis_consents
WHEN NEW.vitalis_health_data=0 OR NEW.revoked_at IS NOT NULL
BEGIN
  UPDATE continuity_wellness_shares SET revoked_at=COALESCE(NEW.revoked_at,NEW.granted_at)
  WHERE org_id=NEW.org_id AND patient_id=NEW.patient_id AND kind='vitalis' AND revoked_at IS NULL;
END;

CREATE TRIGGER end_wellness_shares_on_care_withdrawal AFTER UPDATE OF revoked_at ON consents
WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
BEGIN
  UPDATE continuity_wellness_shares SET revoked_at=NEW.revoked_at
  WHERE org_id=NEW.org_id AND encounter_id=NEW.encounter_id AND revoked_at IS NULL;
END;
