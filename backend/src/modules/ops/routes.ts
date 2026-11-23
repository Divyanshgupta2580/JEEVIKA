import { Hono } from "hono";
import { z } from "zod";
import { computeLedger, predictRefillWarning, savingsMeter } from "../../../../packages/engine";
import { demoPlan } from "../../../../packages/shared/demo";
import type { Env } from "../../context";

export const opsRouter = new Hono<{ Bindings: Env }>();

const DEFAULT_ORG_ID = "org-jeevika-primary";

const posSaleItemSchema = z.object({
  salt: z.string().trim().min(1).max(100).optional(),
  units: z.number().int().positive().max(10000),
  pricePaise: z.number().int().nonnegative().max(100000000).optional(),
  costPaise: z.number().int().nonnegative().max(100000000).optional(),
});

const posSaleSchema = z.object({
  clinic_id: z.string().trim().min(1).max(80).optional(),
  clinicId: z.string().trim().min(1).max(80).optional(),
  prescription_id: z.string().trim().min(1).max(100).optional(),
  prescriptionId: z.string().trim().min(1).max(100).optional(),
  rxId: z.string().trim().min(1).max(100).optional(),
  patient_id: z.string().trim().min(1).max(100).optional(),
  patientId: z.string().trim().min(1).max(100).optional(),
  saleId: z.string().trim().min(1).max(100).optional(),
  units: z.number().int().positive().max(10000).optional(),
  unitPricePaise: z.number().int().nonnegative().max(100000000).optional(),
  unitCostPaise: z.number().int().nonnegative().max(100000000).optional(),
  items: z.array(posSaleItemSchema).max(100).optional(),
}).passthrough();

interface ClinicInventoryItem {
  salt: string;
  brand: string;
  strengthMg: number;
  clinicId: string;
  batchNo: string;
  expiry: string;
  stockUnits: number;
  unitPricePaise: number;
  unitCostPaise: number;
  reorderLevel: number;
}

export const clinicStockStore = new Map<string, ClinicInventoryItem[]>();

export const initClinicStocks = () => {
  clinicStockStore.set("clinic-delhi-01", [
    {
      salt: "metformin",
      brand: "Glucophage",
      strengthMg: 500,
      clinicId: "clinic-delhi-01",
      batchNo: "BAT-MET-01",
      expiry: "2026-11-01",
      stockUnits: 12,
      unitPricePaise: 1500,
      unitCostPaise: 800,
      reorderLevel: 25,
    },
    {
      salt: "aspirin",
      brand: "Ecosprin 300",
      strengthMg: 300,
      clinicId: "clinic-delhi-01",
      batchNo: "BAT-ASP-01",
      expiry: "2027-08-31",
      stockUnits: 45,
      unitPricePaise: 600,
      unitCostPaise: 300,
      reorderLevel: 15,
    },
    {
      salt: "clopidogrel",
      brand: "Plavix 300",
      strengthMg: 300,
      clinicId: "clinic-delhi-01",
      batchNo: "BAT-CLO-01",
      expiry: "2027-09-30",
      stockUnits: 30,
      unitPricePaise: 1800,
      unitCostPaise: 900,
      reorderLevel: 10,
    },
    {
      salt: "atorvastatin",
      brand: "Lipitor 80",
      strengthMg: 80,
      clinicId: "clinic-delhi-01",
      batchNo: "BAT-ATO-01",
      expiry: "2027-10-15",
      stockUnits: 25,
      unitPricePaise: 2500,
      unitCostPaise: 1200,
      reorderLevel: 15,
    },
    {
      salt: "amoxicillin-clavulanate",
      brand: "Augmentin 625 Duo",
      strengthMg: 625,
      clinicId: "clinic-delhi-01",
      batchNo: "BAT-AMX-01",
      expiry: "2027-06-30",
      stockUnits: 18,
      unitPricePaise: 2100,
      unitCostPaise: 1100,
      reorderLevel: 30,
    },
    {
      salt: "telmisartan",
      brand: "Telma 40",
      strengthMg: 40,
      clinicId: "clinic-delhi-01",
      batchNo: "BAT-TEL-01",
      expiry: "2027-12-31",
      stockUnits: 65,
      unitPricePaise: 1600,
      unitCostPaise: 800,
      reorderLevel: 20,
    },
    {
      salt: "pantoprazole",
      brand: "Pan 40",
      strengthMg: 40,
      clinicId: "clinic-delhi-01",
      batchNo: "BAT-PAN-01",
      expiry: "2027-05-30",
      stockUnits: 140,
      unitPricePaise: 1550,
      unitCostPaise: 750,
      reorderLevel: 40,
    },
  ]);

  clinicStockStore.set("clinic-opd-001", [
    {
      salt: "metformin",
      brand: "Glycomet 500 SR",
      strengthMg: 500,
      clinicId: "clinic-opd-001",
      batchNo: "BAT-OPD-MET",
      expiry: "2027-03-31",
      stockUnits: 180,
      unitPricePaise: 1600,
      unitCostPaise: 850,
      reorderLevel: 50,
    },
    {
      salt: "paracetamol",
      brand: "Dolo 650",
      strengthMg: 650,
      clinicId: "clinic-opd-001",
      batchNo: "BAT-OPD-DOL",
      expiry: "2027-11-30",
      stockUnits: 240,
      unitPricePaise: 420,
      unitCostPaise: 180,
      reorderLevel: 60,
    },
    {
      salt: "amoxicillin-clavulanate",
      brand: "Augmentin 625 Duo",
      strengthMg: 625,
      clinicId: "clinic-opd-001",
      batchNo: "BAT-OPD-AMX",
      expiry: "2027-08-31",
      stockUnits: 90,
      unitPricePaise: 2100,
      unitCostPaise: 1100,
      reorderLevel: 30,
    },
    {
      salt: "salbutamol",
      brand: "Asthalin 100 Inhaler",
      strengthMg: 100,
      clinicId: "clinic-opd-001",
      batchNo: "BAT-OPD-AST",
      expiry: "2027-04-30",
      stockUnits: 45,
      unitPricePaise: 1650,
      unitCostPaise: 820,
      reorderLevel: 20,
    },
  ]);

  clinicStockStore.set("clinic-triage-002", [
    {
      salt: "atropine",
      brand: "Atropine Sulfate Inj 0.6mg",
      strengthMg: 1,
      clinicId: "clinic-triage-002",
      batchNo: "BAT-TRG-ATR",
      expiry: "2027-01-31",
      stockUnits: 85,
      unitPricePaise: 2200,
      unitCostPaise: 1100,
      reorderLevel: 25,
    },
    {
      salt: "aspirin",
      brand: "Ecosprin 300 Dispersible",
      strengthMg: 300,
      clinicId: "clinic-triage-002",
      batchNo: "BAT-TRG-ASP",
      expiry: "2027-09-30",
      stockUnits: 120,
      unitPricePaise: 600,
      unitCostPaise: 250,
      reorderLevel: 30,
    },
    {
      salt: "clopidogrel",
      brand: "Plavix 300 Loading",
      strengthMg: 300,
      clinicId: "clinic-triage-002",
      batchNo: "BAT-TRG-CLO",
      expiry: "2027-07-31",
      stockUnits: 75,
      unitPricePaise: 1800,
      unitCostPaise: 850,
      reorderLevel: 20,
    },
    {
      salt: "ceftriaxone",
      brand: "Monocef 1g IV",
      strengthMg: 1000,
      clinicId: "clinic-triage-002",
      batchNo: "BAT-TRG-CEF",
      expiry: "2027-03-31",
      stockUnits: 60,
      unitPricePaise: 6500,
      unitCostPaise: 3200,
      reorderLevel: 20,
    },
  ]);

  clinicStockStore.set("clinic-mumbai-02", [
    {
      salt: "metformin",
      brand: "Glucophage",
      strengthMg: 500,
      clinicId: "clinic-mumbai-02",
      batchNo: "BAT-MET-02",
      expiry: "2027-04-15",
      stockUnits: 140,
      unitPricePaise: 1500,
      unitCostPaise: 800,
      reorderLevel: 20,
    },
    {
      salt: "amoxicillin-clavulanate",
      brand: "Augmentin 625 Duo",
      strengthMg: 625,
      clinicId: "clinic-mumbai-02",
      batchNo: "BAT-MUM-AMX",
      expiry: "2027-07-31",
      stockUnits: 110,
      unitPricePaise: 2100,
      unitCostPaise: 1100,
      reorderLevel: 25,
    },
    {
      salt: "atorvastatin",
      brand: "Lipitor 80",
      strengthMg: 80,
      clinicId: "clinic-mumbai-02",
      batchNo: "BAT-MUM-ATO",
      expiry: "2027-09-30",
      stockUnits: 85,
      unitPricePaise: 2500,
      unitCostPaise: 1200,
      reorderLevel: 20,
    },
  ]);

  clinicStockStore.set("clinic-ayush-003", [
    {
      salt: "ashwagandha",
      brand: "Ashwagandha Churna 100g",
      strengthMg: 100,
      clinicId: "clinic-ayush-003",
      batchNo: "BAT-AYU-ASH",
      expiry: "2027-10-31",
      stockUnits: 95,
      unitPricePaise: 12000,
      unitCostPaise: 6000,
      reorderLevel: 20,
    },
    {
      salt: "triphala",
      brand: "Triphala Guggulu Tab",
      strengthMg: 500,
      clinicId: "clinic-ayush-003",
      batchNo: "BAT-AYU-TRI",
      expiry: "2027-12-31",
      stockUnits: 110,
      unitPricePaise: 14500,
      unitCostPaise: 7000,
      reorderLevel: 25,
    },
  ]);
};

initClinicStocks();

const hqDepotStock: Record<string, number> = {
  metformin: 1800,
  aspirin: 3200,
  clopidogrel: 2100,
  atorvastatin: 1950,
  "amoxicillin-clavulanate": 2400,
  telmisartan: 1650,
  pantoprazole: 4500,
  paracetamol: 5800,
  atropine: 650,
  salbutamol: 1200,
  ceftriaxone: 950,
  ashwagandha: 850,
  triphala: 920,
};

interface PosSaleRecord {
  orgId: string;
  saleId: string;
  clinicId: string;
  prescriptionId?: string;
  patientId?: string;
  units: number;
  totalSalePaise: number;
  totalCogsPaise: number;
  status: string;
  createdAt: string;
}

export const salesStore: PosSaleRecord[] = [];

opsRouter.get("/inventory/radar", async (c) => {
  const clinicId = c.req.query("clinic_id") || c.req.query("clinicId") || "clinic-delhi-01";
  const stockParam = c.req.query("stock");

  const clinicItems = clinicStockStore.get(clinicId) || clinicStockStore.get("clinic-delhi-01") || [];
  const primaryItem = clinicItems.find((i) => i.salt === "metformin") || clinicItems[0];
  const liveStock = primaryItem ? primaryItem.stockUnits : 12;
  const stock = stockParam ? parseInt(stockParam, 10) : liveStock;

  // Cohort of chronic patients on maintenance medication
  const patients = [
    { patientId: "pat_sunita", drugSalt: "metformin", strengthMg: 500, dailyDoseUnits: 2, remainingUnits: 4 },
    { patientId: "pat_ramesh", drugSalt: "metformin", strengthMg: 500, dailyDoseUnits: 1, remainingUnits: 2 },
    { patientId: "pat_anita", drugSalt: "metformin", strengthMg: 500, dailyDoseUnits: 2, remainingUnits: 8 },
  ];

  const refillAnalysis = predictRefillWarning({
    currentStockUnits: stock,
    leadTimeDays: 3,
    patients,
  });

  const hqStock = (hqDepotStock["metformin"] || 500) + stock;
  const radarComparison = clinicItems.map((item) => ({
    salt: item.salt,
    brand: item.brand,
    strengthMg: item.strengthMg,
    clinicStock: item.stockUnits,
    hqGroupStock: (hqDepotStock[item.salt] || 300) + item.stockUnits,
    reorderLevel: item.reorderLevel,
    isLowStock: item.stockUnits < item.reorderLevel,
    status: item.stockUnits < item.reorderLevel ? "REFILL_RECOMMENDED" : "HEALTHY",
  }));

  return c.json({
    clinicId,
    clinicStockUnits: stock,
    hqGroupStockUnits: hqStock,
    expiringBatches: [
      {
        batchId: "batch_exp_near",
        salt: "metformin",
        brand: "Glucophage",
        expiry: "2026-11-01",
        daysToExpiry: 14,
        warning: "Expires within 14 days",
      },
    ],
    lowStockItems: refillAnalysis.isRefillWarningActive ? ["metformin-500"] : [],
    totalSkus: 120,
    refillAnalysis,
    inventoryRadar: radarComparison,
    rebalancing: {
      sourceHub: "HQ Central Depot",
      targetClinic: clinicId,
      recommendedTransferUnits: refillAnalysis.isRefillWarningActive ? 60 : 0,
      estimatedTransitDays: 1,
    },
  });
});

opsRouter.post("/pos/sale", async (c) => {
  const parsed = posSaleSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({
      success: false,
      error: "Invalid POS sale",
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    }, 400);
  }

  const body = parsed.data;
  const clinicId = body.clinic_id ?? body.clinicId ?? "clinic-delhi-01";
  const prescriptionId = body.prescription_id ?? body.prescriptionId ?? body.rxId ?? null;
  const patientId = body.patient_id ?? body.patientId ?? null;
  const saleId = body.saleId ?? `sale_${crypto.randomUUID()}`;
  const dateStr = new Date().toISOString().slice(0, 10);

  let units = body.units ?? 30;
  let unitPricePaise = body.unitPricePaise ?? 1500;
  let unitCostPaise = body.unitCostPaise ?? 800;
  let totalSalePaise = units * unitPricePaise;
  let totalCogsPaise = units * unitCostPaise;

  // If items array is provided (e.g. from doctor consultation or detailed POS)
  if (body.items && body.items.length > 0) {
    let sumUnits = 0;
    let sumSalePaise = 0;
    let sumCogsPaise = 0;
    for (const item of body.items) {
      const u = item.units;
      const p = item.pricePaise ?? unitPricePaise;
      const cs = item.costPaise ?? Math.floor((p * 53 + 50) / 100);
      sumUnits += u;
      sumSalePaise += u * p;
      sumCogsPaise += u * cs;
    }
    if (sumUnits > 0) {
      units = sumUnits;
      totalSalePaise = sumSalePaise;
      totalCogsPaise = sumCogsPaise;
    }
  }

  // Update clinic inventory stock
  let clinicItems = clinicStockStore.get(clinicId);
  if (!clinicItems) {
    clinicItems = [
      {
        salt: "metformin",
        brand: "Glucophage",
        strengthMg: 500,
        clinicId,
        batchNo: `BAT-${clinicId}-01`,
        expiry: "2027-12-31",
        stockUnits: 50,
        unitPricePaise,
        unitCostPaise,
        reorderLevel: 20,
      },
    ];
    clinicStockStore.set(clinicId, clinicItems);
  }

  const remainingBeforeSale = clinicItems.reduce((sum, item) => sum + item.stockUnits, 0);
  if (remainingBeforeSale < units) {
    return c.json({
      success: false,
      error: "Insufficient inventory",
      clinicId,
      requestedUnits: units,
      availableUnits: remainingBeforeSale,
    }, 409);
  }

  let unitsToAllocate = units;
  const fefoItems = [...clinicItems].sort((a, b) => a.expiry.localeCompare(b.expiry));
  const allocations: Array<{ item: ClinicInventoryItem; units: number }> = [];
  for (const item of fefoItems) {
    if (unitsToAllocate <= 0) break;
    const allocated = Math.min(item.stockUnits, unitsToAllocate);
    item.stockUnits -= allocated;
    unitsToAllocate -= allocated;
    allocations.push({ item, units: allocated });
  }
  const primaryItem = fefoItems[0];

  // Balanced double-entry posting: Cash (dr) / Revenue (cr) and COGS (dr) / Inventory (cr)
  const ledgerResult = computeLedger({
    journals: [
      {
        id: "j_sale_" + Date.now(),
        referenceId: saleId,
        date: dateStr,
        lines: [
          { account: "cash", type: "debit", amountPaise: totalSalePaise },
          { account: "revenue", type: "credit", amountPaise: totalSalePaise },
        ],
      },
      {
        id: "j_cogs_" + Date.now(),
        referenceId: saleId,
        date: dateStr,
        lines: [
          { account: "cogs", type: "debit", amountPaise: totalCogsPaise },
          { account: "inventory", type: "credit", amountPaise: totalCogsPaise },
        ],
      },
    ],
  });

  const saleRecord: PosSaleRecord = {
    orgId: DEFAULT_ORG_ID,
    saleId,
    clinicId,
    prescriptionId: prescriptionId || undefined,
    patientId: patientId || undefined,
    units,
    totalSalePaise,
    totalCogsPaise,
    status: "completed",
    createdAt: new Date().toISOString(),
  };

  // If DB bound, record in D1 with mandatory tenant scope.
  if (c.env?.DB) {
    try {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO sales
          (org_id, id, reservation_id, clinic_id, created_by, created_at, status,
           total_paise, net_paise, tax_paise, cgst_paise, sgst_paise, igst_paise, cost_paise)
         VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, 0, 0, 0, 0, ?)`
      ).bind(
        DEFAULT_ORG_ID,
        saleId,
        prescriptionId || `res_${saleId}`,
        clinicId,
        "cashier-pos",
        new Date().toISOString(),
        totalSalePaise,
        totalSalePaise,
        totalCogsPaise
      ).run();
    } catch (error) {
      for (const allocation of allocations) {
        allocation.item.stockUnits += allocation.units;
      }
      console.error("POS sale persistence failed", error);
      return c.json({
        success: false,
        error: "Sale could not be persisted",
      }, 503);
    }
  }
  salesStore.push(saleRecord);

  return c.json({
    saleId,
    status: "completed",
    clinicId,
    prescriptionId: prescriptionId || undefined,
    patientId: patientId || undefined,
    unitsSold: units,
    totalPaise: totalSalePaise,
    cogsPaise: totalCogsPaise,
    stockUpdated: true,
    inventory: {
      clinicId,
      remainingStockUnits: primaryItem ? primaryItem.stockUnits : 0,
    },
    ledger: ledgerResult,
    timestamp: new Date().toISOString(),
  });
});

opsRouter.post("/savings-meter", async (c) => {
  let body: unknown = null;
  try {
    body = await c.req.json();
  } catch {
    // fallback
  }

  if (typeof body !== "object" || body === null || !("prescription" in body)) {
    const demo = demoPlan();
    body = {
      prescription: {
        brandName: "Branded Metformin XR",
        salt: demo.prescription.salt,
        strengthMg: demo.prescription.strengthMg,
        form: demo.prescription.form,
        units: demo.prescription.units,
        courseEnd: demo.prescription.courseEnd,
        brandedPricePaise: 400,
      },
      genericBatches: demo.batches.map((b) => ({
        id: b.id,
        brand: "Jan Aushadhi Generic",
        salt: b.salt,
        strengthMg: b.strengthMg,
        form: b.form,
        stock: b.stock,
        pricePaise: b.pricePaise,
        expiry: b.expiry,
      })),
      allergies: demo.allergies,
    };
  }

  const result = savingsMeter(body);
  return c.json(result);
});

opsRouter.get("/ledger/summary", async (c) => {
  const clinicId = c.req.query("clinic_id") || c.req.query("clinicId");
  const dateStr = new Date().toISOString().slice(0, 10);

  // Exact double-entry ledger calculation
  const baseJournals = [
    {
      id: "j_init_rev",
      referenceId: "ref_historical_01",
      date: dateStr,
      lines: [
        { account: "bank", type: "debit", amountPaise: 12500000 },
        { account: "revenue", type: "credit", amountPaise: 12500000 },
      ],
    },
    {
      id: "j_init_cogs",
      referenceId: "ref_historical_02",
      date: dateStr,
      lines: [
        { account: "cogs", type: "debit", amountPaise: 8200000 },
        { account: "inventory", type: "credit", amountPaise: 8200000 },
      ],
    },
    {
      id: "j_init_exp",
      referenceId: "ref_historical_03",
      date: dateStr,
      lines: [
        { account: "operating_expense", type: "debit", amountPaise: 2100000 },
        { account: "bank", type: "credit", amountPaise: 2100000 },
      ],
    },
  ];

  if (clinicId && clinicId !== "all" && clinicId !== "org-all") {
    const clinicSales = salesStore.filter((s) => s.orgId === DEFAULT_ORG_ID && s.clinicId === clinicId);
    const liveRevenuePaise = clinicSales.reduce((acc, s) => acc + s.totalSalePaise, 0);
    const liveCogsPaise = clinicSales.reduce((acc, s) => acc + s.totalCogsPaise, 0);

    const sharePercent = clinicId === "clinic-delhi-01" ? 60 : 40;
    const proratedRev = Math.floor((12500000 * sharePercent + 50) / 100) + liveRevenuePaise;
    const proratedCogs = Math.floor((8200000 * sharePercent + 50) / 100) + liveCogsPaise;
    const proratedExp = Math.floor((2100000 * sharePercent + 50) / 100);

    const clinicJournals = [
      {
        id: `j_${clinicId}_rev`,
        referenceId: `ref_${clinicId}_01`,
        date: dateStr,
        lines: [
          { account: "bank", type: "debit", amountPaise: proratedRev },
          { account: "revenue", type: "credit", amountPaise: proratedRev },
        ],
      },
      {
        id: `j_${clinicId}_cogs`,
        referenceId: `ref_${clinicId}_02`,
        date: dateStr,
        lines: [
          { account: "cogs", type: "debit", amountPaise: proratedCogs },
          { account: "inventory", type: "credit", amountPaise: proratedCogs },
        ],
      },
      {
        id: `j_${clinicId}_exp`,
        referenceId: `ref_${clinicId}_03`,
        date: dateStr,
        lines: [
          { account: "operating_expense", type: "debit", amountPaise: proratedExp },
          { account: "bank", type: "credit", amountPaise: proratedExp },
        ],
      },
    ];

    const clinicResult = computeLedger({
      journals: clinicJournals,
      lockDate: null,
    });

    return c.json({
      clinicId,
      scope: "CLINIC_SPECIFIC",
      revenuePaise: clinicResult.revenuePaise,
      cogsPaise: clinicResult.cogsPaise,
      operatingExpensesPaise: clinicResult.operatingExpensesPaise,
      netProfitPaise: clinicResult.profitPaise,
      debitPaise: clinicResult.debitPaise,
      creditPaise: clinicResult.creditPaise,
      isBalanced: clinicResult.balanced,
      journalsCount: clinicResult.journals.length,
      salesCount: clinicSales.length,
      explanation: clinicResult.explanation,
    });
  }

  // Org-wide aggregation for HQ Command Center
  const result = computeLedger({
    journals: baseJournals,
    lockDate: null,
  });

  return c.json({
    revenuePaise: result.revenuePaise,
    cogsPaise: result.cogsPaise,
    operatingExpensesPaise: result.operatingExpensesPaise,
    netProfitPaise: result.profitPaise,
    debitPaise: result.debitPaise,
    creditPaise: result.creditPaise,
    isBalanced: result.balanced,
    journalsCount: result.journals.length,
    explanation: result.explanation,
    scope: "ORG_WIDE",
    clinicBreakdown: [
      { clinicId: "clinic-delhi-01", name: "Delhi Central OPD", revenuePaise: 7500000, profitPaise: 1320000 },
      { clinicId: "clinic-mumbai-02", name: "Mumbai Regional Hub", revenuePaise: 5000000, profitPaise: 880000 },
      { clinicId: "clinic-triage-002", name: "Emergency & Trauma Triage Unit", revenuePaise: 4200000, profitPaise: 760000 },
      { clinicId: "clinic-south-004", name: "Bengaluru Metro Health Hub", revenuePaise: 6800000, profitPaise: 1240000 },
      { clinicId: "clinic-ayush-003", name: "AYUSH Integrated Holistic Center", revenuePaise: 3100000, profitPaise: 620000 },
    ],
    liveSalesRecorded: salesStore.filter((sale) => sale.orgId === DEFAULT_ORG_ID).length,
  });
});
