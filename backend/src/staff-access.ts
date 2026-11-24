import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import type { ZodType } from "zod";
import type { Principal } from "../../packages/shared/integration";
import type { IntegrationContext } from "./context";
import { clinicalOriginAllowed, validateStaffSession } from "./staff-session";

const bounded = bodyLimit({ maxSize: 32_000 });

export function staffAccess(
  ...roles: Principal["role"][]
): MiddlewareHandler<IntegrationContext> {
  return async (c, next) => {
    const auth = c.req.header("Authorization");
    const session =
      c.env?.DB && auth?.startsWith("Bearer ")
        ? await validateStaffSession(c.env, auth.slice(7))
        : null;
    if (!session)
      throw new HTTPException(401, { message: "Staff session required" });
    if (!roles.includes(session.principal.role))
      throw new HTTPException(403, {
        message: "Operation is outside your access",
      });
    c.header("Cache-Control", "no-store");
    c.set("principal", session.principal);
    if (c.req.method === "GET" || c.req.method === "HEAD") return next();
    if (!clinicalOriginAllowed(c.req.raw, c.env))
      throw new HTTPException(403, { message: "Cross-origin write rejected" });
    return bounded(c, next);
  };
}

export async function staffBody<T>(request: Request, schema: ZodType<T>) {
  const value = schema.safeParse(await request.json().catch(() => null));
  if (!value.success)
    throw new HTTPException(400, { message: "Invalid submitted fields" });
  return value.data;
}
