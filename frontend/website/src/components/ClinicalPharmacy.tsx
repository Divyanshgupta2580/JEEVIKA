import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Lock,
  Package,
  Pill,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type {
  Inventory,
  PrescriptionDraft,
  PrescriptionQuote,
  StockPlan,
} from "../../../../packages/shared/operations";
import { prescriptionQuoteSchema, signPrescriptionSchema } from "../../../../packages/shared/operations";
import type { ClinicalReceipt } from "../../../../packages/shared/clinical-receipt";
import { PharmacyRefillReview } from "@/components/PharmacyRefillReview";
import { ClinicalReceiptDetails } from "@/components/ui/ClinicalReceiptDetails";
import { useHospital } from "@/context/HospitalContext";
import type { OpdPrescriptionItem, OpdPrescriptionReview } from "@/features/opd/opdMetricsAndAlerts";
import { Button, Card, CardContent, Input } from "@/components/ui/basic";
import {
  Drawer,
  EmptyState,
  InlineBanner,
  StatusChip,
} from "@/components/ui/design-primitives";
import { staffApi, useStaffData } from "@/lib/staffApi";
import { paiseToRupeesString, rupeesToPaise } from "@/lib/utils";
import "@/design-system/clinic-ops.css";

const pharmacy = "/clinical/pharmacy";
const money = (paise: number) => `₹${paiseToRupeesString(paise)}`;
const selectStyle =
  "min-h-11 w-full rounded-lg border border-[#CEDAD3] bg-white pl-3.5 pr-4 py-2 text-sm font-medium text-[#0E2420]";

type CatalogChoice = {
  id: string;
  brand: string;
  salt: string;
  strengthMg: number;
  form: string;
  nti: number;
  scheduleH: number;
};

export function SignPrescription({
  encounterId,
  plan,
  review,
  updatePlan,
  updateReview,
  saveDraft,
  close,
  onSigned,
}: {
  encounterId: string;
  plan: OpdPrescriptionItem[];
  review: OpdPrescriptionReview;
  updatePlan: (plan: OpdPrescriptionItem[]) => void;
  updateReview: (updates: OpdPrescriptionReview) => void;
  saveDraft: () => Promise<void>;
  close: () => void;
  onSigned: () => void;
}) {
  const { data, error } = useStaffData<{ items: CatalogChoice[] }>(`${pharmacy}/catalog`);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const [saved, setSaved] = useState(false);
  const [checked, setChecked] = useState<{ draft: PrescriptionDraft; quote: PrescriptionQuote }>();
  const emptyLine: OpdPrescriptionItem = { drug: "", dosage: "", frequency: "", duration: "", availableInClinic: false };
  const rows = plan.length ? plan : [emptyLine];
  const medicines = data?.items ?? [];
  const directions = (line: OpdPrescriptionItem) => line.directions ??
    [line.dosage, line.frequency, line.duration, line.instructions].filter(Boolean).join(" · ");

  function changeLine(index: number, updates: Partial<OpdPrescriptionItem>) {
    setChecked(undefined);
    setSaved(false);
    updatePlan(rows.map((line, position) => position === index ? { ...line, ...updates } : line));
  }

  function changeReview(updates: OpdPrescriptionReview) {
    setChecked(undefined);
    setSaved(false);
    updateReview(updates);
  }

  async function persistDraft() {
    setPending(true);
    setFailure("");
    try {
      await saveDraft();
      setSaved(true);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Prescription draft unavailable");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const draft = signPrescriptionSchema.safeParse({
      encounterId,
      note: review.note,
      allergiesReviewed: review.allergiesReviewed,
      pharmacyConsentConfirmed: review.pharmacyConsentConfirmed,
      allergies: (review.allergies ?? "").split("\n").map((line) => line.trim()).filter(Boolean),
      unavailableReason: review.unavailableReason?.trim() || undefined,
      lines: rows.map((line) => ({
        skuId: line.skuId,
        units: line.units,
        courseEnd: line.courseEnd,
        directions: directions(line),
        allowEquivalent: false,
        approvedSubstituteSkuId: line.approvedSubstituteSkuId,
      })),
    });
    if (!draft.success) {
      setFailure("Complete every medicine line and confirm that you reviewed allergies and pharmacy consent.");
      return;
    }
    setPending(true);
    setFailure("");
    try {
      if (checked?.quote.approval && JSON.stringify(checked.draft) === JSON.stringify(draft.data)) {
        await staffApi(`${pharmacy}/prescriptions`, {
          method: "POST",
          body: JSON.stringify({ draft: draft.data, checkedAt: checked.quote.checkedAt, approval: checked.quote.approval }),
        });
        onSigned();
      } else {
        const result = await staffApi<unknown>(`${pharmacy}/prescriptions/quote`, {
          method: "POST", body: JSON.stringify(draft.data),
        });
        setChecked({ draft: draft.data, quote: prescriptionQuoteSchema.parse(result) });
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Prescription review could not be completed.");
      setChecked(undefined);
    } finally {
      setPending(false);
    }
  }

  const checkedAt = checked?.quote.checkedAt;
  const needsAvailabilityReason = checked?.quote.lines.some((line) => !line.blocked && line.reason);
  return (
    <Drawer
      open onClose={close}
      title="Sign prescription for pharmacy"
      description="Review this encounter’s medicines against the clinic catalogue and current stock."
    >
      {(error || failure) && <InlineBanner tone="critical" title={failure || error || ""} />}
      {!data && !error && <p role="status">Loading catalog…</p>}
      {data && !medicines.length && (
        <EmptyState title="No catalog items" description="A clinic medicine catalog is needed before signing." />
      )}
      {medicines.length > 0 && (
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <fieldset disabled={pending} className="space-y-4">
            <div>
              <label htmlFor="rx-note">Prescription note</label>
              <Input id="rx-note" value={review.note ?? ""} minLength={3} maxLength={4000} required
                onChange={(event) => changeReview({ note: event.target.value })} />
            </div>
            <label className="block">
              Additional allergies, one per line
              <textarea className="block w-full rounded-md border p-2" rows={2}
                value={review.allergies ?? ""} onChange={(event) => changeReview({ allergies: event.target.value })} />
            </label>
            {rows.map((line, index) => {
              const item = medicines.find((medicine) => medicine.id === line.skuId);
              const equivalents = item && !item.nti ? medicines.filter((candidate) =>
                candidate.id !== item.id && !candidate.nti &&
                candidate.salt.toLowerCase() === item.salt.toLowerCase() &&
                candidate.strengthMg === item.strengthMg && candidate.form === item.form &&
                candidate.scheduleH === item.scheduleH,
              ) : [];
              const quote = checked?.quote.lines[index];
              return (
                <fieldset key={index} className="space-y-3 rounded-md border p-3">
                  <legend>Medicine {index + 1}{line.drug ? ` · ${line.drug}` : ""}</legend>
                  <label className="block">
                    Catalog item
                    <select className={selectStyle} value={line.skuId ?? ""} required
                      onChange={(event) => {
                        const selected = medicines.find(({ id }) => id === event.target.value);
                        changeLine(index, {
                          skuId: selected?.id, approvedSubstituteSkuId: undefined,
                          drug: line.drug || selected?.brand || "",
                        });
                      }}>
                      <option value="">Choose medicine</option>
                      {medicines.map(({ id, brand, salt, strengthMg, form }) => (
                        <option key={id} value={id}>{brand} · {salt} {strengthMg} mg {form}</option>
                      ))}
                    </select>
                  </label>
                  {equivalents.length > 0 && (
                    <label className="block">
                      Approve a specific equivalent
                      <select className={selectStyle} value={line.approvedSubstituteSkuId ?? ""}
                        onChange={(event) => changeLine(index, { approvedSubstituteSkuId: event.target.value || undefined })}>
                        <option value="">Keep selected catalog item</option>
                        {equivalents.map(({ id, brand }) => <option key={id} value={id}>{brand}</option>)}
                      </select>
                    </label>
                  )}
                  <div>
                    <label htmlFor={`rx-units-${index}`}>Units</label>
                    <Input id={`rx-units-${index}`} type="number" min={1} max={1000} value={line.units ?? ""} required
                      onChange={(event) => changeLine(index, { units: Number(event.target.value) || undefined })} />
                  </div>
                  <div>
                    <label htmlFor={`rx-end-${index}`}>Course end</label>
                    <Input id={`rx-end-${index}`} type="date" value={line.courseEnd ?? ""} required
                      onChange={(event) => changeLine(index, { courseEnd: event.target.value })} />
                  </div>
                  <div>
                    <label htmlFor={`rx-directions-${index}`}>Directions</label>
                    <Input id={`rx-directions-${index}`} minLength={3} maxLength={1000} value={directions(line)} required
                      onChange={(event) => changeLine(index, { directions: event.target.value })} />
                  </div>
                  {quote && (
                    <div role={quote.blocked ? "alert" : "status"} className="rounded-md bg-[#EDF7F2] p-2 text-sm">
                      <strong>{quote.finalSku.brand}</strong> · {quote.eligibleUnits} eligible / {quote.units} requested
                      <div>{quote.reason ?? `Quoted course price ${money(quote.quotedTotalPaise ?? 0)}`}</div>
                      {quote.finalSku.id !== quote.prescribedSku.id && quote.originalTotalPaise !== null && quote.quotedTotalPaise !== null && (
                        <div>Original course {money(quote.originalTotalPaise)} · Approved course {money(quote.quotedTotalPaise)}</div>
                      )}
                    </div>
                  )}
                </fieldset>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={rows.length >= 20}
                onClick={() => { setChecked(undefined); setSaved(false); updatePlan([...rows, emptyLine]); }}>Add medicine</Button>
              {rows.length > 1 && <Button type="button" variant="outline"
                onClick={() => { setChecked(undefined); setSaved(false); updatePlan(rows.slice(0, -1)); }}>Remove last medicine</Button>}
            </div>
            {checkedAt && (
              <p role="status">Checked {new Date(checkedAt).toLocaleString("en-IN")}. Stock is checked again at checkout.</p>
            )}
            {checked?.quote.allergies.length ? <p role="status">Allergies used for this check · {checked.quote.allergies.join(", ")}</p> : null}
            {checked?.quote.warnings.map((warning) => <InlineBanner key={warning} tone="critical" title={warning} />)}
            {(needsAvailabilityReason || review.unavailableReason !== undefined) && (
              <label className="block">
                Clinical reason to prescribe despite unavailable stock
                <Input value={review.unavailableReason ?? ""} minLength={10} maxLength={1000}
                  onChange={(event) => changeReview({ unavailableReason: event.target.value })} />
              </label>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={review.allergiesReviewed ?? false} required
                onChange={(event) => changeReview({ allergiesReviewed: event.target.checked })} />
              I reviewed the patient’s allergies.
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={review.pharmacyConsentConfirmed ?? false} required
                onChange={(event) => changeReview({ pharmacyConsentConfirmed: event.target.checked })} />
              The patient authorized pharmacy sharing.
            </label>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => void persistDraft()}>Save prescription draft</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Working…" : checked?.quote.approval ? "Sign and send to pharmacy" : "Check clinic stock"}
            </Button>
          </div>
          {saved && <p role="status">Prescription draft saved.</p>}
        </form>
      )}
    </Drawer>
  );
}

type Sale = { id: string; totalPaise: number; createdAt: string };
export function PharmacyInflow() {
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState("");
  const [receipt, setReceipt] = useState<{ sale: Sale | ClinicalReceipt; retrieved?: boolean }>();
  const [showReceiptLookup, setShowReceiptLookup] = useState(false);
  const { data, error } = useStaffData<{
    prescriptions: Array<{ id: string; patientName: string }>;
  }>(`${pharmacy}/inflow`, revision);
  const isRefreshing = !data && !error && revision > 0;
  return (
    <section className="jvk-admin-page jvk-clinic-ops-page mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div data-jvk-entrance="left" className="flex items-center gap-3.5 min-w-0">
          <span aria-hidden="true" className="jvk-clinic-ops-icon-badge">
            <Pill className="h-5 w-5" />
          </span>
          <h1 className="jvk-clinic-ops-serif text-[26px] sm:text-[30px] font-bold leading-tight text-[#103B32]">
            Pharmacy POS
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="jvk-admin-secondary-btn" onClick={() => setShowReceiptLookup(true)}>
            Find cash receipt
          </button>
          <button
            type="button"
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            onClick={() => setRevision((value) => value + 1)}
            className="jvk-admin-secondary-btn shrink-0"
          >
            <RefreshCw
              className={`h-4 w-4 text-[#087466] ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>Refresh inflow</span>
          </button>
        </div>
      </header>
      {error && <InlineBanner tone="critical" title={error} />}
      {!data && !error && (
        <div
          role="status"
          className="jvk-clinic-ops-card px-6 py-10 text-center text-sm font-medium text-[#52685F]"
        >
          Loading prescriptions…
        </div>
      )}
      {receipt && <CashReceiptPanel key={receipt.sale.id} {...receipt} />}

      {data?.prescriptions.length === 0 && (
        <div className="jvk-clinic-ops-card jvk-clinic-ops-enter flex flex-col items-center justify-center px-6 py-10 sm:py-12 text-center">
          <img
            src="/assets/admin/medicine-bottles.png"
            alt=""
            aria-hidden="true"
            width={220}
            height={176}
            className="jvk-clinic-ops-artwork w-48 sm:w-56 h-auto mb-3"
          />
          <h2 className="jvk-clinic-ops-serif text-[21px] sm:text-[23px] font-bold text-[#103B32]">
            No prescriptions awaiting dispensing
          </h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#52685F]">
            Signed prescriptions shared with this clinic’s pharmacy will appear
            here.
          </p>
        </div>
      )}
      {!!data?.prescriptions.length && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.prescriptions.map(({ id, patientName }) => {
            const isSelected = selected === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelected(id)}
                  className={`jvk-admin-card-interactive flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? "border-[#087466] bg-[#DFF4ED] text-[#103B32] shadow-xs"
                      : "border-[#E4E5DA] bg-[#FFFDF8] text-[#103B32] hover:border-[#99C7B7] hover:bg-[#F3FAF6]"
                  }`}
                >
                  <span className="truncate font-bold">{patientName}</span>
                  <span className="shrink-0 font-mono text-xs text-[#087466]">
                    {id.slice(0, 8)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected && (
        <Checkout
          key={selected}
          id={selected}
          onSale={(sale) => {
            setReceipt({ sale });
            setSelected("");
            setRevision((value) => value + 1);
          }}
        />
      )}
      <PharmacyRefillReview revision={revision} onChanged={() => setRevision(value => value + 1)} />
      {showReceiptLookup && (
        <CashReceiptLookup
          close={() => setShowReceiptLookup(false)}
          onFound={(sale) => {
            setReceipt({ sale, retrieved: true });
            setShowReceiptLookup(false);
          }}
        />
      )}
    </section>
  );
}

function CashReceiptPanel({ sale, retrieved }: { sale: Sale | ClinicalReceipt; retrieved?: boolean }) {
  const [revision, setRevision] = useState(0);
  const stored = "lines" in sale ? sale : undefined;
  const { data, error } = useStaffData<ClinicalReceipt>(`${pharmacy}/receipts/${encodeURIComponent(sale.id)}`, revision);
  const receipt = stored ?? data;
  return (
    <Card className="jvk-clinic-ops-card">
      <CardContent className="space-y-2.5 p-5 sm:p-6">
        <h2 className="jvk-clinic-ops-serif text-lg font-bold text-[#103B32]">
          {retrieved ? "Cash receipt" : "Cash sale recorded"}
        </h2>
        <p className="text-base font-bold text-[#087466] tabular-nums">Total {money(sale.totalPaise)}</p>
        {receipt ? (
          <ClinicalReceiptDetails receipt={receipt} />
        ) : (
          <>
            <p className="break-all font-mono text-xs">Receipt {sale.id}</p>
            {error ? (
              <>
                <p role="alert">{error}</p>
                <Button type="button" onClick={() => setRevision(value => value + 1)}>Retry receipt</Button>
              </>
            ) : <p role="status">Loading posted receipt…</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CashReceiptLookup({ close, onFound }: { close: () => void; onFound: (sale: ClinicalReceipt) => void }) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const id = String(form.get("receipt") ?? "").trim();
    const day = String(form.get("day") ?? "");
    setPending(true);
    setFailure("");
    try {
      const path = `${pharmacy}/receipts/${encodeURIComponent(id)}`;
      onFound(await staffApi<ClinicalReceipt>(day ? `${path}?day=${encodeURIComponent(day)}` : path));
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Cash receipt unavailable.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Drawer open onClose={close} title="Find cash receipt" description="Enter the reference printed on the cash receipt.">
      {failure && <InlineBanner tone="critical" title={failure} />}
      <form className="space-y-3" onSubmit={(event) => void lookup(event)}>
        <label className="block">Receipt reference
          <Input name="receipt" minLength={36} maxLength={36} required />
        </label>
        <label className="block">Posted date (IST, optional)
          <Input name="day" type="date" />
        </label>
        <Button type="submit" disabled={pending}>Open receipt</Button>
      </form>
    </Drawer>
  );
}

function Checkout({
  id,
  onSale,
}: {
  id: string;
  onSale: (sale: Sale) => void;
}) {
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const request = useRef<{ key: string; body: string }>();
  const { data, error } = useStaffData<StockPlan>(
    `${pharmacy}/inflow/${id}/quote`,
    revision,
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data?.complete || pending) return;
    const fields = new FormData(event.currentTarget);
    const body = JSON.stringify({
      prescriptionId: id,
      expectedTotalPaise: data.totalPaise,
      cashReceived: fields.has("cash"),
      taxMode: fields.get("taxMode"),
    });
    if (request.current?.body !== body)
      request.current = { key: crypto.randomUUID(), body };
    setPending(true);
    setFailure("");
    try {
      onSale(
        await staffApi<Sale>(`${pharmacy}/checkout`, {
          method: "POST",
          headers: { "Idempotency-Key": request.current.key },
          body,
        }),
      );
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "Checkout could not be confirmed.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Card className="jvk-clinic-ops-card">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7ECE8] pb-3.5">
          <h2 className="jvk-clinic-ops-serif text-lg font-bold text-[#103B32]">
            Batch allocation and checkout
          </h2>
          <button
            type="button"
            disabled={pending}
            onClick={() => setRevision((value) => value + 1)}
            className="jvk-admin-secondary-btn !min-h-9"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[#087466]" aria-hidden="true" />
            <span>Refresh quote</span>
          </button>
        </div>
        {!data && !error && (
          <p role="status" className="text-sm text-[#52685F]">
            Checking stock and price…
          </p>
        )}
        {(error || failure) && (
          <InlineBanner tone="critical" title={failure || error || ""} />
        )}
        {data && !data.complete && (
          <InlineBanner
            tone="warning"
            title="Prescription cannot be filled from current stock"
          >
            {data.issues.map(({ reason }, index) => (
              <p key={index}>{reason}</p>
            ))}
          </InlineBanner>
        )}
        {data?.complete && (
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <ul className="divide-y divide-[#E7ECE8] rounded-xl border border-[#E4E5DA] bg-[#FAFBF7] px-4">
              {data.allocation.map((item) => (
                <li
                  className="flex flex-wrap justify-between gap-2 py-3 text-sm text-[#103B32]"
                  key={`${item.lineId}-${item.batchId}`}
                >
                  <span className="font-medium">
                    {item.brand} · {item.units} units · expires {item.expiry}
                  </span>
                  <span className="font-semibold text-[#087466] tabular-nums">
                    {money(item.unitPricePaise)} per unit
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-lg font-bold text-[#103B32] tabular-nums">
              Total {money(data.totalPaise)}
            </p>
            <label className="block text-sm font-medium text-[#243B34]">
              Tax treatment
              <select
                className={`${selectStyle} mt-1.5`}
                name="taxMode"
                required
                defaultValue=""
              >
                <option value="" disabled hidden>Select</option>
                <option value="intra">Intra-state</option>
                <option value="inter">Inter-state</option>
              </select>
            </label>
            <label className="jvk-clinic-ops-check-label">
              <input
                type="checkbox"
                name="cash"
                required
                className="jvk-clinic-ops-checkbox"
              />
              <span>Cash received and amount confirmed.</span>
            </label>
            <div className="pt-1">
              <button
                type="submit"
                disabled={pending}
                className="jvk-admin-primary-btn"
              >
                {pending ? "Posting checkout…" : "Record cash sale and dispense"}
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

type PublicBatch = Omit<Inventory["batches"][number], "costPaise">;

export function ClinicStock({
  canManageCatalog,
  canAdjustStock,
}: {
  canManageCatalog: boolean;
  canAdjustStock: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [expiryOnly, setExpiryOnly] = useState(false);
  const [adjusting, setAdjusting] = useState<PublicBatch>();
  const [adjustment, setAdjustment] = useState<string>();
  const { data, error } = useStaffData<{
    batches: PublicBatch[];
  }>(`${pharmacy}/inventory`, revision);
  const { pendingRestockId, setPendingRestockId } = useHospital();
  useEffect(() => {
    if (!pendingRestockId || !data) return;
    const target = data.batches.find(batch => batch.id === pendingRestockId);
    if (target) setSearch(target.batchNo);
    setPendingRestockId(null);
  }, [pendingRestockId, data, setPendingRestockId]);
  const date = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const batches = (data?.batches ?? []).filter(
    (batch) =>
      (!expiryOnly || batch.expiry <= cutoff) &&
      [batch.brand, batch.batchNo, batch.salt].some((value) =>
        value.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  const allBatches = data?.batches ?? [];
  const totalCount = allBatches.length;
  const inStockCount = allBatches.filter((b) => b.available > 0 && b.expiry >= date).length;
  const lowStockCount = allBatches.filter((b) => b.available > 0 && b.available <= 10 && b.expiry >= date).length;
  const expiringCount = allBatches.filter((b) => b.expiry >= date && b.expiry <= cutoff).length;
  const expiredCount = allBatches.filter((b) => b.expiry < date).length;
  const isRefreshing = !data && !error && revision > 0;
  const hasFilters = Boolean(search.trim()) || expiryOnly;

  return (
    <section className="jvk-admin-page jvk-clinic-ops-page mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div data-jvk-entrance="left" className="flex items-center gap-3.5 min-w-0">
          <span aria-hidden="true" className="jvk-clinic-ops-icon-badge">
            <Package className="h-5 w-5" />
          </span>
          <h1 className="jvk-clinic-ops-serif text-[26px] sm:text-[30px] font-bold leading-tight text-[#103B32]">
            Clinic Inventory
          </h1>
        </div>
        <button
          type="button"
          disabled={isRefreshing}
          aria-busy={isRefreshing}
          onClick={() => setRevision((value) => value + 1)}
          className="jvk-admin-secondary-btn shrink-0"
        >
          <RefreshCw
            className={`h-4 w-4 text-[#087466] ${isRefreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          <span>Refresh stock</span>
        </button>
      </header>

      <search className="space-y-2.5">
        <div>
          <label
            htmlFor="clinic-stock-search"
            className="mb-1.5 block text-sm font-semibold text-[#103B32]"
          >
            Search medicine or batch
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B847B]"
              aria-hidden="true"
            />
            <Input
              id="clinic-stock-search"
              type="search"
              placeholder="Search by medicine name, salt, or batch number..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-10 h-11 rounded-xl border-[#DCE2D7] bg-[#FFFDF8] text-[#103B32] shadow-xs focus:border-[#087466]"
            />
          </div>
        </div>
        <label className="jvk-clinic-ops-check-label">
          <input
            type="checkbox"
            checked={expiryOnly}
            onChange={(event) => setExpiryOnly(event.target.checked)}
            className="jvk-clinic-ops-checkbox"
          />
          <span>Expires within 90 days or already expired</span>
        </label>
      </search>

      {allBatches.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 rounded-2xl border border-[#D4E6DA] bg-[#F2F8F4] p-3.5">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#DFF4ED] text-[#047C61]">
              <Pill className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-medium text-[#556C63]">Total items</p>
              <p className="text-lg font-bold text-[#0E2420] tabular-nums">{totalCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-2 py-1 lg:border-l lg:border-[#DCE8E0]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E4F4EA] text-[#059669]">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-medium text-[#556C63]">In stock</p>
              <p className="text-lg font-bold text-[#059669] tabular-nums">{inStockCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-2 py-1 lg:border-l lg:border-[#DCE8E0]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#FEF3DC] text-[#B45309]">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-medium text-[#556C63]">Low stock</p>
              <p className="text-lg font-bold text-[#B45309] tabular-nums">{lowStockCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-2 py-1 lg:border-l lg:border-[#DCE8E0]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#FDECEA] text-[#C2410C]">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-medium text-[#556C63]">Expiring ≤ 90 days</p>
              <p className="text-lg font-bold text-[#C2410C] tabular-nums">{expiringCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-2 py-1 lg:border-l lg:border-[#DCE8E0]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#FDF1EF] text-[#B9382C]">
              <XCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-medium text-[#556C63]">Expired</p>
              <p className="text-lg font-bold text-[#B9382C] tabular-nums">{expiredCount}</p>
            </div>
          </div>
        </div>
      )}

      {error && <InlineBanner tone="critical" title={error} />}
      {adjustment && <InlineBanner tone="success" title={adjustment} />}
      {!data && !error && (
        <div
          role="status"
          className="jvk-clinic-ops-card px-6 py-10 text-center text-sm font-medium text-[#52685F]"
        >
          Loading clinic stock…
        </div>
      )}
      {data && batches.length === 0 && (
        <div className="jvk-clinic-ops-card jvk-clinic-ops-enter flex flex-col items-center justify-center px-6 py-10 sm:py-12 text-center">
          <img
            src="/assets/clinic/inventory-empty-boxes.svg"
            alt=""
            aria-hidden="true"
            width={360}
            height={220}
            className="jvk-clinic-ops-artwork w-52 sm:w-60 h-auto mb-2"
          />
          <h2 className="jvk-clinic-ops-serif text-[21px] sm:text-[23px] font-bold text-[#103B32]">
            No matching batches
          </h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#52685F]">
            {allBatches.length > 0 && hasFilters
              ? "No inventory batches match your search query or 90-day expiry filter."
              : "Stock received at this clinic appears here."}
          </p>
          {allBatches.length > 0 && hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setExpiryOnly(false);
              }}
              className="jvk-admin-secondary-btn mt-4"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      {!!batches.length && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {batches.map((batch) => (
            <li
              key={batch.id}
              className="jvk-admin-card-elevated jvk-admin-card-interactive space-y-2.5 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="jvk-admin-serif text-lg font-bold text-[#0E2420]">
                    {batch.brand} · {batch.strengthMg} mg
                  </h2>
                  <p className="break-words text-xs sm:text-sm text-[#556C63] mt-0.5">
                    Batch {batch.batchNo} · expires {batch.expiry}
                  </p>
                </div>
                <StatusChip tone={batch.expiry < date ? "warning" : batch.available <= 10 ? "warning" : "success"}>
                  {batch.expiry < date
                    ? "Expired"
                    : `${batch.available} available`}
                </StatusChip>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[#E6EDE7] text-sm">
                <span className="text-[#556C63]">{batch.salt}</span>
                <span className="font-bold text-[#047C61] tabular-nums">
                  Unit price {money(batch.pricePaise)}
                </span>
              </div>
              {canAdjustStock && (
                <Button type="button" variant="outline" onClick={() => setAdjusting(batch)}>
                  Batch adjustments
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManageCatalog && <CatalogEntry />}
      {canAdjustStock && adjusting && (
        <BatchWriteoff
          key={adjusting.id}
          batch={adjusting}
          close={() => setAdjusting(undefined)}
          onSaved={({ id, remaining }) => {
            setAdjusting(undefined);
            setRevision((value) => value + 1);
            setAdjustment(`Stock adjustment ${id} recorded. ${remaining} units remain.`);
          }}
        />
      )}
    </section>
  );
}

function BatchWriteoff({ batch, close, onSaved }: {
  batch: PublicBatch;
  close: () => void;
  onSaved: (result: { id: string; remaining: number }) => void;
}) {
  const path = `${pharmacy}/inventory/batches/${encodeURIComponent(batch.id)}/writeoffs`;
  const { data, error } = useStaffData<{
    entries: { id: string; actorId: string; recordedAt: string; units: number; reason: string }[];
  }>(path);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const attempt = useRef<{ body: string; key: string }>();
  async function writeOff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const body = JSON.stringify({
      units: Number(fields.get("units")), expectedQuantity: batch.quantity, reason: fields.get("reason"),
    });
    if (attempt.current?.body !== body) attempt.current = { body, key: crypto.randomUUID() };
    setPending(true);
    setFailure("");
    try {
      const result = await staffApi<{ id: string; remaining: number }>(path, {
        method: "POST", body, headers: { "Idempotency-Key": attempt.current.key },
      });
      onSaved(result);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Stock adjustment unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Drawer open onClose={close} title="Batch adjustments" description={`${batch.brand} · Batch ${batch.batchNo}`}>
      {failure && <InlineBanner tone="critical" title={failure} />}
      <p className="text-sm">{batch.available} unreserved units can be written off.</p>
      {batch.available > 0 && (
        <form className="my-4 space-y-3" onSubmit={(event) => void writeOff(event)}>
          <label className="block">Units to write off
            <Input name="units" type="number" min={1} max={batch.available} required />
          </label>
          <label className="block">Reason
            <Input name="reason" minLength={3} maxLength={400} required />
          </label>
          <Button type="submit" disabled={pending}>Record stock write-off</Button>
        </form>
      )}
      <h3 className="font-semibold">Recent write-offs</h3>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading adjustment history…</p>}
      {data?.entries.length === 0 && <p>No recorded write-offs.</p>}
      {data?.entries.map((entry) => (
        <p key={entry.id} className="my-1 break-words text-sm">
          {entry.units} units · {entry.reason} · {entry.actorId} · {new Date(entry.recordedAt).toLocaleString("en-IN")}
        </p>
      ))}
    </Drawer>
  );
}

function CatalogEntry() {
  const [result, setResult] = useState({
    pending: false,
    error: "",
    success: "",
  });
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (result.pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setResult({ pending: true, error: "", success: "" });
    try {
      await staffApi(`${pharmacy}/catalog`, {
        method: "POST",
        body: JSON.stringify({
          id: fields.get("id"),
          brand: fields.get("brand"),
          salt: fields.get("salt"),
          strengthMg: Number(fields.get("strength")),
          form: fields.get("form"),
          nti: fields.has("nti"),
          scheduleH: fields.has("scheduleH"),
          gstBps: rupeesToPaise(String(fields.get("gst"))),
        }),
      });
      form.reset();
      setResult({
        pending: false,
        error: "",
        success: "Medicine catalog entry added.",
      });
    } catch (error) {
      setResult({
        pending: false,
        error:
          error instanceof Error
            ? error.message
            : "Catalog entry could not be confirmed.",
        success: "",
      });
    }
  }
  return (
    <details className="jvk-admin-card p-5">
      <summary className="min-h-10 cursor-pointer flex items-center justify-between gap-3">
        <div>
          <span className="jvk-admin-serif text-base font-bold text-[#0E2420] block">
            Add approved medicine to the hospital catalog
          </span>
          <span className="text-xs text-[#556C63]">
            Link medicines from the master catalog to make them available for this clinic.
          </span>
        </div>
      </summary>
      <div className="mt-4 space-y-4">
        {result.error && <InlineBanner tone="critical" title={result.error} />}
        {result.success && <InlineBanner tone="success" title={result.success} />}
        <form
          className="grid gap-3.5 sm:grid-cols-2"
          onSubmit={(event) => void save(event)}
        >
          <label htmlFor="catalog-id" className="text-sm font-medium text-[#2A423A]">
            Catalog identifier
            <Input id="catalog-id" name="id" required maxLength={100} className="mt-1 bg-white" />
          </label>
          <label htmlFor="catalog-brand" className="text-sm font-medium text-[#2A423A]">
            Brand
            <Input id="catalog-brand" name="brand" required maxLength={120} className="mt-1 bg-white" />
          </label>
          <label htmlFor="catalog-salt" className="text-sm font-medium text-[#2A423A]">
            Salt
            <Input id="catalog-salt" name="salt" required maxLength={120} className="mt-1 bg-white" />
          </label>
          <label htmlFor="catalog-strength" className="text-sm font-medium text-[#2A423A]">
            Strength (mg)
            <Input
              id="catalog-strength"
              name="strength"
              type="number"
              min={1}
              max={100000}
              required
              className="mt-1 bg-white"
            />
          </label>
          <label className="text-sm font-medium text-[#2A423A]">
            Form
            <select name="form" className={`${selectStyle} mt-1`} required defaultValue="">
              <option value="" disabled hidden>Choose a form</option>
              <option value="tablet">Tablet</option>
              <option value="capsule">Capsule</option>
            </select>
          </label>
          <label htmlFor="catalog-gst" className="text-sm font-medium text-[#2A423A]">
            GST rate (%)
            <Input
              id="catalog-gst"
              name="gst"
              type="number"
              min={0}
              max={100}
              step="0.01"
              required
              className="mt-1 bg-white"
            />
          </label>
          <label className="jvk-clinic-ops-check-label">
            <input name="nti" type="checkbox" className="jvk-clinic-ops-checkbox" />
            <span>Narrow therapeutic index</span>
          </label>
          <label className="jvk-clinic-ops-check-label">
            <input name="scheduleH" type="checkbox" className="jvk-clinic-ops-checkbox" />
            <span>Schedule H</span>
          </label>
          <div className="sm:col-span-2 pt-1">
            <button type="submit" disabled={result.pending} className="jvk-admin-primary-btn">
              {result.pending ? "Saving…" : "Add catalog entry"}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}

type Ledger = {
  accounts: Array<{ account: string; debitPaise: number; creditPaise: number }>;
  entries: Array<{
    id: string;
    referenceId: string;
    referenceType: string;
    date: string;
    debitPaise: number;
    creditPaise: number;
  }>;
  lockDate: string | null;
};
export function PostedFinance({ canManage }: { canManage: boolean }) {
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [locking, setLocking] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const { data, error } = useStaffData<Ledger>("/clinical/ledger", revision);
  async function lock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locking) return;
    const lockDate = new FormData(event.currentTarget).get("lockDate");
    setFailure("");
    setNotice("");
    setLocking(true);
    try {
      await staffApi("/clinical/ledger/lock", {
        method: "POST",
        body: JSON.stringify({ lockDate }),
      });
      setNotice("Accounting period locked.");
      setRevision((value) => value + 1);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "Period lock could not be confirmed.",
      );
    } finally {
      setLocking(false);
    }
  }
  const balance = (account: string) =>
    data?.accounts.find((row) => row.account === account);
  const debits = (account: string) =>
    (balance(account)?.debitPaise ?? 0) - (balance(account)?.creditPaise ?? 0);
  const profit = -debits("revenue") - debits("cogs");
  const totalDebitPaise = (data?.entries ?? []).reduce((sum, e) => sum + e.debitPaise, 0);
  const totalCreditPaise = (data?.entries ?? []).reduce((sum, e) => sum + e.creditPaise, 0);
  const balanceGapPaise = totalDebitPaise - totalCreditPaise;
  const referenceTypes = Array.from(new Set((data?.entries ?? []).map((e) => e.referenceType))).sort();
  const visibleEntries = (data?.entries ?? []).filter(
    (entry) => typeFilter === "ALL" || entry.referenceType === typeFilter,
  );

  return (
    <section className="jvk-admin-page mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="jvk-admin-card-hero flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-5 overflow-hidden">
        <div className="space-y-1.5 max-w-2xl z-10">
          <h1 className="jvk-admin-serif text-3xl font-bold text-[#0E2420]">
            Posted financial records
          </h1>
          <p className="text-sm text-[#556C63]">
            {data
              ? data.lockDate
                ? `Periods locked through ${data.lockDate}`
                : "No accounting period is locked."
              : "Loading period lock and journal status…"}
          </p>
        </div>
        <div className="hidden md:flex shrink-0 items-center justify-end">
          <img
            src="/assets/admin/finance-hero.png"
            alt=""
            aria-hidden="true"
            width={220}
            height={138}
            className="jvk-admin-artwork w-48 lg:w-56 h-auto"
          />
        </div>
      </header>

      {notice && <InlineBanner tone="success" title={notice} />}
      {(error || failure) && (
        <InlineBanner tone="critical" title={failure || error || ""} />
      )}
      {!data && !error && (
        <p role="status" className="text-sm text-[#556C63] px-1">
          Loading posted journals…
        </p>
      )}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="jvk-admin-card p-5 flex items-start gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] text-[#047C61]">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-medium text-[#556C63]">Journals Posted</p>
                <p className="mt-1 text-2xl font-bold text-[#0E2420] tabular-nums">
                  {data.entries.length}
                </p>
                <p className="mt-1 text-xs text-[#6A8178]">Total across all periods</p>
              </div>
            </div>

            <div className="jvk-admin-card p-5 flex items-start gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] text-[#047C61]">
                <Lock className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-medium text-[#556C63]">Locked Periods</p>
                <p className="mt-1 text-2xl font-bold text-[#0E2420] tabular-nums">
                  {data.lockDate ? 1 : 0}
                </p>
                <p className="mt-1 text-xs text-[#6A8178]">
                  {data.lockDate ? `Through ${data.lockDate}` : "No periods are locked"}
                </p>
              </div>
            </div>

            <div className="jvk-admin-card p-5 flex items-start gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] text-[#047C61]">
                <Scale className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-medium text-[#556C63]">Debit-Credit Balance</p>
                <p className="mt-1 text-2xl font-bold text-[#0E2420] tabular-nums">
                  {money(balanceGapPaise)}
                </p>
                <p className="mt-1 text-xs text-[#047C61] font-medium">
                  {balanceGapPaise === 0 ? "In balance" : "Out of balance"}
                </p>
              </div>
            </div>

            <div className="jvk-admin-card p-5 flex items-start gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] text-[#047C61]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-medium text-[#556C63]">Audit Status</p>
                <div className="mt-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#DFF4ED] border border-[#C3E5D6] px-2.5 py-0.5 text-xs font-semibold text-[#065F46]">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{balanceGapPaise === 0 ? "Reconciled" : "Review required"}</span>
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[#6A8178]">
                  {canManage ? "Period lock permissions enabled" : "All posted journals reconciled"}
                </p>
              </div>
            </div>
          </div>

          {data.entries.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="jvk-admin-card-sage px-4 py-3.5">
                <p className="text-xs font-medium text-[#556C63]">Sales revenue</p>
                <p className="text-lg font-bold text-[#0E2420] tabular-nums mt-0.5">
                  {money(-debits("revenue"))}
                </p>
              </div>
              <div className="jvk-admin-card-sage px-4 py-3.5">
                <p className="text-xs font-medium text-[#556C63]">Cost of sales</p>
                <p className="text-lg font-bold text-[#0E2420] tabular-nums mt-0.5">
                  {money(debits("cogs"))}
                </p>
              </div>
              <div className="jvk-admin-card-sage px-4 py-3.5">
                <p className="text-xs font-medium text-[#556C63]">Gross profit</p>
                <p className="text-lg font-bold text-[#047C61] tabular-nums mt-0.5">
                  {money(profit)}
                </p>
              </div>
              <div className="jvk-admin-card-sage px-4 py-3.5">
                <p className="text-xs font-medium text-[#556C63]">GST payable</p>
                <p className="text-lg font-bold text-[#0E2420] tabular-nums mt-0.5">
                  {money(-debits("gst_payable"))}
                </p>
              </div>
            </div>
          )}

          <div className="jvk-admin-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] text-[#047C61]">
                  <FileCheck2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="posted-journals-heading" className="jvk-admin-serif text-xl font-bold text-[#0E2420]">
                    Posted Journals
                  </h2>
                  <p className="text-xs sm:text-sm text-[#556C63]">
                    Completed transactions appear after their journal entries post.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {referenceTypes.length > 0 && (
                  <label className="text-xs font-medium text-[#3C544C]">
                    <span className="sr-only">Journal Type</span>
                    <select
                      aria-label="Journal Type"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="h-9 rounded-lg border border-[#CEDAD3] bg-white px-3 text-xs font-semibold text-[#0E2420]"
                    >
                      <option value="ALL">All Types</option>
                      {referenceTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                )}
                {!canManage && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DFF4ED] border border-[#BBE2D1] px-3 py-1 text-xs font-semibold text-[#065F46]">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Read-only (Accounting)</span>
                  </span>
                )}
              </div>
            </div>

            {data.entries.length === 0 ? (
              <div className="rounded-xl border border-[#E5ECE6] bg-[#FAFBF8] px-6 py-10 text-center">
                <img
                  src="/assets/admin/finance-hero.png"
                  alt=""
                  aria-hidden="true"
                  width={136}
                  height={92}
                  className="jvk-admin-artwork w-36 h-auto mx-auto mb-3 opacity-85"
                />
                <h3 className="jvk-admin-serif text-base font-bold text-[#0E2420]">No posted journals</h3>
                <p className="mt-1 max-w-md mx-auto text-sm text-[#556C63]">
                  Completed transactions appear after their journal entries post.
                </p>
              </div>
            ) : (
              <div className="jvk-admin-table-region" tabIndex={0} role="region" aria-labelledby="posted-journals-heading">
                <table className="jvk-admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Journal Type</th>
                      <th>Reference</th>
                      <th>Debit (₹)</th>
                      <th>Credit (₹)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="whitespace-nowrap font-medium text-[#3C544C]">{entry.date}</td>
                        <td>
                          <span className="inline-flex items-center rounded-md bg-[#DFF4ED] px-2.5 py-0.5 text-xs font-semibold text-[#065F46]">
                            {entry.referenceType}
                          </span>
                        </td>
                        <td className="break-all font-mono text-xs text-[#3C544C]">{entry.referenceId}</td>
                        <td className="font-semibold text-[#0E2420] tabular-nums whitespace-nowrap">{money(entry.debitPaise)}</td>
                        <td className="font-semibold text-[#0E2420] tabular-nums whitespace-nowrap">{money(entry.creditPaise)}</td>
                        <td>
                          <StatusChip tone="success">Posted</StatusChip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {canManage && (
            <form
              onSubmit={(event) => void lock(event)}
              className="jvk-admin-card space-y-4 p-5 sm:p-6"
            >
              <div>
                <h2 className="jvk-admin-serif text-lg font-bold text-[#0E2420]">
                  Lock accounting period
                </h2>
                <p className="text-xs text-[#556C63] mt-0.5">
                  Locking prevents retroactive journal modifications prior to the selected cut-off date.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1 max-w-xs">
                  <label htmlFor="financial-lock-date" className="block text-sm font-medium text-[#2A423A]">
                    Lock through date
                  </label>
                  <Input
                    id="financial-lock-date"
                    name="lockDate"
                    type="date"
                    required
                    className="mt-1 bg-white"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-[#2A423A] pb-2">
                  <input type="checkbox" required className="h-4 w-4 rounded" />
                  <span>Confirm closing this period.</span>
                </label>
                <Button type="submit" variant="destructive" disabled={locking}>
                  Lock period
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
