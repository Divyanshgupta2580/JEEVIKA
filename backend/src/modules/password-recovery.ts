import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { incrementAuthLimit } from "../auth-rate";
import type { Env } from "../context";
import { tenantDb } from "../database";
import { newToken, passwordHash, tokenHash } from "../security";

const account = z.enum(["staff", "patient"]);
const orgId = z.string().regex(/^[a-z0-9_-]{1,80}$/);
const resetRequest = z.strictObject({
  account, orgId, email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});
const resetConfirm = z.strictObject({
  account, orgId, token: z.string().regex(/^[0-9a-f-]{72}$/), password: z.string().min(12).max(128),
});
const unavailable = { error: "Password recovery is unavailable. Contact your clinic." };
const accepted = { message: "If a verified recovery email is on file, a reset code will be sent." };
const invalid = { error: "The reset code is invalid or expired." };

export const recoveryRouter = new Hono<{ Bindings: Env }>();
recoveryRouter.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  if (c.req.method !== "GET") {
    const origin = c.req.header("Origin");
    const allowed = (c.env?.PUBLIC_ORIGIN ?? new URL(c.req.url).origin).split(",").map((value) => value.trim());
    const local = ["development", "test"].includes(c.env?.ENVIRONMENT) &&
      origin && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
    if (origin && !local && !allowed.includes(origin)) return c.json({ error: "Request origin is not allowed." }, 403);
  }
  return bodyLimit({ maxSize: 4096 })(c, next);
});
recoveryRouter.onError((_error, c) => c.json(unavailable, 503));
recoveryRouter.get("/capabilities", (c) => c.json({ available: Boolean(c.env?.DB && c.env.PASSWORD_RECOVERY) }));

recoveryRouter.post("/request", async (c) => {
  if (!c.env?.DB || !c.env.PASSWORD_RECOVERY) return c.json(unavailable, 503);
  const input = resetRequest.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: "Enter a valid organization and email." }, 400);
  const body = input.data;
  const client = c.req.header("CF-Connecting-IP") ?? "unknown";
  const globalLimit = tenantDb({ db: c.env.DB, orgId: "system" });
  if (!await incrementAuthLimit(globalLimit, "recovery-request-client", client, 20, 3600000))
    return c.json({ error: "Too many requests. Try again later." }, 429);
  const db = tenantDb({ db: c.env.DB, orgId: body.orgId });
  if (!await incrementAuthLimit(db, `recovery-request-${body.account}`, body.email, 3, 3600000))
    return c.json(accepted, 202);
  const now = new Date();
  const match = await db.statement(
    `SELECT r.account_id AS id,r.email FROM account_recovery_channels r
     WHERE r.org_id=:org AND r.account_kind=? AND lower(r.email)=? AND r.verified_at<=?
      AND ((r.account_kind='staff' AND EXISTS(SELECT 1 FROM users u WHERE u.org_id=r.org_id AND u.id=r.account_id))
        OR (r.account_kind='patient' AND EXISTS(SELECT 1 FROM patient_credentials p
         WHERE p.org_id=r.org_id AND p.patient_id=r.account_id AND p.status='ACTIVE')))`,
    body.account, body.email, now.toISOString(),
  ).first<{ id: string; email: string }>();
  if (!match) return c.json(accepted, 202);
  const token = newToken();
  const digest = await tokenHash(token);
  const expiresAt = new Date(now.getTime() + 15 * 60000).toISOString();
  await db.batch([
    db.statement(`DELETE FROM account_recovery_tokens WHERE org_id=:org AND account_kind=? AND account_id=? AND expires_at<=?`,
      body.account, match.id, now.toISOString()),
    db.statement(`INSERT INTO account_recovery_tokens (org_id,token_hash,account_kind,account_id,expires_at)
      VALUES (:org,?,?,?,?)`, digest, body.account, match.id, expiresAt),
  ]);
  const provider = c.env.PASSWORD_RECOVERY;
  async function deliver() {
    const response = await provider.fetch(new Request("https://password-recovery.internal/deliver", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ email: match?.email, token, account: body.account, orgId: body.orgId, expiresAt }),
    })).catch(() => null);
    if (!response?.ok) await db.statement(
      "DELETE FROM account_recovery_tokens WHERE org_id=:org AND token_hash=?", digest,
    ).run();
  }
  let schedule: ((promise: Promise<void>) => void) | undefined;
  try {
    const context = c.executionCtx;
    schedule = context.waitUntil.bind(context);
  } catch {
    // The in-process application adapter has no Worker execution context.
  }
  if (schedule) schedule(deliver());
  else await deliver();
  return c.json(accepted, 202);
});

recoveryRouter.post("/confirm", async (c) => {
  if (!c.env?.DB || !c.env.PASSWORD_RECOVERY) return c.json(unavailable, 503);
  const input = resetConfirm.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json(invalid, 400);
  const body = input.data;
  const client = c.req.header("CF-Connecting-IP") ?? "unknown";
  const globalLimit = tenantDb({ db: c.env.DB, orgId: "system" });
  if (!await incrementAuthLimit(globalLimit, "recovery-confirm-client", client, 20, 900000))
    return c.json({ error: "Too many requests. Try again later." }, 429);
  const db = tenantDb({ db: c.env.DB, orgId: body.orgId });
  const digest = await tokenHash(body.token);
  const pending = await db.statement(`SELECT account_id FROM account_recovery_tokens
    WHERE org_id=:org AND token_hash=? AND account_kind=? AND expires_at>? AND claim IS NULL`,
    digest, body.account, new Date().toISOString()).first<{ account_id: string }>();
  if (!pending) return c.json(invalid, 400);

  const accountId = pending.account_id;
  const salt = crypto.randomUUID();
  const hash = await passwordHash(body.password, salt);
  const claim = crypto.randomUUID();
  const patient = body.account === "patient";
  const accountsTable = patient ? "patient_credentials" : "users";
  const accountKey = patient ? "patient_id" : "id";
  const active = patient ? "AND status='ACTIVE'" : "";
  const sessionsTable = patient ? "patient_sessions" : "sessions";
  const sessionKey = patient ? "patient_id" : "user_id";
  const writes = await db.batch([
    db.statement(`UPDATE account_recovery_tokens AS t SET claim=? WHERE org_id=:org AND token_hash=?
      AND claim IS NULL AND expires_at>? AND EXISTS(SELECT 1 FROM ${accountsTable}
      WHERE org_id=t.org_id AND ${accountKey}=t.account_id ${active})`, claim, digest, new Date().toISOString()),
    db.statement(`UPDATE ${accountsTable} AS a SET password_hash=?,password_salt=?
      WHERE org_id=:org AND ${accountKey}=? AND EXISTS(SELECT 1 FROM account_recovery_tokens t
      WHERE t.org_id=a.org_id AND t.token_hash=? AND t.claim=?)`, hash, salt, accountId, digest, claim),
    db.statement(`DELETE FROM ${sessionsTable} WHERE org_id=:org AND ${sessionKey}=? AND
      EXISTS(SELECT 1 FROM account_recovery_tokens t WHERE t.org_id=${sessionsTable}.org_id AND t.token_hash=? AND t.claim=?)`, accountId, digest, claim),
    db.statement(`UPDATE account_recovery_tokens AS t SET claim=? WHERE org_id=:org
      AND account_kind=? AND account_id=? AND claim IS NULL AND EXISTS(SELECT 1 FROM account_recovery_tokens c
      WHERE c.org_id=t.org_id AND c.token_hash=? AND c.claim=?)`, claim, body.account, accountId, digest, claim),
    db.statement(`DELETE FROM account_recovery_tokens WHERE org_id=:org AND account_kind=? AND account_id=? AND claim=?`,
      body.account, accountId, claim),
  ]);
  return writes[0]?.meta.changes === 1 && writes[1]?.meta.changes === 1 ?
    c.json({ message: "Password updated. Sign in again with your new password." }) : c.json(invalid, 400);
});
