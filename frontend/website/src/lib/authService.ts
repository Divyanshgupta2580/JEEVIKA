import { loginResponseSchema, principalSchema, type Principal } from "../../../../packages/shared/integration";
import { closeDataSocket } from "./dataSocket";
import { CLOUDFLARE_API_BASE } from "./api";

const sessionKey = "cf_auth_session";
const authChange = "cf_auth_change";
export const cbcSessionKey = "jeevika.cbc.doctor-session.v1";

export type StaffUser = {
    id: string;
    email?: string;
    role: Exclude<Principal["role"], "PATIENT">;
    clinicId: string;
    orgId: string;
};

type StaffSession = { user: StaffUser; access_token: string };

class CloudflareAuthService {
    private verified?: { token: string; user: StaffUser };
    private expires?: ReturnType<typeof setTimeout>;

    private getLocalSession() {
        try {
            const value = loginResponseSchema.safeParse(JSON.parse(localStorage.getItem(sessionKey) ?? "null"));
            return value.success ? value.data : null;
        } catch {
            return null;
        }
    }

    private user(principal: Principal, email?: string): StaffUser | null {
        if (principal.role === "PATIENT") return null;
        return {
            id: principal.userId,
            email,
            role: principal.role,
            clinicId: principal.clinicId,
            orgId: principal.orgId,
        };
    }

    private publish(user: StaffUser | null) {
        if (!user) sessionStorage.removeItem(cbcSessionKey);
        window.dispatchEvent(new CustomEvent(authChange, {
            detail: { session: user ? { user } : null },
        }));
    }

    private clearVerifiedSession() {
        clearTimeout(this.expires);
        if (this.verified) closeDataSocket(this.verified.token);
        this.verified = undefined;
    }

    invalidateSession(token: string) {
        // A response belonging to a previous login must never clear a newer one.
        const stored = this.getLocalSession();
        if (stored?.token !== token) return;
        this.clearVerifiedSession();
        localStorage.removeItem(sessionKey);
        this.publish(null);
    }

    private remember(token: string, expiresAt: string, user: StaffUser) {
        clearTimeout(this.expires);
        this.verified = { token, user };
        this.expires = setTimeout(() => this.invalidateSession(token),
            Math.min(2_147_483_647, Math.max(0, Date.parse(expiresAt) - Date.now())));
    }

    async signIn(email: string, password: string) {
        const response = await fetch(`${CLOUDFLARE_API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orgId: import.meta.env.VITE_STAFF_ORG_ID || "demo", email, password }),
        });
        if (!response.ok) {
            throw new Error(response.status === 401 ? "Invalid email or password." : "Staff login is unavailable.");
        }
        const session = loginResponseSchema.parse(await response.json());
        const user = this.user(session.principal, email);
        if (!user || Date.parse(session.expiresAt) <= Date.now()) throw new Error("A valid staff session is required.");
        this.clearVerifiedSession();
        sessionStorage.removeItem(cbcSessionKey);
        localStorage.setItem(sessionKey, JSON.stringify(session));
        this.remember(session.token, session.expiresAt, user);
        this.publish(user);
        return user;
    }

    async signUp(_email: string, _pass: string, _data?: unknown): Promise<StaffUser> {
        throw new Error("Staff self-registration is unavailable.");
    }

    async signOut() {
        const token = this.getLocalSession()?.token ?? this.verified?.token;
        this.clearVerifiedSession();
        localStorage.removeItem(sessionKey);
        this.publish(null);
        if (token) {
            await fetch(`${CLOUDFLARE_API_BASE}/auth/logout`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            }).catch(() => {});
        }
    }

    onAuthStateChange(callback: (user: StaffUser | null, event?: string) => void) {
        let active = true;
        const handler = (event: Event) => {
            if (event instanceof CustomEvent) callback(this.verified?.user ?? null, "AUTH_CHANGE");
        };
        const storageChanged = (event: StorageEvent) => {
            if (event.storageArea !== localStorage || (event.key !== sessionKey && event.key !== null)) return;
            const token = this.getLocalSession()?.token;
            if (token === this.verified?.token && token) return;
            this.clearVerifiedSession();
            this.publish(null);
            if (token) {
                void this.getSession().then((session) => {
                    if (active && session?.access_token === token && this.getLocalSession()?.token === token) {
                        this.publish(session.user);
                    }
                }).catch(() => {});
            }
        };
        const revalidate = () => {
            if (this.verified) void this.getSession(true).catch(() => {});
        };
        window.addEventListener(authChange, handler);
        window.addEventListener("storage", storageChanged);
        window.addEventListener("focus", revalidate);
        return () => {
            active = false;
            window.removeEventListener(authChange, handler);
            window.removeEventListener("storage", storageChanged);
            window.removeEventListener("focus", revalidate);
        };
    }

    async resetPassword(_email: string) {
        // Password reset notification
    }

    async updatePassword(_password: string) {
        // Password update notification
    }

    async getSession(revalidate = false): Promise<StaffSession | null> {
        const session = this.getLocalSession();
        if (!session) return null;
        if (Date.parse(session.expiresAt) <= Date.now()) {
            this.invalidateSession(session.token);
            return null;
        }
        const known = this.verified?.token === session.token ? this.verified.user : undefined;
        if (known && !revalidate) return { user: known, access_token: session.token };

        const response = await fetch(`${CLOUDFLARE_API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${session.token}` },
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
        });
        if (response.status === 401) this.invalidateSession(session.token);
        if (!response.ok || this.getLocalSession()?.token !== session.token) return null;
        const user = this.user(principalSchema.parse(await response.json()), known?.email);
        if (this.getLocalSession()?.token !== session.token) return null;
        if (!user || Date.parse(session.expiresAt) <= Date.now()) {
            this.invalidateSession(session.token);
            return null;
        }
        this.remember(session.token, session.expiresAt, user);
        if (known && (
            known.id !== user.id || known.role !== user.role ||
            known.clinicId !== user.clinicId || known.orgId !== user.orgId
        )) {
            sessionStorage.removeItem(cbcSessionKey);
            this.publish(user);
        }
        return { user, access_token: session.token };
    }
}

export const authService = new CloudflareAuthService();
