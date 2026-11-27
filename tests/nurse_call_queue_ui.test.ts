import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { routeAccess, staffNavItems } from "../frontend/website/src/lib/rbac";

const root = resolve(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("Nurse Call Queue UI redesign and functional parity contracts", () => {
  it("bundles the standalone empty-state illustration and reuses existing botanical assets", () => {
    const requiredAssets = [
      "frontend/website/public/assets/nurse/nurse-outreach-empty.svg",
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

  it("scopes nurse styles cleanly and follows native slider and reduced-motion rules", () => {
    const css = readSource(
      "frontend/website/src/design-system/nurse-call-queue.css",
    );
    expect(css).toContain(".jvk-nurse-shell");
    expect(css).toContain(".jvk-nurse-page");
    expect(css).toContain(".jvk-nurse-slider::-webkit-slider-runnable-track");
    expect(css).toContain(".jvk-nurse-slider::-webkit-slider-thumb");
    expect(css).toContain(".jvk-nurse-slider::-moz-range-track");
    expect(css).toContain(".jvk-nurse-slider::-moz-range-progress");
    expect(css).toContain(".jvk-nurse-slider::-moz-range-thumb");
    expect(css).not.toMatch(/::-webkit-slider-[^,{]+,\s*::-moz-range-/);
    expect(css).toContain("@supports not (opacity: progress(1, 0, 100))");
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(css).not.toContain("animation-duration: 0.01ms");
  });

  it("connects Nurse Call Queue to the shared botanical sidebar while preserving nurse RBAC", () => {
    const appLayout = readSource(
      "frontend/website/src/components/layout/AppLayout.tsx",
    );
    expect(appLayout).toContain("isNurseCallsShell");
    expect(appLayout).toContain("isBotanicalRailShell");
    expect(appLayout).toContain("/assets/admin/sidebar-botanical-mortar.png");

    const nurseNav = staffNavItems("NURSE");
    expect(nurseNav.map((item) => item.label)).toEqual([
      "IPD",
      "Casualty",
      "Nurse Call Queue",
    ]);
    expect(routeAccess("/app/nurse-calls", "NURSE")).toBe("Full");
    expect(routeAccess("/app/command", "NURSE")).toBe("None");
  });

  it("preserves all NurseCallQueue API endpoints, slider bounds, outcomes, and error states", () => {
    const component = readSource(
      "frontend/website/src/components/NurseCallQueue.tsx",
    ).replace(/\s+/g, " ");
    for (const token of [
      "/clinical/nurse-calls",
      "/clinical/nurse-calls/outcomes",
      "plannedMinutesPerCall = 10",
      "Patient reassured",
      "Medication concern reviewed",
      "OPD review requested",
      "Emergency transfer reported",
      "Available call minutes",
      "min={0}",
      "max={240}",
      "step={10}",
      'unitSuffix="min"',
      "All eligible patients remain in the queue.",
      "Loading outreach queue…",
      "No outreach items",
      "Eligible post-discharge check-ins with follow-up consent will appear here.",
      "Within call budget",
      "Beyond call budget",
      "InlineBanner",
      "/assets/nurse/nurse-outreach-empty.svg",
    ]) {
      expect(component).toContain(token);
    }

    const sliderPrimitive = readSource(
      "frontend/website/src/components/ui/design-primitives.tsx",
    );
    expect(sliderPrimitive).toContain('type="range"');
    expect(sliderPrimitive).toContain("aria-valuetext");
  });
});
