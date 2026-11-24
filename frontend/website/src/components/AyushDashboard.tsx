import {
  cloneElement,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import {
  dashavidha,
  ayushNoteSchema,
  type AyushNote,
} from "../../../../packages/shared/ayush";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui/basic";
import {
  EmptyState,
  InlineBanner,
  ProgressBar,
  StatusChip,
} from "@/components/ui/design-primitives";
import { staffApi, useStaffData } from "@/lib/staffApi";
import { checkHerbDrugInteractions } from "@/lib/herbDrugInteractions";

type Encounter = {
  id: string;
  patientName: string;
  chiefComplaint: string;
  status: string;
  consentActive: boolean;
};
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
  "w-full rounded-md border bg-background p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AyushDashboard() {
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const { data, error } = useStaffData<{ encounters: Encounter[] }>(
    "/encounters",
    revision,
  );
  const reviewed = data?.encounters.filter(
    ({ status, consentActive }) => status === "reviewed" && consentActive,
  );
  const selected = reviewed?.find(({ id }) => id === selectedId);

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold">AYUSH Portal</h1>
        <Button
          variant="outline"
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh encounters
        </Button>
      </header>
      {error && <InlineBanner tone="critical" title={error} />}
      {!data && !error && <p role="status">Loading reviewed encounters…</p>}
      {reviewed?.length === 0 && (
        <EmptyState
          title="No reviewed encounters"
          description="Reviewed encounters with active care consent in your clinic will appear here."
        />
      )}
      {!!reviewed?.length && (
        <div className="grid items-start gap-4 print:block lg:grid-cols-[minmax(14rem,1fr)_3fr]">
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>Clinic encounters</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {reviewed.map((encounter) => (
                  <li key={encounter.id}>
                    <Button
                      className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                      variant={
                        selected?.id === encounter.id ? "default" : "outline"
                      }
                      aria-pressed={selected?.id === encounter.id}
                      onClick={() => setSelectedId(encounter.id)}
                    >
                      {encounter.patientName}
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {selected ? (
            <EncounterCase key={selected.id} encounter={selected} />
          ) : (
            <EmptyState
              title="Select an encounter"
              description="Open a patient’s encounter to document the AYUSH assessment."
            />
          )}
        </div>
      )}
    </section>
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
        >
          Retry
        </Button>
      </div>
    );
  if (!data) return <p role="status">Loading case sheet…</p>;
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
    <div className="space-y-1 text-sm font-medium">
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
    <form onSubmit={(event) => void save(event)} className="min-w-0 space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>{encounter.patientName}</CardTitle>
          {encounter.chiefComplaint && (
            <p className="text-sm">{encounter.chiefComplaint}</p>
          )}
          <p className="text-sm text-muted-foreground">
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
        </CardHeader>
      </Card>
      <fieldset disabled={pending} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Dashavidha Pariksha</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prakriti and Agni</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Record your assessed dosha scores and Agni category.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["vata", "pitta", "kapha"] as const).map((key) => (
                <div key={key} className="space-y-2">
                  <Field label={`${key[0].toUpperCase()}${key.slice(1)} score`}>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
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
                <option value="">Select assessed category</option>
                {["Samagni", "Vishamagni", "Tikshnagni", "Mandagni"].map(
                  (entry) => (
                    <option key={entry}>{entry}</option>
                  ),
                )}
              </select>
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Treatment documentation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="NAMASTE code">
                <Input
                  value={draft.namasteCode}
                  maxLength={80}
                  onChange={(event) =>
                    update("namasteCode", event.target.value)
                  }
                />
              </Field>
              <Field label="ICD-11 TM-2 code">
                <Input
                  value={draft.tm2Code}
                  maxLength={80}
                  onChange={(event) => update("tm2Code", event.target.value)}
                />
              </Field>
            </div>
            <h3 className="font-semibold">Signed encounter prescriptions</h3>
            {record.prescriptions.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {record.prescriptions.map((item) => (
                  <li key={item.name}>
                    {item.name} · {item.units} units
                    {item.directions ? ` · ${item.directions}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No signed prescriptions are linked to this encounter.
              </p>
            )}
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
            <h3 className="font-semibold">Formulations</h3>
            {draft.formulations.map((entry, index) => (
              <fieldset
                key={index}
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
              >
                <legend className="px-1 text-sm">
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
                  className="justify-self-start print:hidden"
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
              className="print:hidden"
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
            <Field label="Treatment, diet and lifestyle notes">
              <textarea
                rows={4}
                maxLength={4000}
                className={textarea}
                value={draft.plan}
                onChange={(event) => update("plan", event.target.value)}
              />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Herb–drug interaction review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!interactions.length && (
              <p>
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
          </CardContent>
        </Card>
      </fieldset>
      {error && <InlineBanner tone="critical" title={error} />}
      {saved && (
        <InlineBanner
          tone="success"
          title="Case sheet saved to the encounter."
        />
      )}
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save case sheet"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!version || dirty || pending}
          onClick={() => window.print()}
        >
          Print saved case sheet
        </Button>
      </div>
    </form>
  );
}
