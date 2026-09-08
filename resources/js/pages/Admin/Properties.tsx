import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { useForm, router } from '@inertiajs/react';
import { toast } from 'sonner';
import { Pencil, Trash2, Image as ImageIcon, Video as VideoIcon, Star } from 'lucide-react';
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
    media?: PropertyMedia[];
}

interface PropertiesProps {
    properties: Property[];
}

export default function Properties({ properties }: PropertiesProps) {
    const [showModal, setShowModal] = useState(false);
    const [editingProp, setEditingProp] = useState<Property | null>(null);
    
    // Property Form
    const { data, setData, post, put, processing, reset, errors, clearErrors } = useForm({
        name: '',
        type: 'ROOM',
        normal_price: '',
        status: 'AVAILABLE'
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
        setShowModal(true);
    };

    const openEditModal = (prop: Property) => {
        setEditingProp(prop);
        setData({
            name: prop.name,
            type: prop.type,
            normal_price: prop.normal_price,
            status: prop.status
        });
        clearErrors();
        mediaForm.reset();
        setShowModal(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingProp) {
            put(`/admin/properties/${editingProp.id}`, {
                onSuccess: () => {
                    toast.success('Informasi properti berhasil diperbarui');
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
        
        mediaForm.post(`/admin/properties/${editingProp.id}/media`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Media berhasil diunggah');
                mediaForm.reset();
                // Close and reopen to refresh data (or Inertia will auto-refresh props)
            },
            onError: () => toast.error('Gagal mengunggah media')
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

    return (
        <AdminLayout title="Kelola Properti">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#1A1A18]">Properti</h1>
                    <p className="text-[14px] md:text-[15px] text-[#6B6B67] mt-1.5">Kelola data kamar kos, media galeri publik, dan kios komersial.</p>
                </div>
                <AdminButton onClick={openAddModal}>
                    + Tambah Properti
                </AdminButton>
            </div>

            <div className="bg-white border border-[#E8E7E3] rounded-2xl overflow-hidden shadow-sm">
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
                                            <div className="w-16 h-12 rounded-md overflow-hidden border border-[#E8E7E3]">
                                                <img src={cover.public_path} className="w-full h-full object-cover" alt="Cover" />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-12 bg-[#F7F7F5] rounded-md border border-[#E8E7E3] flex items-center justify-center text-[#8A8A84]">
                                                <ImageIcon className="w-5 h-5" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-[#1A1A18]">
                                        {prop.name}
                                        <div className="text-[12px] text-[#8A8A84] mt-0.5 font-normal">
                                            {prop.media?.length || 0} media
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-[#6B6B67]">{prop.type === 'ROOM' ? 'Kamar Kos' : 'Kios'}</td>
                                    <td className="px-6 py-4 text-[#6B6B67]">
                                        Rp {Number(prop.normal_price).toLocaleString('id-ID')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 text-[12px] font-medium rounded-full ${
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
                                                className="p-1.5 text-[#6B6B67] hover:text-[#1A1A18] hover:bg-[#F7F7F5] rounded-md transition-colors"
                                                title="Edit & Media"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => deleteProperty(prop.id)}
                                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
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

            <AdminModal 
                isOpen={showModal} 
                onClose={() => !processing && setShowModal(false)}
                maxWidth={editingProp ? "3xl" : "sm"}
            >
                <div className={editingProp ? "grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-[#E8E7E3]" : ""}>
                    {/* LEFT COLUMN: Info */}
                    <div className="flex flex-col h-full">
                        <AdminModalHeader 
                            title={editingProp ? "Informasi Properti" : "Tambah Properti Baru"} 
                            onClose={!editingProp ? () => !processing && setShowModal(false) : undefined}
                        />
                        <form onSubmit={submit} className="flex flex-col flex-1">
                            <AdminModalContent>
                                <div className="space-y-5 py-2">
                                    <div>
                                        <FormLabel htmlFor="name">Nama Unit</FormLabel>
                                        <TextInput 
                                            id="name"
                                            type="text" 
                                            placeholder="Misal: Kamar 01"
                                            value={data.name} 
                                            onChange={e => setData('name', e.target.value)}
                                            required
                                        />
                                        <FormError>{errors.name}</FormError>
                                    </div>
                                    
                                    <div>
                                        <FormLabel htmlFor="type">Tipe Properti</FormLabel>
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

                                    {editingProp && (
                                        <div>
                                            <FormLabel htmlFor="status">Status</FormLabel>
                                            <SelectInput 
                                                id="status"
                                                value={data.status} 
                                                onChange={e => setData('status', e.target.value as any)}
                                            >
                                                <option value="AVAILABLE">Tersedia (AVAILABLE)</option>
                                                <option value="OCCUPIED">Terisi (OCCUPIED)</option>
                                                <option value="MAINTENANCE">Perbaikan (MAINTENANCE)</option>
                                            </SelectInput>
                                            <FormError>{errors.status}</FormError>
                                        </div>
                                    )}
                                    
                                    <div>
                                        <FormLabel htmlFor="normal_price">Harga Normal Bulanan</FormLabel>
                                        <CurrencyInput 
                                            id="normal_price"
                                            value={data.normal_price} 
                                            onChange={val => setData('normal_price', val)}
                                            required
                                            placeholder="0"
                                        />
                                        <FormError>{errors.normal_price}</FormError>
                                    </div>
                                </div>
                            </AdminModalContent>
                            <AdminModalFooter>
                                {!editingProp && (
                                    <AdminButton 
                                        type="button" 
                                        variant="secondary" 
                                        onClick={() => setShowModal(false)}
                                    >
                                        Batal
                                    </AdminButton>
                                )}
                                <AdminButton type="submit" isLoading={processing}>
                                    {editingProp ? "Simpan Perubahan" : "Simpan Properti"}
                                </AdminButton>
                            </AdminModalFooter>
                        </form>
                    </div>

                    {/* RIGHT COLUMN: Media (Only for editing) */}
                    {editingProp && (
                        <div className="flex flex-col h-full bg-[#FAFAFA]">
                            <AdminModalHeader 
                                title="Media Galeri Publik" 
                                onClose={() => !mediaForm.processing && setShowModal(false)}
                            />
                            <div className="p-6 flex-1 overflow-y-auto">
                                {/* Upload Form */}
                                <form onSubmit={uploadMedia} className="bg-white p-4 rounded-xl border border-[#E8E7E3] shadow-sm mb-6">
                                    <div className="space-y-4">
                                        <div>
                                            <FormLabel>Upload Foto (Multiple)</FormLabel>
                                            <input 
                                                type="file" 
                                                multiple
                                                accept="image/*"
                                                onChange={e => mediaForm.setData('photos', Array.from(e.target.files || []))}
                                                className="block w-full text-sm text-[#6B6B67] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1A1A18] file:text-white hover:file:bg-[#333333] transition-colors cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <FormLabel>Upload Video Tour (Optional)</FormLabel>
                                            <input 
                                                type="file" 
                                                accept="video/*"
                                                onChange={e => mediaForm.setData('video', e.target.files?.[0] || null)}
                                                className="block w-full text-sm text-[#6B6B67] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#F7F7F5] file:text-[#1A1A18] hover:file:bg-[#E8E7E3] transition-colors cursor-pointer"
                                            />
                                        </div>
                                        <AdminButton 
                                            type="submit" 
                                            disabled={mediaForm.data.photos.length === 0 && !mediaForm.data.video}
                                            isLoading={mediaForm.processing}
                                            className="w-full"
                                        >
                                            Upload Media
                                        </AdminButton>
                                    </div>
                                </form>

                                {/* Media Grid */}
                                <div>
                                    <h4 className="text-[14px] font-semibold text-[#1A1A18] mb-3">Galeri Tersimpan</h4>
                                    {(!editingProp.media || editingProp.media.length === 0) ? (
                                        <div className="text-center py-8 text-[#8A8A84] text-[13px] bg-white rounded-xl border border-dashed border-[#E8E7E3]">
                                            Belum ada media. Upload foto kamar untuk menampilkannya di halaman publik.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {editingProp.media.map(media => (
                                                <div key={media.id} className="relative group rounded-lg overflow-hidden border border-[#E8E7E3] aspect-[4/3] bg-white">
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
                                                                onClick={() => setCover(media.id)}
                                                                className="p-1.5 bg-white text-[#1A1A18] rounded hover:bg-neutral-200 transition-colors"
                                                                title="Jadikan Cover"
                                                            >
                                                                <Star className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button 
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
                            </div>
                        </div>
                    )}
                </div>
            </AdminModal>
        </AdminLayout>
    );
}
