import PublicLayout from '@/layouts/PublicLayout';
import { motion } from 'framer-motion';

// Types
type PropertyStatus = 'AVAILABLE' | 'OCCUPIED' | 'UPCOMING_AVAILABLE' | 'MAINTENANCE';

interface Property {
    id: number;
    name: string;
    type: 'ROOM' | 'KIOSK';
    normal_price?: string;
    status: PropertyStatus;
}

interface WelcomeProps {
    properties: Property[];
}

export default function Welcome({ properties }: WelcomeProps) {
    const fadeUp = {
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
    };

    const formatPrice = (price: string) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0,
        }).format(Number(price));
    };

    return (
        <PublicLayout title="Beranda | Menteng Kos Private">
            
            {/* HERO SECTION */}
            <section className="relative h-[85vh] flex items-center justify-center bg-neutral-950 overflow-hidden">
                {/* 1. Background Image */}
                <img 
                    src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=2070&auto=format&fit=crop" 
                    alt="Hero Architecture" 
                    className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* 2. Subtle Charcoal / Dark Transparent Overlay */}
                <div className="absolute inset-0 bg-neutral-900/30 z-10" />
                
                {/* 3. Soft Gradient for Text Legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-neutral-900/40 to-transparent z-10" />
                
                <div className="relative z-20 max-w-4xl mx-auto px-6 text-center text-white">
                    <motion.h1 
                        initial="hidden" animate="visible" variants={fadeUp}
                        className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] mb-6"
                    >
                        Ruang Hidup Privat <br className="hidden md:block"/> & Eksklusif.
                    </motion.h1>
                    <motion.p 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 1 }}
                        className="text-lg md:text-xl font-light text-neutral-200 mb-10 max-w-2xl mx-auto"
                    >
                        Hunian modern di pusat kota dengan fasilitas premium, desain minimalis, dan manajemen profesional. 
                        Terdiri dari 10 Kamar Eksklusif dan 1 Kios.
                    </motion.p>
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }}
                    >
                        <a href="#rooms" className="bg-white text-neutral-900 px-8 py-4 rounded-full font-medium hover:bg-neutral-100 transition-all inline-flex items-center gap-2">
                            Lihat Ketersediaan Unit
                        </a>
                    </motion.div>
                </div>
            </section>

            {/* ROOMS & KIOSKS SECTION */}
            <section id="rooms" className="py-32 px-6 bg-white">
                <div className="max-w-7xl mx-auto">
                    <motion.div 
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}
                        className="mb-16 md:flex justify-between items-end"
                    >
                        <div>
                            <h2 className="text-4xl font-bold tracking-tight mb-4">Ketersediaan Unit</h2>
                            <p className="text-neutral-500 max-w-xl text-lg">Pilih ruang yang sesuai dengan kebutuhan Anda. Semua unit didesain dengan sirkulasi udara dan cahaya alami yang optimal.</p>
                        </div>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {properties.length > 0 ? properties.map((unit, idx) => (
                            <motion.div 
                                key={unit.id}
                                initial="hidden" whileInView="visible" viewport={{ once: true }} 
                                variants={{
                                    hidden: { opacity: 0, y: 30 },
                                    visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: idx * 0.1 } }
                                }}
                                className="group block border border-neutral-200 p-6 rounded-2xl hover:border-neutral-900 transition-colors bg-neutral-50"
                            >
                                <div className="flex justify-between items-start mb-12">
                                    <h3 className="text-2xl font-semibold tracking-tight">{unit.name}</h3>
                                    {unit.status === 'AVAILABLE' && (
                                        <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                                            Tersedia
                                        </span>
                                    )}
                                    {unit.status === 'UPCOMING_AVAILABLE' && (
                                        <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                                            Segera Tersedia
                                        </span>
                                    )}
                                    {unit.status === 'OCCUPIED' && (
                                        <span className="bg-neutral-200 text-neutral-600 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                                            Terisi
                                        </span>
                                    )}
                                </div>
                                
                                <div className="mb-6">
                                    <span className="text-sm text-neutral-500 block mb-1">Tipe Unit</span>
                                    <span className="font-medium">{unit.type === 'ROOM' ? 'Kamar Kos' : 'Kios Komersial'}</span>
                                </div>

                                <div className="flex items-end justify-between border-t border-neutral-200 pt-6 mt-6">
                                    <div>
                                        {unit.status !== 'OCCUPIED' ? (
                                            <>
                                                <span className="text-sm text-neutral-500 block mb-1">Harga mulai</span>
                                                <span className="text-xl font-bold">{formatPrice(unit.normal_price || '0')}</span>
                                                <span className="text-sm text-neutral-500"> / bulan</span>
                                            </>
                                        ) : (
                                            <span className="text-sm text-neutral-500 block">Harga tidak ditampilkan</span>
                                        )}
                                    </div>
                                    
                                    {unit.status !== 'OCCUPIED' && (
                                        <a 
                                            href={`https://wa.me/6281234567890?text=Halo,%20saya%20tertarik%20dengan%20${unit.name}.%20Apakah%20bisa%20survey?`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center group-hover:scale-110 transition-transform"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                        </a>
                                    )}
                                </div>
                            </motion.div>
                        )) : (
                            <div className="col-span-full py-12 text-center text-neutral-500 border border-dashed border-neutral-300 rounded-2xl">
                                Belum ada unit yang terdaftar.
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* WA FLOATING ACTION BUTTON */}
            <a 
                href="https://wa.me/6281234567890?text=Halo!%20%F0%9F%91%8B%20Saya%20ingin%20mendapatkan%20informasi%20ketersediaan%20kamar."
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-8 right-8 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-3 group"
                title="Hubungi Admin via WhatsApp"
            >
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 group-hover:mr-2 transition-all duration-300 font-medium text-sm">
                    Tanya Admin
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 1.829 6.315L0 24l5.908-1.554A11.954 11.954 0 0 0 12 24a12 12 0 0 0 12-12c0-6.627-5.373-12-12-12zm.056 21.84c-1.897 0-3.753-.513-5.385-1.482l-.386-.228-4.004 1.053 1.066-3.901-.25-.398A9.852 9.852 0 0 1 2.16 12C2.16 6.57 6.57 2.16 12 2.16S21.84 6.57 21.84 12c0 5.43-4.41 9.84-9.84 9.84zm5.342-7.291c-.292-.146-1.734-.855-2.003-.953-.269-.098-.466-.146-.662.146-.196.292-.758.953-.928 1.148-.17.195-.34.22-.632.073-.292-.146-1.238-.456-2.358-1.455-.872-.777-1.46-1.737-1.63-2.03-.17-.293-.018-.45.128-.596.133-.131.292-.34.438-.512.146-.17.195-.292.292-.487.097-.195.049-.365-.025-.512-.073-.146-.662-1.595-.907-2.18-.239-.57-.482-.493-.662-.502-.17-.008-.366-.01-.561-.01-.195 0-.512.073-.781.365-.269.292-1.025.998-1.025 2.434s1.05 2.824 1.196 3.019c.146.195 2.057 3.136 4.981 4.398 2.924 1.262 2.924.84 3.46.791.536-.049 1.734-.707 1.978-1.39.244-.683.244-1.267.17-1.39-.074-.122-.27-.195-.562-.34z"/></svg>
            </a>
        </PublicLayout>
    );
}
