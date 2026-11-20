const encoder = new TextEncoder();
export async function tokenHash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function newToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function equalHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

const sessionSecret = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export function sessionOrgId(token: string, scope: "staff" | "patient"): string | null {
  if (token.length > 160) return null;
  const parts = token.split(".");
  const [orgId, scopeOrSecret] = parts;
  const secret = scope === "patient" ? parts[2] : scopeOrSecret;
  const orgPattern = scope === "patient" ? /^[a-z0-9_-]{1,80}$/ : /^[a-z0-9-]{1,80}$/;
  if (!orgId || !orgPattern.test(orgId) || secret?.length !== 72) return null;
  if (scope === "patient" ? parts.length !== 3 || scopeOrSecret !== "pat" : parts.length !== 2) return null;
  return sessionSecret.test(secret.slice(0, 36)) && sessionSecret.test(secret.slice(36)) ? orgId : null;
}
