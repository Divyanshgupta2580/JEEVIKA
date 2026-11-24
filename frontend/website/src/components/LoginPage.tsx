import { useLocation } from "react-router-dom";
import { landingRoute } from '@/lib/rbac';
import { useState } from 'react'
import { authService as auth } from '@/lib/authService'
import { Button, Input, PasswordInput, Label } from '@/components/ui/basic'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/basic'
import {
    Lock, Mail, Loader2, AlertCircle, ArrowRight,
    CheckCircle2, ExternalLink, Sparkles
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'

export function LoginPage() {
    const [isForgotMode, setIsForgotMode] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [manualLoading, setManualLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { toast } = useToast()
    const location = useLocation()

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
                const from = location.state?.from
                const target = /^\/app(?:\/|$)/.test(from?.pathname ?? '')
                    ? from.pathname + (from.search ?? '') + (from.hash ?? '')
                    : landingRoute(user.role)
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

                </div>

                {error && (
                    <Alert variant="destructive" className="max-w-xl mx-auto bg-red-50 border-red-200 text-red-800 shadow-sm">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* STAFF CREDENTIALS FORM */}
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
                                                    onClick={() => { setError(null); setIsForgotMode(true); }}
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
                                            onClick={() => { setError(null); setIsForgotMode(false); }}
                                            className="w-full text-xs text-center text-slate-500 hover:text-slate-800 font-semibold pt-1"
                                        >
                                            Return to Sign In
                                        </button>
                                    )}
                                </form>

                            </CardContent>
                        </Card>
                    </div>
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
