// Cloudflare Native API client used by the JEEVIKA web ERP.
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

function resolveApiBase(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  // If running on a live web host, never attempt to call localhost/127.0.0.1
  if (typeof window !== "undefined" && !isLocalhost) {
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl.replace(/\/$/, "");
    }
    return "https://jeevika-api.jeevika-health.workers.dev/api/v1";
  }
  return (envUrl || "/api/v1").replace(/\/$/, "");
}

export const CLOUDFLARE_API_BASE = resolveApiBase();

export interface CloudflareResponse<T> {
  data: T | null;
  error: Error | null;
}
