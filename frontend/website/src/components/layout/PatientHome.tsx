import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
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
import { MobileShell } from "./MobileShell";
import { PatientPortalShell } from "@/components/patient-portal/PatientPortalShell";
import {
  CheckInView,
  DriftView,
  HerView,
  MedicinesView,
  ThreadView,
} from "@/components/patient-portal/PatientPortalViews";

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

  const isRedesignedPage =
    active === "thread" ||
    active === "check-in" ||
    active === "drift" ||
    active === "refill" ||
    active === "prescriptions" ||
    active === "her";

  if (isRedesignedPage) {
    const heroMeta = {
      thread: {
        prefix: "Health",
        italic: "Thread",
        subtitle:
          "Your ongoing care journey—check-ins, intakes, and other key health interactions in one place.",
      },
      "check-in": {
        prefix: "Daily",
        italic: "Check-In",
        subtitle:
          "A quick and complete check-in to keep your care team updated and support your health.",
      },
      drift: {
        prefix: "Drift",
        italic: "Radar",
        subtitle:
          "Recovery trend and baseline monitoring that helps us spot meaningful changes over time.",
      },
      refill: {
        prefix: "Medicines",
        italic: undefined,
        subtitle:
          "Manage your prescriptions and view your linked dispensing history.",
      },
      prescriptions: {
        prefix: "Medicines",
        italic: undefined,
        subtitle:
          "Manage your prescriptions and view your linked dispensing history.",
      },
      her: {
        prefix: "HER",
        italic: "Wellness",
        subtitle:
          "A supportive space to track your menstrual health, cycle symptoms, and overall wellness.",
      },
    }[active];

    return (
      <PatientPortalShell
        signout={signout}
        onLogout={() => void logout()}
        headingRef={heading}
        titlePrefix={heroMeta.prefix}
        titleItalic={heroMeta.italic}
        subtitle={heroMeta.subtitle}
      >
        {signoutError && <InlineBanner tone="critical" title={signoutError} />}
        {active === "thread" && <ThreadView />}
        {active === "check-in" && <CheckInView />}
        {active === "drift" && <DriftView />}
        {(active === "refill" || active === "prescriptions") && (
          <MedicinesView view={active} />
        )}
        {active === "her" && <HerView />}
      </PatientPortalShell>
    );
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
              <option value="" disabled hidden>Select</option>
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
