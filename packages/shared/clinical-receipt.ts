export type ClinicalReceipt = {
  id: string;
  prescriptionId: string;
  clinicId: string;
  clinicName: string;
  clinicAddress: string | null;
  journalId: string;
  businessDay: string;
  createdAt: string;
  totalPaise: number;
  netPaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  payments: { method: "cash" | "upi" | "card" | "credit"; amountPaise: number }[];
  lines: {
    batchId: string;
    batchNo: string;
    expiry: string;
    brand: string;
    strengthMg: number;
    units: number;
    unitPricePaise: number;
    totalPaise: number;
  }[];
};

export const CLINIC_LOW_STOCK_THRESHOLD = 10;
