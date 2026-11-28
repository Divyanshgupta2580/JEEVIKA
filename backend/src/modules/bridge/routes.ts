import { Hono } from "hono";
import { rxToShelf, threadPulse } from "../../../../packages/engine";
import { demoPlan } from "../../../../packages/shared/demo";
import { threadPulseCohort } from "../continuity/refills";

export const bridgeRouter = new Hono();

bridgeRouter.post("/rx2shelf/plan", async (c) => {
  let input: unknown = null;
  try {
    input = await c.req.json();
  } catch {
    // If empty body, fallback to canonical demo plan
    input = demoPlan();
  }

  // If input lacks required fields, fallback to demo plan
  if (!input || typeof input !== "object" || !("prescription" in input)) {
    input = demoPlan();
  }

  const result = rxToShelf(input);
  return c.json({
    planId: "plan_" + Date.now(),
    status: result.plans.length > 0 ? "READY_FOR_DISPENSE" : "BLOCKED_OR_UNAVAILABLE",
    result,
    timestamp: new Date().toISOString()
  });
});

bridgeRouter.post("/rx2shelf", async (c) => {
  const body = await c.req.json();
  return c.json(rxToShelf(body));
});

bridgeRouter.route("/threadpulse/hazard", threadPulseCohort);

bridgeRouter.post("/threadpulse", async (c) => {
  const body = await c.req.json();
  return c.json(threadPulse(body));
});

