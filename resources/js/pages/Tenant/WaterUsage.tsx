import TenantLayout from '@/layouts/TenantLayout';
import StatusBadge, { waterTone } from '@/components/Tenant/StatusBadge';

interface WaterUsageProps {
    tenancy: any;
    waterRule: any;
    periods: any[];
}

const formatRupiah = (val: string | number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val));

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
                    <div>
                        <span className="block text-xs text-neutral-500">Jatah termasuk sewa</span>
                        <span className="block font-bold text-neutral-900">{allowance} m³ / bulan</span>
                    </div>
                    <div>
                        <span className="block text-xs text-neutral-500">Tarif kelebihan pemakaian</span>
                        <span className="block font-bold text-neutral-900">{formatRupiah(waterRule?.rate_per_m3)} / m³</span>
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
                        <div key={p.id} className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <h3 className="font-bold text-neutral-900">{p.period_label}</h3>
                                <StatusBadge label={p.status_label} tone={waterTone(p.status)} />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                                <div className="bg-neutral-50 rounded-xl p-3 min-w-0">
                                    <span className="block text-xs text-neutral-500">Meter Mulai</span>
                                    <span className="block font-bold text-neutral-900">{p.meter_start ?? '-'} m³</span>
                                    {p.start_photo_url && (
                                        <a href={p.start_photo_url} target="_blank" rel="noreferrer" className="inline-block mt-2">
                                            <img src={p.start_photo_url} alt="Meter mulai" loading="lazy" className="h-16 w-24 object-cover rounded-lg border border-neutral-200" />
                                        </a>
                                    )}
                                </div>
                                <div className="bg-neutral-50 rounded-xl p-3 min-w-0">
                                    <span className="block text-xs text-neutral-500">Meter Akhir</span>
                                    <span className="block font-bold text-neutral-900">{p.meter_end ?? '-'} m³</span>
                                    {p.end_photo_url && (
                                        <a href={p.end_photo_url} target="_blank" rel="noreferrer" className="inline-block mt-2">
                                            <img src={p.end_photo_url} alt="Meter akhir" loading="lazy" className="h-16 w-24 object-cover rounded-lg border border-neutral-200" />
                                        </a>
                                    )}
                                </div>
                                <div className="bg-neutral-50 rounded-xl p-3 min-w-0">
                                    <span className="block text-xs text-neutral-500">Pemakaian</span>
                                    <span className="block font-bold text-neutral-900">{p.usage ?? '-'} m³</span>
                                    <span className="block text-[11px] text-neutral-400 mt-1">Jatah {p.allowance} m³</span>
                                </div>
                                <div className="bg-neutral-50 rounded-xl p-3 min-w-0">
                                    <span className="block text-xs text-neutral-500">Ditagih (lebih)</span>
                                    <span className="block font-bold text-neutral-900">{p.billable_usage ?? 0} m³</span>
                                    <span className="block text-[11px] text-neutral-400 mt-1">{formatRupiah(p.water_rate)}/m³</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 flex-wrap mt-4 pt-4 border-t border-neutral-100">
                                <span className="text-xs text-neutral-500">{p.billing_note}</span>
                                <div className="text-right">
                                    <span className="block font-bold text-neutral-900">
                                        {p.total_amount !== null ? formatRupiah(p.total_amount) : 'Belum dihitung'}
                                    </span>
                                    {p.total_amount !== null && (
                                        <span className="block text-xs text-neutral-400">
                                            {p.paid_at ? `Lunas ${p.paid_at.split(' ')[0]}` : p.due_date ? `Jatuh tempo ${p.due_date}` : ''}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </TenantLayout>
    );
}