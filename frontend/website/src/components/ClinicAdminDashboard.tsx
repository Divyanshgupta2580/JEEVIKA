import { SymbolIcon } from "@/components/ui/SymbolIcon";
import { useState, useMemo } from 'react'
import {
    RefreshCw,
    Search,
    X,
    TrendingUp,
    TrendingDown,
    ArrowLeft,
    ShieldCheck,
    AlertTriangle,
    Clock,
    Receipt,
    Package,
    Users,
    Zap,
    ChevronRight,
    FileText,
    CheckCircle2,
    Building2,
    MapPin,
    UserCheck,
    Radio
} from 'lucide-react'
import { staffApi, useStaffData } from '@/lib/staffApi'
import type { HqClinic, HqFinance, HqSale, HqStock } from '../../../../packages/shared/hq-command'
import type { ClinicalReceipt } from '../../../../packages/shared/clinical-receipt'
import { clinicMoney, clinicPostedStock, clinicRevenueDays, clinicRevenueTrend } from '@/features/clinic-operations/telemetry'
import { useHospital } from '@/context/HospitalContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/basic'
import { ClinicalReceiptModal } from '@/components/ui/ClinicalReceiptDetails'
import '@/design-system/clinic-ops.css'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from 'recharts'

type View = 'selection' | 'staff' | 'admin' | 'inventory-dashboard' | 'setup' | 'hospitals' | 'audit_logs' | 'pos' | 'shift-management' | 'ipd';

interface ClinicAdminDashboardProps {
    clinicId: string;
    onBack?: () => void;
    hqBranch?: boolean;
    onNavigate?: (view: View) => void;
}

const PAYMENT_COLOR_MAP: Record<string, { fill: string; gradStart: string; gradEnd: string; badge: string }> = {
    UPI: { fill: '#5b61d6', gradStart: '#7379e8', gradEnd: '#494fc2', badge: 'bg-[#eef0fc] text-[#3f45ad] border-[#d3d6f7]' },
    CASH: { fill: '#059669', gradStart: '#10b981', gradEnd: '#047857', badge: 'bg-[#dff4ed] text-[#087466] border-[#bbe5d6]' },
    CARD: { fill: '#0284c7', gradStart: '#38bdf8', gradEnd: '#0369a1', badge: 'bg-[#e8f4fa] text-[#0369a1] border-[#bfe3f2]' },
    INSURANCE: { fill: '#7c3aed', gradStart: '#a78bfa', gradEnd: '#6d28d9', badge: 'bg-[#f3eefc] text-[#6b3fa0] border-[#decff6]' },
    IPD_BILL: { fill: '#d97706', gradStart: '#fbbf24', gradEnd: '#b45309', badge: 'bg-[#fef3d6] text-[#9a5b0a] border-[#f4db9c]' },
    OTHER: { fill: '#64748b', gradStart: '#94a3b8', gradEnd: '#475569', badge: 'bg-[#f3f4ef] text-[#4b635b] border-[#dfdfd2]' }
};

const postedSale = (sale: HqSale) => ({
    id: sale.id, timestamp: sale.recordedAt, businessDay: sale.businessDay, grossPaise: sale.grossPaise,
    payments: sale.payments, sale_type: 'PHARMACY', payment_mode: sale.payments.map(payment => payment.method.toUpperCase()).join(' + '),
});

export function ClinicAdminDashboard({ clinicId, onBack, onNavigate, hqBranch = false }: ClinicAdminDashboardProps) {
    const { setPendingRestockId } = useHospital();
    const [revision, setRevision] = useState(0);
    const [dateRange, setDateRange] = useState<'week' | 'month'>('week');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSaleType, setSelectedSaleType] = useState('all');
    const [selectedPaymentMode, setSelectedPaymentMode] = useState('all');
    const [activePieIndex, setActivePieIndex] = useState<number | null>(null);
    const scope = encodeURIComponent(clinicId);
    const base = '/clinical/command/hq';
    const finance = `${base}/finance?clinic=${scope}`;
    const { data: branch, error: branchError } = useStaffData<{ clinic: HqClinic }>(`${base}/branches/${scope}`, revision);
    const { data: stock, error: stockError } = useStaffData<HqStock>(`${base}/stock?clinic=${scope}`, revision);
    const { data: today, error: todayError } = useStaffData<HqFinance>(`${finance}&period=today`, revision);
    const { data: duty, error: dutyError } = useStaffData<{ status: 'unavailable' | 'verified'; onDuty: number | null; reason?: string }>(`${base}/branches/${scope}/duty`, revision);
    const hasActiveFilters = Boolean(searchQuery.trim() || selectedSaleType !== 'all' || selectedPaymentMode !== 'all');
    const query = new URLSearchParams({ clinic: clinicId, period: dateRange });
    if (searchQuery.trim()) query.set('receipt', searchQuery.trim());
    if (selectedSaleType !== 'all') query.set('service', selectedSaleType);
    if (selectedPaymentMode !== 'all') query.set('payment', selectedPaymentMode.toLowerCase());
    const { data: period, error: periodError } = useStaffData<HqFinance>(`${base}/finance?${query}`, revision);

    const dayCount = dateRange === 'week' ? 7 : 30;
    const clinicData = branch?.clinic;
    const loading = !branch && !branchError;
    const refreshing = (!today && !todayError) || (!stock && !stockError) || (!period && !periodError);
    const dailySales = (today?.sales ?? []).map(postedSale);
    const filteredTransactions = (period?.sales ?? []).map(postedSale);
    const weeklyData = useMemo(() => clinicRevenueDays(period, dayCount), [period, dayCount]);
    const revenueTrend = clinicRevenueTrend(today?.grossPaise, weeklyData);
    const { skuCount, lowStock, criticalStock, nearExpiryBatches } = useMemo(() => clinicPostedStock(stock), [stock]);
    const [selectedStockItem, setSelectedStockItem] = useState<typeof lowStock[number]>();
    const [selectedReceipt, setSelectedReceipt] = useState<ClinicalReceipt>();
    const [isReceiptLoading, setIsReceiptLoading] = useState(false);
    const [receiptError, setReceiptError] = useState('');
    const managerName = clinicData?.managerName ?? 'Unassigned';
    const paymentBreakdown = (today?.paymentSummary ?? []).map(payment => ({
        key: payment.method.toUpperCase(), name: payment.method === 'cash' ? 'Cash' : payment.method.toUpperCase(),
        value: payment.amountPaise, count: payment.saleCount,
    }));
    const cashCount = paymentBreakdown.find(payment => payment.key === 'CASH')?.count ?? 0;
    const hasOtherPayments = paymentBreakdown.some(payment => payment.key !== 'CASH');
    const stockStatus = stock ? 'Stock unconfigured' : stockError ? 'Stock unavailable' : 'Loading inventory';
    const totalBreakdownAmount = paymentBreakdown.reduce((sum, payment) => sum + payment.value, 0);
    const totalPeriodVisits = period?.saleCount;
    const totalPeriodRevenue = period?.grossPaise;
    const saleCount = today?.saleCount;
    const averageTicket = today?.saleCount ? Math.round(today.grossPaise / today.saleCount) : undefined;
    const status = (value: unknown, error?: string) => value ? 'verified' : error ? 'unavailable' : 'loading';
    const formatMoney = (value: number | undefined) => value === undefined ? 'Unavailable' : clinicMoney(value);

    async function openReceipt(sale: ReturnType<typeof postedSale>) {
        if (isReceiptLoading) return;
        setReceiptError('');
        setIsReceiptLoading(true);
        try {
            const document = await staffApi<ClinicalReceipt>(
                `${base}/finance/branches/${scope}/receipts/${encodeURIComponent(sale.id)}?day=${sale.businessDay}`,
            );
            setSelectedReceipt(document);
        } catch (error) {
            setReceiptError(error instanceof Error ? error.message : 'Receipt unavailable.');
        } finally {
            setIsReceiptLoading(false);
        }
    }

    function handleFastReorder(itemId: string) {
        if (hqBranch) return;
        setPendingRestockId(itemId);
        onNavigate?.('inventory-dashboard');
    }

    if (loading) {
        return (
            <div className="jvk-admin-page jvk-clinic-ops-page jvk-clinic-hub-page space-y-6 animate-in fade-in duration-300 max-w-[1600px] mx-auto pb-12">
                {/* 1. Cockpit Header Skeleton */}
                <div className="jvk-clinic-hub-card p-5 lg:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-14 w-14 rounded-2xl bg-[#E8EFE6]" />
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-2.5">
                                    <Skeleton className="h-7 w-52 bg-[#E8EFE6]" />
                                    <Skeleton className="h-5 w-24 rounded-full bg-[#E8EFE6]" />
                                </div>
                                <Skeleton className="h-4 w-80 max-w-full bg-[#EFEFE5]" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-36 rounded-xl bg-[#EFEFE5]" />
                            <Skeleton className="h-10 w-40 rounded-xl bg-[#DCECE4]" />
                        </div>
                    </div>
                </div>

                {/* 2. Fast Navigation Skeleton */}
                <div className="jvk-clinic-hub-card p-4 space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-[#E4E5DA]">
                        <Skeleton className="h-4 w-32 bg-[#E8EFE6]" />
                        <Skeleton className="h-3.5 w-36 bg-[#EFEFE5]" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                        {Array.from({ length: 5 }).map((_, idx) => (
                            <Skeleton key={idx} className="h-16 w-full rounded-xl bg-[#F1F3EA]" />
                        ))}
                    </div>
                </div>

                {/* 3. KPI Cards Skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="jvk-clinic-hub-kpi p-5 lg:p-6 space-y-3">
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-10 w-10 rounded-xl bg-[#E8EFE6]" />
                                <Skeleton className="h-6 w-20 rounded-full bg-[#EFEFE5]" />
                            </div>
                            <Skeleton className="h-3.5 w-28 bg-[#EFEFE5]" />
                            <Skeleton className="h-8 w-32 bg-[#E8EFE6]" />
                            <Skeleton className="h-3.5 w-44 bg-[#EFEFE5]" />
                        </div>
                    ))}
                </div>

                {/* 4. Analytics Panels Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 jvk-clinic-hub-card p-6 lg:p-7 space-y-4">
                        <div className="flex justify-between items-center mb-3">
                            <Skeleton className="h-6 w-56 bg-[#E8EFE6]" />
                            <Skeleton className="h-9 w-44 rounded-xl bg-[#EFEFE5]" />
                        </div>
                        <Skeleton className="h-64 w-full rounded-2xl bg-[#F3F4EC]" />
                        <Skeleton className="h-16 w-full rounded-2xl bg-[#EFEFE5]" />
                    </div>
                    <div className="lg:col-span-4 jvk-clinic-hub-card p-6 lg:p-7 space-y-4">
                        <Skeleton className="h-6 w-40 bg-[#E8EFE6]" />
                        <Skeleton className="h-44 w-44 mx-auto rounded-full bg-[#EFEFE5]" />
                        <div className="space-y-2.5 pt-2">
                            <Skeleton className="h-4 w-full bg-[#EFEFE5]" />
                            <Skeleton className="h-4 w-5/6 bg-[#EFEFE5]" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!clinicData && branchError) return (
        <section className="jvk-clinic-hub-card p-5">
            {onBack && <button type="button" onClick={onBack} className="jvk-admin-secondary-btn">HQ Network</button>}
            <p role="alert">Branch unavailable. {branchError}</p>
            <button type="button" onClick={() => setRevision(value => value + 1)} className="jvk-admin-secondary-btn">Retry branch</button>
        </section>
    );

    return (
        <div className="jvk-admin-page jvk-clinic-ops-page jvk-clinic-hub-page space-y-6 animate-in fade-in duration-300 max-w-[1600px] mx-auto pb-12">
            {/* 1. CLINIC OPERATIONS HUB IDENTITY HEADER */}
            <div className="jvk-clinic-hub-card p-5 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                aria-label="Back to HQ Network"
                                className="group inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#FAF7F0] hover:bg-[#E8F1E5] active:scale-95 text-[#103B32] border border-[#E4E5DA] transition-all font-semibold text-xs shrink-0"
                                title="Back to Jeevika Central Hospital Network (HQ)"
                            >
                                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                                <span className="hidden sm:inline">HQ Network</span>
                            </button>
                        )}
                        <div className="relative shrink-0">
                            <div className="w-14 h-14 rounded-2xl bg-[#087466] flex items-center justify-center text-white shadow-[0_8px_20px_rgba(8,116,102,0.22)]">
                                <Building2 className="w-7 h-7" />
                            </div>
                            <span
                                className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5"
                                title="Clinic verified"
                            >
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#10B981] border-2 border-[#FFFDF9]" />
                            </span>
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl sm:text-2xl font-bold text-[#103B32] tracking-tight">
                                    {hqBranch ? clinicData?.name : 'Clinic Operations Hub'}
                                </h1>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E5F1E3] text-[#087466] border border-[#C6DFC9]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                                    {clinicData?.status === 'paused' ? 'Paused' : 'Operational'}
                                </span>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#FAF7F0] text-[#556D65] border border-[#E4E5DA]">
                                    ID: {clinicId.slice(0, 8)}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#556D65] font-medium mt-1.5">
                                <span className="inline-flex items-center gap-1.5 text-[#103B32] font-semibold">
                                    <MapPin className="w-3.5 h-3.5 text-[#087466] shrink-0" />
                                    {[!hqBranch && clinicData?.name, clinicData?.address].filter(Boolean).join(' · ') || 'Address unrecorded'}
                                </span>
                                <span className="text-[#D2D6C8]" aria-hidden="true">|</span>
                                <span className="inline-flex items-center gap-1.5 text-[#556D65]">
                                    <UserCheck className="w-3.5 h-3.5 text-[#087466] shrink-0" />
                                    Manager: <strong className="text-[#103B32] font-semibold">{managerName}</strong>
                                </span>
                                <span className="text-[#D2D6C8]" aria-hidden="true">|</span>
                                <span className="inline-flex items-center gap-1.5 text-[#556D65] tabular-nums">
                                    <Radio className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                                    <span role="status">D1 ledger {status(today, todayError)} · Stock {status(stock, stockError)}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Cockpit Actions Cluster */}
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={() => setRevision(value => value + 1)}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] hover:bg-[#E8F1E5] active:scale-[0.98] text-xs font-bold text-[#103B32] border border-[#E4E5DA] transition-all disabled:opacity-50"
                            title="Force Telemetry Sync"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 text-[#087466] ${refreshing ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Sync Cloudflare D1</span>
                            <span className="sm:hidden">Sync D1</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onNavigate?.('pos')}
                            disabled={hqBranch}
                            title={hqBranch ? 'Checkout requires a cashier or clinic administrator at this clinic' : undefined}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#087466] hover:bg-[#065C51] active:scale-[0.98] text-xs font-bold text-white shadow-[0_6px_16px_rgba(8,116,102,0.2)] transition-all"
                        >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Quick POS Checkout</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. FAST NAVIGATION (1-CLICK DOCK) */}
            <div className="jvk-clinic-hub-card p-3.5 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1.5 pb-2.5 mb-3 border-b border-[#E4E5DA]">
                    <div className="flex items-center gap-2">
                        <SymbolIcon className="material-symbols-outlined text-[#087466] text-[18px]">bolt</SymbolIcon>
                        <span className="text-[11px] font-bold text-[#103B32] uppercase tracking-[0.08em]">Fast Navigation</span>
                    </div>
                    <span className="text-[11px] text-[#556D65] font-medium">1-Click Direct Hub Access</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    <button
                        type="button"
                        onClick={() => onNavigate?.('pos')}
                            disabled={hqBranch}
                            title={hqBranch ? 'Checkout requires a cashier or clinic administrator at this clinic' : undefined}
                        className="jvk-clinic-hub-nav-tile jvk-clinic-hub-nav-tile--featured col-span-2 sm:col-span-1 flex items-center gap-3 p-3 active:scale-[0.98] text-left group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-white/15 text-white flex items-center justify-center shrink-0">
                            <SymbolIcon className="material-symbols-outlined text-[21px]">point_of_sale</SymbolIcon>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold leading-snug text-white">POS Billing</p>
                            <p className="text-[11px] text-[#D4EFE6] leading-tight mt-0.5">Counter Checkout</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => onNavigate?.('inventory-dashboard')}
                        className="jvk-clinic-hub-nav-tile flex items-center gap-3 p-3 active:scale-[0.98] text-left group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-[#FEF6E0] text-[#B87414] border border-[#F4DFAA] flex items-center justify-center shrink-0">
                            <SymbolIcon className="material-symbols-outlined text-[21px]">inventory_2</SymbolIcon>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold leading-snug text-[#103B32]">Inventory Control</p>
                            <p className="text-[11px] text-[#556D65] leading-tight mt-0.5">FEFO & Batches</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => onNavigate?.('staff')}
                        className="jvk-clinic-hub-nav-tile flex items-center gap-3 p-3 active:scale-[0.98] text-left group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-[#DFF4ED] text-[#087466] border border-[#BFE6D8] flex items-center justify-center shrink-0">
                            <SymbolIcon className="material-symbols-outlined text-[21px]">badge</SymbolIcon>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold leading-snug text-[#103B32]">Staff Attendance</p>
                            <p className="text-[11px] text-[#556D65] leading-tight mt-0.5">Roster & Logs</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => onNavigate?.('shift-management')}
                        className="jvk-clinic-hub-nav-tile flex items-center gap-3 p-3 active:scale-[0.98] text-left group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-[#E5F1E3] text-[#156C56] border border-[#C6DFC9] flex items-center justify-center shrink-0">
                            <SymbolIcon className="material-symbols-outlined text-[21px]">schedule</SymbolIcon>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold leading-snug text-[#103B32]">Shift Management</p>
                            <p className="text-[11px] text-[#556D65] leading-tight mt-0.5">Duty Timetable</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => onNavigate?.('ipd')}
                        className="jvk-clinic-hub-nav-tile col-span-2 sm:col-span-1 flex items-center gap-3 p-3 active:scale-[0.98] text-left group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-[#F3EEFC] text-[#6B4E9B] border border-[#DFD2F5] flex items-center justify-center shrink-0">
                            <SymbolIcon className="material-symbols-outlined text-[21px]">hotel</SymbolIcon>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold leading-snug text-[#103B32]">IPD Inpatients</p>
                            <p className="text-[11px] text-[#556D65] leading-tight mt-0.5">Beds & Admissions</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* 3. OPERATIONAL KPI CARDS (4-CARD GRID) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5">
                {/* CARD 1: TODAY'S REVENUE */}
                <Dialog>
                    <DialogTrigger asChild>
                        <button
                            type="button"
                            className="jvk-clinic-hub-kpi jvk-clinic-hub-kpi--interactive p-4 sm:p-5 xl:p-6 text-left cursor-pointer group flex flex-col justify-between w-full"
                        >
                            <div className="w-full">
                                <div className="flex items-center justify-between gap-2 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-[#E8F1E5] text-[#087466] border border-[#CBE0D2] flex items-center justify-center shrink-0">
                                        <SymbolIcon className="material-symbols-outlined text-[20px]">payments</SymbolIcon>
                                    </div>
                                    {revenueTrend.hasBaseline ? (
                                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full tabular-nums border whitespace-nowrap ${revenueTrend.positive ? 'bg-[#DFF4ED] text-[#087466] border-[#BBE5D6]' : 'bg-[#FCEEEF] text-[#BE3144] border-[#F4C7CD]'}`}>
                                            {revenueTrend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                            {revenueTrend.percent}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#FAF7F0] text-[#556D65] border border-[#E4E5DA] whitespace-nowrap">
                                            {revenueTrend.percent}
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[11px] font-bold text-[#556D65] uppercase tracking-[0.06em]">Today's Revenue</p>
                                    <h3 className="text-2xl sm:text-[28px] font-bold text-[#103B32] tracking-tight tabular-nums">
                                        {formatMoney(today?.grossPaise)}
                                    </h3>
                                    <p className="text-[11px] text-[#556D65] font-medium">
                                        {today ? `Net revenue ${clinicMoney(today.revenuePaise)} · Asia/Kolkata` : todayError ?? 'Loading posted collections'}
                                    </p>
                                    {today && (
                                        <div className="pt-2 flex flex-col gap-1 border-t border-[#E4E5DA] mt-2">
                                            <div className="flex items-center justify-between text-[10px]">
                                                <span className="text-[#556D65]">Margin before expenses</span>
                                                <strong className="text-[#087466] font-mono tabular-nums">{clinicMoney(today.revenuePaise - today.cogsPaise)}</strong>
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] text-[#087466] font-semibold">
                                                <ShieldCheck className="w-3 h-3 text-[#087466] shrink-0" />
                                                <span>Double-entry ledger {today.unreconciledSales || today.debitPaise !== today.creditPaise ? 'requires review' : today.journalCount ? 'reconciled' : 'has no postings today'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="w-full mt-5 pt-3.5 border-t border-[#E4E5DA] flex items-center justify-between gap-2">
                                <span className="text-[11px] text-[#556D65] font-medium whitespace-nowrap">Breakdown</span>
                                <span className="text-[11px] xl:text-xs font-bold text-[#087466] group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                                    View Modal →
                                </span>
                            </div>
                        </button>
                    </DialogTrigger>

                    {/* Today's Transactions Dialog View */}
                    <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-[#FFFDF8] text-[#103B32] rounded-3xl border border-[#E4E5DA] shadow-2xl p-6">
                        <DialogHeader className="border-b border-[#E4E5DA] pb-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <DialogTitle className="text-xl font-bold text-[#103B32] flex items-center gap-2.5">
                                    <img
                                        src="/assets/logo-jeevika.png"
                                        alt="Jeevika"
                                        className="h-6 w-auto object-contain shrink-0"
                                    />
                                    <span>Today's Revenue Journal & Settlements</span>
                                </DialogTitle>
                                <span className="text-xs font-bold bg-[#DFF4ED] text-[#087466] px-3 py-1 rounded-full border border-[#BBE5D6] tabular-nums">
                                    Total {formatMoney(today?.grossPaise)}
                                </span>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-auto mt-4 pr-1">
                            {receiptError && <p role="alert" className="text-xs text-[#BE3144]">{receiptError}</p>}
                            {today?.salesTruncated && <p className="mb-3 text-xs">Latest 500 posted sales shown. Use receipt search for earlier references.</p>}
                            {dailySales.length === 0 ? (
                                <div className="text-center py-16 text-[#556D65] font-medium">
                                    <Receipt className="w-12 h-12 mx-auto mb-2 text-[#9AAEA6]" />
                                    {today ? 'No pharmacy transactions recorded today.' : todayError ?? 'Loading transactions…'}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-[#E4E5DA] overflow-x-auto bg-[#FFFDFB]">
                                    <table className="w-full min-w-[600px] text-xs text-left">
                                        <thead className="bg-[#FAF7F0] border-b border-[#E4E5DA]">
                                            <tr>
                                                <th className="px-4 py-3 font-bold text-[#556D65] uppercase tracking-wider">Receipt reference</th>
                                                <th className="px-4 py-3 font-bold text-[#556D65] uppercase tracking-wider">Classification & Mode</th>
                                                <th className="px-4 py-3 font-bold text-[#556D65] uppercase tracking-wider text-right">Amount</th>
                                                <th className="px-4 py-3 font-bold text-[#556D65] uppercase tracking-wider text-center w-16">Receipt</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#EAEBE0]">
                                            {dailySales.map((sale) => (
                                                <tr key={sale.id} className="hover:bg-[#FAF7F0]/80 transition-colors">
                                                    <td className="px-4 py-3.5">
                                                        <p className="font-bold text-[#103B32]">{sale.id}</p>
                                                        <p className="text-[11px] text-[#556D65] mt-0.5">{sale.businessDay}</p>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E5F1E3] text-[#087466] border border-[#C6DFC9]">
                                                                {sale.sale_type}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#FAF7F0] text-[#556D65] border border-[#E4E5DA]">
                                                                {sale.payment_mode || 'Unrecorded'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-bold text-[#103B32] text-sm tabular-nums">
                                                        {clinicMoney(sale.grossPaise)}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => openReceipt(sale)}
                                                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#556D65] hover:text-[#087466] hover:bg-[#E8F1E5] transition-colors"
                                                            disabled={isReceiptLoading}
                                                            title="View Tax Receipt"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* CARD 2: TOTAL TRANSACTIONS */}
                <div className="jvk-clinic-hub-kpi p-4 sm:p-5 xl:p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-[#E8F1E5] text-[#087466] border border-[#CBE0D2] flex items-center justify-center shrink-0">
                                <Receipt className="w-5 h-5" />
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#DFF4ED] text-[#087466] border border-[#BBE5D6] tabular-nums whitespace-nowrap">
                                {averageTicket === undefined ? 'No average' : `Avg ${clinicMoney(averageTicket)}`}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] font-bold text-[#556D65] uppercase tracking-[0.06em]">Total Transactions</p>
                            <h3 className="text-2xl sm:text-[28px] font-bold text-[#103B32] tracking-tight tabular-nums">
                                {saleCount ?? (todayError ? 'Unavailable' : 'Loading')} <span className="text-sm sm:text-base font-semibold text-[#556D65]">Bills</span>
                            </h3>
                            <p className="text-[11px] text-[#556D65] font-medium">Today's billing counter volume</p>
                        </div>
                    </div>
                    <div className="mt-5 pt-3.5 border-t border-[#E4E5DA] flex items-center justify-between gap-2 text-[11px] xl:text-xs text-[#103B32] font-medium tabular-nums">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full bg-[#5B61D6]" />
                            {hasOtherPayments ? 'Other recorded modes shown below' : 'Cash checkout only'}
                        </span>
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full bg-[#059669]" />
                            {today ? `${cashCount} Cash` : 'Cash count unavailable'}
                        </span>
                    </div>
                </div>

                {/* CARD 3: ACTIVE STAFF ON DUTY */}
                <button
                    type="button"
                    onClick={() => onNavigate?.('staff')}
                    className="jvk-clinic-hub-kpi jvk-clinic-hub-kpi--interactive p-4 sm:p-5 xl:p-6 text-left cursor-pointer group flex flex-col justify-between w-full"
                >
                    <div className="w-full">
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-[#E8F1E5] text-[#087466] border border-[#CBE0D2] flex items-center justify-center shrink-0">
                                <Users className="w-5 h-5" />
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#DFF4ED] text-[#087466] border border-[#BBE5D6] whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                                {duty?.status === 'verified' ? 'Attendance verified' : 'Attendance unavailable'}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] font-bold text-[#556D65] uppercase tracking-[0.06em]">Active Staff on Duty</p>
                            <h3 className="text-2xl sm:text-[28px] font-bold text-[#103B32] tracking-tight tabular-nums">
                                {duty?.onDuty ?? (duty || dutyError ? 'Unavailable' : 'Loading')}
                            </h3>
                            <p className="text-[11px] text-[#556D65] font-medium">{duty?.status === 'unavailable' ? 'Attendance tracking is not configured.' : dutyError ?? 'Current clinic attendance'}</p>
                        </div>
                    </div>
                    <div className="w-full mt-5 pt-3.5 border-t border-[#E4E5DA] flex items-center justify-between gap-2">
                        <span className="text-[11px] xl:text-xs font-bold text-[#087466] group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                            Manage Roster →
                        </span>
                    </div>
                </button>

                {/* CARD 4: LOW STOCK ALERTS */}
                <div
                    onClick={() => onNavigate?.('inventory-dashboard')}
                    className="jvk-clinic-hub-kpi jvk-clinic-hub-kpi--interactive p-4 sm:p-5 xl:p-6 cursor-pointer group flex flex-col justify-between"
                >
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                                lowStock.length > 0
                                    ? 'bg-[#FEF6E0] text-[#B87414] border-[#F4DFAA]'
                                    : skuCount === 0
                                        ? 'bg-[#FAF7F0] text-[#556D65] border-[#E4E5DA]'
                                        : 'bg-[#E8F1E5] text-[#087466] border-[#CBE0D2]'
                            }`}>
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate?.('inventory-dashboard');
                                }}
                                className="text-[11px] font-bold text-[#087466] hover:text-[#065C51] bg-[#E8F1E5] hover:bg-[#D5E9D6] border border-[#CBE0D2] px-2.5 py-1 rounded-full transition-colors whitespace-nowrap"
                            >
                                Fast Restock
                            </button>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] font-bold text-[#556D65] uppercase tracking-[0.06em]">Low Stock Alert Items</p>
                            <h3 className={`text-2xl sm:text-[28px] font-bold tracking-tight tabular-nums ${
                                lowStock.length > 0
                                    ? 'text-[#B87414]'
                                    : skuCount === 0
                                        ? 'text-[#103B32]'
                                        : 'text-[#087466]'
                            }`}>
                                {skuCount ? lowStock.length : stockStatus} <span className="text-sm sm:text-base font-semibold text-[#556D65]">{skuCount > 0 && 'SKUs'}</span>
                            </h3>
                            <p className="text-[11px] text-[#556D65] font-medium">
                                {skuCount === 0
                                    ? stockError ?? 'Add stock batches to monitor this clinic'
                                    : criticalStock.length > 0
                                        ? `${criticalStock.length} critical depleted (<5 units)`
                                        : lowStock.length > 0
                                            ? `${lowStock.length} SKUs below safety stock`
                                            : 'All shelf levels within target'}
                            </p>
                        </div>
                    </div>
                    <div className="mt-5 pt-3.5 border-t border-[#E4E5DA] space-y-2">
                        <div className="w-full bg-[#EAEBE0] rounded-full h-1.5 overflow-hidden">
                            {skuCount > 0 && (
                                <div
                                    className={`h-1.5 rounded-full transition-all duration-500 ${lowStock.length > 0 ? 'bg-[#D97706]' : 'bg-[#087466]'}`}
                                    style={{ width: `${lowStock.length > 0 ? (lowStock.length / skuCount) * 100 : 100}%` }}
                                />
                            )}
                        </div>
                        <div className="flex justify-between items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                            <span className={`truncate ${lowStock.length > 0 ? 'text-[#B87414]' : skuCount === 0 ? 'text-[#556D65]' : 'text-[#087466]'}`}>
                                {skuCount === 0 ? stockStatus : lowStock.length > 0 ? 'Action Required' : 'At or above safety stock'}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate?.('inventory-dashboard');
                                }}
                                className="text-[#087466] group-hover:translate-x-0.5 transition-transform whitespace-nowrap shrink-0"
                            >
                                Control Hub →
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. TELEMETRY CHARTS (RECHARTS): REVENUE TRAJECTORY + PAYMENT MODES */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* REVENUE & VOLUME TRAJECTORY (AREA CHART - 8 COLS) */}
                <div className="lg:col-span-8 jvk-clinic-hub-card p-5 sm:p-6 lg:p-7 flex flex-col justify-between">
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#087466]" />
                                    <h2 className="text-base sm:text-lg font-bold text-[#103B32] tracking-tight">Revenue & Patient Flow Trajectory</h2>
                                </div>
                                <p className="text-xs text-[#556D65] mt-1 tabular-nums">
                                    Posted activity for the selected period · {totalPeriodVisits === undefined ? periodError ?? 'Loading' : `${totalPeriodVisits} pharmacy sales · Asia/Kolkata`}
                                </p>
                            </div>

                            <div className="flex items-center gap-1 bg-[#FAF7F0] p-1 rounded-xl border border-[#E4E5DA] self-start sm:self-auto shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setDateRange('week')}
                                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${dateRange === 'week' ? 'bg-[#FFFDFB] text-[#103B32] shadow-xs border border-[#E4E5DA]' : 'text-[#556D65] hover:text-[#103B32]'}`}
                                >
                                    Last 7 Days
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDateRange('month')}
                                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${dateRange === 'month' ? 'bg-[#FFFDFB] text-[#103B32] shadow-xs border border-[#E4E5DA]' : 'text-[#556D65] hover:text-[#103B32]'}`}
                                >
                                    Last 30 Days
                                </button>
                            </div>
                        </div>

                        <div className="h-[245px] sm:h-[260px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <AreaChart data={weeklyData} margin={{ top: 10, right: 20, left: -14, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="clinicRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#087466" stopOpacity={0.22} />
                                            <stop offset="95%" stopColor="#087466" stopOpacity={0.0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAECE2" />
                                    <XAxis
                                        dataKey="name"
                                        padding={{ left: 8, right: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#556D65', fontSize: 11, fontWeight: 600 }}
                                        dy={8}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#7B8F88', fontSize: 10, fontWeight: 600 }}
                                        tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                                    />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-[#103B32] text-[#FFFDFB] p-3.5 rounded-2xl shadow-xl border border-[#245A4E] text-xs">
                                                        <p className="font-semibold text-[#B9D5CB] text-[10px] uppercase tracking-wider mb-1">
                                                            {data.fullDate || data.name}
                                                        </p>
                                                        <div className="space-y-1 tabular-nums">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <span className="text-[#D4EFE6]">Revenue:</span>
                                                                <span className="font-bold text-[#7EE2BA] text-sm">{clinicMoney(data.grossPaise)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-4">
                                                                <span className="text-[#B9D5CB]">Pharmacy sales</span>
                                                                <span className="font-bold text-white">{data.visits || 0}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#087466"
                                        strokeWidth={2.5}
                                        fillOpacity={1}
                                        fill="url(#clinicRevenueGradient)"
                                        name="Daily Revenue"
                                        animationDuration={900}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Period Summary Strip Below Chart */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 p-4 rounded-2xl bg-[#FAF7F0] border border-[#E4E5DA]">
                        <div>
                            <p className="text-[10px] font-bold text-[#556D65] uppercase tracking-[0.06em]">Period Revenue</p>
                            <p className="text-base font-bold text-[#103B32] mt-0.5 tabular-nums">{formatMoney(totalPeriodRevenue)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[#556D65] uppercase tracking-[0.06em]">Daily Average</p>
                            <p className="text-base font-bold text-[#103B32] mt-0.5 tabular-nums">
                                {formatMoney(totalPeriodRevenue === undefined ? undefined : Math.round(totalPeriodRevenue / dayCount))}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[#556D65] uppercase tracking-[0.06em]">Pharmacy sales</p>
                            <p className="text-base font-bold text-[#087466] mt-0.5 tabular-nums">{totalPeriodVisits ?? 'Unavailable'}</p>
                        </div>
                    </div>
                </div>

                {/* PAYMENT MODE DISTRIBUTION (DONUT CHART - 4 COLS) */}
                <div className="lg:col-span-4 jvk-clinic-hub-card p-5 sm:p-6 lg:p-7 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-[#103B32] tracking-tight">Payment Channel Split</h2>
                                <p className="text-xs text-[#556D65] mt-0.5">Recorded payment amounts · Cash checkout</p>
                            </div>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FAF7F0] text-[#556D65] border border-[#E4E5DA]">Today</span>
                        </div>

                        {/* DONUT CHART OR HONEST EMPTY RING */}
                        <div className="relative my-3 flex items-center justify-center min-h-[190px]">
                            {totalBreakdownAmount > 0 ? (
                                <div className="h-[196px] w-full">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                        <PieChart>
                                            <defs>
                                                {paymentBreakdown.map((item, idx) => {
                                                    const colors = PAYMENT_COLOR_MAP[item.key] || PAYMENT_COLOR_MAP.OTHER;
                                                    return (
                                                        <linearGradient key={`pie-grad-${idx}`} id={`pie-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor={colors.gradStart} />
                                                            <stop offset="100%" stopColor={colors.gradEnd} />
                                                        </linearGradient>
                                                    );
                                                })}
                                            </defs>
                                            <Pie
                                                data={paymentBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={58}
                                                outerRadius={80}
                                                paddingAngle={4}
                                                dataKey="value"
                                                stroke="#FFFDF9"
                                                strokeWidth={2}
                                                onMouseEnter={(_, index) => setActivePieIndex(index)}
                                                onMouseLeave={() => setActivePieIndex(null)}
                                            >
                                                {paymentBreakdown.map((_, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={`url(#pie-grad-${index})`}
                                                        style={{
                                                            transform: activePieIndex === index ? 'scale(1.04)' : 'scale(1)',
                                                            transformOrigin: 'center',
                                                            transition: 'transform 0.2s ease-out'
                                                        }}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const entry = payload[0].payload;
                                                        const pct = totalBreakdownAmount > 0 ? ((entry.value / totalBreakdownAmount) * 100).toFixed(1) : '0';
                                                        return (
                                                            <div className="bg-[#103B32] text-[#FFFDFB] px-3 py-2 rounded-xl shadow-xl border border-[#245A4E] text-xs tabular-nums">
                                                                <p className="font-bold text-[#D4EFE6]">{entry.name}</p>
                                                                <p className="font-bold text-white text-sm mt-0.5">{clinicMoney(entry.value)}</p>
                                                                <p className="text-[#B9D5CB] text-[10px]">{entry.count} txns ({pct}%)</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <svg
                                    viewBox="0 0 180 180"
                                    className="w-[172px] h-[172px]"
                                    aria-hidden="true"
                                >
                                    <circle
                                        cx="90"
                                        cy="90"
                                        r="68"
                                        fill="none"
                                        stroke="#EAECE2"
                                        strokeWidth="16"
                                    />
                                    <circle
                                        cx="90"
                                        cy="90"
                                        r="68"
                                        fill="none"
                                        stroke="#CBE0D2"
                                        strokeWidth="2"
                                        strokeDasharray="4 6"
                                    />
                                </svg>
                            )}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-bold text-[#556D65] uppercase tracking-[0.1em]">Collections</span>
                                <span className="text-base font-bold text-[#103B32] mt-0.5 tabular-nums">{formatMoney(today ? totalBreakdownAmount : undefined)}</span>
                                {totalBreakdownAmount > 0 ? (
                                    <span className="text-[10px] font-semibold text-[#087466] bg-[#DFF4ED] border border-[#BBE5D6] px-2 py-0.5 rounded-full mt-1">
                                        {saleCount} posted
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-semibold text-[#556D65] bg-[#FAF7F0] border border-[#E4E5DA] px-2 py-0.5 rounded-full mt-1">
                                        {today ? 'No recorded payments' : todayError ? 'Payments unavailable' : 'Loading payments'}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Breakdown Channels Legend */}
                        <div className="space-y-2 mt-4 pt-4 border-t border-[#E4E5DA]">
                            {paymentBreakdown.map((mode) => {
                                const colors = PAYMENT_COLOR_MAP[mode.key] || PAYMENT_COLOR_MAP.OTHER;
                                const pct = totalBreakdownAmount > 0 ? ((mode.value / totalBreakdownAmount) * 100).toFixed(0) : '0';

                                return (
                                    <div key={mode.key} className="flex items-center justify-between text-xs py-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors.fill }} />
                                            <span className="font-semibold text-[#103B32] truncate">{mode.name}</span>
                                            <span className="text-[11px] text-[#556D65] tabular-nums">({mode.count})</span>
                                        </div>
                                        <div className="flex items-center gap-2 font-bold text-[#103B32] tabular-nums shrink-0">
                                            <span>{clinicMoney(mode.value)}</span>
                                            <span className="text-[11px] font-medium text-[#556D65] w-8 text-right">{pct}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. DRIFT RADAR: INVENTORY TELEMETRY SECTION */}
            <div className="jvk-clinic-hub-card p-5 sm:p-6 lg:p-7 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E5DA] pb-4">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-[#FEF6E0] text-[#B87414] border border-[#F4DFAA] flex items-center justify-center">
                                <Radio className="w-5 h-5" />
                            </div>
                            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D97706] border border-[#FFFDF9]" />
                            </span>
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold text-[#103B32] tracking-tight">Drift Radar: Inventory Telemetry</h2>
                                <span className="text-[10px] font-bold bg-[#FEF3D6] text-[#9A5B0A] border border-[#F4DB9C] px-2 py-0.5 rounded-md uppercase tracking-wider">
                                    {skuCount ? 'FEFO Active' : stockStatus}
                                </span>
                            </div>
                            <p className="text-xs text-[#556D65] mt-0.5">
                                Expiry within 30 days, critical shortages and stock review
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => onNavigate?.('inventory-dashboard')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF7F0] hover:bg-[#E8F1E5] border border-[#E4E5DA] text-xs font-bold text-[#103B32] transition-colors"
                        >
                            <Package className="w-3.5 h-3.5 text-[#087466]" />
                            <span>Open Inventory Dashboard</span>
                            <ChevronRight className="w-3.5 h-3.5 text-[#556D65]" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* PANEL A: NEAR-EXPIRY BATCHES (<30 DAYS) */}
                    <div className="jvk-clinic-hub-subcard p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-[#B87414]" />
                                    <h3 className="text-sm font-bold text-[#103B32]">Near-Expiry Batches (30 Days)</h3>
                                </div>
                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full tabular-nums border ${
                                    nearExpiryBatches.length > 0
                                        ? 'bg-[#FEF3D6] text-[#9A5B0A] border-[#F4DB9C]'
                                        : 'bg-[#DFF4ED] text-[#087466] border-[#BBE5D6]'
                                }`}>
                                    {skuCount ? `${nearExpiryBatches.length} ${nearExpiryBatches.length === 1 ? 'batch' : 'batches'}` : stockStatus}
                                </span>
                            </div>

                            {skuCount === 0 ? (
                                <div className="p-7 text-center bg-[#FFFDFB] rounded-xl border border-[#E4E5DA]">
                                    <Package className="w-9 h-9 text-[#8FA59D] mx-auto mb-2" />
                                    <p className="text-xs font-bold text-[#103B32]">{stockStatus}</p>
                                    <p className="text-[11px] text-[#556D65] mt-0.5">{stockError ?? 'Configure pharmacy batches to monitor expiry.'}</p>
                                </div>
                            ) : nearExpiryBatches.length === 0 ? (
                                <div className="p-7 text-center bg-[#FFFDFB] rounded-xl border border-[#E4E5DA]">
                                    <ShieldCheck className="w-9 h-9 text-[#087466] mx-auto mb-2" />
                                    <p className="text-xs font-bold text-[#103B32]">No expiry alerts</p>
                                    <p className="text-[11px] text-[#556D65] mt-0.5">No on-hand batches are expired or due to expire within 30 days.</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                                    {nearExpiryBatches.map((batch) => {
                                        const isCritical = batch.daysRemaining <= 7;
                                        return (
                                            <div
                                                key={batch.id}
                                                className="flex items-center justify-between gap-3 p-3 bg-[#FFFDFB] rounded-xl border border-[#E4E5DA] hover:border-[#E5B85C] transition-all"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-xs font-bold text-[#103B32] truncate">{batch.itemName}</p>
                                                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#FAF7F0] text-[#556D65] border border-[#E4E5DA]">
                                                            {`B: ${batch.batchNo}`}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-[#556D65] mt-0.5 tabular-nums">
                                                        On hand <strong className="text-[#103B32]">{batch.quantity} units</strong> • Exp: {batch.expiry}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className={`text-[11px] font-bold px-2 py-1 rounded-lg tabular-nums ${isCritical ? 'bg-[#FCEEEF] text-[#BE3144] border border-[#F4C7CD]' : 'bg-[#FEF3D6] text-[#9A5B0A] border border-[#F4DB9C]'}`}>
                                                        {batch.daysRemaining < 0 ? 'Expired' : batch.daysRemaining === 0 ? 'Expires today' : `${batch.daysRemaining}d left`}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleFastReorder(batch.id)}
                                                        disabled={hqBranch}
                                                        className="p-1.5 rounded-lg bg-[#FAF7F0] hover:bg-[#E8F1E5] text-[#556D65] hover:text-[#087466] border border-[#E4E5DA] transition-colors"
                                                        title="FEFO Restock / Review"
                                                    >
                                                        <Package className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#E4E5DA] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#556D65]">
                            <span>Rule: First-Expiry-First-Out (FEFO) Priority</span>
                            <span className="font-semibold text-[#B87414]">Excluded from eligible stock after expiry</span>
                        </div>
                    </div>

                    {/* PANEL B: CRITICAL OUT-OF-STOCK & FAST REORDER */}
                    <div className="jvk-clinic-hub-subcard p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-[#BE3144]" />
                                    <h3 className="text-sm font-bold text-[#103B32]">Stock Shortages</h3>
                                </div>
                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full tabular-nums border ${
                                    criticalStock.length > 0
                                        ? 'bg-[#FCEEEF] text-[#BE3144] border-[#F4C7CD]'
                                        : 'bg-[#DFF4ED] text-[#087466] border-[#BBE5D6]'
                                }`}>
                                    {skuCount ? `${criticalStock.length} critical` : stockStatus}
                                </span>
                            </div>

                            {skuCount === 0 ? (
                                <div className="p-7 text-center bg-[#FFFDFB] rounded-xl border border-[#E4E5DA]">
                                    <CheckCircle2 className="w-9 h-9 text-[#8FA59D] mx-auto mb-2" />
                                    <p className="text-xs font-bold text-[#103B32]">{stockStatus}</p>
                                    <p className="text-[11px] text-[#556D65] mt-0.5">{stockError ?? 'Configure stock batches to evaluate safety stock.'}</p>
                                </div>
                            ) : lowStock.length === 0 ? (
                                <div className="p-7 text-center bg-[#FFFDFB] rounded-xl border border-[#E4E5DA]">
                                    <CheckCircle2 className="w-9 h-9 text-[#087466] mx-auto mb-2" />
                                    <p className="text-xs font-bold text-[#103B32]">No shortages</p>
                                    <p className="text-[11px] text-[#556D65] mt-0.5">All configured SKUs meet the minimum safety stock.</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                                    {lowStock.map((item) => {
                                        const deficit = Math.max(0, item.threshold - item.eligibleUnits);
                                        const percentage = Math.round((item.eligibleUnits / item.threshold) * 100);

                                        return (
                                            <div
                                                key={item.id}
                                                className="p-3 bg-[#FFFDFB] rounded-xl border border-[#E4E5DA] hover:border-[#E4A5AE] transition-all space-y-2"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-[#103B32] truncate">{item.itemName}</p>
                                                        <p className="text-[11px] text-[#556D65] tabular-nums">
                                                            Available: <strong className="text-[#BE3144]">{item.eligibleUnits} units</strong> • Threshold: {item.threshold} • Deficit: <strong className="text-[#BE3144]">{deficit} units</strong>
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedStockItem(item)}
                                                            className="px-2.5 py-1 text-[11px] font-bold text-[#103B32] bg-[#FAF7F0] hover:bg-[#E8F1E5] border border-[#E4E5DA] rounded-lg transition-colors"
                                                        >
                                                            Inspect
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleFastReorder(item.id)}
                                                            disabled={hqBranch}
                                                            className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-white bg-[#087466] hover:bg-[#065C51] rounded-lg transition-all"
                                                        >
                                                            <Zap className="w-3 h-3" />
                                                            Fast Reorder
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-[#EAEBE0] rounded-full h-1.5 overflow-hidden flex">
                                                    <div
                                                        className="h-1.5 rounded-full bg-gradient-to-r from-[#BE3144] to-[#D97706]"
                                                        style={{ width: `${Math.min(100, Math.max(8, percentage))}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#E4E5DA] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#556D65]">
                            <span>Deficit Target: Safety threshold buffer</span>
                            <span className="font-semibold text-[#BE3144]">Review eligible stock before reordering</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 6. LIVE COUNTER TRANSACTIONS & SETTLEMENTS */}
            <div className="jvk-clinic-hub-card p-5 sm:p-6 lg:p-7 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#E8F1E5] text-[#087466] border border-[#CBE0D2] flex items-center justify-center shrink-0">
                            <SymbolIcon className="material-symbols-outlined text-[20px]">receipt_long</SymbolIcon>
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-[#103B32] tracking-tight">Live Counter Transactions & Settlements</h2>
                            <p className="text-xs text-[#556D65] mt-0.5">
                                Posted pharmacy sales · Last {dayCount} days · Asia/Kolkata
                            </p>
                        </div>
                    </div>

                    {/* Real-time Search Box */}
                    <div className="relative w-full lg:w-96">
                        <Search className="w-4 h-4 text-[#7B8F88] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            aria-label="Search counter transactions"
                            className="w-full pl-10 pr-9 py-2.5 bg-[#FAF7F0] border border-[#E4E5DA] rounded-xl text-xs font-medium text-[#103B32] focus:outline-none focus:ring-2 focus:ring-[#087466]/20 focus:border-[#087466] transition-all placeholder:text-[#7B8F88]"
                            placeholder="Search by receipt reference"
                            maxLength={100}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                aria-label="Clear search query"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B8F88] hover:text-[#103B32]"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Pills Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Sale Type Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#556D65] uppercase tracking-wider mr-1">Type:</span>
                        {[
                            { value: 'all', label: 'All Types' },
                            { value: 'PHARMACY', label: 'Pharmacy' },
                            { value: 'CONSULTATION', label: 'Consultation' },
                            { value: 'IPD', label: 'IPD' },
                            { value: 'SERVICES', label: 'Services' }
                        ].map((type) => (
                            <button
                                type="button"
                                key={type.value}
                                onClick={() => setSelectedSaleType(type.value)}
                                disabled={type.value !== 'all' && type.value !== 'PHARMACY'}
                                title={type.value !== 'all' && type.value !== 'PHARMACY' ? 'No canonical settlement feed configured' : undefined}
                                aria-pressed={selectedSaleType === type.value}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border disabled:opacity-50 ${
                                    selectedSaleType === type.value
                                        ? 'bg-[#087466] text-white border-[#087466] shadow-xs'
                                        : 'bg-[#FAF7F0] text-[#556D65] border-[#E4E5DA] hover:bg-[#E8F1E5] hover:text-[#103B32]'
                                }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>

                    {/* Payment Mode Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#556D65] uppercase tracking-wider mr-1">Mode:</span>
                        {[
                            { value: 'all', label: 'All Modes' },
                            { value: 'UPI', label: 'UPI' },
                            { value: 'CASH', label: 'Cash' },
                            { value: 'CARD', label: 'Card' },
                            { value: 'CREDIT', label: 'Credit' }
                        ].map((mode) => (
                            <button
                                type="button"
                                key={mode.value}
                                onClick={() => setSelectedPaymentMode(mode.value)}
                                aria-pressed={selectedPaymentMode === mode.value}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                    selectedPaymentMode === mode.value
                                        ? 'bg-[#087466] text-white border-[#087466] shadow-xs'
                                        : 'bg-[#FAF7F0] text-[#556D65] border-[#E4E5DA] hover:bg-[#E8F1E5] hover:text-[#103B32]'
                                }`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* TRANSACTIONS TABLE */}
                <div className="rounded-2xl border border-[#E4E5DA] overflow-hidden bg-[#FFFDFB]">
                    <div className="jvk-admin-table-region overflow-x-auto">
                        <table className="w-full min-w-[740px] text-xs text-left">
                            <thead className="bg-[#FAF7F0] border-b border-[#E4E5DA] text-[#556D65] font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5 whitespace-nowrap">Receipt reference</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap">Posted date &amp; time (IST)</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap">Category</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap">Payment Mode</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap text-right">{selectedPaymentMode === 'all' ? 'Gross amount' : 'Channel amount'}</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap text-center w-28">Tax Receipt</th>
                                </tr>
                            </thead>
                            {filteredTransactions.length > 0 && (
                                <tbody className="divide-y divide-[#EAEBE0]">
                                    {filteredTransactions.map((sale) => {
                                        const modeColor = PAYMENT_COLOR_MAP[(sale.payment_mode || '').toUpperCase()] || PAYMENT_COLOR_MAP.OTHER;
                                        const saleTime = sale.timestamp ? new Date(sale.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '';
                                        const channelAmount = sale.payments.find(payment => payment.method.toUpperCase() === selectedPaymentMode)?.amountPaise;

                                        return (
                                            <tr key={sale.id} className="hover:bg-[#FAF7F0]/80 transition-colors group">
                                                <td className="px-5 py-3.5 font-mono">
                                                    <span className="font-bold text-[#103B32]">{sale.id}</span>
                                                </td>

                                                <td className="px-5 py-3.5 font-mono whitespace-nowrap text-[#556D65]">
                                                    {sale.businessDay} · {saleTime}
                                                </td>

                                                <td className="px-5 py-3.5">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                                                        sale.sale_type === 'PHARMACY'
                                                            ? 'bg-[#F3EEFC] text-[#6B3FA0] border-[#DECFF6]'
                                                            : sale.sale_type === 'CONSULTATION'
                                                                ? 'bg-[#E8F4FA] text-[#0369A1] border-[#BFE3F2]'
                                                                : 'bg-[#DFF4ED] text-[#087466] border-[#BBE5D6]'
                                                    }`}>
                                                        {sale.sale_type}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-3.5">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${modeColor.badge}`}>
                                                        {sale.payment_mode || 'Unrecorded'}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-3.5 text-right font-bold text-[#103B32] text-sm tabular-nums">
                                                    {clinicMoney(channelAmount ?? sale.grossPaise)}
                                                </td>

                                                <td className="px-5 py-3.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => openReceipt(sale)}
                                                        disabled={isReceiptLoading}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FAF7F0] hover:bg-[#E8F1E5] text-[#103B32] hover:text-[#087466] border border-[#E4E5DA] text-[11px] font-bold transition-all active:scale-95"
                                                        title="View Full Tax Receipt"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        <span>Receipt</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            )}
                            {filteredTransactions.length > 0 && (
                                <tfoot className="bg-[#FAF7F0] border-t border-[#E4E5DA] font-bold text-[#103B32]">
                                    <tr>
                                        <td colSpan={4} className="px-5 py-3.5 text-right text-xs uppercase tracking-wider text-[#556D65]">
                                            Filtered volume ({period?.selectedSaleCount}) · Total
                                        </td>
                                        <td className="px-5 py-3.5 text-right text-base font-bold text-[#087466] tabular-nums">
                                            {formatMoney(period?.selectedGrossPaise)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {receiptError && <p role="alert" className="px-5 py-2 text-xs text-[#BE3144]">{receiptError}</p>}
                    {period?.salesTruncated && <p className="px-5 py-2 text-xs text-[#556D65]">Latest 500 matching sales shown. Search by receipt reference to find earlier sales.</p>}
                    {!period && <p role={periodError ? 'alert' : 'status'} className="px-5 py-8 text-sm text-[#556D65]">{periodError ?? 'Loading posted transactions…'}</p>}
                    {period && filteredTransactions.length === 0 && (
                        <div className="text-center py-12 px-4 text-[#556D65]">
                            <div className="space-y-1.5 max-w-sm mx-auto">
                                <Receipt className="w-8 h-8 text-[#9AAEA6] mx-auto" />
                                <p className="text-sm font-bold text-[#103B32]">No matching transactions</p>
                                <p className="text-xs text-[#556D65]">
                                    {hasActiveFilters
                                        ? 'Try adjusting your search query or channel filters'
                                        : 'No posted pharmacy sales for the selected dates.'}
                                </p>
                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setSelectedSaleType('all');
                                            setSelectedPaymentMode('all');
                                        }}
                                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF7F0] hover:bg-[#E8F1E5] border border-[#E4E5DA] text-xs font-bold text-[#087466] transition-colors"
                                    >
                                        Reset filters
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 7. RECEIPT MODAL PREVIEW */}
            {selectedReceipt?.clinicId === clinicId && (
                <ClinicalReceiptModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(undefined)} />
            )}

            {/* 8. STOCK ITEM INSPECTION & REORDER MODAL */}
            <Dialog open={!!selectedStockItem} onOpenChange={(open) => !open && setSelectedStockItem(undefined)}>
                <DialogContent className="sm:max-w-md bg-[#FFFDF8] border border-[#E4E5DA] shadow-2xl p-0 overflow-hidden rounded-3xl text-[#103B32]">
                    {selectedStockItem && (
                        <div>
                            <div className="p-6 bg-[#FEF6E0]/75 border-b border-[#F4DB9C] flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-[#FFFDFB] border border-[#F4DB9C] flex items-center justify-center text-[#B87414]">
                                    <Package className="w-6 h-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg font-bold text-[#103B32]">Stock Telemetry Review</DialogTitle>
                                    <p className="text-xs text-[#9A5B0A] font-bold uppercase tracking-wider mt-0.5">
                                        FEFO Replenishment Recommended
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 space-y-5">
                                <div className="flex items-center gap-3 p-4 bg-[#FAF7F0] border border-[#E4E5DA] rounded-2xl">
                                    <AlertTriangle className="w-5 h-5 text-[#B87414] shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-bold text-[#103B32] text-sm truncate">{selectedStockItem.itemName}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="p-3.5 bg-[#FAF7F0] rounded-2xl border border-[#E4E5DA] text-center">
                                        <p className="text-[10px] font-bold text-[#556D65] uppercase tracking-wider">Eligible units</p>
                                        <p className="text-2xl font-bold text-[#B87414] mt-1 tabular-nums">{selectedStockItem.eligibleUnits}</p>
                                        <p className="text-[10px] text-[#556D65]">unexpired, unreserved</p>
                                    </div>
                                    <div className="p-3.5 bg-[#FAF7F0] rounded-2xl border border-[#E4E5DA] text-center">
                                        <p className="text-[10px] font-bold text-[#556D65] uppercase tracking-wider">Threshold</p>
                                        <p className="text-2xl font-bold text-[#103B32] mt-1 tabular-nums">{selectedStockItem.threshold}</p>
                                        <p className="text-[10px] text-[#556D65]">safety min</p>
                                    </div>
                                    <div className="p-3.5 bg-[#FCEEEF] rounded-2xl border border-[#F4C7CD] text-center">
                                        <p className="text-[10px] font-bold text-[#BE3144] uppercase tracking-wider">Deficit</p>
                                        <p className="text-2xl font-bold text-[#BE3144] mt-1 tabular-nums">
                                            {Math.max(0, (selectedStockItem.threshold) - (selectedStockItem.eligibleUnits))}
                                        </p>
                                        <p className="text-[10px] text-[#BE3144]">units short</p>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[11px] font-bold text-[#556D65] uppercase tabular-nums">
                                        <span>Current Buffer Level</span>
                                        <span className="text-[#B87414]">
                                            {Math.round(((selectedStockItem.eligibleUnits) / (selectedStockItem.threshold)) * 100)}% of buffer
                                        </span>
                                    </div>
                                    <div className="w-full bg-[#EAEBE0] rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-2 rounded-full bg-gradient-to-r from-[#BE3144] to-[#D97706] transition-all duration-300"
                                            style={{
                                                width: `${Math.min(100, Math.round(((selectedStockItem.eligibleUnits) / (selectedStockItem.threshold)) * 100))}%`
                                            }}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedStockItem(undefined);
                                        handleFastReorder(selectedStockItem.id);
                                    }}
                                    disabled={hqBranch}
                                    className="w-full py-3 bg-[#087466] hover:bg-[#065C51] text-white font-bold rounded-2xl transition-all shadow-[0_8px_18px_rgba(8,116,102,0.2)] text-xs flex items-center justify-center gap-2 active:scale-[0.99]"
                                >
                                    <Zap className="w-4 h-4" />
                                    Review Stock in Inventory Dashboard
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
