import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cbcAssets } from "../../scripts/cbc-assets";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);
const tailwindcss = require("tailwindcss");
const autoprefixer = require("autoprefixer");

const clinicalBrowserFixture: Plugin = {
  name: "clinical-browser-fixture",
  transformIndexHtml: {
    order: "pre",
    handler(html, context) {
      return context.path === "/index.html"
        ? html.replace("/src/erp.tsx", "/src/main.tsx")
        : html;
    },
  },
};

const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.BUILD_REVISION;
const releaseMetadata: Plugin = {
  name: "jeevika-release-metadata",
  transformIndexHtml() {
    return revision && /^[0-9a-f]{40}$/.test(revision)
      ? [{ tag: "meta", attrs: { name: "jeevika-build-revision", content: revision }, injectTo: "head" }]
      : [];
  },
};

export default defineConfig({
  plugins: [
    cbcAssets() as any,
    releaseMetadata,
    ...(process.env.INTEGRATION_E2E_CLINICAL === "1" ? [clinicalBrowserFixture] : []),
  ],
  root: __dirname,
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          config: resolve(__dirname, "tailwind.config.js"),
          content: [resolve(__dirname, "src/**/*.{ts,tsx}")],
        }),
        autoprefixer(),
      ],
    },
  },
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  build: {
    outDir: resolve(__dirname, "../..", process.env.INTEGRATION_ASSETS_DIR ?? "dist/integration"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        erp: resolve(__dirname, "erp.html"),
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": { target: "http://127.0.0.1:8790", ws: true },
      "/healthz": "http://127.0.0.1:8790",
    },
  },
});
