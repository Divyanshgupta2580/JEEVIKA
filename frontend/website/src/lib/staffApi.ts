import { useEffect, useState } from "react";
import { CLOUDFLARE_API_BASE } from "./api";
import { authService } from "./authService";

export async function staffApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const session = await authService.getSession();
  options.signal?.throwIfAborted();
  if (!session) throw new Error("Sign in again to continue.");
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (options.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 401) authService.invalidateSession(session.access_token);
    const message =
      response.status === 403
        ? "You do not have access to this operation."
        : response.status === 404
          ? "This record is unavailable."
          : response.status === 409
            ? "The case changed. Reopen it before saving."
            : response.status === 400
              ? "Check the submitted fields and try again."
              : response.status === 401
                ? "Sign in again to continue."
                : "The service is unavailable. Try again.";
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function useStaffData<T>(path: string, revision = 0) {
  const [result, setResult] = useState<{ path: string; revision: number; data?: T; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    staffApi<T>(path, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ path, revision, data });
      },
      (error: Error) => {
        if (!controller.signal.aborted) setResult({ path, revision, error: error.message });
      },
    );
    return () => controller.abort();
  }, [path, revision]);
  return result?.path === path && result.revision === revision ? result : {};
}
