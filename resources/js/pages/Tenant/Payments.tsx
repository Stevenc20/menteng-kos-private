import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import TenantLayout from '@/layouts/TenantLayout';
import StatusBadge, { billingTone, waterTone } from '@/components/Tenant/StatusBadge';

interface PaymentsProps {
    tenancy: any;
    waterRule: any;
    billings: any[];
    waterCharges: any[];
}

const formatRupiah = (val: string | number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val));

export default function Payments({ tenancy, waterRule, billings, waterCharges }: PaymentsProps) {
    const [payingBilling, setPayingBilling] = useState<any>(null);

    const form = useForm<{ amount_claimed: string; receipt_image: File | null }>({
        amount_claimed: '',
        receipt_image: null,
    });

    const openPayModal = (billing: any) => {
        form.clearErrors();
        form.reset('receipt_image');
        setPayingBilling(billing);
        form.setData('amount_claimed', String(billing.total ?? ''));
    };

    const submitProof = () => {
        if (!payingBilling) return;
        form.post(`/tenant/payments/${payingBilling.id}/proof`, {
            preserveScroll: true,
            onSuccess: () => {
                setPayingBilling(null);
                form.reset();
            },
        });
    };

    return (
        <TenantLayout title="Pembayaran">
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pembayaran</h1>
                <p className="text-neutral-500 mt-1">
                    Tagihan sewa dan air PAM unit <span className="font-medium text-neutral-700">{tenancy?.property?.name}</span>.
                </p>
            </div>

            {/* Rent Billings */}
            <section className="mb-10">
                <h2 className="font-bold text-lg mb-4">Tagihan Sewa</h2>
                {billings.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-neutral-400">
                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p>Belum ada tagihan sewa.</p>
                        <p className="text-xs mt-1">Tagihan akan muncul otomatis sesuai siklus pembayaran Anda.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-neutral-200 divide-y divide-neutral-100 shadow-sm">
                        {billings.map((b) => (
                            <div key={b.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-bold text-neutral-900">{b.period_label ?? `Tagihan ${b.billing_type}`}</h3>
                                        <StatusBadge label={b.status_label} tone={billingTone(b.status)} />
                                    </div>
                                    <p className="text-sm text-neutral-500 mt-0.5">
                                        Jatuh tempo {b.due_date}
                                        {b.latest_proof_status === 'VERIFIED' ? ' · Bukti telah diverifikasi' : ''}
                                        {b.latest_proof_status === 'REJECTED' ? ' · Bukti ditolak, silakan unggah ulang' : ''}
                                        {b.latest_proof_status === 'PENDING' ? ' · Bukti menunggu verifikasi' : ''}
                                    </p>
                                </div>
                                <div className="w-full sm:w-40 text-left sm:text-right sm:shrink-0">
                                    <span className="block font-bold text-neutral-900">{formatRupiah(b.total)}</span>
                                    {Number(b.excess_water_charge) > 0 && (
                                        <span className="block text-xs text-neutral-400">termasuk air Rp {formatRupiah(b.excess_water_charge)}</span>
                                    )}
                                </div>
                                <div className="sm:w-36 shrink-0">
                                    {b.is_payable && !b.has_pending_proof ? (
                                        <button
                                            onClick={() => openPayModal(b)}
                                            className="w-full bg-neutral-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-neutral-800 transition-colors"
                                        >
                                            Bayar Sekarang
                                        </button>
                                    ) : (
                                        <span className="w-full block text-center text-xs text-neutral-400 py-2">
                                            {b.status === 'PAID' ? 'Lunas' : 'Menunggu verifikasi'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Water Charges */}
            <section>
                <h2 className="font-bold text-lg mb-4">Tagihan Air (PAM)</h2>
                {waterRule?.note && <p className="text-xs text-neutral-500 -mt-2 mb-4">{waterRule.note}</p>}
                {waterCharges.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-neutral-400">
                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <p>Belum ada tagihan air.</p>
                        <p className="text-xs mt-1">Tagihan air dihitung setelah admin membaca meteran pada tanggal jatuh tempo.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-neutral-200 divide-y divide-neutral-100 shadow-sm overflow-hidden">
                        {waterCharges.map((w) => (
                            <div key={w.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-bold text-neutral-900">{w.period_label}</h3>
                                        <StatusBadge label={w.status_label} tone={waterTone(w.status)} />
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-1">
                                        Pemakaian <span className="font-medium">{w.usage ?? '-'} m³</span>
                                        {' · '}Jatah {w.allowance} m³
                                        {' · '}Lebih (ditagih) {w.billable_usage ?? 0} m³
                                        {' · '}Tarif {formatRupiah(w.water_rate)}/m³
                                    </p>
                                    <p className="text-xs text-neutral-400 mt-0.5">{w.billing_note}</p>
                                </div>
                                <div className="sm:shrink-0 text-left sm:text-right">
                                    <span className="block font-bold text-neutral-900">{formatRupiah(w.total_amount)}</span>
                                    <span className="block text-xs text-neutral-400">
                                        {w.paid_at ? `Lunas ${w.paid_at.split(' ')[0]}` : w.due_date ? `Jatuh tempo ${w.due_date}` : ''}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Pay modal */}
            {payingBilling && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setPayingBilling(null)}>
                    <div
                        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="font-bold text-lg mb-1">Konfirmasi Pembayaran</h3>
                        <p className="text-sm text-neutral-500 mb-5">
                            {payingBilling.period_label} · Jatuh tempo {payingBilling.due_date}
                        </p>

                        <div className="bg-neutral-50 rounded-xl p-4 mb-5 flex justify-between items-center">
                            <span className="text-sm text-neutral-500">Total tagihan</span>
                            <span className="font-bold text-lg">{formatRupiah(payingBilling.total)}</span>
                        </div>

                        <label className="block text-sm font-medium text-neutral-700 mb-1">Jumlah yang Ditransfer (Rp)</label>
                        <input
                            type="number"
                            min="0"
                            value={form.data.amount_claimed}
                            onChange={(e) => form.setData('amount_claimed', e.target.value)}
                            className="w-full border border-neutral-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        />
                        {form.errors.amount_claimed && (
                            <p className="text-xs text-red-600 mb-2">{form.errors.amount_claimed}</p>
                        )}

                        <label className="block text-sm font-medium text-neutral-700 mb-1">Foto / Bukti Transfer</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => form.setData('receipt_image', e.target.files?.[0] ?? null)}
                            className="w-full block mb-4 text-sm"
                        />
                        {form.errors.receipt_image && (
                            <p className="text-xs text-red-600 mb-2">{form.errors.receipt_image}</p>
                        )}

                        <div className="flex gap-3 mt-2">
                            <button
                                onClick={() => setPayingBilling(null)}
                                className="flex-1 border border-neutral-300 text-neutral-700 font-medium py-2.5 rounded-lg hover:bg-neutral-50 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={submitProof}
                                disabled={form.processing || !form.data.receipt_image}
                                className="flex-1 bg-neutral-900 text-white font-medium py-2.5 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {form.processing ? 'Mengunggah…' : 'Kirim Bukti'}
                            </button>
                        </div>
                        {(form.errors as any)._form && <p className="text-xs text-red-600 mt-3">{(form.errors as any)._form}</p>}
                    </div>
                </div>
            )}
        </TenantLayout>
    );
}