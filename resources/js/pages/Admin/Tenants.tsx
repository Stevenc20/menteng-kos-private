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
    DateInput, 
    CurrencyInput 
} from '@/components/admin/AdminForm';
import { AdminButton } from '@/components/admin/AdminButton';

interface Tenancy {
    id: number;
    agreed_price: string;
    move_in_date: string;
    status: string;
    user: { name: string; email: string };
    property: { name: string };
}

interface Property {
    id: number;
    name: string;
    normal_price: string;
}

interface TenantsProps {
    tenancies: Tenancy[];
    availableProperties: Property[];
}

export default function Tenants({ tenancies, availableProperties }: TenantsProps) {
    const [showModal, setShowModal] = useState(false);
    
    const { data, setData, post, processing, reset, errors } = useForm({
        email: '',
        property_id: '',
        agreed_price: '',
        move_in_date: ''
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/tenants/invite', {
            onSuccess: () => {
                setShowModal(false);
                reset();
                toast.success('Undangan berhasil dibuat', {
                    description: 'Calon penghuni dapat login menggunakan akun Google yang telah didaftarkan.'
                });
            },
            onError: () => {
                toast.error('Gagal mengirim undangan', {
                    description: 'Periksa kembali formulir untuk pesan error spesifik.'
                });
            }
        });
    };

    const selectedProperty = availableProperties.find(p => p.id.toString() === data.property_id);

    return (
        <AdminLayout title="Tenant & Undangan">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#1A1A18]">Manajemen Tenant</h1>
                    <p className="text-[14px] md:text-[15px] text-[#6B6B67] mt-1.5">Undang calon penghuni dan pantau status siklus sewa mereka.</p>
                </div>
                <AdminButton onClick={() => setShowModal(true)}>
                    + Buat Undangan
                </AdminButton>
            </div>

            <div className="bg-white border border-[#E8E7E3] rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-[#F7F7F5] text-[#6B6B67] border-b border-[#E8E7E3]">
                        <tr>
                            <th className="px-6 py-4 font-medium">Email / Akun</th>
                            <th className="px-6 py-4 font-medium">Unit</th>
                            <th className="px-6 py-4 font-medium">Harga Deal</th>
                            <th className="px-6 py-4 font-medium">Tgl Masuk</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E7E3]">
                        {tenancies.map((t) => (
                            <tr key={t.id} className="hover:bg-[#F7F7F5] transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-[#1A1A18]">{t.user.name}</div>
                                    <div className="text-[#6B6B67]">{t.user.email}</div>
                                </td>
                                <td className="px-6 py-4 font-medium text-[#1A1A18]">{t.property.name}</td>
                                <td className="px-6 py-4 text-[#6B6B67]">Rp {Number(t.agreed_price).toLocaleString('id-ID')}</td>
                                <td className="px-6 py-4 text-[#6B6B67]">{t.move_in_date}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 text-[12px] font-medium rounded-full ${
                                        t.status === 'INVITED' ? 'bg-[#F3E8FF] text-[#6B21A8]' :
                                        t.status === 'ACTIVE' ? 'bg-[#ECFDF5] text-[#047857]' :
                                        'bg-[#F3F4F6] text-[#374151]'
                                    }`}>
                                        {t.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {tenancies.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-[#6B6B67]">Belum ada tenant atau undangan.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <AdminModal 
                isOpen={showModal} 
                onClose={() => !processing && setShowModal(false)}
                maxWidth="md"
            >
                <form onSubmit={submit}>
                    <AdminModalHeader 
                        title="Undang Calon Penghuni" 
                        description="Masukkan data penghuni yang telah menyetujui unit dan harga sewa bersama pengelola."
                        onClose={() => !processing && setShowModal(false)}
                    />
                    
                    <AdminModalContent>
                        <FormSection title="Informasi Akun" />
                        <div className="mb-5">
                            <FormLabel htmlFor="email">Email Google Calon Penghuni</FormLabel>
                            <TextInput 
                                id="email"
                                type="email" 
                                placeholder="nama@gmail.com"
                                value={data.email} 
                                onChange={e => setData('email', e.target.value)}
                                required
                            />
                            <FormHelper>Gunakan alamat Gmail yang akan digunakan tenant untuk login.</FormHelper>
                            <FormError>{errors.email}</FormError>
                        </div>

                        <FormSection title="Detail Hunian" />
                        <div className="mb-5">
                            <FormLabel htmlFor="property_id">Unit</FormLabel>
                            <SelectInput 
                                id="property_id"
                                value={data.property_id} 
                                onChange={e => setData('property_id', e.target.value)}
                                required
                            >
                                <option value="" disabled>Pilih Unit Tersedia</option>
                                {availableProperties.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </SelectInput>
                            {selectedProperty && (
                                <FormHelper className="text-[#1E1E1C] font-medium mt-2">
                                    Harga Normal: Rp {Number(selectedProperty.normal_price).toLocaleString('id-ID')} / bulan
                                </FormHelper>
                            )}
                            <FormError>{errors.property_id}</FormError>
                        </div>

                        <FormSection title="Kesepakatan Sewa" />
                        <div className="mb-5">
                            <FormLabel htmlFor="agreed_price">Harga Deal Bulanan</FormLabel>
                            <CurrencyInput 
                                id="agreed_price"
                                value={data.agreed_price} 
                                onChange={val => setData('agreed_price', val)}
                                required
                                placeholder="0"
                            />
                            {selectedProperty && data.agreed_price && (
                                <div className="mt-3 p-3 bg-neutral-50 border border-neutral-100 rounded-lg text-sm">
                                    <div className="flex justify-between mb-1 text-neutral-500">
                                        <span>Harga Normal</span>
                                        <span>Rp {Number(selectedProperty.normal_price).toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between font-medium">
                                        <span>Harga Deal</span>
                                        <span>Rp {Number(data.agreed_price).toLocaleString('id-ID')}</span>
                                    </div>
                                </div>
                            )}
                            <FormError>{errors.agreed_price}</FormError>
                        </div>

                        <FormSection title="Rencana Check-in" />
                        <div className="mb-2">
                            <FormLabel htmlFor="move_in_date">Tanggal Rencana Masuk</FormLabel>
                            <DateInput 
                                id="move_in_date"
                                value={data.move_in_date} 
                                onChange={e => setData('move_in_date', e.target.value)}
                                required
                            />
                            <FormHelper>Tanggal ini digunakan sebagai dasar proses onboarding tenant.</FormHelper>
                            <FormError>{errors.move_in_date}</FormError>
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
                            Kirim Undangan
                        </AdminButton>
                    </AdminModalFooter>
                </form>
            </AdminModal>
        </AdminLayout>
    );
}
