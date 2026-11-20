import { useLocation } from "react-router-dom";
import { useState } from 'react'
import { authService as auth } from '@/lib/authService'
import { Button, Input, PasswordInput, Label } from '@/components/ui/basic'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/basic'
import { 
    Lock, Mail, Loader2, AlertCircle, ArrowRight,
    Building2, Stethoscope, ShieldAlert, Activity, User, 
    Zap, CheckCircle2, Shield, KeyRound, ExternalLink, Sparkles
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'

type AuthTab = 'roles' | 'credentials'

interface PortalProfile {
    id: string
    role: 'HOSPITAL_ADMIN' | 'DOCTOR' | 'CLINIC_ADMIN' | 'NURSE' | 'PATIENT' | 'SUPER_ADMIN'
    view: string
    title: string
    subtitle: string
    persona: string
    icon: typeof Building2
    badge: string
    accent: string
    border: string
    bgPill: string
    highlights: string[]
}

const PORTAL_PROFILES: PortalProfile[] = [
    {
        id: 'hq-admin',
        role: 'HOSPITAL_ADMIN',
        view: 'admin',
        title: 'HQ Command Center',
        subtitle: 'Multi-Clinic Hospital Network',
        persona: 'Chief Medical Officer & Superintendent',
        icon: Building2,
        badge: 'HQ Executive',
        accent: 'from-blue-600 to-indigo-700',
        border: 'border-blue-200 hover:border-blue-500 hover:shadow-blue-500/10',
        bgPill: 'bg-blue-50 text-blue-700 border-blue-200',
        highlights: ['Multi-Clinic Registry', 'Central Rebalancing', 'Cryptographic Audit Lock']
    },
    {
        id: 'doctor-opd',
        role: 'DOCTOR',
        view: 'doctor-consultation',
        title: 'Doctor Clinical Cockpit',
        subtitle: 'OPD Consultation & Decision Support',
        persona: 'Senior Consultant Physician, MD',
        icon: Stethoscope,
        badge: 'Doctor OPD',
        accent: 'from-teal-600 to-emerald-700',
        border: 'border-teal-200 hover:border-teal-500 hover:shadow-teal-500/10',
        bgPill: 'bg-teal-50 text-teal-700 border-teal-200',
        highlights: ['AI SOAP Audio Citations', 'ICD-11 & NAMASTE Curation', 'Jan Aushadhi 88% Savings']
    },
    {
        id: 'nurse-ipd',
        role: 'NURSE',
        view: 'ipd',
        title: 'Inpatient Ward & Bedside SOS',
        subtitle: 'IPD Monitoring & STAT Alerts',
        persona: 'Ward Lead Nurse, RN (STAT Lead)',
        icon: Activity,
        badge: 'Ward Inpatient',
        accent: 'from-cyan-600 to-blue-700',
        border: 'border-cyan-200 hover:border-cyan-500 hover:shadow-cyan-500/10',
        bgPill: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        highlights: ['Bedside SOS Distress & RRS', 'Crash Cart STAT Alert', 'Real-time Vital Trend']
    },
    {
        id: 'nurse-stat',
        role: 'NURSE',
        view: 'emergency-triage',
        title: 'Nurse STAT Emergency Triage',
        subtitle: 'Life-Critical Casualty Resuscitation',
        persona: 'Casualty Resuscitation Lead Nurse',
        icon: ShieldAlert,
        badge: 'Emergency Triage',
        accent: 'from-rose-600 to-red-700',
        border: 'border-rose-200 hover:border-rose-500 hover:shadow-rose-500/10',
        bgPill: 'bg-rose-50 text-rose-700 border-rose-200',
        highlights: ['<15ms Sentinel Guarantee', 'Casualty Bays 1-4', 'Cardiac / Reflux Interceptor']
    },
    {
        id: 'clinic-hub',
        role: 'CLINIC_ADMIN',
        view: 'clinic-admin',
        title: 'Clinic Operations Hub',
        subtitle: 'Single Clinic Management & POS',
        persona: 'Clinic Operations Manager',
        icon: Zap,
        badge: 'Clinic Operations',
        accent: 'from-sky-600 to-blue-700',
        border: 'border-sky-200 hover:border-sky-500 hover:shadow-sky-500/10',
        bgPill: 'bg-sky-50 text-sky-700 border-sky-200',
        highlights: ['Billing & Loose Tablets', 'Drift Radar FEFO Alerts', 'Staff Shift Rosters']
    },
    {
        id: 'patient-kiosk',
        role: 'PATIENT',
        view: 'patient-kiosk',
        title: 'Patient Self-Service Kiosk',
        subtitle: 'Multilingual Check-In & Token',
        persona: 'Ramesh Chandra (ABHA Check-In)',
        icon: User,
        badge: 'Patient Self-Service',
        accent: 'from-amber-600 to-orange-700',
        border: 'border-amber-200 hover:border-amber-500 hover:shadow-amber-500/10',
        bgPill: 'bg-amber-50 text-amber-700 border-amber-200',
        highlights: ['6 Indian Languages', '14-Digit ABHA Formatting', 'PM-JAY ₹5L Cashless Slip']
    },
    {
        id: 'ca-suite',
        role: 'SUPER_ADMIN',
        view: 'admin',
        title: 'CA Financial & Audit Suite',
        subtitle: 'Tax Compliance & Ledger Locks',
        persona: 'Chief Medical Registrar & Group CA',
        icon: Shield,
        badge: 'Finance & Compliance',
        accent: 'from-indigo-700 to-purple-800',
        border: 'border-indigo-200 hover:border-indigo-500 hover:shadow-indigo-500/10',
        bgPill: 'bg-purple-50 text-purple-700 border-purple-200',
        highlights: ['P&L, Balance Sheet, Ledger Locks', 'Bank Reconciliation (BRS)', 'Multi-Hospital SaaS Superadmin']
    }
]

const DEMO_CREDENTIAL_PILLS = [
    { label: 'Doctor', email: 'doctor@jeevika.in', role: 'Senior Physician' },
    { label: 'Nurse', email: 'nurse.triage@jeevika.in', role: 'Ward / STAT Nurse' },
    { label: 'HQ Admin', email: 'admin@jeevika.in', role: 'Superintendent' },
    { label: 'Super Admin', email: 'superadmin@jeevika.in', role: 'Platform Registrar' }
]

export function LoginPage() {
    const [activeTab, setActiveTab] = useState<AuthTab>('roles')
    const [isForgotMode, setIsForgotMode] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loadingTarget, setLoadingTarget] = useState<string | null>(null)
    const [manualLoading, setManualLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { toast } = useToast()
    const location = useLocation()

    // 1-Click Direct Portal Access
    const handleDirectLogin = async (
        role: PortalProfile['role'],
        targetView: string,
        label: string
    ) => {
        const targetKey = `${role}-${targetView}`
        setLoadingTarget(targetKey)
        setError(null)
        try {
            localStorage.setItem('lastActiveView', targetView)
            await auth.signInDemo(role as any)
            toast({
                title: 'Instant Portal Access Granted',
                description: `Authenticated as ${label}. Entering workspace...`,
                className: 'bg-emerald-50 border-emerald-200 text-emerald-900'
            })
            if (targetView === 'patient-kiosk') {
                window.location.hash = '#/kiosk'
            } else {
                window.location.hash = `#/app?view=${targetView}`
            }
        } catch (err: any) {
            setError(err.message || 'Direct login failed')
        } finally {
            setLoadingTarget(null)
        }
    }

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setManualLoading(true)
        setError(null)

        try {
            if (isForgotMode) {
                await auth.resetPassword(email)
                toast({
                    title: 'Recovery Link Sent',
                    description: 'Check your email for the password reset link.',
                    className: 'bg-green-50 border-green-200 text-green-900'
                })
                setIsForgotMode(false)
            } else {
                const user = await auth.signIn(email.trim(), password)
                const targetView = user.role === 'DOCTOR' ? 'doctor-consultation'
                    : user.role === 'NURSE' ? 'ipd'
                        : user.role === 'CASHIER' ? 'pos' : 'admin'
                localStorage.setItem('lastActiveView', targetView)
                const from = location.state?.from
                const target = from?.pathname === '/kiosk' || /^\/app(?:\/|$)/.test(from?.pathname ?? '')
                    ? from.pathname + (from.search ?? '') + (from.hash ?? '')
                    : `/app?view=${targetView}`
                toast({
                    title: 'Authentication Successful',
                    description: `Signed in as ${email}. Entering workspace...`,
                    className: 'bg-emerald-50 border-emerald-200 text-emerald-900'
                })
                window.location.hash = `#${target}`
            }
        } catch (err: any) {
            console.error("Auth Error:", err)
            setError(err.message || 'An unexpected error occurred')
            toast({
                title: 'Authentication Failed',
                description: err.message,
                variant: 'destructive',
            })
        } finally {
            setManualLoading(false)
        }
    }

    const handleFillDemoCreds = (demoEmail: string) => {
        setEmail(demoEmail)
        setPassword('Jeevika@2026!')
        setError(null)
    }

    return (
        <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] right-[-10%] w-[550px] h-[550px] bg-blue-100/60 rounded-full blur-[130px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[550px] h-[550px] bg-emerald-100/50 rounded-full blur-[130px] pointer-events-none" />

            {/* Navigation Bar / Public Overview Link */}
            <div className="w-full max-w-7xl mx-auto flex items-center justify-between z-10 pt-2 pb-6">
                <div className="flex items-center gap-3">
                    <img
                        src="/assets/logo-jeevika.png"
                        alt="Jeevika Healthcare"
                        className="h-10 sm:h-11 w-auto object-contain"
                    />
                    <div className="hidden sm:block border-l border-slate-200 pl-3">
                        <span className="text-xs font-bold text-slate-700 tracking-tight uppercase">Hospital Operating System</span>
                        <p className="text-[11px] text-slate-500 font-medium">Enterprise Clinical & Ops Suite</p>
                    </div>
                </div>

                <a
                    href="#/landing"
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white/90 backdrop-blur px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs hover:shadow-sm transition-all"
                >
                    <span>Public Overview</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                </a>
            </div>

            {/* Main Content Area */}
            <div className="w-full max-w-7xl mx-auto space-y-8 z-10 my-auto py-4">
                {/* Hero Header */}
                <div className="text-center space-y-3 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-full text-blue-800 text-xs font-bold tracking-wide shadow-xs">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>PROTECTED CLINICAL ACCESS • ROLE-BASED ACCESS CONTROL</span>
                    </div>

                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                        Sign In to JEEVIKA Healthcare
                    </h1>
                    <p className="text-slate-600 text-xs sm:text-sm md:text-base leading-relaxed">
                        Access hospital headquarters, OPD clinician cockpits, inpatient ward SOS, casualty triage sentry, or pharmacy POS terminals.
                    </p>

                    {/* Segmented Tab Switcher */}
                    <div className="pt-2 flex justify-center">
                        <div className="inline-flex p-1 bg-slate-200/80 rounded-2xl shadow-inner border border-slate-300/60 max-w-md w-full">
                            <button
                                type="button"
                                onClick={() => setActiveTab('roles')}
                                className={`flex-1 py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                    activeTab === 'roles'
                                        ? 'bg-white text-slate-900 shadow-md'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                                <span>1-Click Role Access</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('credentials')}
                                className={`flex-1 py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                    activeTab === 'credentials'
                                        ? 'bg-white text-slate-900 shadow-md'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <KeyRound className="w-4 h-4 text-blue-600" />
                                <span>Staff Credentials</span>
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <Alert variant="destructive" className="max-w-xl mx-auto bg-red-50 border-red-200 text-red-800 shadow-sm">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* TAB 1: 1-CLICK ROLE ACCESS CARDS */}
                {activeTab === 'roles' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 animate-in fade-in duration-200">
                        {PORTAL_PROFILES.map((portal) => {
                            const Icon = portal.icon
                            const targetKey = `${portal.role}-${portal.view}`
                            const isThisLoading = loadingTarget === targetKey

                            return (
                                <div
                                    key={portal.id}
                                    onClick={() => !loadingTarget && handleDirectLogin(portal.role, portal.view, portal.title)}
                                    className={`relative group bg-white/95 backdrop-blur-md rounded-2xl border ${portal.border} p-5 sm:p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer active:scale-[0.99]`}
                                >
                                    <div className="space-y-3.5">
                                        {/* Card Header & Icon */}
                                        <div className="flex items-start justify-between">
                                            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${portal.accent} flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform`}>
                                                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${portal.bgPill}`}>
                                                {portal.badge}
                                            </span>
                                        </div>

                                        {/* Titles */}
                                        <div>
                                            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
                                                {portal.title}
                                            </h3>
                                            <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                                {portal.subtitle}
                                            </p>
                                            <div className="mt-2.5 py-1 px-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                                <span className="truncate">{portal.persona}</span>
                                            </div>
                                        </div>

                                        {/* Key Capabilities */}
                                        <div className="space-y-1.5 pt-1">
                                            {portal.highlights.map((h, i) => (
                                                <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                    <span className="truncate">{h}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <div className="mt-5 pt-3.5 border-t border-slate-100">
                                        <button
                                            type="button"
                                            disabled={!!loadingTarget}
                                            className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs ${
                                                isThisLoading
                                                    ? 'bg-slate-100 text-slate-400'
                                                    : `bg-gradient-to-r ${portal.accent} text-white group-hover:opacity-95 group-hover:shadow-md`
                                            }`}
                                        >
                                            {isThisLoading ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                                                    <span>Connecting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Launch Portal</span>
                                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* TAB 2: STAFF CREDENTIALS FORM */}
                {activeTab === 'credentials' && (
                    <div className="max-w-md mx-auto animate-in fade-in duration-200">
                        <Card className="bg-white/95 backdrop-blur-md shadow-xl border-slate-200/80 rounded-2xl overflow-hidden">
                            <CardHeader className="pt-6 pb-3 text-center bg-slate-50/50 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-full bg-blue-100/70 text-blue-700 flex items-center justify-center mx-auto mb-2">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <CardTitle className="text-lg font-bold text-slate-900">
                                    {isForgotMode ? 'Reset Password' : 'Staff Credential Sign-In'}
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500">
                                    {isForgotMode 
                                        ? 'Enter registered email to receive password reset link' 
                                        : 'Enter authorized email and password to access hospital workspace'}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="pt-6 pb-6 space-y-4">
                                <form onSubmit={handleAuth} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="staff-email" className="text-xs font-semibold text-slate-700">Staff Email</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="staff-email"
                                                type="email"
                                                placeholder="doctor@jeevika.in"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="pl-9 h-10 text-sm bg-slate-50/50 border-slate-200 focus:bg-white rounded-xl"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {!isForgotMode && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="staff-password" className="text-xs font-semibold text-slate-700">Password</Label>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsForgotMode(true)}
                                                    className="text-xs text-blue-600 hover:underline font-semibold"
                                                >
                                                    Forgot Password?
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                                <PasswordInput
                                                    id="staff-password"
                                                    placeholder="Enter security password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="pl-9 h-10 text-sm bg-slate-50/50 border-slate-200 focus:bg-white rounded-xl"
                                                    required
                                                    minLength={6}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md rounded-xl transition-all"
                                        disabled={manualLoading}
                                    >
                                        {manualLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                {isForgotMode ? 'Sending Recovery Link...' : 'Authenticating...'}
                                            </>
                                        ) : (
                                            <span className="flex items-center justify-center gap-2">
                                                {isForgotMode ? 'Send Recovery Link' : 'Sign In with Credentials'}
                                                <ArrowRight className="w-4 h-4" />
                                            </span>
                                        )}
                                    </Button>

                                    {isForgotMode && (
                                        <button
                                            type="button"
                                            onClick={() => setIsForgotMode(false)}
                                            className="w-full text-xs text-center text-slate-500 hover:text-slate-800 font-semibold pt-1"
                                        >
                                            Return to Sign In
                                        </button>
                                    )}
                                </form>

                                {/* Demo Credential Quick-Fill Section */}
                                {!isForgotMode && (
                                    <div className="pt-4 border-t border-slate-100 space-y-2">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">
                                            Quick-Fill Test Credentials
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {DEMO_CREDENTIAL_PILLS.map((pill) => (
                                                <button
                                                    key={pill.email}
                                                    type="button"
                                                    onClick={() => handleFillDemoCreds(pill.email)}
                                                    className="p-2 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl transition-all group"
                                                >
                                                    <span className="block text-xs font-bold text-slate-800 group-hover:text-blue-700">
                                                        {pill.label}
                                                    </span>
                                                    <span className="block text-[10px] text-slate-500 truncate">
                                                        {pill.email}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Security & Compliance Footer */}
            <div className="w-full max-w-7xl mx-auto pt-6 pb-2 border-t border-slate-200/80 z-10 text-center space-y-2">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[11px] font-semibold text-slate-600">
                    <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ABDM M1-M3 Certified Ready
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        NRCeS FHIR R4 Compliant
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ISO 27001 & SOC-2 Audit Trail
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        AES-256 Encrypted Cloudflare D1
                    </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                    JEEVIKA Hospital Management & Decision Support Platform • Maintained by Jeevika Core Engineering Team
                </p>
            </div>
        </div>
    )
}
