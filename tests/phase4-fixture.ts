import { LocalDatabase } from "../backend/local/database";
import { migrateLocal } from "../backend/local/migrate";
import { demoPassword, seedDemo } from "../backend/local/seed";
import type { Env } from "../backend/src/context";
import { app } from "../backend/src/index";
import { loginResponseSchema } from "../packages/shared/integration";

export async function phase4Fixture() {
  const db = new LocalDatabase();
  migrateLocal(db);
  await seedDemo(db);
  const env: Env = {
    DB: db,
    ENVIRONMENT: "test",
    PLATFORM_SUPER_ADMINS: "demo/admin",
  };
  async function request(
    path: string,
    {
      token,
      method = "GET",
      body,
      bindings = {},
      origin,
      idempotencyKey,
    }: {
      token?: string;
      method?: string;
      body?: unknown;
      bindings?: Partial<Env>;
      origin?: string;
      idempotencyKey?: string | null;
    } = {},
  ) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (body !== undefined && idempotencyKey !== null)
      headers.set("Idempotency-Key", idempotencyKey ?? crypto.randomUUID());
    if (origin) headers.set("Origin", origin);
    return app.request(
      `http://127.0.0.1/api/v1${path}`,
      {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      { ...env, ...bindings },
    );
  }
  async function login(user: string, orgId = "demo") {
    const response = await request("/auth/login", {
      method: "POST",
      body: { orgId, email: `${user}@demo.test`, password: demoPassword },
    });
    if (!response.ok)
      throw new Error(`Login failed for ${user}: ${response.status}`);
    return loginResponseSchema.parse(await response.json());
  }
  return { db, request, login };
}
