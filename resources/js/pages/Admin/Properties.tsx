import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, X, Pencil, Trash2, Building2, Store, Check, Video, Camera, ArrowLeft, Image as ImageIcon, Video as VideoIcon, Star } from 'lucide-react';
import { compressImage } from '@/lib/image-compression';
import { 
    AdminModal, 
    AdminModalHeader, 
    AdminModalContent, 
    AdminModalFooter 
} from '@/components/admin/AdminModal';
import { 
    FormLabel, 
    FormError, 
    TextInput, 
    SelectInput, 
    CurrencyInput 
} from '@/components/admin/AdminForm';
import { AdminButton } from '@/components/admin/AdminButton';

interface PropertyMedia {
    id: number;
    property_id: number;
    type: 'IMAGE' | 'VIDEO';
    public_path: string;
    is_cover: boolean;
    sort_order: number;
}

interface Property {
    id: number;
    name: string;
    type: 'ROOM' | 'KIOSK';
    normal_price: string;
    status: string;
    description: string | null;
    facilities: string[] | null;
    media?: PropertyMedia[];
}

interface PropertiesProps {
    properties: Property[];
}

// Preset facilities for easy selection
const PRESET_FACILITIES = [
    'AC (Air Conditioner)',
    'WiFi Berkecepatan Tinggi',
    'Kamar Mandi Dalam',
    'Water Heater',
    'Kasur & Bantal',
    'Lemari Pakaian',
    'Meja & Kursi Kerja',
    'Listrik Token',
    'Dapur Bersama',
    'Area Parkir',
    'CCTV 24 Jam',
    'Rolling Door',
    'Akses Jalan Utama'
];

export default function Properties({ properties }: PropertiesProps) {
    const [showModal, setShowModal] = useState(false);
    const [editingProp, setEditingProp] = useState<Property | null>(null);
    const [customFacility, setCustomFacility] = useState('');
    
    // Property Form
    const { data, setData, post, put, processing, reset, errors, clearErrors } = useForm({
        name: '',
        type: 'ROOM',
        normal_price: '',
        status: 'AVAILABLE',
        description: '',
        facilities: [] as string[]
    });

    // Media Form
    const mediaForm = useForm({
        photos: [] as File[],
        video: null as File | null,
    });

    const openAddModal = () => {
        setEditingProp(null);
        reset();
        clearErrors();
        mediaForm.reset();
        setCustomFacility('');
        setShowModal(true);
    };

    const openEditModal = (prop: Property) => {
        setEditingProp(prop);
        setData({
            name: prop.name,
            type: prop.type,
            normal_price: prop.normal_price,
            status: prop.status,
            description: prop.description || '',
            facilities: prop.facilities || []
        });
        clearErrors();
        mediaForm.reset();
        setCustomFacility('');
        setShowModal(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingProp) {
            put(`/admin/properties/${editingProp.id}`, {
                onSuccess: () => {
                    toast.success('Informasi properti berhasil diperbarui');
                    setShowModal(false);
                },
                onError: () => toast.error('Gagal memperbarui properti')
            });
        } else {
            post('/admin/properties', {
                onSuccess: () => {
                    setShowModal(false);
                    reset();
                    toast.success('Properti berhasil ditambahkan. Silakan edit untuk upload media.');
                },
                onError: () => toast.error('Gagal menyimpan properti')
            });
        }
    };

    const uploadMedia = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProp) return;
        if (!mediaForm.data.photos || mediaForm.data.photos.length === 0) {
            toast.error('Pilih foto terlebih dahulu!');
            return;
        }
        
        mediaForm.post(`/admin/properties/${editingProp.id}/media`, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                toast.success('Media berhasil diunggah');
                mediaForm.reset();
            },
            onError: (errors) => {
                toast.error('Error: ' + JSON.stringify(errors));
            }
        });
    };

    const deleteProperty = (id: number) => {
        if (confirm('Apakah Anda yakin ingin menghapus properti ini? Semua media juga akan terhapus.')) {
            router.delete(`/admin/properties/${id}`, {
                onSuccess: () => toast.success('Properti berhasil dihapus'),
                onError: () => toast.error('Gagal menghapus properti')
            });
        }
    };

    const setCover = (mediaId: number) => {
        if (!editingProp) return;
        router.post(`/admin/properties/${editingProp.id}/media/${mediaId}/cover`, {}, {
            preserveScroll: true,
            onSuccess: () => toast.success('Cover berhasil diubah')
        });
    };

    const deleteMedia = (mediaId: number) => {
        if (!editingProp) return;
        if (confirm('Hapus media ini?')) {
            router.delete(`/admin/properties/${editingProp.id}/media/${mediaId}`, {
                preserveScroll: true,
                onSuccess: () => toast.success('Media dihapus')
            });
        }
    };

    const toggleFacility = (facility: string) => {
        const current = [...data.facilities];
        if (current.includes(facility)) {
            setData('facilities', current.filter(f => f !== facility));
        } else {
            setData('facilities', [...current, facility]);
        }
    };

    const addCustomFacility = () => {
        if (!customFacility.trim()) return;
        if (!data.facilities.includes(customFacility.trim())) {
            setData('facilities', [...data.facilities, customFacility.trim()]);
        }
        setCustomFacility('');
    };

    return (
        <AdminLayout title="Kelola Properti">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1A1A18]">Properti</h1>
                    <p className="text-sm md:text-base text-[#6B6B67] mt-1.5">Kelola data kamar kos, fasilitas, media galeri, dan kios.</p>
                </div>
                <AdminButton onClick={openAddModal} className="w-full sm:w-auto">
                    + Tambah Properti
                </AdminButton>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white border border-[#E8E7E3] rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-[#F7F7F5] text-[#6B6B67] border-b border-[#E8E7E3]">
                        <tr>
                            <th className="px-6 py-4 font-medium">Cover</th>
                            <th className="px-6 py-4 font-medium">Nama Unit</th>
                            <th className="px-6 py-4 font-medium">Tipe</th>
                            <th className="px-6 py-4 font-medium">Harga Normal</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium w-24">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E7E3]">
                        {properties.map((prop) => {
                            const cover = prop.media?.find(m => m.is_cover) || prop.media?.[0];
                            return (
                                <tr key={prop.id} className="hover:bg-[#F7F7F5] transition-colors">
                                    <td className="px-6 py-4">
                                        {cover && cover.type === 'IMAGE' ? (
                                            <div className="w-16 h-12 rounded-lg overflow-hidden border border-[#E8E7E3]">
                                                <img src={cover.public_path} className="w-full h-full object-cover" alt="Cover" />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-12 bg-[#F7F7F5] rounded-lg border border-[#E8E7E3] flex items-center justify-center text-[#8A8A84]">
                                                <ImageIcon className="w-5 h-5" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-[#1A1A18]">
                                        {prop.name}
                                        <div className="text-[12px] text-[#8A8A84] mt-0.5 font-normal">
                                            {prop.facilities?.length || 0} fasilitas • {prop.media?.length || 0} foto
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-[#6B6B67]">{prop.type === 'ROOM' ? 'Kamar Kos' : 'Kios'}</td>
                                    <td className="px-6 py-4 text-[#1A1A18] font-medium">
                                        Rp {Number(prop.normal_price).toLocaleString('id-ID')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                            prop.status === 'AVAILABLE' ? 'bg-[#ECFDF5] text-[#047857]' :
                                            prop.status === 'OCCUPIED' ? 'bg-[#EFF6FF] text-[#1D4ED8]' :
                                            'bg-[#FEF3C7] text-[#B45309]'
                                        }`}>
                                            {prop.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => openEditModal(prop)}
                                                className="p-2 text-[#6B6B67] hover:text-[#1A1A18] hover:bg-neutral-200 rounded-md transition-colors"
                                                title="Edit"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => deleteProperty(prop.id)}
                                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                                                title="Hapus"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {properties.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-[#6B6B67]">Belum ada properti yang ditambahkan.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid grid-cols-1 gap-4">
                {properties.map((prop) => {
                    const cover = prop.media?.find(m => m.is_cover) || prop.media?.[0];
                    return (
                        <div key={prop.id} className="bg-white border border-[#E8E7E3] rounded-xl p-4 shadow-sm flex gap-4">
                            <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-[#E8E7E3] bg-[#F7F7F5] flex items-center justify-center text-[#8A8A84]">
                                {cover && cover.type === 'IMAGE' ? (
                                    <img src={cover.public_path} className="w-full h-full object-cover" alt="Cover" />
                                ) : (
                                    <ImageIcon className="w-6 h-6" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-[#1A1A18] truncate">{prop.name}</h3>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openEditModal(prop)} className="p-1.5 text-[#6B6B67] bg-neutral-100 rounded">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-[#6B6B67]">{prop.type === 'ROOM' ? 'Kamar Kos' : 'Kios'}</p>
                                </div>
                                <div className="flex justify-between items-end mt-2">
                                    <p className="font-semibold text-[#1A1A18] text-sm">Rp {Number(prop.normal_price).toLocaleString('id-ID')}</p>
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                                        prop.status === 'AVAILABLE' ? 'bg-[#ECFDF5] text-[#047857]' :
                                        prop.status === 'OCCUPIED' ? 'bg-[#EFF6FF] text-[#1D4ED8]' :
                                        'bg-[#FEF3C7] text-[#B45309]'
                                    }`}>
                                        {prop.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <AdminModal 
                isOpen={showModal} 
                onClose={() => !processing && setShowModal(false)}
                maxWidth="4xl" // Wider to accommodate side-by-side or large stacked sections
            >
                <div className="flex flex-col h-[85vh] lg:h-auto lg:max-h-[85vh] bg-white">
                    <AdminModalHeader 
                        title={editingProp ? "Edit Properti" : "Tambah Properti Baru"} 
                        onClose={() => !processing && setShowModal(false)}
                    />
                    
                    <div className="flex-1 overflow-y-auto p-0">
                        {/* If not editing, we only show info & facilities. If editing, we show media too. */}
                        <div className={`grid grid-cols-1 ${editingProp ? 'lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x' : ''} divide-[#E8E7E3]`}>
                            
                            {/* LEFT: Info & Facilities */}
                            <div className="p-6 space-y-8">
                                <form id="property-form" onSubmit={submit} className="space-y-6">
                                    {/* SECTION 1: Informasi Unit */}
                                    <section>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-[#1A1A18] mb-4 pb-2 border-b border-[#E8E7E3]">1. Informasi Unit</h3>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <FormLabel htmlFor="name">Nama Unit</FormLabel>
                                                    <TextInput 
                                                        id="name"
                                                        type="text" 
                                                        value={data.name} 
                                                        onChange={e => setData('name', e.target.value)}
                                                        required
                                                    />
                                                    <FormError>{errors.name}</FormError>
                                                </div>
                                                <div>
                                                    <FormLabel htmlFor="type">Tipe</FormLabel>
                                                    <SelectInput 
                                                        id="type"
                                                        value={data.type} 
                                                        onChange={e => setData('type', e.target.value as any)}
                                                    >
                                                        <option value="ROOM">Kamar Kos</option>
                                                        <option value="KIOSK">Kios</option>
                                                    </SelectInput>
                                                    <FormError>{errors.type}</FormError>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <FormLabel htmlFor="normal_price">Harga Normal</FormLabel>
                                                    <CurrencyInput 
                                                        id="normal_price"
                                                        value={data.normal_price} 
                                                        onChange={val => setData('normal_price', val)}
                                                        required
                                                    />
                                                    <FormError>{errors.normal_price}</FormError>
                                                </div>
                                                <div>
                                                    <FormLabel htmlFor="status">Status</FormLabel>
                                                    <SelectInput 
                                                        id="status"
                                                        value={data.status} 
                                                        onChange={e => setData('status', e.target.value as any)}
                                                    >
                                                        <option value="AVAILABLE">Tersedia</option>
                                                        <option value="OCCUPIED">Terisi</option>
                                                        <option value="MAINTENANCE">Perbaikan</option>
                                                    </SelectInput>
                                                    <FormError>{errors.status}</FormError>
                                                </div>
                                            </div>

                                            <div>
                                                <FormLabel htmlFor="description">Deskripsi (Opsional)</FormLabel>
                                                <textarea 
                                                    id="description"
                                                    value={data.description}
                                                    onChange={e => setData('description', e.target.value)}
                                                    className="w-full border-[#E8E7E3] rounded-lg shadow-sm focus:border-[#1A1A18] focus:ring-[#1A1A18] text-sm"
                                                    rows={3}
                                                    placeholder="Ceritakan keunggulan unit ini..."
                                                ></textarea>
                                            </div>
                                        </div>
                                    </section>

                                    {/* SECTION 2: Fasilitas */}
                                    <section>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-[#1A1A18] mb-4 pb-2 border-b border-[#E8E7E3]">2. Fasilitas</h3>
                                        
                                        <div className="mb-4 flex flex-wrap gap-2">
                                            {PRESET_FACILITIES.map(fac => {
                                                const isSelected = data.facilities.includes(fac);
                                                return (
                                                    <button
                                                        key={fac}
                                                        type="button"
                                                        onClick={() => toggleFacility(fac)}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                                                            isSelected 
                                                            ? 'bg-[#1A1A18] text-white border-[#1A1A18]' 
                                                            : 'bg-white text-[#6B6B67] border-[#E8E7E3] hover:border-[#1A1A18]'
                                                        }`}
                                                    >
                                                        {fac}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Custom Facilities rendered alongside presets */}
                                        <div className="mb-4 flex flex-wrap gap-2">
                                            {data.facilities.filter(f => !PRESET_FACILITIES.includes(f)).map(fac => (
                                                <button
                                                    key={fac}
                                                    type="button"
                                                    onClick={() => toggleFacility(fac)}
                                                    className="px-3 py-1.5 text-xs font-medium rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1 group"
                                                >
                                                    {fac} <X className="w-3 h-3 group-hover:text-red-500" />
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex gap-2 mt-4">
                                            <TextInput 
                                                type="text"
                                                value={customFacility}
                                                onChange={e => setCustomFacility(e.target.value)}
                                                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addCustomFacility())}
                                                placeholder="Tambah fasilitas kustom..."
                                                className="flex-1 text-sm"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={addCustomFacility}
                                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-[#1A1A18] rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Tambah
                                            </button>
                                        </div>
                                    </section>
                                </form>
                            </div>

                            {/* RIGHT: Media (Only for editing) */}
                            {editingProp ? (
                                <div className="p-6 bg-[#FAFAFA] flex flex-col space-y-6">
                                    <section>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-[#1A1A18] mb-4 pb-2 border-b border-[#E8E7E3]">3. Foto & Media Unit</h3>
                                        
                                        <form onSubmit={uploadMedia} className="bg-white p-4 rounded-xl border border-[#E8E7E3] shadow-sm mb-6">
                                            <div className="space-y-4">
                                                <div>
                                                    <FormLabel>Upload Foto (Bisa lebih dari 1)</FormLabel>
                                                    <input 
                                                        type="file" 
                                                        multiple
                                                        accept="image/*"
                                                        onChange={async (e) => {
                                                            const files = Array.from(e.target.files || []);
                                                            if (files.length === 0) return;
                                                            
                                                            try {
                                                                const compressedFiles = await Promise.all(
                                                                    files.map(f => compressImage(f, 1600, 0.8))
                                                                );
                                                                mediaForm.setData('photos', compressedFiles);
                                                            } catch (error) {
                                                                console.error('Compression failed', error);
                                                            }
                                                        }}
                                                        className="block w-full text-sm text-[#6B6B67] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1A1A18] file:text-white hover:file:bg-[#333333] transition-colors cursor-pointer"
                                                    />
                                                </div>
                                                <AdminButton 
                                                    type="submit" 
                                                    disabled={mediaForm.data.photos.length === 0}
                                                    isLoading={mediaForm.processing}
                                                    className="w-full"
                                                >
                                                    Upload Gambar
                                                </AdminButton>
                                            </div>
                                        </form>

                                        {/* Media Grid */}
                                        <div>
                                            <h4 className="text-[13px] font-semibold text-[#6B6B67] mb-3">Galeri Tersimpan</h4>
                                            {(!editingProp.media || editingProp.media.length === 0) ? (
                                                <div className="text-center py-8 text-[#8A8A84] text-[13px] bg-white rounded-xl border border-dashed border-[#E8E7E3]">
                                                    Belum ada foto galeri.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {editingProp.media.map(media => (
                                                        <div key={media.id} className="relative group rounded-lg overflow-hidden border border-[#E8E7E3] aspect-[4/3] bg-white shadow-sm">
                                                            {media.type === 'IMAGE' ? (
                                                                <img src={media.public_path} className="w-full h-full object-cover" alt="Property Media" />
                                                            ) : (
                                                                <div className="w-full h-full flex flex-col items-center justify-center text-[#8A8A84] bg-neutral-100">
                                                                    <VideoIcon className="w-6 h-6 mb-1" />
                                                                    <span className="text-[10px]">Video</span>
                                                                </div>
                                                            )}
                                                            
                                                            {/* Overlays */}
                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                {media.type === 'IMAGE' && !media.is_cover && (
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setCover(media.id)}
                                                                        className="p-1.5 bg-white text-[#1A1A18] rounded hover:bg-neutral-200 transition-colors"
                                                                        title="Jadikan Cover"
                                                                    >
                                                                        <Star className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => deleteMedia(media.id)}
                                                                    className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                                                    title="Hapus"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>

                                                            {media.is_cover && (
                                                                <div className="absolute top-2 left-2 bg-[#1A1A18] text-white text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1">
                                                                    <Star className="w-3 h-3 fill-current" /> Cover
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                </div>
                            ) : (
                                <div className="p-8 hidden lg:flex flex-col items-center justify-center bg-[#FAFAFA] text-center border-l border-[#E8E7E3]">
                                    <ImageIcon className="w-16 h-16 text-[#E8E7E3] mb-4" />
                                    <p className="text-[#6B6B67] text-sm">Simpan informasi properti terlebih dahulu untuk mengelola Foto Galeri.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Fixed Footer */}
                    <AdminModalFooter className="shrink-0 border-t border-[#E8E7E3]">
                        <AdminButton 
                            type="button" 
                            variant="secondary" 
                            onClick={() => setShowModal(false)}
                        >
                            Tutup
                        </AdminButton>
                        <AdminButton 
                            type="submit" 
                            form="property-form"
                            isLoading={processing}
                        >
                            {editingProp ? "Simpan Perubahan Unit" : "Simpan Properti Baru"}
                        </AdminButton>
                    </AdminModalFooter>
                </div>
            </AdminModal>
        </AdminLayout>
    );
}
