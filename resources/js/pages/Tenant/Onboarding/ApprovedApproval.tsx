import { Head, Link } from '@inertiajs/react';
import { motion } from 'framer-motion';

interface ApprovedApprovalProps {
    tenancy?: any;
    agreement: any;
}

export default function ApprovedApproval({ tenancy }: ApprovedApprovalProps) {
    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 font-sans">
            <Head title="Pendaftaran Disetujui | Menteng Kos Private" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white max-w-md w-full p-8 rounded-2xl shadow-sm border border-neutral-200 text-center"
            >
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                <h1 className="text-2xl font-bold tracking-tight mb-3">Pendaftaran Disetujui</h1>
                <p className="text-neutral-500 mb-6">
                    Selamat! Data Anda telah disetujui oleh Administrator.
                    Akun Anda telah aktif.
                </p>

                <div className="bg-neutral-50 rounded-xl border border-neutral-100 p-4 text-left text-sm space-y-2">
                    <div className="flex justify-between">
                        <span className="text-neutral-500">Unit</span>
                        <span className="font-medium">{tenancy?.property?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-neutral-500">Tanggal Masuk</span>
                        <span className="font-medium">{tenancy?.move_in_date || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-neutral-500">Status</span>
                        <span className="font-bold text-emerald-600">AKTIF</span>
                    </div>
                </div>

                <Link
                    href="/tenant/dashboard"
                    className="mt-8 w-full block bg-neutral-900 text-white px-8 py-3 rounded-full font-medium hover:bg-neutral-800 transition-colors"
                >
                    Masuk ke Dashboard
                </Link>
            </motion.div>
        </div>
    );
}