import { useRef, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FilePlus2,
  PackageCheck,
  Plus,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { Button, Card, CardContent, Input } from "@/components/ui/basic";
import {
  EmptyState,
  InlineBanner,
  StatusChip,
} from "@/components/ui/design-primitives";
import { staffApi, useStaffData } from "@/lib/staffApi";
import { rupeesToPaise } from "@/lib/utils";

const procurement = "/clinical/procurement";
const selectStyle =
  "min-h-11 w-full rounded-lg border border-[#CEDAD3] bg-white pl-3.5 pr-4 py-2 text-sm font-medium text-[#0E2420]";
type Line = {
  orderId: string;
  lineId: string;
  brand: string;
  outstanding: number;
};
type Order = Line & {
  status: string;
  supplierReference: string;
  units: number;
};

function useProcurementAction() {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({
    pending: false,
    error: "",
    success: "",
  });
  const running = useRef(false);
  const request = useRef<{ body: string; key: string }>();
  async function post(
    path: string,
    payload: unknown,
    success: string,
    form?: HTMLFormElement,
  ) {
    if (running.current) return;
    running.current = true;
    const body = JSON.stringify(payload);
    const requestBody = body ?? "";
    if (request.current?.body !== requestBody)
      request.current = { body: requestBody, key: crypto.randomUUID() };
    setResult({ pending: true, error: "", success: "" });
    try {
      await staffApi(`${procurement}${path}`, {
        method: "POST",
        body,
        headers: { "Idempotency-Key": request.current.key },
      });
      request.current = undefined;
      form?.reset();
      setResult({ pending: false, error: "", success });
      setRevision((value) => value + 1);
    } catch (error) {
      setResult({
        pending: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm this operation.",
        success: "",
      });
    } finally {
      running.current = false;
    }
  }
  return { revision, result, post };
}

export function PurchaseOrders({
  canWrite,
  goToReceipts,
}: {
  canWrite: boolean;
  goToReceipts: () => void;
}) {
  const { revision, result, post } = useProcurementAction();
  const { data, error } = useStaffData<{
    orders: Order[];
    catalog: Array<{ id: string; brand: string }>;
  }>(`${procurement}/orders`, revision);
  const [rows, setRows] = useState([0]);
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void post(
      "/orders",
      {
        supplierReference: fields.get("supplier"),
        lines: rows.map((line) => ({
          skuId: fields.get(`sku-${line}`),
          units: Number(fields.get(`units-${line}`)),
          costPaise: rupeesToPaise(String(fields.get(`cost-${line}`))),
          pricePaise: rupeesToPaise(String(fields.get(`price-${line}`))),
        })),
      },
      "Purchase order created.",
      event.currentTarget,
    );
  }
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const createSectionRef = useRef<HTMLDivElement>(null);

  const orders = new Map<string, Order[]>();
  for (const line of data?.orders ?? []) {
    const lines = orders.get(line.orderId);
    if (lines) lines.push(line);
    else orders.set(line.orderId, [line]);
  }
  const orderEntries = Array.from(orders.entries());
  const draftCount = orderEntries.filter(([, ls]) => ls[0]?.status === "draft").length;
  const openCount = orderEntries.filter(
    ([, ls]) => ls[0]?.status !== "draft" && ls.some((l) => l.outstanding > 0),
  ).length;
  const receivedCount = orderEntries.filter(
    ([, ls]) => ls.length > 0 && ls.every((l) => l.outstanding === 0),
  ).length;
  const uniqueStatuses = Array.from(
    new Set(orderEntries.map(([, ls]) => ls[0]?.status).filter(Boolean)),
  );
  const filteredEntries = orderEntries.filter(([id, lines]) => {
    const first = lines[0];
    if (statusFilter !== "ALL" && first?.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      id.toLowerCase().includes(q) ||
      (first?.supplierReference ?? "").toLowerCase().includes(q) ||
      lines.some((line) => line.brand.toLowerCase().includes(q))
    );
  });

  return (
    <section className="jvk-admin-page mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="jvk-admin-card-hero flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-5 overflow-hidden">
        <div className="space-y-3 max-w-2xl z-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#047C61]">
              Headquarters Command Center
            </p>
            <h1 className="jvk-admin-serif text-3xl font-bold text-[#0E2420] mt-1">
              Purchase orders
            </h1>
            <p className="text-sm text-[#556C63] mt-1">
              Create, track, and manage purchase orders for clinic medicines and supplies.
            </p>
          </div>
          <nav aria-label="Procurement sections" className="jvk-admin-tablist jvk-admin-tablist-light">
            <span
              role="tab"
              aria-selected="true"
              className="jvk-admin-tab !bg-[#047C61] !text-white"
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              <span>Purchase orders</span>
            </span>
            {canWrite && (
              <button
                type="button"
                role="tab"
                aria-selected="false"
                onClick={goToReceipts}
                className="jvk-admin-tab"
              >
                <PackageCheck className="h-4 w-4" aria-hidden="true" />
                <span>Goods receipt</span>
              </button>
            )}
          </nav>
        </div>
        <div className="hidden md:flex shrink-0 items-center justify-end">
          <img
            src="/assets/admin/procurement-hero.png"
            alt=""
            aria-hidden="true"
            width={220}
            height={138}
            className="jvk-admin-artwork w-48 lg:w-56 h-auto"
          />
        </div>
      </header>

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="jvk-admin-card p-4 flex items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] text-[#047C61]">
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-[#556C63]">Total POs</p>
              <p className="text-xl font-bold text-[#0E2420] tabular-nums">{orderEntries.length}</p>
            </div>
          </div>
          <div className="jvk-admin-card p-4 flex items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FEF3DC] border border-[#F1DDA8] text-[#B45309]">
              <Clock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-[#556C63]">Draft</p>
              <p className="text-xl font-bold text-[#B45309] tabular-nums">{draftCount}</p>
            </div>
          </div>
          <div className="jvk-admin-card p-4 flex items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E8F4F8] border border-[#C7E0EC] text-[#0E7490]">
              <Truck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-[#556C63]">Open / Pending GRN</p>
              <p className="text-xl font-bold text-[#0E7490] tabular-nums">{openCount}</p>
            </div>
          </div>
          <div className="jvk-admin-card p-4 flex items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E4F4EA] border border-[#C1E4CC] text-[#059669]">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-[#556C63]">Fully received</p>
              <p className="text-xl font-bold text-[#059669] tabular-nums">{receivedCount}</p>
            </div>
          </div>
        </div>
      )}

      {(error || result.error) && (
        <InlineBanner tone="critical" title={result.error || error || ""} />
      )}
      {result.success && <InlineBanner tone="success" title={result.success} />}
      {!data && !error && (
        <p role="status" className="text-sm text-[#556C63] px-1">
          Loading purchase orders…
        </p>
      )}

      <div className="jvk-admin-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#DFF4ED] text-[#047C61]">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 id="purchase-orders-list-heading" className="jvk-admin-serif text-xl font-bold text-[#0E2420]">
              Purchase orders
            </h2>
          </div>
          {canWrite && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goToReceipts}
                className="jvk-admin-secondary-btn !min-h-9"
              >
                <PackageCheck className="h-4 w-4" aria-hidden="true" />
                <span>Goods receipt</span>
              </button>
              <button
                type="button"
                onClick={() => createSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="jvk-admin-primary-btn !min-h-9"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Create purchase order</span>
              </button>
            </div>
          )}
        </div>

        {orderEntries.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B847B]" aria-hidden="true" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PO number, supplier, or item..."
                aria-label="Search purchase orders"
                className="pl-9 bg-white border-[#CEDAD3]"
              />
            </div>
            {uniqueStatuses.length > 0 && (
              <select
                aria-label="Filter order status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-lg border border-[#CEDAD3] bg-white px-3 text-xs font-semibold text-[#0E2420]"
              >
                <option value="ALL">All Statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {data && !orders.size && (
          <div className="rounded-xl border border-[#E5ECE6] bg-[#FAFBF8] px-6 py-10 text-center">
            <img
              src="/assets/admin/procurement-hero.png"
              alt=""
              aria-hidden="true"
              width={136}
              height={92}
              className="jvk-admin-artwork w-36 h-auto mx-auto mb-3 opacity-85"
            />
            <h3 className="jvk-admin-serif text-base font-bold text-[#0E2420]">No purchase orders</h3>
            <p className="mt-1 max-w-md mx-auto text-sm text-[#556C63]">
              Orders for this authorized clinic appear here.
            </p>
          </div>
        )}

        {filteredEntries.length > 0 && (
          <div className="space-y-3">
            {filteredEntries.map(([id, lines]) => (
              <div
                key={id}
                className="rounded-xl border border-[#E2ECE5] bg-[#FFFDF9] p-4 space-y-3 hover:border-[#A4CEBC] transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="jvk-admin-serif text-base font-bold text-[#0E2420] break-words">
                      {lines[0].supplierReference} · <span className="font-mono text-xs text-[#047C61]">{id.slice(0, 8)}</span>
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={lines[0].status === "draft" ? "warning" : "success"}>
                      {lines[0].status}
                    </StatusChip>
                    {canWrite && lines[0].status === "draft" && (
                      <button
                        type="button"
                        disabled={result.pending}
                        onClick={() =>
                          void post(
                            `/orders/${id}/issue`,
                            undefined,
                            "Order issued for receiving.",
                          )
                        }
                        className="jvk-admin-secondary-btn !min-h-8 !px-3 text-xs"
                      >
                        Issue order
                      </button>
                    )}
                  </div>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {lines.map((line) => (
                    <li
                      key={line.lineId}
                      className="rounded-lg bg-[#F5FAF7] border border-[#E2EDE6] px-3 py-2 text-xs sm:text-sm text-[#2A423A]"
                    >
                      <span className="font-semibold text-[#0E2420]">{line.brand}</span> · {line.outstanding} of {line.units} units outstanding
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {canWrite && data && (
        <div ref={createSectionRef} className="jvk-admin-card p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] text-[#047C61]">
              <FilePlus2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="jvk-admin-serif text-xl font-bold text-[#0E2420]">Create purchase order</h2>
              <p className="text-xs sm:text-sm text-[#556C63]">
                Add approved items from the clinic medicine catalog before placing an order.
              </p>
            </div>
          </div>

          {data.catalog.length === 0 ? (
            <div className="jvk-admin-card-amber px-4 py-3 text-sm font-medium text-[#78350F]">
              Add approved items to the clinic medicine catalog before ordering.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={create}>
              <label className="block text-sm font-medium text-[#2A423A]" htmlFor="purchase-supplier">
                Supplier reference
                <Input
                  id="purchase-supplier"
                  name="supplier"
                  required
                  maxLength={150}
                  className="mt-1 bg-white border-[#CEDAD3]"
                />
              </label>
              {rows.map((line) => (
                <fieldset
                  key={line}
                  className="grid gap-3 rounded-xl border border-[#DCE7DF] bg-[#FAFBF8] p-4 sm:grid-cols-2"
                >
                  <legend className="px-2 text-xs font-bold text-[#047C61]">Order line {line + 1}</legend>
                  <label className="text-sm font-medium text-[#2A423A]">
                    Catalog item
                    <select
                      name={`sku-${line}`}
                      className={`${selectStyle} mt-1`}
                      required
                      defaultValue=""
                    >
                      <option value="" disabled hidden>Select item</option>
                      {data.catalog.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.brand}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor={`purchase-units-${line}`} className="text-sm font-medium text-[#2A423A]">
                    Units
                    <Input
                      id={`purchase-units-${line}`}
                      name={`units-${line}`}
                      type="number"
                      min={1}
                      max={100000}
                      required
                      className="mt-1 bg-white border-[#CEDAD3]"
                    />
                  </label>
                  <label htmlFor={`purchase-cost-${line}`} className="text-sm font-medium text-[#2A423A]">
                    Unit cost (₹)
                    <Input
                      id={`purchase-cost-${line}`}
                      name={`cost-${line}`}
                      type="number"
                      min="0.01"
                      max="1000000"
                      step="0.01"
                      required
                      className="mt-1 bg-white border-[#CEDAD3]"
                    />
                  </label>
                  <label htmlFor={`purchase-price-${line}`} className="text-sm font-medium text-[#2A423A]">
                    Unit selling price (₹)
                    <Input
                      id={`purchase-price-${line}`}
                      name={`price-${line}`}
                      type="number"
                      min="0.01"
                      max="1000000"
                      step="0.01"
                      required
                      className="mt-1 bg-white border-[#CEDAD3]"
                    />
                  </label>
                </fieldset>
              ))}
              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={rows.length >= 20}
                  onClick={() => setRows([...rows, rows.length])}
                  className="jvk-admin-secondary-btn"
                >
                  Add line
                </button>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows(rows.slice(0, -1))}
                    className="jvk-admin-secondary-btn"
                  >
                    Remove last line
                  </button>
                )}
                <button type="submit" disabled={result.pending} className="jvk-admin-primary-btn">
                  {result.pending ? "Saving…" : "Create draft"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

export function GoodsReceipt({ canWrite }: { canWrite: boolean }) {
  const { revision, result, post } = useProcurementAction();
  const { data, error } = useStaffData<{ lines: Line[] }>(
    `${procurement}/grn`,
    revision,
  );
  const [lineId, setLineId] = useState("");
  const line = data?.lines.find((item) => item.lineId === lineId);
  function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!line) return;
    const fields = new FormData(event.currentTarget);
    void post(
      "/grn",
      {
        orderId: line.orderId,
        lineId: line.lineId,
        batchNo: fields.get("batch"),
        expiry: fields.get("expiry"),
        received: Number(fields.get("received")),
        damaged: Number(fields.get("damaged")),
        invoice: fields.get("invoice"),
      },
      "Goods receipt recorded and accepted units posted to inventory.",
      event.currentTarget,
    );
  }
  return (
    <section className="jvk-admin-page mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="jvk-admin-card-hero flex items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#047C61]">Procurement</p>
          <h1 className="jvk-admin-serif text-3xl font-bold text-[#0E2420] mt-1">Goods receipt</h1>
          <p className="text-sm text-[#556C63] mt-0.5">Verify received supplier batches and post accepted units into clinic stock.</p>
        </div>
        <div className="hidden sm:flex shrink-0">
          <img
            src="/assets/admin/procurement-hero.png"
            alt=""
            aria-hidden="true"
            width={160}
            height={102}
            className="jvk-admin-artwork w-40 h-auto"
          />
        </div>
      </header>
      {(error || result.error) && (
        <InlineBanner tone="critical" title={result.error || error || ""} />
      )}
      {result.success && <InlineBanner tone="success" title={result.success} />}
      {!data && !error && <p role="status" className="text-sm text-[#556C63]">Loading receivable order lines…</p>}
      {data?.lines.length === 0 && (
        <div className="jvk-admin-card flex flex-col items-center justify-center px-6 py-10 text-center">
          <h3 className="jvk-admin-serif text-lg font-bold text-[#0E2420]">No goods awaiting receipt</h3>
          <p className="mt-1.5 max-w-md text-sm text-[#556C63]">
            Issued orders with outstanding units will appear here.
          </p>
        </div>
      )}
      {data && !canWrite && (
        <ul className="space-y-2">
          {data.lines.map((item) => (
            <li key={item.lineId} className="jvk-admin-card p-4 text-sm text-[#0E2420]">
              {item.brand} · {item.outstanding} units outstanding
            </li>
          ))}
        </ul>
      )}
      {canWrite && !!data?.lines.length && (
        <div className="jvk-admin-card p-5 sm:p-6">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={receive}>
            <label className="sm:col-span-2 text-sm font-medium text-[#2A423A]">
              Issued order line
              <select
                className={`${selectStyle} mt-1`}
                required
                value={line ? lineId : ""}
                onChange={(event) => setLineId(event.target.value)}
              >
                <option value="" disabled hidden>Choose line</option>
                {data.lines.map((item) => (
                  <option key={item.lineId} value={item.lineId}>
                    {item.brand} · {item.outstanding} open units ·{" "}
                    {item.orderId.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="purchase-invoice" className="text-sm font-medium text-[#2A423A]">
              Invoice reference
              <Input
                id="purchase-invoice"
                name="invoice"
                required
                maxLength={100}
                className="mt-1 bg-white"
              />
            </label>
            <label htmlFor="purchase-batch" className="text-sm font-medium text-[#2A423A]">
              Batch number
              <Input
                id="purchase-batch"
                name="batch"
                required
                maxLength={60}
                className="mt-1 bg-white"
              />
            </label>
            <label htmlFor="purchase-expiry" className="text-sm font-medium text-[#2A423A]">
              Expiry
              <Input
                id="purchase-expiry"
                name="expiry"
                type="date"
                required
                className="mt-1 bg-white"
              />
            </label>
            <label htmlFor="purchase-received" className="text-sm font-medium text-[#2A423A]">
              Received units
              <Input
                id="purchase-received"
                name="received"
                type="number"
                min={1}
                max={line?.outstanding}
                required
                className="mt-1 bg-white"
              />
            </label>
            <label htmlFor="purchase-damaged" className="text-sm font-medium text-[#2A423A]">
              Damaged units
              <Input
                id="purchase-damaged"
                name="damaged"
                type="number"
                min={0}
                max={line?.outstanding}
                defaultValue={0}
                required
                className="mt-1 bg-white"
              />
            </label>
            <div className="self-end">
              <button type="submit" disabled={result.pending || !line} className="jvk-admin-primary-btn">
                {result.pending ? "Posting…" : "Post goods receipt"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
