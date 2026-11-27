import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { staffNavItems } from "../frontend/website/src/lib/rbac";

const root = resolve(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("Admin & Headquarters UI redesign and isolation contracts", () => {
  it("bundles every required isolated watercolor botanical and workspace asset", () => {
    const requiredAssets = [
      "frontend/website/public/assets/logo-jeevika.png",
      "frontend/website/public/assets/kiosk/kiosk-clinic-watercolor.png",
      "frontend/website/public/assets/opd/opd-sidebar-leaves.png",
      "frontend/website/public/assets/admin/sidebar-botanical-mortar.png",
      "frontend/website/public/assets/admin/analytics-empty.png",
      "frontend/website/public/assets/admin/segment-empty.png",
      "frontend/website/public/assets/admin/medicine-bottles.png",
      "frontend/website/public/assets/admin/procurement-hero.png",
      "frontend/website/public/assets/admin/finance-hero.png",
      "frontend/website/public/assets/admin/expenses-hero.png",
      "frontend/website/public/assets/admin/equipment-hero.png",
      "frontend/website/public/assets/admin/prune-hero.png",
      "frontend/website/public/assets/admin/roster-hero.svg",
      "frontend/website/public/assets/admin/swarm-hero.svg",
    ];
    for (const asset of requiredAssets) {
      const fullPath = resolve(root, asset);
      expect(existsSync(fullPath), `${asset} must exist`).toBe(true);
      expect(statSync(fullPath).size).toBeGreaterThan(1024);
    }
  });

  it("scopes admin CSS rules strictly to .jvk-admin-* and guards hover motion", () => {
    const css = readSource(
      "frontend/website/src/design-system/admin-workspace.css",
    );
    expect(css).toContain(".jvk-admin-shell");
    expect(css).toContain(".jvk-admin-page");
    expect(css).toContain(".jvk-admin-table-region");
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(css).not.toContain("animation-duration: 0.01ms");
  });

  it("unifies the admin botanical mortar sidebar without altering the doctor clinician shell", () => {
    const appLayout = readSource(
      "frontend/website/src/components/layout/AppLayout.tsx",
    );
    expect(appLayout).toContain("isAdminShell");
    expect(appLayout).toContain("isClinicianShell");
    expect(appLayout).toContain("isRailShell");
    expect(appLayout).toContain("/assets/admin/sidebar-botanical-mortar.png");
    expect(appLayout).toContain("/assets/opd/sidebar-botanical-watercolor.png");
    expect(appLayout).toContain("jvk-clinician-header-brand");
    expect(appLayout).toMatch(/id=\{`tour-\$\{item\.id\}`\}/);
    expect(appLayout).toContain("WebsiteLanguageSelect inline");
  });

  it("preserves all tour IDs, audit links, and multi-clinic summary fields on Command Center", () => {
    const command = readSource(
      "frontend/website/src/components/HospitalDashboard.tsx",
    );
    for (const requiredToken of [
      "#/app/ca/audit",
      "View audit status",
      'id="welcome-step"',
      'id="tour-revenue-card"',
      "tour-clinic-management-toggle",
      'id="tour-analytics-hub"',
      'id="tour-new-clinic"',
      "Multi-Clinic Network Summary",
      "Segment Contribution",
      "paiseToRupeesString",
    ]) {
      expect(command).toContain(requiredToken);
    }
  });

  it("keeps Swarm Mesh and Prune Gateway strictly bound to live data with zero mock numbers", () => {
    const swarm = readSource(
      "frontend/website/src/components/MaritimeAgentMesh.tsx",
    );
    const prune = readSource(
      "frontend/website/src/components/PruneGatewayDashboard.tsx",
    );
    for (const fakeValue of [
      "148,392",
      "₹28,640",
      "₹18,420.5",
      "1,248",
      "96.2%",
    ]) {
      expect(swarm).not.toContain(fakeValue);
      expect(prune).not.toContain(fakeValue);
    }
    expect(swarm).toContain("No simulations recorded");
    expect(prune).toContain("No requests recorded");
    expect(prune).toContain("/app/prune/redaction");
  });

  it("keeps RBAC admin sidebar labels consistent with unified navigation order", () => {
    const adminLabels = staffNavItems("HOSPITAL_ADMIN").map(
      (item) => item.label,
    );
    expect(adminLabels).toEqual([
      "Command Center",
      "IPD",
      "Inventory",
      "Procurement",
      "CA — Read-only",
      "Expenses",
      "Equipment",
      "Roster",
      "Swarm — Read-only",
      "Prune — Read-only",
    ]);
  });
});
