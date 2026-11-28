import type { HqFinance, HqStock } from "../../../../../packages/shared/hq-command";
import { CLINIC_LOW_STOCK_THRESHOLD } from "../../../../../packages/shared/clinical-receipt";

const dayMs = 86_400_000;
const dateMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
export const clinicMoney = (paise: number) => {
  const absolute = Math.abs(paise);
  return `${paise < 0 ? "-" : ""}₹${Math.trunc(absolute / 100).toLocaleString("en-IN")}.${String(absolute % 100).padStart(2, "0")}`;
};

export const clinicPostedStock = (stock?: HqStock) => {
  if (!stock) return { skuCount: 0, lowStock: [], criticalStock: [], nearExpiryBatches: [] };
  const items = new Map(stock.items.map(item => [item.id, item]));
  const bySku = new Map<string, { id: string; itemName: string; eligibleUnits: number; threshold: number }>();
  const batches = stock.batches.map(batch => {
    const item = items.get(batch.skuId);
    const itemName = item ? `${item.brand} · ${item.strengthMg} mg ${item.form}` : batch.skuId;
    const daysRemaining = (dateMs(batch.expiry) - dateMs(stock.day)) / dayMs;
    let current = bySku.get(batch.skuId);
    if (!current) {
      current = { id: batch.id, itemName, eligibleUnits: 0, threshold: CLINIC_LOW_STOCK_THRESHOLD };
      bySku.set(batch.skuId, current);
    }
    if (daysRemaining >= 0) current.eligibleUnits += batch.available;
    return {
      id: batch.id, itemName, daysRemaining, expiry: batch.expiry,
      quantity: batch.quantity, batchNo: batch.batchNo,
    };
  });
  const lowStock = [...bySku.values()].filter(item => item.eligibleUnits < item.threshold)
    .sort((a, b) => a.eligibleUnits - b.eligibleUnits || a.itemName.localeCompare(b.itemName));
  return {
    skuCount: bySku.size, lowStock, criticalStock: lowStock.filter(item => item.eligibleUnits <= 4),
    nearExpiryBatches: batches.filter(batch => batch.quantity > 0 && batch.daysRemaining <= 30)
      .sort((a, b) => a.daysRemaining - b.daysRemaining || a.id.localeCompare(b.id)),
  };
};

export function clinicRevenueDays(period: HqFinance | undefined, days: number) {
  if (!period) return [];
  const recorded = new Map(period.daily.map(day => [day.date, day]));
  return Array.from({ length: days }, (_, index) => {
    const value = new Date(dateMs(period.through) - (days - index - 1) * dayMs);
    const businessDay = value.toISOString().slice(0, 10);
    const grossPaise = recorded.get(businessDay)?.grossPaise ?? 0;
    return {
      name: value.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }),
      fullDate: value.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
      visits: recorded.get(businessDay)?.saleCount ?? 0,
      grossPaise,
      revenue: grossPaise / 100, // A display coordinate. Aggregates use grossPaise.
    };
  });
}

export function clinicRevenueTrend(today: number | undefined, history: readonly { grossPaise: number }[]) {
  if (today === undefined || history.length <= 1) return { percent: "Baseline unavailable", positive: false, hasBaseline: false };
  const past = history.slice(0, -1);
  const baseline = past.reduce((sum, row) => sum + row.grossPaise, 0);
  if (baseline === 0) return { percent: "No prior revenue baseline", positive: false, hasBaseline: false };
  const diff = (today * past.length - baseline) / baseline * 100;
  return { percent: `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`, positive: diff >= 0, hasBaseline: true };
}
