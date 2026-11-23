import type { Principal } from "../../packages/shared/integration";
import type { Env } from "./context";
import { tenantDb } from "./database";
import { sessionOrgId, tokenHash } from "./security";

export function clinicalOriginAllowed(request: Request, env?: Env) {
  const origin = request.headers.get("Origin");
  return origin === null || origin === (env?.PUBLIC_ORIGIN ?? new URL(request.url).origin) ||
    (env?.ENVIRONMENT !== "production" && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin));
}

export async function validateStaffSession(env: Env, token: string) {
  const orgId = sessionOrgId(token, "staff");
  if (!orgId) return null;
  const row = await tenantDb({ db: env.DB, orgId })
    .statement(
      `SELECT u.id, u.clinic_id, u.role, s.expires_at FROM sessions s
      JOIN users u ON u.org_id = s.org_id AND u.id = s.user_id
      WHERE s.org_id = :org AND s.token_hash = ? AND s.expires_at > ?`,
      await tokenHash(token),
      new Date().toISOString(),
    )
    .first<{ id: string; clinic_id: string; role: Principal["role"]; expires_at: string }>();
  if (!row || !(Date.parse(row.expires_at) > Date.now())) return null;
  const principal: Principal = { orgId, userId: row.id, clinicId: row.clinic_id, role: row.role };
  return { principal, expiresAt: row.expires_at };
}
