import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LocalDatabase } from "./database";

/** Split our SQLite migration scripts while retaining complete trigger bodies. */
export function splitSqlScript(sql: string): string[] {
  const statements: string[] = [];
  let start = 0,
    index = 0,
    depth = 0;
  let trigger = false,
    prefix = "";
  while (index < sql.length) {
    const char = sql[index];
    if (char === "'" || char === '"' || char === "`") {
      const quote = char;
      index++;
      while (index < sql.length) {
        if (sql[index] === quote) {
          if (sql[index + 1] === quote) {
            index += 2;
            continue;
          }
          index++;
          break;
        }
        index++;
      }
      continue;
    }
    if (char === "-" && sql[index + 1] === "-") {
      while (index < sql.length && sql[index] !== "\n") index++;
      continue;
    }
    if (char === "/" && sql[index + 1] === "*") {
      const end = sql.indexOf("*/", index + 2);
      if (end < 0) throw new Error("Unclosed migration comment");
      index = end + 2;
      continue;
    }
    if (char && /[a-zA-Z_]/.test(char)) {
      const tokenStart = index++;
      while (index < sql.length && /[a-zA-Z_0-9]/.test(sql[index] ?? ""))
        index++;
      const token = sql.slice(tokenStart, index).toUpperCase();
      if (prefix.length < 100) prefix += `${token} `;
      if (/^CREATE\s+(TEMP\s+)?TRIGGER\s/.test(prefix)) trigger = true;
      if (trigger && (token === "BEGIN" || token === "CASE")) depth++;
      if (trigger && token === "END") depth--;
      continue;
    }
    if (char === ";" && depth === 0) {
      const statement = sql.slice(start, index + 1).trim();
      if (statement) statements.push(statement);
      start = index + 1;
      prefix = "";
      trigger = false;
    }
    index++;
  }
  if (depth !== 0) throw new Error("Unclosed migration trigger");
  const remaining = sql.slice(start).trim();
  if (remaining) statements.push(remaining);
  return statements;
}
export const clinicalMigrationPaths = [
  "backend/migrations/0001_intake.sql",
  "backend/migrations/0002_jeevika_her.sql",
  "backend/migrations/0002_pharmacy.sql",
  "backend/migrations/0003_jeevika_vitalis.sql",
  "backend/migrations/0005_clinic_token_sequences.sql",
  "backend/cbc-migrations/0006_cbc.sql",
  "backend/migrations/0008_phase4.sql",
  "backend/migrations/0009_patient_experience.sql",
  "backend/migrations/0010_clinical_handoffs.sql",
  "backend/migrations/0011_procurement_stock.sql",
  "backend/migrations/0012_authorized_workspaces.sql",
  "backend/migrations/0013_kiosk_speech_cache.sql",
] as const;

export function migrationScripts() {
  return clinicalMigrationPaths.map((path) => readFileSync(path, "utf8"));
}
const patientAuthMigrations = [
  ["backend/migrations", "0006_patient_auth_and_preferences.sql"],
  ["backend/local/migrations", "0007_patient_auth_tenant_foreign_keys.sql"],
] as const;

function migratePatientAuth(db: LocalDatabase) {
  // SQLite checks the old, invalid child foreign key during DROP TABLE when enabled.
  // Re-enable enforcement after the atomic rebuild, and check all new references before committing.
  db.raw.exec("PRAGMA foreign_keys = OFF");
  let began = false;
  try {
    db.raw.exec("BEGIN IMMEDIATE");
    began = true;
    db.raw.exec("CREATE TABLE IF NOT EXISTS standalone_schema_migrations (name TEXT PRIMARY KEY)");
    const applied = db.raw.prepare("SELECT 1 FROM standalone_schema_migrations WHERE name = ?");
    const record = db.raw.prepare("INSERT INTO standalone_schema_migrations(name) VALUES (?)");
    const columns = new Set(db.raw.prepare("PRAGMA table_info(patients)").all().map((column) => column.name));
    for (const [directory, name] of patientAuthMigrations) {
      if (applied.get(name)) continue;
      const script = readFileSync(join(directory, name), "utf8");
      for (const statement of splitSqlScript(script)) {
        // Existing databases may already have received part or all of 0006.
        const column = statement.match(/^ALTER TABLE patients ADD COLUMN (\w+)/m)?.[1];
        if (column && columns.has(column)) continue;
        db.raw.exec(statement);
        if (column) columns.add(column);
      }
      record.run(name);
    }
    for (const table of ["patient_credentials", "patient_sessions", "patient_ayurvedic_profiles", "patient_app_preferences"]) {
      if (db.raw.prepare(`PRAGMA foreign_key_check(${table})`).get())
        throw new Error(`Patient auth migration found an invalid tenant reference in ${table}`);
    }
    db.raw.exec("COMMIT");
  } catch (error) {
    if (began) db.raw.exec("ROLLBACK");
    throw error;
  } finally {
    db.raw.exec("PRAGMA foreign_keys = ON");
  }
}

export function migrateLocal(db: LocalDatabase) {
  // Current scripts are additive/idempotent. Keep the schema files in order.
  for (const script of migrationScripts()) {
    try {
      db.raw.exec(script);
    } catch {
      for (const statement of splitSqlScript(script)) {
        try {
          db.raw.exec(statement);
        } catch {}
      }
    }
  }

  // Ensure clinic_token_sequences table and required columns always exist
  try {
    db.raw.exec(`
      CREATE TABLE IF NOT EXISTS clinic_token_sequences (
        org_id TEXT NOT NULL,
        clinic_id TEXT NOT NULL,
        service_date TEXT NOT NULL,
        last_value INTEGER NOT NULL CHECK (last_value > 0),
        PRIMARY KEY (org_id, clinic_id, service_date)
      );
    `);
  } catch {}
  try { db.raw.exec("ALTER TABLE encounters ADD COLUMN tier INTEGER DEFAULT 0;"); } catch {}
  try { db.raw.exec("ALTER TABLE encounters ADD COLUMN token_number INTEGER;"); } catch {}
  try { db.raw.exec("ALTER TABLE patients ADD COLUMN phone_hash TEXT;"); } catch {}
  try { db.raw.exec("ALTER TABLE patients ADD COLUMN dob TEXT;"); } catch {}
  try { db.raw.exec("ALTER TABLE patients ADD COLUMN sex TEXT;"); } catch {}
  try { db.raw.exec("ALTER TABLE patients ADD COLUMN preferred_lang TEXT;"); } catch {}
  try { db.raw.exec("ALTER TABLE patients ADD COLUMN abha_number TEXT;"); } catch {}
  try { db.raw.exec("ALTER TABLE patients ADD COLUMN abha_address TEXT;"); } catch {}
  try {
    db.raw.exec(`
      INSERT OR IGNORE INTO clinics (org_id, id, name) VALUES 
        ('org-jeevika-primary', 'clinic-delhi-01', 'JEEVIKA Primary Health Centre'),
        ('org-jeevika-primary', 'clinic-delhi-02', 'JEEVIKA Urban Clinic'),
        ('org-jeevika-primary', 'north', 'North Clinic'),
        ('org-jeevika-primary', 'east', 'East Clinic');
    `);
  } catch {}
  migratePatientAuth(db);
}
