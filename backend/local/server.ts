try {
  (process as any).loadEnvFile?.();
} catch {}

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { authorizeDataSocket, dataProtocol, dataSocketPath, deliverDataSocketMessage } from "../src/data-socket";
import { maxSocketFrameBytes, maxSocketMetadataBytes } from "../../packages/shared/socket-binary";
import { app } from "../src/index";
import { LocalDatabase } from "./database";
import { migrateLocal } from "./migrate";
import { seedDemo } from "./seed";

const mode = process.env.INTEGRATION_ENVIRONMENT ??
  (process.env.NODE_ENV === "production" ? "production" : "development");
if (mode !== "production" && mode !== "development" && mode !== "test")
  throw new Error("Invalid INTEGRATION_ENVIRONMENT");
const publicOrigin = process.env.INTEGRATION_PUBLIC_ORIGIN || undefined;
if (mode === "production" && !publicOrigin)
  throw new Error("INTEGRATION_PUBLIC_ORIGIN is required in production");
if (publicOrigin) {
  const url = new URL(publicOrigin);
  if (url.origin !== publicOrigin || url.protocol !== "https:")
    throw new Error("INTEGRATION_PUBLIC_ORIGIN must be a canonical HTTPS origin");
}
mkdirSync(".local", { recursive: true });
const db = new LocalDatabase(
  resolve(process.env.INTEGRATION_DB ?? ".local/integration.sqlite"),
);
migrateLocal(db);
if (mode !== "production") await seedDemo(db);
const assetsDirectory = process.env.INTEGRATION_ASSETS_DIR ?? "dist/integration";
const assets = new Hono();
assets.use("*", serveStatic({ root: assetsDirectory }));
assets.get("*", serveStatic({ path: `${assetsDirectory}/index.html` }));
const integrationPort = Number(process.env.INTEGRATION_PORT ?? 8790);
const env = {
  DB: db,
  ENVIRONMENT: mode,
  PUBLIC_ORIGIN: publicOrigin,
  PLATFORM_SUPER_ADMINS: process.env.PLATFORM_SUPER_ADMINS,
  SARVAM_API_KEY: process.env.SARVAM_API_KEY,
  SARVAM_SPEECH_ENABLED: process.env.SARVAM_SPEECH_ENABLED ?? "true",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  PRUNE_API_KEY: process.env.PRUNE_API_KEY,
  PRUNE_BASE_URL: process.env.PRUNE_BASE_URL ?? "https://api.withprune.com/v1",
  PRUNE_MODEL: process.env.PRUNE_MODEL ?? "gemini/gemini-3.5-flash-lite",
  MARITIME_API_KEY: process.env.MARITIME_API_KEY,
  MARITIME_BASE_URL: process.env.MARITIME_BASE_URL ?? "https://api.maritime.sh",
  MARITIME_PARTICIPANT_CODE: process.env.MARITIME_PARTICIPANT_CODE ?? "JEEVIKA_ENTERPRISE",
  ASSETS: { fetch: (req: Request) => Promise.resolve(assets.fetch(req)) },
};
let stopping = false;
const pendingUpgrades = new Set<Duplex>();
const activeWork = new Set<Promise<unknown>>();
function track<T>(work: Promise<T>): Promise<T> {
  activeWork.add(work);
  return work.finally(() => activeWork.delete(work));
}

const server = serve(
  {
    fetch: (request) => stopping
      ? new Response("Server shutting down", { status: 503, headers: { Connection: "close" } })
      : track(Promise.resolve(app.fetch(request, env))),
    hostname: "127.0.0.1",
    port: integrationPort,
  },
  ({ port }) => {
    console.log(
      `DHAAGA standalone: http://127.0.0.1:${port} (${mode}; persistent SQLite)`,
    );
  },
);


// Bound partially assembled frames as well as concurrent document processing.
const maxConnections = 16;
const documents = { active: 0, limit: 2 };
const sockets = new WebSocketServer({
  noServer: true,
  maxPayload: maxSocketFrameBytes,
  perMessageDeflate: false,
  handleProtocols: () => dataProtocol,
});
const awaitingPong = new Set<WebSocket>();
const heartbeat = setInterval(() => {
  for (const ws of sockets.clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (awaitingPong.has(ws)) {
      ws.terminate();
      continue;
    }
    awaitingPong.add(ws);
    ws.ping(undefined, false, (error) => { if (error) ws.terminate(); });
  }
}, 25_000);
heartbeat.unref();

server.on("upgrade", (incoming, socket, head) => {
  socket.on("error", () => socket.destroy());
  const reject = (status: string) => {
    if (!socket.destroyed && socket.writable)
      socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  };
  if (incoming.url !== dataSocketPath) {
    reject("404 Not Found");
    return;
  }
  if (stopping || sockets.clients.size + pendingUpgrades.size >= maxConnections) {
    reject("503 Service Unavailable");
    return;
  }

  pendingUpgrades.add(socket);
  const timeout = setTimeout(() => socket.destroy(), 5000);
  const authorize = async () => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (typeof value === "string") headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(", "));
    }
    const address = server.address();
    const localPort = address && typeof address !== "string" ? address.port : integrationPort;
    const url = new URL(dataSocketPath, publicOrigin ?? `http://127.0.0.1:${localPort}`);
    const request = new Request(url, { method: incoming.method, headers });
    return authorizeDataSocket(request, env, (message, bindings) => app.fetch(message, bindings), documents);
  };
  void track(authorize()
    .then((handle) => {
      if (socket.destroyed) return;
      if (stopping) return reject("503 Service Unavailable");
      if (!handle) return reject("401 Unauthorized");
      sockets.handleUpgrade(incoming, socket, head, (ws) => {
        ws.binaryType = "arraybuffer";
        ws.on("error", () => ws.terminate());
        ws.on("pong", () => awaitingPong.delete(ws));
        ws.on("close", () => awaitingPong.delete(ws));
        ws.on("message", (frame, binary) => {
          if (stopping) return;
          void track(deliverDataSocketMessage(handle, () => {
            if (binary) return frame instanceof ArrayBuffer ? frame : null;
            if (Array.isArray(frame) || frame instanceof ArrayBuffer) return null;
            return frame.byteLength <= maxSocketMetadataBytes ? frame.toString() : null;
          }, {
            get readyState() { return ws.readyState; },
            send(frame) {
              const bytes = typeof frame === "string" ? Buffer.byteLength(frame) : frame.byteLength;
              if (ws.bufferedAmount + bytes > maxSocketFrameBytes + maxSocketMetadataBytes) {
                ws.terminate();
                return;
              }
              ws.send(frame);
            },
            close: (code, reason) => ws.close(code, reason),
          }));
        });
      });
    })
    .catch(() => reject("503 Service Unavailable"))
    .finally(() => {
      clearTimeout(timeout);
      pendingUpgrades.delete(socket);
    }));
});

function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeat);
  const httpClosed = new Promise<void>((resolve) => server.close(() => resolve()));
  const socketsClosed = new Promise<void>((resolve) => sockets.close(() => resolve()));
  for (const socket of pendingUpgrades) socket.destroy();
  for (const ws of sockets.clients) ws.close(1001, "Server shutting down");

  const forceSockets = setTimeout(() => {
    for (const ws of sockets.clients) ws.terminate();
    if ("closeAllConnections" in server) server.closeAllConnections();
  }, 5000);
  const deadline = setTimeout(() => {
    console.error("Standalone shutdown timed out while draining requests");
    process.exit(1);
  }, 10_000);

  void Promise.allSettled([httpClosed, socketsClosed, ...activeWork]).then(() => {
    clearTimeout(forceSockets);
    clearTimeout(deadline);
    db.close();
  });
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
