import { copyFileSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { clinicalMigrationPaths } from "../backend/local/migrate";

// The standalone server, D1 and Worker smoke use the same migration set.
const destination = resolve(".local/integration-migrations");
mkdirSync(destination, { recursive: true });
for (const path of clinicalMigrationPaths) {
  copyFileSync(path, resolve(destination, basename(path)));
}
console.log("Prepared the canonical clinical migration set (including CBC).");
