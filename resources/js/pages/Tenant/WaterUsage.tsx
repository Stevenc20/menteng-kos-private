import TenantLayout from '@/layouts/TenantLayout';
import StatusBadge, { waterTone } from '@/components/Tenant/StatusBadge';

interface WaterUsageProps {
    tenancy: any;
    waterRule: any;
    periods: any[];
}

const formatRupiah = (val: string | number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val));

const shortDate = (iso?: string) => iso?.split(' ')[0] ?? '';

function MeterRange({ p }: { p: any }) {
    const to = p.has_end ? p.meter_end : p.allowance_end ?? '…';

    return (
        <div className="bg-neutral-50 rounded-2xl p-4 sm:p-5 mt-4">
            <span className="block text-xs font-medium text-neutral-500">Meter periode</span>
            <p className="mt-1 font-bold text-neutral-900 tabular-nums text-xl sm:text-2xl whitespace-nowrap">
                {p.meter_start} m³ → {to} m³
            </p>
            <p className="text-xs text-neutral-500 mt-1">
                {p.has_end ? (
                    <>
                        {p.meter_end_recorded_at ? `Tercatat ${shortDate(p.meter_end_recorded_at)}` : 'Pencatatan selesai'}
                        {p.end_photo_url ? ' · lihat foto meter' : ''}
                    </>
                ) : p.allowance > 0 ? (
                    `Batas jatah ${p.allowance} m³ termasuk sewa — meter akhir belum dicatat`
                ) : (
                    'Meter akhir belum dicatat'
                )}
            </p>

            {(p.start_photo_url || p.end_photo_url) && (
                <div className="flex gap-2 mt-3 flex-wrap">
                    {p.start_photo_url && (
                        <a href={p.start_photo_url} target="_blank" rel="noreferrer">
                            <img
                                src={p.start_photo_url}
                                alt="Meter mulai"
                                loading="lazy"
                                className="h-14 w-20 object-cover rounded-lg border border-neutral-200"
                            />
                        </a>
                    )}
                    {p.end_photo_url && (
                        <a href={p.end_photo_url} target="_blank" rel="noreferrer">
                            <img
                                src={p.end_photo_url}
                                alt="Meter akhir"
                                loading="lazy"
                                className="h-14 w-20 object-cover rounded-lg border border-neutral-200"
                            />
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
    return (
        <div className="bg-neutral-50 rounded-2xl p-3 sm:p-4 min-w-0">
            <span className="block text-xs text-neutral-500">{label}</span>
            <span className="block font-bold text-neutral-900 tabular-nums mt-0.5 break-words">
                {value}
                {unit ? <span className="text-sm font-medium text-neutral-500"> {unit}</span> : null}
            </span>
        </div>
    );
}

export default function WaterUsage({ tenancy, waterRule, periods }: WaterUsageProps) {
    const allowance = Number(waterRule?.allowance_m3);

    return (
        <TenantLayout title="Pemakaian Air">
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pemakaian Air (PAM)</h1>
                <p className="text-neutral-500 mt-1">
                    Detail meteran dan tagihan air unit <span className="font-medium text-neutral-700">{tenancy?.property?.name}</span>.
                </p>
            </div>

            {/* Rules summary */}
            <div className={`rounded-2xl p-5 sm:p-6 mb-8 border ${allowance > 0 ? 'bg-sky-50 border-sky-200' : 'bg-amber-50 border-amber-200'}`}>
                <h2 className="font-bold text-neutral-900 mb-1">Aturan Air untuk Unit Anda</h2>
                <p className="text-sm text-neutral-700">{waterRule?.note}</p>
                <div className="grid grid-cols-2 gap-3 mt-4 max-w-md">
                    <div className="min-w-0">
                        <span className="block text-xs text-neutral-500">Jatah termasuk sewa</span>
                        <span className="block font-bold text-neutral-900 whitespace-nowrap">{allowance} m³ / bulan</span>
                    </div>
                    <div className="min-w-0">
                        <span className="block text-xs text-neutral-500">Tarif kelebihan pemakaian</span>
                        <span className="block font-bold text-neutral-900 whitespace-nowrap">{formatRupiah(waterRule?.rate_per_m3)} / m³</span>
                    </div>
                </div>
            </div>

            {/* Periods */}
            <h2 className="font-bold text-lg mb-4">Riwayat Meteran</h2>
            {periods.length === 0 ? (
                <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-neutral-400">
                    <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 100 18a9 9 0 000-18zm0 0v9m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    <p>Belum ada pencatatan meteran.</p>
                    <p className="text-xs mt-1">Pencatatan dimulai saat unit Anda ditempati dan dilakukan tiap tanggal jatuh tempo.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {periods.map((p) => (
                        <div key={p.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <h3 className="font-bold text-neutral-900">{p.period_label}</h3>
                                <StatusBadge label={p.status_label} tone={p.has_end ? waterTone(p.status) : 'info'} />
                            </div>

                            <MeterRange p={p} />

                            <div className="grid grid-cols-2 gap-3 mt-3">
                                <Stat label="Pemakaian" value={p.usage ?? '-'} unit="m³" />
                                <Stat label={p.allowance > 0 ? 'Termasuk sewa' : 'Jatah'} value={p.allowance} unit="m³" />
                                <Stat label="Kelebihan" value={p.has_end ? (p.billable_usage ?? 0) : '-'} unit="m³" />
                                <Stat label="Tarif" value={formatRupiah(p.water_rate)} unit="/m³" />
                            </div>

                            <div className="flex items-center justify-between gap-2 flex-wrap mt-4 pt-4 border-t border-neutral-100">
                                <div className="min-w-0">
                                    <span className="block text-xs text-neutral-500">Tagihan tambahan</span>
                                    <span className="block font-bold text-neutral-900 tabular-nums">
                                        {p.total_amount !== null ? formatRupiah(p.total_amount) : 'Belum dihitung'}
                                    </span>
                                </div>
                                <span className="text-xs text-neutral-400 text-right">
                                    {p.total_amount !== null
                                        ? p.paid_at
                                            ? `Lunas ${shortDate(p.paid_at)}`
                                            : p.due_date
                                              ? `Jatuh tempo ${p.due_date}`
                                              : 'Menunggu pembayaran'
                                        : ''}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </TenantLayout>
    );
}