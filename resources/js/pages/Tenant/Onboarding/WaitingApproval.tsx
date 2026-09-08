import { Head } from '@inertiajs/react';
import { motion } from 'framer-motion';

export default function WaitingApproval() {
    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 font-sans">
            <Head title="Menunggu Persetujuan | Menteng Kos Private" />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white max-w-md w-full p-8 rounded-2xl shadow-sm border border-neutral-200 text-center"
            >
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                
                <h1 className="text-2xl font-bold tracking-tight mb-3">Menunggu Persetujuan</h1>
                <p className="text-neutral-500 mb-8">
                    Terima kasih telah melengkapi data dan menandatangani Surat Pernyataan. Saat ini data Anda sedang direviu oleh Administrator. 
                </p>

                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 text-sm text-neutral-600 text-left space-y-3">
                    <p className="font-medium text-neutral-900">Langkah selanjutnya:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Admin akan memverifikasi dokumen identitas Anda.</li>
                        <li>Admin akan melakukan Dokumentasi Kondisi Kamar (Move-in Documentation).</li>
                        <li>Admin mencatat angka meteran air awal.</li>
                        <li>Akun Anda akan diaktifkan secara otomatis.</li>
                    </ul>
                </div>

                <form method="POST" action="/logout" className="mt-8">
                    <input type="hidden" name="_token" value={(window as any).csrf_token} />
                    <button type="submit" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
                        Keluar / Logout
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
