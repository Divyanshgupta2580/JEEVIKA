import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { IntegrationContext } from "../../context";
import { tenantDb } from "../../database";
import { staffAccess, staffBody } from "../../staff-access";

export const wardRouter = new Hono<IntegrationContext>();
export const bedsRouter = new Hono<IntegrationContext>();
const careReaders = staffAccess(
  "HOSPITAL_ADMIN",
  "CLINIC_ADMIN",
  "DOCTOR",
  "NURSE",
);
const bayReaders = staffAccess("DOCTOR", "NURSE", "STAT_NURSE");
const careWriters = staffAccess("DOCTOR", "NURSE");
const bayWriters = staffAccess("NURSE", "STAT_NURSE");
const alertReaders = staffAccess(
  "HOSPITAL_ADMIN",
  "CLINIC_ADMIN",
  "DOCTOR",
  "NURSE",
  "STAT_NURSE",
);
type CareKind = "bed" | "bay";
const now = () => new Date().toISOString();
const dataForAdmission = z.strictObject({
  encounterId: z.uuid(),
  locationId: z.string().min(1).max(80),
  doctorId: z.string().min(1).max(100),
  reason: z.string().trim().max(1000),
});
const reason = z.strictObject({ reason: z.string().trim().min(1).max(500) });
// An anonymous emergency token can occupy a bay without releasing a patient record.
const anonymousEmergency = `(e.status='emergency' AND EXISTS(
  SELECT 1 FROM kiosk_intakes k WHERE k.org_id=e.org_id AND k.clinic_id=e.clinic_id AND k.encounter_id=e.id
    AND k.identity_id IS NULL AND json_extract(k.consent_json,'$.care')=0))`;
const tokenNumber = `(SELECT k.token_number FROM kiosk_intakes k
  WHERE k.org_id=e.org_id AND k.clinic_id=e.clinic_id AND k.encounter_id=e.id LIMIT 1)`;

const occupiedSql = `SELECT a.id,a.encounter_id,a.admitted_at,a.doctor_id,a.reason,a.location_id,p.name,${tokenNumber} AS tokenNumber
  FROM care_admissions a JOIN encounters e ON e.org_id=a.org_id AND e.id=a.encounter_id AND e.clinic_id=a.clinic_id
  JOIN patients p ON p.org_id=e.org_id AND p.id=e.patient_id
  JOIN consents c ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.purpose='care'
  WHERE a.org_id=:org AND a.clinic_id=? AND a.discharged_at IS NULL AND (c.revoked_at IS NULL OR ${anonymousEmergency})`;

function makeCareRouter(kind: CareKind) {
  const router = new Hono<IntegrationContext>();
  router.get("/board", kind === "bed" ? careReaders : bayReaders, async (c) => {
    const p = c.get("principal");
    const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
    const administrative =
      p.role === "HOSPITAL_ADMIN" || p.role === "CLINIC_ADMIN";
    const [locations, admissions, encounters, doctors] = await Promise.all([
      db
        .statement(
          `SELECT l.id,l.room,l.label,l.state,
        EXISTS(SELECT 1 FROM care_admissions a WHERE a.org_id=l.org_id AND a.clinic_id=l.clinic_id AND a.location_id=l.id AND a.discharged_at IS NULL) AS occupied
        FROM care_locations l WHERE l.org_id=:org AND l.clinic_id=? AND l.kind=? ORDER BY l.room,l.label`,
          p.clinicId,
          kind,
        )
        .all(),
      administrative
        ? Promise.resolve({ results: [] })
        : db
            .statement(
              `${occupiedSql}
        AND EXISTS (SELECT 1 FROM care_locations l WHERE l.org_id=a.org_id AND l.clinic_id=a.clinic_id AND l.id=a.location_id AND l.kind=?)
        ORDER BY a.admitted_at`,
              p.clinicId,
              kind,
            )
            .all(),
      administrative
        ? Promise.resolve({ results: [] })
        : db
            .statement(
              `SELECT e.id,p.name,e.status,${tokenNumber} AS tokenNumber FROM encounters e
        JOIN patients p ON p.org_id=e.org_id AND p.id=e.patient_id
        JOIN consents c ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.purpose='care'
        WHERE e.org_id=:org AND e.clinic_id=? AND
          ((?='bed' AND c.revoked_at IS NULL) OR (?='bay' AND e.status='emergency' AND (c.revoked_at IS NULL OR ${anonymousEmergency})))
          AND NOT EXISTS(SELECT 1 FROM care_admissions a WHERE a.org_id=e.org_id AND a.encounter_id=e.id AND a.discharged_at IS NULL)
        ORDER BY e.created_at DESC LIMIT 50`,
              p.clinicId,
              kind,
              kind,
            )
            .all(),
      administrative
        ? Promise.resolve({ results: [] })
        : db
            .statement(
              "SELECT id FROM users WHERE org_id=:org AND clinic_id=? AND role='DOCTOR' ORDER BY id",
              p.clinicId,
            )
            .all(),
    ]);
    return c.json({
      locations: locations.results,
      admissions: admissions.results,
      encounters: encounters.results,
      doctors: doctors.results,
    });
  });

  router.post(
    "/locations",
    kind === "bed" ? careWriters : bayWriters,
    async (c) => {
      const p = c.get("principal");
      const { room, label } = await staffBody(
        c.req.raw,
        z.strictObject({
          room: z.string().trim().min(1).max(80),
          label: z.string().trim().min(1).max(80),
        }),
      );
      const id = crypto.randomUUID();
      await tenantDb({ db: c.env.DB, orgId: p.orgId })
        .statement(
          "INSERT INTO care_locations(org_id,clinic_id,id,kind,room,label) VALUES(:org,?,?,?,?,?)",
          p.clinicId,
          id,
          kind,
          room,
          label,
        )
        .run();
      return c.json({ id }, 201);
    },
  );

  router.post(
    "/locations/:id/ready",
    kind === "bed" ? careWriters : bayWriters,
    async (c) => {
      const p = c.get("principal");
      const result = await tenantDb({ db: c.env.DB, orgId: p.orgId })
        .statement(
          "UPDATE care_locations SET state='available' WHERE org_id=:org AND clinic_id=? AND id=? AND kind=? AND state='cleaning' RETURNING id",
          p.clinicId,
          c.req.param("id"),
          kind,
        )
        .first();
      if (!result)
        throw new HTTPException(409, {
          message: "Location is not awaiting cleaning",
        });
      return c.json(result);
    },
  );

  router.post(
    "/admissions",
    kind === "bed" ? careWriters : bayWriters,
    async (c) => {
      const p = c.get("principal");
      const body = await staffBody(c.req.raw, dataForAdmission);
      const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
      try {
        const created = await db
          .statement(
            `WITH tenant(org_id) AS (SELECT :org)
        INSERT INTO care_admissions (org_id,clinic_id,id,encounter_id,location_id,doctor_id,reason,admitted_by,admitted_at)
        SELECT tenant.org_id,l.clinic_id,?,e.id,l.id,u.id,?,?,? FROM tenant
        JOIN care_locations l ON l.org_id=tenant.org_id AND l.clinic_id=? AND l.id=? AND l.kind=? AND l.state='available'
        JOIN encounters e ON e.org_id=l.org_id AND e.clinic_id=l.clinic_id AND e.id=? AND (?='bed' OR e.status='emergency')
        JOIN consents c ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.purpose='care'
          AND (c.revoked_at IS NULL OR (l.kind='bay' AND ${anonymousEmergency}))
        JOIN users u ON u.org_id=l.org_id AND u.clinic_id=l.clinic_id AND u.id=? AND u.role='DOCTOR'
        RETURNING id`,
            crypto.randomUUID(),
            body.reason,
            p.userId,
            now(),
            p.clinicId,
            body.locationId,
            kind,
            body.encounterId,
            kind,
            body.doctorId,
          )
          .first();
        if (!created)
          throw new HTTPException(404, {
            message: "Encounter, attending doctor or location unavailable",
          });
        return c.json(created, 201);
      } catch (error) {
        if (error instanceof HTTPException) throw error;
        if (
          error instanceof Error &&
          /UNIQUE constraint failed/i.test(error.message)
        )
          throw new HTTPException(409, {
            message: "Encounter or location already has an active admission",
          });
        throw error;
      }
    },
  );

  router.post(
    "/admissions/:id/discharge",
    kind === "bed" ? careWriters : bayWriters,
    async (c) => {
      const p = c.get("principal");
      const released = await tenantDb({ db: c.env.DB, orgId: p.orgId })
        .statement(
          `UPDATE care_admissions AS a SET discharged_at=?, discharged_by=?
      WHERE a.org_id=:org AND a.clinic_id=? AND a.id=? AND a.discharged_at IS NULL
        AND EXISTS(SELECT 1 FROM care_locations l WHERE l.org_id=a.org_id AND l.clinic_id=a.clinic_id AND l.id=a.location_id AND l.kind=?)
        AND NOT EXISTS(SELECT 1 FROM ipd_distress_events s WHERE s.org_id=a.org_id AND s.clinic_id=a.clinic_id AND s.admission_id=a.id AND s.resolved_at IS NULL)
      RETURNING id`,
          now(),
          p.userId,
          p.clinicId,
          c.req.param("id"),
          kind,
        )
        .first();
      if (!released)
        throw new HTTPException(409, {
          message: "Location unavailable or an emergency remains active",
        });
      return c.json({ discharged: true });
    },
  );
  return router;
}

wardRouter.route("/", makeCareRouter("bed"));
bedsRouter.route("/", makeCareRouter("bay"));

wardRouter.post("/beds/:bedId/distress", staffAccess("NURSE"), async (c) => {
  const p = c.get("principal");
  const body = await staffBody(c.req.raw, reason);
  const db = tenantDb({ db: c.env.DB, orgId: p.orgId });
  const event = await db
    .statement(
      `INSERT INTO ipd_distress_events(org_id,clinic_id,id,admission_id,reporter_id,reason,triggered_at)
    SELECT a.org_id,a.clinic_id,?,a.id,?,?,?
    FROM care_admissions a
    JOIN care_locations l ON l.org_id=a.org_id AND l.clinic_id=a.clinic_id AND l.id=a.location_id AND l.kind='bed'
    WHERE a.org_id=:org AND a.clinic_id=? AND a.location_id=? AND a.discharged_at IS NULL
    ON CONFLICT(org_id,admission_id) WHERE resolved_at IS NULL DO NOTHING
    RETURNING id`,
      crypto.randomUUID(),
      p.userId,
      body.reason,
      now(),
      p.clinicId,
      c.req.param("bedId"),
    )
    .first();
  if (event) return c.json(event, 201);
  const existing = await db
    .statement(
      `SELECT s.id FROM ipd_distress_events s JOIN care_admissions a
      ON a.org_id=s.org_id AND a.id=s.admission_id AND a.clinic_id=s.clinic_id
    WHERE s.org_id=:org AND s.clinic_id=? AND a.location_id=? AND s.resolved_at IS NULL`,
      p.clinicId,
      c.req.param("bedId"),
    )
    .first();
  if (!existing)
    throw new HTTPException(404, { message: "Occupied bed unavailable" });
  return c.json(existing);
});

wardRouter.get("/distress/active", alertReaders, async (c) => {
  const p = c.get("principal");
  const admin = p.role === "HOSPITAL_ADMIN" || p.role === "CLINIC_ADMIN";
  const { results } = await tenantDb({ db: c.env.DB, orgId: p.orgId })
    .statement(
      `SELECT s.id,l.room,l.label AS bed,s.triggered_at AS triggeredAt,s.acknowledged_at AS acknowledgedAt,s.latency_ms AS latencyMs,
       CASE WHEN ? OR consent.revoked_at IS NOT NULL THEN NULL ELSE pt.name END AS patientName,
       CASE WHEN ? OR consent.revoked_at IS NOT NULL THEN NULL ELSE a.reason END AS diagnosis,
       CASE WHEN ? OR consent.revoked_at IS NOT NULL THEN NULL ELSE s.reason END AS reason,
       CASE WHEN a.doctor_id=? AND ?='DOCTOR' THEN 1 ELSE 0 END AS attending
    FROM ipd_distress_events s JOIN care_admissions a ON a.org_id=s.org_id AND a.clinic_id=s.clinic_id AND a.id=s.admission_id
    JOIN care_locations l ON l.org_id=a.org_id AND l.clinic_id=a.clinic_id AND l.id=a.location_id
    JOIN encounters e ON e.org_id=a.org_id AND e.clinic_id=a.clinic_id AND e.id=a.encounter_id
    JOIN patients pt ON pt.org_id=e.org_id AND pt.id=e.patient_id
    JOIN consents consent ON consent.org_id=e.org_id AND consent.encounter_id=e.id AND consent.purpose='care'
    WHERE s.org_id=:org AND s.clinic_id=? AND s.resolved_at IS NULL
    ORDER BY attending DESC,s.triggered_at DESC LIMIT 50`,
      Number(admin),
      Number(admin),
      Number(admin),
      p.userId,
      p.role,
      p.clinicId,
    )
    .all();
  return c.json({ events: results });
});

wardRouter.post(
  "/distress/:id/acknowledge",
  staffAccess("DOCTOR"),
  async (c) => {
    const p = c.get("principal");
    const at = now();
    const acknowledged = await tenantDb({ db: c.env.DB, orgId: p.orgId })
      .statement(
        `UPDATE ipd_distress_events AS s
      SET acknowledged_by=COALESCE(acknowledged_by,?), acknowledged_at=COALESCE(acknowledged_at,?),
          latency_ms=COALESCE(latency_ms,MAX(0,CAST(ROUND((julianday(?)-julianday(triggered_at))*86400000) AS INTEGER)))
      WHERE s.org_id=:org AND s.clinic_id=? AND s.id=? AND s.resolved_at IS NULL
      AND EXISTS(SELECT 1 FROM care_admissions a WHERE a.org_id=s.org_id AND a.clinic_id=s.clinic_id AND a.id=s.admission_id AND a.doctor_id=?)
      RETURNING acknowledged_at AS acknowledgedAt, CAST(ROUND(latency_ms) AS INTEGER) AS latencyMs`,
        p.userId,
        at,
        at,
        p.clinicId,
        c.req.param("id"),
        p.userId,
      )
      .first();
    if (!acknowledged)
      throw new HTTPException(404, { message: "Attending alert unavailable" });
    return c.json(acknowledged);
  },
);

wardRouter.post(
  "/distress/:id/resolve",
  staffAccess("NURSE", "DOCTOR"),
  async (c) => {
    const p = c.get("principal");
    const resolved = await tenantDb({ db: c.env.DB, orgId: p.orgId })
      .statement(
        `UPDATE ipd_distress_events AS s SET resolved_at=?,resolved_by=?
    WHERE s.org_id=:org AND s.clinic_id=? AND s.id=? AND s.resolved_at IS NULL
      AND (?='NURSE' OR EXISTS(SELECT 1 FROM care_admissions a WHERE a.org_id=s.org_id AND a.clinic_id=s.clinic_id AND a.id=s.admission_id AND a.doctor_id=?))
    RETURNING id`,
        now(),
        p.userId,
        p.clinicId,
        c.req.param("id"),
        p.role,
        p.userId,
      )
      .first();
    if (!resolved)
      throw new HTTPException(404, { message: "Alert unavailable" });
    return c.json({ resolved: true });
  },
);

const outreachItems = `SELECT a.id AS admissionId, p.name AS patientName, i.day AS day,
 CASE WHEN json_extract(i.observations_json,'$.distress')=1
   OR json_extract(i.observations_json,'$.systolic')>=180
   OR json_extract(i.observations_json,'$.spo2')<=90 THEN 'urgent' ELSE 'review' END AS priority
 FROM care_admissions a
 JOIN care_locations l ON l.org_id=a.org_id AND l.clinic_id=a.clinic_id AND l.id=a.location_id AND l.kind='bed'
 JOIN encounters e ON e.org_id=a.org_id AND e.clinic_id=a.clinic_id AND e.id=a.encounter_id
 JOIN patients p ON p.org_id=e.org_id AND p.id=e.patient_id
 JOIN consents c ON c.org_id=e.org_id AND c.encounter_id=e.id AND c.purpose='care' AND c.revoked_at IS NULL
 JOIN kiosk_intakes k ON k.org_id=e.org_id AND k.clinic_id=e.clinic_id AND k.encounter_id=e.id
      AND json_extract(k.consent_json,'$.remote')=1
 JOIN patient_check_ins i ON i.org_id=e.org_id AND i.patient_id=e.patient_id AND i.created_at>a.discharged_at
 WHERE a.org_id=:org AND a.clinic_id=? AND a.discharged_at IS NOT NULL
 AND NOT EXISTS(
   SELECT 1 FROM care_admissions newer
   JOIN care_locations newer_location ON newer_location.org_id=newer.org_id AND newer_location.clinic_id=newer.clinic_id AND newer_location.id=newer.location_id AND newer_location.kind='bed'
   JOIN encounters newer_encounter ON newer_encounter.org_id=newer.org_id AND newer_encounter.clinic_id=newer.clinic_id AND newer_encounter.id=newer.encounter_id
   WHERE newer.org_id=a.org_id AND newer.clinic_id=a.clinic_id AND newer_encounter.patient_id=e.patient_id
     AND (newer.discharged_at IS NULL OR newer.discharged_at>a.discharged_at OR (newer.discharged_at=a.discharged_at AND newer.id>a.id))
 )
 AND i.day=(SELECT MAX(last.day) FROM patient_check_ins last WHERE last.org_id=i.org_id AND last.patient_id=i.patient_id)
 AND (json_extract(i.observations_json,'$.distress')=1 OR json_extract(i.observations_json,'$.recovery')='worse'
   OR json_extract(i.observations_json,'$.systolic')>=180 OR json_extract(i.observations_json,'$.spo2')<=90)
 AND NOT EXISTS(SELECT 1 FROM nurse_outreach n WHERE n.org_id=a.org_id AND n.admission_id=a.id AND n.check_in_day=i.day)`;

export const outreachRouter = new Hono<IntegrationContext>();
outreachRouter.get("/", staffAccess("NURSE"), async (c) => {
  const p = c.get("principal");
  const { results } = await tenantDb({ db: c.env.DB, orgId: p.orgId })
    .statement(
      `${outreachItems} ORDER BY priority DESC,day,admissionId LIMIT 50`,
      p.clinicId,
    )
    .all();
  return c.json({ items: results });
});

outreachRouter.post("/outcomes", staffAccess("NURSE"), async (c) => {
  const p = c.get("principal");
  const body = await staffBody(
    c.req.raw,
    z.strictObject({
      admissionId: z.uuid(),
      day: z.iso.date(),
      outcome: z.enum([
        "stable",
        "medication-reviewed",
        "opd-requested",
        "transfer-reported",
      ]),
    }),
  );
  const saved = await tenantDb({ db: c.env.DB, orgId: p.orgId })
    .statement(
      `WITH eligible AS (${outreachItems})
    INSERT INTO nurse_outreach(org_id,clinic_id,id,admission_id,check_in_day,actor_id,outcome,created_at)
    SELECT ?,?,?,admissionId,day,?,?,? FROM eligible WHERE admissionId=? AND day=?
    ON CONFLICT(org_id,admission_id,check_in_day) DO NOTHING
    RETURNING id`,
      p.clinicId,
      p.orgId,
      p.clinicId,
      crypto.randomUUID(),
      p.userId,
      body.outcome,
      now(),
      body.admissionId,
      body.day,
    )
    .first();
  if (!saved)
    throw new HTTPException(409, {
      message: "This outreach item is no longer available",
    });
  return c.json(saved, 201);
});
