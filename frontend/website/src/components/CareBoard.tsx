import { useState, type FormEvent } from "react";
import { Button, Card, CardContent, Input } from "@/components/ui/basic";
import {
  EmptyState,
  InlineBanner,
  StatusChip,
} from "@/components/ui/design-primitives";
import { distressChanged } from "@/components/ShellEmergency";
import { staffApi, useStaffData } from "@/lib/staffApi";

type Board = {
  locations: Array<{
    id: string;
    room: string;
    label: string;
    state: "available" | "cleaning" | "maintenance";
    occupied: 0 | 1;
  }>;
  admissions: Array<{
    id: string;
    encounter_id: string;
    location_id: string;
    name: string;
    tokenNumber: string | null;
    reason: string;
    doctor_id: string;
  }>;
  encounters: Array<{
    id: string;
    name: string;
    status: string;
    tokenNumber: string | null;
  }>;
  doctors: Array<{ id: string }>;
};
const selectStyle = "min-h-11 w-full rounded-md border bg-background p-2";

export function CareBoard({
  kind,
  role,
  encounterId,
}: {
  kind: "ipd" | "casualty";
  role: string;
  encounterId?: string;
}) {
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [distressLocation, setDistressLocation] = useState("");
  const endpoint = `/clinical/${kind}`;
  const { data, error } = useStaffData<Board>(`${endpoint}/board`, revision);
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
      if (path.includes("/distress"))
        window.dispatchEvent(new Event(distressChanged));
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "The operation could not be confirmed.",
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

  return (
    <section className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {kind === "ipd" ? "Ward census" : "Emergency bays"}
        </h1>
        <Button
          variant="outline"
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh
        </Button>
      </header>
      {(error || failure) && (
        <InlineBanner tone="critical" title={failure || error || ""} />
      )}
      {message && <InlineBanner tone="success" title={message} />}
      {!data && !error && <p role="status">Loading clinic locations…</p>}
      {data && (
        <>
          {data.locations.length === 0 && (
            <EmptyState
              title="No clinic locations configured"
              description="Locations for your authorized clinic appear here."
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.locations.map((location) => {
              const admission = data.admissions.find(
                (item) => item.location_id === location.id,
              );
              const state = location.occupied
                ? "Occupied"
                : location.state === "cleaning"
                  ? "Cleaning required"
                  : location.state === "maintenance"
                    ? "Maintenance"
                    : "Available";
              return (
                <Card key={location.id}>
                  <CardContent className="space-y-3 p-4">
                    <h2 className="font-semibold">
                      {location.room} · {location.label}
                    </h2>
                    <StatusChip>{state}</StatusChip>
                    {admission && (
                      <p className="break-words">
                        {admission.tokenNumber
                          ? `${admission.tokenNumber} · `
                          : ""}
                        {admission.name}
                        {admission.reason ? ` · ${admission.reason}` : ""}
                      </p>
                    )}
                    {canWrite && (
                      <div className="flex flex-wrap gap-2">
                        {admission && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                `/admissions/${admission.id}/discharge`,
                                "Location marked for cleaning.",
                              )
                            }
                          >
                            {kind === "ipd" ? "Discharge" : "Release bay"}
                          </Button>
                        )}
                        {role === "NURSE" && kind === "ipd" && admission && (
                          <Button
                            variant="destructive"
                            disabled={busy}
                            onClick={() => setDistressLocation(location.id)}
                          >
                            Report Code Blue
                          </Button>
                        )}
                        {location.state === "cleaning" && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                `/locations/${location.id}/ready`,
                                "Location available.",
                              )
                            }
                          >
                            Mark ready
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {distressLocation && (
            <form
              className="space-y-3 rounded-lg border bg-card p-4"
              onSubmit={(event) =>
                form(
                  event,
                  `/beds/${distressLocation}/distress`,
                  "Code Blue recorded.",
                )
              }
            >
              <label htmlFor="bedside-reason" className="block">
                Reason for Code Blue
              </label>
              <Input
                id="bedside-reason"
                name="reason"
                required
                maxLength={500}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="destructive" disabled={busy}>
                  Record Code Blue
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDistressLocation("")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
          {canWrite && (
            <details className="rounded-lg border bg-card p-4">
              <summary className="min-h-10 cursor-pointer font-semibold">
                Add a clinic {kind === "ipd" ? "bed" : "bay"}
              </summary>
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(event) =>
                  form(event, "/locations", "Clinic location added.")
                }
              >
                <div>
                  <label htmlFor="care-room">Room or unit</label>
                  <Input id="care-room" name="room" required maxLength={80} />
                </div>
                <div>
                  <label htmlFor="care-label">Location label</label>
                  <Input id="care-label" name="label" required maxLength={80} />
                </div>
                <Button type="submit" disabled={busy}>
                  Add location
                </Button>
              </form>
            </details>
          )}
          {canWrite && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <h2 className="font-semibold">
                  {kind === "ipd"
                    ? "Admit a clinic encounter"
                    : "Assign an emergency encounter"}
                </h2>
                {data.encounters.length === 0 && (
                  <p>No eligible encounters in this clinic.</p>
                )}
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) =>
                    form(
                      event,
                      "/admissions",
                      kind === "ipd"
                        ? "Admission recorded."
                        : "Emergency bay assigned.",
                    )
                  }
                >
                  <label>
                    Encounter
                    <select
                      name="encounterId"
                      className={selectStyle}
                      required
                      defaultValue={
                        data.encounters.some((item) => item.id === encounterId)
                          ? encounterId
                          : ""
                      }
                    >
                      <option value="">Select encounter</option>
                      {data.encounters.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.tokenNumber ?? item.id.slice(0, 8)} ·{" "}
                          {item.name} · {item.status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Location
                    <select
                      name="locationId"
                      className={selectStyle}
                      required
                      defaultValue=""
                    >
                      <option value="">Select location</option>
                      {data.locations
                        .filter(
                          (item) =>
                            !item.occupied && item.state === "available",
                        )
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.room} · {item.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Attending doctor
                    <select
                      name="doctorId"
                      className={selectStyle}
                      required
                      defaultValue=""
                    >
                      <option value="">Select doctor</option>
                      {data.doctors.map(({ id }) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <label htmlFor="admission-reason">Admission reason</label>
                    <Input
                      id="admission-reason"
                      name="reason"
                      maxLength={1000}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={busy || !data.encounters.length}
                  >
                    Confirm assignment
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </section>
  );
}
