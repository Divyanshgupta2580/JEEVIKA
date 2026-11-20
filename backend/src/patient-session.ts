import type { Env } from "./context";
import { tenantDb } from "./db/tenant";
import { newToken, sessionOrgId, tokenHash } from "./security";

type PatientSession = { orgId: string; patientId: string; expiresAt: string };
// Only sessions issued with no durable record belong in this cache.
const memorySessions = new Map<string, PatientSession>();

function allowsMemorySession(env: Env | undefined) {
  return !env || ["development", "test"].includes(env.ENVIRONMENT);
}

export async function issuePatientSession(
  env: Env | undefined,
  orgId: string,
  patientId: string,
  syntheticOnly = false,
) {
  const token = `${orgId}.pat.${newToken()}`;
  if (!sessionOrgId(token, "patient")) return null;
  if (syntheticOnly && !allowsMemorySession(env)) return null;

  const hash = await tokenHash(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  if (env?.DB && !syntheticOnly) {
    try {
      await tenantDb(env.DB as unknown as D1Database, { orgId }).patientAuth.createSession({
        tokenHash: hash, patientId, expiresAt,
      });
      return { token, expiresAt };
    } catch {
      if (!allowsMemorySession(env)) return null;
    }
  }
  if (!allowsMemorySession(env)) return null;
  memorySessions.set(hash, { orgId, patientId, expiresAt });
  return { token, expiresAt };
}

export async function validatePatientSession(env: Env | undefined, token: string): Promise<PatientSession | null> {
  const orgId = sessionOrgId(token, "patient");
  if (!orgId) return null;
  const hash = await tokenHash(token);
  if (allowsMemorySession(env)) {
    const local = memorySessions.get(hash);
    if (local && local.orgId === orgId) {
      if (Date.parse(local.expiresAt) > Date.now()) return local;
      memorySessions.delete(hash);
      return null;
    }
  }
  if (!env?.DB) return null;
  try {
    const row = await tenantDb(env.DB as unknown as D1Database, { orgId }).patientAuth.validateSession(hash);
    return row && Date.parse(row.expires_at) > Date.now()
      ? { orgId, patientId: row.patient_id, expiresAt: row.expires_at }
      : null;
  } catch (error) {
    if (!allowsMemorySession(env)) throw error;
    return null;
  }
}

export async function revokePatientSession(env: Env | undefined, token: string) {
  const orgId = sessionOrgId(token, "patient");
  if (!orgId) return;
  const hash = await tokenHash(token);
  if (allowsMemorySession(env) && memorySessions.delete(hash)) return;
  if (env?.DB) {
    await tenantDb(env.DB as unknown as D1Database, { orgId }).patientAuth.deleteSession(hash);
  }
}
