import PublicLayout from '@/layouts/PublicLayout';
import { motion } from 'framer-motion';
import { Link } from '@inertiajs/react';
import { ChevronRight, Check } from 'lucide-react';

// Types
type PropertyStatus = 'AVAILABLE' | 'OCCUPIED' | 'UPCOMING_AVAILABLE' | 'MAINTENANCE';

interface PropertyMedia {
    id: number;
    type: 'IMAGE' | 'VIDEO';
    public_path: string;
    is_cover: boolean;
}

interface Property {
    id: number;
    name: string;
    type: 'ROOM' | 'KIOSK';
    normal_price?: string;
    status: PropertyStatus;
    media?: PropertyMedia[];
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
            <section className="relative h-[85vh] flex items-center justify-center bg-[#1A1A18] overflow-hidden">
                {/* 1. Background Image */}
                <img 
                    src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=2070&auto=format&fit=crop" 
                    alt="Hero Architecture" 
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
                
                {/* 2. Gradient Overlay for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A18] via-[#1A1A18]/60 to-transparent z-10" />
                
                <div className="relative z-20 container mx-auto px-6 lg:px-12 text-center max-w-4xl pt-20">
                    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-6">
                        <span className="inline-block py-1.5 px-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-sm font-medium tracking-wide uppercase">
                            Premium Boarding House
                        </span>
                        
                        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-[1.1]">
                            Ruang Hidup Privat<br />
                            <span className="text-white/70 italic font-serif">& Eksklusif.</span>
                        </h1>
                        
                        <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto font-light leading-relaxed">
                            Hunian modern di pusat kota dengan fasilitas premium, desain minimalis, dan manajemen profesional. 
                            Terdiri dari 10 Kamar Eksklusif dan 1 Kios.
                        </p>
                        
                        <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <a href="#rooms" className="px-8 py-4 bg-white text-[#1A1A18] rounded-full font-medium hover:bg-neutral-200 transition-colors w-full sm:w-auto shadow-lg">
                                Lihat Ketersediaan Unit
                            </a>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ROOMS LISTING SECTION */}
            <section id="rooms" className="py-24 bg-[#F7F7F5]">
                <div className="container mx-auto px-6 lg:px-12 max-w-7xl">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-[#1A1A18] mb-4 tracking-tight">Ketersediaan Unit</h2>
                        <p className="text-[#6B6B67] text-lg">Pilih ruang yang sesuai dengan kebutuhan Anda. Semua unit didesain dengan sirkulasi udara dan cahaya alami yang optimal.</p>
                    </div>

                    {properties.length === 0 ? (
                        <div className="text-center py-20 text-[#6B6B67] bg-white rounded-2xl border border-[#E8E7E3]">
                            Belum ada unit yang terdaftar.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {properties.map((property) => {
                                const cover = property.media?.find(m => m.is_cover) || property.media?.[0];
                                const isOccupied = property.status === 'OCCUPIED';

                                return (
                                    <div 
                                        key={property.id} 
                                        className={`group bg-white rounded-2xl overflow-hidden border border-[#E8E7E3] transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col ${isOccupied ? 'opacity-80 grayscale-[20%]' : ''}`}
                                    >
                                        {/* Image Container with Watermark Protection */}
                                        <div 
                                            className="relative aspect-[4/3] bg-neutral-100 overflow-hidden select-none"
                                            onContextMenu={(e) => e.preventDefault()}
                                        >
                                            {cover && cover.type === 'IMAGE' ? (
                                                <img 
                                                    src={cover.public_path} 
                                                    alt={property.name}
                                                    draggable="false"
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-[#8A8A84] bg-[#E8E7E3]/50">
                                                    <span className="font-serif italic text-lg opacity-50">Menteng Kos</span>
                                                </div>
                                            )}

                                            {/* Status Badge */}
                                            <div className="absolute top-4 right-4">
                                                <span className={`px-3 py-1.5 text-xs font-semibold rounded-full backdrop-blur-md shadow-sm border ${
                                                    property.status === 'AVAILABLE' ? 'bg-white/90 text-[#047857] border-[#047857]/20' :
                                                    'bg-[#1A1A18]/80 text-white border-white/10'
                                                }`}>
                                                    {property.status === 'AVAILABLE' ? 'TERSEDIA' : 'TERISI'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-6 flex flex-col flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-xl font-bold text-[#1A1A18] tracking-tight">{property.name}</h3>
                                            </div>
                                            
                                            <p className="text-[#6B6B67] text-sm mb-6 font-medium">
                                                {property.type === 'ROOM' ? 'Kamar Kos Eksklusif' : 'Kios Komersial'}
                                            </p>

                                            <div className="mt-auto pt-4 border-t border-[#E8E7E3] flex items-center justify-between">
                                                <div>
                                                    <p className="text-[11px] text-[#8A8A84] uppercase tracking-wider font-semibold mb-0.5">Harga Normal</p>
                                                    <p className="text-[#1A1A18] font-bold">
                                                        {property.normal_price ? formatPrice(property.normal_price) : 'Hubungi Admin'}
                                                        <span className="text-sm font-normal text-[#6B6B67]"> / bln</span>
                                                    </p>
                                                </div>
                                                <Link 
                                                    href={`/kamar/${property.id}`}
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                                        isOccupied 
                                                        ? 'bg-[#F7F7F5] text-[#8A8A84] hover:bg-[#E8E7E3]' 
                                                        : 'bg-[#1A1A18] text-white hover:bg-neutral-800'
                                                    }`}
                                                >
                                                    <ChevronRight className="w-5 h-5" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </PublicLayout>
    );
}
