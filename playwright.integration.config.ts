import { defineConfig, devices } from "@playwright/test";

const port = process.env.INTEGRATION_E2E_PORT ?? "8790";
const baseURL = `http://127.0.0.1:${port}`;
const database = process.env.JEEVIKA_INTEGRATION_E2E_DB ??= `.local/integration-e2e-${process.pid}.sqlite`;

export default defineConfig({
  testDir: "tests/integration-browser",
  use: { baseURL, ...devices["Desktop Chrome"] },
  webServer: {
    env: {
      INTEGRATION_PORT: port,
      INTEGRATION_DB: database,
      INTEGRATION_ASSETS_DIR: `.local/integration-e2e-assets-${process.pid}`,
      INTEGRATION_E2E_CLINICAL: process.env.INTEGRATION_E2E_CLINICAL ?? "1",
      VITE_API_URL: "/api/v1",
    },
    command: "vite build --config frontend/website/vite.config.ts && node --import tsx backend/local/server.ts",
    url: `${baseURL}/healthz`,
    reuseExistingServer: process.env.REUSE_SERVER === "1",
    timeout: 30000,
  },
  reporter: "list",
});
