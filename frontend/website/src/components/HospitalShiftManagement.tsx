import { useState } from 'react'
import { Building2, ArrowRight, Clock, Users, ChevronRight } from 'lucide-react'
import { useStaffData } from '@/lib/staffApi'
import { ShiftManagement } from './ShiftManagement'
import { Button } from '@/components/ui/basic'

export function HospitalShiftManagement() {
    const { data, error } = useStaffData<{ clinics: { id: string; name: string }[] }>('/clinical/command/clinics')
    const clinics = data?.clinics ?? []
    const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null)

    if (error) return <p role="alert">{error}</p>
    if (!data) return <p role="status">Loading clinic roster…</p>

    if (selectedClinicId) {
        return (
            <div className="space-y-4">
                <Button
                    variant="ghost"
                    onClick={() => setSelectedClinicId(null)}
                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-2"
                >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Back to Clinic Selection
                </Button>
                <ShiftManagement clinicId={selectedClinicId} />
            </div>
        )
    }

    return (
        <div className="jvk-admin-page mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
            {/* HEADER */}
            <header className="jvk-admin-card-hero flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 overflow-hidden">
                <div className="space-y-1.5 max-w-2xl">
                    <h2 className="jvk-admin-serif text-2xl sm:text-3xl font-bold text-[#0E2420] tracking-tight flex items-center gap-3">
                        <span className="w-1.5 h-8 bg-[#047C61] rounded-full shrink-0" aria-hidden="true" />
                        <span>Hospital Shift Management</span>
                    </h2>
                    <p className="text-sm text-[#556C63] pl-4">
                        Manage clinic staff shifts, coverage, and attendance across hospital clinics.
                    </p>
                </div>
                <div className="hidden md:flex shrink-0 items-center justify-end">
                    <img
                        src="/assets/admin/roster-hero.svg"
                        alt=""
                        aria-hidden="true"
                        width={240}
                        height={146}
                        className="jvk-admin-artwork w-56 h-auto"
                    />
                </div>
            </header>

            {/* CLINIC SELECTION GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* GLOBAL VIEW CARD */}
                <button
                    type="button"
                    onClick={() => setSelectedClinicId('all')}
                    className="group jvk-admin-card-teal jvk-admin-card-interactive p-6 text-left relative overflow-hidden cursor-pointer flex flex-col justify-between"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none" aria-hidden="true">
                        <Users className="w-24 h-24" />
                    </div>

                    <div className="relative z-10 w-full">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white mb-4 group-hover:bg-white group-hover:text-[#047C61] transition-colors">
                            <Users className="w-6 h-6" />
                        </div>

                        <h3 className="jvk-admin-serif text-xl font-bold text-white mb-1">View All Staff Shifts</h3>
                        <p className="text-xs text-white/85 mb-6">Aggregate view of all clinics and staff across the hospital</p>

                        <div className="flex items-center justify-between pt-4 border-t border-white/15">
                            <div className="flex items-center gap-1.5 text-xs text-white/90 font-medium">
                                <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{clinics.length} Clinics managed</span>
                            </div>
                            <span className="bg-white/95 text-[#047C61] px-3 py-1.5 rounded-lg inline-flex items-center gap-1 text-xs font-bold shadow-xs">
                                View Global <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </span>
                        </div>
                    </div>
                </button>

                {clinics.map((clinic) => (
                    <button
                        key={clinic.id}
                        type="button"
                        onClick={() => setSelectedClinicId(clinic.id)}
                        className="group jvk-admin-card-elevated jvk-admin-card-interactive p-6 text-left relative overflow-hidden cursor-pointer flex flex-col justify-between"
                    >
                        <div className="relative z-10 w-full">
                            <div className="w-12 h-12 rounded-xl bg-[#DFF4ED] border border-[#C3E5D6] flex items-center justify-center text-[#047C61] mb-4 group-hover:bg-[#047C61] group-hover:text-white transition-colors">
                                <Building2 className="w-6 h-6" aria-hidden="true" />
                            </div>

                            <h3 className="jvk-admin-serif text-xl font-bold text-[#0E2420] mb-1">{clinic.name}</h3>
                            <p className="text-xs text-[#556C63] mb-6 line-clamp-1">Manage this clinic’s roster and shift windows.</p>

                            <div className="flex items-center justify-between pt-4 border-t border-[#E6EDE7]">
                                <div className="flex items-center gap-1.5 text-xs text-[#556C63] font-medium">
                                    <Clock className="w-3.5 h-3.5 text-[#047C61]" aria-hidden="true" />
                                    <span>Manage Shifts</span>
                                </div>
                                <span className="jvk-admin-primary-btn !min-h-8 !px-3.5 text-xs">
                                    Open <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                                </span>
                            </div>
                        </div>
                    </button>
                ))}

                {clinics.length === 0 && (
                    <div className="jvk-admin-card col-span-full py-16 text-center px-6">
                        <Building2 className="w-12 h-12 text-[#88A399] mx-auto mb-3" aria-hidden="true" />
                        <h3 className="jvk-admin-serif text-lg font-bold text-[#0E2420]">No Clinics Found</h3>
                        <p className="text-sm text-[#556C63] mt-1">You need to add clinics before managing shifts.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
