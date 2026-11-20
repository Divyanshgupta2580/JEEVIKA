import type { Env } from "./context";
import { tenantDb } from "./db/tenant";
import { tokenHash } from "./security";

export const memorySessions = new Map<string, { orgId: string; patientId: string; expiresAt: string }>();

export async function validatePatientSession(env: Env, token: string) {
  const match = /^([a-z0-9_-]{1,80})\.pat\.[a-f0-9-]{72}$/.exec(token);
  const orgId = match?.[1];
  if (!orgId) return null;
  const hash = await tokenHash(token);
  if (env?.DB) {
    const development = ["development", "test"].includes(env.ENVIRONMENT);
    try {
      const row = await tenantDb(env.DB as unknown as D1Database, { orgId })
        .patientAuth.validateSession(hash);
      if (row && Date.parse(row.expires_at) > Date.now()) {
        return { orgId, patientId: row.patient_id, expiresAt: row.expires_at };
      }
    } catch (error) {
      if (!development) throw error;
    }
    if (!development) return null;
  }

  const session = memorySessions.get(hash);
  if (!session || session.orgId !== orgId || Date.parse(session.expiresAt) <= Date.now()) return null;
  return session;
}

