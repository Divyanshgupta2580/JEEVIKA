import { z } from "zod";
import {
  type CbcMeasurement,
  cbcCapabilitiesSchema,
  cbcListSchema,
  cbcReportSchema,
} from "../../../../../packages/shared/cbc_contracts";
import {
  encounterListSchema,
  loginResponseSchema,
  principalSchema,
} from "../../../../../packages/shared/integration";
import { CLOUDFLARE_API_BASE } from "../../lib/api";
import { closeDataSocket, socketRequest } from "../../lib/dataSocket";

export type DoctorSession = z.infer<typeof loginResponseSchema>;
export const sessionKey = "jeevika.cbc.doctor-session.v1";
function expireCurrentSession(token?: string) {
  if (!token) return;
  closeDataSocket(token);
  try {
    const raw = sessionStorage.getItem(sessionKey);
    const current = raw
      ? z.object({ token: z.string() }).parse(JSON.parse(raw))
      : null;
    if (current?.token === token) {
      sessionStorage.removeItem(sessionKey);
      window.dispatchEvent(new Event("cbc-session-expired"));
    }
  } catch {
    sessionStorage.removeItem(sessionKey);
  }
}
export async function call<T>(
  path: string,
  schema: { parse(value: unknown): T },
  token?: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
  key?: string,
): Promise<T> {
  if (token && path === "/auth/logout") closeDataSocket(token);
  const overSocket = token && (path === "/encounters" || path.startsWith("/cbc/"));
  const response = overSocket
    ? await socketRequest(token, path, method, body, signal, body === undefined ? undefined : key ?? crypto.randomUUID())
    : await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
    method,
    signal,
    cache: "no-store",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "Idempotency-Key": key ?? crypto.randomUUID(),
          }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status >= 400) {
    if (response.status === 401) {
      expireCurrentSession(token);
    }
    const message =
      response.status === 401
        ? "Clinical session expired. Connect again."
        : response.status === 403
          ? "Doctor access or processing permission required."
          : response.status === 404
            ? "Authorized consented report or encounter not found."
            : response.status === 409
              ? "This report changed. Reload before continuing."
              : response.status === 422
                ? "Check all five values, units and differential total."
                : response.status === 429
                  ? "Request limit reached. Retry in a minute."
                  : "CBC service unavailable. Your consultation notes are unchanged.";
    throw new Error(message);
  }
  return schema.parse("json" in response ? await response.json() : response.body);
}
export const cbcApi = {
  available: (signal?: AbortSignal) =>
    call("/auth/clinical", z.object({ enabled: z.boolean() }), undefined, "GET", undefined, signal),
  capabilities: (token: string, signal?: AbortSignal) =>
    call("/cbc/capabilities", cbcCapabilitiesSchema, token, "GET", undefined, signal),
  login: (orgId: string, email: string, password: string) =>
    call("/auth/login", loginResponseSchema, undefined, "POST", {
      orgId,
      email,
      password,
    }),
  me: (token: string) => call("/auth/me", principalSchema, token),
  encounters: (token: string, signal?: AbortSignal) =>
    call("/encounters", encounterListSchema, token, "GET", undefined, signal),
  list: (
    token: string,
    encounterId: string,
    signal?: AbortSignal,
    cursor?: string,
  ) =>
    call(
      `/cbc/reports?encounterId=${encodeURIComponent(encounterId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      cbcListSchema,
      token,
      "GET",
      undefined,
      signal,
    ),
  create: (
    token: string,
    encounterId: string,
    researchConsent: boolean,
    key: string,
    signal?: AbortSignal,
  ) =>
    call(
      "/cbc/reports",
      cbcReportSchema,
      token,
      "POST",
      { encounterId, processingConsent: true, researchConsent },
      signal,
      key,
    ),
  confirm: (
    token: string,
    id: string,
    expectedRevision: number,
    measurements: CbcMeasurement[],
    collectionDate: string | null,
    key: string,
    signal?: AbortSignal,
  ) =>
    call(
      `/cbc/reports/${id}/confirm`,
      cbcReportSchema,
      token,
      "POST",
      { expectedRevision, measurements, collectionDate, panelReviewed: true },
      signal,
      key,
    ),
  predict: (token: string, id: string, revision: number, signal?: AbortSignal) =>
    call(`/cbc/reports/${id}/predict`, cbcReportSchema, token, "POST", { revision }, signal),
  remove: (token: string, id: string, signal?: AbortSignal) =>
    call(
      `/cbc/reports/${id}`,
      z.object({
        deleted: z.boolean(),
        sourceCleanupPending: z.boolean().optional(),
      }),
      token,
      "DELETE",
      undefined,
      signal,
    ),
  async retain(token: string, id: string, file: File, mime: string, signal?: AbortSignal) {
    const bytes = await file.arrayBuffer();
    const res = await socketRequest(token, `/cbc/reports/${id}/document`, "PUT", undefined, signal, undefined, { bytes, type: mime });
    if (res.status === 401) expireCurrentSession(token);
    if (res.status < 200 || res.status >= 300)
      throw new Error(
        "Original file was not retained. Retry or save measurements without the original.",
      );
    return cbcReportSchema.parse(res.body);
  },
  async source(token: string, id: string, signal?: AbortSignal) {
    const res = await socketRequest(token, `/cbc/reports/${id}/document`, "GET", undefined, signal);
    if (res.status === 401) expireCurrentSession(token);
    if (res.status !== 200 || !res.bytes || !res.documentType)
      throw new Error("Original source is unavailable or access was revoked.");
    return new Blob([res.bytes], { type: res.documentType });
  },
};
