import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { phase4Fixture } from "./phase4-fixture";

let fixture: Awaited<ReturnType<typeof phase4Fixture>>;
let superAdmin: string;
let hospitalAdmin: string;
let doctor: string;

beforeAll(async () => {
  fixture = await phase4Fixture();
  const [admin, hospital, clinician] = await Promise.all([
    fixture.login("admin"),
    fixture.login("admin", "other-org"),
    fixture.login("doctor"),
  ]);
  expect(admin.principal.role).toBe("SUPER_ADMIN");
  expect(hospital.principal.role).toBe("HOSPITAL_ADMIN");
  superAdmin = admin.token;
  hospitalAdmin = hospital.token;
  doctor = clinician.token;
});
afterAll(() => fixture.db.close());

describe("Swarm Mesh", () => {
  it("requires a verified staff session and restricts reads to authorized roles", async () => {
    expect((await fixture.request("/maritime/status")).status).toBe(401);
    expect(
      (await fixture.request("/maritime/status", { token: doctor })).status,
    ).toBe(403);
    expect(
      (await fixture.request("/maritime/status", { token: hospitalAdmin }))
        .status,
    ).toBe(200);
    expect(
      (
        await fixture.request("/maritime/mesh/audit-all", {
          token: hospitalAdmin,
          method: "POST",
          body: { mode: "simulation" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fixture.request("/maritime/mesh/audit-all", {
          token: superAdmin,
          method: "POST",
          body: { mode: "simulation" },
          origin: "https://unrelated.example",
        })
      ).status,
    ).toBe(403);
  });

  it("reports unverified live status honestly and records scoped simulation findings", async () => {
    const initial = await fixture.request("/maritime/status", {
      token: superAdmin,
    });
    expect(initial.status).toBe(200);
    expect(await initial.json()).toMatchObject({
      status: "UNAVAILABLE",
      agents: expect.arrayContaining([
        expect.objectContaining({
          id: "agent-sentinel-01",
          status: "UNAVAILABLE",
          simulation: null,
        }),
        expect.objectContaining({
          id: "agent-vernacular-02",
          status: "UNAVAILABLE",
          simulation: null,
        }),
        expect.objectContaining({
          id: "agent-supply-03",
          status: "UNAVAILABLE",
          simulation: null,
        }),
      ]),
    });

    const run = await fixture.request("/maritime/mesh/audit-all", {
      token: superAdmin,
      method: "POST",
      body: { mode: "simulation" },
    });
    expect(run.status).toBe(201);
    expect(await run.json()).toEqual({ source: "SIMULATION", checksRun: 3 });
    const logs = await fixture.request("/maritime/telemetry", {
      token: superAdmin,
    });
    expect(await logs.json()).toEqual({
      source: "SIMULATION",
      logs: expect.arrayContaining([
        expect.objectContaining({ agent_id: "agent-sentinel-01", findings: 1 }),
        expect.objectContaining({
          agent_id: "agent-vernacular-02",
          findings: expect.any(Number),
        }),
        expect.objectContaining({
          agent_id: "agent-supply-03",
          findings: expect.any(Number),
        }),
      ]),
    });
    const updated = await fixture.request("/maritime/status", {
      token: superAdmin,
    });
    expect(await updated.json()).toMatchObject({
      status: "UNAVAILABLE",
      agents: expect.arrayContaining([
        expect.objectContaining({
          simulation: expect.objectContaining({ runs: 1 }),
        }),
      ]),
    });
    const foreign = await fixture.request("/maritime/telemetry", {
      token: hospitalAdmin,
    });
    expect(await foreign.json()).toEqual({ source: "SIMULATION", logs: [] });
  });

  it("requires exact agent IDs and refuses arbitrary simulation input", async () => {
    expect(
      (
        await fixture.request("/maritime/agents/sentinel/run", {
          token: superAdmin,
          method: "POST",
          body: { mode: "simulation" },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await fixture.request("/maritime/agents/agent-sentinel-01/run", {
          token: superAdmin,
          method: "POST",
          body: { mode: "simulation", transcript: "Confidential data fixture" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fixture.request("/maritime/agents/agent-sentinel-01/run", {
          token: superAdmin,
          method: "POST",
          body: { mode: "simulation" },
        })
      ).status,
    ).toBe(201);
  });
});
