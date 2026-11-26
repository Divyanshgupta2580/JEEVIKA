import { describe, expect, it } from "vitest";
import {
  buildClinicianAlerts,
  computeOpdOverviewMetrics,
  evaluatePatientVital,
  type OpdQueueItem,
} from "../frontend/website/src/features/opd/opdMetricsAndAlerts";
import { landingRoute, routeAccess, staffNavItems } from "../frontend/website/src/lib/rbac";

function makeQueueItem(overrides: Partial<OpdQueueItem> = {}): OpdQueueItem {
  return {
    kioskIntake: true,
    encounterId: "enc-1",
    patientId: "pat-1",
    token: "OPD-01",
    consentActive: true,
    name: "Synthetic Patient",
    age: null,
    gender: "UNRECORDED",
    abhaId: "",
    pmjayEligible: false,
    status: "WAITING",
    checkInTime: "10:00 AM",
    createdAtIso: "2026-11-26T04:30:00.000Z",
    symptoms: ["Synthetic fever"],
    vitals: { bp: "Not recorded", pulse: 0, spo2: 0, temp: "Not recorded" },
    soap: {
      subjective: "Synthetic fever",
      objective: "No measurements recorded.",
      assessment: "",
      icd11Code: "",
      plan: [],
    },
    ...overrides,
  };
}

describe("OPD vitals, metrics, alerts, and RBAC isolation", () => {
  it("never renders missing SpO2 or pulse 0 as measured values", () => {
    const item = makeQueueItem();
    const spo2 = evaluatePatientVital(item, "spo2");
    const pulse = evaluatePatientVital(item, "pulse");
    const bp = evaluatePatientVital(item, "bp");
    expect(spo2.status).toBe("unknown");
    expect(spo2.displayValue).toBe("Not recorded");
    expect(spo2.displayValue).not.toContain("0%");
    expect(pulse.displayValue).toBe("Not recorded");
    expect(bp.displayValue).toBe("Not recorded");

    const hypoxic = evaluatePatientVital(
      makeQueueItem({ kioskIntake: false, vitals: { bp: "120/80 mmHg", pulse: 80, spo2: 89, temp: "98.6°F" } }),
      "spo2",
    );
    expect(hypoxic.status).toBe("critical");
    expect(hypoxic.displayValue).toBe("89%");
  });

  it("deduplicates STAT encounters referred to casualty and preserves clinical severities", () => {
    const statEncounter = makeQueueItem({
      encounterId: "enc-emergency",
      token: "OPD-99",
      name: "Emergency Case",
      status: "STAT_ALERT",
      symptoms: ["Chest pain"],
      soap: {
        subjective: "Chest pain",
        objective: "Recorded",
        assessment: "",
        icd11Code: "",
        plan: [
          {
            drug: "Aspirin 300mg",
            dosage: "300mg",
            frequency: "STAT",
            duration: "1 Day",
            availableInClinic: true,
          },
        ],
      },
    });
    const outreachEncounter = makeQueueItem({
      encounterId: "enc-outreach",
      patientId: "pat-outreach",
      token: "OPD-100",
      outreachReviewRequested: true,
    });

    const alerts = buildClinicianAlerts({
      queue: [statEncounter, outreachEncounter],
      distressEvents: [
        {
          id: "dist-1",
          room: "Ward A",
          bed: "Bed 2",
          patientName: "Ward Patient",
          diagnosis: "Observation",
          reason: "Acute distress",
          triggeredAt: "2026-11-26T05:00:00.000Z",
          acknowledgedAt: null,
          latencyMs: null,
          attending: 1,
        },
      ],
      casualtyEncounters: [
        { id: "enc-emergency", name: "Emergency Case", status: "emergency", tokenNumber: "OPD-99" },
      ],
      casualtyAdmissions: [],
    });

    const statAlerts = alerts.filter((a) => a.encounterId === "enc-emergency" && a.severity === "EMERGENCY");
    expect(statAlerts.filter((a) => a.sourceModule.includes("Triage Sentinel"))).toHaveLength(1);
    expect(alerts.some((a) => a.id === "distress:dist-1" && a.severity === "EMERGENCY")).toBe(true);
    expect(alerts.some((a) => a.id === "outreach:enc-outreach" && a.severity === "HIGH")).toBe(true);
    expect(alerts.some((a) => a.rawSeverity === "CONTRAINDICATED" && a.severity === "EMERGENCY")).toBe(true);

    // Highest priority alerts sort before Medium and Info
    const severities = alerts.map((a) => a.severity);
    expect(severities.indexOf("INFO")).toBeGreaterThan(severities.indexOf("EMERGENCY"));
  });

  it("reports honest unavailable metrics on fetch failure and keeps Awaiting Admission unfabricated", () => {
    const failed = computeOpdOverviewMetrics([], "error", [], true);
    expect(failed.inQueue).toBeNull();
    expect(failed.inConsultation).toBeNull();
    expect(failed.highPriority).toBeNull();
    expect(failed.awaitingAdmission.available).toBe(false);
    expect(failed.awaitingAdmission.value).toBeNull();
  });

  it("restricts /app/alerts and OPD child routes strictly to DOCTOR while adding Alerts after AYUSH", () => {
    expect(landingRoute("DOCTOR")).toBe("/app/doctor");
    expect(routeAccess("/app/alerts", "DOCTOR")).toBe("Full");
    expect(routeAccess("/app/doctor/queue", "DOCTOR")).toBe("Full");
    expect(routeAccess("/app/doctor/consultation", "DOCTOR")).toBe("Full");

    for (const nonDoctor of ["NURSE", "STAT_NURSE", "CASHIER", "HOSPITAL_ADMIN", "CLINIC_ADMIN", "SUPER_ADMIN", "PATIENT"]) {
      expect(routeAccess("/app/alerts", nonDoctor)).toBe("None");
      expect(routeAccess("/app/doctor/queue", nonDoctor)).toBe("None");
    }

    const docNav = staffNavItems("DOCTOR").map((item) => item.label);
    expect(docNav).toEqual(["OPD Cockpit", "IPD", "Casualty", "AYUSH", "Alerts"]);
  });
});
