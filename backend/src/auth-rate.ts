import type { tenantDb } from "./database";
import { tokenHash } from "./security";

export async function incrementAuthLimit(
  db: ReturnType<typeof tenantDb>, purpose: string, identity: string, maximum: number, windowMs: number,
) {
  const now = new Date();
  const at = now.toISOString();
  const result = await db.statement(
    `INSERT INTO login_attempts (org_id,key_hash,attempts,window_end) VALUES (:org,?,1,?)
     ON CONFLICT(org_id,key_hash) DO UPDATE SET
       attempts=CASE WHEN window_end<=? THEN 1 ELSE MIN(attempts+1,?) END,
       window_end=CASE WHEN window_end<=? THEN excluded.window_end ELSE window_end END
     RETURNING attempts`,
    await tokenHash(`${purpose}:${identity}`), new Date(now.getTime() + windowMs).toISOString(),
    at, maximum + 1, at,
  ).first<{ attempts: number }>();
  return !!result && result.attempts <= maximum;
}
