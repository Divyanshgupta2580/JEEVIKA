import React, { useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/basic'
import { Button, Input, Label } from '@/components/ui/basic'
import { Building2, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { staffApi, useStaffData } from '@/lib/staffApi'
import type { HqFleet, HqOrganization } from '../../../../packages/shared/hq-command'
import { useToast } from '@/components/ui/use-toast'

export function AdminSetup({ onComplete }: { onComplete: () => void }) {
    const { toast } = useToast();
    const { data: fleet, error } = useStaffData<HqFleet>('/clinical/command/hq/fleet');
    const [created, setCreated] = useState<HqOrganization>();
    const [loading, setLoading] = useState(false);
    const [hospitalName, setHospitalName] = useState('');
    const [hospitalSlug, setHospitalSlug] = useState('');
    const [hospitalAdminEmail, setHospitalAdminEmail] = useState('');
    const branchAttempt = useRef<{ body: string; key: string }>();

    function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
        const name = event.target.value;
        setHospitalName(name);
        setHospitalSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60));
    }

    async function handleHospitalSetup(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (loading) return;
        const form = new FormData(event.currentTarget);
        setLoading(true);
        try {
            const organization = await staffApi<HqOrganization>('/clinical/command/hq/organization', {
                method: 'POST',
                body: JSON.stringify({
                    name: form.get('name'), slug: form.get('slug'),
                    brandingColor: form.get('branding_color'), adminEmail: form.get('admin_email'),
                }),
            });
            setCreated(organization);
            toast({ title: 'Organization registered' });
        } catch (failure) {
            toast({ title: 'Organization unavailable', description: failure instanceof Error ? failure.message : undefined, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }

    async function handleFirstClinic(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (loading) return;
        const form = new FormData(event.currentTarget);
        const body = JSON.stringify({ name: form.get('clinic_name'), address: form.get('location') });
        if (branchAttempt.current?.body !== body) branchAttempt.current = { body, key: crypto.randomUUID() };
        setLoading(true);
        try {
            await staffApi('/clinical/command/hq/branches', {
                method: 'POST', body, headers: { 'Idempotency-Key': branchAttempt.current.key },
            });
            toast({ title: 'Clinic registered' });
            onComplete();
        } catch (failure) {
            toast({ title: 'Clinic registration unavailable', description: failure instanceof Error ? failure.message : undefined, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }

    if (!fleet) return (
        <p className="jvk-admin-card p-5" role={error ? "alert" : "status"}>
            {error ? `Organization unavailable. ${error}` : "Loading organization…"}
        </p>
    );

    // --- RENDER HOSPITAL FORM ---
    if (!created && !fleet.organization) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="w-full max-w-lg glass-card shadow-xl border-blue-100">
                    <CardHeader className="text-center pb-8 border-b border-slate-100/50">
                        <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                            <Building2 className="w-8 h-8 text-blue-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Setup Organization</CardTitle>
                        <CardDescription className="text-lg mt-2">
                            Register your Hospital / Medical Center
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8">
                        <form onSubmit={handleHospitalSetup} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="setup-name">Hospital Entity Name</Label>
                                <Input
                                    id="setup-name" name="name"
                                    placeholder="e.g. City General Hospital"
                                    required
                                    className="h-12 text-lg"
                                    value={hospitalName}
                                    onChange={handleNameChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="setup-slug">Unique Slug (ID)</Label>
                                <Input
                                    id="setup-slug" name="slug"
                                    placeholder="e.g. city-general-ny"
                                    required
                                    className="h-12 text-lg font-mono"
                                    value={hospitalSlug}
                                    onChange={(e) => setHospitalSlug(e.target.value)}
                                />
                                <p className="text-xs text-slate-400">Unique organization reference.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="setup-admin_email">Administrative Email</Label>
                                <Input
                                    id="setup-admin_email" name="admin_email"
                                    type="email"
                                    placeholder="admin@hospital.com"
                                    required
                                    className="h-12 text-lg"
                                    value={hospitalAdminEmail}
                                    onChange={(e) => setHospitalAdminEmail(e.target.value)}
                                />
                                <p className="text-xs text-slate-400">Administrative contact for this organization.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="setup-branding_color">Branding Color</Label>
                                <div className="flex gap-2">
                                    <Input id="setup-branding_color" name="branding_color" type="color" defaultValue="#2563eb" className="w-20 h-12 p-1 cursor-pointer" />
                                    <div className="flex-1 flex items-center text-sm text-slate-500 italic px-2">
                                        Choose your primary brand color
                                    </div>
                                </div>
                            </div>
                            <Button type="submit" disabled={loading} className="w-full h-12 text-lg font-medium bg-blue-600 hover:bg-blue-700">
                                {loading ? <Loader2 className="animate-spin" /> : (
                                    <span className="flex items-center gap-2">
                                        Create Organization <ArrowRight className="w-5 h-5" />
                                    </span>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

            </div>
        )
    }

    // --- RENDER CLINIC FORM ---
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-lg glass-card shadow-xl border-blue-100 animate-in slide-in-from-right duration-500">
                <CardHeader className="text-center pb-8 border-b border-slate-100/50">
                    <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-900">{created?.name ?? fleet.organization?.name}</CardTitle>
                    <CardDescription className="text-lg mt-2">
                        Register a clinic in this organization.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-8">
                    <form onSubmit={handleFirstClinic} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="setup-clinic_name">Clinic / Branch Name</Label>
                            <Input id="setup-clinic_name" name="clinic_name" placeholder="e.g. Main Street HQ" required className="h-12 text-lg" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="setup-location">Address / Location</Label>
                            <Input id="setup-location" name="location" placeholder="e.g. 123 Health Blvd, NY" required className="h-12 text-lg" />
                        </div>

                        <Button type="submit" disabled={loading} className="w-full h-12 text-lg font-medium bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20">
                            {loading ? <Loader2 className="animate-spin" /> : (
                                <span className="flex items-center gap-2">
                                    Launch Dashboard <ArrowRight className="w-5 h-5" />
                                </span>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 p-4 bg-blue-50 rounded-xl flex gap-3 text-sm text-blue-800">
                        <Building2 className="w-5 h-5 shrink-0" />
                        <p>You can add more clinics and pharmacy counters later from the dashboard.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
