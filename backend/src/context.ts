import type { Principal } from "../../packages/shared/integration";
import type { Database } from "./database";
export type Env = {
  DB: Database;
  ENVIRONMENT: string;
  DEMO_MODE?: string;
  PUBLIC_ORIGIN?: string;
  PLATFORM_SUPER_ADMINS?: string;
  PRUNE_API_KEY?: string;
  PRUNE_BASE_URL?: string;
  PRUNE_MODEL?: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  CBC_DOCUMENTS?: R2Bucket;
  CBC_ENABLED?: string;
  CBC_INFERENCE_ENABLED?: string;
  CBC_MAINTENANCE_ORGS?: string;
  SARVAM_API_KEY?: string;
  SARVAM_SPEECH_ENABLED?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
};
export type IntegrationContext = {
  Bindings: Env;
  Variables: { principal: Principal; requestId: string; cbcSourceAvailable?: boolean };
};
