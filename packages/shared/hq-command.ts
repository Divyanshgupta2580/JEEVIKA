export type HqOrganization = {
  id: string;
  name: string;
  slug: string;
  adminEmail: string;
  brandingColor: string;
};

export type HqClinic = {
  id: string;
  name: string;
  status: "active" | "paused";
  code: string | null;
  address: string | null;
  tier: string | null;
  bedCapacity: number | null;
  managerName: string | null;
  managerEmail: string | null;
  patientCount: number;
  activeAdmissions: number;
  grossPaise: number;
  saleCount: number;
};

export type HqFleet = {
  organization: HqOrganization | null;
  clinics: HqClinic[];
  day: string;
};
export type HqStock = {
  items: {
    id: string;
    brand: string;
    salt: string;
    strengthMg: number;
    form: string;
  }[];
  batches: {
    id: string;
    skuId: string;
    clinicId: string;
    batchNo: string;
    expiry: string;
    quantity: number;
    available: number;
    costPaise: number;
    pricePaise: number;
  }[];
  day: string;
};

export type HqPeriod = "today" | "week" | "month" | "all";
export type HqGroup = "clinic_id" | "payment_mode" | "sale_type";
export type HqSale = {
  id: string;
  clinicId: string;
  recordedAt: string;
  grossPaise: number;
  netPaise: number;
  cogsPaise: number;
  taxPaise: number;
  payments: { method: string; amountPaise: number }[];
};
export type HqFinance = {
  from: string | null;
  through: string;
  lockDate: string | null;
  journalCount: number;
  debitPaise: number;
  creditPaise: number;
  grossPaise: number;
  revenuePaise: number;
  cogsPaise: number;
  operatingExpensesPaise: number;
  operatingProfitPaise: number;
  saleCount: number;
  unreconciledSales: number;
  branches: {
    clinicId: string;
    grossPaise: number;
    revenuePaise: number;
    cogsPaise: number;
    operatingExpensesPaise: number;
    profitPaise: number;
    saleCount: number;
  }[];
  centralExpensesPaise: number;
  segments: { name: string; paise: number }[];
  selectedGrossPaise: number;
  daily: { date: string; grossPaise: number; saleCount: number }[];
  sales: HqSale[];
  salesTruncated: boolean;
};

export type HqTransfer = {
  id: string;
  sourceClinicId: string;
  destinationClinicId: string;
  skuId: string;
  sourceBatchId: string;
  destinationBatchId: string;
  batchNo: string;
  expiry: string;
  unitCostPaise: number;
  unitPricePaise: number;
  units: number;
  reason: string;
  createdAt: string;
  actorId: string;
};
