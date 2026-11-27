import { SymbolIcon } from "@/components/ui/SymbolIcon";
import { useState, useEffect } from 'react'
import { Loader2, Plus, Pencil, Trash2, Clock, Users, AlertTriangle } from 'lucide-react'
import { staffApi } from '@/lib/staffApi'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button, Input, Label, Skeleton } from '@/components/ui/basic'
import { useToast } from '@/components/ui/use-toast'
import '@/design-system/clinic-ops.css'

interface Shift {
    id: string
    clinic_id: string
    name: string
    start_time: string
    end_time: string
    grace_minutes: number
    late_cutoff_minutes: number
    created_at: string
    staff_count?: number
}

interface StaffMember {
    id: string
    full_name: string
    role: string
    shift_id: string | null
    department?: string
    clinic_id: string
    clinic_name: string
}

interface ShiftManagementProps {
    clinicId: string
}

export function ShiftManagement({ clinicId }: ShiftManagementProps) {
    const roster = `/clinical/command/roster/${encodeURIComponent(clinicId)}`
    const canManage = clinicId !== 'all'
    const { toast } = useToast()

    const [shifts, setShifts] = useState<Shift[]>([])
    const [staffList, setStaffList] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(true)

    // Form state
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editingShift, setEditingShift] = useState<Shift | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        start_time: '09:00',
        end_time: '17:00',
        grace_minutes: 5,
        late_cutoff_minutes: 30
    })

    // Assignment state
    const [isAssignOpen, setIsAssignOpen] = useState(false)
    const [assigningShift, setAssigningShift] = useState<Shift | null>(null)

    useEffect(() => {
        const request = new AbortController()
        void fetchData(request.signal)
        return () => request.abort()
    }, [roster])

    const fetchData = async (signal?: AbortSignal) => {
        setLoading(true)
        try {
            const data = await staffApi<{ shifts: Shift[]; staff: StaffMember[] }>(roster, { signal })
            if (signal?.aborted) return
            const counts = new Map<string, number>()
            for (const item of data.staff) {
                if (item.shift_id) counts.set(item.shift_id, (counts.get(item.shift_id) ?? 0) + 1)
            }
            setShifts(data.shifts.map(shift => ({ ...shift, staff_count: counts.get(shift.id) ?? 0 })))
            setStaffList(data.staff)
        } catch (error: unknown) {
            if (signal?.aborted) return
            setShifts([])
            setStaffList([])
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to load shift data.', variant: 'destructive' })
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canManage) return
        setIsSubmitting(true)

        try {
            await staffApi(`${roster}/shifts`, { method: 'POST', body: JSON.stringify(formData) })

            toast({ title: 'Shift Created', description: `"${formData.name}" has been added.` })
            setIsCreateOpen(false)
            resetForm()
            fetchData()
        } catch (error: unknown) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : "The request failed.", variant: 'destructive' })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingShift || !canManage) return
        setIsSubmitting(true)

        try {
            await staffApi(`${roster}/shifts/${editingShift.id}`, { method: 'PUT', body: JSON.stringify(formData) })

            toast({ title: 'Shift Updated', description: `"${formData.name}" has been updated.` })
            setIsEditOpen(false)
            setEditingShift(null)
            resetForm()
            fetchData()
        } catch (error: unknown) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : "The request failed.", variant: 'destructive' })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (shift: Shift) => {
        if (!canManage || !confirm(`Delete "${shift.name}"? Staff assigned to this shift will be unassigned.`)) return

        try {
            await staffApi(`${roster}/shifts/${shift.id}`, { method: 'DELETE' })
            toast({ title: 'Shift Deleted', description: `"${shift.name}" has been removed.` })
            fetchData()
        } catch (error: unknown) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : "The request failed.", variant: 'destructive' })
        }
    }

    const handleAssignStaff = async (staffId: string, shiftId: string | null) => {
        if (!canManage) return
        try {
            await staffApi(`${roster}/staff/${encodeURIComponent(staffId)}/shift`, { method: 'PUT', body: JSON.stringify({ shiftId }) })
            toast({ title: 'Updated', description: 'Staff shift assignment updated.' })
            fetchData()
        } catch (error: unknown) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : "The request failed.", variant: 'destructive' })
        }
    }

    const openEdit = (shift: Shift) => {
        setEditingShift(shift)
        setFormData({
            name: shift.name,
            start_time: shift.start_time.slice(0, 5),
            end_time: shift.end_time.slice(0, 5),
            grace_minutes: shift.grace_minutes,
            late_cutoff_minutes: shift.late_cutoff_minutes
        })
        setIsEditOpen(true)
    }

    const openAssign = (shift: Shift) => {
        setAssigningShift(shift)
        setIsAssignOpen(true)
    }

    const resetForm = () => {
        setFormData({ name: '', start_time: '09:00', end_time: '17:00', grace_minutes: 5, late_cutoff_minutes: 30 })
    }

    const formatTime = (time: string) => {
        if (!time) return '--:--'
        const [h, m] = time.split(':')
        const hour = parseInt(h)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const h12 = hour % 12 || 12
        return `${h12}:${m} ${ampm}`
    }

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <div className="space-y-1.5">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-72" />
                    </div>
                    <Skeleton className="h-10 w-36 rounded-xl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-6 w-16 rounded-full" />
                            </div>
                            <Skeleton className="h-4 w-40" />
                            <div className="pt-2 border-t border-slate-100 flex gap-2">
                                <Skeleton className="h-8 w-20 rounded-lg" />
                                <Skeleton className="h-8 w-20 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    const unassignedStaff = staffList.filter(s => !s.shift_id)

    const renderShiftForm = (onSubmit: (e: React.FormEvent) => void, title: string) => (
        <form onSubmit={onSubmit} className="space-y-5 pt-2">
            <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Shift Name</Label>
                <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g. Morning Shift"
                    className="h-11"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Start Time</Label>
                    <Input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        required
                        className="h-11"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">End Time</Label>
                    <Input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        required
                        className="h-11"
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Early Grace (min)</Label>
                    <Input
                        type="number"
                        min={0}
                        max={60}
                        value={formData.grace_minutes}
                        onChange={(e) => setFormData({ ...formData, grace_minutes: parseInt(e.target.value) || 0 })}
                        className="h-11"
                    />
                    <p className="text-[10px] text-slate-400">How early staff can punch in before shift start</p>
                </div>
                <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Late Cutoff (min)</Label>
                    <Input
                        type="number"
                        min={1}
                        max={120}
                        value={formData.late_cutoff_minutes}
                        onChange={(e) => setFormData({ ...formData, late_cutoff_minutes: parseInt(e.target.value) || 30 })}
                        className="h-11"
                    />
                    <p className="text-[10px] text-slate-400">After this, punch-in is blocked (auto-absent)</p>
                </div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-[#F7FAF6] rounded-xl border border-[#DCE7DF] space-y-2">
                <p className="text-[10px] font-bold text-[#52685F] uppercase tracking-wider">Shift Preview</p>
                <div className="flex items-center gap-3 text-sm text-[#103B32]">
                    <Clock className="w-4 h-4 text-[#087466]" />
                    <span className="font-bold">{formData.start_time ? formatTime(formData.start_time) : '--'}</span>
                    <span className="text-slate-300">→</span>
                    <span className="font-bold">{formData.end_time ? formatTime(formData.end_time) : '--'}</span>
                </div>
                <p className="text-xs text-slate-500">
                    Punch-in window: <span className="font-bold text-emerald-600">{formData.grace_minutes}min early</span> to
                    <span className="font-bold text-orange-600"> {formData.late_cutoff_minutes}min late</span> (then blocked)
                </p>
            </div>

            <button type="submit" disabled={isSubmitting} className="jvk-admin-primary-btn w-full h-11">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{title}</span>
            </button>
        </form>
    )

    return (
        <section className="jvk-admin-page jvk-clinic-ops-page mx-auto max-w-5xl space-y-5">
            {/* HEADER */}
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div data-jvk-entrance="left" className="flex items-center gap-3.5 min-w-0">
                    <span aria-hidden="true" className="jvk-clinic-ops-icon-badge">
                        <SymbolIcon className="material-symbols-outlined text-[22px]">schedule</SymbolIcon>
                    </span>
                    <div className="min-w-0">
                        <h1 className="jvk-clinic-ops-serif text-[26px] sm:text-[30px] font-bold leading-tight text-[#103B32]">
                            Shift Operations
                        </h1>
                        <p className="text-sm text-[#52685F] mt-0.5">
                            Manage staff schedules and attendance windows
                        </p>
                    </div>
                </div>

                {canManage && <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <button
                            type="button"
                            onClick={() => { resetForm(); setIsCreateOpen(true) }}
                            className="jvk-admin-primary-btn shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Shift</span>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[450px] bg-[#FFFDF8] border-[#DCE7DF]">
                        <DialogHeader>
                            <DialogTitle className="jvk-admin-serif text-xl font-bold text-[#0E2420]">Create Shift Template</DialogTitle>
                        </DialogHeader>
                        {renderShiftForm(handleCreate, "Create Shift")}
                    </DialogContent>
                </Dialog>}
            </header>

            {/* SHIFT CARDS */}
            {shifts.length === 0 ? (
                <div className="jvk-clinic-ops-card jvk-clinic-ops-enter flex flex-col items-center justify-center text-center py-10 sm:py-12 px-6">
                    <img
                        src="/assets/clinic/roster-empty-calendar.svg"
                        alt=""
                        aria-hidden="true"
                        width={360}
                        height={240}
                        className="jvk-clinic-ops-artwork w-56 sm:w-64 h-auto mb-2"
                    />
                    <h2 className="jvk-clinic-ops-serif text-[21px] sm:text-[23px] font-bold text-[#103B32]">
                        No Shifts Created
                    </h2>
                    <p className="text-sm text-[#52685F] mt-1.5 max-w-md leading-relaxed">
                        Create your first shift template to start managing staff schedules and enforcing attendance windows.
                    </p>
                    <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => { resetForm(); setIsCreateOpen(true) }}
                        className="jvk-admin-primary-btn mt-5"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Create First Shift</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shifts.map(shift => (
                        <div
                            key={shift.id}
                            className="jvk-admin-card jvk-admin-card-interactive p-5 group"
                        >
                            {/* Card Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] flex items-center justify-center text-[#047C61] group-hover:bg-[#047C61] group-hover:text-white transition-colors">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="jvk-admin-serif font-bold text-[#0E2420]">{shift.name}</h4>
                                        <p className="text-xs text-[#556C63]">
                                            {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        type="button"
                                        disabled={!canManage}
                                        onClick={() => openEdit(shift)}
                                        className="p-2 hover:bg-[#EAF6F1] rounded-lg transition-colors text-[#556C63] hover:text-[#047C61]"
                                        title="Edit shift"
                                        aria-label={`Edit ${shift.name}`}
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!canManage}
                                        onClick={() => handleDelete(shift)}
                                        className="p-2 hover:bg-[#FDF1EF] rounded-lg transition-colors text-[#B9382C]"
                                        title="Delete shift"
                                        aria-label={`Delete ${shift.name}`}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Time Window */}
                            <div className="flex items-center gap-2 p-3 bg-[#F4F9F5] border border-[#E4EDE7] rounded-xl mb-3">
                                <div className="flex-1 text-center">
                                    <p className="text-[11px] font-semibold text-[#556C63] uppercase">Grace</p>
                                    <p className="text-sm font-bold text-[#047C61] tabular-nums">{shift.grace_minutes}m early</p>
                                </div>
                                <div className="w-px h-8 bg-[#DAE6DF]" />
                                <div className="flex-1 text-center">
                                    <p className="text-[11px] font-semibold text-[#556C63] uppercase">Late Cutoff</p>
                                    <p className="text-sm font-bold text-[#B45309] tabular-nums">{shift.late_cutoff_minutes}m</p>
                                </div>
                            </div>

                            {/* Assigned Staff Count */}
                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-2 text-xs text-[#556C63]">
                                    <Users className="w-3.5 h-3.5 text-[#047C61]" />
                                    <span className="font-bold text-[#0E2420] tabular-nums">{shift.staff_count || 0}</span> staff assigned
                                </div>
                                <button
                                    type="button"
                                    disabled={!canManage}
                                    onClick={() => openAssign(shift)}
                                    className="text-xs font-bold text-[#047C61] hover:text-[#035E4A] transition-colors"
                                >
                                    Manage →
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* UNASSIGNED STAFF WARNING */}
            {unassignedStaff.length > 0 && shifts.length > 0 && (
                <div className="jvk-admin-card-amber flex items-start gap-3 p-4">
                    <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-[#78350F]">
                            {unassignedStaff.length} staff member{unassignedStaff.length > 1 ? 's' : ''} without a shift
                        </p>
                        <p className="text-xs text-[#92400E] mt-0.5">
                            {unassignedStaff.map(s => s.full_name).join(', ')} — punch-in will work without time restrictions
                        </p>
                    </div>
                </div>
            )}

            {/* STAFF ASSIGNMENT TABLE */}
            {shifts.length > 0 && (
                <div className="jvk-admin-card overflow-hidden">
                    <div className="p-5 border-b border-[#E5ECE6] bg-[#F6FAF7]">
                        <h3 id="shift-assignments-heading" className="jvk-admin-serif text-lg font-bold text-[#0E2420] flex items-center gap-2">
                            <Users className="w-4 h-4 text-[#047C61]" />
                            Staff Assignments
                        </h3>
                        <p className="text-xs text-[#556C63] mt-1">Assign each staff member to a shift for attendance enforcement</p>
                    </div>
                    <div className="jvk-admin-table-region border-0 rounded-none" tabIndex={0} role="region" aria-labelledby="shift-assignments-heading">
                        <table className="jvk-admin-table">
                            <thead>
                                <tr>
                                    <th>Staff</th>
                                    <th>Role</th>
                                    <th>Department</th>
                                    {clinicId === 'all' && <th>Clinic</th>}
                                    <th>Assigned Shift</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffList.map(staff => (
                                    <tr key={staff.id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#DFF4ED] text-[#065F46] flex items-center justify-center font-bold text-xs">
                                                    {staff.full_name[0]}
                                                </div>
                                                <span className="font-bold text-[#0E2420]">{staff.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="text-[#3C544C] font-medium text-xs">{staff.role?.replace('_', ' ')}</td>
                                        <td className="text-[#556C63] text-xs">{staff.department || '—'}</td>
                                        {clinicId === 'all' && (
                                            <td className="text-[#556C63] text-xs font-medium">
                                                {staff.clinic_name || 'N/A'}
                                            </td>
                                        )}
                                        <td>
                                            <select
                                                value={staff.shift_id || ''}
                                                onChange={(e) => handleAssignStaff(staff.id, e.target.value || null)}
                                                className="h-9 px-3 rounded-lg text-sm font-medium min-w-[180px]"
                                            >
                                                <option value="">No shift assigned</option>
                                                {shifts.map(shift => (
                                                    <option key={shift.id} value={shift.id}>
                                                        {shift.name} ({formatTime(shift.start_time)} - {formatTime(shift.end_time)})
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* EDIT SHIFT DIALOG */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[450px] bg-[#FFFDF8] border-[#DCE7DF]">
                    <DialogHeader>
                        <DialogTitle className="jvk-admin-serif text-xl font-bold text-[#0E2420]">Edit Shift</DialogTitle>
                    </DialogHeader>
                    {renderShiftForm(handleEdit, "Save Changes")}
                </DialogContent>
            </Dialog>

            {/* ASSIGN STAFF DIALOG */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent className="sm:max-w-[450px] bg-[#FFFDF8] border-[#DCE7DF]">
                    <DialogHeader>
                        <DialogTitle className="jvk-admin-serif text-xl font-bold text-[#0E2420]">
                            Assign Staff to "{assigningShift?.name}"
                        </DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[400px] overflow-y-auto space-y-2 py-2">
                        {staffList.map(staff => {
                            const isAssigned = staff.shift_id === assigningShift?.id
                            return (
                                <button
                                    key={staff.id}
                                    type="button"
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer ${isAssigned
                                        ? 'bg-[#DFF4ED] border-[#047C61]'
                                        : 'bg-white border-[#E4EDE7] hover:border-[#8BC4AE]'
                                        }`}
                                    onClick={() => handleAssignStaff(staff.id, isAssigned ? null : assigningShift?.id || null)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isAssigned ? 'bg-[#047C61] text-white' : 'bg-[#EEF5F0] text-[#3C544C]'
                                            }`}>
                                            {staff.full_name[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-[#0E2420]">{staff.full_name}</p>
                                            <p className="text-[11px] text-[#556C63]">{staff.role?.replace('_', ' ')}</p>
                                        </div>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isAssigned ? 'border-[#047C61] bg-[#047C61]' : 'border-[#BFD4C8]'
                                        }`}>
                                        {isAssigned && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    )
}
