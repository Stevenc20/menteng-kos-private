import TenantLayout from '@/layouts/TenantLayout';
import { motion } from 'framer-motion';

interface DashboardProps {
    tenancy: any;
    nextBilling: any;
}

export default function Dashboard({ tenancy, nextBilling }: DashboardProps) {
    const formatRupiah = (val: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val));

    const quickLinks = [
        { icon: '💳', label: 'Payment', desc: 'Riwayat & Bukti Bayar' },
        { icon: '💧', label: 'Water Usage', desc: 'Pemakaian Air Bulanan' },
        { icon: '📄', label: 'Agreement', desc: 'Surat Pernyataan Anda' },
        { icon: '📸', label: 'Room Docs', desc: 'Kondisi Kamar (Move-in)' },
        { icon: '📶', label: 'WiFi Access', desc: 'Password Internet' },
        { icon: '🔧', label: 'Report Issue', desc: 'Lapor Kerusakan' },
    ];

    return (
        <TenantLayout title="Dashboard Tenant">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Welcome Home.</h1>
                <p className="text-neutral-500 mt-1">Kelola kebutuhan kos Anda dalam satu tempat.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Active Tenancy Card */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="lg:col-span-2 bg-neutral-900 text-white rounded-3xl p-8 relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <svg className="w-48 h-48" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1v-1.5c0-.28-.22-.5-.5-.5h-17c-.28 0-.5.22-.5.5V13zm12 5H9v-2h6v2zm4-12V4c0-1.1-.9-2-2-2H7C5.9 2 5 2.9 5 4v2H3v2h18V6h-2zm-4 0H9V4h6v2z"/></svg>
                    </div>
                    
                    <div className="relative z-10">
                        <div className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-6">
                            Status: {tenancy.status}
                        </div>
                        <h2 className="text-4xl font-bold mb-2">{tenancy.property.name}</h2>
                        <p className="text-neutral-300 font-medium opacity-90 mb-8">Move-in: {tenancy.move_in_date}</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                                <span className="block text-xs text-neutral-300 uppercase tracking-wider mb-1">Monthly Rent</span>
                                <span className="block text-xl font-bold">{formatRupiah(tenancy.agreed_price)}</span>
                            </div>
                            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                                <span className="block text-xs text-neutral-300 uppercase tracking-wider mb-1">Water Allowance</span>
                                <span className="block text-xl font-bold">5 m³ / bln</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Billing Summary Card */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white rounded-3xl p-8 border border-neutral-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-lg mb-6 flex items-center justify-between">
                            Next Payment
                            <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full">{nextBilling ? nextBilling.status : 'UPCOMING'}</span>
                        </h3>
                        
                        {nextBilling ? (
                            <div className="space-y-4">
                                <div>
                                    <span className="block text-neutral-500 text-sm">Due Date</span>
                                    <span className="block font-bold text-2xl text-red-600">{nextBilling.due_date}</span>
                                </div>
                                <div className="space-y-2 pt-4 border-t border-neutral-100">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-neutral-500">Rent Price</span>
                                        <span className="font-medium">{formatRupiah(nextBilling.amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-neutral-500">Excess Water</span>
                                        <span className="font-medium">{formatRupiah(nextBilling.excess_water_charge)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold pt-2 border-t border-neutral-100">
                                        <span>Total</span>
                                        <span>{formatRupiah(Number(nextBilling.amount) + Number(nextBilling.excess_water_charge))}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-neutral-400">
                                <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <p>Belum ada tagihan.</p>
                            </div>
                        )}
                    </div>

                    <button className="w-full bg-neutral-900 text-white font-medium py-3 rounded-lg hover:bg-neutral-800 transition-colors mt-6">
                        Bayar Sekarang
                    </button>
                </motion.div>
            </div>

            {/* Quick Access Grid */}
            <div className="mt-8">
                <h3 className="font-bold text-lg mb-4">Quick Access</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {quickLinks.map((link, idx) => (
                        <motion.button key={idx} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + (idx * 0.05) }} className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-neutral-900 hover:shadow-md transition-all text-left flex flex-col items-start gap-3">
                            <span className="text-3xl">{link.icon}</span>
                            <div>
                                <h4 className="font-bold text-neutral-900">{link.label}</h4>
                                <p className="text-xs text-neutral-500 mt-1">{link.desc}</p>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </div>

        </TenantLayout>
    );
}
