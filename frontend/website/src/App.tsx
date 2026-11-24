import { confirmCbcNavigation } from "./features/cbc/navigation";
import { useState, useEffect, lazy, Suspense, Component, type ErrorInfo, type ReactNode } from 'react'

function lazyWithRetry<T extends React.ComponentType<any>>(
    factory: () => Promise<{ default: T } | any>
) {
    return lazy(async () => {
        const pageHasBeenForceRefreshed = sessionStorage.getItem('dhaaga_chunk_retry_active');
        try {
            const module = await factory();
            sessionStorage.removeItem('dhaaga_chunk_retry_active');
            return 'default' in module ? module : { default: module };
        } catch (error: any) {
            console.warn('Vite dynamic chunk load error:', error);
            if (!pageHasBeenForceRefreshed) {
                sessionStorage.setItem('dhaaga_chunk_retry_active', 'true');
                window.location.reload();
                return new Promise<{ default: T }>(() => {});
            }
            sessionStorage.removeItem('dhaaga_chunk_retry_active');
            throw error;
        }
    });
}

const PurchaseOrders = lazyWithRetry(() => import("@/components/ProcurementHandoffs").then(module => ({ default: module.PurchaseOrders })));
const GoodsReceipt = lazyWithRetry(() => import("@/components/ProcurementHandoffs").then(module => ({ default: module.GoodsReceipt })));
const MedicineMigration = lazyWithRetry(() => import("@/components/MedicineMigration").then(module => ({ default: module.MedicineMigration })));
const SuperAdminDashboard = lazyWithRetry(() => import("@/components/SuperAdminDashboard").then(module => ({ default: module.SuperAdminDashboard })));
const HospitalDashboard = lazyWithRetry(() => import("@/components/HospitalDashboard").then(module => ({ default: module.HospitalDashboard })));
const ClinicAdminDashboard = lazyWithRetry(() => import("@/components/ClinicAdminDashboard").then(module => ({ default: module.ClinicAdminDashboard })));
import { AppLayout } from "@/components/layout/AppLayout";
import { WebsiteLanguageSelect, WebsiteLocalizationRuntime } from "@/components/WebsiteLanguageSelect";
const AdminSetup = lazyWithRetry(() => import("@/components/AdminSetup").then(module => ({ default: module.AdminSetup })));
import { HospitalProvider, useHospital } from '@/context/HospitalContext';
import { TourProvider } from '@/context/TourContext';
import { ProductTour } from '@/components/ProductTour';
import { ResetPasswordPage } from "@/components/ResetPasswordPage";
const HospitalsRegistry = lazyWithRetry(() => import("@/components/HospitalsRegistry").then(module => ({ default: module.HospitalsRegistry })));
const ExpensesDashboard = lazyWithRetry(() => import("./components/ExpensesDashboard").then(module => ({ default: module.ExpensesDashboard })));
const EquipmentsDashboard = lazyWithRetry(() => import("./components/EquipmentsDashboard").then(module => ({ default: module.EquipmentsDashboard })));
const HospitalDetails = lazyWithRetry(() => import("@/components/HospitalDetails").then(module => ({ default: module.HospitalDetails })));
const AuditLogs = lazyWithRetry(() => import("@/components/AuditLogs").then(module => ({ default: module.AuditLogs })));
const ShiftManagement = lazyWithRetry(() => import("@/components/ShiftManagement").then(module => ({ default: module.ShiftManagement })));
const HospitalShiftManagement = lazyWithRetry(() => import("@/components/HospitalShiftManagement").then(module => ({ default: module.HospitalShiftManagement })));
const EarningsDashboard = lazyWithRetry(() => import("@/components/EarningsDashboard").then(module => ({ default: module.EarningsDashboard })));
const SettingsDashboard = lazyWithRetry(() => import("@/components/SettingsDashboard").then(module => ({ default: module.SettingsDashboard })));
const DoctorConsultation = lazyWithRetry(() => import("@/components/DoctorConsultation").then(module => ({ default: module.DoctorConsultation })));
const PharmacyInflow = lazyWithRetry(() => import("@/components/ClinicalPharmacy").then(module => ({ default: module.PharmacyInflow })));
const ClinicStock = lazyWithRetry(() => import("@/components/ClinicalPharmacy").then(module => ({ default: module.ClinicStock })));
const PostedFinance = lazyWithRetry(() => import("@/components/ClinicalPharmacy").then(module => ({ default: module.PostedFinance })));
const CareBoard = lazyWithRetry(() => import("@/components/CareBoard").then(module => ({ default: module.CareBoard })));
const AyushDashboard = lazyWithRetry(() => import("@/components/AyushDashboard").then(module => ({ default: module.AyushDashboard })));
const MaritimeAgentMesh = lazyWithRetry(() => import("@/components/MaritimeAgentMesh").then(module => ({ default: module.MaritimeAgentMesh })));
const PruneGatewayDashboard = lazyWithRetry(() => import("@/components/PruneGatewayDashboard").then(module => ({ default: module.PruneGatewayDashboard })));
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import { BillingOverview, SubscriptionDashboard } from '@/components/billing';
const AboutPage = lazyWithRetry(() => import("@/pages/AboutPage"));
const NewsPage = lazyWithRetry(() => import("@/pages/NewsPage"));
const ContactPage = lazyWithRetry(() => import("@/pages/ContactPage"));
const ClinicOperationsPage = lazyWithRetry(() => import("@/pages/ClinicOperationsPage"));
const HospitalCommandCenterPage = lazyWithRetry(() => import("@/pages/HospitalCommandCenterPage"));
const PrivacyPage = lazyWithRetry(() => import("@/pages/PrivacyPage"));
const CareersPage = lazyWithRetry(() => import("@/pages/CareersPage"));
const SupportPage = lazyWithRetry(() => import("@/pages/SupportPage"));
const LoginPage = lazyWithRetry(() => import("@/components/LoginPage").then(module => ({ default: module.LoginPage })));
const RegisterPage = lazyWithRetry(() => import("@/components/RegisterPage").then(module => ({ default: module.RegisterPage })));
import { useLocation, useNavigate } from 'react-router-dom';
import { logPageView } from '@/lib/analytics';
import { motion, AnimatePresence } from 'framer-motion';
import { pageVariants } from '@/lib/transitions';

import { RefreshCw, AlertTriangle } from 'lucide-react'
import { Button, WorkspaceSkeleton, DashboardSkeleton } from '@/components/ui/basic'
import { Toaster } from '@/components/ui/toaster'
import { authService } from '@/lib/authService'
import { dataService } from '@/lib/dataService'
import { landingRoute, routeAccess, staffRouteForView, staffViewForRoute } from '@/lib/rbac'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { KioskLayout } from '@/components/layout/KioskLayout'
import { PatientSignIn } from '@/components/PatientSignIn'
import { PatientHome } from '@/components/layout/PatientHome'
import { PublicOverview } from '@/components/PublicOverview'
import { PatientApiError, patientRequest, patientToken, setPatientToken, type PatientSession } from '@/lib/patientApi'
const KioskIntake = lazy(() => import('@/features/patient/KioskIntake').then(({ KioskIntake }) => ({ default: KioskIntake })));
import { NurseCallQueue } from '@/components/NurseCallQueue'

type SeoConfig = {
    title: string
    description: string
    path: string
    robots: 'index, follow' | 'noindex, nofollow'
}

const SEO_BASE_URL = 'https://www.jeevika.in'
const DEFAULT_SEO: SeoConfig = {
    title: 'JEEVIKA | Hospital Business Operations & Inventory',
    description: 'A complete hospital management system focused on core business operations. Seamlessly manage clinic inventory, OPD billing, consultation fees, staff, and CA balance sheets.',
    path: '/',
    robots: 'index, follow'
}

const SEO_ROUTES: Record<string, SeoConfig> = {
    '/': DEFAULT_SEO,
    '/about': {
        title: 'About JEEVIKA | Hospital Operations Platform',
        description: 'Learn how JEEVIKA helps hospitals and clinics run smoother operations across billing, inventory, staff workflows, and financial oversight.',
        path: '/about',
        robots: 'index, follow'
    },
    '/news': {
        title: 'JEEVIKA News | Hospital Business Insights',
        description: 'Explore updates, announcements, and practical insights on hospital business operations, inventory control, and clinic financial workflows.',
        path: '/news',
        robots: 'index, follow'
    },
    '/contact': {
        title: 'Contact JEEVIKA | Hospital Management Support',
        description: 'Connect with JEEVIKA to discuss hospital operations, clinic inventory, OPD billing, staff workflows, and CA-ready reporting needs.',
        path: '/contact',
        robots: 'index, follow'
    },
    '/clinic-operations': {
        title: 'Clinic Operations Management | JEEVIKA',
        description: 'Streamline day-to-day clinic operations with centralized workflows for OPD billing, inventory, consultation fees, and staff coordination.',
        path: '/clinic-operations',
        robots: 'index, follow'
    },
    '/hospital-command-center': {
        title: 'Hospital Command Center | JEEVIKA',
        description: 'Get a unified command center for hospital business performance, from operations tracking and billing to inventory and staff management.',
        path: '/hospital-command-center',
        robots: 'index, follow'
    },
    '/privacy': {
        title: 'Privacy Policy | JEEVIKA',
        description: 'Read JEEVIKA privacy practices for handling data across hospital and clinic operations, billing, and business management workflows.',
        path: '/privacy',
        robots: 'index, follow'
    },
    '/careers': {
        title: 'Careers at JEEVIKA | Build Healthcare Ops Tech',
        description: 'Join JEEVIKA and help build technology that improves hospital business operations, inventory systems, billing, and financial reporting.',
        path: '/careers',
        robots: 'index, follow'
    },
    '/support': {
        title: 'Support | JEEVIKA Hospital Management System',
        description: 'Access support for JEEVIKA features spanning inventory, OPD billing, consultation fees, staff workflows, and CA balance-sheet readiness.',
        path: '/support',
        robots: 'index, follow'
    },
    '/login': {
        title: 'Login | JEEVIKA',
        description: DEFAULT_SEO.description,
        path: '/login',
        robots: 'noindex, nofollow'
    },
    '/register': {
        title: 'Register | JEEVIKA',
        description: DEFAULT_SEO.description,
        path: '/register',
        robots: 'noindex, nofollow'
    }
}

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
    <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="w-full h-full"
    >
        {children}
    </motion.div>
);

function AppContent() {
    const { session, profile, clinics } = useHospital();
    const verifiedRole = typeof session?.role === 'string' ? session.role : null;
    const location = useLocation();
    const navigate = useNavigate();
    const currentPath = location.pathname.replace(/\/$/, '');
    const requestedView = new URLSearchParams(location.search).get('view');
    const pathView = staffViewForRoute(currentPath, verifiedRole);
    const legacyRoute = requestedView === null ? null : staffRouteForView(requestedView, verifiedRole);
    const view = legacyRoute ? staffViewForRoute(legacyRoute, verifiedRole) : pathView;
    const activeRoute = legacyRoute ?? currentPath;
    const access = routeAccess(activeRoute, verifiedRole);
    const pruneRoute = (['/app/prune/cache', '/app/prune/waf', '/app/prune/redaction'] as const)
        .find((path) => path === activeRoute) ?? '/app/prune';

    const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
    const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
    const [careEncounterId, setCareEncounterId] = useState<string>();

    const setView = (nextView: string) => {
        const destination = staffRouteForView(nextView, verifiedRole);
        if (destination && confirmCbcNavigation()) navigate(destination);
    };
    const navigateToHospital = (id: string) => {
        setSelectedHospitalId(id);
        setView('hospitals');
    };
    const handleBackFromDetails = () => setSelectedHospitalId(null);

    const handleLogout = async () => {
        if (!confirmCbcNavigation()) return;
        try {
            await authService.signOut();
        } catch (err) {
            console.warn('Sign out error:', err);
        } finally {
            // Clear all session-related localStorage
            localStorage.removeItem('lastActiveView');
            localStorage.removeItem('cf_auth_session');
            // Remove auth tokens from localStorage
            Object.keys(localStorage).forEach(key => {
                if (key.includes('auth') || key.startsWith('jeevika-')) {
                    localStorage.removeItem(key);
                }
            });
            // Hard redirect to fully reset app state (avoids stale React state)
            window.location.href = window.location.origin + window.location.pathname + '#/login';
        }
    }

    if (!pathView || !view || (requestedView !== null && !legacyRoute)) {
        return <Navigate to={landingRoute(verifiedRole)} replace />;
    }

    return (
        <AppLayout
            onLogout={handleLogout}
            view={view}
            setView={setView}
            lockNavigation={view === 'setup'}
            selectedClinicId={selectedClinicId}
            onSelectClinicId={setSelectedClinicId}
        >
            <Suspense fallback={<DashboardSkeleton />}>
                <AnimatePresence mode="wait">
                    <PageWrapper key={view}>
                    {view === 'nurse-calls' && routeAccess('/app/nurse-calls', verifiedRole) === 'Full' && (
                        <NurseCallQueue />
                    )}

                    {/* EARNINGS DASHBOARD (HR/ADMINS) */}
                    {view === 'earnings' && (
                        <EarningsDashboard />
                    )}

                    {/* POS/BILLING DASHBOARD */}
                    {view === 'pos' && routeAccess('/app/pos', verifiedRole) === 'Full' && <PharmacyInflow />}

                    {/* PROCUREMENT DASHBOARD */}
                    {view === 'procurement' && routeAccess('/app/procurement', verifiedRole) !== 'None' && (
                        <PurchaseOrders canWrite={routeAccess('/app/procurement', verifiedRole) === 'Full'} goToReceipts={() => setView('procurement-grn')} />
                    )}
                    {view === 'procurement-grn' && routeAccess('/app/procurement/grn', verifiedRole) !== 'None' && <GoodsReceipt canWrite={routeAccess('/app/procurement/grn', verifiedRole) === 'Full'} />}


                    {/* SHIFT MANAGEMENT */}
                    {view === 'shift-management' && (
                        (['HOSPITAL_ADMIN', 'ADMIN'].includes(profile?.role || '')) ? (
                            <HospitalShiftManagement />
                        ) : (
                            profile?.clinic_id ? (
                                <ShiftManagement clinicId={profile.clinic_id} />
                            ) : (
                                <div className="p-12 text-center text-slate-500">No Clinic Selected</div>
                            )
                        )
                    )}

                    {/* DASHBOARD ROUTER (3-TIER LOGIC) */}
                    {view === 'admin' && (
                        <>
                            {/* TIER 1: SUPER ADMIN */}
                            {(['SUPER_ADMIN', 'OWNER'].includes(profile?.role || '')) && (
                                <SuperAdminDashboard onView={navigateToHospital} />
                            )}

                            {/* TIER 2: HOSPITAL ADMIN */}
                            {(['HOSPITAL_ADMIN', 'ADMIN'].includes(profile?.role || '')) && (
                                selectedClinicId ? (
                                    // Showing Clinic View (Drill Down)
                                    <ClinicAdminDashboard clinicId={selectedClinicId} onBack={() => setSelectedClinicId(null)} onNavigate={setView} />
                                ) : (
                                    // Showing Hospital HQ
                                    <HospitalDashboard onSelectClinic={setSelectedClinicId} />
                                )
                            )}

                            {/* TIER 3: CLINIC ADMIN */}
                            {(profile?.role === 'CLINIC_ADMIN') && (
                                profile.clinic_id ? (
                                    <ClinicAdminDashboard clinicId={profile.clinic_id} onNavigate={setView} />
                                ) : (
                                    <div className="p-12 text-center text-slate-500">
                                        <h2 className="text-xl font-bold text-slate-800">No Clinic Assigned</h2>
                                        <p className="mb-4">Please contact your Hospital Administrator.</p>

                                        <Button
                                            variant="outline"
                                            className="border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-300"
                                            onClick={async () => {
                                                // 1. Search Staff Details
                                                const results = await dataService.list('staff_details', { filters: [{ field: 'user_id', operator: '==', value: profile.id }] });
                                                const staffRec = results[0];

                                                if (staffRec?.clinic_id) {
                                                    await dataService.update('profiles', profile.id, { clinic_id: staffRec.clinic_id });
                                                    window.location.reload();
                                                    return;
                                                }

                                                alert("Could not automatically find your clinic linkage. Please report this to support.");
                                            }}
                                        >
                                            Check for Linked Clinic (Auto-Fix)
                                        </Button>
                                    </div>
                                )
                            )}
                            {/* TIER 4: CLINICAL & STAFF ROLES FALLBACK */}
                            {(!['SUPER_ADMIN', 'OWNER', 'HOSPITAL_ADMIN', 'ADMIN', 'CLINIC_ADMIN'].includes(profile?.role || '')) && (
                                <HospitalDashboard onSelectClinic={setSelectedClinicId} />
                            )}
                        </>
                    )}

                    {/* SETUP VIEW (Onboarding) */}
                    {view === 'setup' && (
                        <AdminSetup userProfile={profile} onComplete={() => window.location.reload()} />
                    )}

                    {/* Inventory Dashboard */}
                    {(view === 'inventory-dashboard' || (view === 'medicine-migration' && verifiedRole === 'CLINIC_ADMIN')) && routeAccess('/app/inventory', verifiedRole) !== 'None' && <ClinicStock canManageCatalog={verifiedRole === "HOSPITAL_ADMIN"} />}

                    {/* HOSPITALS REGISTRY & DETAILS */}
                    {view === 'hospitals' && (
                        selectedHospitalId ? (
                            // X-RAY VIEW
                            <HospitalDetails
                                hospitalId={selectedHospitalId}
                                onBack={handleBackFromDetails}
                            />
                        ) : (
                            // REGISTRY VIEW
                            <HospitalsRegistry onView={navigateToHospital} />
                        )
                    )}

                    {view === 'audit_logs' && (
                        <AuditLogs readOnly={access === "Read-only"} />
                    )}

                {view === 'medicine-migration' && verifiedRole === 'HOSPITAL_ADMIN' && (
                    <MedicineMigration onBack={() => setView('inventory-dashboard')} />
                )}

                    {view === 'billing' && (
                        <div className="max-w-4xl mx-auto">
                            {['SUPER_ADMIN', 'OWNER'].includes(profile?.role || '') ? (
                                <BillingOverview />
                            ) : (
                                <SubscriptionDashboard />
                            )}
                        </div>
                    )}

                    {view === 'expenses' && (
                        <ExpensesDashboard />
                    )}

                    {view === 'equipments' && (
                        <EquipmentsDashboard />
                    )}

                    {view === 'ca-suite' && ['HOSPITAL_ADMIN','SUPER_ADMIN'].includes(verifiedRole ?? '') && <PostedFinance canManage={verifiedRole === 'SUPER_ADMIN'} />}

                    {view === 'clinic-admin' && (
                        <ClinicAdminDashboard 
                            clinicId={selectedClinicId || profile?.clinic_id || clinics[0]?.id || 'clinic-main'} 
                            onBack={() => {
                                setSelectedClinicId(null);
                                setView('admin');
                            }} 
                            onNavigate={setView} 
                        />
                    )}

                    {view === 'ipd' && routeAccess('/app/ipd', verifiedRole) !== 'None' && <CareBoard kind="ipd" role={verifiedRole ?? ''} encounterId={careEncounterId} />}

                    {view === 'doctor-consultation' && verifiedRole === 'DOCTOR' && (
                        <DoctorConsultation 
                            onAdmitToIpd={(id: string) => { setCareEncounterId(id); setView('ipd'); }}
                            onAssignBay={(id: string) => { setCareEncounterId(id); setView('emergency-triage'); }}
                        />
                    )}

                    {view === 'emergency-triage' && routeAccess('/app/casualty', verifiedRole) !== 'None' && (
                        <CareBoard kind="casualty" role={verifiedRole ?? ''} encounterId={careEncounterId} />
                    )}

                    {view === 'ayush-center' && access === 'Full' && <AyushDashboard />}
                    {view === 'maritime-agents' && access !== 'None' && <MaritimeAgentMesh canManage={access === 'Full'} />}
                    {view === 'prune-gateway' && access !== 'None' && (
                        <PruneGatewayDashboard route={pruneRoute ?? '/app/prune'} canManage={access === 'Full'} />
                    )}

                    {view === 'settings' && (
                        <SettingsDashboard />
                    )}
                </PageWrapper>
            </AnimatePresence>
            </Suspense>

            <Toaster />
        </AppLayout>

    )
}

function AnalyticsTracker() {
    const location = useLocation();

    useEffect(() => {
        // Correctly handle HashRouter paths
        const path = location.pathname + location.search + location.hash;
        console.log('[GA4] Logging pageview:', path); // DEBUG
        logPageView(path);
    }, [location]);

    return null;
}

function SeoManager() {
    const location = useLocation();

    useEffect(() => {
        const currentPath = location.pathname.startsWith('/app') ? '/app/*' : location.pathname;
        const seoConfig = currentPath === '/app/*'
            ? {
                ...DEFAULT_SEO,
                title: 'JEEVIKA App',
                path: '/app',
                robots: 'noindex, nofollow' as const
            }
            : (SEO_ROUTES[currentPath] || DEFAULT_SEO);

        const canonicalUrl = `${SEO_BASE_URL}${seoConfig.path === '/' ? '' : seoConfig.path}`;
        document.title = seoConfig.title;

        const updateMeta = (selector: string, attr: 'name' | 'property', value: string, content: string) => {
            const existing = document.head.querySelector<HTMLMetaElement>(selector);
            if (existing) {
                existing.setAttribute('content', content);
                return;
            }
            const meta = document.createElement('meta');
            meta.setAttribute(attr, value);
            meta.setAttribute('content', content);
            document.head.appendChild(meta);
        };

        const updateLink = (selector: string, rel: string, href: string) => {
            const existing = document.head.querySelector<HTMLLinkElement>(selector);
            if (existing) {
                existing.setAttribute('href', href);
                return;
            }
            const link = document.createElement('link');
            link.setAttribute('rel', rel);
            link.setAttribute('href', href);
            document.head.appendChild(link);
        };

        updateMeta('meta[name="description"]', 'name', 'description', seoConfig.description);
        updateMeta('meta[name="robots"]', 'name', 'robots', seoConfig.robots);
        updateMeta('meta[property="og:title"]', 'property', 'og:title', seoConfig.title);
        updateMeta('meta[property="og:description"]', 'property', 'og:description', seoConfig.description);
        updateMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
        updateMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seoConfig.title);
        updateMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seoConfig.description);
        updateLink('link[rel="canonical"]', 'canonical', canonicalUrl);

        const jsonLdId = 'route-seo-jsonld';
        const existingScript = document.getElementById(jsonLdId);
        const jsonLdPayload = {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: seoConfig.title,
            description: seoConfig.description,
            url: canonicalUrl,
            isPartOf: {
                '@type': 'WebSite',
                name: 'JEEVIKA',
                url: SEO_BASE_URL
            }
        };

        if (existingScript) {
            existingScript.textContent = JSON.stringify(jsonLdPayload);
            return;
        }

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = jsonLdId;
        script.textContent = JSON.stringify(jsonLdPayload);
        document.head.appendChild(script);
    }, [location.pathname]);

    return null;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
    const { session, profile, loading } = useHospital();
    const location = useLocation();

    if (loading) {
        return <WorkspaceSkeleton />;
    }

    if (!session || !profile) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}

function PublicAuthRoute({ children }: { children: ReactNode }) {
    const { session, profile, loading } = useHospital();
    const location = useLocation();

    if (loading) {
        return <WorkspaceSkeleton />;
    }

    if (session && profile) {
        const from = location.state?.from;
        if (from?.pathname === '/kiosk' || /^\/app(?:\/|$)/.test(from?.pathname ?? '')) {
            return <Navigate to={{ pathname: from.pathname, search: from.search, hash: from.hash }} replace />;
        }
        return <Navigate to={landingRoute(profile.role)} replace />;
    }

    return <>{children}</>;
}

function AppLandingRedirect() {
    const { session, loading } = useHospital();
    const location = useLocation();
    if (loading) return <WorkspaceSkeleton />;
    if (!session) return <Navigate to="/login" replace />;
    const role = typeof session.role === 'string' ? session.role : null;
    const legacyView = new URLSearchParams(location.search).get('view');
    const destination = legacyView ? staffRouteForView(legacyView, role) : null;
    return <Navigate to={destination ?? landingRoute(role)} replace />;
}

function PatientAppRoute({ children }: { children: ReactNode }) {
    const location = useLocation();
    const [patient, setPatient] = useState<PatientSession | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const token = patientToken();
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const end = () => { setPatient(null); setPatientToken(null); setReady(true); };
        window.addEventListener("jeevika-patient-session-ended", end);
        if (!token) end();
        else {
            patientRequest<PatientSession>("/auth/patient/me", { token, signal: controller.signal })
                .then((record) => {
                    if (controller.signal.aborted) return;
                    const time = Date.parse(record.expiresAt) - Date.now();
                    if (!record.patientId || !Number.isFinite(time) || time <= 0) end();
                    else {
                        setPatient(record);
                        const scheduleExpiry = () => {
                            const remaining = Date.parse(record.expiresAt) - Date.now();
                            if (remaining <= 0) end();
                            else timer = setTimeout(scheduleExpiry, Math.min(remaining, 2_147_483_647));
                        };
                        scheduleExpiry();
                    }
                })
                .catch((failure: unknown) => {
                    if (controller.signal.aborted) return;
                    if (failure instanceof PatientApiError && failure.status === 401) end();
                    else setError("Could not verify your patient session. Reload to try again.");
                })
                .finally(() => { if (!controller.signal.aborted) setReady(true); });
        }
        return () => {
            controller.abort();
            clearTimeout(timer);
            window.removeEventListener("jeevika-patient-session-ended", end);
        };
    }, []);

    if (!ready) return <p role="status" className="p-5">Verifying patient session…</p>;
    if (error) return <main className="p-5"><p role="alert">{error}</p></main>;
    if (!patient) return <Navigate to="/home/sign-in" state={{ from: location.pathname }} replace />;
    return <>{children}</>;
}

function AppRouter() {
    const { isPasswordRecovery } = useHospital();
    const location = useLocation();

    const isResetPath = window.location.hash.startsWith('#/reset-password');

    if (isPasswordRecovery || isResetPath) {
        return (
            <>
                <ResetPasswordPage />
                <Toaster />
            </>
        )
    }

    return (
        <>
            <SeoManager />
            <AnalyticsTracker />
            <AnimatePresence mode="wait">
                <Routes location={location}>
                    {/* Public routes */}
                    <Route path="/" element={<PublicLayout><PublicOverview /></PublicLayout>} />
                    <Route path="/login" element={<PublicAuthRoute><PageWrapper><LoginPage /></PageWrapper></PublicAuthRoute>} />
                    <Route path="/register" element={<PublicAuthRoute><PageWrapper><RegisterPage /></PageWrapper></PublicAuthRoute>} />
                    <Route path="/reset-password" element={<PublicLayout><ResetPasswordPage /></PublicLayout>} />
                    <Route path="/home/sign-in" element={<PublicLayout><PatientSignIn /></PublicLayout>} />
                    <Route path="/home/register" element={<PublicLayout><PatientSignIn mode="register" /></PublicLayout>} />
                    <Route path="/home/reset-password" element={<PublicLayout><PatientSignIn mode="reset" /></PublicLayout>} />

                    {/* Protected Clinical Workspaces */}
                    <Route path="/app" element={patientToken() ? <Navigate to="/app/home/thread" replace /> : <ProtectedRoute><AppLandingRedirect /></ProtectedRoute>} />
                    <Route path="/app/home/*" element={<PatientAppRoute><PatientHome /></PatientAppRoute>} />
                    <Route path="/app/*" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
                    <Route path="/kiosk" element={<KioskLayout><Suspense fallback={<p role="status">Loading kiosk…</p>}><KioskIntake /></Suspense></KioskLayout>} />

                    {/* Informational Pages */}
                    <Route path="/landing" element={<PageWrapper><LandingPage /></PageWrapper>} />
                    <Route path="/about" element={<PageWrapper><AboutPage /></PageWrapper>} />
                    <Route path="/news" element={<PageWrapper><NewsPage /></PageWrapper>} />
                    <Route path="/contact" element={<PageWrapper><ContactPage /></PageWrapper>} />
                    <Route path="/clinic-operations" element={<PageWrapper><ClinicOperationsPage /></PageWrapper>} />
                    <Route path="/hospital-command-center" element={<PageWrapper><HospitalCommandCenterPage /></PageWrapper>} />
                    <Route path="/privacy" element={<PageWrapper><PrivacyPage /></PageWrapper>} />
                    <Route path="/careers" element={<PageWrapper><CareersPage /></PageWrapper>} />
                    <Route path="/support" element={<PageWrapper><SupportPage /></PageWrapper>} />

                    {/* Catch-all redirects to /login */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </AnimatePresence>
        </>
    )
}

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class WorkspaceErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Workspace crash caught by ErrorBoundary:', error, errorInfo);
    }

    handleReload = () => {
        sessionStorage.removeItem('dhaaga_chunk_retry_active');
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white">
                    <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center shadow-2xl">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Workspace Recovery</h2>
                        <p className="text-sm text-slate-400 mb-6">
                            A new deployment or module update occurred. Click below to refresh your workspace bundle.
                        </p>
                        <button
                            onClick={this.handleReload}
                            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-4 rounded-xl transition shadow-lg shadow-emerald-900/30"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reload Workspace
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

function WorkspaceChrome() {
    const { pathname } = useLocation();
    const patientOrPublic = pathname === '/' || pathname === '/kiosk' ||
        /^\/(?:home|app\/home)(?:\/|$)/.test(pathname);
    if (patientOrPublic) return null;
    return <>
        {pathname.startsWith('/app') && (
            <div className="ayu-demo-ribbon flex items-center justify-center gap-3 py-2 px-4 shadow-sm">
                <img src="/assets/logo-jeevika.png" alt="Jeevika" className="h-7 md:h-8 w-auto object-contain shrink-0" />
                <span className="font-semibold text-xs md:text-sm tracking-wide">Jeevika Enterprise Workspace · Unified Continuity of Care · Cloudflare D1 &amp; Edge Engine</span>
            </div>
        )}
        <WebsiteLanguageSelect />
        <ProductTour />
    </>;
}

function Main() {
    return (
        <Router>
            <WebsiteLocalizationRuntime />
            <TourProvider>
                <WorkspaceChrome />
                <WorkspaceErrorBoundary>
                    <Suspense fallback={<WorkspaceSkeleton />}>
                        <AppRouter />
                    </Suspense>
                </WorkspaceErrorBoundary>
            </TourProvider>
        </Router>
    );
}

function App() {
    return (
        <HospitalProvider>
            <Main />
        </HospitalProvider>
    )
}

export default App
