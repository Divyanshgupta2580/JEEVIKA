import { describe, expect, it } from "vitest";
import {
  computeAyushMetrics,
  filterEligibleAyushEncounters,
} from "../frontend/website/src/features/ayush/ayushMetrics";
import {
  type CareBoardData,
  computeCasualtyMetrics,
  computeIpdMetrics,
} from "../frontend/website/src/features/care/careMetrics";

const populatedBoard: CareBoardData = {
  locations: [
    {
      id: "bed-1",
      room: "Ward A",
      label: "Bed 1",
      state: "available",
      occupied: 1,
    },
    {
      id: "bed-2",
      room: "Ward A",
      label: "Bed 2",
      state: "available",
      occupied: 0,
    },
    {
      id: "bed-3",
      room: "Ward B",
      label: "Bed 3",
      state: "cleaning",
      occupied: 0,
    },
  ],
  admissions: [
    {
      id: "adm-1",
      encounter_id: "enc-1",
      location_id: "bed-1",
      name: "Synthetic Patient",
      tokenNumber: "OPD-1",
      reason: "Post-op observation",
      doctor_id: "doctor",
    },
  ],
  encounters: [
    {
      id: "enc-2",
      name: "Synthetic Waiting",
      status: "waiting",
      tokenNumber: "OPD-2",
    },
  ],
  doctors: [{ id: "doctor" }],
};

describe("IPD, Casualty, and AYUSH metrics & clinical safety", () => {
  it("distinguishes unconfigured IPD locations from occupied wards and marks unsupported request metrics unavailable", () => {
    const empty = computeIpdMetrics(
      { locations: [], admissions: [], encounters: [], doctors: [] },
      undefined,
      "DOCTOR",
    );
    expect(empty.bedsAvailable.status).toBe("not_configured");
    expect(empty.bedsAvailable.value).toBeNull();
    expect(empty.occupiedWards.status).toBe("not_configured");
    expect(empty.awaitingAdmission.value).toBeNull();
    expect(empty.admissionRequests.value).toBeNull();

    const populated = computeIpdMetrics(populatedBoard, undefined, "DOCTOR");
    expect(populated.bedsAvailable.value).toBe(1);
    expect(populated.occupiedWards.value).toBe(1); // Only Ward A has an occupied bed
    expect(populated.occupiedWards.occupiedBeds).toBe(1);
    expect(populated.awaitingAdmission.available).toBe(false);

    const admin = computeIpdMetrics(
      populatedBoard,
      undefined,
      "HOSPITAL_ADMIN",
    );
    expect(admin.admissionRequests.eligibleEncounters).toBeNull();
  });

  it("never shows a reassuring clear emergency banner when Casualty feeds fail or remain unverified", () => {
    const errored = computeCasualtyMetrics(
      undefined,
      "The service is unavailable. Try again.",
      undefined,
      undefined,
      "STAT_NURSE",
      null,
    );
    expect(errored.attention.tone).toBe("error");
    expect(errored.attention.title).not.toContain("No high-priority cases");

    const distressErrored = computeCasualtyMetrics(
      { locations: [], admissions: [], encounters: [], doctors: [] },
      undefined,
      undefined,
      "Failed distress poll",
      "STAT_NURSE",
      null,
    );
    expect(distressErrored.attention.tone).toBe("error");
    expect(distressErrored.activeCriticalAlerts.available).toBe(false);

    const nurseClear = computeCasualtyMetrics(
      { locations: [], admissions: [], encounters: [], doctors: [] },
      undefined,
      [],
      undefined,
      "STAT_NURSE",
      null,
    );
    expect(nurseClear.attention.tone).toBe("clear");
    expect(nurseClear.attention.title).toBe(
      "No high-priority cases requiring immediate attention.",
    );

    const doctorUnverified = computeCasualtyMetrics(
      { locations: [], admissions: [], encounters: [], doctors: [] },
      undefined,
      [],
      undefined,
      "DOCTOR",
      null,
    );
    expect(doctorUnverified.attention.tone).toBe("error");
  });

  it("counts only reviewed + active-consent AYUSH encounters and avoids invented summary totals", () => {
    const encounters = [
      {
        id: "1",
        patientName: "Eligible Patient",
        chiefComplaint: "Cough",
        status: "reviewed",
        consentActive: true,
      },
      {
        id: "2",
        patientName: "Revoked Consent",
        chiefComplaint: "Fever",
        status: "reviewed",
        consentActive: false,
      },
      {
        id: "3",
        patientName: "Waiting Intake",
        chiefComplaint: "Pain",
        status: "waiting",
        consentActive: true,
      },
    ];
    expect(filterEligibleAyushEncounters(encounters).map((e) => e.id)).toEqual([
      "1",
    ]);
    const metrics = computeAyushMetrics(encounters, undefined);
    expect(metrics.reviewedEncountersCount).toBe(1);
    expect(metrics.carePlansInProgress.available).toBe(false);
    expect(metrics.integratedTherapies.available).toBe(false);
    expect(metrics.pendingRecommendations.available).toBe(false);
  });
});
