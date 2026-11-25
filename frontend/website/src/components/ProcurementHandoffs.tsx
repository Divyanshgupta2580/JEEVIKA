import { useRef, useState, type FormEvent } from "react";
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
  const orders = new Map<string, Order[]>();
  for (const line of data?.orders ?? []) {
    const lines = orders.get(line.orderId);
    if (lines) lines.push(line);
    else orders.set(line.orderId, [line]);
  }
  return (
    <section className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Purchase orders</h1>
        {canWrite && (
          <Button variant="outline" onClick={goToReceipts}>
            Goods receipt
          </Button>
        )}
      </header>
      {(error || result.error) && (
        <InlineBanner tone="critical" title={result.error || error || ""} />
      )}
      {result.success && <InlineBanner tone="success" title={result.success} />}
      {!data && !error && <p role="status">Loading purchase orders…</p>}
      {data && !orders.size && (
        <EmptyState
          title="No purchase orders"
          description="Orders for this authorized clinic appear here."
        />
      )}
      {Array.from(orders).map(([id, lines]) => (
        <Card key={id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="min-w-0 break-words font-semibold">
                {lines[0].supplierReference} · {id.slice(0, 8)}
              </h2>
              <StatusChip>{lines[0].status}</StatusChip>
            </div>
            <ul>
              {lines.map((line) => (
                <li key={line.lineId}>
                  {line.brand} · {line.outstanding} of {line.units} units
                  outstanding
                </li>
              ))}
            </ul>
            {canWrite && lines[0].status === "draft" && (
              <Button
                variant="outline"
                disabled={result.pending}
                onClick={() =>
                  void post(
                    `/orders/${id}/issue`,
                    undefined,
                    "Order issued for receiving.",
                  )
                }
              >
                Issue order
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      {canWrite && data && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">Create purchase order</h2>
            {data.catalog.length === 0 ? (
              <p>
                Add approved items to the clinic medicine catalog before
                ordering.
              </p>
            ) : (
              <form className="space-y-3" onSubmit={create}>
                <label className="block" htmlFor="purchase-supplier">
                  Supplier reference
                  <Input
                    id="purchase-supplier"
                    name="supplier"
                    required
                    maxLength={150}
                  />
                </label>
                {rows.map((line) => (
                  <fieldset
                    key={line}
                    className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
                  >
                    <legend>Order line {line + 1}</legend>
                    <label>
                      Catalog item
                      <select
                        name={`sku-${line}`}
                        className={selectStyle}
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
                    <label htmlFor={`purchase-units-${line}`}>
                      Units
                      <Input
                        id={`purchase-units-${line}`}
                        name={`units-${line}`}
                        type="number"
                        min={1}
                        max={100000}
                        required
                      />
                    </label>
                    <label htmlFor={`purchase-cost-${line}`}>
                      Unit cost (₹)
                      <Input
                        id={`purchase-cost-${line}`}
                        name={`cost-${line}`}
                        type="number"
                        min="0.01"
                        max="1000000"
                        step="0.01"
                        required
                      />
                    </label>
                    <label htmlFor={`purchase-price-${line}`}>
                      Unit selling price (₹)
                      <Input
                        id={`purchase-price-${line}`}
                        name={`price-${line}`}
                        type="number"
                        min="0.01"
                        max="1000000"
                        step="0.01"
                        required
                      />
                    </label>
                  </fieldset>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={rows.length >= 20}
                    onClick={() => setRows([...rows, rows.length])}
                  >
                    Add line
                  </Button>
                  {rows.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRows(rows.slice(0, -1))}
                    >
                      Remove last line
                    </Button>
                  )}
                  <Button type="submit" disabled={result.pending}>
                    {result.pending ? "Saving…" : "Create draft"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
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
    <section className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Goods receipt</h1>
      {(error || result.error) && (
        <InlineBanner tone="critical" title={result.error || error || ""} />
      )}
      {result.success && <InlineBanner tone="success" title={result.success} />}
      {!data && !error && <p role="status">Loading receivable order lines…</p>}
      {data?.lines.length === 0 && (
        <EmptyState
          title="No goods awaiting receipt"
          description="Issued orders with outstanding units will appear here."
        />
      )}
      {data && !canWrite && (
        <ul className="space-y-2">
          {data.lines.map((item) => (
            <li key={item.lineId} className="rounded-md border p-3">
              {item.brand} · {item.outstanding} units outstanding
            </li>
          ))}
        </ul>
      )}
      {canWrite && !!data?.lines.length && (
        <Card>
          <CardContent className="p-4">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={receive}>
              <label className="sm:col-span-2">
                Issued order line
                <select
                  className={selectStyle}
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
              <label htmlFor="purchase-invoice">
                Invoice reference
                <Input
                  id="purchase-invoice"
                  name="invoice"
                  required
                  maxLength={100}
                />
              </label>
              <label htmlFor="purchase-batch">
                Batch number
                <Input
                  id="purchase-batch"
                  name="batch"
                  required
                  maxLength={60}
                />
              </label>
              <label htmlFor="purchase-expiry">
                Expiry
                <Input
                  id="purchase-expiry"
                  name="expiry"
                  type="date"
                  required
                />
              </label>
              <label htmlFor="purchase-received">
                Received units
                <Input
                  id="purchase-received"
                  name="received"
                  type="number"
                  min={1}
                  max={line?.outstanding}
                  required
                />
              </label>
              <label htmlFor="purchase-damaged">
                Damaged units
                <Input
                  id="purchase-damaged"
                  name="damaged"
                  type="number"
                  min={0}
                  max={line?.outstanding}
                  defaultValue={0}
                  required
                />
              </label>
              <div className="self-end">
                <Button type="submit" disabled={result.pending || !line}>
                  {result.pending ? "Posting…" : "Post goods receipt"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
