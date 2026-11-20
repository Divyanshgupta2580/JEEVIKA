import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { build } from "esbuild";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { demoPassword, seedDemo } from "../backend/local/seed";
import {
  cbcFields,
  cbcPredictionSchema,
  cbcReportSchema,
} from "../packages/shared/cbc_contracts";
import {
  encounterSchema,
  loginResponseSchema,
} from "../packages/shared/integration";
import { packSocketDocument, unpackSocketDocument } from "../packages/shared/socket-binary";
import oracle from "../tests/fixtures/cbc/parity.json";

mkdirSync(".local", { recursive: true });
await build({
  stdin: {
    contents: `import {predictCbc} from './packages/engine/cbc/inference';
export default {async fetch(req){return Response.json(predictCbc(await req.json()))}};`,
    resolveDir: process.cwd(),
  },
  outfile: ".local/cbc-inference-worker.mjs",
  bundle: true,
  format: "esm",
  platform: "browser",
});
const oracleWorker = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    scriptPath: ".local/cbc-inference-worker.mjs",
    compatibilityDate: "2026-10-17",
  }),
);
try {
  let largest = 0;
  for (const item of oracle) {
    const response = await oracleWorker.dispatchFetch("http://local/", {
      method: "POST",
      body: JSON.stringify(item.input),
    });
    assert.equal(response.status, 200);
    const result = cbcPredictionSchema.parse(await response.json());
    largest = Math.max(largest, Math.abs(result.score - item.expected.score));
    assert.equal(result.above_cutoff, item.expected.above_cutoff);
    assert.equal(
      result.undefined_ratios_imputed,
      item.expected.undefined_ratios_imputed,
    );
  }
  assert.ok(largest <= 1e-12);
  console.log(
    `PASS: ${oracle.length} Python/workerd cases, maximum absolute score error ${largest}`,
  );
} finally {
  await oracleWorker.dispose();
}

const worker = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    scriptPath: "dist/integration-worker/index.js",
    compatibilityDate: "2026-10-17",
    d1Databases: ["DB"],
    r2Buckets: ["CBC_DOCUMENTS"],
    bindings: { ENVIRONMENT: "test" },
  }),
);
try {
  const db = await worker.getD1Database("DB");
  for (const path of [
    "backend/migrations/0001_intake.sql",
    "backend/cbc-migrations/0006_cbc.sql",
  ])
    await db.batch(
      readFileSync(path, "utf8")
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)
        .map((sql) => db.prepare(sql)),
    );
  await seedDemo(db);
  const auth = await worker.dispatchFetch("http://local/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      orgId: "demo",
      email: "doctor@demo.test",
      password: demoPassword,
    }),
  });
  assert.equal(auth.status, 200);
  const { token } = loginResponseSchema.parse(await auth.json());
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  };
  async function request(path: string, body: unknown) {
    return worker.dispatchFetch(`http://local/api/v1${path}`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
  }
  const intake = await request("/encounters", {
    patient: {
      name: "Synthetic Workerd CBC",
      birthDate: "1980-01-01",
      gender: "female",
      language: "en-IN",
    },
    chiefComplaint: "Synthetic CBC demonstration",
    answers: { chestPain: "no", breathless: "no", fainting: "no" },
    synthetic: true,
    careConsent: true,
  });
  assert.equal(intake.status, 201);
  const encounter = encounterSchema.parse(await intake.json());
  const created = await request("/cbc/reports", {
    encounterId: encounter.id,
    processingConsent: true,
    researchConsent: true,
  });
  assert.equal(created.status, 201);
  const report = cbcReportSchema.parse(await created.json());
  const documentPath = `/cbc/reports/${report.id}/document`;
  const socketUrl = "http://local/api/v1/socket";
  const protocol = "jeevika.data.v1";
  for (const credential of [undefined, "mock-jwt-token"]) {
    const rejected = await worker.dispatchFetch(socketUrl, {
      headers: { Upgrade: "websocket", "Sec-WebSocket-Protocol": credential ? `${protocol}, session.${credential}` : protocol },
    });
    assert.equal(rejected.status, 401);
  }
  const upgraded = await worker.dispatchFetch(socketUrl, {
    headers: { Upgrade: "websocket", "Sec-WebSocket-Protocol": `${protocol}, session.${token}` },
  });
  assert.equal(upgraded.status, 101);
  assert.equal(upgraded.headers.get("Sec-WebSocket-Protocol"), protocol);
  const socket = upgraded.webSocket;
  assert.ok(socket);
  socket.accept();
  async function frame(message: string | ArrayBuffer) {
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket?.removeEventListener("message", onMessage as any);
        reject(new Error("WebSocket response timed out"));
      }, 5000);
      const onMessage = (event: any) => {
        clearTimeout(timer);
        resolve(event.data);
      };
      socket?.addEventListener("message", onMessage as any, { once: true });
      socket?.send(message);
    });
  }
  async function textFrame(message: string | ArrayBuffer) {
    const result = await frame(message);
    assert.equal(typeof result, "string");
    return JSON.parse(String(result)) as { status: number };
  }
  assert.equal((await textFrame(JSON.stringify({ id: "queue", path: "/encounters", method: "GET" }))).status, 200);
  assert.equal((await textFrame(JSON.stringify({ id: "denied", path: "/patients", method: "GET" }))).status, 403);
  const upload = await textFrame(packSocketDocument({
    id: "retain", path: documentPath, method: "PUT", retainSource: true, documentType: "application/pdf",
  }, new TextEncoder().encode("%PDF-1.7\n%synthetic storage boundary fixture").buffer));
  assert.equal(upload.status, 200, JSON.stringify(upload));
  const published = oracle[0];
  assert.ok(published);
  const values = published.input;
  const confirmed = await request(`/cbc/reports/${report.id}/confirm`, {
    expectedRevision: 0,
    measurements: cbcFields.map((field) => ({
      field,
      value: values[field],
      unit: field === "wbc" ? "10^9/L" : field === "rbc" ? "10^12/L" : "%",
      method: "manual",
      page: null,
      evidence: "",
    })),
    collectionDate: null,
    panelReviewed: true,
  });
  assert.equal(confirmed.status, 200);
  const prediction = await request(`/cbc/reports/${report.id}/predict`, {
    revision: 1,
  });
  assert.equal(prediction.status, 200);
  const predicted = cbcReportSchema.parse(await prediction.json()).revisions[0]
    ?.prediction;
  assert.ok(predicted);
  assert.ok(Math.abs(predicted.score - 0.6528833817519397) <= 1e-12);
  const source = await frame(JSON.stringify({ id: "source", path: documentPath, method: "GET" }));
  const buffer = ArrayBuffer.isView(source) ? Uint8Array.from(new Uint8Array(source.buffer, source.byteOffset, source.byteLength)).buffer : source;
  assert.ok(buffer instanceof ArrayBuffer);
  const downloaded = unpackSocketDocument(buffer);
  assert.deepEqual(downloaded.metadata, { id: "source", status: 200, documentType: "application/pdf" });
  assert.ok(new TextDecoder().decode(downloaded.bytes).startsWith("%PDF"));
  const denied = await worker.dispatchFetch(
    `http://local/api/v1/cbc/reports/${report.id}/document`,
  );
  assert.equal(denied.status, 401);
  const removed = await worker.dispatchFetch(
    `http://local/api/v1/cbc/reports/${report.id}`,
    { method: "DELETE", headers },
  );
  assert.equal(removed.status, 200);
  const bucket = await worker.getR2Bucket("CBC_DOCUMENTS");
  assert.equal((await bucket.list()).objects.length, 0);
  const logout = await worker.dispatchFetch("http://local/api/v1/auth/logout", { method: "POST", headers });
  assert.equal(logout.status, 200);
  assert.equal((await textFrame(JSON.stringify({ id: "revoked", path: "/encounters", method: "GET" }))).status, 401);
  socket.close();
  console.log(
    "PASS: actual Worker + authenticated WebSocket + D1 + private R2 upload/download + confirmation + frozen inference + source deletion",
  );
} finally {
  await worker.dispose();
}
