import React, { useState, useRef, useMemo } from 'react'
import { Card, CardContent, Button, Input, Label, Badge, Skeleton } from '@/components/ui/basic'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
    Building2,
    TrendingUp,
    AlertTriangle,
    Plus,
    Loader2,
    UserPlus,
    Package,
    ArrowUpRight,
    ArrowRight,
    Shield,
    ShieldCheck,
    CheckCircle2,
    ArrowRightLeft,
    Search,
    MapPin,
    Bed,
    Activity,
    Database,
    Zap,
    Sparkles,
    Send,
    Users,
    FileSpreadsheet,
    Flame,
    Eye,
    EyeOff
} from 'lucide-react'
import { staffApi, useStaffData } from '@/lib/staffApi'
import type { HqFinance, HqFleet, HqGroup, HqPeriod, HqStock, HqTransfer } from '../../../../packages/shared/hq-command'
import { Link } from 'react-router-dom'
import { useToast } from '@/components/ui/use-toast'
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts'
import { paiseToRupeesString } from '@/lib/utils'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"



interface HospitalDashboardProps {
    onSelectClinic: (id: string) => void;
}

export function HospitalDashboard({ onSelectClinic }: HospitalDashboardProps) {
    const { toast } = useToast();
    const [revision, setRevision] = useState(0);
    const { data: fleet, error: fleetError } = useStaffData<HqFleet>('/clinical/command/hq/fleet', revision);
    const { data: stock, error: stockError } = useStaffData<HqStock>('/clinical/command/hq/stock', revision);
    const clinics = fleet?.clinics ?? [];
    const inventory = stock?.batches ?? [];
    const refreshGroup = () => setRevision((value) => value + 1);
    const threshold = 10;
    const stockDay = stock?.day ?? "";
    const expiringItems = useMemo(() => {
        if (!stock) return [];
        const cutoff = new Date(`${stock.day}T00:00:00Z`);
        cutoff.setUTCDate(cutoff.getUTCDate() + 90);
        const end = cutoff.toISOString().slice(0, 10);
        return stock.batches
            .filter(batch => batch.quantity > 0 && batch.expiry <= end)
            .map(batch => ({
                ...batch, expiry_date: batch.expiry, clinic_id: batch.clinicId,
                item_name: stock.items.find(item => item.id === batch.skuId)?.brand ?? batch.skuId,
                clinics: { name: fleet?.clinics.find(clinic => clinic.id === batch.clinicId)?.name },
            }));
    }, [stock, fleet]);

    const matrix = useMemo(() => {
        if (!stock || !fleet) return [];
        const quantities = new Map<string, Map<string, number>>();
        const recorded = new Set<string>();
        for (const batch of stock.batches) {
            recorded.add(batch.skuId);
            if (batch.expiry < stock.day) continue;
            const byClinic = quantities.get(batch.skuId) ?? new Map<string, number>();
            byClinic.set(batch.clinicId, (byClinic.get(batch.clinicId) ?? 0) + batch.available);
            quantities.set(batch.skuId, byClinic);
        }
        return stock.items.filter(item => recorded.has(item.id)).map(item => {
            const branches = fleet.clinics.map(clinic => ({
                id: clinic.id, name: clinic.name, status: clinic.status,
                units: quantities.get(item.id)?.get(clinic.id) ?? 0,
            }));
            return { ...item, branches, units: branches.reduce((sum, branch) => sum + branch.units, 0) };
        });
    }, [stock, fleet]);

    const lowStockRadarItems = matrix.flatMap(item => item.branches.flatMap(branch => {
        if (branch.status !== 'active' || branch.units >= threshold) return [];
        const donor = item.branches
            .filter(other => other.id !== branch.id && other.status === 'active' && other.units > threshold)
            .sort((left, right) => right.units - left.units)[0];
        return [{
            skuId: item.id, item_name: item.brand, clinic_id: branch.id, total_quantity: branch.units,
            threshold, deficitClinicName: branch.name, surplusClinicId: donor?.id,
            surplusClinicName: donor?.name, surplusQuantity: donor ? donor.units - threshold : 0,
        }];
    }));
    const lowStock = lowStockRadarItems;
    const activeClinicsCount = clinics.filter(clinic => clinic.status === 'active').length;
    const pausedClinicsCount = clinics.filter(clinic => clinic.status === 'paused').length;
    const activeIPDCount = clinics.reduce((sum, clinic) => sum + clinic.activeAdmissions, 0);
    const totalRevenuePaise = clinics.reduce((sum, clinic) => sum + clinic.grossPaise, 0);
    const totalInventoryValuePaise = inventory.reduce((sum, batch) => sum + batch.quantity * batch.costPaise, 0);
    const totalGroupAvailable = matrix.reduce((sum, item) => sum + item.units, 0);
    const money = (paise: number | undefined) => paise === undefined ? 'Unavailable' : `₹${paiseToRupeesString(paise)}`;
    const revenueSummary = clinics.map(clinic => ({
        clinic_id: clinic.id, clinic_name: clinic.name, grossPaise: clinic.grossPaise,
        transaction_count: clinic.saleCount,
    }));
    const topClinic = revenueSummary.filter(clinic => clinic.transaction_count > 0)
        .sort((left, right) => right.grossPaise - left.grossPaise)[0];

    const [clinicSearch, setClinicSearch] = useState('');
    const [clinicStatusFilter, setClinicStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
    const [clinicSortBy, setClinicSortBy] = useState<'revenue' | 'patients' | 'name'>('revenue');
    const [clinicViewMode, setClinicViewMode] = useState<'grid' | 'table'>('grid');
    const filteredClinics = clinics.filter(clinic => {
        const query = clinicSearch.trim().toLowerCase();
        return (clinicStatusFilter === 'all' || clinic.status === clinicStatusFilter) &&
            [clinic.name, clinic.address, clinic.code, clinic.managerName].some(value => value?.toLowerCase().includes(query));
    }).sort((a, b) => clinicSortBy === 'revenue' ? b.grossPaise - a.grossPaise :
        clinicSortBy === 'patients' ? b.patientCount - a.patientCount : a.name.localeCompare(b.name));

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferLoading, setTransferLoading] = useState(false);
    const [transferSku, setTransferSku] = useState('');
    const [transferBatch, setTransferBatch] = useState('');
    const [transferSourceClinic, setTransferSourceClinic] = useState('');
    const [transferDestClinic, setTransferDestClinic] = useState('');
    const [transferQuantity, setTransferQuantity] = useState(1);
    const [transferReason, setTransferReason] = useState('');
    const transferAttempt = useRef<{ body: string; key: string }>();
    const transferOptions = inventory.filter(batch => batch.skuId === transferSku && batch.clinicId === transferSourceClinic
        && batch.expiry >= stockDay && batch.available > 0);
    const selectedBatch = transferOptions.find(batch => batch.id === transferBatch);
    const availableSourceQuantity = selectedBatch?.available ?? 0;
    const availableDestQuantity = selectedBatch ? inventory.find(batch =>
        batch.clinicId === transferDestClinic && batch.skuId === transferSku && batch.batchNo === selectedBatch.batchNo
    )?.quantity ?? 0 : 0;
    const canTransfer = Boolean(selectedBatch && transferDestClinic && transferReason.trim() &&
        Number.isInteger(transferQuantity) && transferQuantity > 0 && availableSourceQuantity >= transferQuantity);

    const initiateTransferForRadarItem = (item: typeof lowStockRadarItems[number]) => {
        setTransferSku(item.skuId);
        setTransferBatch('');
        setTransferDestClinic(item.clinic_id);
        setTransferSourceClinic(item.surplusClinicId ?? '');
        setTransferQuantity(Math.max(1, Math.min(threshold - item.total_quantity, item.surplusQuantity)));
        setIsTransferModalOpen(true);
    };

    async function handleStockTransferSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!canTransfer || !selectedBatch || transferLoading) return;
        const body = JSON.stringify({
            sourceClinicId: transferSourceClinic, destinationClinicId: transferDestClinic,
            skuId: transferSku, batchId: selectedBatch.id, units: transferQuantity, reason: transferReason,
        });
        if (transferAttempt.current?.body !== body) transferAttempt.current = { body, key: crypto.randomUUID() };
        setTransferLoading(true);
        try {
            const result = await staffApi<HqTransfer>('/clinical/command/hq/transfers', {
                method: 'POST', body, headers: { 'Idempotency-Key': transferAttempt.current.key },
            });
            transferAttempt.current = undefined;
            setIsTransferModalOpen(false);
            setTransferSku('');
            setTransferBatch('');
            setTransferSourceClinic('');
            setTransferDestClinic('');
            setTransferReason('');
            refreshGroup();
            toast({ title: 'Stock transfer recorded', description: `${result.units} units · Batch ${result.batchNo} · Reference ${result.id}` });
        } catch (error) {
            toast({ title: 'Transfer unavailable', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
            refreshGroup();
        } finally {
            setTransferLoading(false);
        }
    }

    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [registerLoading, setRegisterLoading] = useState(false);
    const [clinicNameInput, setClinicNameInput] = useState('');
    const [clinicAddressInput, setClinicAddressInput] = useState('');
    const [clinicTier, setClinicTier] = useState('General Practice & OPD');
    const [staffNameInput, setStaffNameInput] = useState('');
    const [staffEmailInput, setStaffEmailInput] = useState('');
    const [staffPasswordInput, setStaffPasswordInput] = useState('');
    const [bedCapacityInput, setBedCapacityInput] = useState(10);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [codeSuffix, setCodeSuffix] = useState(() => crypto.randomUUID().slice(0, 6).toUpperCase());
    const registerAttempt = useRef<{ identity: string; key: string }>();
    const initials = clinicNameInput.trim().split(/\s+/).map(word => word[0] ?? '').join('').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);
    const generatedCode = clinicNameInput.trim() ? `HUB-${initials || 'CLI'}-${codeSuffix}` : '';
    const generateStrongPassword = () => setStaffPasswordInput(crypto.randomUUID().replace(/-/g, ''));

    async function handleRegisterClinic(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (registerLoading) return;
        const branch = {
            name: clinicNameInput, address: clinicAddressInput, tier: clinicTier,
            code: generatedCode, bedCapacity: bedCapacityInput,
            manager: { name: staffNameInput, email: staffEmailInput },
        };
        const identity = JSON.stringify(branch);
        if (registerAttempt.current?.identity !== identity) registerAttempt.current = { identity, key: crypto.randomUUID() };
        setRegisterLoading(true);
        try {
            await staffApi('/clinical/command/hq/branches', {
                method: 'POST', body: JSON.stringify({ ...branch, manager: { ...branch.manager, password: staffPasswordInput } }),
                headers: { 'Idempotency-Key': registerAttempt.current.key },
            });
            registerAttempt.current = undefined;
            setIsRegisterOpen(false);
            setClinicNameInput('');
            setStaffEmailInput('');
            setStaffPasswordInput('');
            setStaffNameInput('');
            setClinicAddressInput('');
            setCodeSuffix(crypto.randomUUID().slice(0, 6).toUpperCase());
            refreshGroup();
            toast({ title: 'Clinic hub provisioned', description: `${branch.name} · ${branch.code}` });
        } catch (error) {
            toast({ title: 'Registration unavailable', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
        } finally {
            setRegisterLoading(false);
        }
    }

    async function setBranchStatus(clinicId: string, status: 'active' | 'paused') {
        try {
            await staffApi(`/clinical/command/hq/branches/${encodeURIComponent(clinicId)}/status`, {
                method: 'PATCH', body: JSON.stringify({ status }),
            });
            refreshGroup();
            toast({ title: status === 'active' ? 'Clinic reactivated' : 'Clinic paused for stock transfers' });
        } catch (error) {
            toast({ title: 'Clinic status could not be saved', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
        }
    }

    const [dateFilter, setDateFilter] = useState<HqPeriod>('today');
    const [groupBy, setGroupBy] = useState<HqGroup>('clinic_id');
    const [filters, setFilters] = useState({ clinic: 'all', payment: 'all', type: 'all' });
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const parameters = new URLSearchParams({ period: dateFilter, group: groupBy });
    if (filters.clinic !== 'all') parameters.set('clinic', filters.clinic);
    if (filters.payment !== 'all') parameters.set('payment', filters.payment.toLowerCase());
    if (filters.type !== 'all') parameters.set('service', filters.type);
    const { data: hqLedger, error: financeError } = useStaffData<HqFinance>(`/clinical/command/hq/finance?${parameters}`, revision);
    const analyticsLoading = !hqLedger && !financeError;
    const displayData = (hqLedger?.segments ?? []).map(segment => ({ ...segment, value: segment.paise / 100 }));
    const totalSelectedPaise = hqLedger?.selectedGrossPaise ?? 0;
    const totalSelectedRevenue = totalSelectedPaise / 100;
    const reconciled = Boolean(hqLedger && hqLedger.journalCount > 0 &&
        hqLedger.debitPaise === hqLedger.creditPaise && hqLedger.unreconciledSales === 0);
    const COLORS = ['#047C61', '#149A7A', '#E5A736', '#2B7A9B', '#6D9F71', '#C87D32', '#0D9488', '#4F7768'];

    async function copySegmentReport() {
        if (!hqLedger) return;
        const report = [
            `${fleet?.organization?.name ?? 'JEEVIKA'} · Financial Summary`,
            `Period ${hqLedger.from ?? 'all dates'} through ${hqLedger.through}`,
            `Filters · ${filters.clinic === 'all' ? 'All branches' : clinics.find(clinic => clinic.id === filters.clinic)?.name ?? filters.clinic} · ${filters.payment} · ${filters.type}`,
            `Selected gross receipts ${money(hqLedger.selectedGrossPaise)} (${hqLedger.selectedGrossPaise} paise)`,
            ...hqLedger.segments.map(segment => `${segment.name} · ${money(segment.paise)} (${segment.paise} paise)`),
        ].join('\n');
        try {
            await navigator.clipboard.writeText(report);
            toast({ title: 'Report copied' });
        } catch {
            toast({ title: 'Clipboard unavailable', variant: 'destructive' });
        }
    }

    return (
        <div className="jvk-admin-page ayu-headquarters space-y-6 max-w-[1600px] mx-auto pb-12">
            {/* --------------------------------------------------------- */}
            {/* Audit link */}
            {/* --------------------------------------------------------- */}
            <div>
                <a href="#/app/ca/audit" className="jvk-admin-secondary-btn !min-h-10 !px-4 text-xs sm:text-sm">
                    View audit status
                </a>
            </div>

            {fleetError && <p role="alert">Branch fleet unavailable. {fleetError}</p>}
            {stockError && <p role="alert">Group stock unavailable. {stockError}</p>}
            {financeError && <p role="alert">Financial analytics unavailable. {financeError}</p>}
            {/* --------------------------------------------------------- */}
            {/* EXECUTIVE MULTI-CLINIC COMMAND CENTER HEADER */}
            {/* --------------------------------------------------------- */}
            <div className="jvk-admin-card-hero flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 px-6 py-5 overflow-hidden relative">
                <div id="welcome-step" className="space-y-1.5 z-10">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[#047C61] flex items-center justify-center text-white shadow-sm shrink-0">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="jvk-admin-serif text-2xl sm:text-3xl font-bold text-[#0E2420] tracking-tight">
                                    {fleet?.organization?.name ?? 'Headquarters Command Center'}
                                </h1>
                                <Badge variant="outline" className="bg-[#DFF4ED] text-[#065F46] border-[#BBE2D1] font-bold text-[10px] uppercase">
                                    Group HQ Command
                                </Badge>
                            </div>
                            <p className="text-xs sm:text-sm text-[#556C63] font-medium mt-0.5">
                                {fleet ? `Central Headquarters Portal · ${clinics.length} network branches` : 'Loading headquarters data…'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="hidden xl:flex shrink-0 items-center justify-center pointer-events-none" aria-hidden="true">
                    <img
                        src="/assets/kiosk/kiosk-clinic-watercolor.png"
                        alt=""
                        width={220}
                        height={110}
                        className="jvk-admin-artwork w-52 h-auto"
                    />
                </div>

                {/* HEADER ACTION CONTROLS */}
                <div className="flex flex-wrap items-center gap-3 z-10 shrink-0">
                    {/* Inter-Clinic Stock Transfer Trigger */}
                    <button
                        type="button"
                        onClick={() => setIsTransferModalOpen(true)}
                        disabled={!stock || !fleet}
                        className="jvk-admin-secondary-btn h-11"
                    >
                        <ArrowRightLeft className="w-4 h-4 text-[#047C61]" />
                        <span>Central Stock Transfer</span>
                    </button>

                    {fleet && !fleet.organization && (
                        <Link to="/app/command/setup" className="jvk-admin-secondary-btn h-11">Set up organization</Link>
                    )}
                    {/* Add/Register Clinic Wizard */}
                    <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
                        <DialogTrigger asChild>
                            <button
                                id="tour-new-clinic"
                                type="button"
                                className="jvk-admin-primary-btn h-11 px-5"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Onboard Clinic HUB</span>
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[560px] bg-slate-950/98 backdrop-blur-2xl border-slate-800 text-slate-50 shadow-2xl p-6 gap-6">
                            <DialogHeader>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400">
                                        <Building2 className="w-4 h-4" />
                                    </div>
                                    <DialogTitle className="text-xl font-bold text-white tracking-tight">Onboard New Clinic Hub</DialogTitle>
                                </div>
                                <DialogDescription className="text-slate-400 text-xs">
                                    Provision an isolated Cloudflare D1 multi-tenant clinical node with automated branch code generation.
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleRegisterClinic} className="space-y-4 pt-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="branch-name" className="text-xs font-semibold text-slate-300">Clinic Branch Name</Label>
                                        <Input
                                            name="clinic_name"
                                            required
                                            id="branch-name" value={clinicNameInput}
                                            onChange={(e) => setClinicNameInput(e.target.value)}
                                            placeholder="e.g. JEEVIKA Downtown Care"
                                            className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 h-11 text-sm rounded-xl focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                                            <span>Generated Hub Code</span>
                                            <span className="text-[10px] text-blue-400 font-mono">Automated</span>
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                readOnly
                                                value={generatedCode || 'HUB-NEW-01'}
                                                className="bg-slate-900/60 border-slate-800 text-blue-300 font-mono font-bold h-11 text-sm rounded-xl"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="branch-address" className="text-xs font-semibold text-slate-300">Physical Location Address</Label>
                                    <Input
                                        name="location"
                                        required
                                        id="branch-address" value={clinicAddressInput}
                                        onChange={(e) => setClinicAddressInput(e.target.value)}
                                        placeholder="Full address, City, State, PIN"
                                        className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 h-11 text-sm rounded-xl focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-300">Clinical Tier</Label>
                                        <Select value={clinicTier} onValueChange={setClinicTier}>
                                            <SelectTrigger className="bg-slate-900 border-slate-800 text-white h-11 rounded-xl text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                                <SelectItem value="General Practice & OPD">General Practice & OPD</SelectItem>
                                                <SelectItem value="Multi-Specialty Center">Multi-Specialty Center</SelectItem>
                                                <SelectItem value="Day-Care Surgical Hub">Day-Care Surgical Hub</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="branch-beds" className="text-xs font-semibold text-slate-300">Bed Allocation (IPD)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            id="branch-beds" value={bedCapacityInput}
                                            onChange={(e) => setBedCapacityInput(Number(e.target.value))}
                                            className="bg-slate-900 border-slate-800 text-white h-11 text-sm rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-800/80">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Branch Leadership Credentials</p>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="branch-manager" className="text-xs font-semibold text-slate-300">Medical Director / Staff Name</Label>
                                                <Input
                                                    name="staff_name"
                                                    required
                                                    id="branch-manager" value={staffNameInput}
                                                    onChange={(e) => setStaffNameInput(e.target.value)}
                                                    placeholder="Dr. Rajesh Varma"
                                                    className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 h-11 text-sm rounded-xl focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="branch-email" className="text-xs font-semibold text-slate-300">Official Staff Email</Label>
                                                <Input
                                                    name="staff_email"
                                                    type="email"
                                                    required
                                                    id="branch-email" value={staffEmailInput}
                                                    onChange={(e) => setStaffEmailInput(e.target.value)}
                                                    placeholder="rajesh@jeevika.network"
                                                    className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 h-11 text-sm rounded-xl focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <Label htmlFor="branch-password" className="text-xs font-semibold text-slate-300">Initial Secure Password</Label>
                                                <button
                                                    type="button"
                                                    onClick={generateStrongPassword}
                                                    className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                                                >
                                                    Auto-Generate
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <Input
                                                    name="staff_password"
                                                    type={isPasswordVisible ? "text" : "password"}
                                                    required
                                                    minLength={6}
                                                    id="branch-password" value={staffPasswordInput}
                                                    onChange={(e) => setStaffPasswordInput(e.target.value)}
                                                    placeholder="••••••••"
                                                    className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 h-11 text-sm rounded-xl pr-10 focus:ring-2 focus:ring-blue-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                                >
                                                    {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Preview Card */}
                                <div className="p-3 bg-blue-950/30 rounded-xl border border-blue-900/40 text-xs flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <Sparkles className="w-4 h-4 text-blue-400" />
                                        <div>
                                            <p className="text-white font-bold">{clinicNameInput || 'Clinic Hub Name'}</p>
                                            <p className="text-slate-400 text-[10px] font-mono">Branch code {generatedCode || 'Pending'}</p>
                                        </div>
                                    </div>
                                    <Badge className="bg-blue-600 text-white font-mono text-[10px]">
                                        {generatedCode || 'HUB-NEW-01'}
                                    </Badge>
                                </div>

                                <DialogFooter className="pt-2">
                                    <Button
                                        type="submit"
                                        disabled={registerLoading}
                                        className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl tracking-wide shadow-lg shadow-blue-900/30 transition-all"
                                    >
                                        {registerLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                                        Provision Clinic Node
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* --------------------------------------------------------- */}
            {/* EXECUTIVE KPI STAT CARDS (TOP DECK) */}
            {/* --------------------------------------------------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. Group Consolidated Revenue (INR & Paise) */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Card id="tour-revenue-card" className="jvk-admin-card jvk-admin-card-interactive border-0 overflow-hidden relative group cursor-pointer">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between pb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-[#556C63]">Group Revenue (Today)</span>
                                    <div className="w-8 h-8 rounded-xl bg-[#DFF4ED] text-[#047C61] flex items-center justify-center">
                                        <TrendingUp className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-[#0E2420] tracking-tight tabular-nums">
                                    {money(fleet ? totalRevenuePaise : undefined)}
                                </div>
                                <div className="text-[11px] font-mono text-[#047C61] font-semibold flex items-center gap-1.5 mt-1.5">
                                    <span>{fleet ? `${totalRevenuePaise.toLocaleString('en-IN')} paise` : 'Fleet unavailable'}</span>
                                    <span className="text-[#9AB5AA]">•</span>
                                    <span className="text-[#556C63] font-sans">Posted pharmacy sales</span>
                                </div>
                                <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#E6EDE7] text-[11px] text-[#556C63]">
                                    <span>Consolidated Gross</span>
                                    <span className="text-[#047C61] font-bold flex items-center">
                                        View Breakdown <ArrowRight className="w-3 h-3 ml-0.5" />
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[480px] bg-[#FFFDF8] border-[#DCE7DF] text-[#0E2420]">
                        <DialogHeader>
                            <DialogTitle className="jvk-admin-serif text-xl font-bold text-[#0E2420]">Network Revenue Breakdown</DialogTitle>
                            <DialogDescription className="text-xs text-[#556C63]">
                                Posted pharmacy receipts for {revenueSummary.length} branches.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-3 max-h-[60vh] overflow-y-auto pr-1">
                            {revenueSummary.map(c => (
                                <div key={c.clinic_id} className="p-3.5 bg-[#F5FAF7] rounded-2xl border border-[#DCE8E0]">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-[#DFF4ED] flex items-center justify-center text-[#047C61] font-bold text-xs">
                                                <Building2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-[#0E2420] text-sm">{c.clinic_name}</p>
                                                <p className="text-[11px] text-[#556C63]">{c.transaction_count} Transactions Today</p>
                                            </div>
                                        </div>
                                        <p className="font-mono font-bold text-[#047C61] text-base">{money(c.grossPaise)}</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#DCE8E0] text-center">
                                        <div>
                                            <p className="text-[9px] text-[#6A8178] font-bold uppercase">OPD</p>
                                            <p className="text-xs font-bold text-[#0E2420]">Unconfigured</p>
                                        </div>
                                        <div className="border-x border-[#DCE8E0]">
                                            <p className="text-[9px] text-[#6A8178] font-bold uppercase">IPD</p>
                                            <p className="text-xs font-bold text-[#0E2420]">Unconfigured</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-[#6A8178] font-bold uppercase">Pharma</p>
                                            <p className="text-xs font-bold text-[#0E2420]">{money(c.grossPaise)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {revenueSummary.length === 0 && (
                                <p className="text-center py-6 text-[#556C63] text-sm italic">No sales recorded yet today.</p>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* 2. Active Inpatient Census (IPD) */}
                <Card className="jvk-admin-card border-0 overflow-hidden relative group">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between pb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#556C63]">Active Inpatients (IPD)</span>
                            <div className="w-8 h-8 rounded-xl bg-[#DFF4ED] text-[#047C61] flex items-center justify-center">
                                <Bed className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="text-3xl font-black text-[#0E2420] tracking-tight tabular-nums">
                            {fleet ? activeIPDCount : 'Unavailable'}
                        </div>
                        <div className="text-[11px] text-[#556C63] font-medium mt-1.5 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#047C61]" />
                            <span>Currently Admitted across Network</span>
                        </div>
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#E6EDE7] text-[11px] text-[#556C63]">
                            <span>Active bed admissions</span>
                            <span className="text-[#047C61] font-semibold">{activeClinicsCount} Active Hubs</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Top Performing Hub */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Card className="jvk-admin-card jvk-admin-card-interactive border-0 overflow-hidden relative group cursor-pointer">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between pb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-[#556C63]">Leading Branch</span>
                                    <div className="w-8 h-8 rounded-xl bg-[#DFF4ED] text-[#047C61] flex items-center justify-center">
                                        <Flame className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="jvk-admin-serif text-xl sm:text-2xl font-bold text-[#0E2420] tracking-tight truncate">
                                    {topClinic?.clinic_name ?? 'No posted sales today'}
                                </div>
                                <p className="text-[11px] text-[#556C63] font-medium mt-1.5">
                                    {money(topClinic?.grossPaise)} revenue today
                                </p>
                                <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#E6EDE7] text-[11px] text-[#556C63]">
                                    <span>Top Volume</span>
                                    <span className="text-[#047C61] font-bold flex items-center">
                                        Excellence Metrics <ArrowRight className="w-3 h-3 ml-0.5" />
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[420px] bg-[#FFFDF8] border-[#DCE7DF] text-[#0E2420]">
                        <DialogHeader>
                            <DialogTitle className="jvk-admin-serif text-xl font-bold text-[#0E2420]">Branch Excellence Metrics</DialogTitle>
                            <DialogDescription className="text-xs text-[#556C63]">
                                Detailed operational performance for {topClinic?.clinic_name ?? 'No posted sales today'}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4 text-center">
                            <div className="w-16 h-16 bg-[#DFF4ED] rounded-3xl flex items-center justify-center mx-auto text-[#047C61]">
                                <Building2 className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="text-3xl font-black text-[#0E2420]">{money(topClinic?.grossPaise)}</h4>
                                <p className="text-xs text-[#556C63] font-medium mt-1">Today's Gross Billing</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div className="p-3 bg-[#F5FAF7] rounded-xl border border-[#DCE8E0]">
                                    <p className="text-xl font-bold text-[#0E2420]">{topClinic?.transaction_count ?? '—'}</p>
                                    <p className="text-[10px] text-[#6A8178] font-bold uppercase">Patient Invoices</p>
                                </div>
                                <div className="p-3 bg-[#F5FAF7] rounded-xl border border-[#DCE8E0]">
                                    <p className="text-xl font-bold text-[#0E2420]">
                                        {money(topClinic ? Math.round(topClinic.grossPaise / topClinic.transaction_count) : undefined)}
                                    </p>
                                    <p className="text-[10px] text-[#6A8178] font-bold uppercase">Avg Ticket Size</p>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* 4. Critical Stock & System Alerts */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Card className={`jvk-admin-card jvk-admin-card-interactive border-0 overflow-hidden relative group cursor-pointer ${lowStock.length > 0 || expiringItems.length > 0
                            ? 'jvk-admin-card-rose'
                            : ''
                            }`}>
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between pb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-[#556C63]">Group Stock Alerts</span>
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${lowStock.length > 0 || expiringItems.length > 0
                                        ? 'bg-[#FCE7E5] text-[#B9382C]'
                                        : 'bg-[#DFF4ED] text-[#047C61]'
                                        }`}>
                                        <AlertTriangle className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-[#0E2420] tracking-tight tabular-nums">
                                    {stock && fleet ? lowStock.length + expiringItems.length : 'Unavailable'}
                                </div>
                                <p className="text-[11px] text-[#556C63] font-medium mt-1.5">
                                    {stock && fleet ? `${lowStock.length} branch SKU shortages · ${expiringItems.length} expiring batches` : 'Stock counts unavailable'}
                                </p>
                                <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#E6EDE7] text-[11px] text-[#556C63]">
                                    <span>Procurement Status</span>
                                    <span className="text-[#B9382C] font-bold flex items-center">
                                        Review Alerts <ArrowRight className="w-3 h-3 ml-0.5" />
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[520px] bg-white border-slate-200 text-slate-900">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Shield className="w-5 h-5 text-rose-600" />
                                Network Supply & Inventory Alerts
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                                Active branch quantities below the configured display threshold.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-3 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                            {lowStockRadarItems.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider">Low Stock Shortages</h4>
                                        <span className="text-[10px] text-slate-400">{lowStockRadarItems.length} items critical</span>
                                    </div>
                                    {lowStockRadarItems.map((item, idx) => (
                                        <div key={idx} className="p-3 bg-rose-50/60 rounded-xl border border-rose-100 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">{item.item_name}</p>
                                                <p className="text-[11px] text-slate-500">
                                                    Hub: <strong className="text-slate-800">{item.deficitClinicName}</strong>
                                                </p>
                                                {item.surplusClinicName && (
                                                    <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                                                        Surplus available: {item.surplusQuantity} units at {item.surplusClinicName}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                <Badge variant="destructive" className="bg-rose-600 text-white font-mono text-[10px]">
                                                    {item.total_quantity} Left (Req: {item.threshold || 10})
                                                </Badge>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => initiateTransferForRadarItem(item)}
                                                    className="h-7 text-xs bg-white border-rose-200 text-rose-700 hover:bg-rose-100"
                                                >
                                                    Transfer
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {expiringItems.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <h4 className="text-xs font-black text-amber-700 uppercase tracking-wider">Expired or Expiring Within 90 Days</h4>
                                    {expiringItems.map((item, idx) => (
                                        <div key={idx} className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">{item.item_name}</p>
                                                <p className="text-[11px] text-slate-500">{item.clinics.name ?? 'Clinic unavailable'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-bold text-amber-700 text-sm">{new Date(item.expiry_date).toLocaleDateString()}</p>
                                                <p className="text-[10px] text-amber-600 font-medium">Critical Window</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {lowStock.length === 0 && expiringItems.length === 0 && (
                                <div className="text-center py-8 text-slate-400 text-sm italic">
                                    {stockError || fleetError ? 'Group stock unavailable.' : !stock || !fleet ? 'Loading group stock…' : !inventory.length ? 'No stock batches recorded.' : 'No active branch shortages or expiring batches for tracked stock.'}
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* --------------------------------------------------------- */}
            {/* MULTI-CLINIC GRID CARDS */}
            {/* --------------------------------------------------------- */}
            <div className="space-y-4">
                <div className="jvk-admin-card flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 p-4 sm:px-5">
                    <div className="min-w-0">
                        <h2 className="jvk-admin-serif text-xl font-bold text-[#0E2420] tracking-tight flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-[#047C61] shrink-0" />
                            <span>Multi-Clinic Hub Fleet ({clinics.length})</span>
                        </h2>
                        <p className="text-xs text-[#556C63] mt-0.5">
                            Real-time operational status, today's revenues, patient volumes, and direct 1-click drill down.
                        </p>
                    </div>

                    {/* Filter and View Controls */}
                    <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 w-full xl:w-auto shrink-0">
                        <div className="relative flex-1 min-w-[145px] xl:w-[172px] xl:flex-none">
                            <Search className="w-4 h-4 text-[#6B847B] absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                                aria-label="Search clinic fleet"
                                value={clinicSearch}
                                onChange={(e) => setClinicSearch(e.target.value)}
                                placeholder="Search clinic, code..."
                                className="pl-9 h-9 text-xs bg-white border-[#CEDAD3] rounded-xl"
                            />
                        </div>

                        {/* Status Pills */}
                        <div className="flex bg-[#F0F6F2] border border-[#DCE7DF] p-0.5 rounded-xl shrink-0">
                            {(['all', 'active', 'paused'] as const).map(st => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => setClinicStatusFilter(st)}
                                    aria-pressed={clinicStatusFilter === st}
                                    className={`px-2 py-1.5 rounded-lg text-[11.5px] font-semibold capitalize transition-all whitespace-nowrap ${clinicStatusFilter === st
                                        ? 'bg-white text-[#047C61] shadow-xs'
                                        : 'text-[#556C63] hover:text-[#0E2420]'
                                        }`}
                                >
                                    {st === 'all' ? `All (${clinics.length})` : st === 'active' ? `Active (${activeClinicsCount})` : `Paused (${pausedClinicsCount})`}
                                </button>
                            ))}
                        </div>

                        {/* Sort Selector */}
                        <Select value={clinicSortBy} onValueChange={(value: typeof clinicSortBy) => setClinicSortBy(value)}>
                            <SelectTrigger className="w-[138px] h-9 text-[11.5px] bg-white border-[#CEDAD3] rounded-xl shrink-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectItem value="revenue">Sort: Highest Revenue</SelectItem>
                                <SelectItem value="patients">Sort: Most Patients</SelectItem>
                                <SelectItem value="name">Sort: Name A-Z</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* View Switcher */}
                        <div className="flex bg-[#F0F6F2] border border-[#DCE7DF] p-1 rounded-xl shrink-0">
                            <button
                                type="button"
                                onClick={() => setClinicViewMode('grid')}
                                className={`px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold transition-all ${clinicViewMode === 'grid' ? 'bg-white text-[#047C61] shadow-xs' : 'text-[#556C63]'}`}
                            >
                                Cards
                            </button>
                            <button
                                type="button"
                                onClick={() => setClinicViewMode('table')}
                                className={`px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold transition-all ${clinicViewMode === 'table' ? 'bg-white text-[#047C61] shadow-xs' : 'text-[#556C63]'}`}
                            >
                                Matrix
                            </button>
                        </div>
                    </div>
                </div>

                {/* Grid View */}
                {clinicViewMode === 'grid' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filteredClinics.length === 0 ? (
                            <div className="jvk-admin-card col-span-full flex flex-col sm:flex-row items-center justify-between gap-6 px-6 py-8 text-center sm:text-left">
                                <div className="hidden md:flex shrink-0">
                                    <img
                                        src="/assets/kiosk/kiosk-clinic-watercolor.png"
                                        alt=""
                                        aria-hidden="true"
                                        width={200}
                                        height={102}
                                        className="jvk-admin-artwork w-48 h-auto"
                                    />
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#DFF4ED] text-[#047C61] mb-3">
                                        <Building2 className="w-5 h-5" />
                                    </span>
                                    <h3 className="jvk-admin-serif text-lg font-bold text-[#0E2420]">
                                        {clinics.length === 0 ? 'No clinics added to the network' : 'No clinics match the search criteria'}
                                    </h3>
                                    <p className="text-xs sm:text-sm text-[#556C63] mt-1">
                                        {clinics.length === 0
                                            ? 'Onboard a clinic hub to start monitoring operations, stock, and revenue.'
                                            : 'Try adjusting your search keyword or clinic status filter.'}
                                    </p>
                                    {clinics.length === 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setIsRegisterOpen(true)}
                                            className="jvk-admin-primary-btn mt-4"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Onboard Clinic HUB</span>
                                        </button>
                                    )}
                                </div>
                                <div className="hidden md:flex shrink-0 opacity-75">
                                    <img
                                        src="/assets/opd/opd-sidebar-leaves.png"
                                        alt=""
                                        aria-hidden="true"
                                        width={140}
                                        height={96}
                                        className="jvk-admin-artwork w-32 h-auto"
                                    />
                                </div>
                            </div>
                        ) : (
                        filteredClinics.map((clinic, index) => {
                            const isPaused = clinic.status === 'paused';
                            return (
                                <div
                                    key={clinic.id}
                                    role="group"
                                    aria-label={clinic.name}
                                    id={index === 0 ? "tour-clinic-management-toggle" : undefined}
                                    className={`rounded-2xl border p-5 transition-all duration-300 relative flex flex-col justify-between group ${isPaused
                                        ? 'bg-[#F5F7F5] border-[#DCE5DF] opacity-85'
                                        : 'jvk-admin-card-elevated jvk-admin-card-interactive'
                                        }`}
                                >
                                    <div>
                                        {/* Card Header */}
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs ${isPaused
                                                    ? 'bg-slate-200 text-slate-500'
                                                    : 'bg-[#047C61] text-white'
                                                    }`}>
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="jvk-admin-serif font-bold text-[#0E2420] text-base leading-tight group-hover:text-[#047C61] transition-colors">
                                                        {clinic.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="font-mono text-[10px] text-[#047C61] bg-[#DFF4ED] border-[#BBE2D1] px-1.5 py-0">
                                                            {clinic.code ?? 'Unassigned'}
                                                        </Badge>
                                                        <span className="text-[11px] text-[#556C63] font-medium">
                                                            {clinic.tier ?? 'Tier unrecorded'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            {isPaused ? (
                                                <Badge variant="outline" className="bg-[#FDF1EF] text-[#B9382C] border-[#F2D2CF] text-[10px] uppercase font-bold tracking-wider">
                                                    Paused
                                                </Badge>
                                            ) : (
                                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DFF4ED] text-[#065F46] border border-[#BBE2D1] text-[10px] font-bold uppercase tracking-wider">
                                                    <span className="w-2 h-2 rounded-full bg-[#047C61]" />
                                                    Active
                                                </span>
                                            )}
                                        </div>

                                        {/* Clinic Meta: Location & Manager */}
                                        <div className="space-y-1.5 py-2.5 border-y border-[#E6EDE7] text-xs text-[#3C544C]">
                                            <div className="flex items-center gap-2 truncate">
                                                <MapPin className="w-3.5 h-3.5 text-[#6B847B] shrink-0" />
                                                <span className="truncate">{clinic.address || 'Address not registered'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 truncate">
                                                <Users className="w-3.5 h-3.5 text-[#6B847B] shrink-0" />
                                                <span className="truncate">Staff Lead: <strong className="text-[#0E2420]">{clinic.managerName ?? 'Unassigned'}</strong></span>
                                            </div>
                                        </div>

                                        {/* Performance Metrics Strip */}
                                        <div className="grid grid-cols-2 gap-2 my-3 p-3 bg-[#F4F9F5] rounded-xl border border-[#E2EDE6]">
                                            <div>
                                                <p className="text-[10px] text-[#556C63] font-bold uppercase tracking-wider">Today's Revenue</p>
                                                <p className="text-lg font-black text-[#0E2420] font-mono tabular-nums">
                                                    {money(clinic.grossPaise)}
                                                </p>
                                                <p className="text-[10px] text-[#556C63] font-mono">{clinic.grossPaise.toLocaleString('en-IN')}p</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-[#556C63] font-bold uppercase tracking-wider">Patient Volume</p>
                                                <p className="text-lg font-black text-[#0E2420] tabular-nums">
                                                    {clinic.patientCount} <span className="text-xs font-medium text-[#556C63]">Patients</span>
                                                </p>
                                                <p className="text-[10px] text-[#556C63]">{clinic.bedCapacity === null ? 'Beds unrecorded' : `${clinic.bedCapacity} total beds`}</p>
                                            </div>
                                        </div>

                                        {/* Mini Sub-Revenue Pill */}
                                        <div className="flex items-center justify-between text-[11px] text-[#556C63] px-1 mb-4">
                                            <span>OPD: <strong className="text-[#0E2420]">Unconfigured</strong></span>
                                            <span>IPD: <strong className="text-[#0E2420]">Unconfigured</strong></span>
                                            <span>Rx: <strong className="text-[#0E2420]">{money(clinic.grossPaise)}</strong></span>
                                        </div>
                                    </div>

                                    {/* Action Deck */}
                                    <div className="pt-2 border-t border-[#E6EDE7] flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onSelectClinic(clinic.id)}
                                            className="jvk-admin-primary-btn flex-1 !min-h-9 text-xs"
                                        >
                                            <span>Drill-down to Clinic</span>
                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                        </button>

                                        {isPaused ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => void setBranchStatus(clinic.id, 'active')}
                                                className="border-[#BBE2D1] text-[#047C61] hover:bg-[#DFF4ED] h-9 px-3 rounded-xl text-xs font-semibold"
                                            >
                                                Unpause
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => void setBranchStatus(clinic.id, 'paused')}
                                                className="border-[#F2D2CF] text-[#B9382C] hover:bg-[#FDF1EF] h-9 px-3 rounded-xl text-xs font-semibold"
                                            >
                                                Pause
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                        )}
                    </div>
                )}

                {/* Matrix Table View */}
                {clinicViewMode === 'table' && (
                    <div className="jvk-admin-card overflow-hidden">
                        <div className="jvk-admin-table-region border-0 rounded-none" tabIndex={0} role="region" aria-label="Multi-clinic matrix view">
                            <table className="jvk-admin-table">
                                <thead>
                                    <tr>
                                        <th>Clinic Hub</th>
                                        <th>Hub Code</th>
                                        <th>Location</th>
                                        <th>Manager</th>
                                        <th>Status</th>
                                        <th>Revenue (Today)</th>
                                        <th>Invoices</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredClinics.map((clinic) => (
                                        <tr key={clinic.id}>
                                            <td className="font-bold text-[#0E2420]">
                                                {clinic.name}
                                            </td>
                                            <td className="font-mono text-xs text-[#047C61] font-bold">
                                                {clinic.code ?? 'Unassigned'}
                                            </td>
                                            <td className="text-[#556C63] text-xs">
                                                {clinic.address || 'N/A'}
                                            </td>
                                            <td className="text-[#0E2420] text-xs font-medium">
                                                {clinic.managerName ?? 'Unassigned'}
                                            </td>
                                            <td>
                                                {clinic.status === 'paused' ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-[#FDF1EF] text-[#B9382C] text-[10px] font-bold uppercase">
                                                        Paused
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full bg-[#DFF4ED] text-[#065F46] text-[10px] font-bold uppercase">
                                                        Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="font-mono font-bold text-[#0E2420] tabular-nums">
                                                {money(clinic.grossPaise)}
                                            </td>
                                            <td className="text-[#3C544C] font-medium tabular-nums">
                                                {clinic.patientCount}
                                            </td>
                                            <td className="text-right space-x-2 whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectClinic(clinic.id)}
                                                    className="jvk-admin-primary-btn !min-h-8 !px-3 text-xs"
                                                >
                                                    Drill Down
                                                </button>
                                                {clinic.status === 'paused' ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => void setBranchStatus(clinic.id, 'active')}
                                                        className="text-xs h-8 px-2.5 text-[#047C61] border-[#BBE2D1]"
                                                    >
                                                        Unpause
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => void setBranchStatus(clinic.id, 'paused')}
                                                        className="text-xs h-8 px-2.5 text-[#B9382C] border-[#F2D2CF]"
                                                    >
                                                        Pause
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredClinics.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-5 py-8 text-center text-[#556C63] italic">
                                                No clinics match the search criteria.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* --------------------------------------------------------- */}
            {/* GROUP FINANCIAL & OPERATIONAL ANALYTICS SECTION */}
            {/* --------------------------------------------------------- */}
            <div className="space-y-4">
                <div id="tour-analytics-hub" className="jvk-admin-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:px-5">
                    <div data-jvk-reveal="">
                        <h2 className="jvk-admin-serif text-xl font-bold text-[#0E2420] tracking-tight flex items-center gap-2">
                            <Activity className="w-5 h-5 text-[#047C61]" />
                            <span>Group Financial & Operational Analytics</span>
                        </h2>
                        <p className="text-xs text-[#556C63] mt-0.5">
                            Consolidated revenue in INR & integer Paise, cross-branch comparison, and payment mode distribution.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Select value={dateFilter} onValueChange={(value: HqPeriod) => setDateFilter(value)}>
                            <SelectTrigger aria-label="Reporting period" className="w-[140px] bg-white border-[#CEDAD3] rounded-xl font-medium text-xs h-10">
                                <SelectValue placeholder="Date Range" />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectItem value="today">Today (IST)</SelectItem>
                                <SelectItem value="week">Past 7 Days</SelectItem>
                                <SelectItem value="month">Past 30 Days</SelectItem>
                                <SelectItem value="all">Lifetime Ledger</SelectItem>
                            </SelectContent>
                        </Select>

                        <button
                            type="button"
                            onClick={() => void copySegmentReport()} disabled={!hqLedger}
                            className="jvk-admin-secondary-btn h-10 text-xs"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-[#047C61]" />
                            <span>Copy Report</span>
                        </button>
                    </div>
                </div>

                {/* Live Group Ledger Rollup (Cloudflare Worker Double-Entry Ledger) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="jvk-admin-card border-0 p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#556C63] uppercase tracking-wider">Group Gross Revenue</span>
                            <span className="p-2 bg-[#DFF4ED] text-[#047C61] rounded-xl">
                                <TrendingUp className="w-4 h-4" />
                            </span>
                        </div>
                        <div className="mt-2">
                            <div className="text-2xl font-black text-[#0E2420] tabular-nums">
                                {money(hqLedger?.grossPaise)}
                            </div>
                            <div className="text-[11px] font-mono text-[#047C61] font-semibold mt-0.5">
                                {hqLedger ? `${hqLedger.grossPaise.toLocaleString('en-IN')} paise` : '—'}
                            </div>
                        </div>
                        <div className="text-[10px] text-[#556C63] mt-2 flex items-center justify-between border-t border-[#E6EDE7] pt-2">
                            <span>Gross receipts including tax</span>
                            <span className="font-semibold text-[#0E2420]">Posted sales</span>
                        </div>
                    </Card>

                    <Card className="jvk-admin-card border-0 p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#556C63] uppercase tracking-wider">Group COGS (Cost)</span>
                            <span className="p-2 bg-[#FEF3DC] text-[#B45309] rounded-xl">
                                <Package className="w-4 h-4" />
                            </span>
                        </div>
                        <div className="mt-2">
                            <div className="text-2xl font-black text-[#0E2420] tabular-nums">
                                {money(hqLedger?.cogsPaise)}
                            </div>
                            <div className="text-[11px] font-mono text-[#B45309] font-semibold mt-0.5">
                                {hqLedger ? `${hqLedger.cogsPaise.toLocaleString('en-IN')} paise` : '—'}
                            </div>
                        </div>
                        <div className="text-[10px] text-[#556C63] mt-2 flex items-center justify-between border-t border-[#E6EDE7] pt-2">
                            <span>Double-entry Dr: COGS</span>
                            <span className="font-semibold text-[#0E2420]">Inventory Relieved</span>
                        </div>
                    </Card>

                    <Card className="jvk-admin-card border-0 p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#556C63] uppercase tracking-wider">Net Operating Profit</span>
                            <span className="p-2 bg-[#DFF4ED] text-[#047C61] rounded-xl">
                                <Activity className="w-4 h-4" />
                            </span>
                        </div>
                        <div className="mt-2">
                            <div className="text-2xl font-black text-[#0E2420] tabular-nums">
                                {money(hqLedger?.operatingProfitPaise)}
                            </div>
                            <div className="text-[11px] font-mono text-[#047C61] font-semibold mt-0.5">
                                {hqLedger ? `${hqLedger.operatingProfitPaise.toLocaleString('en-IN')} paise` : '—'}
                            </div>
                        </div>
                        <div className="text-[10px] text-[#556C63] mt-2 flex items-center justify-between border-t border-[#E6EDE7] pt-2">
                            <span>{(() => {
                                const revPaise = hqLedger?.revenuePaise ?? 0;
                                const profitPaise = hqLedger?.operatingProfitPaise ?? 0;
                                return revPaise > 0 ? `Margin: ${((profitPaise / revPaise) * 100).toFixed(1)}%` : 'Margin unavailable';
                            })()}</span>
                            <span className="font-semibold text-[#0E2420]">OPEX Factored</span>
                        </div>
                    </Card>

                    <Card className="jvk-admin-card border-0 p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#556C63] uppercase tracking-wider">Double-Entry Consensus</span>
                            <span className={`p-2 rounded-xl ${reconciled ? 'bg-[#DFF4ED] text-[#047C61]' : 'bg-[#FDF1EF] text-[#B9382C]'}`}>
                                <ShieldCheck className="w-4 h-4" />
                            </span>
                        </div>
                        <div className="mt-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-lg font-black text-[#0E2420]">
                                    {reconciled ? 'Reconciled' : !hqLedger ? 'Ledger unavailable' : hqLedger.journalCount === 0 && !hqLedger.unreconciledSales ? 'No posted journals' : 'Variance detected'}
                                </span>
                                <Badge variant="outline" className={`text-[10px] font-bold ${reconciled ? 'bg-[#DFF4ED] text-[#065F46] border-[#BBE2D1]' : 'bg-[#FDF1EF] text-[#B9382C] border-[#F2D2CF]'}`}>
                                    {reconciled ? 'Balanced' : hqLedger && (hqLedger.journalCount || hqLedger.unreconciledSales) ? 'Review' : '—'}
                                </Badge>
                            </div>
                            <div className="text-[11px] font-mono text-[#556C63] mt-1">
                                Debit {money(hqLedger?.debitPaise)} · Credit {money(hqLedger?.creditPaise)}
                            </div>
                        </div>
                        <div className="text-[10px] text-[#556C63] mt-2 flex items-center justify-between border-t border-[#E6EDE7] pt-2">
                            <span>{hqLedger ? `${hqLedger.journalCount} journals posted · ${hqLedger.lockDate ? `Locked through ${hqLedger.lockDate}` : 'Period unlocked'}` : 'Period status unavailable'}</span>
                            <span className="font-semibold text-[#047C61]">Posted ledger</span>
                        </div>
                    </Card>
                </div>

                {hqLedger && (
                    <details className="jvk-admin-card border-0 p-4">
                        <summary className="cursor-pointer text-sm font-bold text-[#103B32]">Posted branch ledgers</summary>
                        <p className="mt-2 text-xs">Operating profit is net posted pharmacy revenue less COGS, active command expenses excluding tax, and posted stock write-offs. Central operating expenses: {money(hqLedger.centralExpensesPaise)}.</p>
                        <div className="jvk-admin-table-region mt-2" tabIndex={0} role="region" aria-label="Posted branch ledgers">
                            <table className="jvk-admin-table text-xs">
                                <thead><tr><th>Branch</th><th>Gross receipts</th><th>Net revenue</th><th>COGS</th><th>Operating expenses</th><th>Operating profit</th></tr></thead>
                                <tbody>
                                    {hqLedger.branches.map(branch => (
                                        <tr key={branch.clinicId}>
                                            <td>{clinics.find(clinic => clinic.id === branch.clinicId)?.name ?? branch.clinicId}</td>
                                            <td>{money(branch.grossPaise)}</td><td>{money(branch.revenuePaise)}</td>
                                            <td>{money(branch.cogsPaise)}</td><td>{money(branch.operatingExpensesPaise)}</td>
                                            <td>{money(branch.profitPaise)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>
                )}
                <Card className="jvk-admin-card border-0 overflow-hidden p-5 sm:p-6">
                    {/* Dimension Selector & Filters */}
                    <div className="flex flex-col lg:flex-row gap-5 mb-6 border-b border-[#E6EDE7] pb-5 justify-between">
                        <div className="space-y-2.5">
                            <Label className="jvk-admin-serif text-base font-bold text-[#0E2420] flex items-center gap-2">
                                <Activity className="w-4 h-4 text-[#047C61]" />
                                <span>Primary Analytical Dimension</span>
                            </Label>
                            <div role="tablist" aria-label="Primary Analytical Dimension" className="jvk-admin-tablist jvk-admin-tablist-light">
                                {[
                                    { label: 'Branch Comparison', value: 'clinic_id' },
                                    { label: 'Payment Matrix', value: 'payment_mode' },
                                    { label: 'Service Types', value: 'sale_type' }
                                ].map((tab) => (
                                    <button
                                        key={tab.value}
                                        type="button"
                                        role="tab"
                                        aria-selected={groupBy === tab.value}
                                        onClick={() => setGroupBy(tab.value as HqGroup)}
                                        className="jvk-admin-tab text-xs"
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 items-end">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-[#556C63]">Clinic Node</Label>
                                <Select value={filters.clinic} onValueChange={(v) => setFilters(f => ({ ...f, clinic: v }))}>
                                    <SelectTrigger aria-label="Clinic node" className="w-[160px] bg-white border-[#CEDAD3] rounded-xl h-9 text-xs font-medium text-[#0E2420]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="all">All Network Hubs</SelectItem>
                                        {clinics.map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name} {c.status === 'paused' ? '(Paused)' : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-[#556C63]">Payment Mode</Label>
                                <Select value={filters.payment} onValueChange={(v) => setFilters(f => ({ ...f, payment: v }))}>
                                    <SelectTrigger aria-label="Payment mode" className="w-[130px] bg-white border-[#CEDAD3] rounded-xl h-9 text-xs font-medium text-[#0E2420]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="all">All Modes</SelectItem>
                                        <SelectItem value="Cash">Cash</SelectItem>
                                        <SelectItem value="UPI">UPI Instant</SelectItem>
                                        <SelectItem value="CARD">Debit/Credit Card</SelectItem>
                                        <SelectItem value="CREDIT">Credit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-[#556C63]">Service Line</Label>
                                <Select value={filters.type} onValueChange={(v) => setFilters(f => ({ ...f, type: v }))}>
                                    <SelectTrigger aria-label="Service line" className="w-[140px] bg-white border-[#CEDAD3] rounded-xl h-9 text-xs font-medium text-[#0E2420]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="all">All Services</SelectItem>
                                        <SelectItem value="CONSULTATION">OPD Consultation</SelectItem>
                                        <SelectItem value="PHARMACY">Pharmacy Sales</SelectItem>
                                        <SelectItem value="IPD_ADMISSION_ADVANCE" disabled>IPD Advance</SelectItem>
                                        <SelectItem value="IPD">IPD</SelectItem>
                                        <SelectItem value="SERVICE" disabled>General Procedures</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Chart & Breakdown Layout */}
                    {financeError ? <p role="alert">Finance unavailable.</p> : analyticsLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="w-48 h-48 rounded-full border-[18px] border-[#E4EDE7] animate-pulse flex items-center justify-center">
                                <div className="w-20 h-20 rounded-full bg-[#F2F7F4] animate-pulse" />
                            </div>
                            <div className="flex gap-4">
                                <Skeleton className="h-3.5 w-20" />
                                <Skeleton className="h-3.5 w-20" />
                                <Skeleton className="h-3.5 w-20" />
                            </div>
                        </div>
                    ) : displayData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <img
                                src="/assets/admin/analytics-empty.png"
                                alt=""
                                aria-hidden="true"
                                width={164}
                                height={164}
                                className="jvk-admin-artwork w-40 h-auto mb-2"
                            />
                            <h3 className="jvk-admin-serif text-base font-bold text-[#0E2420]">
                                No transactions match these filter criteria
                            </h3>
                            <p className="text-xs sm:text-sm text-[#556C63] mt-1">
                                Try adjusting the selected clinic, payment mode, or service line.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[380px]">
                            {/* Donut Chart / Graphical Visualizer */}
                            <div className="lg:col-span-7 h-[350px] relative flex flex-col justify-center">
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                    <div className="bg-[#FFFDF9]/95 backdrop-blur-md px-5 py-3.5 rounded-3xl border border-[#DCE7DF] shadow-md flex flex-col items-center">
                                        <p className="text-[10px] font-bold text-[#556C63] uppercase tracking-widest">Selected Aggregate</p>
                                        <h3 className="text-2xl md:text-3xl font-black text-[#0E2420] mt-0.5 tabular-nums">
                                            {money(hqLedger?.selectedGrossPaise)}
                                        </h3>
                                        <p className="text-[10px] font-mono font-semibold text-[#047C61] mt-0.5">
                                            {hqLedger ? `${totalSelectedPaise.toLocaleString('en-IN')} paise` : '—'}
                                        </p>
                                        <div className="flex gap-1 mt-2">
                                            <div className="w-6 h-1 bg-[#047C61] rounded-full" />
                                            <div className="w-2 h-1 bg-[#BBE2D1] rounded-full" />
                                        </div>
                                    </div>
                                </div>

                                <ResponsiveContainer width="100%" height={350}>
                                    <PieChart>
                                        <defs>
                                            {COLORS.map((color, i) => (
                                                <linearGradient key={`grad-${i}`} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={color} stopOpacity={0.9} />
                                                    <stop offset="95%" stopColor={color} stopOpacity={1} />
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        <Pie
                                            data={displayData}
                                            innerRadius="62%"
                                            outerRadius="82%"
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                            animationBegin={0}
                                            animationDuration={800}
                                            onMouseEnter={(_, index) => setActiveIndex(index)}
                                            onMouseLeave={() => setActiveIndex(null)}
                                        >
                                            {displayData.map((_entry: any, index: number) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={`url(#grad-${index % COLORS.length})`}
                                                    className="transition-all duration-300 cursor-pointer outline-none"
                                                    style={{
                                                        fillOpacity: activeIndex === null || activeIndex === index ? 1 : 0.5,
                                                        transform: activeIndex === index ? 'scale(1.04)' : 'scale(1)',
                                                        transformOrigin: 'center',
                                                        stroke: activeIndex === index ? 'white' : 'none',
                                                        strokeWidth: 2
                                                    }}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            wrapperStyle={{ zIndex: 1000 }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const val = Number(payload[0].value);
                                                    return (
                                                        <div className="bg-[#0E2420] text-white p-3.5 rounded-2xl shadow-xl border border-[#1E473D]">
                                                            <p className="text-xs font-bold text-[#9CD3BF] uppercase tracking-wider mb-1">{payload[0].name}</p>
                                                            <p className="text-xl font-black text-white">₹{val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                            <p className="text-[11px] font-mono text-[#6EE7B7]">{(val * 100).toLocaleString('en-IN')} Paise</p>
                                                            <p className="text-[10px] text-[#E5A736] font-bold mt-1.5">
                                                                {(val / (totalSelectedRevenue || 1) * 100).toFixed(1)}% of total selection
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Inline Bars beside Chart */}
                            <div className="lg:col-span-5 flex flex-col justify-center space-y-3">
                                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-2">
                                    {displayData.map((item: any, i: number) => {
                                        const percentage = (Number(item.value) / (totalSelectedRevenue || 1) * 100);
                                        const isFocused = activeIndex === i;
                                        return (
                                            <div
                                                key={i}
                                                onMouseEnter={() => setActiveIndex(i)}
                                                onMouseLeave={() => setActiveIndex(null)}
                                                className={`p-3 rounded-xl transition-all duration-200 border cursor-pointer ${isFocused
                                                    ? 'bg-[#EAF6F1] border-[#96C3B1]'
                                                    : 'bg-[#F7FAF7] border-[#E4EDE7] hover:bg-[#EFF7F2]'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-center text-xs mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-xs" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                                        <span className="font-bold text-[#0E2420]">{item.name}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-mono font-bold text-[#0E2420]">{money(item.paise)}</span>
                                                        <span className="text-[10px] text-[#556C63] font-mono ml-1.5">({percentage.toFixed(1)}%)</span>
                                                    </div>
                                                </div>
                                                <div className="h-1.5 w-full bg-[#DCE7DF] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500 ease-out"
                                                        style={{
                                                            width: `${percentage}%`,
                                                            backgroundColor: COLORS[i % COLORS.length],
                                                            opacity: activeIndex === null || isFocused ? 1 : 0.4
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            {/* --------------------------------------------------------- */}
            {/* GROUP INVENTORY & CENTRAL PROCUREMENT RADAR */}
            {/* --------------------------------------------------------- */}
            <div className="space-y-5">
                <div className="jvk-admin-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:px-5">
                    <div>
                        <h2 className="jvk-admin-serif text-xl font-bold text-[#0E2420] tracking-tight flex items-center gap-2">
                            <Package className="w-5 h-5 text-[#047C61]" />
                            <span>Central Inventory & Stock Rebalancing Radar</span>
                        </h2>
                        <p className="text-xs text-[#556C63] mt-0.5">
                            Group inventory, current branch shortages, and recorded stock transfers.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsTransferModalOpen(true)}
                        disabled={!stock || !fleet}
                        className="jvk-admin-primary-btn h-10 text-xs"
                    >
                        <ArrowRightLeft className="w-4 h-4" />
                        <span>Initiate Stock Transfer</span>
                    </button>
                </div>

                {/* Radar Grid: Alerts & Available Transfers */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Left 2 Cols: Low-Stock Shortage Radar */}
                    <Card className="lg:col-span-2 jvk-admin-card border-0 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="jvk-admin-serif font-bold text-[#0E2420] text-base flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-[#B9382C]" />
                                    <span>Branch Shortage Radar ({lowStockRadarItems.length})</span>
                                </h3>
                                <p className="text-xs text-[#556C63] mt-0.5">
                                    Active branches below 10 available units for tracked formulations.
                                </p>
                            </div>
                            <Badge variant="outline" className="text-[#B9382C] bg-[#FDF1EF] border-[#F2D2CF] text-[10px] font-bold uppercase">
                                Inventory review
                            </Badge>
                        </div>

                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                            {lowStockRadarItems.map((item, idx) => (
                                <div key={idx} className="p-3.5 bg-[#FAFBF8] rounded-xl border border-[#E2ECE5] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-[#96C3B1] transition-colors">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-[#0E2420] text-sm">{item.item_name}</p>
                                            <Badge variant="outline" className="bg-[#FDF1EF] text-[#B9382C] border-[#F2D2CF] text-[10px] font-mono">
                                                {item.total_quantity} left
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-[#556C63] mt-0.5">
                                            Depleted Hub: <strong className="text-[#0E2420]">{item.deficitClinicName}</strong> · Min Threshold: {item.threshold || 10}
                                        </p>
                                        {item.surplusClinicName ? (
                                            <p className="text-[11px] text-[#047C61] font-medium flex items-center gap-1 mt-1">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-[#047C61]" />
                                                Recommended source: <strong>{item.surplusClinicName}</strong> has {item.surplusQuantity} units in surplus
                                            </p>
                                        ) : (
                                            <p className="text-[11px] text-[#B45309] font-medium mt-1">
                                                Network-wide shortage. Central vendor PO replenishment required.
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => initiateTransferForRadarItem(item)}
                                        className="jvk-admin-primary-btn !min-h-8 !px-3.5 text-xs shrink-0"
                                    >
                                        <ArrowRightLeft className="w-3.5 h-3.5" />
                                        <span>Balance Stock</span>
                                    </button>
                                </div>
                            ))}

                            {lowStockRadarItems.length === 0 && (
                                <div className="text-center py-8 flex flex-col items-center gap-2">
                                    <img
                                        src="/assets/admin/medicine-bottles.png"
                                        alt=""
                                        aria-hidden="true"
                                        width={126}
                                        height={126}
                                        className="jvk-admin-artwork w-28 h-auto"
                                    />
                                    <div>
                                        <p className="jvk-admin-serif font-bold text-[#0E2420] text-base">Tracked stock status</p>
                                        <p className="text-xs text-[#556C63] mt-0.5">{stockError || fleetError ? 'Group stock unavailable.' : !stock || !fleet ? 'Loading group stock…' : !inventory.length ? 'No stock batches recorded.' : 'No active branch below the tracked stock threshold.'}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Right Col: Group Inventory Catalog Overview */}
                    <Card className="jvk-admin-card border-0 p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="jvk-admin-serif font-bold text-[#0E2420] text-base flex items-center gap-2">
                                    <Package className="w-4 h-4 text-[#047C61]" />
                                    <span>Group SKU Matrix</span>
                                </h3>
                                <Badge className="bg-[#047C61] text-white text-[10px]">
                                    {stock ? `${stock.items.length} SKUs` : 'Unavailable'}
                                </Badge>
                            </div>

                            <div className="space-y-3 mb-4">
                                <div className="p-3 bg-[#F6FAF7] rounded-xl border border-[#E2ECE5] flex justify-between items-center text-xs">
                                    <span className="text-[#556C63]">Total Tracked Inventory</span>
                                    <span className="font-bold text-[#0E2420] font-mono">{stock ? `${inventory.length} records` : 'Unavailable'}</span>
                                </div>
                                <div className="p-3 bg-[#F6FAF7] rounded-xl border border-[#E2ECE5] flex justify-between items-center text-xs">
                                    <span className="text-[#556C63]">Expired or expiring within 90 days</span>
                                    <span className={`font-bold font-mono ${expiringItems.length > 0 ? 'text-[#B45309]' : 'text-[#0E2420]'}`}>
                                        {stock ? `${expiringItems.length} batches` : 'Unavailable'}
                                    </span>
                                </div>
                                <div className="p-3 bg-[#F6FAF7] rounded-xl border border-[#E2ECE5] flex justify-between items-center text-xs">
                                    <span className="text-[#556C63]">Active Supply Channels</span>
                                    <span className="font-bold text-[#047C61]">{stock ? 'D1 inventory records' : 'Stock unavailable'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 jvk-admin-card-sage text-xs text-[#0E2420] space-y-1">
                            <p className="font-bold flex items-center gap-1.5 text-[#047C61]">
                                <Zap className="w-3.5 h-3.5" />
                                <span>Inter-Branch Rebalancer</span>
                            </p>
                            <p className="text-[11px] text-[#3C544C] leading-relaxed">
                                A committed transfer updates both batches and records an immutable audit entry.
                            </p>
                        </div>
                    </Card>
                </div>

                {/* Segment Contribution + Multi-Clinic Network Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <Card className="jvk-admin-card border-0 p-5 flex flex-col justify-between space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="jvk-admin-serif text-base font-bold text-[#0E2420] flex items-center gap-2">
                                <Activity className="w-4 h-4 text-[#047C61]" />
                                <span>Segment Contribution</span>
                            </h3>
                            <Badge variant="outline" className="text-[11px] text-[#065F46] bg-[#DFF4ED] border-[#BBE2D1]">
                                {displayData.length} Categories
                            </Badge>
                        </div>

                        {displayData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-4 text-center">
                                <img
                                    src="/assets/admin/segment-empty.png"
                                    alt=""
                                    aria-hidden="true"
                                    width={136}
                                    height={98}
                                    className="jvk-admin-artwork w-36 h-auto mb-2"
                                />
                                <p className="jvk-admin-serif text-sm font-bold text-[#0E2420]">No segment data available</p>
                                <p className="text-xs text-[#556C63] mt-0.5">
                                    Once transactions are recorded, the segment breakdown will appear here.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {displayData.slice(0, 4).map((item: any, i: number) => {
                                    const percentage = (Number(item.value) / (totalSelectedRevenue || 1) * 100);
                                    return (
                                        <div key={item.name + i} className="flex items-center justify-between rounded-xl border border-[#E2ECE5] bg-[#FAFBF8] px-3.5 py-2.5 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                                <span className="font-bold text-[#0E2420]">{item.name}</span>
                                            </div>
                                            <span className="font-mono font-bold text-[#0E2420] tabular-nums">
                                                {money(item.paise)} ({percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex justify-center pt-1">
                            <button
                                type="button"
                                onClick={() => void copySegmentReport()} disabled={!hqLedger}
                                className="jvk-admin-secondary-btn !min-h-9 text-xs"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-[#047C61]" />
                                <span>Copy Segment Breakdown</span>
                            </button>
                        </div>
                    </Card>

                    <Card className="jvk-admin-card border-0 p-5 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="jvk-admin-serif text-base font-bold text-[#0E2420] flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-[#047C61]" />
                                <span>Multi-Clinic Network Summary</span>
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                            <div className="sm:col-span-7 jvk-admin-table-region" tabIndex={0} role="region" aria-label="Multi-Clinic Network Summary">
                                <table className="jvk-admin-table">
                                    <thead>
                                        <tr>
                                            <th>Metric</th>
                                            <th className="text-right">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="text-xs font-medium text-[#3C544C]">Total Clinics</td>
                                            <td className="text-right font-bold text-[#0E2420] tabular-nums">{clinics.length}</td>
                                        </tr>
                                        <tr>
                                            <td className="text-xs font-medium text-[#3C544C]">Active IPD Beds</td>
                                            <td className="text-right font-bold text-[#0E2420] tabular-nums">{fleet ? activeIPDCount : 'Unavailable'}</td>
                                        </tr>
                                        <tr>
                                            <td className="text-xs font-medium text-[#3C544C]">Inventory value at batch cost</td>
                                            <td className="text-right font-bold text-[#047C61] tabular-nums">{money(stock ? totalInventoryValuePaise : undefined)}</td>
                                        </tr>
                                        <tr>
                                            <td className="text-xs font-medium text-[#3C544C]">Today's Revenue</td>
                                            <td className="text-right font-bold text-[#0E2420] tabular-nums">{money(fleet ? totalRevenuePaise : undefined)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="sm:col-span-5 flex justify-center">
                                <img
                                    src="/assets/kiosk/kiosk-clinic-watercolor.png"
                                    alt=""
                                    aria-hidden="true"
                                    width={170}
                                    height={95}
                                    className="jvk-admin-artwork w-40 h-auto"
                                />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* HQ Central Rebalancing Telemetry Card */}
                {lowStockRadarItems.some(item => item.surplusClinicId) && (
                    <Card className="jvk-admin-card-sage border-0 p-5">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-[#047C61] text-white font-mono text-[10px] tracking-wide uppercase px-2 py-0.5">
                                        Cloudflare AI Rebalancing Engine
                                    </Badge>
                                    <span className="text-xs text-[#556C63] font-medium">Optimal Transfer Detected</span>
                                </div>
                                <h3 className="jvk-admin-serif text-base font-bold text-[#0E2420] flex items-center gap-2 mt-1">
                                    <Zap className="w-4 h-4 text-[#D97706]" />
                                    <span>Dispatch Recommendation: {lowStockRadarItems.find(item => item.surplusClinicId)?.item_name}</span>
                                </h3>
                                <p className="text-xs text-[#3C544C]">
                                    Available stock at another active branch can replenish this shortage.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const suggestion = lowStockRadarItems.find(item => item.surplusClinicId);
                                    if (suggestion) initiateTransferForRadarItem(suggestion);
                                }}
                                className="jvk-admin-primary-btn text-xs h-9 px-4 shrink-0"
                            >
                                <ArrowRightLeft className="w-4 h-4" />
                                <span>Open Transfer Wizard</span>
                            </button>
                        </div>
                    </Card>
                )}

                {/* Cross-Clinic Inventory Telemetry Table */}
                {matrix.length > 0 && (
                    <Card className="jvk-admin-card border-0 p-5 overflow-hidden">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                            <div>
                                <h3 id="hq-radar-table-heading" className="jvk-admin-serif font-bold text-[#0E2420] text-sm flex items-center gap-2">
                                    <Database className="w-4 h-4 text-[#047C61]" />
                                    <span>Group SKU Matrix ({matrix.length} Tracked Formulations)</span>
                                </h3>
                                <p className="text-xs text-[#556C63]">
                                    Available unexpired units by branch. Group quantities include all recorded branches.
                                </p>
                            </div>
                            <Badge variant="outline" className="bg-[#DFF4ED] text-[#065F46] border-[#BBE2D1] text-[10px] font-mono">
                                Group available: {totalGroupAvailable} units
                            </Badge>
                        </div>

                        <div className="jvk-admin-table-region" tabIndex={0} role="region" aria-labelledby="hq-radar-table-heading">
                            <table className="jvk-admin-table text-xs">
                                <thead>
                                    <tr>
                                        <th>Formulation & Brand</th>
                                        <th>Strength</th>
                                        <th>Available by branch</th>
                                        <th>Group available</th>
                                        <th>Reorder Point</th>
                                        <th>Status</th>
                                        <th className="text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matrix.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div className="font-bold text-[#0E2420]">{item.brand}</div>
                                                <div className="text-[11px] text-[#556C63]">{item.salt}</div>
                                            </td>
                                            <td className="font-mono font-medium text-[#3C544C]">
                                                {item.strengthMg} mg
                                            </td>
                                            <td className="font-mono font-bold">
                                                {item.branches.map(branch => (
                                                    <div key={branch.id} className="text-xs">{branch.name}: {branch.units} units</div>
                                                ))}
                                            </td>
                                            <td className="font-mono text-[#047C61] font-semibold">{item.units} units</td>
                                            <td className="font-mono text-[#556C63]">{threshold} units</td>
                                            <td><Badge variant="outline">
                                                {item.branches.some(branch => branch.status === 'active' && branch.units < threshold)
                                                    ? 'Active branch shortage' : 'Above threshold'}
                                            </Badge></td>
                                            <td className="text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const shortage = lowStockRadarItems.find(row => row.skuId === item.id);
                                                        if (shortage) initiateTransferForRadarItem(shortage);
                                                        else {
                                                            setTransferSku(item.id);
                                                            setTransferBatch('');
                                                            setIsTransferModalOpen(true);
                                                        }
                                                    }}
                                                    className="jvk-admin-secondary-btn !min-h-7 !px-2.5 text-xs"
                                                >
                                                    <ArrowRightLeft className="w-3 h-3 text-[#047C61]" />
                                                    <span>Rebalance</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>

            {/* --------------------------------------------------------- */}
            {/* INTER-CLINIC STOCK TRANSFER MODAL WIZARD */}
            {/* --------------------------------------------------------- */}
            <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
                <DialogContent className="sm:max-w-[550px] bg-white border-slate-200 text-slate-900 shadow-2xl p-6">
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                <ArrowRightLeft className="w-4 h-4" />
                            </div>
                            <DialogTitle className="text-xl font-bold text-slate-900">Inter-Clinic Stock Rebalancer</DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-slate-500">
                            Transfer stock units between network clinics. The selected lot and both stock movements appear in the transfer audit.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleStockTransferSubmit} className="space-y-4 pt-2">
                        {/* Select Item */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">Select Medicine / Item</Label>
                            <Select value={transferSku} onValueChange={value => { setTransferSku(value); setTransferBatch(''); }}>
                                <SelectTrigger aria-label="Medicine" className="bg-slate-50 border-slate-200 rounded-xl h-11 text-sm font-medium">
                                    <SelectValue placeholder="Choose medicine to transfer..." />
                                </SelectTrigger>
                                <SelectContent className="bg-white max-h-60">
                                    {stock?.items.map(item => (
                                        <SelectItem key={item.id} value={item.id}>{item.brand} · {item.strengthMg} mg {item.form}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Source and Destination Clinics */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-bold text-slate-700">Source Clinic (Donor)</Label>
                                    {transferSourceClinic && (
                                        <span className="text-[10px] font-mono text-emerald-600 font-bold">
                                            Stock: {availableSourceQuantity}
                                        </span>
                                    )}
                                </div>
                                <Select value={transferSourceClinic} onValueChange={value => { setTransferSourceClinic(value); setTransferBatch(''); }}>
                                    <SelectTrigger aria-label="Source clinic" className="bg-slate-50 border-slate-200 rounded-xl h-11 text-xs">
                                        <SelectValue placeholder="Select donor clinic..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        {clinics.map(c => (
                                            <SelectItem key={c.id} value={c.id} disabled={c.id === transferDestClinic || c.status === 'paused'}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-bold text-slate-700">Destination Clinic</Label>
                                    {transferDestClinic && (
                                        <span className="text-[10px] font-mono text-slate-500 font-bold">
                                            Current: {availableDestQuantity}
                                        </span>
                                    )}
                                </div>
                                <Select value={transferDestClinic} onValueChange={setTransferDestClinic}>
                                    <SelectTrigger aria-label="Destination clinic" className="bg-slate-50 border-slate-200 rounded-xl h-11 text-xs">
                                        <SelectValue placeholder="Select receiving clinic..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        {clinics.map(c => (
                                            <SelectItem key={c.id} value={c.id} disabled={c.id === transferSourceClinic || c.status === 'paused'}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">Source Batch</Label>
                            <Select value={transferBatch} onValueChange={setTransferBatch} disabled={!transferOptions.length}>
                                <SelectTrigger aria-label="Source batch" className="bg-slate-50 border-slate-200 rounded-xl h-11 text-xs">
                                    <SelectValue placeholder={transferSourceClinic && transferSku ? "Choose an eligible batch" : "Select medicine and source first"} />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    {transferOptions.map(batch => (
                                        <SelectItem key={batch.id} value={batch.id}>
                                            {batch.batchNo} · {batch.available} available · expiry {batch.expiry}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {transferSourceClinic && transferSku && !transferOptions.length && <p className="text-xs">No available batches at the source clinic.</p>}
                        </div>

                        {/* Transfer Quantity and Quick Helpers */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs font-bold text-slate-700">Transfer Quantity (Units)</Label>
                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setTransferQuantity(Math.max(1, Math.floor(availableSourceQuantity * 0.25)))}
                                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold"
                                    >
                                        25%
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTransferQuantity(Math.max(1, Math.floor(availableSourceQuantity * 0.50)))}
                                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold"
                                    >
                                        50%
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTransferQuantity(Math.max(1, availableSourceQuantity))}
                                        className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold"
                                    >
                                        Max
                                    </button>
                                </div>
                            </div>
                            <Input
                                type="number"
                                aria-label="Transfer quantity"
                                min={1}
                                max={availableSourceQuantity || 1}
                                value={transferQuantity}
                                onChange={(e) => setTransferQuantity(Number(e.target.value))}
                                className="bg-slate-50 border-slate-200 h-11 text-sm rounded-xl font-mono"
                            />
                        </div>

                        {/* Transfer Reason */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">Rebalance Note / Reason</Label>
                            <Input
                                aria-label="Transfer reason" value={transferReason}
                                onChange={(e) => setTransferReason(e.target.value)}
                                placeholder="e.g. Urgent OPD replenishment, Batch reallocation"
                                className="bg-slate-50 border-slate-200 h-10 text-xs rounded-xl"
                            />
                        </div>

                        {/* Summary Before/After Preview */}
                        {transferSourceClinic && transferDestClinic && selectedBatch && (
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Rebalance Preview</p>
                                <div className="flex justify-between items-center text-slate-600">
                                    <span>{clinics.find(c => c.id === transferSourceClinic)?.name}:</span>
                                    <span className="font-mono font-bold text-slate-800">
                                        {availableSourceQuantity} → <span className="text-rose-600">{Math.max(0, availableSourceQuantity - transferQuantity)}</span>
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-slate-600">
                                    <span>{clinics.find(c => c.id === transferDestClinic)?.name}:</span>
                                    <span className="font-mono font-bold text-slate-800">
                                        {availableDestQuantity} → <span className="text-emerald-600">{availableDestQuantity + transferQuantity}</span>
                                    </span>
                                </div>
                            </div>
                        )}

                        <DialogFooter className="pt-2">
                            <Button
                                type="submit"
                                disabled={transferLoading || !canTransfer}
                                className="jvk-admin-primary-btn w-full h-11"
                            >
                                {transferLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                Confirm & Execute Rebalance
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
