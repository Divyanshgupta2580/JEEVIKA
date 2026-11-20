import { z } from "zod";
import { maxSocketMetadataBytes, packSocketDocument, unpackSocketDocument } from "../../packages/shared/socket-binary";
import type { Env } from "./context";
import { validatePatientSession } from "./patient-session";

export const dataProtocol = "jeevika.data.v1";
export const dataSocketPath = "/api/v1/socket";

const eventSchema = z.strictObject({
  id: z.string().min(1).max(80),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  path: z.string().max(2048),
  body: z.json().optional(),
  documentType: z.enum(["application/pdf", "image/png", "image/jpeg"]).optional(),
  retainSource: z.literal(true).optional(),
  key: z.string().min(1).max(120).regex(/^[\w.-]+$/).optional(),
});

const clinicalPaths: Record<string, RegExp> = {
  GET: /^\/(?:encounters(?:\/[\w-]+)?|cbc\/(?:capabilities|reports))$/,
  POST: /^\/(?:encounters(?:\/[\w-]+\/(?:review|revoke))?|cbc\/reports(?:\/[\w-]+\/(?:confirm|predict))?)$/,
  DELETE: /^\/cbc\/reports\/[\w-]+$/,
};
const documentPath = /^\/cbc\/reports\/[\w-]+\/document$/;
const patientPath = /^\/patient\/([\w-]+)\/(profile|preferences|ayurveda)$/;
type Dispatch<Bindings> = (request: Request, env: Bindings) => Response | Promise<Response>;

export async function authorizeDataSocket<Bindings extends Env>(request: Request, env: Bindings, dispatch: Dispatch<Bindings>) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin && ![
    "https://ayuseva.pages.dev",
    "https://dhaaga-web.pages.dev",
  ].includes(origin)) return null;
  if (url.search || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return null;

  const protocols = request.headers.get("Sec-WebSocket-Protocol")?.split(",").map((value) => value.trim());
  const credential = protocols?.find((value) => value.startsWith("session."));
  const token = credential?.slice("session.".length);
  if (!protocols?.includes(dataProtocol) || !token || !/^[\w.-]{1,300}$/.test(token)) return null;

  const headers = { Authorization: `Bearer ${token}` };
  const patientSession = token.split(".")[1] === "pat"
    ? await validatePatientSession(env, token)
    : null;
  if (!patientSession) {
    const response = await dispatch(new Request(new URL("/api/v1/auth/me", url), { headers }), env);
    if (!response.ok) return null;
  }

  let inFlight = 0;
  let documentInFlight = false;
  return async (raw: unknown): Promise<string | ArrayBuffer> => {
    let input: unknown;
    let bytes: ArrayBuffer | undefined;
    try {
      if (typeof raw === "string" && raw.length <= maxSocketMetadataBytes &&
          new TextEncoder().encode(raw).length <= maxSocketMetadataBytes) {
        input = JSON.parse(raw);
      } else if (raw instanceof ArrayBuffer) {
        ({ metadata: input, bytes } = unpackSocketDocument(raw));
      } else {
        return JSON.stringify({ status: 400 });
      }
    } catch {
      return JSON.stringify({ status: 400 });
    }
    const parsed = eventSchema.safeParse(input);
    if (!parsed.success) return JSON.stringify({ status: 400 });
    const { id, method, path, body, key, documentType, retainSource } = parsed.data;
    const reply = (status: number, payload?: unknown) => JSON.stringify({ id, status, body: payload });
    const [pathname] = path.split("?", 1);
    if (!pathname || path.includes("#") || (method === "GET" && body !== undefined)) return reply(400);

    const document = documentPath.test(pathname) && (method === "GET" || method === "PUT");
    if (bytes && (!document || method !== "PUT" || !documentType || !retainSource || body !== undefined))
      return reply(400);
    if (!bytes && (documentType || retainSource || (document && method === "PUT"))) return reply(400);

    if (inFlight >= 16 || (document && documentInFlight)) return reply(429);
    inFlight++;
    if (document) documentInFlight = true;
    try {
      const outgoing = new Headers(headers);
      if (patientSession) {
        const match = patientPath.exec(pathname);
        if (match?.[1] !== patientSession.patientId || path !== pathname || !["GET", "PUT"].includes(method))
          return reply(403);
        // The profile router checks the bearer session again before dispatching.
      } else if (!document && !clinicalPaths[method]?.test(pathname)) {
        return reply(403);
      }
      if (pathname === "/cbc/capabilities") {
        const session = await dispatch(new Request(new URL("/api/v1/auth/me", url), { headers }), env);
        if (!session.ok) return reply(session.status);
      }
      if (body !== undefined) outgoing.set("Content-Type", "application/json");
      if (bytes && documentType && retainSource) {
        outgoing.set("Content-Type", documentType);
        outgoing.set("X-Source-Retention-Consent", "true");
      }
      if (key) outgoing.set("Idempotency-Key", key);
      const response = await dispatch(new Request(new URL(`/api/v1${path}`, url), {
        method,
        headers: outgoing,
        body: bytes ?? (body === undefined ? undefined : JSON.stringify(body)),
      }), env);
      if (document && method === "GET" && response.ok) {
        return packSocketDocument({
          id,
          status: response.status,
          documentType: response.headers.get("Content-Type"),
        }, await response.arrayBuffer());
      }
      const payload: unknown = await response.json().catch(() => undefined);
      return reply(response.status, payload);
    } catch {
      return reply(503);
    } finally {
      inFlight--;
      if (document) documentInFlight = false;
    }
  };
}
