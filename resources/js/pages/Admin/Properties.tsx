import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import { 
    AdminModal, 
    AdminModalHeader, 
    AdminModalContent, 
    AdminModalFooter 
} from '@/components/admin/AdminModal';
import { 
    FormSection, 
    FormLabel, 
    FormHelper, 
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
    
    const { data, setData, post, processing, reset, errors } = useForm({
        name: '',
        type: 'ROOM',
        normal_price: '',
        status: 'AVAILABLE'
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/properties', {
            onSuccess: () => {
                setShowModal(false);
                reset();
                toast.success('Properti berhasil ditambahkan');
            },
            onError: () => {
                toast.error('Gagal menyimpan properti');
            }
        });
    };

    return (
        <AdminLayout title="Kelola Properti">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#1A1A18]">Properti</h1>
                    <p className="text-[14px] md:text-[15px] text-[#6B6B67] mt-1.5">Kelola data kamar kos dan kios komersial.</p>
                </div>
                <AdminButton onClick={() => setShowModal(true)}>
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
                            </tr>
                        ))}
                        {properties.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-[#6B6B67]">Belum ada properti yang ditambahkan.</td>
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
                        title="Tambah Properti Baru" 
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
                            Simpan Properti
                        </AdminButton>
                    </AdminModalFooter>
                </form>
            </AdminModal>
        </AdminLayout>
    );
}
