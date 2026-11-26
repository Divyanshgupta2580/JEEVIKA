import {
  cloneElement,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  FileText,
  Flower2,
  Leaf,
  RefreshCw,
  Sprout,
  Users,
} from "lucide-react";
import {
  dashavidha,
  ayushNoteSchema,
  type AyushNote,
} from "../../../../packages/shared/ayush";
import { Button, Input } from "@/components/ui/basic";
import {
  InlineBanner,
  ProgressBar,
  StatusChip,
} from "@/components/ui/design-primitives";
import { CareGoldCurve, CarePageWaveFooter } from "@/features/care/CareGoldCurve";
import {
  computeAyushMetrics,
  filterEligibleAyushEncounters,
  type AyushEncounterSummary,
} from "@/features/ayush/ayushMetrics";
import { staffApi, useStaffData } from "@/lib/staffApi";
import { checkHerbDrugInteractions } from "@/lib/herbDrugInteractions";
import "@/design-system/care-ayush.css";

type Encounter = AyushEncounterSummary;
type Case = {
  note: AyushNote | null;
  version: number;
  updatedAt: string | null;
  prescriptions: Array<{
    name: string;
    salt: string;
    units: number;
    directions: string;
  }>;
};

const examKeys = Object.keys(dashavidha) as Array<keyof typeof dashavidha>;
const examDefaults = Object.fromEntries(
  examKeys.map((item) => [item, ""]),
) as AyushNote["examination"];
const absentNote: AyushNote = {
  examination: examDefaults,
  dosha: { vata: null, pitta: null, kapha: null },
  agni: "",
  namasteCode: "",
  tm2Code: "",
  concurrentMedicines: [],
  formulations: [],
  plan: "",
};
const textarea =
  "w-full rounded-xl border border-[#D4DFD7] bg-white p-2.5 text-sm text-[#0E2420] focus:border-[#047C61] focus:outline-none";

export function AyushDashboard() {
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const encountersRef = useRef<HTMLDivElement>(null);
  const { data, error } = useStaffData<{ encounters: Encounter[] }>(
    "/encounters",
    revision,
  );
  const reviewed = data ? filterEligibleAyushEncounters(data.encounters) : undefined;
  const selected = reviewed?.find(({ id }) => id === selectedId);
  const metrics = computeAyushMetrics(data?.encounters, error);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      encountersRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="jvk-ca-page relative min-h-[calc(100dvh-112px)] flex flex-col justify-between gap-6">
      <div className="space-y-5">
        {/* Hero Header */}
        <section className="relative overflow-hidden rounded-[22px] py-2 sm:py-3 md:min-h-[144px] lg:min-h-[164px] md:flex md:items-center">
          <div className="relative z-10 w-full md:max-w-[54%] lg:max-w-[55%] space-y-2.5">
            <h1 className="jvk-motion-heading jvk-ca-serif text-[28px] sm:text-4xl lg:text-[38px] xl:text-[42px] font-semibold tracking-tight text-[#0E2420] leading-[1.15]">
              AYUSH{" "}
              <span className="relative inline-block pr-1">
                Portal
                <CareGoldCurve />
              </span>
            </h1>
            <p className="max-w-lg text-sm sm:text-[15px] leading-relaxed text-[#3F554D]">
              Integrative Ayurveda documentation supporting Dashavidha Pariksha, Prakriti &amp; Agni
              assessment, NAMASTE / ICD-11 TM-2 coding, and herb–drug safety checks.
            </p>
          </div>

          <img
            src="/assets/ayush/ayush-hero-artwork.png"
            alt=""
            aria-hidden="true"
            className="jvk-ca-mask-hero pointer-events-none select-none hidden md:block absolute top-0 right-0 h-[142px] lg:h-[164px] w-auto max-w-[44%] lg:max-w-[46%] object-contain object-right z-0 opacity-95"
          />
        </section>

        {error && <InlineBanner tone="critical" title={error} />}

        {/* 4 AYUSH KPI Cards */}
        <section
          aria-label="AYUSH overview statistics"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 xl:gap-4"
        >
          {/* Reviewed Encounters (Genuine count) */}
          <div className="jvk-ca-card-sage p-4 xl:p-5 flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E1F1E6] text-[#087F72]">
              <Users className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-xl xl:text-[26px] font-bold leading-tight text-[#0E2420] tabular-nums">
                {metrics.state === "loading"
                  ? "…"
                  : metrics.reviewedEncountersCount === null
                    ? "Unavailable"
                    : metrics.reviewedEncountersCount}
              </div>
              <div className="mt-1 text-xs font-medium text-[#4A6158]">
                Reviewed Encounters
              </div>
              <div className="text-[11px] text-[#647871]">Active care consent in clinic</div>
            </div>
          </div>

          {/* Care Plans in Progress (Honest Unavailable) */}
          <div className="jvk-ca-card-sage p-4 xl:p-5 flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E1F1E6] text-[#087F72]">
              <FileText className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-base xl:text-lg font-bold leading-tight text-[#4A5E56]">
                Unavailable
              </div>
              <div className="mt-1 text-xs font-medium text-[#4A6158]">
                Care Plans in Progress
              </div>
              <div className="text-[11px] text-[#647871]">{metrics.carePlansInProgress.reason}</div>
            </div>
          </div>

          {/* Integrated Therapies (Honest Unavailable) */}
          <div className="jvk-ca-card-amber p-4 xl:p-5 flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FBF0CF] text-[#B47F16]">
              <Flower2 className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-base xl:text-lg font-bold leading-tight text-[#5E481A]">
                Unavailable
              </div>
              <div className="mt-1 text-xs font-medium text-[#5E481A]">
                Integrated Therapies
              </div>
              <div className="text-[11px] text-[#7D6631]">{metrics.integratedTherapies.reason}</div>
            </div>
          </div>

          {/* Pending Recommendations (Honest Unavailable) */}
          <div className="jvk-ca-card-rose p-4 xl:p-5 flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FAD9D5] text-[#C5392F]">
              <AlertTriangle className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-base xl:text-lg font-bold leading-tight text-[#6C322E]">
                Unavailable
              </div>
              <div className="mt-1 text-xs font-medium text-[#6C322E]">
                Pending Recommendations
              </div>
              <div className="text-[11px] text-[#844B47]">{metrics.pendingRecommendations.reason}</div>
            </div>
          </div>
        </section>

        {/* Reviewed Encounters Workspace */}
        <section ref={encountersRef} className="space-y-4">
          {!data && !error && (
            <p role="status" className="text-sm font-medium text-[#4A6158] py-3">
              Loading reviewed encounters…
            </p>
          )}

          {reviewed?.length === 0 && (
            <div className="jvk-ca-card-white relative overflow-hidden p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 md:gap-8">
              <img
                src="/assets/ayush/ayush-mortar-empty.png"
                alt=""
                aria-hidden="true"
                className="jvk-ca-mask-left pointer-events-none select-none h-36 sm:h-44 w-auto object-contain shrink-0 relative z-10"
              />
              <div className="relative z-10 space-y-3 text-center md:text-left max-w-md">
                <h2 className="jvk-ca-serif text-xl sm:text-2xl font-bold text-[#0E2420]">
                  No reviewed encounters
                </h2>
                <p className="text-sm leading-relaxed text-[#4F635B]">
                  Reviewed encounters with active care consent in your clinic will appear here.
                </p>
                <div className="pt-1">
                  <Button
                    type="button"
                    onClick={() => setRevision((value) => value + 1)}
                    className="jvk-ca-primary-btn inline-flex min-h-11 items-center gap-2 px-5 py-2.5 text-sm font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Refresh encounters</span>
                  </Button>
                </div>
              </div>
              <img
                src="/assets/ayush/ayush-landscape-right.png"
                alt=""
                aria-hidden="true"
                className="jvk-ca-mask-right pointer-events-none select-none hidden lg:block absolute bottom-0 right-0 h-32 w-auto opacity-90 z-0"
              />
            </div>
          )}

          {!!reviewed?.length && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="jvk-ca-serif text-xl font-semibold text-[#0E2420]">
                  Reviewed clinic encounters
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRevision((value) => value + 1)}
                  className="rounded-xl border-[#D5CFC2] bg-white hover:bg-[#EEF6F0] text-[#0E2420] font-semibold gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Refresh encounters</span>
                </Button>
              </div>

              <div className="grid items-start gap-5 print:block lg:grid-cols-[minmax(15rem,1fr)_3fr]">
                <div className="jvk-ca-card-white p-4 space-y-3 print:hidden">
                  <h3 className="text-sm font-bold text-[#0E2420] uppercase tracking-wider">
                    Clinic encounters
                  </h3>
                  <ul className="space-y-2">
                    {reviewed.map((encounter) => (
                      <li key={encounter.id}>
                        <Button
                          className={`h-auto w-full justify-start whitespace-normal py-2.5 px-3 text-left rounded-xl font-semibold cursor-pointer ${
                            selected?.id === encounter.id
                              ? "jvk-ca-primary-btn text-white"
                              : "bg-white border border-[#DED8CA] text-[#0E2420] hover:bg-[#EEF6F0]"
                          }`}
                          variant={
                            selected?.id === encounter.id ? "default" : "outline"
                          }
                          aria-pressed={selected?.id === encounter.id}
                          onClick={() => setSelectedId(encounter.id)}
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="truncate">{encounter.patientName}</div>
                            {encounter.chiefComplaint && (
                              <div
                                className={`text-[11px] font-normal truncate ${
                                  selected?.id === encounter.id
                                    ? "text-white/85"
                                    : "text-[#556761]"
                                }`}
                              >
                                {encounter.chiefComplaint}
                              </div>
                            )}
                          </div>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>

                {selected ? (
                  <EncounterCase key={selected.id} encounter={selected} />
                ) : (
                  <div className="jvk-ca-card-white p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
                    <img
                      src="/assets/ayush/ayush-mortar-empty.png"
                      alt=""
                      aria-hidden="true"
                      className="jvk-ca-mask-left pointer-events-none select-none h-28 w-auto object-contain shrink-0"
                    />
                    <div className="space-y-1.5 text-center sm:text-left">
                      <h3 className="text-lg font-bold text-[#0E2420]">
                        Select an encounter
                      </h3>
                      <p className="text-sm text-[#4F635B]">
                        Open a patient&rsquo;s encounter to document the AYUSH assessment.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Bottom 3 Honest Clinical Shortcut Cards */}
        <section aria-label="AYUSH workflows" className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
          <button
            type="button"
            onClick={() => scrollToSection("ayush-formulations")}
            className="jvk-motion-card jvk-ca-card p-5 text-left hover:border-[#047C61] flex items-center justify-between gap-3 group cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E1F1E6] text-[#087F72]">
                <Sprout className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-[#0E2420] group-hover:text-[#047C61] transition-colors">
                  Herbal Recommendations
                </h3>
                <p className="mt-0.5 text-xs text-[#4F635B]">
                  {selected
                    ? "Jump to formulations & HDI safety review"
                    : "Select a reviewed encounter to prescribe formulations"}
                </p>
              </div>
            </div>
            <ArrowRight className="jvk-motion-arrow w-4 h-4 shrink-0 text-[#087F72]" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => scrollToSection("ayush-prakriti")}
            className="jvk-motion-card jvk-ca-card p-5 text-left hover:border-[#047C61] flex items-center justify-between gap-3 group cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E1F1E6] text-[#087F72]">
                <Leaf className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-[#0E2420] group-hover:text-[#047C61] transition-colors">
                  Prakriti &amp; Lifestyle Notes
                </h3>
                <p className="mt-0.5 text-xs text-[#4F635B]">
                  {selected
                    ? "Assess Prakriti, Agni, and diet/lifestyle guidance"
                    : "Clinic Yoga module unavailable; open encounter for Prakriti notes"}
                </p>
              </div>
            </div>
            <ArrowRight className="jvk-motion-arrow w-4 h-4 shrink-0 text-[#087F72]" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() =>
              selected ? scrollToSection("ayush-treatment") : navigate("/app/doctor")
            }
            className="jvk-motion-card jvk-ca-card p-5 text-left hover:border-[#047C61] flex items-center justify-between gap-3 group cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E1F1E6] text-[#087F72]">
                <ClipboardCheck className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-[#0E2420] group-hover:text-[#047C61] transition-colors">
                  Integrative Follow-up
                </h3>
                <p className="mt-0.5 text-xs text-[#4F635B]">
                  {selected
                    ? "Review coding, treatment plan & printable case sheet"
                    : "Return to OPD Cockpit for clinical follow-ups"}
                </p>
              </div>
            </div>
            <ArrowRight className="jvk-motion-arrow w-4 h-4 shrink-0 text-[#087F72]" aria-hidden="true" />
          </button>
        </section>
      </div>

      <CarePageWaveFooter />
    </div>
  );
}

function EncounterCase({ encounter }: { encounter: Encounter }) {
  const [revision, setRevision] = useState(0);
  const { data, error } = useStaffData<Case>(
    `/ayush/cases/${encounter.id}`,
    revision,
  );
  if (error)
    return (
      <div className="space-y-3">
        <InlineBanner tone="critical" title={error} />
        <Button
          variant="outline"
          onClick={() => setRevision((value) => value + 1)}
          className="rounded-xl bg-white"
        >
          Retry
        </Button>
      </div>
    );
  if (!data)
    return (
      <p role="status" className="text-sm font-medium text-[#4A6158] py-4">
        Loading case sheet…
      </p>
    );
  return <CaseForm encounter={encounter} record={data} />;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5 text-xs font-semibold text-[#2C4039]">
      <label htmlFor={id} className="block">
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}

function CaseForm({
  encounter,
  record,
}: {
  encounter: Encounter;
  record: Case;
}) {
  const [draft, setDraft] = useState(record.note ?? absentNote);
  const [medicines, setMedicines] = useState(
    draft.concurrentMedicines.join("\n"),
  );
  const [version, setVersion] = useState(record.version);
  const [updatedAt, setUpdatedAt] = useState(record.updatedAt);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const concurrentMedicines = medicines
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean);
  const interactions = checkHerbDrugInteractions(
    [
      ...new Set([
        ...concurrentMedicines,
        ...record.prescriptions.map(({ salt }) => salt),
      ]),
    ],
    draft.formulations,
  );

  function update<K extends keyof AyushNote>(field: K, value: AyushNote[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    setError("");
    setSaved(false);
    const validated = ayushNoteSchema.safeParse({
      ...draft,
      concurrentMedicines,
    });
    if (!validated.success) {
      setError(
        "Check the case sheet fields. List up to 30 medicines and 30 named formulations.",
      );
      return;
    }

    saving.current = true;
    setPending(true);
    try {
      const result = await staffApi<{ version: number; updatedAt: string }>(
        `/ayush/cases/${encounter.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ version, note: validated.data }),
        },
      );
      setVersion(result.version);
      setUpdatedAt(result.updatedAt);
      setDirty(false);
      setSaved(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The case sheet could not be saved.",
      );
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="min-w-0 space-y-5">
      <div className="jvk-ca-card-white p-5 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[#0E2420]">{encounter.patientName}</h3>
          <StatusChip tone="success">Active care consent</StatusChip>
        </div>
        {encounter.chiefComplaint && (
          <p className="text-sm text-[#3F554D]">{encounter.chiefComplaint}</p>
        )}
        <p className="text-xs text-[#647871]">
          {updatedAt ? (
            <>
              Case sheet saved{" "}
              <time dateTime={updatedAt}>
                {new Date(updatedAt).toLocaleString()}
              </time>
            </>
          ) : (
            "New practitioner case sheet"
          )}
        </p>
      </div>

      <fieldset disabled={pending} className="space-y-5">
        <div className="jvk-ca-card-white p-5 space-y-4">
          <h3 className="text-base font-bold text-[#0E2420]">Dashavidha Pariksha</h3>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {examKeys.map((key) => (
              <Field key={key} label={dashavidha[key]}>
                <textarea
                  rows={2}
                  maxLength={1200}
                  className={textarea}
                  value={draft.examination[key]}
                  onChange={(event) =>
                    update("examination", {
                      ...draft.examination,
                      [key]: event.target.value,
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </div>

        <div id="ayush-prakriti" className="jvk-ca-card-white p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#0E2420]">Prakriti and Agni</h3>
            <p className="text-xs text-[#556761] mt-0.5">
              Record your assessed dosha scores and Agni category.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["vata", "pitta", "kapha"] as const).map((key) => (
              <div key={key} className="space-y-2">
                <Field label={`${key[0].toUpperCase()}${key.slice(1)} score`}>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="bg-white border-[#D4DFD7] rounded-xl h-10"
                    value={draft.dosha[key] ?? ""}
                    onChange={(event) =>
                      update("dosha", {
                        ...draft.dosha,
                        [key]:
                          event.target.value === ""
                            ? null
                            : event.target.valueAsNumber,
                      })
                    }
                  />
                </Field>
                {draft.dosha[key] !== null && (
                  <ProgressBar label={key} value={draft.dosha[key]} />
                )}
              </div>
            ))}
          </div>
          <Field label="Agni category">
            <select
              className={textarea}
              value={draft.agni}
              onChange={(event) =>
                update("agni", event.target.value as AyushNote["agni"])
              }
            >
              <option value="" disabled hidden>Select assessed category</option>
              {["Samagni", "Vishamagni", "Tikshnagni", "Mandagni"].map(
                (entry) => (
                  <option key={entry}>{entry}</option>
                ),
              )}
            </select>
          </Field>
        </div>

        <div id="ayush-treatment" className="jvk-ca-card-white p-5 space-y-4">
          <h3 className="text-base font-bold text-[#0E2420]">Treatment documentation</h3>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="NAMASTE code">
              <Input
                value={draft.namasteCode}
                maxLength={80}
                className="bg-white border-[#D4DFD7] rounded-xl h-10"
                onChange={(event) =>
                  update("namasteCode", event.target.value)
                }
              />
            </Field>
            <Field label="ICD-11 TM-2 code">
              <Input
                value={draft.tm2Code}
                maxLength={80}
                className="bg-white border-[#D4DFD7] rounded-xl h-10"
                onChange={(event) => update("tm2Code", event.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-[#0E2420]">Signed encounter prescriptions</h4>
            {record.prescriptions.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-[#2C4039]">
                {record.prescriptions.map((item) => (
                  <li key={item.name}>
                    {item.name} · {item.units} units
                    {item.directions ? ` · ${item.directions}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#556761]">
                No signed prescriptions are linked to this encounter.
              </p>
            )}
          </div>

          <Field label="Other concurrent medicines, one per line">
            <textarea
              rows={3}
              maxLength={4800}
              className={textarea}
              value={medicines}
              onChange={(event) => {
                setMedicines(event.target.value);
                setDirty(true);
                setSaved(false);
              }}
            />
          </Field>

          <div id="ayush-formulations" className="space-y-3">
            <h4 className="text-sm font-bold text-[#0E2420]">Formulations</h4>
            {draft.formulations.map((entry, index) => (
              <fieldset
                key={index}
                className="grid gap-3 rounded-xl border border-[#DFD8C8] bg-[#FAF8F2] p-4 sm:grid-cols-2"
              >
                <legend className="px-2 text-xs font-bold text-[#047C61]">
                  Formulation {index + 1}
                </legend>
                {(["name", "dose", "anupana", "duration"] as const).map(
                  (key) => (
                    <Field
                      key={key}
                      label={
                        key === "name"
                          ? "Name"
                          : key === "dose"
                            ? "Dose"
                            : key === "anupana"
                              ? "Anupana"
                              : "Duration"
                      }
                    >
                      <Input
                        required={key === "name"}
                        maxLength={
                          key === "name" || key === "anupana" ? 160 : 100
                        }
                        className="bg-white border-[#D4DFD7] rounded-xl h-10"
                        value={entry[key]}
                        onChange={(event) =>
                          update(
                            "formulations",
                            draft.formulations.map((item, i) =>
                              i === index
                                ? { ...item, [key]: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                  ),
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="justify-self-start rounded-xl bg-white text-xs print:hidden"
                  onClick={() =>
                    update(
                      "formulations",
                      draft.formulations.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove formulation
                </Button>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-[#BBD8CC] bg-[#FFFDF9] text-xs font-bold text-[#047C61] hover:bg-[#EEF8F3] print:hidden cursor-pointer"
              disabled={draft.formulations.length >= 30}
              onClick={() =>
                update("formulations", [
                  ...draft.formulations,
                  { name: "", dose: "", anupana: "", duration: "" },
                ])
              }
            >
              Add formulation
            </Button>
          </div>

          <Field label="Treatment, diet and lifestyle notes">
            <textarea
              rows={4}
              maxLength={4000}
              className={textarea}
              value={draft.plan}
              onChange={(event) => update("plan", event.target.value)}
            />
          </Field>
        </div>

        <div id="ayush-interactions" className="jvk-ca-card-white p-5 space-y-3 text-sm">
          <h3 className="text-base font-bold text-[#0E2420]">Herb–drug interaction review</h3>
          {!interactions.length && (
            <p className="text-[#4F635B]">
              {draft.formulations.length &&
              (concurrentMedicines.length || record.prescriptions.length)
                ? "No matches in the configured interaction rules. Review the medication history before making treatment decisions."
                : "Add a formulation and concurrent medicine to run the interaction check."}
            </p>
          )}
          {interactions.map((interaction) => (
            <InlineBanner
              key={`${interaction.ayurvedicHerb}-${interaction.allopathicDrug}`}
              tone="warning"
              title={`${interaction.ayurvedicHerb} · ${interaction.allopathicDrug}`}
            >
              <StatusChip tone="warning">{interaction.severity}</StatusChip>
              <p className="mt-2">{interaction.clinicalRisk}</p>
            </InlineBanner>
          ))}
        </div>
      </fieldset>

      {error && <InlineBanner tone="critical" title={error} />}
      {saved && (
        <InlineBanner
          tone="success"
          title="Case sheet saved to the encounter."
        />
      )}
      <div className="flex flex-wrap gap-3 print:hidden">
        <Button
          type="submit"
          disabled={pending || !dirty}
          className="jvk-ca-primary-btn min-h-11 px-5 text-sm font-bold disabled:opacity-50 cursor-pointer"
        >
          {pending ? "Saving…" : "Save case sheet"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!version || dirty || pending}
          onClick={() => window.print()}
          className="min-h-11 rounded-xl border-[#CFDAD2] bg-white px-5 text-sm font-semibold text-[#0E2420] cursor-pointer"
        >
          Print saved case sheet
        </Button>
      </div>
    </form>
  );
}
