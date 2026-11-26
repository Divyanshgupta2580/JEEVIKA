import { useEffect, useState, useSyncExternalStore } from "react";
import { CLOUDFLARE_API_BASE } from "./api";
import { closeDataSocket } from "./dataSocket";

const key = "jeevika_patient_session_v1";
const sessionChanged = "jeevika-patient-session-changed";
export type PatientSession = { patientId: string; expiresAt: string };

export function patientToken() {
  return sessionStorage.getItem(key);
}
export function setPatientToken(token: string | null) {
  const previous = patientToken();
  if (previous === token) return;
  if (previous) closeDataSocket(previous);
  if (token) sessionStorage.setItem(key, token);
  else sessionStorage.removeItem(key);
  window.dispatchEvent(new Event(sessionChanged));
}

function subscribeToPatientSession(listener: () => void) {
  window.addEventListener(sessionChanged, listener);
  return () => window.removeEventListener(sessionChanged, listener);
}

export function usePatientSessionToken() {
  return useSyncExternalStore(subscribeToPatientSession, patientToken);
}

export class PatientApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function patientRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    token?: string | null;
    signal?: AbortSignal;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const response = await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
    method: options.method,
    signal: options.signal,
    cache: "no-store",
    headers: {
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.idempotencyKey
        ? { "Idempotency-Key": options.idempotencyKey }
        : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    if (response.status === 401 && options.token && patientToken() === options.token) {
      setPatientToken(null);
    }
    const body: unknown = await response.json().catch(() => null);
    const apiError =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : null;
    const statusMessage =
      response.status === 401
        ? "The session or verification code is invalid or expired."
        : response.status === 429
          ? "Too many requests. Wait a few minutes and try again."
          : response.status === 409
            ? "This record was already submitted."
            : response.status === 400
              ? "Check the entered information and try again."
              : response.status === 403
                ? "Access is unavailable for this request."
                : "The service is unavailable. Try again.";
    throw new PatientApiError(response.status, apiError ?? statusMessage);
  }
  return response.json() as Promise<T>;
}

export function usePatientData<T>(
  path: string,
  revision = 0,
  authenticated = true,
) {
  const [result, setResult] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    const controller = new AbortController();
    setResult({});
    const token = authenticated ? patientToken() : null;
    patientRequest<T>(path, { token, signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ data });
      },
      (error: Error) => {
        if (controller.signal.aborted) return;
        setResult({ error: error.message });
      },
    );
    return () => controller.abort();
  }, [path, revision, authenticated]);
  return result;
}
