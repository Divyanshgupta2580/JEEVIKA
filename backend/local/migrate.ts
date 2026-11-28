import { readFileSync } from "node:fs";
import { basename } from "node:path";
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
  "backend/migrations/0014_durable_accounts.sql",
  "backend/migrations/0015_kiosk_consent_withdrawals.sql",
  "backend/migrations/0016_clinical_prescription_review.sql",
] as const;

export function migrationScripts() {
  return clinicalMigrationPaths.map((path) => readFileSync(path, "utf8"));
}
// Early standalone databases used a patient-only parent key. Worker deployments
// on the canonical manifest never used that schema. Keep its repair local.
function repairLegacyPatientReferences(db: LocalDatabase) {
  const hasLegacyKey = db.raw.prepare("PRAGMA foreign_key_list(patient_credentials)").all()
    .some((column) => column.from === "patient_id" && column.to === "id") &&
    !db.raw.prepare("PRAGMA foreign_key_list(patient_credentials)").all()
      .some((column) => column.from === "org_id");
  if (!hasLegacyKey) return;
  db.raw.exec("PRAGMA foreign_keys = OFF");
  try {
    db.raw.exec("BEGIN IMMEDIATE");
    db.raw.exec(readFileSync("backend/local/migrations/0007_patient_auth_tenant_foreign_keys.sql", "utf8"));
    for (const table of ["patient_credentials", "patient_sessions", "patient_ayurvedic_profiles", "patient_app_preferences"]) {
      if (db.raw.prepare(`PRAGMA foreign_key_check(${table})`).get())
        throw new Error(`Invalid patient reference in ${table}`);
    }
    db.raw.exec("COMMIT");
  } catch (error) {
    db.raw.exec("ROLLBACK");
    throw error;
  } finally {
    db.raw.exec("PRAGMA foreign_keys = ON");
  }
}

export function migrateLocal(db: LocalDatabase) {
  db.raw.exec("CREATE TABLE IF NOT EXISTS standalone_schema_migrations (name TEXT PRIMARY KEY)");
  repairLegacyPatientReferences(db);
  const applied = db.raw.prepare("SELECT 1 FROM standalone_schema_migrations WHERE name = ?");
  const record = db.raw.prepare("INSERT INTO standalone_schema_migrations(name) VALUES (?)");
  for (const path of clinicalMigrationPaths) {
    const name = basename(path);
    if (applied.get(name)) continue;
    db.raw.exec("BEGIN IMMEDIATE");
    try {
      for (const sql of splitSqlScript(readFileSync(path, "utf8"))) {
        // Older standalone installations already have some or all of 0014's columns.
        const column = sql.match(/^ALTER TABLE (patients|encounters) ADD COLUMN (\w+)/m);
        if (column && db.raw.prepare(`PRAGMA table_info(${column[1]})`).all()
          .some((item) => item.name === column[2])) continue;
        db.raw.exec(sql);
      }
      record.run(name);
      db.raw.exec("COMMIT");
    } catch (error) {
      db.raw.exec("ROLLBACK");
      throw new Error(`Migration failed: ${name}`, { cause: error });
    }
  }
  db.raw.exec(`
    INSERT OR IGNORE INTO clinics (org_id, id, name) VALUES
      ('org-jeevika-primary', 'clinic-delhi-01', 'JEEVIKA Primary Health Centre'),
      ('org-jeevika-primary', 'clinic-delhi-02', 'JEEVIKA Urban Clinic'),
      ('org-jeevika-primary', 'north', 'North Clinic'),
      ('org-jeevika-primary', 'east', 'East Clinic');
  `);
}
