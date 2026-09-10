import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import { Droplets, Camera, CheckCircle2, AlertTriangle, Timer, Settings2, ScrollText, ExternalLink } from 'lucide-react';
import {
    AdminModal,
    AdminModalHeader,
    AdminModalContent,
    AdminModalFooter,
} from '@/components/admin/AdminModal';
import {
    FormSection,
    FormLabel,
    FormHelper,
    FormError,
    TextInput,
    CurrencyInput,
} from '@/components/admin/AdminForm';
import { AdminButton } from '@/components/admin/AdminButton';

interface WaterPeriod {
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

interface PropertyRow {
    id: number;
    name: string;
    type: string;
    status: string;
    tenant: { id: number; name: string } | null;
    has_paid: boolean;
    water: WaterPeriod | null;
}

interface WaterSettings {
    to_admin_whatsapp: string;
    rate_per_m3: number;
    reminder_days: number;
    email_enabled: boolean;
    whatsapp_enabled: boolean;
    whatsapp_provider: string;
    mail_mailer: string;
}

interface LogEntry {
    id: number;
    trigger: string;
    channel: string;
    status: string;
    recipient: string;
    error: string | null;
    reminder_date: string | null;
    created_at: string | null;
    unit: string | null;
}

interface AirProps {
    properties: PropertyRow[];
    stats: {
        total: number;
        perlu_update_meter: number;
        menunggu_pembayaran: number;
        jatuh_tempo_hari_ini: number;
        lunas: number;
    };
    activeFilter: string;
    settings: WaterSettings;
    logs: LogEntry[];
}

const FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'meter-due', label: 'Perlu Update Meter' },
    { key: 'waiting-payment', label: 'Belum Bayar' },
    { key: 'paid', label: 'Lunas' },
];

function rupiah(n: number | null): string {
    if (n === null) return '-';
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(n);
}

function angka(n: number | null | undefined): string {
    if (n === null || n === undefined) return '-';
    return new Intl.NumberFormat('id-ID').format(n);
}

function statusInfo(status: WaterPeriod['status']) {
    switch (status) {
        case 'METER_DUE':
            return { label: 'Perlu Update Meter', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
        case 'WAITING_PAYMENT':
            return { label: 'Belum Bayar', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
        case 'PAID':
            return { label: 'Lunas', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
}

const TRIGGER_LABEL: Record<string, string> = {
    WATER_H4_METER: 'Pengingat H-4 · Meter Akhir',
    WATER_PAYMENT_DUE: 'Tagihan Jatuh Tempo',
    WATER_NEW_PERIOD: 'Periode Baru',
};

export default function Air({ properties, stats, activeFilter, settings, logs }: AirProps) {
    const [modal, setModal] = useState<'start' | 'record' | 'settings' | 'logs' | null>(null);
    const [selectedProperty, setSelectedProperty] = useState<PropertyRow | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<WaterPeriod | null>(null);

    const startForm = useForm({ meter_start: '', photo: null as File | null, note: '' });
    const recordForm = useForm({ meter_end: '', photo: null as File | null });
    const settingsForm = useForm({
        to_admin_whatsapp: settings.to_admin_whatsapp,
        rate_per_m3: String(settings.rate_per_m3),
        reminder_days: String(settings.reminder_days),
        email_enabled: settings.email_enabled,
        whatsapp_enabled: settings.whatsapp_enabled,
        whatsapp_provider: settings.whatsapp_provider,
    });

    const statCards = [
        { title: 'Total Unit', value: stats.total, icon: Droplets, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100' },
        { title: 'Perlu Update Meter', value: stats.perlu_update_meter, icon: Camera, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        { title: 'Menunggu Pembayaran', value: stats.menunggu_pembayaran, icon: Timer, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
        { title: 'Jatuh Tempo Hari Ini', value: stats.jatuh_tempo_hari_ini, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
        { title: 'Lunas', value: stats.lunas, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    ];

    const setFilter = (key: string) => {
        router.get('/admin/water', key === 'all' ? {} : { filter: key }, { preserveState: true, replace: true });
    };

    const submitStart = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProperty) return;
        startForm.post(`/admin/water/${selectedProperty.id}/start`, {
            preserveScroll: true,
            onSuccess: () => {
                closeStart();
                toast.success('Periode air dimulai');
            },
            onError: () => toast.error('Gagal memulai periode air'),
        });
    };

    const closeStart = () => {
        setModal(null);
        setSelectedProperty(null);
        startForm.reset();
    };

    const submitRecord = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPeriod) return;
        recordForm.post(`/admin/water/periods/${selectedPeriod.id}/record`, {
            preserveScroll: true,
            onSuccess: () => {
                closeRecord();
                toast.success('Meter akhir tercatat');
            },
            onError: () => toast.error('Gagal mencatat meter akhir'),
        });
    };

    const closeRecord = () => {
        setModal(null);
        setSelectedPeriod(null);
        recordForm.reset();
    };

    const openRecord = (p: WaterPeriod) => {
        setSelectedPeriod(p);
        setModal('record');
    };

    const openStart = (p: PropertyRow) => {
        setSelectedProperty(p);
        setModal('start');
    };

    const confirmPayment = (p: WaterPeriod) => {
        if (!confirm('Konfirmasi pembayaran air periode ini? Periode berikutnya akan otomatis dibuka.')) return;
        router.post(`/admin/water/periods/${p.id}/confirm`, {}, {
            preserveScroll: true,
            onSuccess: () => toast.success('Pembayaran terkonfirmasi'),
            onError: () => toast.error('Gagal mengonfirmasi pembayaran'),
        });
    };

    const submitSettings = (e: React.FormEvent) => {
        e.preventDefault();
        settingsForm.post('/admin/water/settings', {
            preserveScroll: true,
            onSuccess: () => {
                setModal(null);
                toast.success('Pengaturan disimpan');
            },
            onError: () => toast.error('Gagal menyimpan pengaturan'),
        });
    };

    const photoUrl = (periodId: number, kind: string) => `/admin/water/periods/${periodId}/photo/${kind}`;

    return (
        <AdminLayout title="Meter Air">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1A1A18]">Meter Air</h1>
                    <p className="text-sm md:text-base text-[#6B6B67] mt-1.5">Pemantauan meter air per unit, tagihan, dan pengingat.</p>
                </div>
                <div className="flex items-center gap-3">
                    <AdminButton variant="secondary" onClick={() => setModal('logs')}>
                        <ScrollText className="w-4 h-4" /> Log Notifikasi
                    </AdminButton>
                    <AdminButton variant="secondary" onClick={() => setModal('settings')}>
                        <Settings2 className="w-4 h-4" /> Pengaturan
                    </AdminButton>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="bg-white p-5 rounded-2xl border border-[#E8E7E3] shadow-sm flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[12px] font-semibold text-[#8A8A84] uppercase tracking-wider mb-2">{stat.title}</p>
                                <p className="text-3xl font-bold text-[#1A1A18] leading-none">{stat.value}</p>
                            </div>
                            <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color} ${stat.border} border shrink-0`}>
                                <Icon className="w-5 h-5" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filters */}
            <div className="mt-8 flex flex-wrap items-center gap-2">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            activeFilter === f.key
                                ? 'bg-[#1A1A18] text-white'
                                : 'bg-white border border-[#E8E7E3] text-[#6B6B67] hover:border-[#1A1A18] hover:text-[#1A1A18]'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="mt-6 bg-white rounded-2xl border border-[#E8E7E3] shadow-sm overflow-hidden">
                {/* Desktop header */}
                <div className="hidden md:grid grid-cols-[1.4fr_1fr_1.2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 bg-[#FAFAF8] border-b border-[#E8E7E3] text-[12px] font-bold uppercase tracking-wider text-[#8A8A84]">
                    <div>Unit</div>
                    <div>Penghuni</div>
                    <div>Meter</div>
                    <div>Pemakaian</div>
                    <div>Jatuh Tempo</div>
                    <div>Status</div>
                    <div className="text-right">Aksi</div>
                </div>

                {properties.length === 0 && (
                    <div className="px-6 py-16 text-center text-[#8A8A84]">Tidak ada unit pada filter ini.</div>
                )}

                {properties.map((row) => {
                    const status = row.water ? statusInfo(row.water.status) : { label: row.has_paid ? 'Lunas' : 'Belum Ada', cls: 'bg-gray-100 text-gray-600 border-gray-200' };
                    return (
                        <div key={row.id}>
                            {/* Desktop row */}
                            <div className="hidden md:grid grid-cols-[1.4fr_1fr_1.2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center border-b border-[#F1F0EC] hover:bg-[#FBFBF9] transition-colors">
                                <div className="min-w-0">
                                    <Link href={`/admin/water/${row.id}`} className="flex items-center gap-2 font-semibold text-[#1A1A18] hover:text-black group">
                                        {row.name}
                                        <ExternalLink className="w-3.5 h-3.5 text-[#A1A19A] group-hover:text-[#1A1A18]" />
                                    </Link>
                                    <p className="text-[12px] text-[#8A8A84] mt-0.5">{row.type === 'KIOSK' ? 'Kios' : 'Kamar'} · {row.status.replace(/_/g, ' ')}</p>
                                </div>
                                <div className="text-sm text-[#2A2A27] truncate">{row.tenant?.name ?? '-'}</div>
                                <div className="text-sm text-[#2A2A27]">
                                    {row.water
                                        ? `${angka(row.water.meter_start)} → ${row.water.meter_end ?? '…'}`
                                        : '-'}
                                </div>
                                <div className="text-sm text-[#2A2A27]">{row.water?.usage !== null && row.water?.usage !== undefined ? `${angka(row.water.usage)} m³` : '-'}</div>
                                <div className="text-sm text-[#2A2A27]">{row.water?.due_date ?? '-'}</div>
                                <div>
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold border ${status.cls}`}>{status.label}</span>
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    {row.water?.status === 'METER_DUE' && (
                                        <AdminButton className="h-9 px-3 text-[13px]" onClick={() => openRecord(row.water!)}>
                                            <Camera className="w-4 h-4" /> Update Meter
                                        </AdminButton>
                                    )}
                                    {row.water?.status === 'WAITING_PAYMENT' && (
                                        <>
                                            <span className="text-sm font-semibold text-[#1A1A18]">{rupiah(row.water.total_amount)}</span>
                                            <AdminButton className="h-9 px-3 text-[13px]" onClick={() => confirmPayment(row.water!)}>
                                                Konfirmasi Bayar
                                            </AdminButton>
                                        </>
                                    )}
                                    {!row.water && (
                                        <AdminButton className="h-9 px-3 text-[13px] bg-emerald-900 hover:bg-emerald-950" onClick={() => openStart(row)}>
                                            Mulai
                                        </AdminButton>
                                    )}
                                </div>
                            </div>

                            {/* Mobile card */}
                            <div className="md:hidden px-5 py-4 border-b border-[#F1F0EC]">
                                <div className="flex items-center justify-between">
                                    <Link href={`/admin/water/${row.id}`} className="font-semibold text-[#1A1A18]">{row.name}</Link>
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold border ${status.cls}`}>{status.label}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[13px] text-[#6B6B67]">
                                    <span>Penghuni: <b className="text-[#1A1A18]">{row.tenant?.name ?? '-'}</b></span>
                                    <span>Meter: <b className="text-[#1A1A18]">{row.water ? `${angka(row.water.meter_start)} → ${row.water.meter_end ?? '…'}` : '-'}</b></span>
                                    <span>Jatuh Tempo: <b className="text-[#1A1A18]">{row.water?.due_date ?? '-'}</b></span>
                                </div>
                                {row.water && (
                                    <div className="flex items-center justify-between mt-3">
                                        <span className="text-sm">{row.water.usage !== null && row.water.usage !== undefined ? `Pemakaian ${angka(row.water.usage)} m³` : ''}</span>
                                        <div className="flex items-center gap-2">
                                            {row.water.status === 'WAITING_PAYMENT' && (
                                                <span className="text-sm font-semibold text-[#1A1A18]">{rupiah(row.water.total_amount)}</span>
                                            )}
                                            {row.water.status === 'METER_DUE' && (
                                                <AdminButton className="h-9 px-3 text-[13px]" onClick={() => openRecord(row.water!)}>
                                                    Update Meter
                                                </AdminButton>
                                            )}
                                            {row.water.status === 'WAITING_PAYMENT' && (
                                                <AdminButton className="h-9 px-3 text-[13px]" onClick={() => confirmPayment(row.water!)}>
                                                    Konfirmasi Bayar
                                                </AdminButton>
                                            )}
                                            {!row.water && (
                                                <AdminButton className="h-9 px-3 text-[13px] bg-emerald-900 hover:bg-emerald-950" onClick={() => openStart(row)}>
                                                    Mulai
                                                </AdminButton>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {!row.water && (
                                    <div className="mt-3">
                                        <AdminButton className="h-9 px-3 text-[13px] bg-emerald-900 hover:bg-emerald-950" onClick={() => openStart(row)}>
                                            Mulai
                                        </AdminButton>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* START MODAL */}
            <AdminModal isOpen={modal === 'start'} onClose={closeStart} maxWidth="sm">
                <AdminModalHeader
                    title={`Mulai Periode — ${selectedProperty?.name ?? ''}`}
                    description="Catat meter awal unit. Angka ini menjadi acuan meter akhir berikutnya."
                    onClose={closeStart}
                />
                <form onSubmit={submitStart} className="flex flex-col flex-1 min-h-0">
                    <AdminModalContent>
                        <FormSection title="Meter Awal" />
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

                        <div className="mt-4">
                            <FormLabel htmlFor="photo">Foto Meter</FormLabel>
                            <TextInput
                                id="photo"
                                type="file"
                                accept="image/*"
                                onChange={(e) => startForm.setData('photo', e.target.files?.[0] ?? null)}
                            />
                            {startForm.data.photo && (
                                <img src={URL.createObjectURL(startForm.data.photo)} alt="preview" className="mt-3 w-full rounded-[10px] border border-[#E8E7E3] max-h-40 object-contain" />
                            )}
                            <FormError>{startForm.errors.photo}</FormError>
                        </div>

                        <div className="mt-4">
                            <FormLabel htmlFor="note">Catatan (opsional)</FormLabel>
                            <TextInput
                                id="note"
                                placeholder="cth: pergantian penghuni"
                                value={startForm.data.note}
                                onChange={(e) => startForm.setData('note', e.target.value)}
                            />
                        </div>
                    </AdminModalContent>
                    <AdminModalFooter>
                        <AdminButton variant="secondary" type="button" onClick={closeStart}>Batal</AdminButton>
                        <AdminButton isLoading={startForm.processing}>Simpan Meter Awal</AdminButton>
                    </AdminModalFooter>
                </form>
            </AdminModal>

            {/* RECORD END MODAL */}
            <AdminModal isOpen={modal === 'record'} onClose={closeRecord} maxWidth="sm">
                <AdminModalHeader
                    title={`Update Meter — ${selectedProperty?.name ?? ''}`}
                    description="Catat meter akhir. Pemakaian dihitung otomatis (akhir − awal)."
                    onClose={closeRecord}
                />
                <form onSubmit={submitRecord} className="flex flex-col flex-1 min-h-0">
                    <AdminModalContent>
                        {selectedPeriod && (
                            <div className="flex items-center gap-4 bg-[#F7F7F5] rounded-[10px] px-4 py-3 text-sm mb-4">
                                <div>
                                    <p className="text-[12px] text-[#8A8A84]">Meter awal</p>
                                    <p className="font-bold text-[#1A1A18]">{angka(selectedPeriod.meter_start)} m³</p>
                                </div>
                                {selectedPeriod.has_start_photo && (
                                    <a href={photoUrl(selectedPeriod.id, 'start')} target="_blank" className="text-[12px] text-sky-600 hover:underline">lihat foto awal</a>
                                )}
                            </div>
                        )}
                        <FormSection title="Meter Akhir" />
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

                        <div className="mt-4">
                            <FormLabel htmlFor="photo-end">Foto Meter</FormLabel>
                            <TextInput
                                id="photo-end"
                                type="file"
                                accept="image/*"
                                onChange={(e) => recordForm.setData('photo', e.target.files?.[0] ?? null)}
                            />
                            {recordForm.data.photo && (
                                <img src={URL.createObjectURL(recordForm.data.photo)} alt="preview" className="mt-3 w-full rounded-[10px] border border-[#E8E7E3] max-h-40 object-contain" />
                            )}
                            <FormError>{recordForm.errors.photo}</FormError>
                        </div>
                        {selectedPeriod?.meter_end !== null && (
                            <p className="mt-4 text-[13px] text-[#6B6B67]">Meter akhir tidak boleh lebih kecil dari meter awal.</p>
                        )}
                    </AdminModalContent>
                    <AdminModalFooter>
                        <AdminButton variant="secondary" type="button" onClick={closeRecord}>Batal</AdminButton>
                        <AdminButton isLoading={recordForm.processing}>Simpan Meter Akhir</AdminButton>
                    </AdminModalFooter>
                </form>
            </AdminModal>

            {/* SETTINGS MODAL */}
            <AdminModal isOpen={modal === 'settings'} onClose={() => setModal(null)} maxWidth="md">
                <AdminModalHeader
                    title="Pengaturan Meter Air"
                    description="Nomor admin WhatsApp, tarif air, dan jadwal pengingat. Nomor ini tidak dikunci di kode."
                    onClose={() => setModal(null)}
                />
                <form onSubmit={submitSettings} className="flex flex-col flex-1 min-h-0">
                    <AdminModalContent>
                        <FormSection title="Admin WhatsApp" />
                        <FormLabel htmlFor="wa">Nomor WhatsApp Admin</FormLabel>
                        <TextInput
                            id="wa"
                            value={settingsForm.data.to_admin_whatsapp}
                            onChange={(e) => settingsForm.setData('to_admin_whatsapp', e.target.value)}
                        />
                        <FormError>{settingsForm.errors.to_admin_whatsapp}</FormError>

                        <FormSection title="Tarif & Pengingat" />
                        <FormLabel htmlFor="rate">Tarif Air per m³ (Rp)</FormLabel>
                        <CurrencyInput
                            id="rate"
                            value={settingsForm.data.rate_per_m3}
                            onChange={(v) => settingsForm.setData('rate_per_m3', v)}
                        />
                        <FormError>{settingsForm.errors.rate_per_m3}</FormError>

                        <div className="mt-4">
                            <FormLabel htmlFor="reminder">Pengingat H-? (hari sebelum jatuh tempo)</FormLabel>
                            <TextInput
                                id="reminder"
                                type="number"
                                min={1}
                                max={30}
                                value={settingsForm.data.reminder_days}
                                onChange={(e) => settingsForm.setData('reminder_days', e.target.value)}
                            />
                            <FormError>{settingsForm.errors.reminder_days}</FormError>
                        </div>

                        <FormSection title="Saluran Notifikasi" />
                        <label className="flex items-center justify-between py-2 cursor-pointer">
                            <div>
                                <p className="text-[14px] font-medium text-[#2A2A27]">Email</p>
                                <p className="text-[12px] text-[#8A8A84]">Mailer aktif: {settings.mail_mailer}</p>
                            </div>
                            <input
                                type="checkbox"
                                className="w-5 h-5 accent-black"
                                checked={settingsForm.data.email_enabled}
                                onChange={(e) => settingsForm.setData('email_enabled', e.target.checked)}
                            />
                        </label>
                        <label className="flex items-center justify-between py-2 cursor-pointer">
                            <div>
                                <p className="text-[14px] font-medium text-[#2A2A27]">WhatsApp</p>
                                <p className="text-[12px] text-[#8A8A84]">Butuh provider + credential. Tanpa itu, pesan dicatat SKIPPED (tidak pernah diklaim terkirim).</p>
                            </div>
                            <input
                                type="checkbox"
                                className="w-5 h-5 accent-black"
                                checked={settingsForm.data.whatsapp_enabled}
                                onChange={(e) => settingsForm.setData('whatsapp_enabled', e.target.checked)}
                            />
                        </label>
                        <div className="mt-4">
                            <FormLabel htmlFor="provider">WhatsApp Provider (opsional)</FormLabel>
                            <TextInput
                                id="provider"
                                placeholder="cth: fonnte"
                                value={settingsForm.data.whatsapp_provider}
                                onChange={(e) => settingsForm.setData('whatsapp_provider', e.target.value)}
                            />
                            <FormHelper>Nama provider untuk dokumentasi. Saat ini tidak ada integrasi pengiriman nyata.</FormHelper>
                        </div>
                    </AdminModalContent>
                    <AdminModalFooter>
                        <AdminButton variant="secondary" type="button" onClick={() => setModal(null)}>Batal</AdminButton>
                        <AdminButton isLoading={settingsForm.processing}>Simpan Pengaturan</AdminButton>
                    </AdminModalFooter>
                </form>
            </AdminModal>

            {/* LOG NOTIFIKASI MODAL */}
            <AdminModal isOpen={modal === 'logs'} onClose={() => setModal(null)} maxWidth="lg">
                <AdminModalHeader
                    title="Log Notifikasi"
                    description="Status pengiriman pengingat H-4, jatuh tempo, dan periode baru. WA tanpa provider tercatat SKIPPED — tidak pernah diklaim terkirim."
                    onClose={() => setModal(null)}
                />
                <AdminModalContent>
                    {logs.length === 0 && <p className="py-10 text-center text-sm text-[#8A8A84]">Belum ada notifikasi tercatat.</p>}
                    <div className="space-y-2">
                        {logs.map((log) => {
                            const badge =
                                log.status === 'SENT'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : log.status === 'FAILED'
                                      ? 'bg-red-50 text-red-700'
                                      : 'bg-gray-100 text-gray-600';
                            return (
                                <div key={log.id} className="flex flex-col gap-1 border border-[#E8E7E3] rounded-[10px] px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${log.status === 'SENT' ? 'border-emerald-200' : log.status === 'FAILED' ? 'border-red-200' : 'border-gray-200'} ${badge}`}>{log.status}</span>
                                            <span className="text-[12px] font-bold text-[#8A8A84] uppercase tracking-wide">{log.channel}</span>
                                            <span className="text-[13px] font-medium text-[#1A1A18] truncate">{TRIGGER_LABEL[log.trigger] ?? log.trigger}</span>
                                        </div>
                                        <span className="text-[12px] text-[#8A8A84] shrink-0">{log.reminder_date}</span>
                                    </div>
                                    {log.unit && <p className="text-[13px] text-[#2A2A27]">Unit: {log.unit} · Penerima: {log.recipient}</p>}
                                    {log.error && <p className="text-[12px] text-[#A16207]">{log.error}</p>}
                                </div>
                            );
                        })}
                    </div>
                </AdminModalContent>
                <AdminModalFooter>
                    <AdminButton variant="secondary" onClick={() => setModal(null)}>Tutup</AdminButton>
                </AdminModalFooter>
            </AdminModal>
        </AdminLayout>
    );
}