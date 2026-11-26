import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeftRight,
  BedDouble,
  ChevronRight,
  RefreshCw,
  Siren,
  Users,
} from "lucide-react";
import { Button, Input } from "@/components/ui/basic";
import { InlineBanner, StatusChip } from "@/components/ui/design-primitives";
import { CareGoldCurve, CarePageWaveFooter } from "./CareGoldCurve";
import type { CareBoardData, CasualtyMetrics } from "./careMetrics";

const selectStyle =
  "min-h-11 w-full rounded-xl border border-[#D4DFD7] bg-white pl-3.5 pr-4 py-2 text-sm font-medium text-[#0E2420] shadow-xs transition-colors focus:border-[#047C61] focus:outline-none";

interface CasualtyBoardViewProps {
  role: string;
  canWrite: boolean;
  encounterId?: string;
  data?: CareBoardData;
  error?: string;
  busy: boolean;
  message: string;
  failure: string;
  metrics: CasualtyMetrics;
  onRefresh: () => void;
  onRun: (
    path: string,
    success: string,
    body?: Record<string, FormDataEntryValue>,
  ) => Promise<void>;
  onForm: (
    event: FormEvent<HTMLFormElement>,
    path: string,
    success: string,
  ) => void;
}

export function CasualtyBoardView({
  role,
  canWrite,
  encounterId,
  data,
  error,
  busy,
  message,
  failure,
  metrics,
  onRefresh,
  onRun,
  onForm,
}: CasualtyBoardViewProps) {
  const navigate = useNavigate();
  const isDoctor = role === "DOCTOR";

  return (
    <div className="jvk-ca-page relative min-h-[calc(100dvh-112px)] flex flex-col justify-between gap-6">
      <div className="space-y-5">
        {/* Hero Header */}
        <section className="relative overflow-hidden rounded-[22px] pt-1 pb-2 sm:pb-3">
          <div className="relative z-10 w-full md:max-w-[56%] lg:max-w-[58%] space-y-2.5">
            <span className="inline-flex items-center whitespace-nowrap rounded-full border border-[#F0C2BC] bg-[#FADCD8] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#B33327]">
              PORTAL 3 · EMERGENCY DEPARTMENT
            </span>
            <h1 className="jvk-ca-serif text-[28px] sm:text-4xl lg:text-[38px] xl:text-[42px] font-semibold tracking-tight text-[#0E2420] leading-[1.15]">
              Emergency Triage{" "}
              <span className="relative inline-block jvk-ca-italic pr-1">
                (STAT)
                <CareGoldCurve />
              </span>
            </h1>
            <p className="max-w-lg text-sm sm:text-[15px] leading-relaxed text-[#3F554D]">
              Rapid triage, emergency bay management, and referral coordination for critical and urgent cases.
            </p>
          </div>

          <img
            src="/assets/casualty/casualty-er-hero.png"
            alt=""
            aria-hidden="true"
            className="jvk-ca-mask-hero pointer-events-none select-none hidden md:block absolute top-0 right-0 h-[142px] lg:h-[164px] w-auto max-w-[42%] lg:max-w-[44%] object-contain object-right z-0 opacity-95"
          />
        </section>

        {(error || failure) && (
          <InlineBanner tone="critical" title={failure || error || ""} />
        )}
        {message && <InlineBanner tone="success" title={message} />}

        {/* 4 Emergency KPI Cards */}
        <section
          aria-label="Emergency statistics"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 xl:gap-4"
        >
          {/* Emergency bays occupied */}
          <div className="jvk-ca-card-sage p-4 xl:p-5 flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E1F1E6] text-[#087F72]">
              <BedDouble className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-xl xl:text-[26px] font-bold leading-tight text-[#0E2420] tabular-nums">
                {metrics.baysOccupied.status === "loading" ? (
                  "…"
                ) : metrics.baysOccupied.status === "error" ? (
                  <span className="text-base xl:text-lg text-[#9D2E24]">Unavailable</span>
                ) : (
                  <>
                    <span>{metrics.baysOccupied.occupied}</span>{" "}
                    <span className="text-base font-medium text-[#647871]">
                      / {metrics.baysOccupied.total}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-1 text-xs font-medium text-[#4A6158]">
                Emergency bays occupied
              </div>
              {metrics.baysOccupied.status === "not_configured" && (
                <div className="text-[11px] text-[#647871]">No bays configured</div>
              )}
            </div>
          </div>

          {/* Waiting emergencies */}
          <div className="jvk-ca-card-sage p-4 xl:p-5 flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E1F1E6] text-[#087F72]">
              <Users className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-xl xl:text-[26px] font-bold leading-tight text-[#0E2420] tabular-nums">
                {!data && !error ? (
                  "…"
                ) : metrics.waitingEmergencies.available ? (
                  metrics.waitingEmergencies.value
                ) : (
                  <span className="text-base xl:text-lg text-[#556761]">Unavailable</span>
                )}
              </div>
              <div className="mt-1 text-xs font-medium text-[#4A6158]">
                Waiting emergencies
              </div>
              <div className="text-[11px] text-[#647871]">{metrics.waitingEmergencies.hint}</div>
            </div>
          </div>

          {/* High-priority referrals */}
          <div className="jvk-ca-card-rose p-4 xl:p-5 flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FAD9D5] text-[#C5392F]">
              <AlertTriangle className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-xl xl:text-[26px] font-bold leading-tight text-[#0E2420] tabular-nums">
                {!data && !error ? (
                  "…"
                ) : metrics.highPriorityReferrals.available ? (
                  metrics.highPriorityReferrals.value
                ) : (
                  <span className="text-base xl:text-lg text-[#6C322E]">Unavailable</span>
                )}
              </div>
              <div className="mt-1 text-xs font-medium text-[#6C322E]">
                High-priority referrals
              </div>
              <div className="text-[11px] text-[#844B47]">{metrics.highPriorityReferrals.hint}</div>
            </div>
          </div>

          {/* Active critical alerts */}
          {isDoctor ? (
            <button
              type="button"
              onClick={() => navigate("/app/alerts")}
              className="jvk-ca-card-rose p-4 xl:p-5 text-left hover:border-[#C5392F] transition-all flex items-center justify-between gap-2.5 group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FAD9D5] text-[#C5392F] group-hover:scale-105 transition-transform">
                  <Siren className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-xl xl:text-[26px] font-bold leading-tight text-[#0E2420] tabular-nums">
                    {metrics.activeCriticalAlerts.available ? (
                      metrics.activeCriticalAlerts.value
                    ) : (
                      <span className="text-base xl:text-lg text-[#6C322E]">Unavailable</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs font-medium text-[#6C322E]">
                    Active critical alerts
                  </div>
                  <div className="text-[11px] text-[#844B47] truncate">
                    View in Alerts →
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 text-[#B44138]" aria-hidden="true" />
            </button>
          ) : (
            <div className="jvk-ca-card-rose p-4 xl:p-5 flex items-center gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FAD9D5] text-[#C5392F]">
                <Siren className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-xl xl:text-[26px] font-bold leading-tight text-[#0E2420] tabular-nums">
                  {metrics.activeCriticalAlerts.available ? (
                    metrics.activeCriticalAlerts.value
                  ) : (
                    <span className="text-base xl:text-lg text-[#6C322E]">Unavailable</span>
                  )}
                </div>
                <div className="mt-1 text-xs font-medium text-[#6C322E]">
                  Active critical alerts
                </div>
                <div className="text-[11px] text-[#844B47]">
                  {metrics.activeCriticalAlerts.hint}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* High-Priority Emergency Attention Bar */}
        <section
          aria-live="polite"
          role={metrics.attention.tone === "error" || metrics.attention.tone === "urgent" ? "alert" : "status"}
          className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
            metrics.attention.tone === "error"
              ? "border-rose-400 bg-rose-50 text-rose-950"
              : metrics.attention.tone === "urgent"
                ? "border-[#E08A81] bg-[#FDECEA] text-[#6D1A13]"
                : "border-[#F2D5D1] bg-[#FCF2F0] text-[#4C3B39]"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2.5 text-sm">
            <span className="inline-flex items-center gap-2 font-bold text-[#9C2B22]">
              <Siren className="w-4 h-4 shrink-0 text-[#C5392F]" aria-hidden="true" />
              <span>High-Priority Emergency Attention</span>
            </span>
            <span aria-hidden="true" className="text-[#DFC2BE] hidden sm:inline">
              |
            </span>
            <span className="font-medium">
              {metrics.attention.tone === "clear"
                ? metrics.attention.title
                : `${metrics.attention.title}: ${metrics.attention.detail}`}
            </span>
          </div>
          {isDoctor && (metrics.attention.tone === "urgent" || metrics.attention.tone === "error") && (
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/app/alerts")}
              className="rounded-xl border-[#DCA49E] bg-white text-xs font-bold text-[#9C2B22] hover:bg-rose-50 cursor-pointer"
            >
              Open Alerts
            </Button>
          )}
        </section>

        {/* Emergency Bays Section */}
        <section className="jvk-ca-card-white p-5 sm:p-6 space-y-5" aria-labelledby="casualty-bays-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#CFE4D6] bg-[#EDF6F0] text-[#087F72]">
                <BedDouble className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
              </span>
              <h2
                id="casualty-bays-heading"
                className="jvk-ca-serif text-xl sm:text-2xl font-semibold text-[#0E2420]"
              >
                Emergency bays
              </h2>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              className="rounded-xl border-[#D5CFC2] bg-white hover:bg-[#EEF6F0] text-[#0E2420] font-semibold gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Refresh</span>
            </Button>
          </div>

          {!data && !error && (
            <p role="status" className="text-sm font-medium text-[#4A6158] py-3">
              Loading clinic locations…
            </p>
          )}

          {data && data.locations.length === 0 && (
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 py-2">
              <img
                src="/assets/casualty/casualty-stretcher-empty.png"
                alt=""
                aria-hidden="true"
                className="jvk-ca-mask-left pointer-events-none select-none h-32 sm:h-40 w-auto object-contain opacity-95"
              />
              <div className="md:border-l md:border-[#ECE5D5] md:pl-8 text-center md:text-left space-y-1.5 max-w-sm">
                <h3 className="text-lg font-bold text-[#0E2420]">
                  No clinic locations configured
                </h3>
                <p className="text-sm text-[#4F635B]">
                  Locations for your authorized clinic appear here.
                </p>
              </div>
            </div>
          )}

          {data && data.locations.length > 0 && (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
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
                  <div
                    key={location.id}
                    className={`p-4 space-y-3 ${
                      location.occupied ? "jvk-ca-card-rose" : "jvk-ca-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-[#0E2420] text-base leading-snug">
                        {location.room} · {location.label}
                      </h3>
                      <StatusChip
                        tone={
                          location.occupied
                            ? "warning"
                            : location.state === "cleaning"
                              ? "warning"
                              : "success"
                        }
                      >
                        {state}
                      </StatusChip>
                    </div>

                    {admission && (
                      <div className="rounded-xl border border-[#F0D5D1] bg-white/85 px-3 py-2 text-xs text-[#2C4039] space-y-0.5">
                        <p className="font-semibold text-[#0E2420] break-words">
                          {admission.tokenNumber ? `${admission.tokenNumber} · ` : ""}
                          {admission.name}
                        </p>
                        {admission.reason && (
                          <p className="text-[#556761] break-words">{admission.reason}</p>
                        )}
                      </div>
                    )}

                    {canWrite && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {admission && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void onRun(
                                `/admissions/${admission.id}/discharge`,
                                "Location marked for cleaning.",
                              )
                            }
                            className="rounded-xl border-[#CFDAD2] bg-white text-xs font-semibold text-[#0E2420] hover:bg-[#EEF6F0] cursor-pointer"
                          >
                            Release bay
                          </Button>
                        )}
                        {location.state === "cleaning" && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void onRun(
                                `/locations/${location.id}/ready`,
                                "Location available.",
                              )
                            }
                            className="rounded-xl border-[#047C61]/40 bg-[#EDF7F1] text-xs font-semibold text-[#047C61] hover:bg-[#DFF0E6] cursor-pointer"
                          >
                            Mark ready
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Referred Emergency Encounters Card */}
        {data && (role === "DOCTOR" || data.encounters.length > 0) && (
          <section className="jvk-ca-card-white relative overflow-hidden p-5 sm:p-6">
            <div className="relative z-10 flex items-start gap-3.5 sm:pr-32">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#CFE4D6] bg-[#EDF6F0] text-[#087F72]">
                <ArrowLeftRight className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-base sm:text-lg font-bold text-[#0E2420]">
                  {role === "DOCTOR"
                    ? "Referred emergency encounters"
                    : "Waiting emergency encounters"}
                </h2>
                {role === "DOCTOR" ? (
                  data.encounters.length === 0 ? (
                    <p className="text-sm text-[#4F635B]">
                      No emergency referrals assigned to you.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.encounters.map((item) => (
                        <li
                          key={item.id}
                          className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-[#F0D5D1] bg-[#FDF5F4] px-3 py-1.5 text-sm font-medium text-[#0E2420] mr-2"
                        >
                          <StatusChip tone="warning">{item.status}</StatusChip>
                          <span>
                            {item.tokenNumber ? `${item.tokenNumber} · ` : ""}
                            {item.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <ul className="space-y-1.5">
                    {data.encounters.map((item) => (
                      <li
                        key={item.id}
                        className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-[#F0D5D1] bg-[#FDF5F4] px-3 py-1.5 text-sm font-medium text-[#0E2420] mr-2"
                      >
                        <StatusChip tone="warning">{item.status}</StatusChip>
                        <span>
                          {item.tokenNumber ? `${item.tokenNumber} · ` : ""}
                          {item.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <img
              src="/assets/casualty/casualty-card-leaves.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none select-none hidden sm:block absolute bottom-0 right-0 h-20 w-auto opacity-95 z-0"
            />
          </section>
        )}

        {/* Nurse / STAT Nurse Additional Operational Forms (Natural Scrollable Extensions) */}
        {canWrite && (
          <details className="jvk-ca-card-white overflow-hidden">
            <summary className="min-h-12 cursor-pointer px-5 py-3.5 font-bold text-sm sm:text-base text-[#0E2420] hover:bg-[#FAF6EC]/60 transition-colors">
              Add a clinic bay
            </summary>
            <form
              className="grid gap-4 sm:grid-cols-2 px-5 pb-5 pt-2 border-t border-[#ECE5D5]"
              onSubmit={(event) =>
                onForm(event, "/locations", "Clinic location added.")
              }
            >
              <div className="space-y-1.5">
                <label htmlFor="care-room" className="block text-xs font-semibold text-[#2C4039]">
                  Room or unit
                </label>
                <Input
                  id="care-room"
                  name="room"
                  required
                  maxLength={80}
                  placeholder="e.g. Trauma Bay"
                  className="bg-white border-[#D4DFD7] rounded-xl h-11"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="care-label" className="block text-xs font-semibold text-[#2C4039]">
                  Location label
                </label>
                <Input
                  id="care-label"
                  name="label"
                  required
                  maxLength={80}
                  placeholder="e.g. Bay 1"
                  className="bg-white border-[#D4DFD7] rounded-xl h-11"
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={busy}
                  className="jvk-ca-primary-btn min-h-10 px-5 text-sm font-bold cursor-pointer"
                >
                  Add location
                </Button>
              </div>
            </form>
          </details>
        )}

        {data && canWrite && (
          <section className="jvk-ca-card-white p-5 sm:p-6 space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-[#0E2420]">
              Assign an emergency encounter
            </h2>
            {data.encounters.length === 0 && (
              <p className="text-sm text-[#4F635B]">No eligible encounters in this clinic.</p>
            )}
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                const submitter = (event.nativeEvent as SubmitEvent).submitter;
                if (
                  submitter instanceof HTMLButtonElement &&
                  submitter.value === "refer"
                ) {
                  event.preventDefault();
                  const fields = new FormData(event.currentTarget);
                  void onRun("/referrals", "Emergency encounter referred.", {
                    encounterId: fields.get("encounterId") ?? "",
                    doctorId: fields.get("doctorId") ?? "",
                  });
                  return;
                }
                onForm(event, "/admissions", "Emergency bay assigned.");
              }}
            >
              <label className="space-y-1.5 block">
                <span className="block text-xs font-semibold text-[#2C4039]">Encounter</span>
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
                  <option value="" disabled hidden>Select encounter</option>
                  {data.encounters.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.tokenNumber ?? item.id.slice(0, 8)} ·{" "}
                      {item.name} · {item.status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 block">
                <span className="block text-xs font-semibold text-[#2C4039]">Location</span>
                <select
                  name="locationId"
                  className={selectStyle}
                  required
                  defaultValue=""
                >
                  <option value="" disabled hidden>Select location</option>
                  {data.locations
                    .filter((item) => !item.occupied && item.state === "available")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.room} · {item.label}
                      </option>
                    ))}
                </select>
              </label>

              <label className="space-y-1.5 block">
                <span className="block text-xs font-semibold text-[#2C4039]">
                  Attending doctor
                </span>
                <select
                  name="doctorId"
                  className={selectStyle}
                  required
                  defaultValue=""
                >
                  <option value="" disabled hidden>Select doctor</option>
                  {data.doctors.map(({ id }) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-1.5">
                <label
                  htmlFor="admission-reason"
                  className="block text-xs font-semibold text-[#2C4039]"
                >
                  Admission reason
                </label>
                <Input
                  id="admission-reason"
                  name="reason"
                  maxLength={1000}
                  className="min-h-11 bg-[#F4F1E8]/70 border-[#DFD8C8] rounded-xl text-[#0E2420]"
                />
              </div>

              <div className="sm:col-span-2 flex flex-wrap gap-3 pt-1">
                <Button
                  type="submit"
                  disabled={busy || !data.encounters.length}
                  className="jvk-ca-primary-btn min-h-11 px-6 text-sm font-bold disabled:opacity-55 cursor-pointer"
                >
                  Confirm assignment
                </Button>
                <Button
                  type="submit"
                  value="refer"
                  formNoValidate
                  variant="outline"
                  disabled={busy || !data.encounters.length}
                  className="min-h-11 rounded-xl border-[#CFDAD2] bg-white px-5 text-sm font-bold text-[#0E2420] hover:bg-[#EEF6F0] cursor-pointer"
                >
                  Refer to doctor
                </Button>
              </div>
            </form>
          </section>
        )}
      </div>

      <CarePageWaveFooter />
    </div>
  );
}
