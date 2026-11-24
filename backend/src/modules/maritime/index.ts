import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getClinicalRedFlags } from "../../../../packages/engine/clinicalIntake";
import { checkHerbDrugInteractions } from "../../../../packages/engine/herbDrugInteractions";
import { rxToShelf } from "../../../../packages/engine";
import { demoPlan } from "../../../../packages/shared/demo";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { phase4Access, phase4Body } from "../phase4-access";

const agents = [
  {
    id: "agent-sentinel-01",
    name: "Clinical Safety Sentinel",
    description: "Prescription and herb–drug interaction monitoring",
  },
  {
    id: "agent-vernacular-02",
    name: "Vernacular Scribing Sentinel",
    description: "Indic transcript and clinical terminology monitoring",
  },
  {
    id: "agent-supply-03",
    name: "Supply Chain Sentinel",
    description: "Stock availability and batch expiry monitoring",
  },
] as const;

const simulationRequest = z.object({ mode: z.literal("simulation") }).strict();
type AgentId = (typeof agents)[number]["id"];
type Activity = {
  id: string;
  agent_id: AgentId;
  occurred_at: string;
  latency_ms: number;
  findings: number;
};

function runCheck(agentId: AgentId) {
  switch (agentId) {
    case "agent-sentinel-01":
      return checkHerbDrugInteractions(["Warfarin"], ["Guggulu"]).length;
    case "agent-vernacular-02":
      return getClinicalRedFlags(
        "Mujhe seene me dard ho raha hai aur paseena aa raha hai",
      ).length;
    case "agent-supply-03": {
      const result = rxToShelf(demoPlan());
      return result.rejected.length;
    }
  }
}

export const maritimeRouter = new Hono<IntegrationContext>();
maritimeRouter.use("*", phase4Access("platform"));

maritimeRouter.get("/status", async (c) => {
  const db = tenantDb({ db: c.env.DB, orgId: c.get("principal").orgId });
  const { results } = await db
    .statement(
      `SELECT agent_id, COUNT(*) AS runs, SUM(findings) AS findings, MAX(occurred_at) AS last_run
     FROM swarm_activity WHERE org_id = :org GROUP BY agent_id`,
    )
    .all<{
      agent_id: AgentId;
      runs: number;
      findings: number;
      last_run: string;
    }>();
  return c.json({
    provider: "Maritime Cloud",
    status: "UNAVAILABLE",
    agents: agents.map((agent) => ({
      ...agent,
      status: "UNAVAILABLE",
      simulation: results.find((row) => row.agent_id === agent.id) ?? null,
    })),
  });
});

maritimeRouter.get("/telemetry", async (c) => {
  const { results } = await tenantDb({
    db: c.env.DB,
    orgId: c.get("principal").orgId,
  })
    .statement(
      "SELECT id, agent_id, occurred_at, latency_ms, findings FROM swarm_activity WHERE org_id = :org ORDER BY occurred_at DESC, id DESC LIMIT 50",
    )
    .all<Activity>();
  return c.json({ source: "SIMULATION", logs: results });
});

maritimeRouter.post("/mesh/audit-all", async (c) => {
  await phase4Body(c.req.raw, simulationRequest);
  const db = tenantDb({ db: c.env.DB, orgId: c.get("principal").orgId });
  await db.batch(
    agents.map(({ id }) => {
      const start = performance.now();
      const findings = runCheck(id);
      return db.statement(
        "INSERT INTO swarm_activity (org_id, id, agent_id, occurred_at, latency_ms, findings) VALUES (:org, ?, ?, ?, ?, ?)",
        crypto.randomUUID(),
        id,
        new Date().toISOString(),
        Math.round(performance.now() - start),
        findings,
      );
    }),
  );
  return c.json({ source: "SIMULATION", checksRun: agents.length }, 201);
});

maritimeRouter.post("/agents/:agentId/run", async (c) => {
  const agent = agents.find(({ id }) => id === c.req.param("agentId"));
  if (!agent) throw new HTTPException(404, { message: "Agent unavailable" });
  await phase4Body(c.req.raw, simulationRequest);
  const start = performance.now();
  const findings = runCheck(agent.id);
  await tenantDb({ db: c.env.DB, orgId: c.get("principal").orgId })
    .statement(
      "INSERT INTO swarm_activity (org_id, id, agent_id, occurred_at, latency_ms, findings) VALUES (:org, ?, ?, ?, ?, ?)",
      crypto.randomUUID(),
      agent.id,
      new Date().toISOString(),
      Math.round(performance.now() - start),
      findings,
    )
    .run();
  return c.json({ source: "SIMULATION", agentId: agent.id, findings }, 201);
});
