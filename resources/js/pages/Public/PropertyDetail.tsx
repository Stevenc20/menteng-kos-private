import PublicLayout from '@/layouts/PublicLayout';
import { Link } from '@inertiajs/react';
import { ArrowLeft, Check, Video as VideoIcon } from 'lucide-react';
import { useState } from 'react';

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

    const [activeMedia, setActiveMedia] = useState<PropertyMedia | null>(sortedMedia[0] || null);

    // Dummy facilities for now (to be dynamic later)
    const facilities = property.type === 'ROOM' ? [
        'AC (Air Conditioner)',
        'WiFi Berkecepatan Tinggi',
        'Kamar Mandi Dalam',
        'Kasur & Bantal',
        'Lemari Pakaian',
        'Meja & Kursi Kerja',
        'Listrik Token',
    ] : [
        'Rolling Door',
        'Meteran Listrik Sendiri',
        'Akses Depan Jalan',
        'Lahan Parkir'
    ];

    const generateWhatsAppLink = () => {
        // We use import.meta.env for client side if available, else fallback
        const waNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '6281234567890';
        const text = `Halo Admin Menteng Kos Private,\n\nSaya tertarik dengan unit berikut:\n\nUnit: ${property.name}\nTipe: ${property.type === 'ROOM' ? 'Kamar Kos' : 'Kios'}\nHarga tertera: ${property.normal_price ? formatPrice(property.normal_price) : '-'}/bulan\n\nSaya ingin menanyakan ketersediaan, mengajukan harga, dan menjadwalkan survey.\n\nNama:\nTanggal rencana masuk:\n`;
        return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
    };

    return (
        <PublicLayout title={`${property.name} | Menteng Kos Private`}>
            
            <div className="bg-[#FAFAFA] min-h-screen pt-24 pb-16">
                <div className="container mx-auto px-6 lg:px-12 max-w-6xl">
                    
                    {/* Header */}
                    <div className="mb-8">
                        <Link href="/#rooms" className="inline-flex items-center text-[#6B6B67] hover:text-[#1A1A18] font-medium transition-colors mb-4">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Ketersediaan Unit
                        </Link>
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div>
                                <h1 className="text-3xl md:text-5xl font-bold text-[#1A1A18] tracking-tight">{property.name}</h1>
                                <p className="text-[#6B6B67] text-lg mt-2">{property.type === 'ROOM' ? 'Kamar Kos Eksklusif' : 'Kios Komersial'}</p>
                            </div>
                            <div>
                                <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full border ${
                                    property.status === 'AVAILABLE' ? 'bg-[#ECFDF5] text-[#047857] border-[#047857]/20' :
                                    'bg-[#E8E7E3] text-[#6B6B67] border-[#E8E7E3]'
                                }`}>
                                    {property.status === 'AVAILABLE' ? 'TERSEDIA' : property.status === 'OCCUPIED' ? 'TERISI' : property.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Gallery Section */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Main Active Media */}
                            <div 
                                className="w-full aspect-[4/3] bg-[#E8E7E3] rounded-2xl overflow-hidden border border-[#E8E7E3] select-none"
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                {activeMedia ? (
                                    activeMedia.type === 'IMAGE' ? (
                                        <img 
                                            src={activeMedia.public_path} 
                                            alt={property.name}
                                            draggable="false"
                                            className="w-full h-full object-cover pointer-events-none"
                                        />
                                    ) : (
                                        <video 
                                            src={activeMedia.public_path} 
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

                            {/* Thumbnail Grid */}
                            {sortedMedia.length > 1 && (
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                                    {sortedMedia.map((media) => (
                                        <button
                                            key={media.id}
                                            onClick={() => setActiveMedia(media)}
                                            className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${
                                                activeMedia?.id === media.id ? 'border-[#1A1A18]' : 'border-transparent hover:border-[#E8E7E3]'
                                            }`}
                                            onContextMenu={(e) => e.preventDefault()}
                                        >
                                            {media.type === 'IMAGE' ? (
                                                <img 
                                                    src={media.public_path} 
                                                    alt="Thumbnail"
                                                    draggable="false"
                                                    className="w-full h-full object-cover select-none pointer-events-none"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-[#1A1A18] flex items-center justify-center text-white">
                                                    <VideoIcon className="w-6 h-6" />
                                                </div>
                                            )}
                                            {/* Subtle overlay for inactive */}
                                            {activeMedia?.id !== media.id && (
                                                <div className="absolute inset-0 bg-white/30" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Information Sidebar */}
                        <div className="space-y-6">
                            {/* Pricing Card */}
                            <div className="bg-white p-8 rounded-2xl border border-[#E8E7E3] shadow-sm">
                                <p className="text-[#8A8A84] text-sm uppercase tracking-wider font-semibold mb-2">Harga Normal</p>
                                <div className="flex items-baseline gap-2 mb-8">
                                    <span className="text-4xl font-bold text-[#1A1A18] tracking-tight">
                                        {property.normal_price ? formatPrice(property.normal_price) : '-'}
                                    </span>
                                    <span className="text-[#6B6B67] font-medium">/ bln</span>
                                </div>

                                {isOccupied ? (
                                    <div className="p-4 bg-[#F7F7F5] rounded-xl border border-[#E8E7E3] text-center text-[#6B6B67]">
                                        Unit ini sedang disewa.
                                    </div>
                                ) : (
                                    <a 
                                        href={generateWhatsAppLink()}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full block text-center px-6 py-4 bg-[#1A1A18] text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors shadow-lg"
                                    >
                                        Ajukan Harga & Jadwalkan Survey
                                    </a>
                                )}
                            </div>

                            {/* Facilities Card */}
                            <div className="bg-white p-8 rounded-2xl border border-[#E8E7E3] shadow-sm">
                                <h3 className="text-xl font-bold text-[#1A1A18] mb-6">Fasilitas Unit</h3>
                                <ul className="space-y-4">
                                    {facilities.map((fac, idx) => (
                                        <li key={idx} className="flex items-start text-[#6B6B67]">
                                            <div className="mt-0.5 mr-3 p-1 bg-[#F7F7F5] rounded-full text-[#1A1A18]">
                                                <Check className="w-3 h-3 stroke-[3]" />
                                            </div>
                                            <span>{fac}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
}
