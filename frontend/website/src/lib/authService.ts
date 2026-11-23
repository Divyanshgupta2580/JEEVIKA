import { loginResponseSchema, principalSchema, type Principal } from "../../../../packages/shared/integration";
import { closeDataSocket } from "./dataSocket";
import { CLOUDFLARE_API_BASE } from './api';

export interface AuthService {
    signIn: (email: string, pass: string) => Promise<any>;
    signUp: (email: string, pass: string, data?: any) => Promise<any>;
    signOut: () => Promise<void>;
    onAuthStateChange: (callback: (user: any, event?: string) => void) => () => void;
    resetPassword: (email: string) => Promise<void>;
    updatePassword: (password: string) => Promise<void>;
    getSession: () => Promise<any>;
}

class CloudflareAuthService implements AuthService {
    private verifiedToken?: string;
    private verifiedPrincipal?: Principal;
    private expires?: ReturnType<typeof setTimeout>;

    private getLocalSession() {
        try {
            const stored = loginResponseSchema.safeParse(JSON.parse(localStorage.getItem('cf_auth_session') ?? 'null'));
            return stored.success && Date.parse(stored.data.expiresAt) > Date.now() ? stored.data : null;
        } catch {
            return null;
        }
    }

    private user(principal: Principal, email?: string) {
        return { id: principal.userId, email, role: principal.role, clinicId: principal.clinicId };
    }

    private async revoke(token: string) {
        closeDataSocket(token);
        await fetch(`${CLOUDFLARE_API_BASE}/auth/logout`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
    }

    private scheduleExpiry(token: string, expiresAt: string, principal: Principal) {
        clearTimeout(this.expires);
        this.verifiedToken = token;
        this.verifiedPrincipal = principal;
        this.expires = setTimeout(() => {
            if (this.verifiedToken === token) {
                this.verifiedToken = undefined;
                this.verifiedPrincipal = undefined;
                closeDataSocket(token);
                localStorage.removeItem('cf_auth_session');
                window.dispatchEvent(new CustomEvent('cf_auth_change', { detail: { session: null } }));
            }
        }, Math.max(0, Date.parse(expiresAt) - Date.now()));
    }

    async signIn(email: string, password: string) {
        const response = await fetch(`${CLOUDFLARE_API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: import.meta.env.VITE_STAFF_ORG_ID || 'demo', email, password })
        });
        if (!response.ok) {
            throw new Error(response.status === 401 ? 'Invalid email or password.' : 'Staff login is unavailable.');
        }
        const session = loginResponseSchema.parse(await response.json());
        localStorage.setItem('cf_auth_session', JSON.stringify(session));
        this.scheduleExpiry(session.token, session.expiresAt, session.principal);
        const user = this.user(session.principal, email);
        window.dispatchEvent(new CustomEvent('cf_auth_change', { detail: { session: { user } } }));
        return user;
    }

    async signUp(_email: string, _pass: string) {
        throw new Error('Staff self-registration is unavailable.');
    }

    async signOut() {
        const token = this.verifiedToken ?? this.getLocalSession()?.token;
        clearTimeout(this.expires);
        this.verifiedToken = undefined;
        this.verifiedPrincipal = undefined;
        localStorage.removeItem('cf_auth_session');
        window.dispatchEvent(new CustomEvent('cf_auth_change', { detail: { session: null } }));
        if (token) await this.revoke(token);
    }

    onAuthStateChange(callback: (user: unknown, event?: string) => void) {
        const handler = (event: Event) => {
            if (event instanceof CustomEvent) {
                callback(event.detail?.session?.user ?? null, 'AUTH_CHANGE');
            }
        };
        window.addEventListener('cf_auth_change', handler);
        return () => window.removeEventListener('cf_auth_change', handler);
    }

    async resetPassword(_email: string) {
        // Password reset notification
    }

    async updatePassword(_password: string) {
        // Password update notification
    }

    async getSession() {
        const session = this.getLocalSession();
        if (!session) return null;
        if (session.token !== this.verifiedToken) {
            const response = await fetch(`${CLOUDFLARE_API_BASE}/auth/me`, {
                headers: { Authorization: `Bearer ${session.token}` },
                cache: 'no-store',
                signal: AbortSignal.timeout(10000)
            });
            if (!response.ok || this.getLocalSession()?.token !== session.token) return null;
            session.principal = principalSchema.parse(await response.json());
            if (this.getLocalSession()?.token !== session.token) return null;
            this.scheduleExpiry(session.token, session.expiresAt, session.principal);
        }
        return this.verifiedPrincipal ? { user: this.user(this.verifiedPrincipal), access_token: session.token } : null;
    }

}

export const authService: AuthService = new CloudflareAuthService();
