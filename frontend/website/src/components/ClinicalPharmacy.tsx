import { useRef, useState, type FormEvent } from "react";
import type {
  Inventory,
  StockPlan,
} from "../../../../packages/shared/operations";
import { Button, Card, CardContent, Input } from "@/components/ui/basic";
import {
  Drawer,
  EmptyState,
  InlineBanner,
  StatusChip,
} from "@/components/ui/design-primitives";
import { staffApi, useStaffData } from "@/lib/staffApi";
import { paiseToRupeesString, rupeesToPaise } from "@/lib/utils";

const pharmacy = "/clinical/pharmacy";
const money = (paise: number) => `₹${paiseToRupeesString(paise)}`;
const selectStyle = "min-h-11 w-full rounded-md border bg-background p-2";

export function SignPrescription({
  encounterId,
  close,
  onSigned,
}: {
  encounterId: string;
  close: () => void;
  onSigned: () => void;
}) {
  const { data, error } = useStaffData<{
    items: Array<{
      id: string;
      brand: string;
      strengthMg: number;
      form: string;
    }>;
  }>(`${pharmacy}/catalog`);
  const [rows, setRows] = useState([0]);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const lines = rows.map((index) => ({
      skuId: fields.get(`sku-${index}`),
      units: Number(fields.get(`units-${index}`)),
      courseEnd: fields.get(`course-${index}`),
      directions: fields.get(`directions-${index}`),
      allowEquivalent: false,
    }));
    setPending(true);
    setFailure("");
    try {
      await staffApi(`${pharmacy}/prescriptions`, {
        method: "POST",
        body: JSON.stringify({
          encounterId,
          note: fields.get("note"),
          allergiesReviewed: fields.has("reviewed"),
          pharmacyConsentConfirmed: fields.has("consent"),
          allergies: String(fields.get("allergies") ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          lines,
        }),
      });
      onSigned();
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "Prescription could not be signed.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Drawer
      open
      onClose={close}
      title="Sign prescription for pharmacy"
      description="Use the clinic catalog and confirm patient authorization."
    >
      {(error || failure) && (
        <InlineBanner tone="critical" title={failure || error || ""} />
      )}
      {!data && !error && <p role="status">Loading catalog…</p>}
      {data?.items.length === 0 && (
        <EmptyState
          title="No catalog items"
          description="A clinic medicine catalog is needed before signing."
        />
      )}
      {data && data.items.length > 0 && (
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div>
            <label htmlFor="rx-note">Prescription note</label>
            <Input
              id="rx-note"
              name="note"
              minLength={3}
              maxLength={4000}
              required
            />
          </div>
          <label className="block">
            Known allergies, one per line
            <textarea
              name="allergies"
              className="block w-full rounded-md border p-2"
              rows={2}
            />
          </label>
          {rows.map((index) => (
            <fieldset key={index} className="space-y-3 rounded-md border p-3">
              <legend>Medicine {index + 1}</legend>
              <label className="block">
                Catalog item
                <select
                  name={`sku-${index}`}
                  className={selectStyle}
                  required
                  defaultValue=""
                >
                  <option value="">Choose medicine</option>
                  {data.items.map(({ id, brand, strengthMg, form }) => (
                    <option key={id} value={id}>
                      {brand} · {strengthMg} mg {form}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <label htmlFor={`rx-units-${index}`}>Units</label>
                <Input
                  id={`rx-units-${index}`}
                  name={`units-${index}`}
                  type="number"
                  min={1}
                  max={1000}
                  required
                />
              </div>
              <div>
                <label htmlFor={`rx-end-${index}`}>Course end</label>
                <Input
                  id={`rx-end-${index}`}
                  name={`course-${index}`}
                  type="date"
                  required
                />
              </div>
              <div>
                <label htmlFor={`rx-directions-${index}`}>Directions</label>
                <Input
                  id={`rx-directions-${index}`}
                  name={`directions-${index}`}
                  required
                  minLength={3}
                  maxLength={1000}
                />
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={rows.length >= 8}
              onClick={() => setRows([...rows, rows.length])}
            >
              Add medicine
            </Button>
            {rows.length > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setRows(rows.slice(0, -1))}
              >
                Remove last medicine
              </Button>
            )}
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="reviewed" required />I reviewed the
            patient’s allergies.
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="consent" required />
            The patient authorized pharmacy sharing.
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "Signing…" : "Sign and send to pharmacy"}
          </Button>
        </form>
      )}
    </Drawer>
  );
}

type Sale = { id: string; totalPaise: number; createdAt: string };
export function PharmacyInflow() {
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState("");
  const [receipt, setReceipt] = useState<Sale>();
  const { data, error } = useStaffData<{
    prescriptions: Array<{ id: string; patientName: string }>;
  }>(`${pharmacy}/inflow`, revision);
  return (
    <section className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap justify-between gap-3">
        <h1 className="text-2xl font-semibold">Pharmacy POS</h1>
        <Button
          variant="outline"
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh inflow
        </Button>
      </header>
      {error && <InlineBanner tone="critical" title={error} />}
      {!data && !error && <p role="status">Loading prescriptions…</p>}
      {receipt && (
        <Card className="print:border-none">
          <CardContent className="space-y-2 p-4">
            <h2 className="font-semibold">Cash sale recorded</h2>
            <p>Total {money(receipt.totalPaise)}</p>
            <p className="break-all">Receipt {receipt.id}</p>
            <time dateTime={receipt.createdAt}>
              {new Date(receipt.createdAt).toLocaleString("en-IN")}
            </time>
            <div className="print:hidden">
              <Button variant="outline" onClick={() => window.print()}>
                Print receipt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {data?.prescriptions.length === 0 && (
        <EmptyState
          title="No prescriptions awaiting dispensing"
          description="Signed prescriptions shared with this clinic’s pharmacy will appear here."
        />
      )}
      {!!data?.prescriptions.length && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.prescriptions.map(({ id, patientName }) => (
            <li key={id}>
              <Button
                className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                variant={selected === id ? "default" : "outline"}
                aria-pressed={selected === id}
                onClick={() => setSelected(id)}
              >
                {patientName} · {id.slice(0, 8)}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <Checkout
          key={selected}
          id={selected}
          onSale={(sale) => {
            setReceipt(sale);
            setSelected("");
            setRevision((value) => value + 1);
          }}
        />
      )}
    </section>
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
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="font-semibold">Batch allocation and checkout</h2>
        {!data && !error && <p role="status">Checking stock and price…</p>}
        {(error || failure) && (
          <InlineBanner tone="critical" title={failure || error || ""} />
        )}
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh quote
        </Button>
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
          <form className="space-y-3" onSubmit={(event) => void submit(event)}>
            <ul className="divide-y">
              {data.allocation.map((item) => (
                <li
                  className="flex flex-wrap justify-between gap-2 py-2"
                  key={`${item.lineId}-${item.batchId}`}
                >
                  <span>
                    {item.brand} · {item.units} units · expires {item.expiry}
                  </span>
                  <span>{money(item.unitPricePaise)} per unit</span>
                </li>
              ))}
            </ul>
            <p className="text-lg font-semibold">
              Total {money(data.totalPaise)}
            </p>
            <label className="block">
              Tax treatment
              <select
                className={selectStyle}
                name="taxMode"
                required
                defaultValue=""
              >
                <option value="">Select</option>
                <option value="intra">Intra-state</option>
                <option value="inter">Inter-state</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="cash" required />
              Cash received and amount confirmed.
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? "Posting checkout…" : "Record cash sale and dispense"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function ClinicStock({
  canManageCatalog,
}: {
  canManageCatalog: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [expiryOnly, setExpiryOnly] = useState(false);
  const { data, error } = useStaffData<{
    batches: Array<Omit<Inventory["batches"][number], "costPaise">>;
  }>(`${pharmacy}/inventory`, revision);
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
  return (
    <section className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap justify-between gap-3">
        <h1 className="text-2xl font-semibold">Clinic inventory</h1>
        <Button
          variant="outline"
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh stock
        </Button>
      </header>
      <div>
        <label htmlFor="clinic-stock-search">Search medicine or batch</label>
        <Input
          id="clinic-stock-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={expiryOnly}
          onChange={(event) => setExpiryOnly(event.target.checked)}
        />
        Expires within 90 days or already expired
      </label>
      {error && <InlineBanner tone="critical" title={error} />}
      {!data && !error && <p role="status">Loading clinic stock…</p>}
      {data && batches.length === 0 && (
        <EmptyState
          title="No matching batches"
          description="Stock received at this clinic appears here."
        />
      )}
      {canManageCatalog && <CatalogEntry />}
      {!!batches.length && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {batches.map((batch) => (
            <li
              key={batch.id}
              className="space-y-2 rounded-lg border bg-card p-4"
            >
              <h2 className="font-semibold">
                {batch.brand} · {batch.strengthMg} mg
              </h2>
              <p className="break-words">
                Batch {batch.batchNo} · expires {batch.expiry}
              </p>
              <StatusChip tone={batch.expiry < date ? "warning" : "neutral"}>
                {batch.expiry < date
                  ? "Expired"
                  : `${batch.available} available`}
              </StatusChip>
              <p>Unit price {money(batch.pricePaise)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
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
    <details className="rounded-lg border bg-card p-4">
      <summary className="min-h-10 cursor-pointer font-semibold">
        Add approved medicine to the hospital catalog
      </summary>
      {result.error && <InlineBanner tone="critical" title={result.error} />}
      {result.success && <InlineBanner tone="success" title={result.success} />}
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => void save(event)}
      >
        <label htmlFor="catalog-id">
          Catalog identifier
          <Input id="catalog-id" name="id" required maxLength={100} />
        </label>
        <label htmlFor="catalog-brand">
          Brand
          <Input id="catalog-brand" name="brand" required maxLength={120} />
        </label>
        <label htmlFor="catalog-salt">
          Salt
          <Input id="catalog-salt" name="salt" required maxLength={120} />
        </label>
        <label htmlFor="catalog-strength">
          Strength (mg)
          <Input
            id="catalog-strength"
            name="strength"
            type="number"
            min={1}
            max={100000}
            required
          />
        </label>
        <label>
          Form
          <select name="form" className={selectStyle} required defaultValue="">
            <option value="">Choose a form</option>
            <option value="tablet">Tablet</option>
            <option value="capsule">Capsule</option>
          </select>
        </label>
        <label htmlFor="catalog-gst">
          GST rate (%)
          <Input
            id="catalog-gst"
            name="gst"
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
          />
        </label>
        <label className="flex items-center gap-2">
          <input name="nti" type="checkbox" />
          Narrow therapeutic index
        </label>
        <label className="flex items-center gap-2">
          <input name="scheduleH" type="checkbox" />
          Schedule H
        </label>
        <Button type="submit" disabled={result.pending}>
          {result.pending ? "Saving…" : "Add catalog entry"}
        </Button>
      </form>
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
  return (
    <section className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Posted financial records</h1>
      {notice && <InlineBanner tone="success" title={notice} />}
      {(error || failure) && (
        <InlineBanner tone="critical" title={failure || error || ""} />
      )}
      {!data && !error && <p role="status">Loading posted journals…</p>}
      {data && (
        <>
          <p>
            {data.lockDate
              ? `Periods locked through ${data.lockDate}`
              : "No accounting period is locked."}
          </p>
          {data.entries.length === 0 ? (
            <EmptyState
              title="No posted journals"
              description="Completed transactions appear after their journal entries post."
            />
          ) : (
            <>
              <Card>
                <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                  <p>Sales revenue {money(-debits("revenue"))}</p>
                  <p>Cost of sales {money(debits("cogs"))}</p>
                  <p>Gross profit {money(profit)}</p>
                  <p>GST payable {money(-debits("gst_payable"))}</p>
                </CardContent>
              </Card>
              <ul className="divide-y rounded-md border bg-card">
                {data.entries.map((entry) => (
                  <li className="p-4" key={entry.id}>
                    <p className="font-semibold">
                      {entry.referenceType} · {entry.date}
                    </p>
                    <p className="break-all text-sm">{entry.referenceId}</p>
                    <p>
                      Debit {money(entry.debitPaise)} · Credit{" "}
                      {money(entry.creditPaise)}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {canManage && (
            <form
              onSubmit={(event) => void lock(event)}
              className="space-y-3 rounded-md border p-4"
            >
              <h2 className="font-semibold">Lock accounting period</h2>
              <div>
                <label htmlFor="financial-lock-date">Lock through date</label>
                <Input
                  id="financial-lock-date"
                  name="lockDate"
                  type="date"
                  required
                />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" required />
                Confirm closing this period.
              </label>
              <Button type="submit" variant="destructive" disabled={locking}>
                Lock period
              </Button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
