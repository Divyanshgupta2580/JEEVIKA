import { Hono, type MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Principal } from "../../../../packages/shared/integration";
import type { Env, IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { validatePatientSession } from "../../patient-session";
import { sessionOrgId } from "../../security";
import { staffAccess } from "../../staff-access";
import { validateStaffSession } from "../../staff-session";

type RecordPrincipal =
  | (Omit<Principal, "role"> & { role: Exclude<Principal["role"], "PATIENT"> })
  | {
      role: "PATIENT";
      orgId: string;
      patientId: string;
    };
type RecordContext = { Bindings: Env; Variables: { viewer: RecordPrincipal } };
type StaffRole = Principal["role"];
const clinicalRoles: StaffRole[] = ["DOCTOR", "NURSE", "STAT_NURSE"];
const pharmacyRoles: StaffRole[] = ["DOCTOR", "CASHIER", "CLINIC_ADMIN"];

function checkScope(
  query: Record<string, string>,
  viewer: RecordPrincipal | Principal,
) {
  for (const key of ["org_id", "orgId"]) {
    if (query[key] !== undefined && query[key] !== viewer.orgId)
      throw new HTTPException(403, { message: "Organization access denied" });
  }
  for (const key of ["clinic_id", "clinicId"]) {
    if (
      query[key] !== undefined &&
      (viewer.role === "PATIENT" || query[key] !== viewer.clinicId)
    )
      throw new HTTPException(403, { message: "Clinic access denied" });
  }
}

function recordAccess(...roles: StaffRole[]): MiddlewareHandler<RecordContext> {
  return async (c, next) => {
    c.header("Cache-Control", "no-store");
    const authorization = c.req.header("Authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    if (!c.env?.DB || !token)
      throw new HTTPException(401, { message: "Session required" });
    const patient = sessionOrgId(token, "patient")
      ? await validatePatientSession(c.env, token)
      : null;
    const staff =
      !patient && sessionOrgId(token, "staff")
        ? await validateStaffSession(c.env, token)
        : null;
    const principal = staff?.principal;
    const viewer: RecordPrincipal | undefined = patient
      ? { role: "PATIENT", ...patient }
      : principal && principal.role !== "PATIENT"
        ? { ...principal, role: principal.role }
        : undefined;
    if (!viewer)
      throw new HTTPException(401, { message: "Session invalid or expired" });
    if (viewer.role !== "PATIENT" && !roles.includes(viewer.role))
      throw new HTTPException(403, {
        message: "Operation is outside your access",
      });
    checkScope(c.req.query(), viewer);
    c.set("viewer", viewer);
    await next();
  };
}

const unavailable = () =>
  new HTTPException(404, { message: "Record unavailable" });
const patientFields = `p.id,p.name,p.birth_date AS dob,p.gender,p.language AS preferredLang`;
const staffPatientScope = `EXISTS (
  SELECT 1 FROM encounters e JOIN consents c
    ON c.org_id=e.org_id AND c.patient_id=e.patient_id AND c.encounter_id=e.id
    AND c.purpose='care' AND c.revoked_at IS NULL
  WHERE e.org_id=p.org_id AND e.patient_id=p.id AND e.clinic_id=?
)`;

export const protectedPatients = new Hono<RecordContext>();
protectedPatients.use("*", recordAccess(...clinicalRoles));
protectedPatients.get("/", async (c) => {
  const viewer = c.get("viewer");
  if (viewer.role === "PATIENT")
    throw new HTTPException(403, {
      message: "Patient directory is staff only",
    });
  const search = z
    .string()
    .trim()
    .max(120)
    .safeParse(c.req.query("q") ?? c.req.query("name") ?? "");
  if (
    !search.success ||
    c.req.query("phone") !== undefined ||
    c.req.query("abha") !== undefined
  )
    throw new HTTPException(400, { message: "Search by patient name" });
  const { results } = await tenantDb({ db: c.env.DB, orgId: viewer.orgId })
    .statement(
      `SELECT ${patientFields} FROM patients p WHERE p.org_id=:org AND ${staffPatientScope}
      AND (?='' OR instr(lower(p.name),lower(?))>0) ORDER BY p.name,p.id LIMIT 50`,
      viewer.clinicId,
      search.data,
      search.data,
    )
    .all();
  return c.json({ success: true, count: results.length, patients: results });
});
protectedPatients.get("/:id", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (viewer.role === "PATIENT" && viewer.patientId !== id) throw unavailable();
  const clinic = viewer.role === "PATIENT" ? [] : [viewer.clinicId];
  const patient = await tenantDb({ db: c.env.DB, orgId: viewer.orgId })
    .statement(
      `SELECT ${patientFields} FROM patients p WHERE p.org_id=:org AND p.id=?${clinic.length ? ` AND ${staffPatientScope}` : ""}`,
      id,
      ...clinic,
    )
    .first();
  if (!patient) throw unavailable();
  return c.json({ success: true, patient });
});
protectedPatients.post("/", (c) =>
  c.json(
    { error: "Use the authenticated intake or patient registration workflow." },
    410,
  ),
);
protectedPatients.put("/:id", (c) =>
  c.json({ error: "Use the authenticated patient profile workflow." }, 410),
);

const rxScope = `FROM signed_prescriptions r JOIN encounters e
  ON e.org_id=r.org_id AND e.id=r.encounter_id AND e.clinic_id=r.clinic_id
  JOIN consents c ON c.org_id=e.org_id AND c.patient_id=e.patient_id AND c.encounter_id=e.id
    AND c.purpose='care' AND c.revoked_at IS NULL
  WHERE r.org_id=:org`;
const pharmacyConsent = `EXISTS (
  SELECT 1 FROM encounter_permissions ep WHERE ep.org_id=e.org_id AND ep.encounter_id=e.id
    AND ep.purpose='pharmacy' AND ep.revoked_at IS NULL
)`;
type RxSummary = {
  rxId: string;
  patientId: string;
  clinicId: string;
  prescriptionDate: string;
  status: "SIGNED" | "DISPENSED";
};
const rxFields = `r.id AS rxId,e.patient_id AS patientId,r.clinic_id AS clinicId,r.signed_at AS prescriptionDate,
  CASE WHEN EXISTS (SELECT 1 FROM reservations v WHERE v.org_id=r.org_id AND v.prescription_id=r.id AND v.status='dispensed')
  THEN 'DISPENSED' ELSE 'SIGNED' END AS status`;
export const protectedPrescriptions = new Hono<RecordContext>();
protectedPrescriptions.use("*", recordAccess(...pharmacyRoles));

protectedPrescriptions.get("/", async (c) => {
  const viewer = c.get("viewer");
  if (viewer.role === "PATIENT")
    throw new HTTPException(403, { message: "Use your prescription locker" });
  const status = z
    .enum(["SIGNED", "DISPENSED", "ALL"])
    .safeParse(c.req.query("status")?.toUpperCase() ?? "SIGNED");
  if (!status.success)
    throw new HTTPException(400, { message: "Invalid prescription status" });
  const { results } = await tenantDb({ db: c.env.DB, orgId: viewer.orgId })
    .statement(
      `SELECT * FROM (SELECT ${rxFields} ${rxScope} AND r.clinic_id=? AND ${pharmacyConsent})
      WHERE (?='ALL' OR status=?) ORDER BY prescriptionDate DESC LIMIT 50`,
      viewer.clinicId,
      status.data,
      status.data,
    )
    .all<RxSummary>();
  return c.json({
    success: true,
    count: results.length,
    prescriptions: results,
    items: results,
  });
});

protectedPrescriptions.get("/patient/:id", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (viewer.role === "PATIENT" && viewer.patientId !== id) throw unavailable();
  const db = tenantDb({ db: c.env.DB, orgId: viewer.orgId });
  const scope =
    viewer.role === "PATIENT"
      ? ""
      : ` AND r.clinic_id=? AND ${pharmacyConsent}`;
  const bindings = viewer.role === "PATIENT" ? [] : [viewer.clinicId];
  const rx = await db
    .statement(
      `SELECT ${rxFields} ${rxScope} AND e.patient_id=?${scope} ORDER BY r.signed_at DESC,r.id LIMIT 1`,
      id,
      ...bindings,
    )
    .first<RxSummary>();
  if (!rx) throw unavailable();
  return c.json(await withMedicineLines(db, rx));
});

protectedPrescriptions.get("/:id", async (c) => {
  const viewer = c.get("viewer");
  const db = tenantDb({ db: c.env.DB, orgId: viewer.orgId });
  const scope =
    viewer.role === "PATIENT"
      ? "e.patient_id=?"
      : `r.clinic_id=? AND ${pharmacyConsent}`;
  const rx = await db
    .statement(
      `SELECT ${rxFields} ${rxScope} AND r.id=? AND ${scope}`,
      c.req.param("id"),
      viewer.role === "PATIENT" ? viewer.patientId : viewer.clinicId,
    )
    .first<RxSummary>();
  if (!rx) throw unavailable();
  return c.json(await withMedicineLines(db, rx));
});

async function withMedicineLines(
  db: ReturnType<typeof tenantDb>,
  rx: RxSummary,
) {
  const { results } = await db
    .statement(
      `SELECT l.id,s.brand AS name,s.form AS dosageForm,s.strength_mg AS strengthMg,
    l.directions AS instructions,l.units,l.course_end AS courseEnd FROM prescription_lines l
    JOIN sku s ON s.org_id=l.org_id AND s.id=l.sku_id
    WHERE l.org_id=:org AND l.prescription_id=? ORDER BY l.id LIMIT 20`,
      rx.rxId,
    )
    .all();
  const prescription = { ...rx, medicines: results };
  return { ...prescription, prescription };
}

protectedPrescriptions.post("/", (c) =>
  c.json(
    { error: "Use the authenticated prescription signing workflow." },
    410,
  ),
);
protectedPrescriptions.put("/:id/adherence", (c) =>
  c.json({ error: "Use the patient check-in workflow." }, 410),
);

export const protectedIntake = new Hono<IntegrationContext>();
const clinicalAccess = staffAccess(...clinicalRoles);
const queueStatus = `CASE e.status WHEN 'emergency' THEN 'STAT_ALERT' WHEN 'reviewed' THEN 'IN_CONSULT' ELSE 'WAITING' END`;
const queueRows = `SELECT e.id,e.clinic_id,e.patient_id,p.name AS patient_name,e.chief_complaint,e.created_at,
  k.token_number AS token,k.token_number,${queueStatus} AS status
  FROM encounters e JOIN patients p ON p.org_id=e.org_id AND p.id=e.patient_id
  JOIN consents c ON c.org_id=e.org_id AND c.patient_id=p.id AND c.encounter_id=e.id AND c.purpose='care'
  LEFT JOIN kiosk_intakes k ON k.org_id=e.org_id AND k.clinic_id=e.clinic_id AND k.encounter_id=e.id
  WHERE e.org_id=:org AND e.clinic_id=? AND (c.revoked_at IS NULL OR (k.identity_id IS NULL AND json_extract(k.consent_json,'$.care')=0))`;
protectedIntake.get("/queue", clinicalAccess, async (c) => {
  const principal = c.get("principal");
  checkScope(c.req.query(), principal);
  const requested = c.req
    .query("status")
    ?.toUpperCase()
    .split(",")
    .map((value) => value.trim());
  const statuses = z
    .array(z.enum(["WAITING", "STAT_ALERT", "IN_CONSULT", "DISPENSED"]))
    .min(1)
    .max(4)
    .safeParse(requested ?? ["WAITING", "STAT_ALERT", "IN_CONSULT"]);
  if (!statuses.success)
    throw new HTTPException(400, { message: "Invalid intake status" });
  const { results } = await tenantDb({ db: c.env.DB, orgId: principal.orgId })
    .statement(
      `${queueRows} AND ${queueStatus} IN (SELECT value FROM json_each(?))
      ORDER BY e.status='emergency' DESC,e.created_at,e.id LIMIT 100`,
      principal.clinicId,
      JSON.stringify(statuses.data),
    )
    .all();
  return c.json({
    success: true,
    count: results.length,
    queue: results,
    encounters: results,
  });
});

for (const path of ["/encounter/:id", "/:id"] as const) {
  protectedIntake.get(path, clinicalAccess, async (c) => {
    const principal = c.get("principal");
    checkScope(c.req.query(), principal);
    const encounter = await tenantDb({ db: c.env.DB, orgId: principal.orgId })
      .statement(
        `${queueRows} AND e.id=?`,
        principal.clinicId,
        c.req.param("id"),
      )
      .first();
    if (!encounter) throw unavailable();
    return c.json({ success: true, encounter });
  });
  protectedIntake.patch(path, clinicalAccess, (c) =>
    c.json({ error: "Use the authenticated clinical care workflow." }, 410),
  );
}
for (const path of [
  "/encounter",
  "/encounter/:id/status",
  "/:id/status",
] as const) {
  protectedIntake.post(path, clinicalAccess, (c) =>
    c.json(
      { error: "Use the authenticated intake or clinical care workflow." },
      410,
    ),
  );
}
