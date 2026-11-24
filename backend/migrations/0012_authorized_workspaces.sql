CREATE TABLE IF NOT EXISTS casualty_referrals (
  org_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  encounter_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  referred_by TEXT NOT NULL,
  referred_at TEXT NOT NULL,
  PRIMARY KEY (org_id, clinic_id, encounter_id),
  FOREIGN KEY (org_id, clinic_id) REFERENCES clinics (org_id, id),
  FOREIGN KEY (org_id, encounter_id) REFERENCES encounters (org_id, id),
  FOREIGN KEY (org_id, doctor_id) REFERENCES users (org_id, id),
  FOREIGN KEY (org_id, referred_by) REFERENCES users (org_id, id)
);
CREATE INDEX IF NOT EXISTS casualty_referrals_doctor ON casualty_referrals(org_id,clinic_id,doctor_id);

CREATE TABLE IF NOT EXISTS command_expenses (
  org_id TEXT NOT NULL,
  clinic_id TEXT,
  id TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (typeof(amount_paise)='integer' AND amount_paise>0),
  tax_bps INTEGER NOT NULL CHECK (typeof(tax_bps)='integer' AND tax_bps BETWEEN 0 AND 10000),
  tax_paise INTEGER NOT NULL CHECK (typeof(tax_paise)='integer' AND tax_paise>=0),
  description TEXT NOT NULL,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('ONE_TIME','RECURRING')),
  expense_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  voided_at TEXT,
  PRIMARY KEY (org_id,id),
  FOREIGN KEY (org_id,clinic_id) REFERENCES clinics (org_id,id)
);
CREATE TABLE IF NOT EXISTS command_equipment (
  org_id TEXT NOT NULL,
  clinic_id TEXT,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (typeof(quantity)='integer' AND quantity>0),
  purchase_cost_paise INTEGER NOT NULL CHECK (typeof(purchase_cost_paise)='integer' AND purchase_cost_paise>=0),
  purchase_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('FUNCTIONAL','MAINTENANCE','RETIRED')),
  created_at TEXT NOT NULL,
  archived_at TEXT,
  PRIMARY KEY (org_id,id),
  FOREIGN KEY (org_id,clinic_id) REFERENCES clinics (org_id,id)
);
CREATE TABLE IF NOT EXISTS command_shifts (
  org_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  grace_minutes INTEGER NOT NULL,
  late_cutoff_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (org_id,clinic_id,id),
  FOREIGN KEY (org_id,clinic_id) REFERENCES clinics(org_id,id)
);
CREATE TABLE IF NOT EXISTS command_shift_assignments (
  org_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  PRIMARY KEY (org_id,clinic_id,user_id),
  FOREIGN KEY (org_id,user_id) REFERENCES users(org_id,id),
  FOREIGN KEY (org_id,clinic_id,shift_id) REFERENCES command_shifts(org_id,clinic_id,id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS complete_casualty_referral
AFTER INSERT ON care_admissions
WHEN EXISTS (SELECT 1 FROM care_locations l WHERE l.org_id=NEW.org_id AND l.clinic_id=NEW.clinic_id AND l.id=NEW.location_id AND l.kind='bay')
BEGIN
  DELETE FROM casualty_referrals WHERE org_id=NEW.org_id AND clinic_id=NEW.clinic_id AND encounter_id=NEW.encounter_id;
END;
