import { useRef, type FormEvent } from "react";
import {
  BedDouble,
  Building2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  MapPin,
  RefreshCw,
  Siren,
  UserPlus,
} from "lucide-react";
import { Button, Input } from "@/components/ui/basic";
import { InlineBanner, StatusChip } from "@/components/ui/design-primitives";
import { CareGoldCurve, CarePageWaveFooter } from "./CareGoldCurve";
import type { CareBoardData, IpdMetrics } from "./careMetrics";

const selectStyle =
  "min-h-11 w-full rounded-xl border border-[#D4DFD7] bg-white pl-3.5 pr-4 py-2 text-sm font-medium text-[#0E2420] shadow-xs transition-colors focus:border-[#047C61] focus:outline-none";

interface IpdBoardViewProps {
  role: string;
  canWrite: boolean;
  encounterId?: string;
  data?: CareBoardData;
  error?: string;
  busy: boolean;
  message: string;
  failure: string;
  metrics: IpdMetrics;
  distressLocation: string;
  setDistressLocation: (locationId: string) => void;
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

export function IpdBoardView({
  role,
  canWrite,
  encounterId,
  data,
  error,
  busy,
  message,
  failure,
  metrics,
  distressLocation,
  setDistressLocation,
  onRefresh,
  onRun,
  onForm,
}: IpdBoardViewProps) {
  const admitSectionRef = useRef<HTMLDivElement>(null);

  const jumpToAdmissionForm = () => {
    admitSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="jvk-ca-page relative min-h-[calc(100dvh-112px)] flex flex-col justify-between gap-6">
      <div className="space-y-5">
        {/* Hero Header */}
        <section className="relative overflow-hidden rounded-[22px] py-2 sm:py-3 md:min-h-[140px] lg:min-h-[158px] md:flex md:items-center">
          <div className="relative z-10 w-full md:max-w-[61%] lg:max-w-[63%] xl:max-w-[65%] space-y-2.5">
            <h1 className="jvk-ca-serif text-[26px] sm:text-3xl lg:text-[34px] xl:text-[38px] font-semibold tracking-tight text-[#0E2420] leading-[1.15]">
              Headquarters Command{" "}
              <span className="relative inline-block pr-1">
                Center
                <CareGoldCurve />
              </span>
            </h1>
            <p className="max-w-lg text-sm sm:text-[15px] leading-relaxed text-[#3F554D]">
              Centralized inpatient management for beds, wards, and admissions.
            </p>
          </div>

          <img
            src="/assets/ipd/ipd-ward-hero.png"
            alt=""
            aria-hidden="true"
            className="jvk-ca-mask-hero pointer-events-none select-none hidden md:block absolute top-0 right-0 h-[138px] lg:h-[158px] w-auto max-w-[40%] lg:max-w-[42%] object-contain object-right z-0 opacity-95"
          />
        </section>

        {/* Feedback Banners */}
        {(error || failure) && (
          <InlineBanner tone="critical" title={failure || error || ""} />
        )}
        {message && <InlineBanner tone="success" title={message} />}

        {/* 4 Inpatient KPI Cards */}
        <section
          aria-label="Inpatient statistics"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 xl:gap-4"
        >
          {/* Beds Available */}
          <div className="jvk-ca-card-sage p-4 xl:p-5 flex items-center gap-3.5">
            <span className="grid h-11 w-11 xl:h-12 xl:w-12 shrink-0 place-items-center rounded-full bg-[#E1F1E6] text-[#087F72]">
              <BedDouble className="w-5 h-5 xl:w-6 xl:h-6 stroke-[1.75]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              {metrics.bedsAvailable.status === "ready" ? (
                <div className="text-xl xl:text-[26px] font-bold leading-tight text-[#0E2420] tabular-nums">
                  {metrics.bedsAvailable.value}
                </div>
              ) : (
                <div className="text-base xl:text-lg font-bold leading-tight text-[#4A5E56]">
                  {metrics.bedsAvailable.status === "loading"
                    ? "…"
                    : metrics.bedsAvailable.status === "error"
                      ? "Unavailable"
                      : "Not configured"}
                </div>
              )}
              <div className="mt-1 text-xs xl:text-sm font-medium text-[#4A6158]">
                Beds Available
              </div>
              <div className="text-[11px] text-[#647871]">{metrics.bedsAvailable.hint}</div>
            </div>
          </div>

          {/* Occupied Wards */}
          <div className="jvk-ca-card-sage p-4 xl:p-5 flex items-center gap-3.5">
            <span className="grid h-11 w-11 xl:h-12 xl:w-12 shrink-0 place-items-center rounded-full bg-[#E1F1E6] text-[#087F72]">
              <Building2 className="w-5 h-5 xl:w-6 xl:h-6 stroke-[1.75]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              {metrics.occupiedWards.status === "ready" ? (
                <div className="text-xl xl:text-[26px] font-bold leading-tight text-[#0E2420] tabular-nums">
                  {metrics.occupiedWards.value}
                </div>
              ) : (
                <div className="text-base xl:text-lg font-bold leading-tight text-[#4A5E56]">
                  {metrics.occupiedWards.status === "loading"
                    ? "…"
                    : metrics.occupiedWards.status === "error"
                      ? "Unavailable"
                      : "Not configured"}
                </div>
              )}
              <div className="mt-1 text-xs xl:text-sm font-medium text-[#4A6158]">
                Occupied Wards
              </div>
              <div className="text-[11px] text-[#647871]">{metrics.occupiedWards.hint}</div>
            </div>
          </div>

          {/* Awaiting Admission */}
          <div className="jvk-ca-card-rose p-4 xl:p-5 flex items-center gap-3.5">
            <span className="grid h-11 w-11 xl:h-12 xl:w-12 shrink-0 place-items-center rounded-full bg-[#FAD9D5] text-[#C5392F]">
              <UserPlus className="w-5 h-5 xl:w-6 xl:h-6 stroke-[1.75]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-base xl:text-lg font-bold leading-tight text-[#5E2B27]">
                Unavailable
              </div>
              <div className="mt-1 text-xs xl:text-sm font-medium text-[#6C322E]">
                Awaiting Admission
              </div>
              <div className="text-[11px] text-[#844B47]">{metrics.awaitingAdmission.hint}</div>
            </div>
          </div>

          {/* Admission Requests (jumps to Admission Form when clinical writer) */}
          <button
            type="button"
            onClick={jumpToAdmissionForm}
            className="jvk-ca-card-sage p-4 xl:p-5 text-left hover:border-[#047C61] transition-all flex items-center justify-between gap-3 group cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="grid h-11 w-11 xl:h-12 xl:w-12 shrink-0 place-items-center rounded-full bg-[#E1F1E6] text-[#087F72] group-hover:scale-105 transition-transform">
                <ClipboardCheck className="w-5 h-5 xl:w-6 xl:h-6 stroke-[1.75]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-base xl:text-lg font-bold leading-tight text-[#0E2420]">
                  {metrics.admissionRequests.eligibleEncounters !== null
                    ? `${metrics.admissionRequests.eligibleEncounters} Eligible`
                    : "Unavailable"}
                </div>
                <div className="mt-1 text-xs xl:text-sm font-medium text-[#4A6158]">
                  Admission Requests
                </div>
                <div className="text-[11px] text-[#647871] truncate">
                  {metrics.admissionRequests.hint}
                </div>
              </div>
            </div>
            <ChevronRight
              className="w-4 h-4 shrink-0 text-[#B44138] group-hover:translate-x-0.5 transition-transform"
              aria-hidden="true"
            />
          </button>
        </section>

        {/* Ward Census Header & Body */}
        <section className="space-y-3.5" aria-labelledby="ipd-ward-census-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="ipd-ward-census-heading"
              className="jvk-ca-serif text-xl sm:text-2xl font-semibold text-[#0E2420]"
            >
              Ward census
            </h2>
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              className="rounded-xl border-[#D5CFC2] bg-white/95 hover:bg-[#EEF6F0] text-[#0E2420] font-semibold gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Refresh</span>
            </Button>
          </div>

          {!data && !error && (
            <p role="status" className="text-sm font-medium text-[#4A6158] py-4">
              Loading clinic locations…
            </p>
          )}

          {data && data.locations.length === 0 && (
            <div className="jvk-ca-card-white relative overflow-hidden p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left gap-2.5 max-w-md md:pl-6">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#E5F2EA] text-[#087F72]">
                  <MapPin className="w-5 h-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-bold text-[#0E2420]">
                  No clinic locations configured
                </h3>
                <p className="text-sm text-[#4F635B]">
                  Locations for your authorized clinic appear here.
                </p>
              </div>
              <img
                src="/assets/ipd/ipd-empty-bed.png"
                alt=""
                aria-hidden="true"
                className="jvk-ca-mask-right pointer-events-none select-none h-32 sm:h-40 w-auto object-contain opacity-95"
              />
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
                      location.occupied ? "jvk-ca-card-rose" : "jvk-ca-card-white"
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
                            Discharge
                          </Button>
                        )}
                        {role === "NURSE" && admission && (
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => setDistressLocation(location.id)}
                            className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                          >
                            <Siren className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Report Code Blue</span>
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

          {/* Nurse Code Blue Distress Form (when triggered for an occupied bed) */}
          {distressLocation && (
            <form
              className="jvk-ca-card-rose p-5 space-y-3"
              onSubmit={(event) =>
                onForm(
                  event,
                  `/beds/${distressLocation}/distress`,
                  "Code Blue recorded.",
                )
              }
            >
              <label htmlFor="bedside-reason" className="block text-sm font-bold text-[#6C1D16]">
                Reason for Code Blue
              </label>
              <Input
                id="bedside-reason"
                name="reason"
                required
                maxLength={500}
                placeholder="Describe acute clinical distress…"
                className="bg-white border-[#E5B8B2] rounded-xl"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="destructive" disabled={busy} className="rounded-xl">
                  Record Code Blue
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDistressLocation("")}
                  className="rounded-xl bg-white"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </section>

        {/* Add a clinic bed Accordion */}
        {canWrite && (
          <details className="jvk-ca-card-white overflow-hidden">
            <summary className="min-h-12 cursor-pointer px-5 py-3.5 font-bold text-sm sm:text-base text-[#0E2420] hover:bg-[#FAF6EC]/60 transition-colors">
              Add a clinic bed
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
                  placeholder="e.g. Ward 2 / ICU"
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
                  placeholder="e.g. Bed 2B"
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

        {/* Admit a clinic encounter Form */}
        {data && (
          <section
            ref={admitSectionRef}
            id="ipd-admit-encounter"
            className="jvk-ca-card-white p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#CFE4D6] bg-[#EDF6F0] text-[#087F72]">
                <ClipboardList className="w-5 h-5 stroke-[1.8]" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#0E2420]">
                  Admit a clinic encounter
                </h2>
                {!canWrite && (
                  <p className="mt-0.5 text-xs text-[#556761]">
                    Read-only view for administrative roles. Doctors or nurses authorize bed admissions.
                  </p>
                )}
              </div>
            </div>

            {canWrite && (
              <>
                {data.encounters.length === 0 && (
                  <p className="text-sm text-[#4F635B]">No eligible encounters in this clinic.</p>
                )}
                <form
                  className="grid gap-4 sm:grid-cols-2"
                  onSubmit={(event) =>
                    onForm(event, "/admissions", "Admission recorded.")
                  }
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

                  <div className="sm:col-span-2 pt-1">
                    <Button
                      type="submit"
                      disabled={busy || !data.encounters.length}
                      className="jvk-ca-primary-btn min-h-11 w-full sm:w-auto sm:min-w-[260px] px-6 text-sm font-bold disabled:opacity-55 cursor-pointer"
                    >
                      Confirm assignment
                    </Button>
                  </div>
                </form>
              </>
            )}
          </section>
        )}
      </div>

      <CarePageWaveFooter />
    </div>
  );
}
