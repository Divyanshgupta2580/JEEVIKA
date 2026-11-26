export interface CareLocationItem {
  id: string;
  room: string;
  label: string;
  state: "available" | "cleaning" | "maintenance";
  occupied: 0 | 1;
}

export interface CareAdmissionItem {
  id: string;
  encounter_id: string;
  location_id: string;
  name: string;
  tokenNumber: string | null;
  reason: string;
  doctor_id: string;
}

export interface CareEncounterItem {
  id: string;
  name: string;
  status: string;
  tokenNumber: string | null;
}

export interface CareBoardData {
  locations: CareLocationItem[];
  admissions: CareAdmissionItem[];
  encounters: CareEncounterItem[];
  doctors: Array<{ id: string }>;
}

export interface CareDistressItem {
  id: string;
  room: string;
  bed: string;
  patientName: string | null;
  reason: string | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
}

export interface IpdMetrics {
  state: "loading" | "error" | "ready";
  bedsAvailable: {
    status: "loading" | "error" | "not_configured" | "ready";
    value: number | null;
    totalBeds: number | null;
    hint: string;
  };
  occupiedWards: {
    status: "loading" | "error" | "not_configured" | "ready";
    value: number | null;
    occupiedBeds: number | null;
    hint: string;
  };
  awaitingAdmission: {
    available: false;
    value: null;
    hint: string;
  };
  admissionRequests: {
    available: false;
    value: null;
    eligibleEncounters: number | null;
    activeAdmissions: number | null;
    hint: string;
  };
}

export function computeIpdMetrics(
  board: CareBoardData | undefined,
  error: string | undefined,
  role: string,
): IpdMetrics {
  const isAdminRole = role === "HOSPITAL_ADMIN" || role === "CLINIC_ADMIN";

  if (error && !board) {
    return {
      state: "error",
      bedsAvailable: { status: "error", value: null, totalBeds: null, hint: "Ward feed unavailable" },
      occupiedWards: { status: "error", value: null, occupiedBeds: null, hint: "Ward feed unavailable" },
      awaitingAdmission: { available: false, value: null, hint: "Ward feed unavailable" },
      admissionRequests: {
        available: false,
        value: null,
        eligibleEncounters: null,
        activeAdmissions: null,
        hint: "Ward feed unavailable",
      },
    };
  }

  if (!board) {
    return {
      state: "loading",
      bedsAvailable: { status: "loading", value: null, totalBeds: null, hint: "Loading ward telemetry…" },
      occupiedWards: { status: "loading", value: null, occupiedBeds: null, hint: "Loading ward telemetry…" },
      awaitingAdmission: {
        available: false,
        value: null,
        hint: "Admission-request queue is not exposed by API",
      },
      admissionRequests: {
        available: false,
        value: null,
        eligibleEncounters: null,
        activeAdmissions: null,
        hint: "Loading admission options…",
      },
    };
  }

  const configured = board.locations.length > 0;
  const availableBeds = board.locations.filter((l) => !l.occupied && l.state === "available").length;
  const occupiedLocations = board.locations.filter((l) => l.occupied === 1);
  const occupiedWardCount = new Set(occupiedLocations.map((l) => l.room.trim())).size;
  const occupiedBedCount = occupiedLocations.length;
  const cleaningBeds = board.locations.filter((l) => !l.occupied && l.state === "cleaning").length;

  return {
    state: "ready",
    bedsAvailable: configured
      ? {
          status: "ready",
          value: availableBeds,
          totalBeds: board.locations.length,
          hint: cleaningBeds > 0
            ? `${board.locations.length} configured · ${cleaningBeds} cleaning`
            : `of ${board.locations.length} configured bed(s)`,
        }
      : {
          status: "not_configured",
          value: null,
          totalBeds: 0,
          hint: "No clinic beds configured",
        },
    occupiedWards: configured
      ? {
          status: "ready",
          value: occupiedWardCount,
          occupiedBeds: occupiedBedCount,
          hint: `${occupiedBedCount} occupied bed(s)`,
        }
      : {
          status: "not_configured",
          value: null,
          occupiedBeds: 0,
          hint: "No clinic wards configured",
        },
    awaitingAdmission: {
      available: false,
      value: null,
      hint: "Separate admission-request queue not exposed by API",
    },
    admissionRequests: {
      available: false,
      value: null,
      eligibleEncounters: isAdminRole ? null : board.encounters.length,
      activeAdmissions: isAdminRole ? null : board.admissions.length,
      hint: isAdminRole
        ? "Encounter list restricted to clinical roles"
        : `${board.encounters.length} clinic encounter(s) in admission selector`,
    },
  };
}

export interface CasualtyMetrics {
  state: "loading" | "error" | "ready";
  baysOccupied: {
    status: "loading" | "error" | "not_configured" | "ready";
    occupied: number | null;
    total: number | null;
    hint: string;
  };
  waitingEmergencies: {
    available: boolean;
    value: number | null;
    hint: string;
  };
  highPriorityReferrals: {
    available: boolean;
    value: number | null;
    hint: string;
  };
  activeCriticalAlerts: {
    available: boolean;
    value: number | null;
    distressCount: number | null;
    hint: string;
  };
  attention: {
    tone: "loading" | "error" | "urgent" | "clear";
    title: string;
    detail: string;
  };
}

export function computeCasualtyMetrics(
  board: CareBoardData | undefined,
  boardError: string | undefined,
  distressEvents: CareDistressItem[] | undefined,
  distressError: string | undefined,
  role: string,
  opdEmergencyCount: number | null,
): CasualtyMetrics {
  const isDoctor = role === "DOCTOR";

  if (boardError && !board) {
    return {
      state: "error",
      baysOccupied: { status: "error", occupied: null, total: null, hint: "Emergency bay feed unavailable" },
      waitingEmergencies: { available: false, value: null, hint: "Emergency bay feed unavailable" },
      highPriorityReferrals: { available: false, value: null, hint: "Emergency bay feed unavailable" },
      activeCriticalAlerts: { available: false, value: null, distressCount: null, hint: "Emergency bay feed unavailable" },
      attention: {
        tone: "error",
        title: "Unable to verify emergency status",
        detail: boardError,
      },
    };
  }

  if (!board) {
    return {
      state: "loading",
      baysOccupied: { status: "loading", occupied: null, total: null, hint: "Loading emergency bays…" },
      waitingEmergencies: { available: false, value: null, hint: "Checking emergency queue…" },
      highPriorityReferrals: { available: false, value: null, hint: "Checking referrals…" },
      activeCriticalAlerts: { available: false, value: null, distressCount: null, hint: "Checking active alerts…" },
      attention: {
        tone: "loading",
        title: "Checking emergency attention status…",
        detail: "Retrieving casualty bay occupancy, triage referrals, and critical alerts.",
      },
    };
  }

  const configured = board.locations.length > 0;
  const occupiedBays = board.locations.filter((l) => l.occupied === 1).length;

  const waitingAvailable = isDoctor ? opdEmergencyCount !== null : true;
  const waitingCount = isDoctor ? opdEmergencyCount : board.encounters.length;

  const referralsAvailable = isDoctor;
  const referralsCount = isDoctor ? board.encounters.length : null;

  const distressReady = Boolean(distressEvents) && !distressError;
  const distressCount = distressReady ? (distressEvents?.length ?? 0) : null;

  const emergencyFeedUnknown = !distressReady || (isDoctor && opdEmergencyCount === null);
  const alertsValue = emergencyFeedUnknown
    ? null
    : (distressCount ?? 0) +
      (isDoctor ? (opdEmergencyCount ?? 0) : board.encounters.length) +
      occupiedBays;

  let attention: CasualtyMetrics["attention"];
  if (distressError) {
    attention = {
      tone: "error",
      title: "Unable to verify active distress feed",
      detail: distressError,
    };
  } else if (isDoctor && opdEmergencyCount === null) {
    attention = {
      tone: "error",
      title: "Clinic emergency feed unverified",
      detail:
        referralsCount && referralsCount > 0
          ? `${referralsCount} referred emergency encounter(s) assigned to you. Clinic-wide STAT feed unavailable here — check Alerts or OPD Queue.`
          : "Casualty board shows only referrals assigned to you; clinic-wide STAT feed could not be verified here.",
    };
  } else {
    const activeTotal =
      (distressCount ?? 0) +
      (waitingCount ?? 0) +
      (referralsCount ?? 0) +
      occupiedBays;

    if (activeTotal > 0) {
      const parts: string[] = [];
      if (distressCount && distressCount > 0) parts.push(`${distressCount} Code Blue distress alert(s)`);
      if (waitingCount && waitingCount > 0) parts.push(`${waitingCount} waiting STAT emergency case(s)`);
      if (referralsCount && referralsCount > 0) parts.push(`${referralsCount} emergency referral(s)`);
      if (occupiedBays > 0) parts.push(`${occupiedBays} occupied emergency bay(s)`);
      attention = {
        tone: "urgent",
        title: "Immediate emergency attention required",
        detail: parts.join(" · "),
      };
    } else if (!distressEvents) {
      attention = {
        tone: "loading",
        title: "Verifying critical distress alerts…",
        detail: "Checking bedside distress telemetry.",
      };
    } else {
      attention = {
        tone: "clear",
        title: "No high-priority cases requiring immediate attention.",
        detail: configured
          ? "Emergency bays, active referrals, and distress feeds are currently clear."
          : "Authorized referrals and emergency feeds are clear (0 bays configured).",
      };
    }
  }

  return {
    state: "ready",
    baysOccupied: configured
      ? {
          status: "ready",
          occupied: occupiedBays,
          total: board.locations.length,
          hint: "Emergency bays occupied",
        }
      : {
          status: "not_configured",
          occupied: 0,
          total: 0,
          hint: "No emergency bays configured",
        },
    waitingEmergencies: waitingAvailable
      ? {
          available: true,
          value: waitingCount,
          hint: isDoctor ? "Active STAT cases in OPD feed" : "Awaiting bay assignment",
        }
      : {
          available: false,
          value: null,
          hint: "Clinic emergency feed unavailable",
        },
    highPriorityReferrals: referralsAvailable
      ? {
          available: true,
          value: referralsCount,
          hint: "Assigned to you in Casualty",
        }
      : {
          available: false,
          value: null,
          hint: "Doctor-scoped referral queue",
        },
    activeCriticalAlerts: {
      available: alertsValue !== null,
      value: alertsValue,
      distressCount,
      hint:
        alertsValue === null
          ? "Distress or STAT feed unavailable"
          : distressCount && distressCount > 0
            ? `${distressCount} Code Blue alert(s) included`
            : "Monitored distress & emergency feeds",
    },
    attention,
  };
}
