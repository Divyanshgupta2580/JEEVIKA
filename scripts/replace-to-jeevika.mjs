import { readFileSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const targetDirs = [
  "frontend/website/src",
  "frontend/website/index.html",
  "frontend/website/erp.html",
  "packages/design",
  "packages/i18n",
  "packages/shared",
  "apps/web/src",
  "apps/web/index.html"
];

const replacements = [
  { from: /JEEVIKA/g, to: "JEEVIKA" },
  { from: /Jeevika/g, to: "Jeevika" },
  { from: /Jeevika/g, to: "Jeevika" },
  { from: /जीविका/g, to: "जीविका" },
  { from: /जीविका/g, to: "जीविका" },
  { from: /ஜீவிகா/g, to: "ஜீவிகா" },
  { from: /ਜੀਵਿਕਾ/g, to: "ਜੀਵਿਕਾ" },
  { from: /jeevika\.in/g, to: "jeevika.in" },
  { from: /jeevika\.health/g, to: "jeevika.health" },
  { from: /jeevika:\/\//g, to: "jeevika://" },
  { from: /\/assets\/jeevika_logo\.png/g, to: "/assets/logo-jeevika.png" },
  { from: /jeevika\.network/g, to: "jeevika.network" },
  { from: /org-jeevika-primary/g, to: "org-jeevika-primary" },
  { from: /jeevika-main-hospital/g, to: "jeevika-main-hospital" },
  { from: /jeevika-casualty-clinic/g, to: "jeevika-casualty-clinic" },
  { from: /'jeevika'/g, to: "'jeevika'" }
];

async function processFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  let updated = content;
  for (const { from, to } of replacements) {
    updated = updated.replace(from, to);
  }
  if (updated !== content) {
    writeFileSync(filePath, updated, "utf-8");
    console.log(`Updated: ${filePath}`);
  }
}

async function walk(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      await walk(fullPath);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if ([".ts", ".tsx", ".js", ".jsx", ".html", ".json", ".md"].includes(ext)) {
        await processFile(fullPath);
      }
    }
  }
}

async function main() {
  for (const target of targetDirs) {
    try {
      if (target.endsWith(".html")) {
        await processFile(target);
      } else {
        await walk(target);
      }
    } catch (err) {
      console.error(`Error processing ${target}:`, err);
    }
  }
  console.log("Replacement complete!");
}

main();
