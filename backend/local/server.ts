try {
  (process as any).loadEnvFile?.();
} catch {}

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { WebSocketServer } from "ws";
import { authorizeDataSocket, dataProtocol, dataSocketPath } from "../src/data-socket";
import { maxSocketFrameBytes } from "../../packages/shared/socket-binary";
import { app } from "../src/index";
import { LocalDatabase } from "./database";
import { migrateLocal } from "./migrate";
import { seedDemo } from "./seed";

mkdirSync(".local", { recursive: true });
const db = new LocalDatabase(
  resolve(process.env.INTEGRATION_DB ?? ".local/integration.sqlite"),
);
migrateLocal(db);
await seedDemo(db);
const assetsDirectory = process.env.INTEGRATION_ASSETS_DIR ?? "dist/integration";
const assets = new Hono();
assets.use("*", serveStatic({ root: assetsDirectory }));
assets.get("*", serveStatic({ path: `${assetsDirectory}/index.html` }));
const integrationPort = Number(process.env.INTEGRATION_PORT ?? 8790);
const env = {
  DB: db,
  ENVIRONMENT: "development",
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
const server = serve(
  {
    fetch: (request) => app.fetch(request, env),
    hostname: "127.0.0.1",
    port: integrationPort,
  },
  () => {
    console.log(
      `DHAAGA integration: http://127.0.0.1:${integrationPort} (synthetic data only; persistent local SQLite)`,
    );
  },
);


// This adapter keeps the local SQLite integration command on the same protocol as the Worker.
const sockets = new WebSocketServer({
  noServer: true,
  maxPayload: maxSocketFrameBytes,
  handleProtocols: () => dataProtocol,
});
server.on("upgrade", (incoming, socket, head) => {
  socket.on("error", () => socket.destroy());
  const reject = (status: string) => socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  if (incoming.url !== dataSocketPath) {
    reject("404 Not Found");
    return;
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }
  const origin = headers.get("Origin");
  const localOrigin = `http://${incoming.headers.host ?? `127.0.0.1:${integrationPort}`}`;
  if (origin && !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)) {
    reject("403 Forbidden");
    return;
  }
  const request = new Request(new URL(dataSocketPath, origin ?? localOrigin), { headers });
  void authorizeDataSocket(request, env, (message, bindings) => app.fetch(message, bindings))
    .then((handle) => {
      if (socket.destroyed) return;
      if (!handle) {
        reject("401 Unauthorized");
        return;
      }
      sockets.handleUpgrade(incoming, socket, head, (ws) => {
        ws.on("error", () => ws.terminate());
        ws.on("message", async (frame, binary) => {
          const buffer = Array.isArray(frame) ? Buffer.concat(frame) : Buffer.from(frame);
          const response = await handle(binary ? Uint8Array.from(buffer).buffer : buffer.toString());
          if (ws.readyState === ws.OPEN) ws.send(response);
        });
      });
    })
    .catch(() => reject("503 Service Unavailable"));
});
