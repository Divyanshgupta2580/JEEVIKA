// Cloudflare Native API client used by the JEEVIKA web ERP.
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const defaultApiUrl = isLocalhost
  ? "/api/v1"
  : "https://jeevika-api.jeevika-health.workers.dev/api/v1";

export const CLOUDFLARE_API_BASE = (
  import.meta.env.VITE_API_URL || defaultApiUrl
).replace(/\/$/, "");

export interface CloudflareResponse<T> {
  data: T | null;
  error: Error | null;
}
