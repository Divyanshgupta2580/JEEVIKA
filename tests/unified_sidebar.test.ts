import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  landingRoute,
  routeAccess,
  staffNavItems,
} from "../frontend/website/src/lib/rbac";

const root = resolve(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("Application-wide unified staff sidebar standardization", () => {
  it("bundles the authoritative botanical mortar illustration and JEEVIKA logo", () => {
    for (const asset of [
      "frontend/website/public/assets/admin/sidebar-botanical-mortar.png",
      "frontend/website/public/assets/logo-jeevika.png",
    ]) {
      const fullPath = resolve(root, asset);
      expect(existsSync(fullPath), `${asset} must exist`).toBe(true);
      expect(statSync(fullPath).size).toBeGreaterThan(1024);
    }
  });

  it("standardizes full-height expanded layout, collapse logo independence, mobile drawer, and reduced-motion rules", () => {
    const css = readSource(
      "frontend/website/src/design-system/sidebar-unified.css",
    );
    expect(css).toContain(".jvk-staff-shell");
    expect(css).toContain("height: 100dvh;");
    expect(css).toContain("margin-top: -62px;");
    expect(css).toContain('[data-sidebar-collapsed="false"]');
    expect(css).toContain('[data-sidebar-collapsed="true"]');
    expect(css).toContain("width: 56px;");
    expect(css).toContain("width: auto;");
    expect(css).toContain("#e5f3eb");
    expect(css).toContain("@container (max-height: 108px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("connects every staff role in AppLayout to the unified rail, persists collapse state, and supports nested active routes", () => {
    const appLayout = readSource(
      "frontend/website/src/components/layout/AppLayout.tsx",
    );
    expect(appLayout).toContain("@/design-system/sidebar-unified.css");
    expect(appLayout).toContain("const isRailShell = !isFullBleedPortal");
    expect(appLayout).toContain("jvk-staff-shell");
    expect(appLayout).toContain("data-sidebar-collapsed");
    expect(appLayout).toContain("jeevika_sidebar_collapsed");
    expect(appLayout).not.toContain(
      "useState(() => verifiedRole === 'DOCTOR')",
    );
    expect(appLayout).toContain("isNavItemActive");
    expect(appLayout).toContain("SIDEBAR_BOTANICAL_ARTWORK");
  });

  it("preserves role-specific authorized navigation and restrictions across every staff role", () => {
    expect(staffNavItems("NURSE").map((i) => i.label)).toEqual([
      "IPD",
      "Casualty",
      "Nurse Call Queue",
    ]);
    expect(staffNavItems("STAT_NURSE").map((i) => i.label)).toEqual([
      "Casualty",
    ]);
    expect(staffNavItems("DOCTOR").map((i) => i.label)).toEqual([
      "OPD Cockpit",
      "IPD",
      "Casualty",
      "AYUSH",
      "Alerts",
    ]);
    expect(staffNavItems("CLINIC_ADMIN").map((i) => i.label)).toEqual([
      "Clinic Operations",
      "Roster",
      "IPD",
      "POS",
      "Inventory",
      "Procurement",
    ]);
    expect(staffNavItems("CASHIER").map((i) => i.label)).toEqual([
      "Pharmacy POS",
      "Inventory — Read-only",
      "GRN",
    ]);
    expect(staffNavItems("CLINIC_STAFF").map((i) => i.label)).toEqual([
      "Pharmacy POS",
      "Inventory — Read-only",
      "GRN",
    ]);
    expect(staffNavItems("SUPER_ADMIN").map((i) => i.label)).toEqual([
      "Command Center",
      "CA & Audit Vault",
      "Procurement",
      "Swarm Mesh",
      "Prune Gateway",
    ]);
    expect(staffNavItems("HOSPITAL_ADMIN").map((i) => i.label)).toHaveLength(
      10,
    );

    expect(landingRoute("STAT_NURSE")).toBe("/app/casualty/triage");
    expect(routeAccess("/app/command", "CASHIER")).toBe("None");
    expect(routeAccess("/app/nurse-calls", "STAT_NURSE")).toBe("None");
  });
});
