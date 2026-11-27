import { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { staffApi, useStaffData } from '@/lib/staffApi';
import { paiseToRupeesString, rupeesToPaise } from '@/lib/utils';
import { useHospital } from '@/context/HospitalContext';
import { 
    Loader2, 
    Monitor, 
    Plus, 
    Search, 
    Filter, 
    Trash2,
    AlertCircle,
    AlertTriangle,
    Bed,
    Calendar,
    FileText,
    IndianRupee,
    Laptop,
    Layers,
    Tv,
    Wrench,
    Activity
} from 'lucide-react';
import { Card } from '@/components/ui/basic';
import { Button } from '@/components/ui/basic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface Equipment {
    id: string;
    clinic_id: string | null;
    name: string;
    category: string;
    quantity: number;
    purchase_date: string;
    purchase_cost_paise: number;
    status: 'FUNCTIONAL' | 'MAINTENANCE' | 'RETIRED';
    created_at: string;
}

const CATEGORIES = [
    { label: 'Beds', icon: Bed, value: 'BEDS' },
    { label: 'Medical Machines', icon: Activity, value: 'MACHINES' },
    { label: 'IT / Electronics', icon: Laptop, value: 'IT' },
    { label: 'Furniture', icon: Tv, value: 'FURNITURE' },
    { label: 'Maintenance Tools', icon: Wrench, value: 'MAINTENANCE' },
    { label: 'Other', icon: Monitor, value: 'OTHER' }
];

export function EquipmentsDashboard() {
    const { hospital } = useHospital();
    const { data: directory } = useStaffData<{ clinics: { id: string; name: string }[] }>('/clinical/command/clinics');
    const clinics = directory?.clinics ?? [];
    const { toast } = useToast();
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchEquipments();
    }, []);

    const fetchEquipments = async () => {
        setLoading(true);
        try {
            const { items } = await staffApi<{ items: Equipment[] }>('/clinical/command/equipment');
            setEquipments(items);
        } catch (error: any) {
            console.error('Error fetching equipments:', error);
            toast({ title: 'Error', description: 'Failed to load equipments', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddEquipment = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        
        const payload = {
            clinic_id: formData.get('clinic_id') || null,
            name: formData.get('name') as string,
            category: formData.get('category') as string,
            quantity: Number(formData.get('quantity')),
            purchase_cost_paise: rupeesToPaise(String(formData.get('purchase_cost'))),
            purchase_date: formData.get('purchase_date') as string,
        };

        try {
            await staffApi('/clinical/command/equipment', { method: 'POST', body: JSON.stringify(payload) });
            
            toast({ title: 'Success', description: 'Equipment added to inventory successfully' });
            setIsAddModalOpen(false);
            fetchEquipments();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to add equipment', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteEquipment = async (id: string) => {
        if (!confirm('Are you sure you want to remove this equipment record?')) return;

        try {
            await staffApi(`/clinical/command/equipment/${id}`, { method: 'DELETE' });
            toast({ title: 'Success', description: 'Equipment record removed' });
            setEquipments(equipments.filter(e => e.id !== id));
        } catch (error: any) {
            toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' });
        }
    };

    const sortedAndFiltered = useMemo(() => {
        return equipments.filter(e => {
            const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 e.category.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = filterCategory === 'ALL' || e.category === filterCategory;
            return matchesSearch && matchesCategory;
        });
    }, [equipments, searchQuery, filterCategory]);

    const stats = useMemo(() => {
        return {
            totalItems: sortedAndFiltered.reduce((sum, e) => sum + e.quantity, 0),
            totalValue: sortedAndFiltered.reduce((sum, e) => sum + (e.purchase_cost_paise * e.quantity), 0),
            functional: sortedAndFiltered.filter(e => e.status === 'FUNCTIONAL').length
        };
    }, [sortedAndFiltered]);

    const handleGenerateAssetReport = () => {
        if (equipments.length === 0) {
            toast({ title: 'No Data', description: 'No equipment records found to generate report', variant: 'destructive' });
            return;
        }

        const doc = new jsPDF();
        const hospitalName = hospital?.name || 'Hospital Asset Registry';
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

        // Header
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(hospitalName.toUpperCase(), 105, 20, { align: 'center' });
        
        doc.setFontSize(16);
        doc.text("FIXED ASSET REGISTRY REPORT", 105, 30, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${dateStr}`, 105, 38, { align: 'center' });
        doc.setLineWidth(0.5);
        doc.line(20, 42, 190, 42);

        let y = 55;
        const rowHeight = 10;
        const col1 = 20; // Name
        const col2 = 80; // Category
        const col3 = 120; // Qty
        const col4 = 140; // Unit Cost
        const col5 = 170; // Total

        // Table Header
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text("Asset Name", col1, y);
        doc.text("Category", col2, y);
        doc.text("Qty", col3, y);
        doc.text("Unit Cost", col4, y);
        doc.text("Total Value", col5, y);
        y += 4;
        doc.line(20, y, 190, y);
        y += 8;

        doc.setFont('helvetica', 'normal');
        equipments.forEach((item) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
                // Repeat Header on new page
                doc.setFont('helvetica', 'bold');
                doc.text("Asset Name", col1, y);
                doc.text("Category", col2, y);
                doc.text("Qty", col3, y);
                doc.text("Unit Cost", col4, y);
                doc.text("Total Value", col5, y);
                y += 4;
                doc.line(20, y, 190, y);
                y += 8;
                doc.setFont('helvetica', 'normal');
            }

            const categoryLabel = CATEGORIES.find(c => c.value === item.category)?.label || item.category;
            
            doc.text(item.name.substring(0, 25), col1, y);
            doc.text(categoryLabel, col2, y);
            doc.text(item.quantity.toString(), col3, y);
            doc.text(`Rs. ${paiseToRupeesString(item.purchase_cost_paise)}`, col4, y);
            doc.text(`Rs. ${paiseToRupeesString(item.purchase_cost_paise * item.quantity)}`, col5, y);
            
            y += rowHeight;
        });

        // Summary Section
        y += 10;
        if (y > 250) { doc.addPage(); y = 20; }
        
        doc.setLineWidth(0.8);
        doc.line(20, y, 190, y);
        y += 10;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("VALUATION SUMMARY", 20, y);
        
        y += 10;
        doc.setFontSize(12);
        doc.text(`Total Registered Assets: ${stats.totalItems}`, 20, y);
        y += 8;
        doc.setTextColor(21, 128, 61); // emerald-700
        doc.text(`Total Asset Valuation: Rs. ${paiseToRupeesString(stats.totalValue)}`, 20, y);

        doc.save(`Asset_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        toast({ title: 'Success', description: 'Asset report generated and downloaded' });
    };

    const distinctCategoryCount = useMemo(
        () => new Set(equipments.map((item) => item.category)).size,
        [equipments],
    );
    const totalFunctionalRecords = useMemo(
        () => equipments.filter((item) => item.status === 'FUNCTIONAL').length,
        [equipments],
    );
    const totalNonFunctionalRecords = useMemo(
        () => equipments.filter((item) => item.status !== 'FUNCTIONAL').length,
        [equipments],
    );

    return (
        <div className="jvk-admin-page mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
            {/* Header */}
            <header className="jvk-admin-card-hero flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 overflow-hidden">
                <div className="space-y-1.5 z-10">
                    <h1 className="jvk-admin-serif text-3xl font-bold text-[#0E2420] tracking-tight">Equipments & Assets</h1>
                    <p className="text-sm text-[#556C63]">Manage hospital machines, furniture, and fixed assets</p>
                </div>

                <div className="hidden md:flex shrink-0 items-center justify-center">
                    <img
                        src="/assets/admin/equipment-hero.png"
                        alt=""
                        aria-hidden="true"
                        width={215}
                        height={132}
                        className="jvk-admin-artwork w-48 lg:w-52 h-auto"
                    />
                </div>

                <div className="flex items-center gap-3 z-10 shrink-0">
                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <button type="button" className="jvk-admin-primary-btn">
                                <Plus className="w-4 h-4" />
                                <span>Add Equipment</span>
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px] bg-[#FFFDF8] border-[#DCE7DF]">
                            <DialogHeader>
                                <DialogTitle className="jvk-admin-serif text-xl font-bold text-[#0E2420]">Add New Equipment</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAddEquipment} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[#2A423A]">Equipment Name</label>
                                    <input 
                                        name="name" 
                                        required 
                                        placeholder="e.g. Samsung Smart TV, ICU Bed Model X"
                                        className="w-full px-3 py-2 bg-white border border-[#CEDAD3] rounded-lg focus:ring-2 focus:ring-[#047C61]/20 outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[#2A423A]">Category</label>
                                        <select name="category" required className="w-full px-3 py-2 bg-white border border-[#CEDAD3] rounded-lg focus:ring-2 focus:ring-[#047C61]/20 outline-none">
                                            {CATEGORIES.map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[#2A423A]">Quantity</label>
                                        <input 
                                            name="quantity" 
                                            type="number" 
                                            min="1"
                                            required 
                                            defaultValue="1"
                                            className="w-full px-3 py-2 bg-white border border-[#CEDAD3] rounded-lg focus:ring-2 focus:ring-[#047C61]/20 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[#2A423A]">Unit Cost (₹)</label>
                                        <input 
                                            name="purchase_cost" 
                                            type="number" 
                                            step="0.01"
                                            required 
                                            placeholder="0.00"
                                            className="w-full px-3 py-2 bg-white border border-[#CEDAD3] rounded-lg focus:ring-2 focus:ring-[#047C61]/20 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[#2A423A]">Purchase Date</label>
                                        <input 
                                            name="purchase_date" 
                                            type="date" 
                                            required 
                                            defaultValue={new Date().toISOString().split('T')[0]}
                                            className="w-full px-3 py-2 bg-white border border-[#CEDAD3] rounded-lg focus:ring-2 focus:ring-[#047C61]/20 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[#2A423A]">Assign to Clinic (Optional)</label>
                                    <select name="clinic_id" className="w-full px-3 py-2 bg-white border border-[#CEDAD3] rounded-lg focus:ring-2 focus:ring-[#047C61]/20 outline-none">
                                        <option value="">Hospital Wide / Global</option>
                                        {clinics.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                                    <button type="submit" disabled={isSubmitting} className="jvk-admin-primary-btn">
                                        {isSubmitting ? 'Saving...' : 'Add Equipment'}
                                    </button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="jvk-admin-card p-5 flex items-start gap-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] text-[#047C61]">
                        <Layers className="w-5 h-5" />
                    </span>
                    <div>
                        <div className="text-xs font-medium text-[#556C63]">Total Assets</div>
                        <div className="text-2xl sm:text-3xl font-bold text-[#0E2420] tabular-nums mt-0.5">{stats.totalItems}</div>
                        <div className="text-xs text-[#6A8178] mt-1">Units tracked</div>
                    </div>
                </div>
                <div className="jvk-admin-card p-5 flex items-start gap-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] text-[#047C61]">
                        <IndianRupee className="w-5 h-5" />
                    </span>
                    <div>
                        <div className="text-xs font-medium text-[#556C63]">Total Valuation</div>
                        <div className="text-2xl sm:text-3xl font-bold text-[#047C61] tabular-nums mt-0.5">₹{paiseToRupeesString(stats.totalValue)}</div>
                        <div className="text-xs text-[#047C61] mt-1">Acquisition cost</div>
                    </div>
                </div>
                <div className="jvk-admin-card p-5 flex items-start gap-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E4F4EA] border border-[#C1E4CC] text-[#059669]">
                        <Activity className="w-5 h-5" />
                    </span>
                    <div>
                        <div className="text-xs font-medium text-[#556C63]">Functional</div>
                        <div className="text-2xl sm:text-3xl font-bold text-[#0E2420] tabular-nums mt-0.5">{stats.functional}</div>
                        <div className="text-xs text-[#1D6FA5] mt-1">Active categories</div>
                    </div>
                </div>
                <div className="jvk-admin-card p-5 flex items-start gap-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F3EFFC] border border-[#DECFF7] text-[#6D28D9]">
                        <Calendar className="w-5 h-5" />
                    </span>
                    <div>
                        <div className="text-xs font-medium text-[#556C63]">Recent Activity</div>
                        <div className="text-2xl sm:text-3xl font-bold text-[#6D28D9] mt-0.5">{equipments.length > 0 ? 'Active' : 'N/A'}</div>
                        <div className="text-xs text-[#6D28D9] mt-1">Asset registry</div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar Filters */}
                <div>
                    <div className="jvk-admin-card p-4">
                        <h3 className="jvk-admin-serif text-base font-bold text-[#0E2420] mb-3.5 flex items-center gap-2">
                            <Filter size={16} className="text-[#047C61]" />
                            Filter by Category
                        </h3>
                        <div className="space-y-1">
                            <button
                                type="button"
                                onClick={() => setFilterCategory('ALL')}
                                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                    filterCategory === 'ALL' 
                                    ? 'bg-[#DFF4ED] text-[#065F46] font-semibold' 
                                    : 'text-[#3C544C] hover:bg-[#EEF6F1]'
                                }`}
                            >
                                All Equipments
                            </button>
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setFilterCategory(cat.value)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                                        filterCategory === cat.value 
                                        ? 'bg-[#DFF4ED] text-[#065F46] font-semibold' 
                                        : 'text-[#3C544C] hover:bg-[#EEF6F1]'
                                    }`}
                                >
                                    <cat.icon size={16} className={filterCategory === cat.value ? 'text-[#047C61]' : 'text-[#6B847B]'} />
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Table */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="relative">
                        <Search className="w-4 h-4 text-[#6B847B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search equipment by name or model..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#CEDAD3] rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#047C61]/20 shadow-xs"
                        />
                    </div>

                    <div className="jvk-admin-card overflow-hidden">
                        <div className="jvk-admin-table-region border-0 rounded-none" tabIndex={0} role="region" aria-label="Equipments and assets inventory">
                            <table className="jvk-admin-table">
                                <thead>
                                    <tr>
                                        <th>Asset Item</th>
                                        <th>Category</th>
                                        <th className="text-center">Qty</th>
                                        <th>Purchase Cost</th>
                                        <th>Status</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-[#556C63]">
                                                <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#047C61]" />
                                            </td>
                                        </tr>
                                    ) : sortedAndFiltered.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center justify-center">
                                                    <img
                                                        src="/assets/admin/equipment-hero.png"
                                                        alt=""
                                                        aria-hidden="true"
                                                        width={132}
                                                        height={86}
                                                        className="jvk-admin-artwork w-32 h-auto opacity-85 mb-3"
                                                    />
                                                    <h3 className="jvk-admin-serif text-base font-bold text-[#0E2420]">No equipment found</h3>
                                                    <p className="text-xs sm:text-sm text-[#556C63] mt-1">
                                                        No equipment found matching your criteria.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsAddModalOpen(true)}
                                                        className="jvk-admin-secondary-btn mt-4"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        <span>Add Equipment</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedAndFiltered.map((item) => (
                                            <tr key={item.id}>
                                                <td>
                                                    <div className="font-bold text-[#0E2420] text-sm">{item.name}</div>
                                                    <div className="text-xs text-[#556C63]">Purchased: {new Date(item.purchase_date).toLocaleDateString()}</div>
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-[#047C61]" />
                                                        <span className="text-[#3C544C] font-medium">{CATEGORIES.find(c => c.value === item.category)?.label || item.category}</span>
                                                    </div>
                                                </td>
                                                <td className="text-center font-bold text-[#0E2420] tabular-nums">
                                                    {item.quantity}
                                                </td>
                                                <td>
                                                    <div className="font-mono font-bold text-[#0E2420] tabular-nums">₹{paiseToRupeesString(item.purchase_cost_paise)}</div>
                                                    <div className="text-[11px] text-[#556C63] tabular-nums">Total: ₹{paiseToRupeesString(item.purchase_cost_paise * item.quantity)}</div>
                                                </td>
                                                <td>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                        item.status === 'FUNCTIONAL' 
                                                        ? 'bg-[#DFF4ED] text-[#065F46]' 
                                                        : item.status === 'MAINTENANCE'
                                                        ? 'bg-[#FEF3DC] text-[#B45309]'
                                                        : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="text-right">
                                                    <button 
                                                        type="button"
                                                        aria-label={`Delete ${item.name}`}
                                                        onClick={() => handleDeleteEquipment(item.id)}
                                                        className="p-2 text-[#556C63] hover:text-[#B9382C] hover:bg-[#FDF1EF] rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Continuation Insight Banner & Asset Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                <div className="lg:col-span-5 jvk-admin-card-teal p-6 flex flex-col justify-between relative overflow-hidden">
                    <Monitor className="absolute -right-4 -bottom-4 w-28 h-28 opacity-15 rotate-12 pointer-events-none" aria-hidden="true" />
                    <div className="relative z-10 space-y-2">
                        <h4 className="jvk-admin-serif text-xl font-bold text-white">Inventory Insight</h4>
                        <p className="text-sm text-white/90 leading-relaxed">
                            You have {stats.totalItems} distinct hardware assets registered in the hospital registry.
                        </p>
                    </div>
                    <div className="relative z-10 pt-5">
                        <button
                            type="button"
                            onClick={handleGenerateAssetReport}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#047C61] shadow-sm hover:bg-[#F2FAF6] transition-colors cursor-pointer"
                        >
                            <FileText className="w-4 h-4" />
                            <span>Generate Asset Report</span>
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="jvk-admin-card p-5 flex items-center gap-3.5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] text-[#047C61]">
                            <Layers className="w-5 h-5" />
                        </span>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2420] tabular-nums">{distinctCategoryCount}</p>
                            <p className="text-xs font-medium text-[#556C63]">Total Categories</p>
                        </div>
                    </div>

                    <div className="jvk-admin-card p-5 flex items-center gap-3.5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E4F4EA] border border-[#C1E4CC] text-[#059669]">
                            <Activity className="w-5 h-5" />
                        </span>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2420] tabular-nums">{totalFunctionalRecords}</p>
                            <p className="text-xs font-medium text-[#556C63]">Functional Assets</p>
                        </div>
                    </div>

                    <div className="jvk-admin-card p-5 flex items-center gap-3.5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FDF1EF] border border-[#F2D2CF] text-[#B9382C]">
                            <AlertTriangle className="w-5 h-5" />
                        </span>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2420] tabular-nums">{totalNonFunctionalRecords}</p>
                            <p className="text-xs font-medium text-[#556C63]">Non-functional</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
