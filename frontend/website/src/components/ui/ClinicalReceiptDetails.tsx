import { useRef } from "react";
import { Printer } from "lucide-react";
import type { ClinicalReceipt } from "../../../../../packages/shared/clinical-receipt";
import { clinicMoney } from "@/features/clinic-operations/telemetry";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./clinical-receipt.css";

const recordedTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
});

export function ClinicalReceiptDetails({ receipt }: { receipt: ClinicalReceipt }) {
  const content = useRef<HTMLElement>(null);
  const print = () => {
    const article = content.current;
    if (!article) return;
    article.dataset.clinicalPrintContent = "active";
    try {
      window.print();
    } finally {
      delete article.dataset.clinicalPrintContent;
    }
  };

  const totals = [
    { label: "Net revenue", paise: receipt.netPaise },
    { label: "GST", paise: receipt.taxPaise },
    { label: "CGST", paise: receipt.cgstPaise },
    { label: "SGST", paise: receipt.sgstPaise },
    { label: "IGST", paise: receipt.igstPaise },
  ];

  return (
    <div className="space-y-3">
      <article ref={content} className="space-y-3 rounded-2xl border border-[#E4E5DA] bg-[#FFFDFB] p-4 text-xs text-[#103B32]">
        <header className="space-y-1.5 border-b border-[#E4E5DA] pb-3">
          <img src="/assets/logo-jeevika.png" alt="Jeevika" className="h-6 w-auto object-contain" />
          <p className="text-sm font-bold">{receipt.clinicName} · Pharmacy tax receipt</p>
          {receipt.clinicAddress && <p>{receipt.clinicAddress}</p>}
          <p className="break-all font-mono">Receipt {receipt.id}</p>
          <p className="break-all font-mono">Journal {receipt.journalId}</p>
          <p>Posted {receipt.businessDay} (IST)</p>
          <time dateTime={receipt.createdAt}>Recorded {recordedTime.format(new Date(receipt.createdAt))} IST</time>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-left">
            <thead className="border-b border-[#E4E5DA] text-[#556D65]">
              <tr><th>Medicine and batch</th><th className="text-right">Units</th><th className="text-right">Each</th><th className="text-right">Gross</th></tr>
            </thead>
            <tbody className="divide-y divide-[#E4E5DA]">
              {receipt.lines.map((line, index) => (
                <tr key={`${line.batchId}:${index}`}>
                  <td className="py-2 pr-2">
                    <span className="font-semibold">{line.brand} · {line.strengthMg} mg</span>
                    <p className="text-[#556D65]">{line.batchNo} · Exp {line.expiry}</p>
                  </td>
                  <td className="text-right tabular-nums">{line.units}</td>
                  <td className="text-right tabular-nums">{clinicMoney(line.unitPricePaise)}</td>
                  <td className="text-right font-semibold tabular-nums">{clinicMoney(line.totalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="space-y-1 border-t border-[#E4E5DA] pt-2 tabular-nums">
          {totals.map(row => (
            <div key={row.label} className="flex justify-between gap-2"><dt>{row.label}</dt><dd>{clinicMoney(row.paise)}</dd></div>
          ))}
          <div className="flex justify-between gap-2 text-sm font-bold">
            <dt>Gross total</dt><dd>{clinicMoney(receipt.totalPaise)}</dd>
          </div>
          {receipt.payments.map(payment => (
            <div key={payment.method} className="flex justify-between gap-2 capitalize">
              <dt>{payment.method} recorded</dt><dd>{clinicMoney(payment.amountPaise)}</dd>
            </div>
          ))}
        </dl>
      </article>
      <button type="button" onClick={print} className="jvk-admin-secondary-btn">
        <Printer className="h-4 w-4" aria-hidden="true" />
        Print receipt
      </button>
    </div>
  );
}

export function ClinicalReceiptModal({ receipt, onClose }: { receipt: ClinicalReceipt; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-[min(96vw,36rem)] overflow-y-auto rounded-3xl border-[#E4E5DA] bg-[#FFFDF8]">
        <DialogHeader>
          <DialogTitle>Pharmacy tax receipt</DialogTitle>
          <DialogDescription>Posted sale from {receipt.clinicName}</DialogDescription>
        </DialogHeader>
        <ClinicalReceiptDetails receipt={receipt} />
      </DialogContent>
    </Dialog>
  );
}
