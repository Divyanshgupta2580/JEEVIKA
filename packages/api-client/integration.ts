import { z } from "zod";
import {
  encounterListSchema,
  encounterSchema,
  intakeSchema,
  loginResponseSchema,
  loginSchema,
  principalSchema,
} from "../shared/integration";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export type DataRequest = (
  path: string,
  method: string,
  body?: unknown,
  key?: string,
) => Promise<{ status: number; body?: unknown }>;

export function integrationClient(
  token = "",
  transport: typeof fetch = fetch,
  dataRequest?: DataRequest,
) {
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
  ): Promise<unknown> {
    let status: number;
    let data: unknown;
    if (path.startsWith("/auth/")) {
      const response = await transport(`/api/v1${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      status = response.status;
      data = await response.json();
    } else {
      if (!dataRequest)
        throw new ApiError("Authenticated data connection required", 401);
      const response = await dataRequest(path, method, body, key);
      status = response.status;
      data = response.body;
    }
    if (status < 200 || status >= 300) {
      const error = z
        .object({ error: z.object({ message: z.string() }) })
        .safeParse(data);
      throw new ApiError(
        error.success ? error.data.error.message : `Request failed (${status})`,
        status,
      );
    }
    return data;
  }
  return {
    login: async (input: z.infer<typeof loginSchema>) =>
      loginResponseSchema.parse(
        await request("/auth/login", "POST", loginSchema.parse(input)),
      ),
    me: async () => principalSchema.parse(await request("/auth/me")),
    logout: () => request("/auth/logout", "POST"),
    encounters: async () =>
      encounterListSchema.parse(await request("/encounters")),
    encounter: async (id: string) =>
      encounterSchema.parse(
        await request(`/encounters/${encodeURIComponent(id)}`),
      ),
    intake: async (input: z.infer<typeof intakeSchema>, key: string) =>
      encounterSchema.parse(
        await request("/encounters", "POST", intakeSchema.parse(input), key),
      ),
    review: (id: string, note: string) =>
      request(`/encounters/${encodeURIComponent(id)}/review`, "POST", { note }),
    revoke: (id: string) =>
      request(`/encounters/${encodeURIComponent(id)}/revoke`, "POST"),
  };
}
