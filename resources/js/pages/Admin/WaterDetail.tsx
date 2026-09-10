import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import { ArrowLeft, Camera, CheckCircle2, Droplets } from 'lucide-react';
import { AdminButton } from '@/components/admin/AdminButton';
import { FormLabel, FormError, TextInput } from '@/components/admin/AdminForm';

interface Period {
    id: number;
    status: 'METER_DUE' | 'WAITING_PAYMENT' | 'PAID';
    payment_status: string;
    period_month: number;
    period_year: number;
    meter_start: number | null;
    meter_start_recorded_at: string | null;
    has_start_photo: boolean;
    meter_end: number | null;
    meter_end_recorded_at: string | null;
    has_end_photo: boolean;
    usage: number | null;
    billable_usage: number | null;
    water_rate: number | null;
    total_amount: number | null;
    due_date: string | null;
    paid_at: string | null;
    note: string | null;
    tenant_name: string | null;
}

interface DetailProps {
    property: { id: number; name: string; type: string; status: string; water_rate: number | null };
    tenant: { id: number; name: string; whatsapp: string | null } | null;
    periods: Period[];
    settings: { rate_per_m3: number };
}

function rupiah(n: number | null): string {
    if (n === null) return '-';
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(n);
}

function angka(n: number | null | undefined): string {
    if (n === null || n === undefined) return '-';
    return new Intl.NumberFormat('id-ID').format(n);
}

function statusInfo(status: Period['status']) {
    switch (status) {
        case 'METER_DUE':
            return { label: 'Perlu Update Meter', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
        case 'WAITING_PAYMENT':
            return { label: 'Belum Bayar', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
        case 'PAID':
            return { label: 'Lunas', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
}

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export default function WaterDetail({ property, tenant, periods, settings }: DetailProps) {
    const openPeriod = periods.find((p) => p.status !== 'PAID') ?? null;

    const startForm = useForm({ meter_start: '', photo: null as File | null, note: '' });
    const recordForm = useForm({ meter_end: '', photo: null as File | null });

    const submitStart = (e: React.FormEvent) => {
        e.preventDefault();
        startForm.post(`/admin/water/${property.id}/start`, {
            preserveScroll: true,
            onSuccess: () => {
                startForm.reset();
                toast.success('Periode air dimulai');
            },
            onError: () => toast.error('Gagal memulai periode'),
        });
    };

    const submitRecord = (e: React.FormEvent) => {
        e.preventDefault();
        if (!openPeriod) return;
        recordForm.post(`/admin/water/periods/${openPeriod.id}/record`, {
            preserveScroll: true,
            onSuccess: () => {
                recordForm.reset();
                toast.success('Meter akhir tercatat');
            },
            onError: () => toast.error('Gagal mencatat meter akhir'),
        });
    };

    const confirmPayment = () => {
        if (!openPeriod) return;
        if (!confirm('Konfirmasi pembayaran air periode ini? Periode berikutnya akan otomatis dibuka.')) return;
        router.post(`/admin/water/periods/${openPeriod.id}/confirm`, {}, {
            preserveScroll: true,
            onSuccess: () => toast.success('Pembayaran terkonfirmasi'),
            onError: () => toast.error('Gagal mengonfirmasi pembayaran'),
        });
    };

    const photoUrl = (periodId: number, kind: string) => `/admin/water/periods/${periodId}/photo/${kind}`;

    const periodeLabel = (p: Period) => `${MONTHS[p.period_month] ?? p.period_month} ${p.period_year}`;

    return (
        <AdminLayout title={`Meter Air — ${property.name}`}>
            <div className="mb-6">
                <Link href="/admin/water" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6B6B67] hover:text-[#1A1A18]">
                    <ArrowLeft className="w-4 h-4" /> Kembali ke Meter Air
                </Link>
            </div>

            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1A1A18]">{property.name}</h1>
                    <p className="text-sm md:text-base text-[#6B6B67] mt-1.5">
                        {property.type === 'KIOSK' ? 'Kios' : 'Kamar'} · {property.status.replace(/_/g, ' ')} · Tarif air: {property.water_rate ? rupiah(property.water_rate) + '/m³' : rupiah(settings.rate_per_m3) + '/m³'}
                    </p>
                </div>
                {tenant && (
                    <div className="bg-white px-5 py-3 rounded-2xl border border-[#E8E7E3] shadow-sm">
                        <p className="text-[12px] font-semibold text-[#8A8A84] uppercase tracking-wider">Penghuni Aktif</p>
                        <p className="font-bold text-[#1A1A18]">{tenant.name}</p>
                        {tenant.whatsapp && <p className="text-[12px] text-[#6B6B67]">{tenant.whatsapp}</p>}
                    </div>
                )}
            </div>

            {/* Current open period */}
            {openPeriod ? (
                <div className="bg-white rounded-2xl border border-[#E8E7E3] shadow-sm overflow-hidden mb-8">
                    <div className="px-6 py-4 border-b border-[#E8E7E3] bg-[#FAFAF8] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Droplets className="w-5 h-5 text-sky-600" />
                            <h2 className="font-bold text-[#1A1A18]">Periode Aktif — {periodeLabel(openPeriod)}</h2>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold border ${statusInfo(openPeriod.status).cls}`}>{statusInfo(openPeriod.status).label}</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#F1F0EC]">
                        <div className="bg-white px-6 py-4">
                            <p className="text-[12px] font-semibold text-[#8A8A84] uppercase tracking-wider">Meter Awal</p>
                            <p className="text-xl font-bold text-[#1A1A18] mt-1">{angka(openPeriod.meter_start)} m³</p>
                        </div>
                        <div className="bg-white px-6 py-4">
                            <p className="text-[12px] font-semibold text-[#8A8A84] uppercase tracking-wider">Meter Akhir</p>
                            <p className="text-xl font-bold text-[#1A1A18] mt-1">{angka(openPeriod.meter_end)} m³</p>
                        </div>
                        <div className="bg-white px-6 py-4">
                            <p className="text-[12px] font-semibold text-[#8A8A84] uppercase tracking-wider">Pemakaian</p>
                            <p className="text-xl font-bold text-[#1A1A18] mt-1">{openPeriod.usage !== null ? `${angka(openPeriod.usage)} m³` : '-'}</p>
                        </div>
                        <div className="bg-white px-6 py-4">
                            <p className="text-[12px] font-semibold text-[#8A8A84] uppercase tracking-wider">Tagihan</p>
                            <p className="text-xl font-bold text-[#1A1A18] mt-1">{rupiah(openPeriod.total_amount)}</p>
                        </div>
                    </div>

                    <div className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="text-sm text-[#6B6B67] space-y-0.5">
                            <p>Jatuh tempo: <b className="text-[#1A1A18]">{openPeriod.due_date ?? '-'}</b> · Penghuni periode: <b className="text-[#1A1A18]">{openPeriod.tenant_name ?? '-'}</b></p>
                            {openPeriod.note && <p>Catatan: {openPeriod.note}</p>}
                            <div className="flex gap-4 mt-2">
                                {openPeriod.has_start_photo && <a href={photoUrl(openPeriod.id, 'start')} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline text-[13px]">Foto meter awal</a>}
                                {openPeriod.has_end_photo && <a href={photoUrl(openPeriod.id, 'end')} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline text-[13px]">Foto meter akhir</a>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {openPeriod.status === 'METER_DUE' && null}
                            {openPeriod.status === 'WAITING_PAYMENT' && (
                                <AdminButton onClick={confirmPayment}>
                                    <CheckCircle2 className="w-4 h-4" /> Konfirmasi Pembayaran
                                </AdminButton>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-[#6B6B67] mb-8">Belum ada periode air aktif untuk unit ini.</p>
            )}

            {/* Inline form: update meter (when METER_DUE) or start (when none) */}
            <div className="bg-white rounded-2xl border border-[#E8E7E3] shadow-sm p-6 mb-8">
                {openPeriod?.status === 'METER_DUE' ? (
                    <>
                        <h3 className="font-bold text-[#1A1A18] mb-4 flex items-center gap-2"><Camera className="w-5 h-5 text-amber-600" /> Update Meter Akhir</h3>
                        <form onSubmit={submitRecord} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <FormLabel htmlFor="meter_end">Angka Meter (m³)</FormLabel>
                                <TextInput
                                    id="meter_end"
                                    type="number"
                                    min={0}
                                    placeholder="cth: 1390"
                                    value={recordForm.data.meter_end}
                                    onChange={(e) => recordForm.setData('meter_end', e.target.value)}
                                />
                                <FormError>{recordForm.errors.meter_end}</FormError>
                            </div>
                            <div>
                                <FormLabel htmlFor="photo-end">Foto Meter</FormLabel>
                                <TextInput
                                    id="photo-end"
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => recordForm.setData('photo', e.target.files?.[0] ?? null)}
                                />
                                <FormError>{recordForm.errors.photo}</FormError>
                            </div>
                            {recordForm.data.photo && (
                                <img src={URL.createObjectURL(recordForm.data.photo)} alt="preview" className="sm:col-span-2 rounded-[10px] border border-[#E8E7E3] max-h-44 object-contain" />
                            )}
                            <div className="sm:col-span-2">
                                <AdminButton isLoading={recordForm.processing}>Simpan Meter Akhir</AdminButton>
                            </div>
                        </form>
                    </>
                ) : (
                    <>
                        <h3 className="font-bold text-[#1A1A18] mb-1">Mulai Periode Baru</h3>
                        <p className="text-sm text-[#6B6B67] mb-4">Catat meter awal unit (photo wajib).</p>
                        <form onSubmit={submitStart} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <FormLabel htmlFor="meter_start">Angka Meter (m³)</FormLabel>
                                <TextInput
                                    id="meter_start"
                                    type="number"
                                    min={0}
                                    placeholder="cth: 1350"
                                    value={startForm.data.meter_start}
                                    onChange={(e) => startForm.setData('meter_start', e.target.value)}
                                />
                                <FormError>{startForm.errors.meter_start}</FormError>
                            </div>
                            <div>
                                <FormLabel htmlFor="photo-start">Foto Meter</FormLabel>
                                <TextInput
                                    id="photo-start"
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => startForm.setData('photo', e.target.files?.[0] ?? null)}
                                />
                                <FormError>{startForm.errors.photo}</FormError>
                            </div>
                            {startForm.data.photo && (
                                <img src={URL.createObjectURL(startForm.data.photo)} alt="preview" className="sm:col-span-2 rounded-[10px] border border-[#E8E7E3] max-h-44 object-contain" />
                            )}
                            <div>
                                <FormLabel htmlFor="note">Catatan (opsional)</FormLabel>
                                <TextInput
                                    id="note"
                                    placeholder="cth: pergantian penghuni"
                                    value={startForm.data.note}
                                    onChange={(e) => startForm.setData('note', e.target.value)}
                                />
                            </div>
                            <div className="flex items-end">
                                <AdminButton isLoading={startForm.processing} className="bg-emerald-900 hover:bg-emerald-950">Mulai Periode</AdminButton>
                            </div>
                        </form>
                    </>
                )}
            </div>

            {/* History */}
            <div className="bg-white rounded-2xl border border-[#E8E7E3] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E8E7E3] bg-[#FAFAF8]">
                    <h2 className="font-bold text-[#1A1A18]">Riwayat Periode</h2>
                </div>
                {periods.length === 0 && <p className="px-6 py-10 text-center text-sm text-[#8A8A84]">Belum ada periode tercatat.</p>}
                <div className="hidden md:grid grid-cols-[1fr_1.2fr_1fr_1fr_1fr_1fr_1.2fr] gap-4 px-6 py-3 bg-[#FAFAF8] border-b border-[#E8E7E3] text-[12px] font-bold uppercase tracking-wider text-[#8A8A84]">
                    <div>Periode</div>
                    <div>Meter</div>
                    <div>Pemakaian</div>
                    <div>Tagihan</div>
                    <div>Jatuh Tempo</div>
                    <div>Dibayar</div>
                    <div>Status</div>
                </div>
                {periods.map((p) => {
                    const status = statusInfo(p.status);
                    return (
                        <div key={p.id}>
                            <div className="hidden md:grid grid-cols-[1fr_1.2fr_1fr_1fr_1fr_1fr_1.2fr] gap-4 px-6 py-3 items-center border-b border-[#F1F0EC] text-sm text-[#2A2A27]">
                                <div className="font-medium">{periodeLabel(p)}</div>
                                <div>{angka(p.meter_start)} → {p.meter_end !== null ? angka(p.meter_end) : '…'}</div>
                                <div>{p.usage !== null ? `${angka(p.usage)} m³` : '-'}</div>
                                <div className="font-medium">{rupiah(p.total_amount)}</div>
                                <div>{p.due_date ?? '-'}</div>
                                <div>{p.paid_at ?? '-'}</div>
                                <div>
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold border ${status.cls}`}>{status.label}</span>
                                </div>
                            </div>
                            <div className="md:hidden px-5 py-4 border-b border-[#F1F0EC] space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-[#1A1A18]">{periodeLabel(p)}</span>
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold border ${status.cls}`}>{status.label}</span>
                                </div>
                                <p className="text-[13px] text-[#6B6B67]">Meter {angka(p.meter_start)} → {p.meter_end !== null ? angka(p.meter_end) : '…'} · {p.usage !== null ? `Pemakaian ${angka(p.usage)} m³` : ''}</p>
                                <p className="text-[13px] text-[#6B6B67]">Tagihan {rupiah(p.total_amount)} · Jatuh tempo {p.due_date ?? '-'}</p>
                                <div className="flex gap-4 pt-1">
                                    {p.has_start_photo && <a href={photoUrl(p.id, 'start')} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline text-[13px]">foto awal</a>}
                                    {p.has_end_photo && <a href={photoUrl(p.id, 'end')} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline text-[13px]">foto akhir</a>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </AdminLayout>
    );
}