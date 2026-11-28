import {
  type SavedPrescriptionDraft,
} from "../../../../../packages/shared/operations";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ShellEmergencyEvent } from "@/components/ShellEmergency";
import { confirmCbcNavigation } from "@/features/cbc/navigation";
import type { DoctorSession } from "@/features/cbc/api";
import { staffApi } from "@/lib/staffApi";
import { encounterListSchema, type Encounter } from "../../../../../packages/shared/integration";
import {
  buildClinicianAlerts,
  computeOpdOverviewMetrics,
  opdQueueIdentity,
  type AlertDestination,
  type CasualtyAdmissionRow,
  type CasualtyReferralRow,
  type ClinicianAlert,
  type OpdOverviewMetrics,
  type OpdPrescriptionItem,
  type OpdPrescriptionReview,
  type OpdQueueItem,
} from "./opdMetricsAndAlerts";

export type OpdQueueFilter =
  | "all"
  | "stat"
  | "waiting"
  | "in_consult"
  | "dispensed"
  | "pmjay";

export interface CardiacChecklistState {
  ecgVerified: boolean;
  troponinVerified: boolean;
  bleedRiskCleared: boolean;
}

function encounterVitals(review: Encounter["clinicalReview"]): OpdQueueItem["vitals"] {
  const vitals = review?.vitals;
  return {
    bp: vitals?.bloodPressure ? `${vitals.bloodPressure} mmHg` : "Not recorded",
    pulse: vitals?.pulse ?? 0,
    spo2: vitals?.spo2 ?? 0,
    temp: vitals?.temperatureF === undefined ? "Not recorded" : `${vitals.temperatureF}°F`,
  };
}

const DEFAULT_CARDIAC_CHECKS: CardiacChecklistState = {
  ecgVerified: false,
  troponinVerified: false,
  bleedRiskCleared: false,
};

interface OpdWorkspaceContextValue {
  queue: OpdQueueItem[];
  queueRequest: "loading" | "loaded" | "error";
  selectedPatientId: string;
  activePatient: OpdQueueItem | null;
  activePatientKey: string;
  clinicalEncounterId?: string;
  filter: OpdQueueFilter;
  setFilter: (f: OpdQueueFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  refreshQueue: () => void;
  selectPatient: (selectionId: string, navigateToConsultation?: boolean) => boolean;
  updatePatientPlan: (patientKey: string, plan: OpdPrescriptionItem[]) => void;
  applyScribeDraftToActive: (draft: {
    subjective: string;
    objective: string;
    assessment: string;
    planItems: OpdPrescriptionItem[];
  }) => void;
  updatePrescriptionReview: (encounterId: string, updates: OpdPrescriptionReview) => void;
  restorePrescriptionDraft: (encounterId: string, draft: SavedPrescriptionDraft | null) => void;
  markPrescriptionDraftSaved: (encounterId: string, revision: number) => void;
  markEncounterSoapSaved: (encounterId: string, note: string, review?: Encounter["clinicalReview"]) => void;
  markEncounterPrescriptionSigned: (encounterId: string) => void;

  // Per-encounter isolated draft & verification states
  soapDraft: string | null;
  setSoapDraft: (value: string | null) => void;
  soapSignOff: boolean;
  setSoapSignOff: (value: boolean) => void;
  soapSaved: boolean;
  setSoapSaved: (value: boolean) => void;

  cardiacChecks: CardiacChecklistState;
  setCardiacCheck: (field: keyof CardiacChecklistState, value: boolean) => void;

  // CBC session integration (preserved strictly isolated)
  cbcSession: DoctorSession | null;
  cbcDirty: boolean;
  setCbcDirty: (dirty: boolean) => void;
  cbcEncounterIds: string[];
  connectCbc: (session: DoctorSession | null, encounters: Encounter[]) => void;

  // Centralized alerts & overview metrics
  alerts: ClinicianAlert[];
  alertsLoading: boolean;
  alertFeedErrors: string[];
  refreshAlerts: () => void;
  metrics: OpdOverviewMetrics;

  // Safe navigation helpers
  navigateOpd: (path: string) => void;
  navigateFromAlert: (alert: ClinicianAlert, target?: AlertDestination) => void;
}

const OpdWorkspaceContext = createContext<OpdWorkspaceContextValue | null>(null);

export const distressChangedEvent = "jeevika:distress-changed";

export function OpdWorkspaceProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [queue, setQueue] = useState<OpdQueueItem[]>([]);
  const [queueRevision, setQueueRevision] = useState(0);
  const [queueRequest, setQueueRequest] = useState<"loading" | "loaded" | "error">("loading");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [filter, setFilter] = useState<OpdQueueFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Isolated per-encounter clinical state maps (preventing patient-to-patient leak)
  const [soapDrafts, setSoapDrafts] = useState<Record<string, string | null>>({});
  const [soapSignOffs, setSoapSignOffs] = useState<Record<string, boolean>>({});
  const [soapSavedMap, setSoapSavedMap] = useState<Record<string, boolean>>({});
  const [cardiacChecksMap, setCardiacChecksMap] = useState<Record<string, CardiacChecklistState>>({});

  // CBC state
  const [cbcSession, setCbcSession] = useState<DoctorSession | null>(null);
  const [cbcDirty, setCbcDirty] = useState(false);
  const [cbcEncounterIds, setCbcEncounterIds] = useState<string[]>([]);
  const cbcSessionToken = useRef<string | null>(null);

  // Additional clinician-authorized alert sources
  const [distressEvents, setDistressEvents] = useState<ShellEmergencyEvent[]>([]);
  const [casualtyEncounters, setCasualtyEncounters] = useState<CasualtyReferralRow[]>([]);
  const [casualtyAdmissions, setCasualtyAdmissions] = useState<CasualtyAdmissionRow[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertFeedErrors, setAlertFeedErrors] = useState<string[]>([]);
  const [alertRevision, setAlertRevision] = useState(0);

  // Fetch clinician queue & authorized backend alert sources
  useEffect(() => {
    if (!enabled) {
      setQueue([]);
      setSelectedPatientId("");
      setDistressEvents([]);
      setCasualtyEncounters([]);
      setCasualtyAdmissions([]);
      return;
    }

    const lifetime = new AbortController();
    let pending = false;

    async function loadClinicianFeeds() {
      if (pending || document.hidden || lifetime.signal.aborted) return;
      pending = true;
      const errors: string[] = [];

      const [encRes, distressRes, casualtyRes] = await Promise.allSettled([
        staffApi<unknown>("/encounters", { signal: lifetime.signal }),
        staffApi<{ events: ShellEmergencyEvent[] }>("/clinical/ipd/distress/active", {
          signal: lifetime.signal,
        }),
        staffApi<{
          encounters: CasualtyReferralRow[];
          admissions: CasualtyAdmissionRow[];
        }>("/clinical/casualty/board", { signal: lifetime.signal }),
      ]);

      if (lifetime.signal.aborted) {
        pending = false;
        return;
      }

      if (encRes.status === "fulfilled") {
        try {
          const { encounters } = encounterListSchema.parse(encRes.value);
          const mapped = encounters.map((record): OpdQueueItem => ({
            kioskIntake: true,
            encounterId: record.id,
            patientId: record.patientId,
            token: record.tokenNumber ?? record.id.slice(0, 8),
            documentReview: record.documentReview,
            outreachReviewRequested: record.outreachReviewRequested,
            consentActive: record.consentActive,
            savedSoapNote: record.reviewNote,
            clinicalReview: record.clinicalReview,
            prescriptionStatus: record.prescriptionStatus,
            name: record.patientName,
            age: null,
            gender: "UNRECORDED",
            abhaId: "",
            pmjayEligible: false,
            status:
              record.status === "emergency"
                ? "STAT_ALERT"
                : record.status === "reviewed"
                  ? "IN_CONSULT"
                  : "WAITING",
            checkInTime: new Date(record.createdAt).toLocaleTimeString(),
            createdAtIso: record.createdAt,
            symptoms: [record.chiefComplaint],
            vitals: encounterVitals(record.clinicalReview),
            soap: {
              subjective: record.chiefComplaint,
              objective: "No measurements recorded.",
              assessment: record.reviewNote ?? "",
              icd11Code: "",
              plan: [],
            },
          }));
          setQueue((previous) => {
            const byId = new Map(previous.map((entry) => [entry.encounterId, entry]));
            return [
              ...mapped.map((entry) => {
                const existing = byId.get(entry.encounterId);
                return existing?.kioskIntake || existing?.cbcEncounterId
                  ? {
                      ...entry,
                      cbcEncounterId: existing.cbcEncounterId,
                      token:
                        existing.cbcEncounterId && !entry.token.startsWith("OPD-")
                          ? existing.token
                          : entry.token,
                      soap: existing.soap,
                      prescriptionReview: existing.prescriptionReview,
                      prescriptionDraftRevision: existing.prescriptionDraftRevision,
                    }
                  : entry;
              }),
              ...previous.filter(
                (entry) =>
                  !entry.kioskIntake &&
                  !mapped.some(({ encounterId }) => encounterId === entry.encounterId),
              ),
            ];
          });
          setQueueRequest("loaded");
        } catch {
          setQueueRequest("error");
          errors.push("Clinical encounter queue could not be parsed.");
        }
      } else {
        setQueueRequest("error");
        errors.push("Patient encounter feed is unavailable.");
      }

      if (distressRes.status === "fulfilled") {
        setDistressEvents(distressRes.value.events ?? []);
      } else {
        errors.push("Code Blue / inpatient distress alerts are unavailable.");
      }

      if (casualtyRes.status === "fulfilled") {
        setCasualtyEncounters(casualtyRes.value.encounters ?? []);
        setCasualtyAdmissions(casualtyRes.value.admissions ?? []);
      } else {
        errors.push("Casualty referral feed is unavailable.");
      }

      setAlertFeedErrors(errors);
      setAlertsLoading(false);
      pending = false;
    }

    void loadClinicianFeeds();
    const polling = window.setInterval(() => void loadClinicianFeeds(), 15_000);
    const onVisibility = () => void loadClinicianFeeds();
    const onDistress = () => void loadClinicianFeeds();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(distressChangedEvent, onDistress);

    return () => {
      lifetime.abort();
      clearInterval(polling);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(distressChangedEvent, onDistress);
    };
  }, [enabled, queueRevision, alertRevision]);

  // Ensure selectedPatientId stays valid if current selection leaves the queue
  useEffect(() => {
    if (!queue.length) {
      setSelectedPatientId("");
      return;
    }
    if (selectedPatientId && !queue.some((entry) => opdQueueIdentity(entry) === selectedPatientId)) {
      setSelectedPatientId(opdQueueIdentity(queue[0]));
    }
  }, [queue, selectedPatientId]);

  const activePatient = useMemo(
    () => (selectedPatientId ? queue.find((p) => opdQueueIdentity(p) === selectedPatientId) ?? null : null),
    [queue, selectedPatientId],
  );
  const activePatientKey = activePatient ? opdQueueIdentity(activePatient) : "";
  const clinicalEncounterId = activePatient?.kioskIntake ? activePatient.encounterId : undefined;

  const connectCbc = useCallback((session: DoctorSession | null, encounters: Encounter[]) => {
    const sameSession = cbcSessionToken.current === (session?.token ?? null);
    cbcSessionToken.current = session?.token ?? null;
    setCbcSession(session);
    setCbcEncounterIds(encounters.map((e) => e.id));
    if (!sameSession || !session) setCbcDirty(false);
    setQueue((previous) => {
      const previousById = new Map(previous.map((row) => [row.encounterId, row]));
      const cbcIds = new Set(encounters.map(({ id }) => id));
      const clinical: OpdQueueItem[] = encounters.map((enc) => {
        const existing = previousById.get(enc.id);
        const token = enc.tokenNumber ?? `Clinical ${enc.id.slice(0, 8)}`;
        if (existing?.kioskIntake) return { ...existing, cbcEncounterId: enc.id, token };
        if (sameSession && existing?.cbcEncounterId) return existing;
        return {
          cbcEncounterId: enc.id,
          encounterId: enc.id,
          patientId: enc.patientId,
          name: enc.patientName,
          consentActive: enc.consentActive,
          outreachReviewRequested: enc.outreachReviewRequested,
          savedSoapNote: enc.reviewNote,
          clinicalReview: enc.clinicalReview,
          prescriptionStatus: enc.prescriptionStatus,
          token,
          age: null,
          gender: "UNRECORDED",
          abhaId: "",
          pmjayEligible: false,
          status:
            enc.status === "emergency"
              ? "STAT_ALERT"
              : enc.status === "reviewed"
                ? "IN_CONSULT"
                : "WAITING",
          checkInTime: new Date(enc.createdAt).toLocaleTimeString(),
          createdAtIso: enc.createdAt,
          symptoms: [enc.chiefComplaint],
          vitals: encounterVitals(enc.clinicalReview),
          soap: {
            subjective: enc.chiefComplaint,
            objective: "No measurements recorded.",
            assessment: enc.reviewNote ?? "",
            icd11Code: "",
            plan: [],
          },
        };
      });
      return [
        ...clinical,
        ...previous
          .filter((row) => row.kioskIntake && row.encounterId && !cbcIds.has(row.encounterId))
          .map((row) => ({ ...row, cbcEncounterId: undefined })),
      ];
    });
  }, []);

  const selectPatient = useCallback(
    (selectionId: string, navigateToConsultation = false): boolean => {
      if (cbcDirty && selectionId !== selectedPatientId) {
        if (!window.confirm("Discard the unsaved CBC draft and switch consultation?")) {
          return false;
        }
        setCbcDirty(false);
      }
      const selected = queue.find((item) => opdQueueIdentity(item) === selectionId);
      if (!selected) return false;
      setSelectedPatientId(selectionId);
      if (navigateToConsultation) {
        navigate("/app/doctor/consultation");
      }
      return true;
    },
    [cbcDirty, selectedPatientId, queue, navigate],
  );

  const navigateOpd = useCallback(
    (targetPath: string) => {
      const leavingCbc =
        location.pathname === "/app/doctor/cbc" && !targetPath.startsWith("/app/doctor/cbc");
      if (leavingCbc && !confirmCbcNavigation()) return;
      navigate(targetPath);
    },
    [location.pathname, navigate],
  );

  const updatePatientPlan = useCallback((patientKey: string, plan: OpdPrescriptionItem[]) => {
    setQueue((prev) =>
      prev.map((row) =>
        opdQueueIdentity(row) === patientKey ? { ...row, soap: { ...row.soap, plan } } : row,
      ),
    );
  }, []);

  const applyScribeDraftToActive = useCallback(
    (draft: {
      subjective: string;
      objective: string;
      assessment: string;
      planItems: OpdPrescriptionItem[];
    }) => {
      if (!activePatientKey) return;
      setQueue((prev) =>
        prev.map((patient) => {
          if (opdQueueIdentity(patient) !== activePatientKey && patient.patientId !== activePatientKey)
            return patient;
          const existingDrugs = new Set(patient.soap.plan.map((p) => p.drug.toLowerCase()));
          const newItems = draft.planItems.filter((p) => !existingDrugs.has(p.drug.toLowerCase()));
          return {
            ...patient,
            soap: {
              ...patient.soap,
              subjective: draft.subjective || patient.soap.subjective,
              objective: draft.objective || patient.soap.objective,
              assessment: draft.assessment || patient.soap.assessment,
              plan: [...patient.soap.plan, ...newItems],
            },
          };
        }),
      );
    },
    [activePatientKey],
  );

  const updatePrescriptionReview = useCallback((encounterId: string, updates: OpdPrescriptionReview) => {
    setQueue((current) => current.map((row) =>
      row.encounterId === encounterId
        ? { ...row, prescriptionReview: { ...row.prescriptionReview, ...updates } }
        : row,
    ));
  }, []);

  const restorePrescriptionDraft = useCallback((encounterId: string, draft: SavedPrescriptionDraft | null) => {
    setQueue((current) => current.map((row) => {
      if (row.encounterId !== encounterId || row.prescriptionDraftRevision !== undefined) return row;
      if (!draft) return { ...row, prescriptionDraftRevision: 0 };
      const localItems = row.soap.plan.filter((item) =>
        !draft.plan.some((saved) => saved.drug === item.drug && saved.dosage === item.dosage),
      );
      return {
        ...row,
        soap: { ...row.soap, plan: [...draft.plan, ...localItems] },
        prescriptionReview: draft.review,
        prescriptionDraftRevision: draft.revision,
      };
    }));
  }, []);

  const markPrescriptionDraftSaved = useCallback((encounterId: string, revision: number) => {
    setQueue((current) => current.map((row) =>
      row.encounterId === encounterId ? { ...row, prescriptionDraftRevision: revision } : row,
    ));
  }, []);

  const markEncounterSoapSaved = useCallback((encounterId: string, note: string, review?: Encounter["clinicalReview"]) => {
    setQueue((current) =>
      current.map((row) =>
        opdQueueIdentity(row) === encounterId || row.encounterId === encounterId
          ? { ...row, status: "IN_CONSULT", savedSoapNote: note, clinicalReview: review ?? row.clinicalReview, vitals: review ? encounterVitals(review) : row.vitals }
          : row,
      ),
    );
  }, []);

  const markEncounterPrescriptionSigned = useCallback((encounterId: string) => {
    setQueue((current) =>
      current.map((row) =>
        opdQueueIdentity(row) === encounterId || row.encounterId === encounterId
          ? { ...row, prescriptionStatus: "signed" }
          : row,
      ),
    );
  }, []);

  const soapDraft = activePatientKey ? (soapDrafts[activePatientKey] ?? null) : null;
  const setSoapDraft = useCallback(
    (value: string | null) => {
      if (!activePatientKey) return;
      setSoapDrafts((prev) => ({ ...prev, [activePatientKey]: value }));
    },
    [activePatientKey],
  );

  const soapSignOff = activePatientKey ? Boolean(soapSignOffs[activePatientKey]) : false;
  const setSoapSignOff = useCallback(
    (value: boolean) => {
      if (!activePatientKey) return;
      setSoapSignOffs((prev) => ({ ...prev, [activePatientKey]: value }));
    },
    [activePatientKey],
  );

  const soapSaved = activePatientKey ? Boolean(soapSavedMap[activePatientKey]) : false;
  const setSoapSaved = useCallback(
    (value: boolean) => {
      if (!activePatientKey) return;
      setSoapSavedMap((prev) => ({ ...prev, [activePatientKey]: value }));
    },
    [activePatientKey],
  );

  const cardiacChecks = activePatientKey
    ? (cardiacChecksMap[activePatientKey] ?? DEFAULT_CARDIAC_CHECKS)
    : DEFAULT_CARDIAC_CHECKS;
  const setCardiacCheck = useCallback(
    (field: keyof CardiacChecklistState, value: boolean) => {
      if (!activePatientKey) return;
      setCardiacChecksMap((prev) => ({
        ...prev,
        [activePatientKey]: {
          ...(prev[activePatientKey] ?? DEFAULT_CARDIAC_CHECKS),
          [field]: value,
        },
      }));
    },
    [activePatientKey],
  );

  const alerts = useMemo(
    () =>
      buildClinicianAlerts({
        queue,
        distressEvents,
        casualtyEncounters,
        casualtyAdmissions,
        cbcConnected: Boolean(cbcSession),
        cbcEncounterIds,
      }),
    [queue, distressEvents, casualtyEncounters, casualtyAdmissions, cbcSession, cbcEncounterIds],
  );

  const metrics = useMemo(
    () =>
      computeOpdOverviewMetrics(
        queue,
        queueRequest,
        alerts,
        alertFeedErrors.length >= 3,
      ),
    [queue, queueRequest, alerts, alertFeedErrors.length],
  );

  const refreshQueue = useCallback(() => {
    setQueueRequest("loading");
    setQueueRevision((v) => v + 1);
  }, []);

  const refreshAlerts = useCallback(() => {
    setAlertsLoading(true);
    setAlertRevision((v) => v + 1);
  }, []);

  const navigateFromAlert = useCallback(
    (alert: ClinicianAlert, targetOverride?: AlertDestination) => {
      const dest = targetOverride ?? alert.destination;
      if (alert.patientKey && queue.some((q) => opdQueueIdentity(q) === alert.patientKey)) {
        const switched = selectPatient(alert.patientKey, false);
        if (!switched) return;
      }
      if (dest === "consultation") return navigateOpd("/app/doctor/consultation");
      if (dest === "queue") return navigateOpd("/app/doctor/queue");
      if (dest === "rx") return navigateOpd("/app/doctor/rx");
      if (dest === "cbc") return navigateOpd("/app/doctor/cbc");
      if (dest === "casualty") return navigateOpd("/app/casualty");
      if (dest === "ipd") return navigateOpd("/app/ipd");
      if (dest === "ayush") return navigateOpd("/app/ayush");
    },
    [queue, selectPatient, navigateOpd],
  );

  const value = useMemo<OpdWorkspaceContextValue>(
    () => ({
      queue,
      queueRequest,
      selectedPatientId,
      activePatient,
      activePatientKey,
      clinicalEncounterId,
      filter,
      setFilter,
      searchQuery,
      setSearchQuery,
      refreshQueue,
      selectPatient,
      updatePatientPlan,
      updatePrescriptionReview,
      restorePrescriptionDraft,
      markPrescriptionDraftSaved,
      applyScribeDraftToActive,
      markEncounterSoapSaved,
      markEncounterPrescriptionSigned,
      soapDraft,
      setSoapDraft,
      soapSignOff,
      setSoapSignOff,
      soapSaved,
      setSoapSaved,

      cardiacChecks,
      setCardiacCheck,
      cbcSession,
      cbcDirty,
      setCbcDirty,
      cbcEncounterIds,
      connectCbc,
      alerts,
      alertsLoading,
      alertFeedErrors,
      refreshAlerts,
      metrics,
      navigateOpd,
      navigateFromAlert,
    }),
    [
      queue,
      queueRequest,
      selectedPatientId,
      activePatient,
      activePatientKey,
      clinicalEncounterId,
      filter,
      searchQuery,
      refreshQueue,
      selectPatient,
      updatePatientPlan,
      updatePrescriptionReview,
      restorePrescriptionDraft,
      markPrescriptionDraftSaved,
      applyScribeDraftToActive,
      markEncounterSoapSaved,
      markEncounterPrescriptionSigned,
      soapDraft,
      setSoapDraft,
      soapSignOff,
      setSoapSignOff,
      soapSaved,
      setSoapSaved,

      cardiacChecks,
      setCardiacCheck,
      cbcSession,
      cbcDirty,
      cbcEncounterIds,
      connectCbc,
      alerts,
      alertsLoading,
      alertFeedErrors,
      refreshAlerts,
      metrics,
      navigateOpd,
      navigateFromAlert,
    ],
  );

  return <OpdWorkspaceContext.Provider value={value}>{children}</OpdWorkspaceContext.Provider>;
}

export function useOpdWorkspace() {
  const ctx = useContext(OpdWorkspaceContext);
  if (!ctx) throw new Error("useOpdWorkspace must be used within OpdWorkspaceProvider");
  return ctx;
}

export function useOptionalOpdWorkspace() {
  return useContext(OpdWorkspaceContext);
}
