import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { routeAccess, staffNavItems } from "../frontend/website/src/lib/rbac";

const root = resolve(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("Clinic Operations & POS UI redesign and functional parity contracts", () => {
  it("bundles standalone roster and inventory SVGs alongside reused pharmacy and procurement botanical artwork", () => {
    const requiredAssets = [
      "frontend/website/public/assets/clinic/roster-empty-calendar.svg",
      "frontend/website/public/assets/clinic/inventory-empty-boxes.svg",
      "frontend/website/public/assets/admin/medicine-bottles.png",
      "frontend/website/public/assets/admin/procurement-hero.png",
      "frontend/website/public/assets/admin/sidebar-botanical-mortar.png",
      "frontend/website/public/assets/kiosk/kiosk-botanical-corner.png",
      "frontend/website/public/assets/logo-jeevika.png",
    ];
    for (const asset of requiredAssets) {
      const fullPath = resolve(root, asset);
      expect(existsSync(fullPath), `${asset} must exist`).toBe(true);
      expect(statSync(fullPath).size).toBeGreaterThan(1024);
    }
  });

  it("scopes Clinic Operations styles cleanly and follows modern accessible checkbox and reduced-motion rules", () => {
    const css = readSource("frontend/website/src/design-system/clinic-ops.css");
    expect(css).toContain(".jvk-clinic-ops-shell");
    expect(css).toContain(".jvk-clinic-ops-page");
    expect(css).toContain(".jvk-clinic-ops-icon-badge");
    expect(css).toContain("/assets/kiosk/kiosk-botanical-corner.png");
    expect(css).toContain(".jvk-clinic-ops-check-label");
    expect(css).toContain("min-block-size: 44px");
    expect(css).toContain(".jvk-clinic-ops-checkbox");
    expect(css).toContain("min-height: 0");
    expect(css).toContain("appearance: none");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(css).not.toContain("animation-duration: 0.01ms");
  });

  it("wires AppLayout shell isolation for the 4 clinic operations routes without weakening RBAC", () => {
    const appLayout = readSource(
      "frontend/website/src/components/layout/AppLayout.tsx",
    );
    expect(appLayout).toContain("isClinicOpsShell");
    expect(appLayout).toContain("jvk-clinic-ops-shell");
    expect(appLayout).toContain("'pos'");
    expect(appLayout).toContain(
      "verifiedRole === 'CLINIC_ADMIN' && view === 'procurement'",
    );

    const clinicAdminNav = staffNavItems("CLINIC_ADMIN").map(
      (item) => item.label,
    );
    expect(clinicAdminNav).toEqual([
      "Clinic Operations",
      "Roster",
      "IPD",
      "POS",
      "Inventory",
      "Procurement",
    ]);

    const cashierNav = staffNavItems("CASHIER").map((item) => item.label);
    expect(cashierNav).toEqual([
      "Pharmacy POS",
      "Inventory — Read-only",
      "GRN",
    ]);

    expect(routeAccess("/app/command/roster", "CLINIC_ADMIN")).toBe("Full");
    expect(routeAccess("/app/pos", "CASHIER")).toBe("Full");
    expect(routeAccess("/app/inventory", "CASHIER")).toBe("Read-only");
    expect(routeAccess("/app/procurement", "HOSPITAL_ADMIN")).toBe("Full");
  });

  it("preserves Shift Operations endpoints, forms, dialogs, and HQ HospitalShiftManagement boundary", () => {
    const roster = readSource(
      "frontend/website/src/components/ShiftManagement.tsx",
    ).replace(/\s+/g, " ");
    for (const token of [
      "jvk-clinic-ops-page",
      'data-jvk-entrance="left"',
      "Shift Operations",
      "Manage staff schedules and attendance windows",
      "No Shifts Created",
      "Create First Shift",
      "/assets/clinic/roster-empty-calendar.svg",
      "/clinical/command/roster/",
      "Create Shift Template",
      "Edit Shift",
      "Assign Staff to",
      "Staff Assignments",
      "Punch-in window:",
    ]) {
      expect(roster).toContain(token);
    }

    const appTsx = readSource("frontend/website/src/App.tsx");
    expect(appTsx).toContain("ShiftManagement");
    expect(appTsx).toContain("HospitalShiftManagement");
  });

  it("preserves Pharmacy POS inflow, FEFO checkout, Clinic Inventory search/expiry/catalog, and Purchase Orders contracts", () => {
    const pharmacy = readSource(
      "frontend/website/src/components/ClinicalPharmacy.tsx",
    ).replace(/\s+/g, " ");
    for (const token of [
      "Pharmacy POS",
      'data-jvk-entrance="left"',
      "Refresh inflow",
      "/assets/admin/medicine-bottles.png",
      "No prescriptions awaiting dispensing",
      "Signed prescriptions shared with this clinic’s pharmacy will appear here.",
      "Loading prescriptions…",
      "/inflow",
      "/quote",
      "/checkout",
      "Idempotency-Key",
      "Cash received and amount confirmed.",
      "jvk-clinic-ops-checkbox",
      "Clinic Inventory",
      "Refresh stock",
      "Search medicine or batch",
      "Search by medicine name, salt, or batch number...",
      "Expires within 90 days or already expired",
      "/assets/clinic/inventory-empty-boxes.svg",
      "No matching batches",
      "Clear filters",
      "Add approved medicine to the hospital catalog",
    ]) {
      expect(pharmacy).toContain(token);
    }
    expect(pharmacy).not.toContain(
      "Search by medicine name, batch number, or SKU",
    );

    const procurement = readSource(
      "frontend/website/src/components/ProcurementHandoffs.tsx",
    ).replace(/\s+/g, " ");
    for (const token of [
      "jvk-clinic-ops-page",
      'data-jvk-entrance="left"',
      "Purchase orders",
      "Goods receipt",
      "/assets/admin/procurement-hero.png",
      "No purchase orders",
      "Orders for this authorized clinic appear here.",
      "Create purchase order",
      "Add approved items to the clinic medicine catalog before ordering.",
      "Issue order",
      "export function GoodsReceipt",
    ]) {
      expect(procurement).toContain(token);
    }
  });
});
