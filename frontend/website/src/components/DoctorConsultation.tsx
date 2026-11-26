import { useLocation } from "react-router-dom";
import { OpdCbcReportsView } from "@/features/opd/OpdCbcReportsView";
import { OpdConsultationView } from "@/features/opd/OpdConsultationView";
import { OpdOverview } from "@/features/opd/OpdOverview";
import { OpdPatientQueue } from "@/features/opd/OpdPatientQueue";
import { OpdPrescriptionsView } from "@/features/opd/OpdPrescriptionsView";
import type { OpdPrescriptionItem, OpdQueueItem } from "@/features/opd/opdMetricsAndAlerts";

export type PrescriptionItem = OpdPrescriptionItem;
export type PatientQueueItem = OpdQueueItem;

interface DoctorConsultationProps {
  onAdmitToIpd?: (encounterId: string) => void;
  onAssignBay?: (encounterId: string) => void;
}

export function DoctorConsultation({ onAdmitToIpd, onAssignBay }: DoctorConsultationProps) {
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, "");

  if (path === "/app/doctor/queue") {
    return <OpdPatientQueue />;
  }
  if (path === "/app/doctor/cbc") {
    return <OpdCbcReportsView />;
  }
  if (path === "/app/doctor/rx") {
    return <OpdPrescriptionsView />;
  }
  if (
    path === "/app/doctor/consultation" ||
    path === "/app/doctor/soap" ||
    path === "/app/doctor/coding" ||
    path === "/app/doctor/disposition"
  ) {
    return <OpdConsultationView onAdmitToIpd={onAdmitToIpd} onAssignBay={onAssignBay} />;
  }
  return <OpdOverview />;
}
