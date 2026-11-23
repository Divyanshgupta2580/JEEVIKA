interface InventoryBatch {
  stockUnits: number;
  reservedUnits: number;
  expiry: string;
}

export class ClinicInventory implements DurableObject {
  private readonly stockByBatch = new Map<string, InventoryBatch>();
  private readonly ready: Promise<void>;

  constructor(private readonly state: DurableObjectState) {
    this.ready = state.blockConcurrencyWhile(async () => {
      const stored = await state.storage.get<Record<string, InventoryBatch>>("stock");
      if (stored) {
        for (const [batchId, batch] of Object.entries(stored)) {
          this.stockByBatch.set(batchId, batch);
        }
      }
    });
  }

  private async persist(): Promise<void> {
    await this.state.storage.put("stock", Object.fromEntries(this.stockByBatch));
  }

  async alarm(): Promise<void> {
    await this.ready;
    let changed = false;
    for (const batch of this.stockByBatch.values()) {
      if (batch.reservedUnits > 0) {
        batch.reservedUnits = 0;
        changed = true;
      }
    }
    if (changed) await this.persist();
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    if (request.method !== "POST") {
      return Response.json({ ok: true, name: "ClinicInventory" });
    }

    const body = await request.json().catch(() => null) as
      | { batchId?: unknown; units?: unknown }
      | null;
    const batchId = typeof body?.batchId === "string" ? body.batchId : null;
    const units = typeof body?.units === "number" && Number.isInteger(body.units) ? body.units : null;
    if (!batchId || !units || units <= 0) {
      return Response.json({ error: "Invalid inventory operation" }, { status: 400 });
    }

    const batch = this.stockByBatch.get(batchId);
    if (!batch) return Response.json({ error: "Unknown batch" }, { status: 404 });

    if (url.pathname.endsWith("/reserve")) {
      const available = batch.stockUnits - batch.reservedUnits;
      if (units > available) {
        return Response.json({ error: "Insufficient stock", availableUnits: available }, { status: 409 });
      }
      batch.reservedUnits += units;
      await this.persist();
      await this.state.storage.setAlarm(Date.now() + 15 * 60 * 1000);
      return Response.json({ status: "reserved", batchId, reservedUnits: units, timestamp: Date.now() });
    }

    if (url.pathname.endsWith("/dispense")) {
      if (units > batch.reservedUnits) {
        return Response.json(
          { error: "Dispense exceeds reserved units", reservedUnits: batch.reservedUnits },
          { status: 409 },
        );
      }
      batch.reservedUnits -= units;
      batch.stockUnits -= units;
      await this.persist();
      return Response.json({
        status: "dispensed",
        batchId,
        dispensedUnits: units,
        remainingUnits: batch.stockUnits,
        timestamp: Date.now(),
      });
    }

    return Response.json({ error: "Unknown inventory operation" }, { status: 404 });
  }
}
