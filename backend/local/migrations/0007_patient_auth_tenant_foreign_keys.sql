-- Rebuild patient auth tables against the canonical clinical tenant key.
-- The standalone migration runner applies this atomically and checks all four foreign keys.

CREATE TABLE patient_credentials_tenant_fk (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  patient_id TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  email TEXT,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  phone_verified INTEGER NOT NULL DEFAULT 1 CHECK(phone_verified IN (0,1)),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED','LOCKED')),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  lockout_until TEXT,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (org_id, patient_id) REFERENCES patients(org_id, id) ON DELETE CASCADE
);
INSERT INTO patient_credentials_tenant_fk (id, org_id, patient_id, phone_number, phone_hash, email, password_salt, password_hash, phone_verified, status, failed_attempts, lockout_until, last_login, created_at, updated_at)
SELECT id, org_id, patient_id, phone_number, phone_hash, email, password_salt, password_hash, phone_verified, status, failed_attempts, lockout_until, last_login, created_at, updated_at
FROM patient_credentials;
DROP TABLE patient_credentials;
ALTER TABLE patient_credentials_tenant_fk RENAME TO patient_credentials;
CREATE INDEX IF NOT EXISTS idx_patient_creds_org_phone ON patient_credentials(org_id, phone_hash);
CREATE INDEX IF NOT EXISTS idx_patient_creds_org_email ON patient_credentials(org_id, email);

CREATE TABLE patient_sessions_tenant_fk (
  org_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  device_name TEXT,
  platform TEXT CHECK(platform IN ('ANDROID','IOS','WEB')),
  fcm_token TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (org_id, token_hash),
  FOREIGN KEY (org_id, patient_id) REFERENCES patients(org_id, id) ON DELETE CASCADE
);
INSERT INTO patient_sessions_tenant_fk (org_id, token_hash, patient_id, device_name, platform, fcm_token, expires_at, created_at)
SELECT org_id, token_hash, patient_id, device_name, platform, fcm_token, expires_at, created_at
FROM patient_sessions;
DROP TABLE patient_sessions;
ALTER TABLE patient_sessions_tenant_fk RENAME TO patient_sessions;
CREATE INDEX IF NOT EXISTS idx_patient_sessions_patient ON patient_sessions(org_id, patient_id);

CREATE TABLE patient_ayurvedic_profiles_tenant_fk (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  patient_id TEXT NOT NULL UNIQUE,
  primary_dosha TEXT NOT NULL,
  secondary_dosha TEXT DEFAULT 'NONE',
  prakriti_summary TEXT NOT NULL,
  vikriti_aggravation TEXT,
  agni_type TEXT NOT NULL DEFAULT 'SAMAGNI',
  koshtha_type TEXT NOT NULL DEFAULT 'MADHYAMA',
  dietary_guidelines_json TEXT NOT NULL DEFAULT '[]',
  yoga_recommendations_json TEXT NOT NULL DEFAULT '[]',
  assessed_by TEXT NOT NULL DEFAULT 'SELF_ASSESSMENT',
  assessed_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (org_id, patient_id) REFERENCES patients(org_id, id) ON DELETE CASCADE
);
INSERT INTO patient_ayurvedic_profiles_tenant_fk (id, org_id, patient_id, primary_dosha, secondary_dosha, prakriti_summary, vikriti_aggravation, agni_type, koshtha_type, dietary_guidelines_json, yoga_recommendations_json, assessed_by, assessed_at, updated_at)
SELECT id, org_id, patient_id, primary_dosha, secondary_dosha, prakriti_summary, vikriti_aggravation, agni_type, koshtha_type, dietary_guidelines_json, yoga_recommendations_json, assessed_by, assessed_at, updated_at
FROM patient_ayurvedic_profiles;
DROP TABLE patient_ayurvedic_profiles;
ALTER TABLE patient_ayurvedic_profiles_tenant_fk RENAME TO patient_ayurvedic_profiles;
CREATE INDEX IF NOT EXISTS idx_ayurvedic_profiles_org_patient ON patient_ayurvedic_profiles(org_id, patient_id);

CREATE TABLE patient_app_preferences_tenant_fk (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  patient_id TEXT NOT NULL UNIQUE,
  primary_focus TEXT NOT NULL DEFAULT 'longevity',
  primary_modules_json TEXT NOT NULL DEFAULT '["prescriptions","vitalis","her","yoga"]',
  theme_mode TEXT NOT NULL DEFAULT 'light',
  color_accent TEXT NOT NULL DEFAULT 'botanical_teal',
  language TEXT NOT NULL DEFAULT 'hi',
  notifications_enabled INTEGER NOT NULL DEFAULT 1 CHECK(notifications_enabled IN (0,1)),
  medicine_reminders_enabled INTEGER NOT NULL DEFAULT 1 CHECK(medicine_reminders_enabled IN (0,1)),
  cycle_reminders_enabled INTEGER NOT NULL DEFAULT 1 CHECK(cycle_reminders_enabled IN (0,1)),
  vitals_drift_alerts_enabled INTEGER NOT NULL DEFAULT 1 CHECK(vitals_drift_alerts_enabled IN (0,1)),
  biometric_login_enabled INTEGER NOT NULL DEFAULT 0 CHECK(biometric_login_enabled IN (0,1)),
  reminder_morning_time TEXT NOT NULL DEFAULT '08:00',
  reminder_afternoon_time TEXT NOT NULL DEFAULT '13:00',
  reminder_night_time TEXT NOT NULL DEFAULT '20:30',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (org_id, patient_id) REFERENCES patients(org_id, id) ON DELETE CASCADE
);
INSERT INTO patient_app_preferences_tenant_fk (id, org_id, patient_id, primary_focus, primary_modules_json, theme_mode, color_accent, language, notifications_enabled, medicine_reminders_enabled, cycle_reminders_enabled, vitals_drift_alerts_enabled, biometric_login_enabled, reminder_morning_time, reminder_afternoon_time, reminder_night_time, created_at, updated_at)
SELECT id, org_id, patient_id, primary_focus, primary_modules_json, theme_mode, color_accent, language, notifications_enabled, medicine_reminders_enabled, cycle_reminders_enabled, vitals_drift_alerts_enabled, biometric_login_enabled, reminder_morning_time, reminder_afternoon_time, reminder_night_time, created_at, updated_at
FROM patient_app_preferences;
DROP TABLE patient_app_preferences;
ALTER TABLE patient_app_preferences_tenant_fk RENAME TO patient_app_preferences;
CREATE INDEX IF NOT EXISTS idx_patient_app_prefs_org_patient ON patient_app_preferences(org_id, patient_id);
