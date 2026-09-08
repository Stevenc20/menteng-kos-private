import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { useForm, router } from '@inertiajs/react';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
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

interface Property {
    id: number;
    name: string;
    type: 'ROOM' | 'KIOSK';
    normal_price: string;
    status: string;
}

interface PropertiesProps {
    properties: Property[];
}

export default function Properties({ properties }: PropertiesProps) {
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    
    const { data, setData, post, put, processing, reset, errors, clearErrors } = useForm({
        name: '',
        type: 'ROOM',
        normal_price: '',
        status: 'AVAILABLE'
    });

    const openAddModal = () => {
        setEditingId(null);
        reset();
        clearErrors();
        setShowModal(true);
    };

    const openEditModal = (prop: Property) => {
        setEditingId(prop.id);
        setData({
            name: prop.name,
            type: prop.type,
            normal_price: prop.normal_price,
            status: prop.status
        });
        clearErrors();
        setShowModal(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            put(`/admin/properties/${editingId}`, {
                onSuccess: () => {
                    setShowModal(false);
                    reset();
                    toast.success('Properti berhasil diperbarui');
                },
                onError: () => toast.error('Gagal memperbarui properti')
            });
        } else {
            post('/admin/properties', {
                onSuccess: () => {
                    setShowModal(false);
                    reset();
                    toast.success('Properti berhasil ditambahkan');
                },
                onError: () => toast.error('Gagal menyimpan properti')
            });
        }
    };

    const deleteProperty = (id: number) => {
        if (confirm('Apakah Anda yakin ingin menghapus properti ini?')) {
            router.delete(`/admin/properties/${id}`, {
                onSuccess: () => toast.success('Properti berhasil dihapus'),
                onError: () => toast.error('Gagal menghapus properti')
            });
        }
    };

    return (
        <AdminLayout title="Kelola Properti">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#1A1A18]">Properti</h1>
                    <p className="text-[14px] md:text-[15px] text-[#6B6B67] mt-1.5">Kelola data kamar kos dan kios komersial.</p>
                </div>
                <AdminButton onClick={openAddModal}>
                    + Tambah Properti
                </AdminButton>
            </div>

            <div className="bg-white border border-[#E8E7E3] rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-[#F7F7F5] text-[#6B6B67] border-b border-[#E8E7E3]">
                        <tr>
                            <th className="px-6 py-4 font-medium">Nama Unit</th>
                            <th className="px-6 py-4 font-medium">Tipe</th>
                            <th className="px-6 py-4 font-medium">Harga Normal</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium w-24">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E7E3]">
                        {properties.map((prop) => (
                            <tr key={prop.id} className="hover:bg-[#F7F7F5] transition-colors">
                                <td className="px-6 py-4 font-medium text-[#1A1A18]">{prop.name}</td>
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
                                            title="Edit"
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
                        ))}
                        {properties.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-[#6B6B67]">Belum ada properti yang ditambahkan.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <AdminModal 
                isOpen={showModal} 
                onClose={() => !processing && setShowModal(false)}
                maxWidth="sm"
            >
                <form onSubmit={submit}>
                    <AdminModalHeader 
                        title={editingId ? "Edit Properti" : "Tambah Properti Baru"} 
                        onClose={() => !processing && setShowModal(false)}
                    />
                    
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

                            {editingId && (
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
                        <AdminButton 
                            type="button" 
                            variant="secondary" 
                            onClick={() => setShowModal(false)}
                            disabled={processing}
                        >
                            Batal
                        </AdminButton>
                        <AdminButton 
                            type="submit" 
                            isLoading={processing}
                        >
                            {editingId ? "Simpan Perubahan" : "Simpan Properti"}
                        </AdminButton>
                    </AdminModalFooter>
                </form>
            </AdminModal>
        </AdminLayout>
    );
}
