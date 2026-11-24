import { confirmCbcNavigation } from "../../features/cbc/navigation";
import { SymbolIcon } from "@/components/ui/SymbolIcon";
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHospital } from '@/context/HospitalContext'
import { NotificationsPanel } from '@/components/ui/NotificationsPanel'
import { requestNotificationPermission } from '@/lib/notifications'
import { useTour } from '@/context/TourContext'
import { workspaceTour } from '@/tourSteps'
import { PanelLeftClose, PanelLeftOpen, Play } from 'lucide-react'
import { routeAccess, staffNavItems } from '@/lib/rbac'
import { ShellEmergency } from '@/components/ShellEmergency'

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
    const { session, profile: userProfile, hospital, clinics, unseenCount } = useHospital()
    const { startTour, scope, isTourActive, endTour } = useTour()
    const role = userProfile?.role
    const verifiedRole = typeof session?.role === "string" ? session.role : null
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
    };
    const NavItem = ({ icon, label, active, onClick, disabled, id }: NavItemProps) => (
        <button
            type="button"
            id={id}
            title={label}
            aria-label={label}
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
                        ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200/60 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                `}
        >
            <SymbolIcon className={`material-symbols-outlined text-[20px] ${active ? 'text-teal-700' : 'text-slate-500 group-hover:text-slate-800'}`}>{icon}</SymbolIcon>
            <span className={`ayu-nav-label text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
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

    return (
        <div
            className="ayu-workspace-shell flex h-screen w-full overflow-hidden bg-white font-sans text-slate-900"
            data-mobile-menu-open={isMobileMenuOpen}
        >
            {!isFullBleedPortal && (
                <aside
                    aria-label="Workspace navigation"
                    className="ayu-global-sidebar"
                    data-collapsed={isCollapsed}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape' && isMobileMenuOpen) {
                            setIsMobileMenuOpen(false);
                            mobileMenuButton.current?.focus();
                        }
                    }}
                >
                    <div className="ayu-workspace-sidebar-top">
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
                            className="ayu-workspace-menu ayu-workspace-menu-desktop"
                            aria-controls="workspace-menu"
                            aria-expanded={!isCollapsed}
                            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
                        >
                            {isCollapsed
                                ? <PanelLeftOpen size={18} aria-hidden="true" />
                                : <PanelLeftClose size={18} aria-hidden="true" />}
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

                    <nav id="workspace-menu" aria-label="Staff workspaces" className="ayu-workspace-nav">
                        {staffNavItems(verifiedRole)
                            .filter(({ route }) => routeAccess(route, verifiedRole) !== 'None')
                            .map((item) => (
                                <NavItem
                                    key={item.id}
                                    id={`tour-${item.id}`}
                                    icon={item.icon}
                                    label={item.label}
                                    active={view === item.view}
                                    onClick={() => {
                                        if (item.view === 'admin') onSelectClinicId?.(null);
                                        setView(item.view);
                                    }}
                                />
                            ))}
                    </nav>

                    <div className="ayu-workspace-sidebar-footer">
                        <div className="ayu-workspace-identity flex min-w-0 items-center gap-2.5">
                            <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">
                                {userProfile?.full_name?.[0] || 'C'}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-slate-800">{userProfile?.full_name || 'Staff account'}</p>
                                <p className="text-xs text-slate-500">{getBrandSubtitle()}</p>
                            </div>
                        </div>
                        <button type="button" onClick={onLogout} className="ayu-workspace-sign-out">
                            <SymbolIcon className="material-symbols-outlined">logout</SymbolIcon>
                            <span>Sign Out</span>
                        </button>
                    </div>
                </aside>
            )}

            <main
                aria-label="Workspace content"
                tabIndex={0}
                className="ayu-workspace-scroll relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-white"
            >
                {/* HEADER */}
                {view !== 'patient-kiosk' && (
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
                            {Notification.permission !== 'granted' && (
                                <button
                                    onClick={async () => {
                                        const granted = await requestNotificationPermission();
                                        if (granted) {
                                            // Refresh component state or show success
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
                                {unseenCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white group-hover:scale-110 transition-transform">
                                        {unseenCount > 99 ? '99+' : unseenCount}
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
                )}

                {!isFullBleedPortal && <ShellEmergency role={verifiedRole ?? undefined} userId={session?.id} view={view} />}

                {/* SCROLLABLE INNER CONTENT */}
                <div id="tour-workspace-content" className={view === 'patient-kiosk' ? "flex-1 w-full" : "flex-1 p-4 lg:p-12 lg:pt-6 max-w-[1600px] w-full mx-auto"}>
                    {showGuideInvitation && !isTourActive && <section className="ayu-guide-invitation" aria-label="Workspace introduction"><div><strong>New to this workspace?</strong><p>Take a short guide without leaving this page.</p></div><button type="button" onClick={showGuide}>Show me around</button><button type="button" onClick={dismissGuideInvitation}>Not now</button></section>}
                    {children}
                </div>
            </main>
        </div>
    )
}
