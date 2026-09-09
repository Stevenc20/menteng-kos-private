import { useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import { motion } from 'framer-motion';

interface WaitingApprovalProps {
    tenancy?: any;
    agreement: any;
}

export default function WaitingApproval({ tenancy, agreement }: WaitingApprovalProps) {
    const isRejected = tenancy?.approval_status === 'REJECTED';

    useEffect(() => {
        if (isRejected) return;
        const id = setInterval(() => {
            router.reload({ only: ['tenancy', 'agreement'] });
        }, 7000);
        return () => clearInterval(id);
    }, [isRejected]);

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 font-sans">
            <Head title={isRejected ? 'Data Memerlukan Perbaikan | Menteng Kos Private' : 'Menunggu Persetujuan | Menteng Kos Private'} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white max-w-md w-full p-8 rounded-2xl shadow-sm border border-neutral-200 text-center"
            >
                {isRejected ? (
                    <>
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>

                        <h1 className="text-2xl font-bold tracking-tight mb-3">Data Memerlukan Perbaikan</h1>
                        <p className="text-neutral-500 mb-6">
                            data Anda belum disetujui oleh Administrator. Silakan perbaiki sesuai catatan di bawah lalu kirim ulang.
                        </p>

                        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-left">
                            <p className="text-sm font-semibold text-red-800 mb-1">Catatan dari Administrator:</p>
                            <p className="text-sm text-red-700 leading-relaxed">{tenancy?.rejection_reason || 'Tidak ada catatan.'}</p>
                        </div>

                        <button
                            onClick={() => router.post('/tenant/onboarding/revise')}
                            className="mt-8 w-full bg-neutral-900 text-white px-8 py-3 rounded-full font-medium hover:bg-neutral-800 transition-colors"
                        >
                            Perbaiki &amp; Kirim Ulang
                        </button>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>

                        <h1 className="text-2xl font-bold tracking-tight mb-3">Menunggu Persetujuan</h1>
                        <p className="text-neutral-500 mb-5">
                            Terima kasih telah melengkapi data dan menandatangani Surat Pernyataan. Saat ini data Anda sedang direviu oleh Administrator.
                        </p>

                        <div className="inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1.5 mb-4">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            Halaman ini diperbarui otomatis setiap beberapa detik
                        </div>

                        <p className="text-xs text-neutral-400">Anda akan diarahkan otomatis begitu data disetujui.</p>
                    </>
                )}

                <button
                    onClick={() => router.post('/logout')}
                    className="mt-8 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                    Keluar / Logout
                </button>
            </motion.div>

            {agreement?.document_html && (
                <div className="mt-8 w-full max-w-3xl">
                    <h2 className="text-lg font-bold tracking-tight mb-3 text-neutral-800">Surat Pernyataan &amp; Tanda Tangan Anda</h2>
                    <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 shadow-sm text-sm overflow-x-hidden"
                         dangerouslySetInnerHTML={{ __html: agreement.document_html }}
                    />
                </div>
            )}
        </div>
    );
}