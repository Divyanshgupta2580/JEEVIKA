import { useState, useEffect, useMemo } from 'react';
import { staffApi, useStaffData } from '@/lib/staffApi';
import { paiseToRupeesString, rupeesToPaise } from '@/lib/utils';
import { 
    Loader2, 
    TrendingDown, 
    Plus, 
    Search, 
    Filter, 
    Calendar,
    Receipt,
    Trash2,
    AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/basic';
import { Button } from '@/components/ui/basic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

type ExpenseType = 'ONE_TIME' | 'RECURRING';

interface Expense {
    id: string;
    clinic_id: string | null;
    category: string;
    amount_paise: number;
    description: string;
    expense_type: ExpenseType;
    expense_date: string;
    tax_bps: number;
    tax_paise: number;
    created_at: string;
}

export function ExpensesDashboard() {
    const { data: directory } = useStaffData<{ clinics: { id: string; name: string }[] }>('/clinical/command/clinics');
    const clinics = directory?.clinics ?? [];
    const { toast } = useToast();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'ONE_TIME' | 'RECURRING'>('ALL');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchExpenses();
    }, []);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const { items } = await staffApi<{ items: Expense[] }>('/clinical/command/expenses');
            setExpenses(items);
        } catch (error: any) {
            console.error('Error fetching expenses:', error);
            toast({ title: 'Error', description: 'Failed to load expenses', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        
        const payload = {
            clinic_id: formData.get('clinic_id') || null,
            category: formData.get('category'),
            amount_paise: rupeesToPaise(String(formData.get('amount'))),
            tax_bps: rupeesToPaise(String(formData.get('tax_percentage') || '0')),
            description: formData.get('description') || '',
            expense_type: formData.get('expense_type'),
            expense_date: formData.get('expense_date'),
        };

        try {
            await staffApi('/clinical/command/expenses', { method: 'POST', body: JSON.stringify(payload) });
            
            toast({ title: 'Success', description: 'Expense recorded successfully' });
            setIsAddModalOpen(false);
            fetchExpenses();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to add expense', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!confirm('Are you sure you want to delete this expense record?')) return;

        try {
            await staffApi(`/clinical/command/expenses/${id}`, { method: 'DELETE' });
            toast({ title: 'Success', description: 'Expense record deleted' });
            setExpenses(expenses.filter(e => e.id !== id));
        } catch (error: any) {
            toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' });
        }
    };

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            const matchesSearch = e.category.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 (e.description || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = filterType === 'ALL' || e.expense_type === filterType;
            return matchesSearch && matchesType;
        });
    }, [expenses, searchQuery, filterType]);

    const totalStats = useMemo(() => {
        return filteredExpenses.reduce((acc, curr) => {
            if (curr.expense_type === 'ONE_TIME') acc.oneTime += curr.amount_paise;
            else acc.recurring += curr.amount_paise;
            acc.total += curr.amount_paise;
            return acc;
        }, { oneTime: 0, recurring: 0, total: 0 });
    }, [filteredExpenses]);

    const categoryCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const exp of expenses) {
            counts.set(exp.category, (counts.get(exp.category) ?? 0) + 1);
        }
        return Array.from(counts.entries());
    }, [expenses]);

    const visibleExpenses = useMemo(() => {
        if (selectedCategory === 'ALL') return filteredExpenses;
        return filteredExpenses.filter((e) => e.category === selectedCategory);
    }, [filteredExpenses, selectedCategory]);

    return (
        <div className="jvk-admin-page mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
            {/* Header */}
            <header className="jvk-admin-card-hero flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 overflow-hidden">
                <div className="space-y-1.5 z-10">
                    <h1 className="jvk-admin-serif text-3xl font-bold text-[#0E2420] tracking-tight">Other Expenses</h1>
                    <p className="text-sm text-[#556C63]">Track utility bills, maintenance, and miscellaneous costs.</p>
                </div>

                <div className="hidden md:flex shrink-0 items-center justify-center">
                    <img
                        src="/assets/admin/expenses-hero.png"
                        alt=""
                        aria-hidden="true"
                        width={185}
                        height={118}
                        className="jvk-admin-artwork w-44 h-auto"
                    />
                </div>

                <div className="flex items-center gap-3 z-10 shrink-0">
                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <button type="button" className="jvk-admin-primary-btn">
                                <Plus className="w-4 h-4" />
                                <span>Record Expense</span>
                            </button>
                        </DialogTrigger>
                        <DialogContent className="jvk-motion-dialog sm:max-w-[500px] bg-[#FFFDF8] border-[#DCE7DF]">
                            <DialogHeader>
                                <DialogTitle className="jvk-admin-serif text-xl font-bold text-[#0E2420]">Record Other Expense</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAddExpense} className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[#2A423A]">Category</label>
                                        <input 
                                            name="category" 
                                            required 
                                            placeholder="e.g. Electricity"
                                            className="w-full px-3 py-2 bg-white border border-[#CEDAD3] rounded-lg focus:ring-2 focus:ring-[#047C61]/20 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[#2A423A]">Amount (₹)</label>
                                        <input 
                                            name="amount" 
                                            type="number" 
                                            step="0.01"
                                            required 
                                            placeholder="0.00"
                                            className="w-full px-3 py-2 bg-white border border-[#CEDAD3] rounded-lg focus:ring-2 focus:ring-[#047C61]/20 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[#2A423A]">Tax % (Optional)</label>
                                        <input 
                                            name="tax_percentage" 
                                            type="number" 
                                            step="0.01"
                                            placeholder="e.g. 18"
                                            className="w-full px-3 py-2 bg-white border border-[#CEDAD3] rounded-lg focus:ring-2 focus:ring-[#047C61]/20 outline-none"
                                        />
                                    </div>

                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[#2A423A]">Type</label>
                                        <select name="expense_type" className="w-full px-3 py-2 bg-white border border-[#CEDAD3] rounded-lg focus:ring-2 focus:ring-[#047C61]/20 outline-none">
                                            <option value="RECURRING">Recurring (Monthly/Bills)</option>
                                            <option value="ONE_TIME">One-Time (Purchase)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[#2A423A]">Date</label>
                                        <input 
                                            name="expense_date" 
                                            type="date" 
                                            required 
                                            defaultValue={new Date().toISOString().split('T')[0]}
                                            className="w-full px-3 py-2 bg-white border border-[#CEDAD3] rounded-lg focus:ring-2 focus:ring-[#047C61]/20 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[#2A423A]">Description (Optional)</label>
                                    <textarea 
                                        name="description" 
                                        rows={2}
                                        placeholder="Note details about this expense..."
                                        className="w-full px-3 py-2 bg-white border border-[#CEDAD3] rounded-lg focus:ring-2 focus:ring-[#047C61]/20 outline-none"
                                    />
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
                                        {isSubmitting ? 'Recording...' : 'Record Expense'}
                                    </button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="jvk-admin-card p-5 flex items-start gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] text-[#047C61]">
                        <TrendingDown className="w-5 h-5" />
                    </span>
                    <div>
                        <p className="text-xs font-semibold text-[#556C63] uppercase tracking-wider">Total Expenses</p>
                        <div className="mt-1 text-2xl sm:text-3xl font-bold text-[#0E2420] tabular-nums">
                            ₹{paiseToRupeesString(totalStats.total)}
                        </div>
                        <p className="text-xs text-[#6A8178] mt-1 font-medium">Aggregate of all categories</p>
                    </div>
                </div>

                <div className="jvk-admin-card p-5 flex items-start gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EBF4FA] border border-[#CBE2F0] text-[#1D6FA5]">
                        <Calendar className="w-5 h-5" />
                    </span>
                    <div>
                        <p className="text-xs font-semibold text-[#556C63] uppercase tracking-wider">Recurring Bills</p>
                        <div className="mt-1 text-2xl sm:text-3xl font-bold text-[#0E2420] tabular-nums">
                            ₹{paiseToRupeesString(totalStats.recurring)}
                        </div>
                        <p className="text-xs text-[#1D6FA5] mt-1 font-medium">Maintenance & Utilities</p>
                    </div>
                </div>

                <div className="jvk-admin-card p-5 flex items-start gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F3EFFC] border border-[#DECFF7] text-[#6D28D9]">
                        <Receipt className="w-5 h-5" />
                    </span>
                    <div>
                        <p className="text-xs font-semibold text-[#556C63] uppercase tracking-wider">One-Time Costs</p>
                        <div className="mt-1 text-2xl sm:text-3xl font-bold text-[#0E2420] tabular-nums">
                            ₹{paiseToRupeesString(totalStats.oneTime)}
                        </div>
                        <p className="text-xs text-[#6D28D9] mt-1 font-medium">Asset purchases & repairs</p>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="space-y-3">
                <div className="flex flex-col md:flex-row items-center gap-3 jvk-admin-card p-3.5">
                    <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 text-[#6B847B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search expenses by category or description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-[#CEDAD3] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#047C61]/20"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <Filter className="w-4 h-4 text-[#6B847B] hidden sm:block" />
                        <div className="jvk-admin-tablist jvk-admin-tablist-light">
                            {(['ALL', 'RECURRING', 'ONE_TIME'] as const).map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    aria-pressed={filterType === type}
                                    data-active={filterType === type ? "true" : "false"}
                                    onClick={() => setFilterType(type)}
                                    className={`jvk-admin-tab !py-1.5 !px-3 text-xs ${
                                        filterType === type ? '!bg-[#047C61] !text-white' : ''
                                    }`}
                                >
                                    {type.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        aria-pressed={selectedCategory === 'ALL'}
                        onClick={() => setSelectedCategory('ALL')}
                        className="jvk-admin-pill-filter"
                    >
                        Categories ({categoryCounts.length})
                    </button>
                    {categoryCounts.map(([category, count]) => (
                        <button
                            key={category}
                            type="button"
                            aria-pressed={selectedCategory === category}
                            onClick={() => setSelectedCategory(category)}
                            className="jvk-admin-pill-filter"
                        >
                            {category} ({count})
                        </button>
                    ))}
                </div>
            </div>

            {/* Ledger Table */}
            <div className="jvk-admin-card overflow-hidden">
                <div className="jvk-admin-table-region border-0 rounded-none" tabIndex={0} role="region" aria-label="Expenses ledger">
                    <table className="jvk-admin-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Clinic</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-[#556C63]">
                                        <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-[#047C61]" />
                                        Loading expenses...
                                    </td>
                                </tr>
                            ) : visibleExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <img
                                                src="/assets/admin/expenses-hero.png"
                                                alt=""
                                                aria-hidden="true"
                                                width={132}
                                                height={86}
                                                className="jvk-admin-artwork w-32 h-auto opacity-85 mb-3"
                                            />
                                            <h3 className="jvk-admin-serif text-base font-bold text-[#0E2420]">No expenses recorded yet</h3>
                                            <p className="text-xs sm:text-sm text-[#556C63] mt-1">
                                                Start tracking utility bills, maintenance, and other costs.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setIsAddModalOpen(true)}
                                                className="jvk-admin-primary-btn mt-4"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span>Record Your First Expense</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                visibleExpenses.map((expense) => (
                                    <tr key={expense.id}>
                                        <td className="whitespace-nowrap text-[#3C544C]">
                                            {new Date(expense.expense_date).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <div className="font-bold text-[#0E2420]">{expense.category}</div>
                                            <div className="text-xs text-[#556C63] truncate max-w-[220px]">{expense.description}</div>
                                        </td>
                                        <td className="text-[#3C544C]">
                                            {clinics.find(c => c.id === expense.clinic_id)?.name || 'Global'}
                                        </td>
                                        <td>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                                                expense.expense_type === 'RECURRING' 
                                                ? 'bg-[#EBF4FA] text-[#1D6FA5]' 
                                                : 'bg-[#F3EFFC] text-[#6D28D9]'
                                            }`}>
                                                {expense.expense_type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="font-mono font-bold text-[#0E2420] tabular-nums">
                                            ₹{paiseToRupeesString(expense.amount_paise)}
                                            {expense.tax_paise > 0 && (
                                                <div className="text-xs font-sans font-normal text-[#556C63] mt-0.5">
                                                    incl. ₹{paiseToRupeesString(expense.tax_paise)} ({paiseToRupeesString(expense.tax_bps)}%) tax
                                                </div>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            <button 
                                                type="button"
                                                aria-label={`Delete ${expense.category} expense`}
                                                onClick={() => handleDeleteExpense(expense.id)}
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
    );
}
