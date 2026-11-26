import { checkHerbDrugInteractions, type HerbDrugInteraction } from "../../lib/herbDrugInteractions";

export interface OpdDistressEvent {
  id: string;
  room: string;
  bed: string;
  patientName: string | null;
  diagnosis: string | null;
  reason: string | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  latencyMs: number | null;
  attending: 0 | 1;
}

export interface OpdPrescriptionItem {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
  availableInClinic: boolean;
  instructions?: string;
  shelfLocation?: string;
  brandName?: string;
  brandPrice?: number;
  genericName?: string;
  genericPrice?: number;
  isGenericSubstituted?: boolean;
}

export interface OpdQueueItem {
  cbcEncounterId?: string;
  kioskIntake?: boolean;
  documentReview?: string;
  outreachReviewRequested?: boolean;
  consentActive?: boolean;
  savedSoapNote?: string | null;
  prescriptionStatus?: "signed" | "dispensed";
  encounterId?: string;
  token: string;
  patientId: string;
  name: string;
  age: number | null;
  gender: string;
  abhaId: string;
  pmjayEligible: boolean;
  status: "WAITING" | "IN_CONSULT" | "DISPENSED" | "STAT_ALERT";
  checkInTime: string;
  createdAtIso?: string;
  symptoms: string[];
  intakeAudioSnippet?: string;
  intakeAudioTranslation?: string;
  citations?: Array<{
    id: number;
    timestamp: string;
    transcriptSnippet: string;
    clinicalFinding: string;
  }>;
  vitals: {
    bp: string;
    pulse: number;
    spo2: number;
    temp: string;
  };
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    icd11Code: string;
    icd11Description?: string;
    namasteCode?: string;
    namasteDescription?: string;
    plan: OpdPrescriptionItem[];
  };
}

export const opdQueueIdentity = (item: Pick<OpdQueueItem, "cbcEncounterId" | "encounterId" | "patientId">) =>
  item.cbcEncounterId ?? item.encounterId ?? item.patientId;

export interface VitalEvaluation {
  status: "unknown" | "normal" | "warning" | "critical";
  tag: string;
  border: string;
  displayValue: string;
}

export function evaluatePatientVital(
  patient: Pick<OpdQueueItem, "cbcEncounterId" | "kioskIntake" | "vitals">,
  type: "bp" | "pulse" | "spo2" | "temp",
): VitalEvaluation {
  const value = patient.vitals[type];
  const rawStr = String(value ?? "").trim();
  const isZeroOrBlank =
    rawStr === "" ||
    rawStr === "0" ||
    rawStr.toLowerCase() === "not recorded" ||
    rawStr.toLowerCase() === "n/a";

  // Never convert missing measurements (especially SpO2 = 0) into a measured vital sign
  if (isZeroOrBlank || ((patient.cbcEncounterId || patient.kioskIntake) && (value === 0 || rawStr === "Not recorded"))) {
    return {
      status: "unknown",
      tag: "Not recorded",
      border: "border-[#E3DDD0] bg-[#FAF7F0] text-[#586C64]",
      displayValue: "Not recorded",
    };
  }

  if (type === "bp") {
    const match = rawStr.match(/(\d+)\/(\d+)/);
    if (match) {
      const sys = parseInt(match[1] ?? "", 10);
      const dia = parseInt(match[2] ?? "", 10);
      if (sys >= 160 || dia >= 100) {
        return { status: "critical", tag: "Stage 2 HTN", border: "border-rose-300 bg-rose-50 text-rose-800", displayValue: rawStr };
      }
      if (sys >= 140 || dia >= 90) {
        return { status: "warning", tag: "Stage 1 HTN", border: "border-amber-300 bg-amber-50 text-amber-800", displayValue: rawStr };
      }
      if (sys < 90) {
        return { status: "warning", tag: "Hypotension", border: "border-amber-300 bg-amber-50 text-amber-800", displayValue: rawStr };
      }
    }
    return { status: "normal", tag: "Optimal", border: "border-emerald-200 bg-emerald-50/70 text-emerald-900", displayValue: rawStr };
  }

  if (type === "pulse") {
    const p = Number(value);
    if (!Number.isFinite(p) || p <= 0) {
      return { status: "unknown", tag: "Not recorded", border: "border-[#E3DDD0] bg-[#FAF7F0] text-[#586C64]", displayValue: "Not recorded" };
    }
    if (p > 115 || p < 45) {
      return { status: "critical", tag: p < 45 ? "Severe Bradycardia" : "Marked Tachycardia", border: "border-rose-300 bg-rose-50 text-rose-800", displayValue: `${p} bpm` };
    }
    if (p > 100) {
      return { status: "warning", tag: "Tachycardia", border: "border-amber-300 bg-amber-50 text-amber-800", displayValue: `${p} bpm` };
    }
    if (p < 60) {
      return { status: "warning", tag: "Bradycardia", border: "border-amber-300 bg-amber-50 text-amber-800", displayValue: `${p} bpm` };
    }
    return { status: "normal", tag: "Normal Sinus", border: "border-emerald-200 bg-emerald-50/70 text-emerald-900", displayValue: `${p} bpm` };
  }

  if (type === "spo2") {
    const s = Number(value);
    if (!Number.isFinite(s) || s <= 0) {
      return { status: "unknown", tag: "Not recorded", border: "border-[#E3DDD0] bg-[#FAF7F0] text-[#586C64]", displayValue: "Not recorded" };
    }
    if (s < 92) {
      return { status: "critical", tag: "Hypoxia Alert", border: "border-rose-300 bg-rose-50 text-rose-800", displayValue: `${s}%` };
    }
    if (s < 95) {
      return { status: "warning", tag: "Borderline Saturation", border: "border-amber-300 bg-amber-50 text-amber-800", displayValue: `${s}%` };
    }
    return { status: "normal", tag: "Optimal SpO2", border: "border-emerald-200 bg-emerald-50/70 text-emerald-900", displayValue: `${s}%` };
  }

  const t = parseFloat(rawStr);
  if (!Number.isFinite(t) || t <= 0) {
    return { status: "unknown", tag: "Not recorded", border: "border-[#E3DDD0] bg-[#FAF7F0] text-[#586C64]", displayValue: "Not recorded" };
  }
  if (t >= 102.0) {
    return { status: "critical", tag: "High Pyrexia", border: "border-rose-300 bg-rose-50 text-rose-800", displayValue: rawStr };
  }
  if (t >= 99.5) {
    return { status: "warning", tag: "Subfebrile / Fever", border: "border-amber-300 bg-amber-50 text-amber-800", displayValue: rawStr };
  }
  return { status: "normal", tag: "Normothermic", border: "border-emerald-200 bg-emerald-50/70 text-emerald-900", displayValue: rawStr };
}

export type AlertSeverity = "EMERGENCY" | "HIGH" | "MEDIUM" | "INFO";
export type AlertDestination =
  | "consultation"
  | "queue"
  | "rx"
  | "cbc"
  | "casualty"
  | "ipd"
  | "ayush";

export interface ClinicianAlert {
  id: string;
  sourceModule: string;
  rawSeverity: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  patientName?: string;
  encounterId?: string;
  patientKey?: string;
  timestamp?: string;
  statusLabel: string;
  destination: AlertDestination;
  primaryActionLabel: string;
  secondaryDestination?: AlertDestination;
  secondaryActionLabel?: string;
  distressEvent?: OpdDistressEvent;
}

export interface CasualtyReferralRow {
  id: string;
  name: string;
  status: string;
  tokenNumber: string | null;
}

export interface CasualtyAdmissionRow {
  id: string;
  encounter_id: string;
  location_id: string;
  name: string;
  tokenNumber: string | null;
  reason: string;
}

export interface BuildAlertsInput {
  queue: OpdQueueItem[];
  distressEvents: OpdDistressEvent[];
  casualtyEncounters: CasualtyReferralRow[];
  casualtyAdmissions: CasualtyAdmissionRow[];
  hdiOverrides?: Record<string, boolean>;
  cbcConnected?: boolean;
  cbcEncounterIds?: string[];
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  EMERGENCY: 0,
  HIGH: 1,
  MEDIUM: 2,
  INFO: 3,
};

const COMPLEMENTARY_AYUSH_CHECK = [
  { drug: "Triphala Guggulu" },
  { drug: "Ashwagandha Churna" },
  { drug: "Lasuna (Garlic Extract)" },
];

export function mapRawSeverityToBucket(raw: string): AlertSeverity {
  const normalized = raw.trim().toUpperCase();
  if (
    normalized === "EMERGENCY" ||
    normalized === "CODE_BLUE" ||
    normalized === "STAT_ALERT" ||
    normalized === "CONTRAINDICATED" ||
    normalized === "CRITICAL_HYPOXIA"
  ) {
    return "EMERGENCY";
  }
  if (
    normalized === "HIGH" ||
    normalized === "HIGH_RISK" ||
    normalized === "CRITICAL" ||
    normalized === "CRITICAL_VITAL" ||
    normalized === "OPD-REQUESTED" ||
    normalized === "URGENT"
  ) {
    return "HIGH";
  }
  if (
    normalized === "MEDIUM" ||
    normalized === "WARNING" ||
    normalized === "WARNING_VITAL" ||
    normalized === "MODERATE_CAUTION" ||
    normalized === "ALLERGY_UNVERIFIED" ||
    normalized === "REVIEW"
  ) {
    return "MEDIUM";
  }
  return "INFO";
}

export function buildClinicianAlerts(input: BuildAlertsInput): ClinicianAlert[] {
  const byId = new Map<string, ClinicianAlert>();
  const casualtyReferredIds = new Set(input.casualtyEncounters.map((e) => e.id));
  const casualtyBayByEncounter = new Map(
    input.casualtyAdmissions.map((adm) => [adm.encounter_id, adm]),
  );

  // 1. Active IPD Bedside Code Blue / Distress Alerts
  for (const ev of input.distressEvents) {
    const id = `distress:${ev.id}`;
    byId.set(id, {
      id,
      sourceModule: "Code Blue · IPD Distress",
      rawSeverity: "CODE_BLUE",
      severity: "EMERGENCY",
      title: `Code Blue — ${ev.room} · ${ev.bed}`,
      description:
        [ev.patientName ?? "Consent-restricted patient", ev.diagnosis, ev.reason]
          .filter(Boolean)
          .join(" · ") || "Active bedside distress alert requires clinical attention.",
      patientName: ev.patientName ?? undefined,
      timestamp: ev.triggeredAt,
      statusLabel: ev.acknowledgedAt ? "Attending · En Route" : "Active — Unacknowledged",
      destination: "ipd",
      primaryActionLabel: "Open IPD",
      distressEvent: ev,
    });
  }

  // 2. Emergency / STAT Triage & Encounter-Level Clinical Safety Alerts
  for (const patient of input.queue) {
    const pKey = opdQueueIdentity(patient);
    const encId = patient.encounterId ?? patient.cbcEncounterId;
    const isActiveCare = patient.consentActive !== false;

    if (patient.status === "STAT_ALERT") {
      const id = `stat-encounter:${encId ?? pKey}`;
      const referred = encId ? casualtyReferredIds.has(encId) : false;
      const inBay = encId ? casualtyBayByEncounter.get(encId) : undefined;
      byId.set(id, {
        id,
        sourceModule: referred ? "Triage Sentinel · Casualty Referral" : "Triage Sentinel",
        rawSeverity: "STAT_ALERT",
        severity: "EMERGENCY",
        title: `${patient.token} — Emergency triage case`,
        description:
          `${patient.symptoms.join(", ") || "Emergency presentation"}` +
          (inBay
            ? ` · Assigned to casualty bay${inBay.reason ? ` (${inBay.reason})` : ""}`
            : referred
              ? " · Referred to you for emergency bay coordination"
              : ""),
        patientName: patient.name,
        encounterId: encId,
        patientKey: pKey,
        timestamp: patient.createdAtIso ?? patient.checkInTime,
        statusLabel: inBay ? "In Casualty Bay" : "Emergency Triage Active",
        destination: "consultation",
        primaryActionLabel: "Open Consultation",
        secondaryDestination: "casualty",
        secondaryActionLabel: "Open Casualty",
      });
    }

    // 3. Nurse Outreach OPD Review Escalation
    if (patient.outreachReviewRequested && isActiveCare) {
      const id = `outreach:${encId ?? pKey}`;
      byId.set(id, {
        id,
        sourceModule: "Nurse Outreach Follow-up",
        rawSeverity: "opd-requested",
        severity: "HIGH",
        title: `Post-discharge OPD review requested — ${patient.token}`,
        description: "Nursing post-discharge check-in escalated this encounter for clinician OPD follow-up.",
        patientName: patient.name,
        encounterId: encId,
        patientKey: pKey,
        timestamp: patient.createdAtIso ?? patient.checkInTime,
        statusLabel: patient.savedSoapNote ? "OPD Review Recorded" : "OPD Review Pending",
        destination: "consultation",
        primaryActionLabel: "Open Consultation",
      });
    }

    // 4. Critical or Warning Vitals (strictly only when genuine measurements exist)
    const spo2 = evaluatePatientVital(patient, "spo2");
    const bp = evaluatePatientVital(patient, "bp");
    const pulse = evaluatePatientVital(patient, "pulse");
    const temp = evaluatePatientVital(patient, "temp");

    const criticalParts: string[] = [];
    const warningParts: string[] = [];
    for (const [label, evalRes] of [
      ["SpO₂", spo2],
      ["BP", bp],
      ["Pulse", pulse],
      ["Temp", temp],
    ] as const) {
      if (evalRes.status === "critical") {
        criticalParts.push(`${label}: ${evalRes.displayValue} (${evalRes.tag})`);
      } else if (evalRes.status === "warning") {
        warningParts.push(`${label}: ${evalRes.displayValue} (${evalRes.tag})`);
      }
    }

    if (criticalParts.length > 0 && isActiveCare) {
      const isHypoxia = spo2.status === "critical";
      const id = `vitals-critical:${encId ?? pKey}`;
      byId.set(id, {
        id,
        sourceModule: "Vitals Telemetry",
        rawSeverity: isHypoxia ? "CRITICAL_HYPOXIA" : "CRITICAL_VITAL",
        severity: isHypoxia ? "EMERGENCY" : "HIGH",
        title: `Critical vital reading — ${patient.token}`,
        description: criticalParts.join(" · "),
        patientName: patient.name,
        encounterId: encId,
        patientKey: pKey,
        timestamp: patient.createdAtIso ?? patient.checkInTime,
        statusLabel: "Requires immediate review",
        destination: "consultation",
        primaryActionLabel: "Review Vitals",
      });
    } else if (warningParts.length > 0 && isActiveCare && !patient.savedSoapNote) {
      const id = `vitals-warning:${encId ?? pKey}`;
      byId.set(id, {
        id,
        sourceModule: "Vitals Telemetry",
        rawSeverity: "WARNING_VITAL",
        severity: "MEDIUM",
        title: `Abnormal intake vitals — ${patient.token}`,
        description: warningParts.join(" · "),
        patientName: patient.name,
        encounterId: encId,
        patientKey: pKey,
        timestamp: patient.createdAtIso ?? patient.checkInTime,
        statusLabel: "Active",
        destination: "consultation",
        primaryActionLabel: "Review Vitals",
      });
    }

    // 5. Pharmacovigilance Herb-Drug Interaction Alerts (on active plans)
    if (patient.soap.plan.length > 0 && isActiveCare) {
      const interactions: HerbDrugInteraction[] = checkHerbDrugInteractions(
        patient.soap.plan,
        COMPLEMENTARY_AYUSH_CHECK,
      );
      for (const hdi of interactions) {
        const overridden = Boolean(input.hdiOverrides?.[pKey]);
        const id = `hdi:${encId ?? pKey}:${hdi.id}`;
        byId.set(id, {
          id,
          sourceModule: "Pharmacovigilance Sentinel",
          rawSeverity: hdi.severity,
          severity: mapRawSeverityToBucket(hdi.severity),
          title: `Herb-Drug Interaction: ${hdi.allopathicDrug} + ${hdi.ayurvedicHerb}`,
          description: `${hdi.clinicalRisk}. ${hdi.recommendation}`,
          patientName: patient.name,
          encounterId: encId,
          patientKey: pKey,
          timestamp: patient.createdAtIso ?? patient.checkInTime,
          statusLabel: overridden ? "Clinical override documented" : "Blocking safety review",
          destination: "rx",
          primaryActionLabel: "Review Prescriptions",
          secondaryDestination: "ayush",
          secondaryActionLabel: "Open AYUSH",
        });
      }
    }

    // 6. Missing Allergy Verification & Missing Baseline Vitals on Unsigned Active Encounters
    if (isActiveCare && !patient.prescriptionStatus) {
      const allergyId = `missing-allergy:${encId ?? pKey}`;
      byId.set(allergyId, {
        id: allergyId,
        sourceModule: "Prescribing Safety",
        rawSeverity: "ALLERGY_UNVERIFIED",
        severity: "MEDIUM",
        title: `Allergies not recorded — ${patient.token}`,
        description: "Verify patient drug allergies before prescribing or signing pharmacy orders.",
        patientName: patient.name,
        encounterId: encId,
        patientKey: pKey,
        timestamp: patient.createdAtIso ?? patient.checkInTime,
        statusLabel: "Verify before prescribing",
        destination: "rx",
        primaryActionLabel: "Verify in Prescriptions",
        secondaryDestination: "consultation",
        secondaryActionLabel: "Open Consultation",
      });
    }

    if (
      isActiveCare &&
      !patient.savedSoapNote &&
      bp.status === "unknown" &&
      pulse.status === "unknown" &&
      spo2.status === "unknown"
    ) {
      const missingVitalId = `missing-vitals:${encId ?? pKey}`;
      byId.set(missingVitalId, {
        id: missingVitalId,
        sourceModule: "Patient Intake Check",
        rawSeverity: "MISSING_VITALS",
        severity: "INFO",
        title: `Baseline vitals unrecorded — ${patient.token}`,
        description: "BP, pulse, and SpO₂ were not recorded during intake.",
        patientName: patient.name,
        encounterId: encId,
        patientKey: pKey,
        timestamp: patient.createdAtIso ?? patient.checkInTime,
        statusLabel: "Pending measurement",
        destination: "consultation",
        primaryActionLabel: "Open Consultation",
      });
    }
  }

  // 7. Referred casualty emergency encounters not already present in /encounters
  for (const ref of input.casualtyEncounters) {
    const id = `stat-encounter:${ref.id}`;
    if (!byId.has(id)) {
      byId.set(`casualty-ref:${ref.id}`, {
        id: `casualty-ref:${ref.id}`,
        sourceModule: "Casualty Referral",
        rawSeverity: "STAT_ALERT",
        severity: "EMERGENCY",
        title: `${ref.tokenNumber ?? ref.id.slice(0, 8)} — Referred emergency encounter`,
        description: "Emergency encounter referred to you in Casualty bays.",
        patientName: ref.name,
        encounterId: ref.id,
        destination: "casualty",
        primaryActionLabel: "Open Casualty",
        statusLabel: ref.status,
      });
    }
  }

  // 8. CBC Clinical Workspace Awareness (strictly only when doctor already connected authenticated CBC session)
  if (input.cbcConnected && (input.cbcEncounterIds?.length ?? 0) > 0) {
    const id = "cbc-session-ready";
    byId.set(id, {
      id,
      sourceModule: "CBC Clinical Workspace",
      rawSeverity: "INFO",
      severity: "INFO",
      title: `CBC workspace connected (${input.cbcEncounterIds?.length ?? 0} eligible encounter(s))`,
      description: "Review uploaded CBC measurements or experimental screening notes for authorized encounters.",
      statusLabel: "Authenticated Session",
      destination: "cbc",
      primaryActionLabel: "Open CBC Reports",
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sevDiff !== 0) return sevDiff;
    const ackA = a.distressEvent?.acknowledgedAt ? 1 : 0;
    const ackB = b.distressEvent?.acknowledgedAt ? 1 : 0;
    if (ackA !== ackB) return ackA - ackB;
    return (b.timestamp ?? "").localeCompare(a.timestamp ?? "");
  });
}

export interface OpdOverviewMetrics {
  inQueue: number | null;
  totalQueue: number | null;
  inConsultation: number | null;
  highPriority: number | null;
  awaitingAdmission: {
    available: false;
    value: null;
    reason: string;
  };
}

export function computeOpdOverviewMetrics(
  queue: OpdQueueItem[],
  queueRequest: "loading" | "loaded" | "error",
  alerts: ClinicianAlert[],
  alertsError: boolean,
): OpdOverviewMetrics {
  const queueAvailable = queueRequest === "loaded" || queue.length > 0;
  return {
    inQueue: queueAvailable
      ? queue.filter((q) => q.status === "WAITING" || q.status === "STAT_ALERT").length
      : null,
    totalQueue: queueAvailable ? queue.length : null,
    inConsultation: queueAvailable
      ? queue.filter((q) => q.status === "IN_CONSULT").length
      : null,
    highPriority:
      alertsError && !queueAvailable
        ? null
        : alerts.filter((a) => a.severity === "EMERGENCY" || a.severity === "HIGH").length,
    awaitingAdmission: {
      available: false,
      value: null,
      reason: "Separate admission-request queue is not exposed by current API; open IPD workflow.",
    },
  };
}
