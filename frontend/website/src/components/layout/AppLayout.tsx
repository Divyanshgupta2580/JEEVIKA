import { confirmCbcNavigation } from "../../features/cbc/navigation";
import { SymbolIcon } from "@/components/ui/SymbolIcon";
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHospital } from '@/context/HospitalContext'
import { NotificationsPanel } from '@/components/ui/NotificationsPanel'
import { requestNotificationPermission } from '@/lib/notifications'
import { useTour } from '@/context/TourContext'
import { workspaceTour } from '@/tourSteps'
import { Play } from 'lucide-react'
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
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

    const isFullBleedPortal = view === 'patient-kiosk';
    const isClinicalPortal = ['doctor-consultation','emergency-triage','ayush-center'].includes(view);
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
            id={id}
            title={label}
            onClick={() => {
                if (!disabled) {
                    onClick()
                    setIsMobileMenuOpen(false)
                }
            }}
            disabled={disabled}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl transition-all group
                ${disabled ? 'opacity-50 cursor-not-allowed text-slate-400' :
                    active
                        ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200/60 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                `}
        >
            <SymbolIcon className={`material-symbols-outlined text-[20px] ${active ? 'text-teal-700' : 'text-slate-500 group-hover:text-slate-800'}`}>{icon}</SymbolIcon>
            <span className={`ayu-nav-label text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            {disabled && !isCollapsed && <SymbolIcon className="material-symbols-outlined text-[16px] ml-auto opacity-50">lock</SymbolIcon>}
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
        <div className="text-slate-900 h-screen w-screen flex overflow-hidden bg-white font-sans">

            {/* MOBILE OVERLAY */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* SIDEBAR - HIDDEN FOR FULL-BLEED CLINICAL PORTALS (DOCTOR, NURSE, KIOSK) */}
            {!isFullBleedPortal && (
            <aside id="workspace-navigation" aria-label="Workspace navigation" className={`
                ${isCollapsed ? 'w-20' : 'w-60'} ayu-global-sidebar bg-sidebar border-r border-slate-200 flex flex-col shrink-0 h-screen fixed lg:static z-50
                transform transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : 'invisible -translate-x-full lg:visible lg:translate-x-0'}
            `}>
                <div className={`p-4 border-b border-slate-200 flex justify-between items-center ${isCollapsed ? 'lg:justify-center' : ''}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <img
                            src="/assets/logo-jeevika.png"
                            alt="Jeevika"
                            title={getBrandName()}
                            className={`${isCollapsed ? 'h-7' : 'h-8'} w-auto object-contain shrink-0`}
                        />
                        {!isCollapsed && (
                            <div className="flex flex-col min-w-0 ayu-sidebar-brand">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold truncate">
                                    {isClinicalPortal ? 'Clinical workspace' : isClinicPortal ? 'Clinic operations' : 'Headquarters'}
                                </span>
                            </div>
                        )}
                    </div>
                    <button type="button" aria-label="Close workspace menu" className="lg:hidden p-2 text-slate-500" onClick={() => setIsMobileMenuOpen(false)}>
                        <SymbolIcon className="material-symbols-outlined">close</SymbolIcon>
                    </button>
                </div>

                <button
                    type="button"
                    className={`ayu-sidebar-collapse hidden lg:flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-4 gap-2.5'} py-2 text-[11px] font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100`}
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <SymbolIcon className="material-symbols-outlined text-[18px]">
                        {isCollapsed ? "chevron_right" : "chevron_left"}
                    </SymbolIcon>
                    {!isCollapsed && <span className="ayu-nav-label">Collapse navigation</span>}
                </button>
                <div className="flex-1 overflow-y-auto no-scrollbar py-4 px-2 space-y-1">
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

                </div>

                <div className={`p-3 border-t border-slate-200 mt-auto shrink-0 bg-white ${isCollapsed ? 'space-y-2' : 'space-y-1'}`}>

                    {isCollapsed ? (
                        <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-100">
                            <div
                                title={`${userProfile?.full_name || 'Doctor'} (${getBrandSubtitle()})`}
                                className="w-9 h-9 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs ring-2 ring-teal-50 shadow-sm cursor-default"
                            >
                                {userProfile?.full_name?.[0] || 'D'}
                            </div>
                            <button
                                onClick={onLogout}
                                title="Sign Out"
                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-95"
                            >
                                <SymbolIcon className="material-symbols-outlined text-[18px] text-rose-500">logout</SymbolIcon>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/60 mt-1">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-white shadow-sm">
                                    {userProfile?.full_name?.[0] || 'C'}
                                </div>
                                <div className="overflow-hidden min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 truncate">{userProfile?.full_name || 'Chief Medical Officer, MD, DM'}</p>
                                    <p className="text-[10px] text-slate-400 font-mono truncate">{getBrandSubtitle()}</p>
                                </div>
                            </div>
                            <button
                                onClick={onLogout}
                                title="Sign Out"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                            >
                                <SymbolIcon className="material-symbols-outlined text-lg text-rose-500">logout</SymbolIcon>
                            </button>
                        </div>
                    )}
                </div>
            </aside>
            )}

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 min-w-0 overflow-y-auto bg-white flex flex-col relative w-full">

                {/* HEADER */}
                {view !== 'patient-kiosk' && (
                <header className="ayu-workspace-header h-20 border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 bg-white/95 backdrop-blur-md z-30 shrink-0">
                    <div className="ayu-workspace-heading flex items-center gap-4">
                        {!isFullBleedPortal && (
                            <button type="button" aria-label="Open workspace menu" aria-controls="workspace-navigation" aria-expanded={isMobileMenuOpen} className="lg:hidden shrink-0 p-2.5 -ml-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center justify-center" onClick={() => setIsMobileMenuOpen(true)}>
                                <SymbolIcon className="material-symbols-outlined text-[24px]">menu</SymbolIcon>
                            </button>
                        )}
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
                        {/* HEADER USER PROFILE BADGE & LOGOUT */}
                        <div className="ayu-workspace-account flex items-center gap-2 pl-3 border-l border-slate-200">
                            <div
                                title={`${userProfile?.full_name || 'Chief Medical Officer, MD, DM'} (${getBrandSubtitle()})`}
                                className="ayu-workspace-avatar w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm shrink-0"
                            >
                                {userProfile?.full_name?.[0] || 'C'}
                            </div>
                            <div className="hidden xl:flex flex-col text-left">
                                <span className="text-xs font-bold text-slate-800 leading-none truncate max-w-[130px]">{userProfile?.full_name || 'Chief Medical Officer, MD, DM'}</span>
                                <span className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{getBrandSubtitle()}</span>
                            </div>
                            <button
                                onClick={onLogout}
                                title="Sign Out"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                            >
                                <SymbolIcon className="material-symbols-outlined text-[18px]">logout</SymbolIcon>
                            </button>
                        </div>
                        {/* We leave the top right action area primarily to the child components, 
                        but we can provide a container for them if needed later. */}
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
