import { useState, type FormEvent } from "react";
import { distressChanged } from "@/components/ShellEmergency";
import { CasualtyBoardView } from "@/features/care/CasualtyBoardView";
import { IpdBoardView } from "@/features/care/IpdBoardView";
import {
  computeCasualtyMetrics,
  computeIpdMetrics,
  type CareBoardData,
  type CareDistressItem,
} from "@/features/care/careMetrics";
import { useOptionalOpdWorkspace } from "@/features/opd/opdContext";
import { staffApi, useStaffData } from "@/lib/staffApi";
import "@/design-system/care-ayush.css";

interface CareBoardProps {
  kind: "ipd" | "casualty";
  role: string;
  encounterId?: string;
}

function useCareBoardActions(kind: "ipd" | "casualty", role: string) {
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [distressLocation, setDistressLocation] = useState("");
  const endpoint = `/clinical/${kind}`;
  const { data, error } = useStaffData<CareBoardData>(`${endpoint}/board`, revision);
  const canWrite =
    role === "NURSE" ||
    (kind === "ipd" ? role === "DOCTOR" : role === "STAT_NURSE");

  async function run(
    path: string,
    success: string,
    body?: Record<string, FormDataEntryValue>,
  ) {
    if (busy) return;
    setBusy(true);
    setFailure("");
    setMessage("");
    try {
      await staffApi(`${endpoint}${path}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      setMessage(success);
      setDistressLocation("");
      setRevision((value) => value + 1);
      if (path.includes("/distress")) {
        window.dispatchEvent(new Event(distressChanged));
      }
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "The operation could not be confirmed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function form(
    event: FormEvent<HTMLFormElement>,
    path: string,
    success: string,
  ) {
    event.preventDefault();
    void run(
      path,
      success,
      Object.fromEntries(new FormData(event.currentTarget)),
    );
  }

  return {
    revision,
    data,
    error,
    canWrite,
    busy,
    message,
    failure,
    distressLocation,
    setDistressLocation,
    refresh: () => setRevision((value) => value + 1),
    run,
    form,
  };
}

function IpdCareBoard({ role, encounterId }: { role: string; encounterId?: string }) {
  const state = useCareBoardActions("ipd", role);
  const metrics = computeIpdMetrics(state.data, state.error, role);
  return (
    <IpdBoardView
      role={role}
      canWrite={state.canWrite}
      encounterId={encounterId}
      data={state.data}
      error={state.error}
      busy={state.busy}
      message={state.message}
      failure={state.failure}
      metrics={metrics}
      distressLocation={state.distressLocation}
      setDistressLocation={state.setDistressLocation}
      onRefresh={state.refresh}
      onRun={state.run}
      onForm={state.form}
    />
  );
}

function CasualtyCareBoard({ role, encounterId }: { role: string; encounterId?: string }) {
  const state = useCareBoardActions("casualty", role);
  const distressPoll = useStaffData<{ events: CareDistressItem[] }>(
    "/clinical/ipd/distress/active",
    state.revision,
  );
  const opd = useOptionalOpdWorkspace();
  const opdEmergencyCount =
    role === "DOCTOR" && opd && opd.queueRequest === "loaded"
      ? opd.queue.filter((item) => item.status === "STAT_ALERT").length
      : null;

  const metrics = computeCasualtyMetrics(
    state.data,
    state.error,
    distressPoll.data?.events,
    distressPoll.error,
    role,
    opdEmergencyCount,
  );

  return (
    <CasualtyBoardView
      role={role}
      canWrite={state.canWrite}
      encounterId={encounterId}
      data={state.data}
      error={state.error}
      busy={state.busy}
      message={state.message}
      failure={state.failure}
      metrics={metrics}
      onRefresh={state.refresh}
      onRun={state.run}
      onForm={state.form}
    />
  );
}

export function CareBoard({ kind, role, encounterId }: CareBoardProps) {
  if (kind === "ipd") {
    return <IpdCareBoard role={role} encounterId={encounterId} />;
  }
  return <CasualtyCareBoard role={role} encounterId={encounterId} />;
}
