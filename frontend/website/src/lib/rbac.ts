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

export type AppRoute =
  | "/app"
  | "/app/command"
  | "/app/command/network"
  | "/app/command/census"
  | "/app/command/optimizer"
  | "/app/command/expenses"
  | "/app/command/equipment"
  | "/app/command/roster"
  | "/app/doctor"
  | "/app/ipd"
  | "/app/casualty"
  | "/app/casualty/triage"
  | "/app/casualty/bays"
  | "/app/casualty/register"
  | "/app/nurse-calls"
  | "/app/pos"
  | "/app/inventory"
  | "/app/procurement"
  | "/app/procurement/grn"
  | "/app/ca"
  | "/app/swarm"
  | "/app/prune"
  | "/app/prune/cache"
  | "/app/prune/waf"
  | "/app/prune/redaction"
  | "/app/ayush"
  | "/app/home";

const routePermissions: Partial<Record<AppRoute, Partial<Record<JeevikaRole, AccessLevel>>>> = {
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
};

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

export function routeAccess(route: AppRoute, role: string | null | undefined): AccessLevel {
  const normalized = normalizeJeevikaRole(role);
  if (!normalized) return "None";
  return routePermissions[route]?.[normalized] ?? "None";
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
        { id: "swarm", icon: "hub", label: "Swarm — Read-only", view: "maritime-agents", route: "/app/swarm" },
        { id: "prune", icon: "shield", label: "Prune — Read-only", view: "prune-gateway", route: "/app/prune" },
      ];
    case "CLINIC_ADMIN":
      return [
        { id: "command", icon: "domain", label: "Clinic Operations", view: "admin", route: "/app/command" },
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
