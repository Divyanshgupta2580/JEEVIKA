import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import type { IntegrationContext } from "../context";
import { clinicalOriginAllowed, validateStaffSession } from "../staff-session";

export function phase4Access(
  surface: "platform" | "redaction" | "ayush",
): MiddlewareHandler<IntegrationContext> {
  return async (c, next) => {
    const authorization = c.req.header("Authorization") ?? "";
    const session =
      c.env?.DB && authorization.startsWith("Bearer ")
        ? await validateStaffSession(c.env, authorization.slice(7))
        : null;
    if (!session)
      throw new HTTPException(401, { message: "Staff session required" });

    const { role } = session.principal;
    const reading = c.req.method === "GET" || c.req.method === "HEAD";
    const allowed =
      surface === "ayush"
        ? role === "DOCTOR"
        : role === "SUPER_ADMIN" ||
          (surface === "platform" && reading && role === "HOSPITAL_ADMIN");
    if (!allowed || (!reading && !clinicalOriginAllowed(c.req.raw, c.env)))
      throw new HTTPException(403, {
        message: "Operation is outside your access",
      });

    c.set("principal", session.principal);
    c.header("Cache-Control", "no-store");
    if (reading) await next();
    else return bodyLimit({ maxSize: 32000 })(c, next);
  };
}

export async function phase4Body<T>(
  request: Request,
  schema: import("zod").ZodType<T>,
): Promise<T> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    throw new HTTPException(400, { message: "Invalid request data" });
  return parsed.data;
}
