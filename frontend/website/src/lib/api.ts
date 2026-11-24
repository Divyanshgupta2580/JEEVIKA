// Cloudflare Native API client used by the JEEVIKA web ERP.
const isPagesDev =
  typeof window !== "undefined" &&
  window.location.hostname.endsWith("pages.dev");

const defaultApiUrl = isPagesDev
  ? "https://jeevika-api.jeevika-health.workers.dev/api/v1"
  : "/api/v1";

export const CLOUDFLARE_API_BASE = (
  import.meta.env.VITE_API_URL || defaultApiUrl
).replace(/\/$/, "");

export interface CloudflareResponse<T> {
  data: T | null;
  error: Error | null;
}
