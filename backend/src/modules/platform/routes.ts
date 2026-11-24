import { Hono } from "hono";
import type { IntegrationContext } from "../../context";
import { staffAccess } from "../../staff-access";

export const platformRouter = new Hono<IntegrationContext>();

platformRouter.post("/auth/login", async (c) => {
  return c.json({
    token: "mock-jwt-token",
    expiresIn: 900,
    user: {
      id: "usr_admin",
      role: "HOSPITAL_ADMIN",
      clinicId: "clinic_north"
    }
  });
});

platformRouter.get("/audit/verify", staffAccess("SUPER_ADMIN"), (c) =>
  c.json({ error: "Cryptographic audit verification is unavailable" }, 501),
);
