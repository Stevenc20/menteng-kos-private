import PublicLayout from '@/layouts/PublicLayout';
import { Link } from '@inertiajs/react';
import { ArrowLeft, Check, Video as VideoIcon, Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
    description?: string | null;
    facilities?: string[] | null;
    media?: PropertyMedia[];
}

interface PropertyDetailProps {
    property: Property;
}

export default function PropertyDetail({ property }: PropertyDetailProps) {
    const formatPrice = (price: string) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0,
        }).format(Number(price));
    };

    const isOccupied = property.status === 'OCCUPIED';
    
    // Sort media: Cover first, then images, then videos
    const sortedMedia = [...(property.media || [])].sort((a, b) => {
        if (a.is_cover) return -1;
        if (b.is_cover) return 1;
        if (a.type === 'IMAGE' && b.type === 'VIDEO') return -1;
        if (a.type === 'VIDEO' && b.type === 'IMAGE') return 1;
        return 0;
    });

    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const openLightbox = (index: number) => {
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    const nextMedia = () => {
        setLightboxIndex((prev) => (prev + 1) % sortedMedia.length);
    };

    const prevMedia = () => {
        setLightboxIndex((prev) => (prev - 1 + sortedMedia.length) % sortedMedia.length);
    };

    // Prevent body scroll when lightbox is open
    useEffect(() => {
        if (lightboxOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [lightboxOpen]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!lightboxOpen) return;
            if (e.key === 'ArrowRight') nextMedia();
            if (e.key === 'ArrowLeft') prevMedia();
            if (e.key === 'Escape') setLightboxOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxOpen]);

    const activeLightboxMedia = sortedMedia[lightboxIndex];

    // Facilities logic
    const facilities = property.facilities || [];
    
    // We can group facilities manually if we want, or just show them all.
    // The user requested "Fasilitas Unit" and "Fasilitas Bersama".
    // Without a specific flag in DB, we can just split them visually based on keywords or show them as one list "Fasilitas".
    // The user's prompt suggested Admin adds them manually. So let's just display all of them under "Fasilitas".
    // Alternatively, we can assume standard shared facilities keywords. Let's just list them under "Fasilitas Unit".

    const generateWhatsAppLink = () => {
        const waNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '6281234567890';
        const text = `Halo Admin Menteng Kos Private,\n\nSaya tertarik dengan unit berikut:\n\nUnit: ${property.name}\nTipe: ${property.type === 'ROOM' ? 'Kamar Kos' : 'Kios'}\nHarga tertera: ${property.normal_price ? formatPrice(property.normal_price) : '-'}/bulan\n\nSaya ingin menanyakan ketersediaan, mengajukan harga, dan menjadwalkan survey.\n\nNama:\nTanggal rencana masuk:\n`;
        return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
    };

    return (
        <PublicLayout title={`${property.name} | Menteng Kos Private`}>
            
            <div className="bg-[#F8F8F6] min-h-[calc(100vh-80px)] py-8 md:py-16">
                <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
                    
                    {/* Header */}
                    <div className="mb-8">
                        <Link href="/#rooms" className="inline-flex items-center text-[#6B6B67] hover:text-[#1A1A18] text-sm font-medium transition-colors mb-6">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Ketersediaan Unit
                        </Link>
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div>
                                <h1 className="text-3xl md:text-5xl font-bold text-[#1A1A18] tracking-tight">{property.name}</h1>
                                <p className="text-[#6B6B67] text-lg mt-2">{property.type === 'ROOM' ? 'Kamar Kos Eksklusif' : 'Kios Komersial'}</p>
                            </div>
                            <div>
                                <span className={`inline-flex px-4 py-2 text-xs md:text-sm font-bold tracking-wide uppercase rounded-full border ${
                                    property.status === 'AVAILABLE' ? 'bg-[#ECFDF5] text-[#047857] border-[#047857]/20' :
                                    'bg-[#E8E7E3] text-[#6B6B67] border-[#E8E7E3]'
                                }`}>
                                    {property.status === 'AVAILABLE' ? 'TERSEDIA' : property.status === 'OCCUPIED' ? 'TERISI' : property.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
                        {/* LEFT COLUMN: Gallery & Info */}
                        <div className="lg:col-span-2 space-y-12">
                            
                            {/* Gallery Section */}
                            <div className="space-y-4">
                                {/* Main Image */}
                                <div 
                                    className="w-full aspect-[4/3] md:aspect-[16/10] bg-[#E8E7E3] rounded-2xl overflow-hidden border border-[#E8E7E3] select-none cursor-pointer group relative"
                                    onClick={() => sortedMedia.length > 0 && openLightbox(0)}
                                    onContextMenu={(e) => e.preventDefault()}
                                >
                                    {sortedMedia.length > 0 ? (
                                        sortedMedia[0].type === 'IMAGE' ? (
                                            <>
                                                <img 
                                                    src={sortedMedia[0].public_path} 
                                                    alt={property.name}
                                                    draggable="false"
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                    <div className="opacity-0 group-hover:opacity-100 bg-white/90 text-[#1A1A18] px-4 py-2 rounded-full font-medium text-sm flex items-center shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all">
                                                        <Camera className="w-4 h-4 mr-2" /> Lihat Semua {sortedMedia.length} Foto
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <video 
                                                src={sortedMedia[0].public_path} 
                                                controls
                                                className="w-full h-full object-cover bg-black"
                                            />
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[#8A8A84] flex-col">
                                            <span className="font-serif italic text-2xl opacity-50 mb-2">Menteng Kos</span>
                                            <span className="text-sm">Belum ada foto</span>
                                        </div>
                                    )}
                                </div>

                                {/* Thumbnail Grid (Max 4 thumbnails, 5th shows +X) */}
                                {sortedMedia.length > 1 && (
                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                                        {sortedMedia.slice(1, 5).map((media, idx) => {
                                            const actualIndex = idx + 1;
                                            const isLastVisible = actualIndex === 4 && sortedMedia.length > 5;
                                            
                                            return (
                                                <button
                                                    key={media.id}
                                                    onClick={() => openLightbox(actualIndex)}
                                                    className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[#E8E7E3] hover:opacity-90 transition-opacity"
                                                    onContextMenu={(e) => e.preventDefault()}
                                                >
                                                    {media.type === 'IMAGE' ? (
                                                        <img 
                                                            src={media.public_path} 
                                                            alt="Thumbnail"
                                                            draggable="false"
                                                            className="w-full h-full object-cover select-none"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-[#1A1A18] flex items-center justify-center text-white">
                                                            <VideoIcon className="w-6 h-6" />
                                                        </div>
                                                    )}
                                                    
                                                    {/* +X More overlay */}
                                                    {isLastVisible && (
                                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-medium">
                                                            +{sortedMedia.length - 5}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <hr className="border-[#E8E7E3]" />

                            {/* Description */}
                            <section>
                                <h2 className="text-2xl font-bold text-[#1A1A18] mb-4">Tentang Unit</h2>
                                {property.description ? (
                                    <div className="text-[#6B6B67] leading-relaxed whitespace-pre-wrap">
                                        {property.description}
                                    </div>
                                ) : (
                                    <p className="text-[#8A8A84] italic">Tidak ada deskripsi tambahan untuk unit ini.</p>
                                )}
                            </section>

                            <hr className="border-[#E8E7E3]" />

                            {/* Facilities */}
                            <section>
                                <h2 className="text-2xl font-bold text-[#1A1A18] mb-6">Fasilitas</h2>
                                {facilities.length > 0 ? (
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                                        {facilities.map((fac, idx) => (
                                            <li key={idx} className="flex items-start text-[#1A1A18] font-medium">
                                                <div className="mt-0.5 mr-3 p-1 shrink-0 bg-[#ECFDF5] text-[#047857] rounded-full">
                                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                </div>
                                                <span>{fac}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-[#8A8A84] italic">Informasi fasilitas belum ditambahkan.</p>
                                )}
                            </section>
                            
                        </div>

                        {/* RIGHT COLUMN: Sticky Pricing Sidebar */}
                        <div className="space-y-6">
                            <div className="bg-white p-8 rounded-2xl border border-[#E8E7E3] shadow-sm lg:sticky lg:top-28">
                                <p className="text-[#8A8A84] text-xs uppercase tracking-wider font-semibold mb-2">Harga Mulai</p>
                                <div className="flex items-baseline gap-2 mb-8">
                                    <span className="text-4xl font-bold text-[#1A1A18] tracking-tight">
                                        {property.normal_price ? formatPrice(property.normal_price) : '-'}
                                    </span>
                                </div>

                                {isOccupied ? (
                                    <div className="p-4 bg-[#F7F7F5] rounded-xl border border-[#E8E7E3] text-center text-[#6B6B67] font-medium">
                                        Unit ini sedang disewa.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <a 
                                            href={generateWhatsAppLink()}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="w-full flex items-center justify-center px-6 py-4 bg-[#1A1A18] text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors shadow-lg active:scale-95"
                                        >
                                            Ajukan Survey
                                        </a>
                                        <a 
                                            href={generateWhatsAppLink()}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="w-full flex items-center justify-center px-6 py-4 bg-white text-[#1A1A18] border border-[#1A1A18] rounded-xl font-medium hover:bg-neutral-50 transition-colors active:scale-95"
                                        >
                                            Hubungi WhatsApp
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* LIGHTBOX GALLERY MODAL */}
            <AnimatePresence>
                {lightboxOpen && sortedMedia.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col select-none"
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        {/* Lightbox Header */}
                        <div className="h-20 px-6 flex items-center justify-between text-white shrink-0">
                            <div className="font-medium tracking-widest text-sm text-white/70">
                                {lightboxIndex + 1} / {sortedMedia.length} FOTO
                            </div>
                            <button 
                                onClick={() => setLightboxOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-8 h-8" />
                            </button>
                        </div>

                        {/* Lightbox Main Content */}
                        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                            {/* Previous Button */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); prevMedia(); }}
                                className="absolute left-4 md:left-8 z-10 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
                            >
                                <ChevronLeft className="w-8 h-8" />
                            </button>

                            {/* Active Image/Video */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={lightboxIndex}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="w-full h-full flex items-center justify-center p-4 md:p-12"
                                >
                                    {activeLightboxMedia.type === 'IMAGE' ? (
                                        <img 
                                            src={activeLightboxMedia.public_path} 
                                            alt="Gallery" 
                                            draggable="false"
                                            className="max-w-full max-h-full object-contain pointer-events-none"
                                        />
                                    ) : (
                                        <video 
                                            src={activeLightboxMedia.public_path} 
                                            controls
                                            className="max-w-full max-h-full"
                                        />
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* Next Button */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); nextMedia(); }}
                                className="absolute right-4 md:right-8 z-10 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
                            >
                                <ChevronRight className="w-8 h-8" />
                            </button>
                        </div>

                        {/* Lightbox Footer (Optional Thumbnails) */}
                        <div className="h-24 md:h-32 p-4 flex items-center justify-center gap-2 overflow-x-auto shrink-0 pb-8">
                            {sortedMedia.map((media, idx) => (
                                <button
                                    key={media.id}
                                    onClick={() => setLightboxIndex(idx)}
                                    className={`relative h-full aspect-[4/3] rounded-lg overflow-hidden shrink-0 transition-all duration-200 ${
                                        lightboxIndex === idx ? 'border-2 border-white scale-105 opacity-100 z-10' : 'opacity-50 hover:opacity-100 border border-transparent'
                                    }`}
                                >
                                    {media.type === 'IMAGE' ? (
                                        <img src={media.public_path} className="w-full h-full object-cover" alt="Thumb" draggable="false" />
                                    ) : (
                                        <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-white/50">
                                            <VideoIcon className="w-5 h-5" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </PublicLayout>
    );
}
