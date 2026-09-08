import { Head, usePage } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

export default function Login() {
    const { flash } = usePage<any>().props;
    const errorMessage = flash?.error || null;

    // Animation Variants
    const staggerContainer = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.15, delayChildren: 0.2 }
        }
    };

    const fadeUp = {
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
    };

    const imageReveal = {
        hidden: { scale: 1.05, opacity: 0 },
        show: { scale: 1, opacity: 1, transition: { duration: 1.2, ease: "easeOut" } }
    };

    return (
        <div className="min-h-screen w-full bg-[#FAF9F6] flex flex-col lg:flex-row font-sans overflow-hidden">
            <Head title="Sign In | Menteng Kos Private" />

            {/* VISUAL EXPERIENCE AREA (Left Side - Desktop) */}
            <div className="hidden lg:block lg:w-[55%] xl:w-[60%] relative bg-neutral-900 overflow-hidden">
                {/* 1. Main Property Image */}
                <motion.div 
                    initial="hidden" animate="show" variants={imageReveal}
                    className="absolute inset-0 w-full h-full"
                >
                    <img 
                        src="https://images.unsplash.com/photo-1600607687959-ce8a6c25118c?q=80&w=2053&auto=format&fit=crop" 
                        alt="Menteng Kos Architecture" 
                        className="w-full h-full object-cover"
                    />
                </motion.div>
                
                {/* 2. Layered Overlays for Depth */}
                <div className="absolute inset-0 bg-neutral-900/20" />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-neutral-900/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/40 to-transparent" />

                {/* 3. Decorative Architectural Lines */}
                <div className="absolute left-12 top-0 bottom-0 w-[1px] bg-white/10" />
                <div className="absolute right-12 top-0 bottom-0 w-[1px] bg-white/10" />

                {/* 4. Secondary Floating Image (Depth effect) */}
                <motion.div 
                    initial={{ opacity: 0, x: -30 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
                    className="absolute bottom-24 right-12 w-64 h-80 rounded-sm overflow-hidden shadow-2xl border border-white/10"
                >
                    <img 
                        src="https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?q=80&w=2127&auto=format&fit=crop"
                        alt="Interior Detail"
                        className="w-full h-full object-cover"
                    />
                </motion.div>

                {/* 5. Floating Property Information / Metadata */}
                <div className="absolute top-12 left-20">
                    <motion.div initial="hidden" animate="show" variants={fadeUp} className="text-white/80 tracking-widest text-[10px] uppercase font-semibold mb-2">
                        Private Residence
                    </motion.div>
                    <motion.div initial="hidden" animate="show" variants={fadeUp} className="text-white font-serif text-2xl tracking-wide">
                        Menteng, Jakarta.
                    </motion.div>
                </div>

                <div className="absolute bottom-16 left-20 text-white">
                    <motion.h2 initial="hidden" animate="show" variants={fadeUp} className="text-5xl lg:text-6xl font-light tracking-tight leading-[1.1] mb-6">
                        Private Living.<br/>
                        <span className="font-semibold">Simply Managed.</span>
                    </motion.h2>
                    <motion.div initial="hidden" animate="show" variants={fadeUp} className="flex gap-8 text-sm font-medium tracking-widest uppercase text-white/70">
                        <div>10 Exclusive Rooms</div>
                        <div>1 Commercial Unit</div>
                    </motion.div>
                </div>
            </div>

            {/* AUTHENTICATION AREA (Right Side) */}
            <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col relative bg-[#FAF9F6] min-h-screen">
                
                {/* Mobile Header Image (Only visible on small screens) */}
                <div className="lg:hidden h-64 w-full relative">
                    <img 
                        src="https://images.unsplash.com/photo-1600607687959-ce8a6c25118c?q=80&w=2053&auto=format&fit=crop" 
                        alt="Menteng Kos" 
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-neutral-900/40" />
                    <div className="absolute bottom-4 left-6 text-white font-serif text-xl">
                        Menteng Kos Private
                    </div>
                </div>

                {/* Top Navigation */}
                <div className="p-6 md:p-10 flex justify-between items-center w-full">
                    <div className="font-bold tracking-tighter text-xl text-neutral-900 hidden lg:block">MK</div>
                    <a href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Kembali ke Beranda
                    </a>
                </div>

                {/* Form Container */}
                <div className="flex-1 flex items-center justify-center p-6 md:p-12 w-full">
                    <motion.div 
                        variants={staggerContainer} 
                        initial="hidden" 
                        animate="show" 
                        className="w-full max-w-[420px]"
                    >
                        <motion.div variants={fadeUp} className="text-neutral-400 tracking-widest text-[11px] uppercase font-bold mb-6">
                            Resident Portal
                        </motion.div>

                        <motion.h1 variants={fadeUp} className="text-4xl md:text-5xl font-light tracking-tight text-neutral-900 mb-6 leading-[1.15]">
                            Selamat Datang<br/>
                            <span className="font-semibold">Kembali.</span>
                        </motion.h1>
                        
                        <motion.p variants={fadeUp} className="text-neutral-500 text-[15px] leading-relaxed mb-10">
                            Masuk menggunakan akun Google yang telah terdaftar untuk mengakses informasi hunian, pembayaran, dokumen, dan layanan Menteng Kos Private.
                        </motion.p>

                        {/* Error Message */}
                        {errorMessage && (
                            <motion.div variants={fadeUp} className="mb-8 p-4 rounded-lg bg-red-50/50 border border-red-100 flex items-start gap-3 text-red-800 shadow-sm">
                                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm font-medium leading-relaxed">{errorMessage}</span>
                            </motion.div>
                        )}

                        {/* Primary Google Login */}
                        <motion.div variants={fadeUp} className="mb-10">
                            <a 
                                href="/auth/google" 
                                className="group w-full flex items-center justify-center gap-4 bg-neutral-900 text-white p-4 rounded-none font-medium hover:bg-neutral-800 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Lanjutkan dengan Google
                            </a>
                        </motion.div>

                        {/* Divider */}
                        <motion.div variants={fadeUp} className="w-full h-px bg-neutral-200 mb-8" />

                        {/* Additional Information */}
                        <motion.div variants={fadeUp} className="text-center">
                            <p className="text-[13px] text-neutral-500 leading-relaxed mb-6">
                                Akses hanya tersedia untuk penghuni<br/>
                                dan administrator yang telah terdaftar.
                            </p>
                            
                            <p className="text-[13px] text-neutral-400">
                                Belum menjadi penghuni?{' '}
                                <a href="https://wa.me/6281234567890?text=Halo,%20saya%20tertarik%20survey%20unit." target="_blank" rel="noreferrer" className="text-neutral-900 font-semibold hover:underline">
                                    Ajukan Survey &rarr;
                                </a>
                            </p>
                        </motion.div>

                    </motion.div>
                </div>
            </div>
        </div>
    );
}
