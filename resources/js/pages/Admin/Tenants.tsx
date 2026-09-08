import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { useForm } from '@inertiajs/react';

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
            },
        });
    };

    return (
        <AdminLayout title="Tenant & Undangan">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manajemen Tenant</h1>
                    <p className="text-neutral-500 mt-1">Undang calon penghuni dan pantau status siklus sewa mereka.</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-neutral-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
                >
                    + Buat Undangan
                </button>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                        <tr>
                            <th className="px-6 py-4 font-medium">Email / Akun</th>
                            <th className="px-6 py-4 font-medium">Unit</th>
                            <th className="px-6 py-4 font-medium">Harga Deal</th>
                            <th className="px-6 py-4 font-medium">Tgl Masuk</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                        {tenancies.map((t) => (
                            <tr key={t.id} className="hover:bg-neutral-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-neutral-900">{t.user.name}</div>
                                    <div className="text-neutral-500">{t.user.email}</div>
                                </td>
                                <td className="px-6 py-4 font-medium">{t.property.name}</td>
                                <td className="px-6 py-4 text-neutral-600">Rp {Number(t.agreed_price).toLocaleString('id-ID')}</td>
                                <td className="px-6 py-4 text-neutral-600">{t.move_in_date}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                        t.status === 'INVITED' ? 'bg-purple-100 text-purple-800' :
                                        t.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                        'bg-neutral-100 text-neutral-800'
                                    }`}>
                                        {t.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {tenancies.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">Belum ada tenant atau undangan.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Invite Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-neutral-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-4">Undang Calon Penghuni</h2>
                        <form onSubmit={submit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Email Google Calon Penghuni</label>
                                <input 
                                    type="email" value={data.email} onChange={e => setData('email', e.target.value)}
                                    className="w-full border-neutral-300 rounded-lg shadow-sm" required
                                />
                                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Pilih Unit</label>
                                <select 
                                    value={data.property_id} onChange={e => setData('property_id', e.target.value)} 
                                    className="w-full border-neutral-300 rounded-lg shadow-sm" required
                                >
                                    <option value="" disabled>-- Pilih Unit Tersedia --</option>
                                    {availableProperties.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} (Harga Normal: Rp {Number(p.normal_price).toLocaleString('id-ID')})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Harga Deal (Hasil Negosiasi)</label>
                                <input 
                                    type="number" value={data.agreed_price} onChange={e => setData('agreed_price', e.target.value)}
                                    className="w-full border-neutral-300 rounded-lg shadow-sm" required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Rencana Tanggal Masuk (Move-in)</label>
                                <input 
                                    type="date" value={data.move_in_date} onChange={e => setData('move_in_date', e.target.value)}
                                    className="w-full border-neutral-300 rounded-lg shadow-sm" required
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Batal</button>
                                <button type="submit" disabled={processing} className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50">
                                    Kirim Undangan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
