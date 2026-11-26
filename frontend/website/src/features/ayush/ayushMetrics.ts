export interface AyushEncounterSummary {
  id: string;
  patientName: string;
  chiefComplaint: string;
  status: string;
  consentActive: boolean;
}

export interface AyushOverviewMetrics {
  state: "loading" | "error" | "ready";
  reviewedEncountersCount: number | null;
  carePlansInProgress: {
    available: false;
    value: null;
    reason: string;
  };
  integratedTherapies: {
    available: false;
    value: null;
    reason: string;
  };
  pendingRecommendations: {
    available: false;
    value: null;
    reason: string;
  };
}

export function filterEligibleAyushEncounters(
  encounters: AyushEncounterSummary[] | undefined,
): AyushEncounterSummary[] {
  if (!encounters) return [];
  return encounters.filter(
    ({ status, consentActive }) => status === "reviewed" && consentActive,
  );
}

export function computeAyushMetrics(
  encounters: AyushEncounterSummary[] | undefined,
  error: string | undefined,
): AyushOverviewMetrics {
  if (error && !encounters) {
    return {
      state: "error",
      reviewedEncountersCount: null,
      carePlansInProgress: {
        available: false,
        value: null,
        reason: "Encounter feed unavailable",
      },
      integratedTherapies: {
        available: false,
        value: null,
        reason: "Encounter feed unavailable",
      },
      pendingRecommendations: {
        available: false,
        value: null,
        reason: "Encounter feed unavailable",
      },
    };
  }

  if (!encounters) {
    return {
      state: "loading",
      reviewedEncountersCount: null,
      carePlansInProgress: {
        available: false,
        value: null,
        reason: "Clinic-wide case summary API not exposed",
      },
      integratedTherapies: {
        available: false,
        value: null,
        reason: "Clinic-wide formulation summary API not exposed",
      },
      pendingRecommendations: {
        available: false,
        value: null,
        reason: "Pending recommendations summary not exposed",
      },
    };
  }

  const eligible = filterEligibleAyushEncounters(encounters);

  return {
    state: "ready",
    reviewedEncountersCount: eligible.length,
    carePlansInProgress: {
      available: false,
      value: null,
      reason: "Case sheets load per selected encounter",
    },
    integratedTherapies: {
      available: false,
      value: null,
      reason: "Formulations load per selected encounter",
    },
    pendingRecommendations: {
      available: false,
      value: null,
      reason: "Clinic-wide recommendation queue unavailable",
    },
  };
}
