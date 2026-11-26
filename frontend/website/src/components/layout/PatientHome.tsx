import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { InlineBanner } from "@/components/ui/design-primitives";
import { patientRequest, patientToken, setPatientToken } from "@/lib/patientApi";
import { PatientPortalShell } from "@/components/patient-portal/PatientPortalShell";
import { HerWellnessPage } from "@/components/patient-portal/HerWellnessPage";
import {
  CheckInView,
  DriftView,
  MedicinesView,
  ThreadView,
} from "@/components/patient-portal/PatientPortalViews";
import {
  MoreView,
  PrakritiView,
  VitalisView,
  YogaView,
} from "@/components/patient-portal/WellnessViews";

const HERO_CONFIG: Record<
  | "thread"
  | "check-in"
  | "drift"
  | "refill"
  | "prescriptions"
  | "more"
  | "vitalis"
  | "yoga"
  | "prakriti",
  {
    prefix: string;
    italic?: string;
    underlinePrefix?: boolean;
    subtitle: string;
  }
> = {
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
    underlinePrefix: true,
    subtitle:
      "Manage your prescriptions and view your linked dispensing history.",
  },
  prescriptions: {
    prefix: "Medicines",
    underlinePrefix: true,
    subtitle:
      "Manage your prescriptions and view your linked dispensing history.",
  },
  more: {
    prefix: "More",
    underlinePrefix: true,
    subtitle:
      "Explore women's wellness, Vitalis tracking, gentle movement, and Ayurvedic care.",
  },
  vitalis: {
    prefix: "Vitalis",
    underlinePrefix: true,
    subtitle:
      "Monitor sleep, physical activity, resting heart rate, and healthspan progress.",
  },
  yoga: {
    prefix: "Gentle",
    italic: "Yoga",
    subtitle:
      "Complete a quick clinical safety screen before viewing gentle movement options.",
  },
  prakriti: {
    prefix: "Prakriti &",
    italic: "Agni",
    subtitle:
      "Review practitioner-recorded Ayurvedic constitution and metabolic findings.",
  },
};

type ActiveSection = keyof typeof HERO_CONFIG | "her";

const VALID_SECTIONS = new Set<string>([...Object.keys(HERO_CONFIG), "her"]);

export function PatientHome() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const section = pathname.split("/").filter(Boolean).at(-1);
  const active =
    section && VALID_SECTIONS.has(section) ? (section as ActiveSection) : null;
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

  if (active === "her") {
    return (
      <HerWellnessPage
        headingRef={heading}
        signout={signout}
        signoutError={signoutError}
        onLogout={() => void logout()}
      />
    );
  }

  const heroMeta = HERO_CONFIG[active];

  return (
    <PatientPortalShell
      signout={signout}
      onLogout={() => void logout()}
      headingRef={heading}
      titlePrefix={heroMeta.prefix}
      titleItalic={heroMeta.italic}
      underlinePrefix={heroMeta.underlinePrefix}
      subtitle={heroMeta.subtitle}
    >
      {signoutError && <InlineBanner tone="critical" title={signoutError} />}
      {active === "thread" && <ThreadView />}
      {active === "check-in" && <CheckInView />}
      {active === "drift" && <DriftView />}
      {(active === "refill" || active === "prescriptions") && (
        <MedicinesView view={active} />
      )}
      {active === "more" && <MoreView />}
      {active === "vitalis" && <VitalisView />}
      {active === "yoga" && <YogaView />}
      {active === "prakriti" && <PrakritiView />}
    </PatientPortalShell>
  );
}
