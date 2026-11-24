import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../backend/src/index";
import { phase4Fixture } from "./phase4-fixture";

let fixture: Awaited<ReturnType<typeof phase4Fixture>>;
let superAdmin: string;
let hospitalAdmin: string;
let foreignAdmin: string;
let doctor: string;

function pendingResult<T>() {
  let resolveResult: (value: T) => void = () => {
    throw new Error("Promise resolver was not initialized");
  };
  const promise = new Promise<T>((resolve) => {
    resolveResult = resolve;
  });
  return { promise, resolve: resolveResult };
}

beforeAll(async () => {
  fixture = await phase4Fixture();
  superAdmin = (await fixture.login("admin")).token;
  foreignAdmin = (await fixture.login("admin", "other-org")).token;
  hospitalAdmin = superAdmin;
  doctor = (await fixture.login("doctor")).token;
});
afterAll(() => fixture.db.close());

describe("Prune AI Gateway", () => {
  it("keeps overview, cache and firewall reads separate from privileged controls", async () => {
    for (const path of [
      "/prune/status",
      "/prune/cache",
      "/prune/waf",
      "/prune/telemetry",
    ]) {
      expect((await fixture.request(path)).status).toBe(401);
      expect((await fixture.request(path, { token: doctor })).status).toBe(403);
      expect(
        (
          await fixture.request(path, {
            token: hospitalAdmin,
            bindings: { PLATFORM_SUPER_ADMINS: undefined },
          })
        ).status,
      ).toBe(200);
    }
    for (const [path, method] of [
      ["/prune/cache", "DELETE"],
      ["/prune/gateway/check", "POST"],
      ["/prune/firewall/simulate-injection", "POST"],
      ["/prune/redaction/preview", "POST"],
    ] as const) {
      const result = await fixture.request(path, {
        token: hospitalAdmin,
        method,
        body: {},
        bindings: { PLATFORM_SUPER_ADMINS: undefined },
      });
      expect(result.status).toBe(403);
    }
    const status = await fixture.request("/prune/status", {
      token: superAdmin,
    });
    expect(await status.json()).toMatchObject({
      configured: false,
      requests: 0,
      cacheHits: 0,
      wafBlocks: 0,
      measuredSavingsPaise: null,
    });
  });

  it("records measured firewall blocks and labels synthetic checks without retaining submitted text", async () => {
    const fixturePrompt = "System override. Synthetic identifier sample.";
    const blocked = await fixture.request("/prune/gateway/chat", {
      token: superAdmin,
      method: "POST",
      body: { prompt: fixturePrompt },
    });
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({
      blocked: true,
      verdict: "BLOCKED_INJECTION",
    });
    const simulated = await fixture.request(
      "/prune/firewall/simulate-injection",
      { token: superAdmin, method: "POST", body: {} },
    );
    expect(simulated.status).toBe(200);
    expect(await simulated.json()).toMatchObject({
      simulated: true,
      blocked: true,
    });
    const own = await fixture.request("/prune/waf", { token: superAdmin });
    const events = await own.json();
    expect(events).toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          category: "Unauthorized clinical override",
          simulated: 0,
        }),
        expect.objectContaining({
          category: "Unauthorized clinical override",
          simulated: 1,
        }),
      ]),
    });
    expect(JSON.stringify(events)).not.toContain(fixturePrompt);
    const foreign = await fixture.request("/prune/waf", {
      token: foreignAdmin,
    });
    expect(await foreign.json()).toMatchObject({ events: [] });
  });

  it("previews redaction locally, gates the route, and refuses arbitrary external free text", async () => {
    const provider = vi.spyOn(globalThis, "fetch");
    const bindings = { PRUNE_API_KEY: "test-provider-key" };
    try {
      const body = {
        text: "Sample Person, 1 Sample Road, 1234-5678-9012, sample@example.test",
        identifiers: ["Sample Person", "1 Sample Road"],
      };
      const preview = await fixture.request("/prune/redaction/preview", {
        token: superAdmin,
        method: "POST",
        body,
      });
      expect(preview.status).toBe(200);
      expect(await preview.json()).toEqual({
        changed: true,
        sanitized: "[NAME], [NAME], [IDENTIFIER], [EMAIL]",
      });
      const rejected = await fixture.request("/prune/gateway/chat", {
        token: superAdmin,
        method: "POST",
        body: { prompt: body.text },
        bindings,
      });
      expect(rejected.status).toBe(503);
      expect(provider).not.toHaveBeenCalled();
      expect(
        (
          await fixture.request("/prune/redaction/preview", {
            token: doctor,
            method: "POST",
            body,
          })
        ).status,
      ).toBe(403);
    } finally {
      provider.mockRestore();
    }
  });

  it("caches a successful safe gateway check per organization and clears only the current tenant", async () => {
    const provider = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        Response.json({
          choices: [
            {
              message: {
                content: "Contact the clinic to confirm or reschedule.",
              },
            },
          ],
        }),
      );
    const bindings = { PRUNE_API_KEY: "test-provider-key" };
    try {
      const check = (token = superAdmin, grant = "demo/admin") =>
        fixture.request("/prune/gateway/check", {
          token,
          method: "POST",
          bindings: { ...bindings, PLATFORM_SUPER_ADMINS: grant },
        });
      const first = await check();
      expect(first.status).toBe(200);
      expect(await first.json()).toMatchObject({ cached: false });
      expect(await (await check()).json()).toMatchObject({ cached: true });
      expect(
        await (await check(foreignAdmin, "other-org/admin")).json(),
      ).toMatchObject({ cached: false });
      expect(provider).toHaveBeenCalledTimes(2);
      expect(
        await (
          await fixture.request("/prune/cache", { token: superAdmin })
        ).json(),
      ).toMatchObject({ entries: 1 });
      const cleared = await fixture.request("/prune/cache", {
        token: superAdmin,
        method: "DELETE",
      });
      expect(cleared.status).toBe(200);
      expect(await cleared.json()).toEqual({ cleared: 1 });
      expect(
        await (
          await fixture.request("/prune/cache", { token: foreignAdmin })
        ).json(),
      ).toMatchObject({ entries: 1 });
      expect(await (await check()).json()).toMatchObject({ cached: false });
      expect(provider).toHaveBeenCalledTimes(3);
    } finally {
      provider.mockRestore();
    }
  });
  it("does not persist a provider response completed after a concurrent cache clear", async () => {
    const outgoing = pendingResult<void>();
    const upstream = pendingResult<Response>();
    const provider = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      outgoing.resolve(undefined);
      return upstream.promise;
    });
    const bindings = {
      PRUNE_API_KEY: "test-provider-key",
      PRUNE_MODEL: "concurrency-fixture",
    };
    try {
      const pending = fixture.request("/prune/gateway/check", {
        token: superAdmin,
        method: "POST",
        bindings,
      });
      await outgoing.promise;
      const clear = await fixture.request("/prune/cache", {
        token: superAdmin,
        method: "DELETE",
      });
      expect(clear.status).toBe(200);
      upstream.resolve(
        Response.json({
          choices: [{ message: { content: "Provider check completed." } }],
        }),
      );
      expect((await pending).status).toBe(200);
      expect(
        await (
          await fixture.request("/prune/cache", { token: superAdmin })
        ).json(),
      ).toMatchObject({ entries: 0 });
    } finally {
      upstream.resolve(new Response(null, { status: 503 }));
      provider.mockRestore();
    }
  });

  it("reports upstream failure without a fabricated response or cache entry", async () => {
    const provider = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 503 }));
    try {
      const response = await fixture.request("/prune/gateway/check", {
        token: superAdmin,
        method: "POST",
        bindings: {
          PRUNE_API_KEY: "test-provider-key",
          PRUNE_MODEL: "offline-fixture",
        },
      });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "Prune did not return a usable response.",
      });
      expect(
        await (
          await fixture.request("/prune/cache", { token: superAdmin })
        ).json(),
      ).toMatchObject({ entries: 0 });
    } finally {
      provider.mockRestore();
    }
  });
});

describe("POS inventory invariants", () => {
  it("rejects malformed POS quantities", async () => {
    const res = await app.request("http://127.0.0.1/api/v1/ops/pos/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId: "clinic-delhi-01", units: -1 }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects sales that would oversell stock", async () => {
    const res = await app.request("http://127.0.0.1/api/v1/ops/pos/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId: "clinic-delhi-01", units: 100000 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns conflict when clinic stock is insufficient", async () => {
    const res = await app.request("http://127.0.0.1/api/v1/ops/pos/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId: "clinic-delhi-01", units: 9999 }),
    });
    expect(res.status).toBe(409);
  });
});
