import TenantLayout from '@/layouts/TenantLayout';
import { Link } from '@inertiajs/react';
import { motion } from 'framer-motion';

interface DashboardProps {
    tenancy: any;
    statusLabel: string;
    dueDayLabel: string;
    nextDueDate: string | null;
    nextBilling: any;
    waterRule: any;
    hasAgreement: boolean;
}

export default function Dashboard({
    tenancy,
    statusLabel,
    dueDayLabel,
    nextDueDate,
    nextBilling,
    waterRule,
    hasAgreement,
}: DashboardProps) {
    const formatRupiah = (val: string | number) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val));

    const allowance = Number(waterRule?.allowance_m3) > 0;

    const quickLinks = [
        { href: '/tenant/payments', icon: '💳', label: 'Pembayaran', desc: 'Riwayat & Bukti Bayar' },
        { href: '/tenant/water-usage', icon: '💧', label: 'Air (PAM)', desc: 'Pemakaian Air Bulanan' },
        { href: '/tenant/agreement', icon: '📄', label: 'Surat Pernyataan', desc: 'Dokumen Sewa Anda' },
        { href: '/tenant/agreement', icon: '📸', label: 'Dokumentasi Kamar', desc: 'Kondisi Kamar (Move-in)' },
    ];

    return (
        <TenantLayout title="Dashboard Tenant">
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome Home.</h1>
                <p className="text-neutral-500 mt-1">Kelola kebutuhan kos Anda dalam satu tempat.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Active Tenancy Card */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="lg:col-span-2 bg-neutral-900 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
                    <div className="relative z-10">
                        <div className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-6 break-all">
                            Status: {statusLabel}
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold mb-2">{tenancy?.property?.name ?? '-'}</h2>
                        <p className="text-neutral-300 font-medium opacity-90">
                            Move-in: {tenancy?.move_in_date ?? '-'}
                            {nextDueDate ? ` · Jatuh tempo: ${nextDueDate}` : ''}
                        </p>

                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm min-w-0">
                                <span className="block text-xs text-neutral-300 uppercase tracking-wider mb-1">Sewa Bulanan</span>
                                <span className="block text-lg sm:text-xl font-bold break-words">{formatRupiah(tenancy?.agreed_price)}</span>
                            </div>
                            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm min-w-0">
                                <span className="block text-xs text-neutral-300 uppercase tracking-wider mb-1">
                                    {allowance ? 'Jatah Air' : 'Air PAM'}
                                </span>
                                <span className="block text-lg sm:text-xl font-bold break-words">
                                    {allowance ? `${waterRule.allowance_m3} m³ / bln` : 'Tagih terpisah'}
                                </span>
                                <span className="block text-[11px] text-neutral-300 mt-1">{waterRule?.note}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Billing Summary Card */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-lg mb-6 flex items-center justify-between gap-2">
                            <span>Pembayaran Berikutnya</span>
                            <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full whitespace-nowrap">
                                {nextBilling ? nextBilling.status_label : 'Belum ada'}
                            </span>
                        </h3>

                        {nextBilling ? (
                            <div className="space-y-4">
                                <div>
                                    <span className="block text-neutral-500 text-sm">Jatuh Tempo</span>
                                    <span className="block font-bold text-2xl text-red-600">{nextBilling.due_date}</span>
                                    <span className="block text-xs text-neutral-400 mt-1">{nextBilling.period_label}</span>
                                </div>
                                <div className="space-y-2 pt-4 border-t border-neutral-100">
                                    <div className="flex justify-between text-sm gap-2">
                                        <span className="text-neutral-500">Harga Sewa</span>
                                        <span className="font-medium">{formatRupiah(nextBilling.amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm gap-2">
                                        <span className="text-neutral-500">
                                            {tenancy?.property?.type === 'KIOSK' ? 'Pemakaian Air PAM' : 'Air Lebih (Excess)'}
                                        </span>
                                        <span className="font-medium">{formatRupiah(nextBilling.excess_water_charge)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold pt-2 border-t border-neutral-100">
                                        <span>TOTAL TAGIHAN</span>
                                        <span>{formatRupiah(nextBilling.total)}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-neutral-400">
                                <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p>Belum ada tagihan aktif.</p>
                                <p className="text-xs mt-1">Detail tagihan sewaktu-waktu akan muncul di halaman Pembayaran.</p>
                            </div>
                        )}
                    </div>

                    <Link
                        href="/tenant/payments"
                        className="w-full bg-neutral-900 text-white font-medium py-3 rounded-lg hover:bg-neutral-800 transition-colors mt-6 text-center"
                    >
                        Bayar Sekarang
                    </Link>
                </motion.div>
            </div>

            {/* Quick Access Grid */}
            <div className="mt-8">
                <h3 className="font-bold text-lg mb-4">Akses Cepat</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {quickLinks.map((link, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + idx * 0.05 }}
                        >
                            <Link
                                href={link.href}
                                className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-neutral-900 hover:shadow-md transition-all text-left flex flex-col items-start gap-3 h-full"
                            >
                                <span className="text-3xl">{link.icon}</span>
                                <div>
                                    <h4 className="font-bold text-neutral-900">{link.label}</h4>
                                    <p className="text-xs text-neutral-500 mt-1">{link.desc}</p>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {!hasAgreement && (
                    <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                        Surat Pernyataan Anda belum tersedia. Tim admin sedang menyiapkannya — Anda akan melihatnya di halaman
                        <Link href="/tenant/agreement" className="font-semibold underline ml-1">Surat Pernyataan</Link>.
                    </div>
                )}
            </div>
        </TenantLayout>
    );
}