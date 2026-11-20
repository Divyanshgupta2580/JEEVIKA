import { z } from "zod";
import { maxSocketMetadataBytes, packSocketDocument, unpackSocketDocument } from "../../packages/shared/socket-binary";
import type { Env } from "./context";
import { validatePatientSession } from "./patient-session";
import { sessionOrgId } from "./security";
import { clinicalOriginAllowed, validateStaffSession } from "./staff-session";

export const dataProtocol = "jeevika.data.v1";
export const dataSocketPath = "/api/v1/socket";

const eventId = z.string().min(1).max(80);
const eventIdEnvelope = z.object({ id: eventId });
const eventSchema = z.strictObject({
  id: eventId,
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  path: z.string().min(1).max(2048),
  // Frames already passed JSON.parse. Avoid recursively walking untrusted JSON here.
  body: z.unknown().optional(),
  documentType: z.enum(["application/pdf", "image/png", "image/jpeg"]).optional(),
  retainSource: z.literal(true).optional(),
  key: z.string().min(1).max(120).regex(/^[\w.-]+$/).optional(),
});

const clinicalPaths: Record<string, RegExp> = {
  GET: /^\/(?:encounters(?:\/[\w-]+)?|cbc\/(?:capabilities|reports(?:\/[\w-]+)?))$/,
  POST: /^\/(?:encounters(?:\/[\w-]+\/(?:review|revoke))?|cbc\/reports(?:\/[\w-]+\/(?:confirm|predict))?)$/,
  DELETE: /^\/cbc\/reports\/[\w-]+$/,
};
const documentPath = /^\/cbc\/reports\/[\w-]+\/document$/;
const patientPath = /^\/patient\/([\w-]+)\/(profile|preferences|ayurveda)$/;
const patientWebOrigins = new Set(["https://ayuseva.pages.dev", "https://dhaaga-web.pages.dev"]);

export type SocketDocumentBudget = { active: number; limit: number };

type Dispatch<Bindings> = (request: Request, env: Bindings) => Response | Promise<Response>;
type Reply = { frame: string | ArrayBuffer; endSession?: boolean };
type HandleMessage = (raw: unknown) => Promise<Reply>;

function errorReply(id: string | null, status: number, message: string): Reply {
  return {
    frame: JSON.stringify({ id, status, body: { error: { code: `HTTP_${status}`, message } } }),
    endSession: status === 401,
  };
}

function readFrame(raw: unknown) {
  if (typeof raw === "string" && raw.length <= maxSocketMetadataBytes &&
      new TextEncoder().encode(raw).length <= maxSocketMetadataBytes) {
    return { metadata: JSON.parse(raw) as unknown, bytes: undefined };
  }
  if (raw instanceof ArrayBuffer) return unpackSocketDocument(raw);
  throw new Error("Invalid WebSocket frame");
}

export async function authorizeDataSocket<Bindings extends Env>(
  request: Request,
  env: Bindings,
  dispatch: Dispatch<Bindings>,
  documentBudget?: SocketDocumentBudget,
): Promise<HandleMessage | null> {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== dataSocketPath || url.search ||
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return null;

  const protocols = request.headers.get("Sec-WebSocket-Protocol")?.split(",").map((value) => value.trim());
  if (protocols?.length !== 2 || !protocols.includes(dataProtocol)) return null;
  const credential = protocols.find((value) => value.startsWith("session."));
  if (!credential) return null;
  const token = credential.slice("session.".length);
  const isPatient = sessionOrgId(token, "patient") !== null;
  if (!isPatient && !sessionOrgId(token, "staff")) return null;

  const origin = request.headers.get("Origin");
  if (!clinicalOriginAllowed(request, env) && !(isPatient && !env.PUBLIC_ORIGIN && origin && patientWebOrigins.has(origin))) return null;

  const patient = isPatient ? await validatePatientSession(env, token) : null;
  const session = isPatient ? patient : await validateStaffSession(env, token);
  if (!session) return null;
  const expiresAt = Date.parse(session.expiresAt);
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  if (origin) headers.set("Origin", origin);

  let inFlight = 0;
  let documentInFlight = false;
  let ended = false;

  return async (raw) => {
    let id: string | null = null;
    const expire = () => {
      ended = true;
      return errorReply(id, 401, "Session expired or revoked");
    };
    try {
      let input: ReturnType<typeof readFrame>;
      try {
        input = readFrame(raw);
      } catch {
        return ended || expiresAt <= Date.now()
          ? expire()
          : errorReply(null, 400, "Invalid WebSocket frame");
      }
      const suppliedId = eventIdEnvelope.safeParse(input.metadata);
      if (suppliedId.success) id = suppliedId.data.id;
      if (ended || expiresAt <= Date.now()) return expire();

      const parsed = eventSchema.safeParse(input.metadata);
      if (!parsed.success) return errorReply(id, 400, "Invalid WebSocket request");
      const { method, path, body, key, documentType, retainSource } = parsed.data;
      const { bytes } = input;
      const [pathname] = path.split("?", 1);
      if (!pathname || !pathname.startsWith("/") || /[\u0000-\u0020\u007f#\\]/.test(path) ||
          (method === "GET" && body !== undefined)) {
        return errorReply(id, 400, "Invalid WebSocket request path or body");
      }
      const target = new URL(`/api/v1${path}`, url);
      if (target.pathname !== `/api/v1${pathname}`) return errorReply(id, 400, "Invalid WebSocket request path");

      const document = documentPath.test(pathname) && (method === "GET" || method === "PUT");
      if ((bytes && (!document || method !== "PUT" || !documentType || !retainSource || body !== undefined)) ||
          (!bytes && (documentType || retainSource || (document && method === "PUT")))) {
        return errorReply(id, 400, "Invalid WebSocket document");
      }

      if (patient) {
        const match = patientPath.exec(pathname);
        if (match?.[1] !== patient.patientId || path !== pathname || !["GET", "PUT"].includes(method))
          return errorReply(id, 403, "WebSocket operation denied");
      } else if (!document && !clinicalPaths[method]?.test(pathname)) {
        return errorReply(id, 403, "WebSocket operation denied");
      }

      if (inFlight >= 16 || (document && (documentInFlight ||
          (documentBudget && documentBudget.active >= documentBudget.limit))))
        return errorReply(id, 429, "Too many pending WebSocket requests");
      inFlight++;
      if (document) {
        documentInFlight = true;
        if (documentBudget) documentBudget.active++;
      }
      try {
        // Capabilities are public over HTTP. The socket still requires a live session.
        if (pathname === "/cbc/capabilities" && !await validateStaffSession(env, token)) return expire();
        const outgoing = new Headers(headers);
        if (body !== undefined) outgoing.set("Content-Type", "application/json");
        if (bytes && documentType) {
          outgoing.set("Content-Type", documentType);
          outgoing.set("X-Source-Retention-Consent", "true");
        }
        if (key) outgoing.set("Idempotency-Key", key);
        // Dispatch through REST so role, clinic, tenant, consent, and ownership are read afresh.
        const response = await dispatch(new Request(target, {
          method,
          headers: outgoing,
          body: bytes ?? (body === undefined ? undefined : JSON.stringify(body)),
        }), env);
        if (response.status === 401 || ended || expiresAt <= Date.now()) return expire();
        // The CBC feature gate can respond before staff authentication runs.
        if (response.status === 503 && pathname.startsWith("/cbc/") && !await validateStaffSession(env, token))
          return expire();
        if (document && method === "GET" && response.ok) {
          const frame = await response.arrayBuffer();
          if (ended || expiresAt <= Date.now()) return expire();
          return { frame: packSocketDocument({
            id,
            status: response.status,
            documentType: response.headers.get("Content-Type"),
          }, frame) };
        }
        const payload: unknown = await response.json().catch(() => undefined);
        if (ended || expiresAt <= Date.now()) return expire();
        if (payload === undefined && !response.ok) return errorReply(id, response.status, "WebSocket request failed");
        return { frame: JSON.stringify({ id, status: response.status, body: payload }) };
      } finally {
        inFlight--;
        if (document) {
          documentInFlight = false;
          if (documentBudget) documentBudget.active--;
        }
      }
    } catch {
      return errorReply(id, 503, "WebSocket request unavailable");
    }
  };
}

export async function deliverDataSocketMessage(
  handle: HandleMessage,
  read: () => unknown,
  socket: {
    readonly readyState: number;
    send(frame: string | ArrayBuffer): void;
    close(code: number, reason: string): void;
  },
) {
  let response: Reply;
  try {
    response = await handle(read());
  } catch {
    response = errorReply(null, 503, "WebSocket request unavailable");
  }
  try {
    if (socket.readyState !== 1) return;
    socket.send(response.frame);
    if (response.endSession) socket.close(1008, "Session expired or revoked");
  } catch {
    try {
      socket.close(1011, "WebSocket delivery failed");
    } catch {
      // The peer may already have closed.
    }
  }
}
