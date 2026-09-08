import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { useForm } from '@inertiajs/react';

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
            },
        });
    };

    return (
        <AdminLayout title="Kelola Properti">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Properti</h1>
                    <p className="text-neutral-500 mt-1">Kelola data kamar kos dan kios komersial.</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-neutral-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
                >
                    + Tambah Properti
                </button>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                        <tr>
                            <th className="px-6 py-4 font-medium">Nama Unit</th>
                            <th className="px-6 py-4 font-medium">Tipe</th>
                            <th className="px-6 py-4 font-medium">Harga Normal</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                        {properties.map((prop) => (
                            <tr key={prop.id} className="hover:bg-neutral-50 transition-colors">
                                <td className="px-6 py-4 font-medium">{prop.name}</td>
                                <td className="px-6 py-4 text-neutral-600">{prop.type}</td>
                                <td className="px-6 py-4 text-neutral-600">
                                    Rp {Number(prop.normal_price).toLocaleString('id-ID')}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                        prop.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' :
                                        prop.status === 'OCCUPIED' ? 'bg-blue-100 text-blue-800' :
                                        'bg-amber-100 text-amber-800'
                                    }`}>
                                        {prop.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {properties.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">Belum ada properti yang ditambahkan.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Simple Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-neutral-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-4">Tambah Properti Baru</h2>
                        <form onSubmit={submit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nama Unit (Misal: Kamar 01)</label>
                                <input 
                                    type="text" value={data.name} onChange={e => setData('name', e.target.value)}
                                    className="w-full border-neutral-300 rounded-lg shadow-sm" required
                                />
                                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Tipe</label>
                                <select value={data.type} onChange={e => setData('type', e.target.value as any)} className="w-full border-neutral-300 rounded-lg shadow-sm">
                                    <option value="ROOM">Kamar Kos</option>
                                    <option value="KIOSK">Kios</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Harga Normal (Rp)</label>
                                <input 
                                    type="number" value={data.normal_price} onChange={e => setData('normal_price', e.target.value)}
                                    className="w-full border-neutral-300 rounded-lg shadow-sm" required
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Batal</button>
                                <button type="submit" disabled={processing} className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50">
                                    Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
