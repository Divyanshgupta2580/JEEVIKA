import { describe, expect, it } from "vitest";
import { landingRoute, routeAccess } from "../frontend/website/src/lib/rbac";

describe("Phase 2 frontend route permissions", () => {
  it("redirects each role to the approved landing route", () => {
    expect(landingRoute("SUPER_ADMIN")).toBe("/app/command");
    expect(landingRoute("HOSPITAL_ADMIN")).toBe("/app/command");
    expect(landingRoute("CLINIC_ADMIN")).toBe("/app/command");
    expect(landingRoute("DOCTOR")).toBe("/app/doctor");
    expect(landingRoute("NURSE")).toBe("/app/ipd");
    expect(landingRoute("STAT_NURSE")).toBe("/app/casualty/triage");
    expect(landingRoute("CASHIER")).toBe("/app/pos");
    expect(landingRoute("PATIENT")).toBe("/app/home");
  });

  it("denies Doctor POS and grants independent Cashier POS/GRN access", () => {
    expect(routeAccess("/app/pos", "DOCTOR")).toBe("None");
    expect(routeAccess("/app/pos", "CASHIER")).toBe("Full");
    expect(routeAccess("/app/procurement", "CASHIER")).toBe("None");
    expect(routeAccess("/app/procurement/grn", "CASHIER")).toBe("Full");
  });

  it("keeps Swarm, Prune and CLINIC_ADMIN IPD scopes conservative", () => {
    expect(routeAccess("/app/swarm", "SUPER_ADMIN")).toBe("Full");
    expect(routeAccess("/app/swarm", "HOSPITAL_ADMIN")).toBe("Read-only");
    expect(routeAccess("/app/swarm", "CASHIER")).toBe("None");
    expect(routeAccess("/app/prune/redaction", "SUPER_ADMIN")).toBe("Full");
    expect(routeAccess("/app/prune/redaction", "HOSPITAL_ADMIN")).toBe("None");
    expect(routeAccess("/app/ipd", "STAT_NURSE")).toBe("None");
  });

  it("enforces Phase 3 inventory and CA permission boundaries", () => {
    expect(routeAccess("/app/inventory", "HOSPITAL_ADMIN")).toBe("Full");
    expect(routeAccess("/app/inventory", "CLINIC_ADMIN")).toBe("Full");
    expect(routeAccess("/app/inventory", "CASHIER")).toBe("Read-only");
    expect(routeAccess("/app/ca", "SUPER_ADMIN")).toBe("Full");
    expect(routeAccess("/app/ca", "HOSPITAL_ADMIN")).toBe("Read-only");
    expect(routeAccess("/app/ca", "CASHIER")).toBe("None");
  });
});

describe("Phase 4 route permissions", () => {
  it("keeps platform administration and AYUSH limited to their named personas", () => {
    const roleList = [
      "SUPER_ADMIN",
      "HOSPITAL_ADMIN",
      "CLINIC_ADMIN",
      "DOCTOR",
      "NURSE",
      "STAT_NURSE",
      "CASHIER",
      "PATIENT",
      "OWNER",
      "ADMIN",
    ];
    for (const role of roleList) {
      const expected =
        role === "SUPER_ADMIN"
          ? "Full"
          : role === "HOSPITAL_ADMIN"
            ? "Read-only"
            : "None";
      for (const route of [
        "/app/swarm",
        "/app/prune",
        "/app/prune/cache",
        "/app/prune/waf",
      ] as const) {
        expect(routeAccess(route, role)).toBe(expected);
      }
      expect(routeAccess("/app/prune/redaction", role)).toBe(
        role === "SUPER_ADMIN" ? "Full" : "None",
      );
      expect(routeAccess("/app/ayush", role)).toBe(
        role === "DOCTOR" ? "Full" : "None",
      );
    }
  });
});
