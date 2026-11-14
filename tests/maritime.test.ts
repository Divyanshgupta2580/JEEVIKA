import { describe, expect, it } from "vitest";
import { app } from "../backend/src/index";

describe("Maritime Autonomous Agent Cloud Integration (VIHAAN-X Special Challenge)", () => {
  it("returns Maritime cluster status with Scale Plan tier and 3 active agents", async () => {
    const res = await app.request("http://127.0.0.1/api/v1/maritime/status");
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.provider).toBe("Maritime Cloud");
    expect(data.participantCode).toBe("VIHAANX");
    expect(data.tier).toContain("Scale Plan");
    expect(data.activeAgentsCount).toBe(3);
    expect(data.agents.length).toBe(3);
    expect(data.agents.map((a: any) => a.id)).toContain("agent-sentinel-01");
  });

  it("executes Jeevika-Clinical-Sentinel agent to audit herb-drug interactions", async () => {
    const res = await app.request("http://127.0.0.1/api/v1/maritime/agents/agent-sentinel-01/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        drugs: [{ medicineName: "Warfarin", dosage: "5mg" }],
        herbs: [{ drug: "Guggulu (Commiphora mukul)" }]
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.agent.id).toBe("agent-sentinel-01");
    expect(data.safetyStatus).toBe("WARNING");
    expect(data.result.interactionsFound).toBeGreaterThanOrEqual(1);
    expect(data.latencyMs).toBeGreaterThan(0);
  });

  it("executes Jeevika-Vernacular-Scribe agent to normalize Indic speech", async () => {
    const res = await app.request("http://127.0.0.1/api/v1/maritime/agents/agent-vernacular-02/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: "Mujhe seene me dard shuru ho gaya aur paseena aa raha hai",
        language: "hi-IN"
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.result.soapEncounter.subjective).toContain("seene me dard");
    expect(data.result.redFlags.length).toBeGreaterThan(0);
  });

  it("executes Jeevika-Supply-Optimizer agent for Jan Aushadhi generic substitution", async () => {
    const res = await app.request("http://127.0.0.1/api/v1/maritime/agents/agent-supply-03/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.result.savingsPercentage).toContain("85");
  });

  it("executes full-mesh tri-agent concurrent audit", async () => {
    const res = await app.request("http://127.0.0.1/api/v1/maritime/mesh/audit-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientName: "Ramesh Chandra (52M)" })
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.swarmSummary.sentinelAgent.status).toBe("COMPLETED");
    expect(data.swarmSummary.scribeAgent.status).toBe("COMPLETED");
    expect(data.swarmSummary.supplyAgent.status).toBe("COMPLETED");
  });

  it("retrieves live telemetry logs stream", async () => {
    const res = await app.request("http://127.0.0.1/api/v1/maritime/telemetry");
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.logs.length).toBeGreaterThanOrEqual(3);
  });
});
