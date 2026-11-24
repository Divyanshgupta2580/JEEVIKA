import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { redact } from "../../../../packages/ai/gateway";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { phase4Access, phase4Body } from "../phase4-access";

const wafRules = [
  {
    category: "Prompt injection",
    pattern:
      /ignore (?:previous|all|the) (?:instructions|rules|guidelines)|jailbreak|act as an unconstrained/i,
  },
  {
    category: "Unauthorized clinical override",
    pattern:
      /prescribe (?:morphine|fentanyl|oxycodone|ketamine|alprazolam) (?:without|directly|immediately)|system override/i,
  },
  {
    category: "System prompt extraction",
    pattern:
      /(?:reveal|show|print) (?:your |the )?(?:system prompt|hidden instructions)/i,
  },
  {
    category: "Policy violation",
    pattern: /forget (?:your|medical) (?:role|regulations)/i,
  },
];
const safeFallback = "Request stopped by the clinical prompt firewall.";
const gatewayCheckPrompt =
  "Explain how to confirm or reschedule a clinic appointment without including personal details.";
const text = z.string().trim().min(1).max(4000);
const chatInput = z.object({
  prompt: text.optional(),
  message: text.optional(),
});
const previewInput = z
  .object({
    text,
    identifiers: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  })
  .strict();
const providerResponse = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string().trim().min(1).max(5000) }),
    }),
  ),
  prune_metadata: z
    .object({
      cache_hit: z.boolean().optional(),
      cache_type: z.string().optional(),
    })
    .optional(),
});

type GatewayContext = Context<IntegrationContext>;

function scopedDb(c: GatewayContext) {
  return tenantDb({ db: c.env.DB, orgId: c.get("principal").orgId });
}

function logEvent(
  c: GatewayContext,
  event: string,
  start: number,
  simulated = false,
) {
  return scopedDb(c)
    .statement(
      "INSERT INTO prune_gateway_events (org_id, id, occurred_at, event, latency_ms, simulated) VALUES (:org, ?, ?, ?, ?, ?)",
      crypto.randomUUID(),
      new Date().toISOString(),
      event,
      Math.round(performance.now() - start),
      Number(simulated),
    )
    .run();
}

function configured(c: GatewayContext) {
  return Boolean(c.env.PRUNE_API_KEY);
}

function redactPreview(input: string, identifiers: string[]) {
  return redact(
    input,
    [...identifiers].sort((a, b) => b.length - a.length),
  ).replace(/\b(?:\+91[-\s]?)?[6-9]\d{9}\b/g, "[IDENTIFIER]");
}

export const pruneRouter = new Hono<IntegrationContext>();
const platformAccess = phase4Access("platform");
pruneRouter.get("/status", platformAccess, async (c) => {
  const metrics = await scopedDb(c)
    .statement(
      `SELECT COUNT(*) AS requests,
        COALESCE(SUM(event IN ('local-cache-hit', 'upstream-cache-hit')), 0) AS hits,
        COALESCE(SUM(event LIKE 'waf:%'), 0) AS blocks,
        ROUND(AVG(latency_ms)) AS average_latency_ms
     FROM prune_gateway_events WHERE org_id = :org AND simulated = 0`,
    )
    .first<{
      requests: number;
      hits: number;
      blocks: number;
      average_latency_ms: number | null;
    }>();
  return c.json({
    provider: "Prune AI",
    configured: configured(c),
    requests: metrics?.requests ?? 0,
    cacheHits: metrics?.hits ?? 0,
    wafBlocks: metrics?.blocks ?? 0,
    averageLatencyMs: metrics?.average_latency_ms ?? null,
    measuredSavingsPaise: null,
  });
});

pruneRouter.get("/cache", platformAccess, async (c) => {
  const summary = await scopedDb(c)
    .statement(
      "SELECT COUNT(*) AS entries, MAX(created_at) AS last_cached_at FROM prune_gateway_cache WHERE org_id = :org",
    )
    .first<{ entries: number; last_cached_at: string | null }>();
  return c.json({
    entries: summary?.entries ?? 0,
    lastCachedAt: summary?.last_cached_at ?? null,
  });
});

pruneRouter.delete("/cache", platformAccess, async (c) => {
  const db = scopedDb(c);
  const [, result] = await db.batch([
    db.statement(`INSERT INTO prune_cache_generation (org_id, generation) VALUES (:org, 1)
      ON CONFLICT(org_id) DO UPDATE SET generation = generation + 1`),
    db.statement("DELETE FROM prune_gateway_cache WHERE org_id = :org"),
  ]);
  return c.json({ cleared: result?.meta.changes ?? 0 });
});

pruneRouter.get("/telemetry", platformAccess, async (c) => {
  const { results } = await scopedDb(c)
    .statement(
      `SELECT id, occurred_at, event, latency_ms, simulated
     FROM prune_gateway_events WHERE org_id = :org ORDER BY occurred_at DESC, id DESC LIMIT 50`,
    )
    .all();
  return c.json({ logs: results });
});

pruneRouter.get("/waf", platformAccess, async (c) => {
  const { results } = await scopedDb(c)
    .statement(
      `SELECT id, occurred_at, substr(event, instr(event, ':') + 1) AS category, latency_ms, simulated
     FROM prune_gateway_events
     WHERE org_id = :org AND (event LIKE 'waf:%' OR event LIKE 'test:%')
     ORDER BY occurred_at DESC, id DESC LIMIT 50`,
    )
    .all();
  return c.json({
    events: results,
    rules: wafRules.map(({ category }) => category),
    fallback: safeFallback,
  });
});

pruneRouter.post("/firewall/simulate-injection", platformAccess, async (c) => {
  await phase4Body(c.req.raw, z.strictObject({}));
  const start = performance.now();
  const rule = wafRules.find(({ pattern }) => pattern.test("system override"));
  await logEvent(c, `test:${rule?.category ?? "No detection"}`, start, true);
  return c.json({
    simulated: true,
    blocked: Boolean(rule),
    category: rule?.category ?? null,
  });
});

pruneRouter.post("/redaction/preview", phase4Access("redaction"), async (c) => {
  const { text: source, identifiers } = await phase4Body(
    c.req.raw,
    previewInput,
  );
  const sanitized = redactPreview(source, identifiers);
  return c.json({ sanitized, changed: sanitized !== source });
});

async function gatewayChat(c: GatewayContext, prompt: string | undefined) {
  const start = performance.now();
  if (!prompt) throw new HTTPException(400, { message: "Prompt is required" });

  const rule = wafRules.find(({ pattern }) => pattern.test(prompt));
  if (rule) {
    await logEvent(c, `waf:${rule.category}`, start);
    return c.json(
      { blocked: true, verdict: "BLOCKED_INJECTION", reason: safeFallback },
      403,
    );
  }

  // Only the fixed, non-clinical availability check is approved for external processing.
  // Regex masking by itself cannot de-identify arbitrary clinical free text.
  if (prompt !== gatewayCheckPrompt || !configured(c)) {
    return c.json(
      { error: "Upstream processing is unavailable for this request." },
      503,
    );
  }

  const db = scopedDb(c);
  const model = c.env.PRUNE_MODEL || "gemini/gemini-3.5-flash-lite";
  const cacheState = await db
    .statement(
      `WITH tenant(org_id) AS (SELECT :org)
     SELECT COALESCE(g.generation, 0) AS generation, cache.response FROM tenant
     LEFT JOIN prune_cache_generation g USING (org_id)
     LEFT JOIN prune_gateway_cache cache ON cache.org_id = tenant.org_id AND cache.model = ?`,
      model,
    )
    .first<{ generation: number; response: string | null }>();
  if (cacheState?.response) {
    await logEvent(c, "local-cache-hit", start);
    return c.json({
      success: true,
      cached: true,
      response: cacheState.response,
      gateway: "JEEVIKA edge cache",
    });
  }

  let data: z.infer<typeof providerResponse>;
  try {
    const baseUrl = (
      c.env.PRUNE_BASE_URL || "https://api.withprune.com/v1"
    ).replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.PRUNE_API_KEY}`,
        "Content-Type": "application/json",
        "X-Prune-Cache": "semantic",
      },
      signal: AbortSignal.timeout(3800),
      redirect: "error",
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
      }),
    });
    if (!response.ok) throw new Error("Provider unavailable");
    data = providerResponse.parse(await response.json());
    if (!data.choices[0]) throw new Error("Empty provider response");
  } catch {
    await logEvent(c, "upstream-unavailable", start);
    return c.json({ error: "Prune did not return a usable response." }, 503);
  }

  const response = data.choices[0].message.content;
  const cached = Boolean(
    data.prune_metadata?.cache_hit || data.prune_metadata?.cache_type === "hit",
  );
  await db
    .statement(
      `WITH tenant(org_id) AS (SELECT :org)
     INSERT INTO prune_gateway_cache (org_id, model, response, created_at)
     SELECT tenant.org_id, ?, ?, ? FROM tenant
     LEFT JOIN prune_cache_generation g USING (org_id)
     WHERE COALESCE(g.generation, 0) = ?
     ON CONFLICT(org_id, model) DO UPDATE SET response = excluded.response, created_at = excluded.created_at`,
      model,
      response,
      new Date().toISOString(),
      cacheState?.generation ?? 0,
    )
    .run();
  await logEvent(c, cached ? "upstream-cache-hit" : "upstream-response", start);
  return c.json({ success: true, cached, response, gateway: "Prune AI" });
}

pruneRouter.post("/gateway/chat", platformAccess, async (c) => {
  const body = await phase4Body(c.req.raw, chatInput);
  return gatewayChat(c, body.prompt ?? body.message);
});
pruneRouter.post("/gateway/check", platformAccess, (c) =>
  gatewayChat(c, gatewayCheckPrompt),
);
