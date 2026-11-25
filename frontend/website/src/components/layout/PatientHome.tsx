import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { checkInSchema } from "../../../../../packages/shared/patient-experience";
import { Button, Card, CardContent, Input } from "@/components/ui/basic";
import {
  EmptyState,
  InlineBanner,
  StatusChip,
} from "@/components/ui/design-primitives";
import {
  patientRequest,
  patientToken,
  setPatientToken,
  usePatientData,
} from "@/lib/patientApi";
import { DocumentReview, VoiceControls } from "@/features/patient/capture";
import { MobileShell } from "./MobileShell";

const titles = {
  thread: "Health Thread",
  "check-in": "Daily Check-In",
  drift: "Drift Radar",
  refill: "Refill",
  prescriptions: "Prescriptions",
  more: "More",
  her: "HER Wellness",
  vitalis: "Vitalis",
  yoga: "Gentle Yoga",
  prakriti: "Prakriti & Agni",
} as const;
const moreSections = ["her", "vitalis", "yoga", "prakriti"] as const;
const endpoint = "/home/companion";
const dateFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});
const date = (value: string) => dateFmt.format(new Date(value));
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
const questionLabelStyle =
  "flex flex-col gap-1.5 text-sm font-semibold text-[#183029]";
const selectStyle =
  "min-h-12 w-full rounded-xl border border-[#CEDAD3] bg-white pl-3.5 pr-4 py-2.5 text-[15px] font-medium text-[#0E2420] shadow-xs";

export function PatientHome() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const section = pathname.split("/").filter(Boolean).at(-1);
  const active =
    section && Object.keys(titles).includes(section)
      ? (section as keyof typeof titles)
      : null;
  const [signout, setSignout] = useState(false);
  const [signoutError, setSignoutError] = useState("");
  useEffect(() => {
    heading.current?.focus();
  }, [active]);

  if (!active) return <Navigate to="/app/home/thread" replace />;
  async function logout() {
    setSignout(true);
    setSignoutError("");
    try {
      await patientRequest("/auth/patient/logout", {
        method: "POST",
        token: patientToken(),
      });
      setPatientToken(null);
      navigate("/home/sign-in", { replace: true });
    } catch {
      setSignoutError("Sign-out could not be confirmed. Try again.");
    } finally {
      setSignout(false);
    }
  }

  return (
    <MobileShell>
      <section className="space-y-5 px-4 py-5 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold">
            {titles[active]}
          </h1>
          <Button
            variant="outline"
            className="min-h-12"
            disabled={signout}
            onClick={() => void logout()}
          >
            {signout ? "Signing out…" : "Sign out"}
          </Button>
        </header>
        {signoutError && <InlineBanner tone="critical" title={signoutError} />}
        {(active === "refill" || active === "prescriptions") && (
          <nav className="flex flex-wrap gap-2" aria-label="Medicines">
            <SectionLink route="refill" current={active} />
            <SectionLink route="prescriptions" current={active} />
          </nav>
        )}
        {(active === "more" ||
          moreSections.some((path) => path === active)) && (
          <nav
            className="grid grid-cols-2 gap-2"
            aria-label="More patient services"
          >
            {moreSections.map((route) => (
              <SectionLink key={route} route={route} current={active} />
            ))}
          </nav>
        )}
        {active === "thread" && <Thread />}
        {active === "check-in" && <CheckIn />}
        {active === "drift" && <Drift />}
        {(active === "refill" || active === "prescriptions") && (
          <Medicines view={active} />
        )}
        {active === "her" && <Her />}
        {active === "vitalis" && <Vitalis />}
        {active === "yoga" && <Yoga />}
        {active === "prakriti" && <Prakriti />}
      </section>
    </MobileShell>
  );
}

function SectionLink({
  route,
  current,
}: {
  route: keyof typeof titles;
  current: keyof typeof titles;
}) {
  return (
    <Button
      variant={route === current ? "default" : "outline"}
      className="min-h-12 min-w-0 whitespace-normal text-center"
      asChild
    >
      <Link
        to={`/app/home/${route}`}
        aria-current={route === current ? "page" : undefined}
      >
        {titles[route]}
      </Link>
    </Button>
  );
}

function Loaded<T>({
  result,
  children,
}: {
  result: { data?: T; error?: string };
  children: (data: T) => ReactNode;
}) {
  if (result.error)
    return <InlineBanner tone="critical" title={result.error} />;
  if (!result.data) return <p role="status">Loading your records…</p>;
  return <>{children(result.data)}</>;
}

function Thread() {
  const result = usePatientData<{
    events: Array<{
      id: string;
      title: string;
      source: string;
      occurredAt: string;
    }>;
    nextAction: "check-in" | null;
  }>(`${endpoint}/thread`);
  return (
    <Loaded result={result}>
      {({ events, nextAction }) => (
        <>
          {nextAction && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <h2 className="font-semibold">Next action</h2>
                <Button asChild>
                  <Link to="/app/home/check-in">Complete today’s check-in</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {events.length ? (
            <ol className="divide-y rounded-lg border bg-card">
              {events.map((event) => (
                <li className="space-y-2 p-4" key={event.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold">{event.title}</h2>
                    <StatusChip>{event.source}</StatusChip>
                  </div>
                  <time className="text-sm" dateTime={event.occurredAt}>
                    {date(event.occurredAt)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="No health events yet"
              description="Clinic visits, signed prescriptions and completed check-ins appear here."
            />
          )}
        </>
      )}
    </Loaded>
  );
}

function usePatientAction() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function run(action: () => Promise<string>) {
    if (busy.current) return;
    busy.current = true;
    setError("");
    setMessage("");
    setPending(true);
    try {
      setMessage(await action());
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to save. Try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { pending, message, error, run };
}

function Feedback({ action }: { action: ReturnType<typeof usePatientAction> }) {
  return (
    <>
      {action.error && <InlineBanner tone="critical" title={action.error} />}
      {action.message && <InlineBanner tone="success" title={action.message} />}
    </>
  );
}

function CheckIn() {
  const [urgent, setUrgent] = useState(false);
  const [note, setNote] = useState("");
  const [imageText, setImageText] = useState("");
  const [bp, setBp] = useState({ systolic: "", diastolic: "" });
  const action = usePatientAction();
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const number = (key: string) =>
      values.get(key) ? Number(values.get(key)) : undefined;
    const body = checkInSchema.safeParse({
      recovery: values.get("recovery"),
      medication: values.get("medication"),
      distress: values.get("distress") === "yes",
      systolic: number("systolic"),
      diastolic: number("diastolic"),
      pulse: number("pulse"),
      spo2: number("spo2"),
      glucose: number("glucose"),
      note: note.trim() || undefined,
    });
    setUrgent(
      values.get("distress") === "yes" ||
        (number("systolic") ?? 0) >= 180 ||
        (number("spo2") ?? 100) <= 90,
    );
    void action.run(async () => {
      if (!body.success)
        throw new Error("Review your readings and the required answers.");
      const result = await patientRequest<{ urgent: boolean }>(
        `${endpoint}/check-in`,
        { method: "POST", body: body.data, token: patientToken() },
      );
      setUrgent(result.urgent);
      return "Check-in saved.";
    });
  }
  const detectedBp = imageText.match(/\b(\d{2,3})\s*[/|]\s*(\d{2,3})\b/);
  return (
    <form className="space-y-4 pb-8" onSubmit={save}>
      {urgent && (
        <InlineBanner tone="critical" title="Get urgent help">
          Seek immediate in-person care. This check-in does not dispatch an
          emergency response.
        </InlineBanner>
      )}
      <Feedback action={action} />
      <label className={questionLabelStyle}>
        How are you feeling today?
        <select
          className={selectStyle}
          required
          name="recovery"
          defaultValue=""
        >
          <option value="">Select an answer</option>
          <option value="better">Better</option>
          <option value="same">About the same</option>
          <option value="worse">Worse</option>
        </select>
      </label>
      <label className={questionLabelStyle}>
        Did you take your scheduled medicines?
        <select
          className={selectStyle}
          required
          name="medication"
          defaultValue=""
        >
          <option value="">Select an answer</option>
          <option value="taken">Yes</option>
          <option value="missed">Missed a dose</option>
          <option value="not-applicable">No medicines scheduled</option>
        </select>
      </label>
      <label className={questionLabelStyle}>
        Do you need urgent help right now?
        <select
          className={selectStyle}
          required
          name="distress"
          defaultValue=""
          onChange={(event) => setUrgent(event.target.value === "yes")}
        >
          <option value="">Select an answer</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      <details className="rounded-lg border p-3">
        <summary className="min-h-10 cursor-pointer">
          Add a reading or photo
        </summary>
        <div className="grid grid-cols-2 gap-3 py-3">
          {(
            [
              ["systolic", "Systolic (mmHg)"],
              ["diastolic", "Diastolic (mmHg)"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} htmlFor={`check-in-${field}`}>
              {label}
              <Input
                id={`check-in-${field}`}
                min={field === "systolic" ? 50 : 25}
                max={field === "systolic" ? 300 : 230}
                type="number"
                name={field}
                value={bp[field]}
                onChange={(event) =>
                  setBp({ ...bp, [field]: event.target.value })
                }
              />
            </label>
          ))}
          {(
            [
              ["pulse", "Pulse (bpm)", 25, 250],
              ["spo2", "SpO₂ (%)", 40, 100],
              ["glucose", "Glucose (mg/dL)", 20, 700],
            ] as const
          ).map(([field, label, min, max]) => (
            <label key={field} htmlFor={`check-in-${field}`}>
              {label}
              <Input
                id={`check-in-${field}`}
                type="number"
                name={field}
                min={min}
                max={max}
              />
            </label>
          ))}
        </div>
        <DocumentReview
          value={imageText}
          label="Review extracted device text"
          onChange={setImageText}
        />
        {detectedBp && (
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() =>
              setBp({
                systolic: detectedBp[1] ?? "",
                diastolic: detectedBp[2] ?? "",
              })
            }
          >
            Use reviewed blood pressure values
          </Button>
        )}
      </details>
      <details className="rounded-lg border p-3">
        <summary className="min-h-10 cursor-pointer">Add a note</summary>
        <VoiceControls
          locale="en-IN"
          caption="Tell us how you are feeling today."
          onTranscript={(text) => setNote(text.slice(0, 1000))}
        />
        <label className="block" htmlFor="vitalis-value">
          Check-in note
          <textarea
            className="block w-full rounded-lg border bg-background p-3"
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </details>
      <Button type="submit" className="min-h-12" disabled={action.pending}>
        {action.pending ? "Saving…" : "Save check-in"}
      </Button>
    </form>
  );
}

function Drift() {
  const result = usePatientData<{
    readings: Array<{ day: string; systolic?: number; spo2?: number }>;
    baseline: number | null;
    alert: boolean;
    urgent: boolean;
  }>(`${endpoint}/drift`);
  return (
    <Loaded result={result}>
      {({ readings, baseline, alert, urgent }) => (
        <>
          {urgent ? (
            <InlineBanner tone="critical" title="Urgent reading">
              Seek immediate in-person care.
            </InlineBanner>
          ) : alert ? (
            <InlineBanner tone="warning" title="A change was detected">
              Discuss recent readings with your care team.
            </InlineBanner>
          ) : (
            <InlineBanner
              title={
                baseline === null
                  ? "Learning your baseline"
                  : "Baseline available"
              }
            >
              {baseline === null
                ? "Log seven systolic readings on different days to establish a baseline."
                : `Systolic baseline ${baseline} mmHg.`}
            </InlineBanner>
          )}
          {readings.length ? (
            <ul className="divide-y rounded-lg border bg-card">
              {[...readings].reverse().map((reading) => (
                <li className="p-3" key={reading.day}>
                  <time dateTime={reading.day}>{date(reading.day)}</time>
                  <p>
                    {[
                      reading.systolic === undefined
                        ? ""
                        : `Systolic ${reading.systolic} mmHg`,
                      reading.spo2 === undefined ? "" : `SpO₂ ${reading.spo2}%`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No drift reading recorded"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No readings yet"
              description="Your confirmed check-in readings will appear here."
            />
          )}
        </>
      )}
    </Loaded>
  );
}

type Prescription = {
  id: string;
  medicine: string;
  units: number;
  directions: string;
  course_end: string;
  signed_at: string;
  dispensed: number;
};
function Medicines({ view }: { view: "refill" | "prescriptions" }) {
  const result = usePatientData<{ prescriptions: Prescription[] }>(
    `${endpoint}/prescriptions`,
  );
  return (
    <Loaded result={result}>
      {({ prescriptions }) => {
        const rows =
          view === "refill"
            ? prescriptions.filter(({ dispensed }) => Boolean(dispensed))
            : prescriptions;
        return (
          <>
            {view === "refill" && (
              <InlineBanner title="Contact your pharmacy for refills">
                Online stock reservations and refill predictions are
                unavailable.
              </InlineBanner>
            )}
            {rows.length ? (
              <ul className="divide-y rounded-lg border bg-card">
                {rows.map((rx) => (
                  <li key={`${rx.id}-${rx.medicine}`} className="space-y-2 p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <h2 className="font-semibold">{rx.medicine}</h2>
                      <StatusChip>
                        {rx.dispensed ? "Dispensed" : "Signed"}
                      </StatusChip>
                    </div>
                    <p>
                      {rx.units} units · Course through {date(rx.course_end)}
                    </p>
                    {rx.directions && <p>{rx.directions}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title={
                  view === "refill"
                    ? "No dispensing history"
                    : "No signed prescriptions"
                }
                description="Your linked pharmacy records will appear here as they become available."
              />
            )}
          </>
        );
      }}
    </Loaded>
  );
}

function Her() {
  const [revision, setRevision] = useState(0);
  const [urgent, setUrgent] = useState(false);
  const result = usePatientData<{
    consent: boolean;
    records: Array<{
      id: string;
      log_date: string;
      pelvic_pain: number;
      mood: string;
      tags: string[];
    }>;
    cycle: {
      lastStart: string | null;
      phase: string | null;
      status: string;
      irregular: boolean;
    } | null;
  }>(`${endpoint}/her`, revision);
  const action = usePatientAction();
  function setConsent(granted: boolean) {
    void action.run(async () => {
      await patientRequest(`${endpoint}/her/consent`, {
        method: "POST",
        body: { granted },
        token: patientToken(),
      });
      setRevision((value) => value + 1);
      return granted
        ? "Symptom tracking enabled."
        : "Symptom tracking consent withdrawn.";
    });
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      const response = await patientRequest<{ urgent: boolean }>(
        `${endpoint}/her`,
        {
          method: "POST",
          body: {
            date: form.get("date"),
            flow: form.get("flow"),
            pain: Number(form.get("pain")),
            mood: form.get("mood"),
            periodStarted: form.has("periodStarted"),
            periodLength: form.get("periodLength")
              ? Number(form.get("periodLength"))
              : undefined,
          },
          token: patientToken(),
        },
      );
      setUrgent(response.urgent);
      setRevision((value) => value + 1);
      return "Symptom entry saved.";
    });
  }
  return (
    <>
      <Feedback action={action} />
      {urgent && (
        <InlineBanner tone="critical" title="Seek urgent clinical care" />
      )}
      <Loaded result={result}>
        {({ consent, records, cycle }) =>
          consent ? (
            <>
              {cycle?.lastStart && (
                <Card>
                  <CardContent className="space-y-2 p-4">
                    <h2 className="font-semibold">Cycle history</h2>
                    <p>Last logged start {date(cycle.lastStart)}.</p>
                    <p>
                      {cycle.phase
                        ? `Estimated phase: ${cycle.phase}`
                        : "More cycle history is needed for a phase estimate."}
                    </p>
                    {cycle.irregular && (
                      <InlineBanner
                        tone="warning"
                        title="Cycle pattern changed"
                      />
                    )}
                  </CardContent>
                </Card>
              )}
              <form className="space-y-4" onSubmit={save}>
                <label className="block" htmlFor="her-date">
                  Entry date
                  <Input
                    id="her-date"
                    type="date"
                    name="date"
                    max={today()}
                    defaultValue={today()}
                    required
                  />
                </label>
                <label className={questionLabelStyle}>
                  Flow
                  <select name="flow" className={selectStyle}>
                    <option value="none">None</option>
                    <option value="light">Light</option>
                    <option value="medium">Medium</option>
                    <option value="heavy">Heavy</option>
                  </select>
                </label>
                <label className="block" htmlFor="her-pain">
                  Pelvic pain (0–10)
                  <Input
                    id="her-pain"
                    type="number"
                    min={0}
                    max={10}
                    name="pain"
                    required
                  />
                </label>
                <label className="block" htmlFor="her-mood">
                  Mood
                  <Input id="her-mood" name="mood" maxLength={60} />
                </label>
                <label className="flex min-h-12 items-center gap-2">
                  <input type="checkbox" name="periodStarted" />A period started
                  on this date
                </label>
                <label className="block" htmlFor="her-length">
                  Period length in days, if known
                  <Input
                    id="her-length"
                    type="number"
                    name="periodLength"
                    min={2}
                    max={10}
                  />
                </label>
                <Button type="submit" disabled={action.pending}>
                  Save symptom entry
                </Button>
              </form>
              {records.length ? (
                <ul className="divide-y rounded-lg border bg-card">
                  {records.map((record) => (
                    <li className="p-3" key={record.id}>
                      <time dateTime={record.log_date}>
                        {date(record.log_date)}
                      </time>
                      <p>
                        Flow: {record.tags[0] ?? "Unspecified"} · Pelvic pain{" "}
                        {record.pelvic_pain}/10
                        {record.mood ? ` · ${record.mood}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No symptom entries"
                  description="Entries you save will appear here."
                />
              )}
              <Button
                variant="outline"
                disabled={action.pending}
                onClick={() => setConsent(false)}
              >
                Withdraw tracking consent
              </Button>
            </>
          ) : (
            <EmptyState
              title="Enable symptom tracking"
              description="Choose whether to store flow, mood and pain entries in your patient account."
              action={
                <Button
                  disabled={action.pending}
                  onClick={() => setConsent(true)}
                >
                  Allow symptom tracking
                </Button>
              }
            />
          )
        }
      </Loaded>
    </>
  );
}

function Vitalis() {
  const [revision, setRevision] = useState(0);
  const result = usePatientData<{
    consent: boolean;
    observations: Array<{
      id: string;
      metric_name: string;
      value_numeric: number;
      unit: string;
      observed_start_utc: string;
      source_type: string;
    }>;
    index: { status: string; score: number | null; coverage: number } | null;
  }>(`${endpoint}/vitalis`, revision);
  const action = usePatientAction();
  function setConsent(granted: boolean) {
    void action.run(async () => {
      await patientRequest(`${endpoint}/vitalis/consent`, {
        method: "POST",
        body: { granted },
        token: patientToken(),
      });
      setRevision((value) => value + 1);
      return granted
        ? "Vitalis tracking enabled."
        : "Vitalis tracking consent withdrawn.";
    });
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      await patientRequest(`${endpoint}/vitalis`, {
        method: "POST",
        body: { metric: form.get("metric"), value: Number(form.get("value")) },
        token: patientToken(),
      });
      setRevision((value) => value + 1);
      return "Observation saved.";
    });
  }
  return (
    <>
      <Feedback action={action} />
      <Loaded result={result}>
        {({ consent, observations, index }) =>
          consent ? (
            <>
              <InlineBanner title="Healthspan progress">
                {index?.score === null || index?.score === undefined
                  ? "There are not enough verified observations for a score."
                  : `Index ${index.score}. Verified coverage ${Math.round(index.coverage * 100)}%.`}
              </InlineBanner>
              <form className="space-y-3" onSubmit={save}>
                <label className={questionLabelStyle}>
                  Observation
                  <select className={selectStyle} name="metric" required>
                    <option value="resting_heart_rate">
                      Resting heart rate (bpm)
                    </option>
                    <option value="sleep_duration">
                      Sleep duration (hours)
                    </option>
                    <option value="activity_minutes">Activity (minutes)</option>
                  </select>
                </label>
                <label className="block" htmlFor="vitalis-value">
                  Value
                  <Input
                    id="vitalis-value"
                    name="value"
                    type="number"
                    min={0}
                    max={1440}
                    step="any"
                    required
                  />
                </label>
                <Button type="submit" disabled={action.pending}>
                  Save observation
                </Button>
              </form>
              {observations.length ? (
                <ul className="divide-y rounded-lg border bg-card">
                  {observations.map((row) => (
                    <li className="p-3" key={row.id}>
                      <h2 className="font-semibold">{row.metric_name}</h2>
                      <p>
                        {row.value_numeric} {row.unit} ·{" "}
                        {date(row.observed_start_utc)}
                      </p>
                      {row.source_type === "patient_reported" && (
                        <StatusChip>Patient reported</StatusChip>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No Vitalis observations"
                  description="Recorded observations appear here."
                />
              )}
              <Button
                variant="outline"
                disabled={action.pending}
                onClick={() => setConsent(false)}
              >
                Withdraw Vitalis consent
              </Button>
            </>
          ) : (
            <EmptyState
              title="Enable Vitalis tracking"
              description="Choose whether to store your sleep, activity and heart-rate observations."
              action={
                <Button
                  disabled={action.pending}
                  onClick={() => setConsent(true)}
                >
                  Allow Vitalis tracking
                </Button>
              }
            />
          )
        }
      </Loaded>
    </>
  );
}

function Prakriti() {
  const result = usePatientData<{
    assessment: {
      agni: string;
      prakriti: string;
      dosha: Record<string, number | null> | null;
      updated_at: string;
    } | null;
  }>(`${endpoint}/prakriti`);
  return (
    <Loaded result={result}>
      {({ assessment }) =>
        assessment ? (
          <Card>
            <CardContent className="space-y-2 p-4">
              <StatusChip>Practitioner assessment</StatusChip>
              <p>{date(assessment.updated_at)}</p>
              {assessment.prakriti && <p>{assessment.prakriti}</p>}
              {assessment.agni && <p>Agni: {assessment.agni}</p>}
              {assessment.dosha && (
                <ul>
                  {Object.entries(assessment.dosha)
                    .filter(([, value]) => value !== null)
                    .map(([name, value]) => (
                      <li key={name} className="capitalize">
                        {name}: {value}
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            title="No practitioner assessment"
            description="Prakriti and Agni findings from an eligible AYUSH encounter will appear here."
          />
        )
      }
    </Loaded>
  );
}

function Yoga() {
  const [result, setResult] = useState<{
    restricted: boolean;
    items: Array<{
      id: string;
      title: string;
      description: string;
      disclaimer?: string;
    }>;
  }>();
  const action = usePatientAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = [
      "cardiovascularRestriction",
      "eyePressureRestriction",
      "spineRestriction",
      "acuteSymptoms",
    ] as const;
    setResult(undefined);
    void action.run(async () => {
      const response = await patientRequest<NonNullable<typeof result>>(
        `${endpoint}/yoga`,
        {
          method: "POST",
          body: Object.fromEntries(
            fields.map((field) => [field, form.get(field) !== "no"]),
          ),
          token: patientToken(),
        },
      );
      setResult(response);
      return "";
    });
  }
  return (
    <>
      <form className="space-y-3" onSubmit={submit}>
        <p>Answer these questions before viewing gentle movement options.</p>
        {Object.entries({
          cardiovascularRestriction:
            "High blood pressure or a heart condition?",
          eyePressureRestriction: "Glaucoma or an eye pressure restriction?",
          spineRestriction: "A current spinal disc problem?",
          acuteSymptoms: "Acute symptoms or advice to avoid exercise?",
        }).map(([field, label]) => (
          <label className={questionLabelStyle} key={field}>
            {label}
            <select
              name={field}
              required
              defaultValue=""
              className={selectStyle}
            >
              <option value="">Select</option>
              <option value="yes">Yes or unsure</option>
              <option value="no">No</option>
            </select>
          </label>
        ))}
        <Button type="submit" disabled={action.pending}>
          {action.pending ? "Checking…" : "Review movement options"}
        </Button>
      </form>
      <Feedback action={action} />
      {result?.restricted && (
        <InlineBanner
          tone="warning"
          title="Check with your care team before starting"
        />
      )}
      {result &&
        !result.restricted &&
        (result.items.length ? (
          <ul className="space-y-3">
            {result.items.map((item) => (
              <li className="rounded-lg border bg-card p-4" key={item.id}>
                <h2 className="font-semibold">{item.title}</h2>
                <p>{item.description}</p>
                {item.disclaimer && (
                  <p className="mt-2 text-sm">{item.disclaimer}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No options available"
            description="Ask your practitioner about exercises suited to you."
          />
        ))}
    </>
  );
}
