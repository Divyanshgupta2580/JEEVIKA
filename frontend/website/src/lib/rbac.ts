export type AccessLevel = "Full" | "Read-only" | "None";
export type JeevikaRole =
  | "SUPER_ADMIN"
  | "OWNER"
  | "HOSPITAL_ADMIN"
  | "ADMIN"
  | "CLINIC_ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "STAT_NURSE"
  | "CASHIER"
  | "CLINIC_STAFF"
  | "PATIENT";

const routePermissions = {
  "/app/command": { SUPER_ADMIN: "Full", OWNER: "Full", HOSPITAL_ADMIN: "Full", ADMIN: "Full", CLINIC_ADMIN: "Full" },
  "/app/command/network": { SUPER_ADMIN: "Full", OWNER: "Full", HOSPITAL_ADMIN: "Full", ADMIN: "Full" },
  "/app/command/census": { SUPER_ADMIN: "Full", OWNER: "Full", HOSPITAL_ADMIN: "Full", ADMIN: "Full", CLINIC_ADMIN: "Read-only" },
  "/app/command/optimizer": { SUPER_ADMIN: "Full", OWNER: "Full", HOSPITAL_ADMIN: "Full", ADMIN: "Full" },
  "/app/command/expenses": { HOSPITAL_ADMIN: "Full", ADMIN: "Full" },
  "/app/command/equipment": { HOSPITAL_ADMIN: "Full", ADMIN: "Full" },
  "/app/command/roster": { HOSPITAL_ADMIN: "Full", ADMIN: "Full", CLINIC_ADMIN: "Full" },
  "/app/doctor": { DOCTOR: "Full" },
  "/app/ipd": { DOCTOR: "Full", NURSE: "Full", HOSPITAL_ADMIN: "Read-only", ADMIN: "Read-only", CLINIC_ADMIN: "Read-only" },
  "/app/casualty": { STAT_NURSE: "Full", NURSE: "Full", DOCTOR: "Read-only" },
  "/app/casualty/triage": { STAT_NURSE: "Full", NURSE: "Full", DOCTOR: "Read-only" },
  "/app/casualty/bays": { STAT_NURSE: "Full", NURSE: "Full", DOCTOR: "Read-only" },
  "/app/casualty/register": { STAT_NURSE: "Full" },
  "/app/nurse-calls": { NURSE: "Full" },
  "/app/pos": { CASHIER: "Full", CLINIC_ADMIN: "Full" },
  "/app/inventory": { HOSPITAL_ADMIN: "Full", ADMIN: "Full", CLINIC_ADMIN: "Full", CASHIER: "Read-only" },
  "/app/procurement": { SUPER_ADMIN: "Read-only", OWNER: "Read-only", HOSPITAL_ADMIN: "Full", ADMIN: "Full", CLINIC_ADMIN: "Full" },
  "/app/procurement/grn": { SUPER_ADMIN: "Read-only", OWNER: "Read-only", HOSPITAL_ADMIN: "Full", ADMIN: "Full", CLINIC_ADMIN: "Full", CASHIER: "Full" },
  "/app/ca": { SUPER_ADMIN: "Full", OWNER: "Full", HOSPITAL_ADMIN: "Read-only", ADMIN: "Read-only" },
  "/app/swarm": { SUPER_ADMIN: "Full", HOSPITAL_ADMIN: "Read-only" },
  "/app/prune": { SUPER_ADMIN: "Full", HOSPITAL_ADMIN: "Read-only" },
  "/app/prune/cache": { SUPER_ADMIN: "Full", HOSPITAL_ADMIN: "Read-only" },
  "/app/prune/waf": { SUPER_ADMIN: "Full", HOSPITAL_ADMIN: "Read-only" },
  "/app/prune/redaction": { SUPER_ADMIN: "Full" },
  "/app/ayush": { DOCTOR: "Full" },
  "/app/home": { PATIENT: "Full" },
  "/app/doctor/soap": { DOCTOR: "Full" },
  "/app/doctor/coding": { DOCTOR: "Full" },
  "/app/doctor/rx": { DOCTOR: "Full" },
  "/app/doctor/cbc": { DOCTOR: "Full" },
  "/app/doctor/disposition": { DOCTOR: "Full" },
  "/app/inventory/expiry": { HOSPITAL_ADMIN: "Full", CLINIC_ADMIN: "Full", CASHIER: "Read-only" },
  "/app/inventory/transfers": { HOSPITAL_ADMIN: "Full", CLINIC_ADMIN: "Full", CASHIER: "Read-only" },
  "/app/inventory/import": { HOSPITAL_ADMIN: "Full", CLINIC_ADMIN: "Full" },
  "/app/procurement/suppliers": { SUPER_ADMIN: "Read-only", HOSPITAL_ADMIN: "Full", CLINIC_ADMIN: "Full" },
  "/app/procurement/orders": { SUPER_ADMIN: "Read-only", HOSPITAL_ADMIN: "Full", CLINIC_ADMIN: "Full" },
  "/app/ca/ledger": { SUPER_ADMIN: "Full", HOSPITAL_ADMIN: "Read-only" },
  "/app/ca/pnl": { SUPER_ADMIN: "Full", HOSPITAL_ADMIN: "Read-only" },
  "/app/ca/balance-sheet": { SUPER_ADMIN: "Full", HOSPITAL_ADMIN: "Read-only" },
  "/app/ca/brs": { SUPER_ADMIN: "Full", HOSPITAL_ADMIN: "Read-only" },
  "/app/ca/audit": { SUPER_ADMIN: "Full", HOSPITAL_ADMIN: "Read-only" },
  "/app/home/thread": { PATIENT: "Full" },
  "/app/home/check-in": { PATIENT: "Full" },
  "/app/home/drift": { PATIENT: "Full" },
  "/app/home/refill": { PATIENT: "Full" },
  "/app/home/prescriptions": { PATIENT: "Full" },
  "/app/home/her": { PATIENT: "Full" },
  "/app/home/vitalis": { PATIENT: "Full" },
  "/app/home/yoga": { PATIENT: "Full" },
  "/app/home/prakriti": { PATIENT: "Full" },
  "/app/command/setup": { HOSPITAL_ADMIN: "Full" },
  "/app/command/earnings": { HOSPITAL_ADMIN: "Full" },
  "/app/command/clinics": { HOSPITAL_ADMIN: "Full", CLINIC_ADMIN: "Full" },
  "/app/command/hospitals": { SUPER_ADMIN: "Full" },
  "/app/command/settings": { SUPER_ADMIN: "Full", HOSPITAL_ADMIN: "Full", CLINIC_ADMIN: "Full" },
  "/app/command/billing": { SUPER_ADMIN: "Full", HOSPITAL_ADMIN: "Full", CLINIC_ADMIN: "Full" },
} satisfies Record<string, Partial<Record<JeevikaRole, AccessLevel>>>;

export type AppRoute = keyof typeof routePermissions;
const permissionsByRoute = new Map<string, Partial<Record<JeevikaRole, AccessLevel>>>(Object.entries(routePermissions));

export function normalizeJeevikaRole(role: string | null | undefined): JeevikaRole | null {
  if (!role) return null;
  if (role === "OWNER") return "OWNER";
  if (role === "ADMIN") return "ADMIN";
  if (role === "CLINIC_STAFF") return "CLINIC_STAFF";
  if (["SUPER_ADMIN", "HOSPITAL_ADMIN", "CLINIC_ADMIN", "DOCTOR", "NURSE", "STAT_NURSE", "CASHIER", "PATIENT"].includes(role)) {
    return role as JeevikaRole;
  }
  return null;
}

export function routeAccess(route: string, role: string | null | undefined): AccessLevel {
  const normalized = normalizeJeevikaRole(role);
  if (!normalized) return "None";
  return permissionsByRoute.get(route)?.[normalized] ?? "None";
}

export function landingRoute(role: string | null | undefined): string {
  const normalized = normalizeJeevikaRole(role);
  switch (normalized) {
    case "SUPER_ADMIN":
    case "OWNER":
    case "HOSPITAL_ADMIN":
    case "ADMIN":
    case "CLINIC_ADMIN":
      return "/app/command";
    case "DOCTOR":
      return "/app/doctor";
    case "NURSE":
      return "/app/ipd";
    case "STAT_NURSE":
      return "/app/casualty/triage";
    case "CASHIER":
      return "/app/pos";
    case "PATIENT":
      return "/app/home";
    default:
      return "/login";
  }
}

const staffViewRoutes = {
  admin: "/app/command",
  expenses: "/app/command/expenses",
  equipments: "/app/command/equipment",
  "shift-management": "/app/command/roster",
  setup: "/app/command/setup",
  hospitals: "/app/command/hospitals",
  "clinic-admin": "/app/command/clinics",
  earnings: "/app/command/earnings",
  billing: "/app/command/billing",
  settings: "/app/command/settings",
  "doctor-consultation": "/app/doctor",
  "emergency-triage": "/app/casualty",
  ipd: "/app/ipd",
  pos: "/app/pos",
  "inventory-dashboard": "/app/inventory",
  "medicine-migration": "/app/inventory/import",
  "procurement-grn": "/app/procurement/grn",
  procurement: "/app/procurement",
  "ca-suite": "/app/ca",
  audit_logs: "/app/ca/audit",
  "nurse-calls": "/app/nurse-calls",
  "maritime-agents": "/app/swarm",
  "prune-gateway": "/app/prune",
  "ayush-center": "/app/ayush",
} as const satisfies Record<string, AppRoute>;

export type StaffView = keyof typeof staffViewRoutes;
const legacyRosterViews = new Set(["staff", "attendance"]);
const pathViews = {
  "/app/command/network": "admin",
  "/app/command/census": "admin",
  "/app/command/optimizer": "admin",
  "/app/doctor/soap": "doctor-consultation",
  "/app/doctor/coding": "doctor-consultation",
  "/app/doctor/rx": "doctor-consultation",
  "/app/doctor/cbc": "doctor-consultation",
  "/app/doctor/disposition": "doctor-consultation",
  "/app/casualty/triage": "emergency-triage",
  "/app/casualty/bays": "emergency-triage",
  "/app/casualty/register": "emergency-triage",
  "/app/inventory/expiry": "inventory-dashboard",
  "/app/inventory/transfers": "inventory-dashboard",
  "/app/procurement/suppliers": "procurement",
  "/app/procurement/orders": "procurement",
  "/app/ca/ledger": "ca-suite",
  "/app/ca/pnl": "ca-suite",
  "/app/ca/balance-sheet": "ca-suite",
  "/app/ca/brs": "ca-suite",
  "/app/prune/cache": "prune-gateway",
  "/app/prune/waf": "prune-gateway",
  "/app/prune/redaction": "prune-gateway",
} satisfies Partial<Record<AppRoute, StaffView>>;

const routeByView = new Map<string, AppRoute>(Object.entries(staffViewRoutes));
const viewByRoute = new Map<string, StaffView>(
  (Object.keys(staffViewRoutes) as StaffView[]).map((view) => [staffViewRoutes[view], view]),
);
for (const [path, view] of Object.entries(pathViews)) viewByRoute.set(path, view);

export function staffRouteForView(name: string, role: string | null): AppRoute | null {
  const key = legacyRosterViews.has(name) ? "shift-management" : name;
  const route = routeByView.get(key);
  if (!route) return null;
  return routeAccess(route, role) === "None" ? null : route;
}

export function staffViewForRoute(path: string, role: string | null): StaffView | null {
  if (routeAccess(path, role) === "None") return null;
  return viewByRoute.get(path) ?? null;
}

export type StaffNavItem = {
  id: string;
  icon: string;
  label: string;
  view: string;
  route: AppRoute;
};

export function staffNavItems(role: string | null | undefined): StaffNavItem[] {
  const normalized = normalizeJeevikaRole(role);
  switch (normalized) {
    case "SUPER_ADMIN":
    case "OWNER":
      return [
        { id: "command", icon: "domain", label: "Command Center", view: "admin", route: "/app/command" },
        { id: "ca", icon: "account_balance", label: "CA & Audit Vault", view: "ca-suite", route: "/app/ca" },
        { id: "procurement", icon: "shopping_cart_checkout", label: "Procurement", view: "procurement", route: "/app/procurement" },
        { id: "swarm", icon: "hub", label: "Swarm Mesh", view: "maritime-agents", route: "/app/swarm" },
        { id: "prune", icon: "shield", label: "Prune Gateway", view: "prune-gateway", route: "/app/prune" },
      ];
    case "HOSPITAL_ADMIN":
    case "ADMIN":
      return [
        { id: "command", icon: "domain", label: "Command Center", view: "admin", route: "/app/command" },
        { id: "ipd", icon: "hotel", label: "IPD", view: "ipd", route: "/app/ipd" },
        { id: "inventory", icon: "inventory", label: "Inventory", view: "inventory-dashboard", route: "/app/inventory" },
        { id: "procurement", icon: "shopping_cart_checkout", label: "Procurement", view: "procurement", route: "/app/procurement" },
        { id: "ca", icon: "account_balance", label: "CA — Read-only", view: "ca-suite", route: "/app/ca" },
        { id: "expenses", icon: "receipt_long", label: "Expenses", view: "expenses", route: "/app/command/expenses" },
        { id: "equipment", icon: "construction", label: "Equipment", view: "equipments", route: "/app/command/equipment" },
        { id: "roster", icon: "calendar_today", label: "Roster", view: "shift-management", route: "/app/command/roster" },
        { id: "swarm", icon: "hub", label: "Swarm — Read-only", view: "maritime-agents", route: "/app/swarm" },
        { id: "prune", icon: "shield", label: "Prune — Read-only", view: "prune-gateway", route: "/app/prune" },
      ];
    case "CLINIC_ADMIN":
      return [
        { id: "command", icon: "domain", label: "Clinic Operations", view: "admin", route: "/app/command" },
        { id: "roster", icon: "calendar_today", label: "Roster", view: "shift-management", route: "/app/command/roster" },
        { id: "ipd", icon: "hotel", label: "IPD", view: "ipd", route: "/app/ipd" },
        { id: "pos", icon: "point_of_sale", label: "POS", view: "pos", route: "/app/pos" },
        { id: "inventory", icon: "inventory", label: "Inventory", view: "inventory-dashboard", route: "/app/inventory" },
        { id: "procurement", icon: "shopping_cart_checkout", label: "Procurement", view: "procurement", route: "/app/procurement" },
      ];
    case "DOCTOR":
      return [
        { id: "doctor", icon: "stethoscope", label: "OPD Cockpit", view: "doctor-consultation", route: "/app/doctor" },
        { id: "ipd", icon: "hotel", label: "IPD", view: "ipd", route: "/app/ipd" },
        { id: "casualty", icon: "emergency", label: "Casualty", view: "emergency-triage", route: "/app/casualty" },
        { id: "ayush", icon: "spa", label: "AYUSH", view: "ayush-center", route: "/app/ayush" },
      ];
    case "NURSE":
      return [
        { id: "ipd", icon: "hotel", label: "IPD", view: "ipd", route: "/app/ipd" },
        { id: "casualty", icon: "emergency", label: "Casualty", view: "emergency-triage", route: "/app/casualty" },
        { id: "nurse-calls", icon: "call", label: "Nurse Call Queue", view: "nurse-calls", route: "/app/nurse-calls" },
      ];
    case "STAT_NURSE":
      return [
        { id: "casualty", icon: "emergency", label: "Casualty", view: "emergency-triage", route: "/app/casualty" },
      ];
    case "CASHIER":
    case "CLINIC_STAFF":
      return [
        { id: "pos", icon: "point_of_sale", label: "Pharmacy POS", view: "pos", route: "/app/pos" },
        { id: "inventory", icon: "inventory", label: "Inventory — Read-only", view: "inventory-dashboard", route: "/app/inventory" },
        { id: "grn", icon: "local_shipping", label: "GRN", view: "procurement-grn", route: "/app/procurement/grn" },
      ];
    default:
      return [];
  }
}
