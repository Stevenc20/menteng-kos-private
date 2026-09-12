import PublicLayout from '@/layouts/PublicLayout';
import { motion } from 'framer-motion';
import { Link } from '@inertiajs/react';
import { ChevronRight, Camera, MapPin, ExternalLink } from 'lucide-react';

const GOOGLE_MAPS_SHORT_URL = 'https://maps.app.goo.gl/5m27exRThDiCj4VGA';
const GOOGLE_MAPS_EMBED_URL =
    "https://maps.google.com/maps?q=MENTENG%20KOS%20PRIVATE%2C%20Jl.%20Menteng%20Terusan%20No.20%2C%20Lagoa%2C%20Koja%2C%20Jakarta%2014270&t=m&z=17&ie=UTF8&iwloc=B&output=embed";
const KOS_ADDRESS = 'Jl. Menteng Terusan No.20, Lagoa, Koja, Jakarta Utara 14270';

// Types
type PropertyStatus = 'AVAILABLE' | 'OCCUPIED' | 'UPCOMING_AVAILABLE' | 'MAINTENANCE';

interface PropertyMedia {
    id: number;
    type: 'IMAGE' | 'VIDEO';
    url: string;
    is_cover: boolean;
}

interface Property {
    id: number;
    name: string;
    type: 'ROOM' | 'KIOSK';
    normal_price?: string;
    status: PropertyStatus;
    media?: PropertyMedia[];
    facilities?: string[];
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
        <PublicLayout title="Beranda | Menteng Kos Private" transparentTop={true}>
            
            {/* HERO SECTION */}
            <section className="relative h-[80vh] min-h-[600px] flex items-center justify-center bg-[#1A1A18] overflow-hidden">
                {/* Background Image */}
                <img 
                    src="/img/hero-menteng-kos.png" 
                    alt="Menteng Kos Private" 
                    className="absolute inset-0 w-full h-full object-cover object-center opacity-60"
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A18] via-[#1A1A18]/60 to-transparent z-10" />
                
                <div className="relative z-20 container mx-auto px-6 lg:px-12 text-center max-w-4xl pt-12">
                    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-6">
                        
                        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white tracking-tight leading-[1.1]">
                            Ruang Hidup Privat<br />
                            <span className="text-white/70 italic font-serif">& Eksklusif.</span>
                        </h1>
                        
                        <p className="text-base sm:text-lg md:text-xl text-white/80 max-w-2xl mx-auto font-light leading-relaxed px-4">
                            Hunian modern di pusat kota dengan fasilitas premium, desain minimalis, dan manajemen profesional. 
                            Terdiri dari 10 Kamar Eksklusif dan 1 Kios.
                        </p>
                        
                        <div className="pt-8 flex justify-center px-4">
                            <a href="#rooms" className="px-8 py-4 bg-white text-[#1A1A18] rounded-full font-medium hover:bg-neutral-200 transition-colors w-full sm:w-auto shadow-lg text-center">
                                Lihat Ketersediaan Unit
                            </a>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ROOMS LISTING SECTION */}
            <section id="rooms" className="py-20 md:py-32 bg-[#F8F8F6]">
                <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
                    <div className="text-center max-w-2xl mx-auto mb-12 md:mb-20">
                        <h2 className="text-3xl md:text-4xl font-bold text-[#1A1A18] mb-4 tracking-tight">Ketersediaan Unit</h2>
                        <p className="text-[#6B6B67] text-base md:text-lg">Pilih ruang yang sesuai dengan kebutuhan Anda. Semua unit didesain dengan sirkulasi udara dan cahaya alami yang optimal.</p>
                    </div>

                    {properties.length === 0 ? (
                        <div className="text-center py-24 text-[#6B6B67] bg-white rounded-2xl border border-[#E8E7E3] shadow-sm">
                            Belum ada unit yang terdaftar.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                            {properties.map((property) => {
                                const cover = property.media?.find(m => m.is_cover) || property.media?.[0];
                                const imageCount = property.media?.filter(m => m.type === 'IMAGE').length || 0;
                                const isOccupied = property.status === 'OCCUPIED';

                                return (
                                    <Link 
                                        href={`/kamar/${property.id}`}
                                        key={property.id} 
                                        className={`group flex flex-col bg-white rounded-2xl overflow-hidden border border-[#E8E7E3] transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isOccupied ? 'opacity-80 grayscale-[20%]' : ''}`}
                                    >
                                        {/* Image Container with Watermark Protection */}
                                        <div 
                                            className="relative aspect-[4/3] bg-neutral-100 overflow-hidden select-none shrink-0"
                                            onContextMenu={(e) => e.preventDefault()}
                                        >
                                            {cover && cover.type === 'IMAGE' ? (
                                                <img 
                                                    src={cover.url} 
                                                    alt={property.name}
                                                    draggable="false"
                                                    onError={(e) => {
                                                        if (!e.currentTarget.src.includes('placehold.co')) {
                                                            e.currentTarget.src = 'https://placehold.co/800x600/1A1A18/8A8A84?text=Gambar+Tidak+Tersedia';
                                                        }
                                                    }}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-[#8A8A84] bg-[#E8E7E3]/50">
                                                    <span className="font-serif italic text-xl opacity-50">Menteng Kos</span>
                                                </div>
                                            )}

                                            {/* Status Badge */}
                                            <div className="absolute top-4 right-4">
                                                <span className={`px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-full backdrop-blur-md shadow-sm border ${
                                                    property.status === 'AVAILABLE' ? 'bg-white/95 text-[#047857] border-[#047857]/20' :
                                                    'bg-[#1A1A18]/80 text-white border-white/10'
                                                }`}>
                                                    {property.status === 'AVAILABLE' ? 'TERSEDIA' : 'TERISI'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-6 md:p-8 flex flex-col flex-1">
                                            <h3 className="text-xl md:text-2xl font-bold text-[#1A1A18] tracking-tight mb-1">{property.name}</h3>
                                            
                                            <p className="text-[#6B6B67] text-sm mb-6 font-medium">
                                                {property.type === 'ROOM' ? 'Kamar Kos Eksklusif' : 'Kios Komersial'}
                                            </p>

                                            <div className="mt-auto pt-6 border-t border-[#E8E7E3] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                                <div>
                                                    <p className="text-[11px] text-[#8A8A84] uppercase tracking-wider font-semibold mb-1">Harga Mulai</p>
                                                    <p className="text-[#1A1A18] font-bold text-lg md:text-xl">
                                                        {property.normal_price ? formatPrice(property.normal_price) : '-'}
                                                        <span className="text-xs md:text-sm font-normal text-[#6B6B67]"> / bln</span>
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                                                    {imageCount > 0 && (
                                                        <span className="flex items-center text-xs font-medium text-[#8A8A84]">
                                                            <Camera className="w-3.5 h-3.5 mr-1.5" />
                                                            {imageCount} Foto
                                                        </span>
                                                    )}
                                                    <div 
                                                        className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                                                            isOccupied 
                                                            ? 'bg-[#F7F7F5] text-[#8A8A84]' 
                                                            : 'bg-[#1A1A18] text-white group-hover:bg-neutral-800'
                                                        }`}
                                                    >
                                                        <ChevronRight className="w-5 h-5" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* LOCATION SECTION */}
            <section id="lokasi" className="py-20 md:py-32 bg-white">
                <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
                    <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
                        <div className="inline-flex items-center gap-2 text-[#6B6B67] text-xs uppercase tracking-widest font-semibold mb-4">
                            <MapPin className="w-4 h-4 text-[#047857]" />
                            Lokasi
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-[#1A1A18] mb-4 tracking-tight">Lokasi Menteng Kos Private</h2>
                        <p className="text-[#6B6B67] text-base md:text-lg">{KOS_ADDRESS}</p>
                    </div>

                    <div className="rounded-2xl overflow-hidden border border-[#E8E7E3] shadow-lg max-w-5xl mx-auto bg-[#F8F8F6]">
                        <iframe
                            src={GOOGLE_MAPS_EMBED_URL}
                            title="Peta Lokasi Menteng Kos Private"
                            className="w-full h-[360px] sm:h-[440px] lg:h-[520px] border-0 block"
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    </div>

                    <div className="mt-10 flex justify-center px-4">
                        <a 
                            href={GOOGLE_MAPS_SHORT_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-[#1A1A18] text-white rounded-full font-medium hover:bg-neutral-800 transition-colors shadow-lg"
                        >
                            Buka di Google Maps
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
