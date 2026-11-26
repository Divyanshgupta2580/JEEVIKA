import { confirmCbcNavigation } from "../../features/cbc/navigation";
import { SymbolIcon } from "@/components/ui/SymbolIcon";
import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useHospital } from '@/context/HospitalContext'
import { NotificationsPanel } from '@/components/ui/NotificationsPanel'
import { requestNotificationPermission } from '@/lib/notifications'
import { useTour } from '@/context/TourContext'
import { workspaceTour } from '@/tourSteps'
import { LayoutGrid, PanelLeftClose, PanelLeftOpen, Play } from 'lucide-react'
import { routeAccess, staffNavItems } from '@/lib/rbac'
import { ShellEmergency } from '@/components/ShellEmergency'
import { useOptionalOpdWorkspace } from '@/features/opd/opdContext'
import '@/design-system/opd-cockpit.css'

interface AppLayoutProps {
    children: React.ReactNode
    onLogout: () => void
    view: string
    setView: (view: string) => void
    lockNavigation?: boolean
    selectedClinicId?: string | null
    onSelectClinicId?: (id: string | null) => void
}

export function AppLayout({ 
    children, 
    onLogout, 
    view, 
    setView, 
    lockNavigation = false,
    selectedClinicId = null,
    onSelectClinicId
}: AppLayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const mainScrollRef = useRef<HTMLElement>(null);
    useEffect(() => {
        if (mainScrollRef.current && typeof mainScrollRef.current.scrollTo === 'function') {
            mainScrollRef.current.scrollTo({ top: 0 });
        }
    }, [location.pathname, location.search]);
    const { session, profile: userProfile, hospital, clinics, unseenCount } = useHospital()
    const opd = useOptionalOpdWorkspace()
    const { startTour, scope, isTourActive, endTour } = useTour()
    const role = userProfile?.role
    const verifiedRole = typeof session?.role === "string" ? session.role : null
    const isDoctorRole = verifiedRole === 'DOCTOR'
    const isClinicianOpdTheme = isDoctorRole && (view === 'doctor-consultation' || view === 'doctor-alerts')
    const isCareOrAyushTheme = view === 'ipd' || view === 'emergency-triage' || view === 'ayush-center'
    const isIvoryShellTheme = isClinicianOpdTheme || isCareOrAyushTheme
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const mobileMenuButton = useRef<HTMLButtonElement>(null)
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

    const isFullBleedPortal = view === 'patient-kiosk';
    const [isCollapsed, setIsCollapsed] = useState(false);
    const CLINIC_VIEWS = ['clinic-admin', 'pos', 'attendance', 'shift-management', 'inventory-dashboard', 'staff', 'staff-management', 'earnings'];
    const isClinicPortal = CLINIC_VIEWS.includes(view) || (selectedClinicId !== null && view !== 'admin');

    const getPortalMeta = () => {
        if (view === 'patient-kiosk') {
            return {
                number: '01',
                name: 'Patient Intake System & Kiosk',
                badge: 'PORTAL 1 · PATIENT INTAKE SYSTEM',
                badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
                dotClass: 'bg-amber-500'
            };
        }
        if (view === 'maritime-agents') {
            return {
                number: '05',
                name: 'Swarm Mesh',
                badge: 'PLATFORM ADMINISTRATION',
                badgeClass: 'bg-blue-50 text-blue-800 border-blue-300',
                dotClass: 'bg-blue-600'
            };
        }
        if (view === 'prune-gateway') {
            return {
                number: '06',
                name: 'Prune AI Gateway',
                badge: 'PLATFORM ADMINISTRATION',
                badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
                dotClass: 'bg-emerald-600'
            };
        }
        if (view === 'doctor-alerts') {
            return {
                number: '02',
                name: 'Clinical & Operational Alerts',
                badge: 'PORTAL 2 · CLINICIAN ALERTS',
                badgeClass: 'bg-[#E1F0E7] text-[#175B4B] border-[#C6E0D1]',
                dotClass: 'bg-rose-500'
            };
        }
        if (view === 'doctor-consultation') {
            return {
                number: '02',
                name: 'Doctor Consultation (OPD)',
                badge: 'PORTAL 2 · CLINICIAN OPD COCKPIT',
                badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
                dotClass: 'bg-teal-500'
            };
        }
        if (view === 'emergency-triage') {
            return {
                number: '03',
                name: 'Emergency Triage (STAT)',
                badge: 'PORTAL 3 · EMERGENCY DEPARTMENT',
                badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
                dotClass: 'bg-rose-500 animate-ping'
            };
        }
        if (isClinicPortal) {
            return {
                number: '05',
                name: 'Clinic Operations & POS',
                badge: 'PORTAL 5 · CLINIC OPERATIONS',
                badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
                dotClass: 'bg-blue-500'
            };
        }
        return {
            number: '04',
            name: 'Headquarters Command Center',
            badge: 'PORTAL 4 · HQ GROUP COMMAND',
            badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
            dotClass: 'bg-indigo-500'
        };
    };

    const portalMeta = getPortalMeta();

    const [showGuideInvitation,setShowGuideInvitation] = useState(false);
    useEffect(()=>{
        if (!role || ['selection','setup','patient-kiosk','emergency-triage'].includes(view) || lockNavigation) { setShowGuideInvitation(false); return; }
        try { setShowGuideInvitation(!localStorage.getItem(`jeevika_tour_completed:${view}`) && !localStorage.getItem(`jeevika_tour_dismissed:${view}`) && !localStorage.getItem('aarogya_nidhi_tour_completed')); }
        catch { setShowGuideInvitation(true); }
    },[role,view,lockNavigation]);
    useEffect(()=>{if(isTourActive && scope && scope!==view)endTour();},[isTourActive,scope,view,endTour]);
    const showGuide = () => { setShowGuideInvitation(false); startTour(workspaceTour(view),view); };
    const dismissGuideInvitation = () => { setShowGuideInvitation(false); try { localStorage.setItem(`jeevika_tour_dismissed:${view}`,'true'); } catch {} };

    // Helper for Navigation Items
    type NavItemProps = {
        icon: string;
        label: string;
        active: boolean;
        onClick: () => void;
        disabled?: boolean;
        id?: string;
        badgeCount?: number;
        urgentBadge?: boolean;
    };
    const NavItem = ({ icon, label, active, onClick, disabled, id, badgeCount, urgentBadge }: NavItemProps) => (
        <button
            type="button"
            id={id}
            title={label}
            aria-label={badgeCount && badgeCount > 0 ? `${label} (${badgeCount} active)` : label}
            aria-current={active ? 'page' : undefined}
            onClick={() => {
                if (!disabled) {
                    onClick()
                    setIsMobileMenuOpen(false)
                }
            }}
            disabled={disabled}
            className={`ayu-workspace-nav-item w-full flex items-center gap-3 px-3 min-h-11 py-2.5 rounded-xl transition-colors group
                ${disabled ? 'opacity-50 cursor-not-allowed text-slate-400' :
                    active
                        ? isIvoryShellTheme
                            ? 'bg-[#E5F3EB] text-[#0E2420] font-bold border border-[#C6E1D1] shadow-xs'
                            : 'bg-teal-50 text-teal-800 font-bold border border-teal-200/60 shadow-sm'
                        : isIvoryShellTheme
                            ? 'text-[#314A42] hover:bg-[#EEF6F1] hover:text-[#0E2420]'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                `}
        >
            <SymbolIcon className={`material-symbols-outlined text-[20px] ${active ? 'text-[#047C61]' : isIvoryShellTheme ? 'text-[#3F5E54] group-hover:text-[#0E2420]' : 'text-slate-500 group-hover:text-slate-800'}`}>{icon}</SymbolIcon>
            <span className={`ayu-nav-label text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            {typeof badgeCount === 'number' && badgeCount > 0 && (
                <span className={`ayu-nav-label ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    urgentBadge ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-[#F8EBCD] text-[#7D5710] border border-[#EAD49F]'
                }`}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                </span>
            )}
            {disabled && <SymbolIcon className="ayu-nav-label material-symbols-outlined text-[16px] ml-auto opacity-50">lock</SymbolIcon>}
        </button>
    )

    // Dynamic Branding
    const myClinic = userProfile?.clinic_id ? clinics.find(c => c.id === userProfile.clinic_id) : null

    const getBrandName = () => {
        if (['SUPER_ADMIN', 'OWNER'].includes(role || '')) return 'SaaS Control';
        if (role === 'CLINIC_ADMIN' && myClinic) return myClinic.name;
        return hospital?.name || 'Jeevika';
    }

    const getBrandSubtitle = () => {
        if (['SUPER_ADMIN', 'OWNER'].includes(role || '')) return 'System Admin';
        if (role === 'CLINIC_ADMIN') return 'Clinic Manager';
        return 'Hospital OS';
    }

    const isClinicPaused = myClinic?.status === 'paused' && role !== 'SUPER_ADMIN' && role !== 'OWNER';

    if (isClinicPaused) {
        return (
            <div className="text-slate-900 h-screen w-screen flex overflow-hidden bg-slate-50 font-sans">
                <div className="w-full h-full flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center ring-1 ring-slate-200">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <SymbolIcon className="material-symbols-outlined text-3xl text-red-600">block</SymbolIcon>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Clinic Paused</h2>
                        <p className="text-slate-600 mb-8">
                            Your clinic has been paused by the hospital administrator.
                            You cannot access the system until it is unpaused.
                        </p>
                        <button
                            onClick={onLogout}
                            className="w-full bg-slate-100 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const hasEmergencyAlerts = Boolean(opd?.alerts.some((a) => a.severity === 'EMERGENCY'));
    const activeAlertCount = opd?.alerts.length ?? 0;
    const bellBadgeCount = isDoctorRole && opd ? activeAlertCount + unseenCount : unseenCount;
    const isSyntheticFallbackName = userProfile?.full_name === 'Dr. Senior Consultant, MD';
    const sidebarDisplayName = isDoctorRole
        ? (!isSyntheticFallbackName && userProfile?.full_name
            ? userProfile.full_name
            : session?.email || session?.id || 'Clinician account')
        : (userProfile?.full_name || 'Staff account');

    return (
        <div
            className={`ayu-workspace-shell flex h-screen w-full overflow-hidden font-sans ${
                isIvoryShellTheme
                    ? 'jvk-opd-shell bg-[#FEFBF6] text-[#0E2420]'
                    : 'bg-white text-slate-900'
            }`}
            data-mobile-menu-open={isMobileMenuOpen}
        >
            {!isFullBleedPortal && (
                <aside
                    aria-label="Workspace navigation"
                    className={`ayu-global-sidebar relative overflow-hidden ${isIvoryShellTheme ? 'jvk-opd-sidebar' : ''}`}
                    data-collapsed={isCollapsed}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape' && isMobileMenuOpen) {
                            setIsMobileMenuOpen(false);
                            mobileMenuButton.current?.focus();
                        }
                    }}
                >
                    <div className="ayu-workspace-sidebar-top relative z-10">
                        <img
                            src="/assets/logo-jeevika.png"
                            alt="Jeevika"
                            title={getBrandName()}
                            width={108}
                            height={36}
                            className="ayu-workspace-brand"
                        />
                        <button
                            type="button"
                            className={`ayu-workspace-menu ayu-workspace-menu-desktop ${
                                isIvoryShellTheme
                                    ? '!border-[#E3DCCA] !bg-transparent !text-[#2C453D] hover:!bg-[#EEF6F0]'
                                    : ''
                            }`}
                            aria-controls="workspace-menu"
                            aria-expanded={!isCollapsed}
                            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
                        >
                            {isIvoryShellTheme ? (
                                <LayoutGrid size={18} aria-hidden="true" className="text-[#4B665D]" />
                            ) : isCollapsed ? (
                                <PanelLeftOpen size={18} aria-hidden="true" />
                            ) : (
                                <PanelLeftClose size={18} aria-hidden="true" />
                            )}
                            <span>Menu</span>
                        </button>
                        <button
                            ref={mobileMenuButton}
                            type="button"
                            className="ayu-workspace-menu ayu-workspace-menu-mobile"
                            aria-controls="workspace-menu"
                            aria-expanded={isMobileMenuOpen}
                            aria-label={isMobileMenuOpen ? 'Close workspace menu' : 'Open workspace menu'}
                            onClick={() => setIsMobileMenuOpen((open) => !open)}
                        >
                            <SymbolIcon className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</SymbolIcon>
                            <span>{isMobileMenuOpen ? 'Close' : 'Menu'}</span>
                        </button>
                    </div>

                    <nav id="workspace-menu" aria-label="Staff workspaces" className="ayu-workspace-nav relative z-10">
                        {staffNavItems(verifiedRole)
                            .filter(({ route }) => routeAccess(route, verifiedRole) !== 'None')
                            .map((item) => (
                                <NavItem
                                    key={item.id}
                                    id={`tour-${item.id}`}
                                    icon={item.icon}
                                    label={item.label}
                                    active={view === item.view}
                                    badgeCount={item.id === 'alerts' && isDoctorRole ? activeAlertCount : undefined}
                                    urgentBadge={item.id === 'alerts' && hasEmergencyAlerts}
                                    onClick={() => {
                                        if (item.view === 'admin') onSelectClinicId?.(null);
                                        setView(item.view);
                                    }}
                                />
                            ))}
                    </nav>

                    {isIvoryShellTheme && !isCollapsed && (
                        <img
                            src="/assets/opd/opd-sidebar-leaves.png"
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none select-none absolute bottom-[104px] left-0 w-44 opacity-85 z-0"
                        />
                    )}

                    <div className={`ayu-workspace-sidebar-footer relative z-10 ${isIvoryShellTheme ? '!border-[#ECE5D5] bg-[#FFFDF9]/85 backdrop-blur-xs' : ''}`}>
                        <div className="ayu-workspace-identity flex min-w-0 items-center gap-2.5">
                            <span
                                aria-hidden="true"
                                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                                    isIvoryShellTheme ? 'bg-[#E3F1E8] text-[#175B4B]' : 'bg-teal-100 text-teal-800'
                                }`}
                            >
                                {(sidebarDisplayName[0] || 'C').toUpperCase()}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-[#0E2420]">{sidebarDisplayName}</p>
                                <p className="text-xs text-[#586C64]">{getBrandSubtitle()}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onLogout}
                            className={`ayu-workspace-sign-out ${
                                isIvoryShellTheme ? '!border-[#EBCBC7] !bg-[#FDF5F4] !text-[#B9382C] hover:!bg-[#FAE7E5] w-full justify-start' : ''
                            }`}
                        >
                            <SymbolIcon className="material-symbols-outlined">logout</SymbolIcon>
                            <span>Sign Out</span>
                        </button>
                    </div>
                </aside>
            )}

            <main
                ref={mainScrollRef}
                aria-label="Workspace content"
                tabIndex={0}
                className={`ayu-workspace-scroll relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto ${
                    isIvoryShellTheme ? 'jvk-opd-main' : 'bg-white'
                }`}
            >
                {/* HEADER */}
                {view !== 'patient-kiosk' && (
                    isIvoryShellTheme ? (
                        <header className="sticky top-0 z-30 shrink-0 bg-[#FEFBF6]/90 backdrop-blur-md border-b border-[#EDE6D8]/70 px-4 sm:px-6 lg:px-10 py-3 flex flex-wrap items-center justify-end gap-2.5 sm:gap-4">
                            <div className="flex-1 hidden sm:block" aria-hidden="true" />
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!confirmCbcNavigation()) return;
                                        onSelectClinicId?.(null);
                                        navigate('/');
                                    }}
                                    className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#DFD8C7] bg-white/95 hover:bg-white hover:border-[#C9BEA6] text-[#243B34] text-xs font-semibold shadow-xs transition-all cursor-pointer"
                                    title="Return to Portal Selection (Choose a different dashboard)"
                                >
                                    <SymbolIcon className="material-symbols-outlined text-[16px] text-[#586C64] group-hover:-translate-x-0.5 transition-transform">arrow_back</SymbolIcon>
                                    <span>Exit to Portals</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3">
                                <button
                                    type="button"
                                    aria-label="Show guide"
                                    onClick={showGuide}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D4E4D3] bg-[#ECF5EC] text-[#175B4B] text-xs font-bold hover:bg-[#DFF0DF] transition-colors"
                                >
                                    <Play className="w-3.5 h-3.5" />
                                    <span>Show guide</span>
                                </button>
                                {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const granted = await requestNotificationPermission();
                                            if (granted) {
                                                window.location.reload();
                                            }
                                        }}
                                        className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE5DC] bg-white/90 text-[#1F5A45] text-xs font-semibold hover:bg-[#EEF6F1] transition-colors"
                                        title="Enable Desktop Notifications"
                                    >
                                        <SymbolIcon className="material-symbols-outlined text-[16px]">notifications_active</SymbolIcon>
                                        <span>Enable Desktop Alerts</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    aria-label={bellBadgeCount > 0 ? `Open notifications (${bellBadgeCount} active)` : 'Open notifications'}
                                    aria-expanded={isNotificationsOpen}
                                    onClick={() => setIsNotificationsOpen(true)}
                                    className="relative p-2 text-[#243B34] hover:text-[#047C61] hover:bg-[#EBF4EE] rounded-xl transition-all group"
                                >
                                    <SymbolIcon className="material-symbols-outlined text-2xl">notifications</SymbolIcon>
                                    {bellBadgeCount > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 bg-rose-600 border-2 border-[#FEFBF6] rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                                            {bellBadgeCount > 99 ? '99+' : bellBadgeCount}
                                        </span>
                                    )}
                                </button>
                                <NotificationsPanel
                                    open={isNotificationsOpen}
                                    onClose={() => setIsNotificationsOpen(false)}
                                    onNavigate={setView}
                                />
                            </div>
                        </header>
                    ) : (
                <header className="ayu-workspace-header h-20 border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 bg-white/95 backdrop-blur-md z-30 shrink-0">
                    <div className="ayu-workspace-heading flex items-center gap-4">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${portalMeta.badgeClass}`}>
                                    {portalMeta.badge}
                                </span>
                            </div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight capitalize leading-none">
                                {portalMeta.name}
                            </h1>
                        </div>
                    </div>

                    {/* DEDICATED EXIT TO PORTALS BUTTON - STITCH MINIMAL TASTE */}
                    <div className="ayu-workspace-shortcuts flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                if (!confirmCbcNavigation()) return;
                                onSelectClinicId?.(null);
                                navigate('/');
                            }}
                            className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-slate-950 text-xs font-semibold tracking-tight shadow-sm transition-all duration-150 cursor-pointer active:scale-95"
                            title="Return to Portal Selection (Choose a different dashboard)"
                        >
                            <SymbolIcon className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-slate-700 group-hover:-translate-x-0.5 transition-all">arrow_back</SymbolIcon>
                            <span>Exit to Portals</span>
                        </button>
                    </div>

                    <div className="ayu-workspace-tools flex items-center gap-4">
                        <button
                            type="button"
                            aria-label="Show guide"
                            onClick={showGuide}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100/50 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                        >
                            <Play className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Show guide</span>
                        </button>
                        {/* Notifications */}
                        <div className="flex items-center gap-1 sm:gap-2">
                            {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                                <button
                                    onClick={async () => {
                                        const granted = await requestNotificationPermission();
                                        if (granted) {
                                            window.location.reload();
                                        }
                                    }}
                                    className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                                    title="Enable Desktop Notifications"
                                >
                                    <SymbolIcon className="material-symbols-outlined text-[16px]">notifications_active</SymbolIcon>
                                    Enable Desktop Alerts
                                </button>
                            )}
                            <button
                                type="button"
                                aria-label="Open notifications"
                                aria-expanded={isNotificationsOpen}
                                onClick={() => setIsNotificationsOpen(true)}
                                className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all active:scale-95 group"
                            >
                                <SymbolIcon className="material-symbols-outlined text-2xl group-hover:rotate-[15deg] transition-transform">notifications</SymbolIcon>
                                {bellBadgeCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white group-hover:scale-110 transition-transform">
                                        {bellBadgeCount > 99 ? '99+' : bellBadgeCount}
                                    </span>
                                )}
                            </button>
                        </div>
                        <NotificationsPanel
                            open={isNotificationsOpen}
                            onClose={() => setIsNotificationsOpen(false)}
                            onNavigate={setView}
                        />
                    </div>
                </header>
                    )
                )}

                {!isFullBleedPortal && (
                    <div className="shrink-0">
                        <ShellEmergency role={verifiedRole ?? undefined} userId={session?.id} view={view} />
                    </div>
                )}

                {/* SCROLLABLE INNER CONTENT */}
                <div
                    id="tour-workspace-content"
                    className={
                        view === 'patient-kiosk'
                            ? "flex-1 w-full"
                            : isIvoryShellTheme
                              ? "flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-4 pb-20"
                              : "flex-1 p-4 lg:p-12 lg:pt-6 max-w-[1600px] w-full mx-auto"
                    }
                >
                    {showGuideInvitation && !isTourActive && <section className="ayu-guide-invitation" aria-label="Workspace introduction"><div><strong>New to this workspace?</strong><p>Take a short guide without leaving this page.</p></div><button type="button" onClick={showGuide}>Show me around</button><button type="button" onClick={dismissGuideInvitation}>Not now</button></section>}
                    {children}
                </div>
            </main>
        </div>
    )
}
