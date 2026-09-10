import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { useForm, router } from '@inertiajs/react';
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
    approval_status: string;
    rejection_reason: string | null;
    created_at: string;
    user: { name: string; email: string };
    property: { name: string; type: string };
}

interface Property {
    id: number;
    name: string;
    normal_price: string;
}

interface Counts {
    total: number;
    pending: number;
    active: number;
    rejected: number;
}

interface TenantsProps {
    tenancies: Tenancy[];
    counts: Counts;
    activeFilter: string;
    availableProperties: Property[];
}

const FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'pending', label: 'Menunggu Approval' },
    { key: 'active', label: 'Aktif' },
    { key: 'rejected', label: 'Perlu Perbaikan / Ditolak' },
];

function badgeInfo(t: Tenancy) {
    if (t.approval_status === 'REJECTED') return { label: 'Perlu Perbaikan', cls: 'bg-red-50 text-red-700' };
    if (t.status === 'PENDING_ADMIN_APPROVAL') return { label: 'Menunggu Approval', cls: 'bg-amber-50 text-amber-800' };
    if (t.status === 'ACTIVE') return { label: 'Aktif', cls: 'bg-emerald-50 text-emerald-700' };
    if (t.status === 'INVITED') return { label: 'Diundang', cls: 'bg-purple-50 text-purple-700' };
    return { label: t.status.replace(/_/g, ' '), cls: 'bg-gray-100 text-gray-600' };
}

export default function Tenants({ tenancies, counts, activeFilter, availableProperties }: TenantsProps) {
    const [showModal, setShowModal] = useState(false);
    const [editTenancy, setEditTenancy] = useState<Tenancy | null>(null);

    // Admin fills the onboarding wizard for these states (data not yet complete).
    const onboardingStates = ['INVITED', 'ONBOARDING_IN_PROGRESS', 'AGREEMENT_PENDING'];
    
    const { data, setData, post, processing, reset, errors } = useForm({
        email: '',
        property_id: '',
        agreed_price: '',
        move_in_date: ''
    });

    const editForm = useForm({
        agreed_price: '',
        move_in_date: '',
        due_day: '',
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

    const selectedProperty = availableProperties?.find(p => p.id.toString() === data.property_id);

    const setFilter = (key: string) => {
        router.get('/admin/tenants', key === 'all' ? {} : { status: key }, { preserveState: true, replace: true });
    };

    const deleteTenant = (t: Tenancy) => {
        if (!confirm(`Yakin ingin menghapus akun "${t.user?.name}"? Seluruh data tenancy, tagihan, dan dokumen terkait akan dihapus permanen.`)) {
            return;
        }
        router.delete(`/admin/tenants/${t.id}`, {
            onSuccess: () => toast.success('Akun tenant berhasil dihapus'),
            onError: () => toast.error('Gagal menghapus akun tenant'),
        });
    };

    const openEdit = (t: Tenancy) => {
        setEditTenancy(t);
        editForm.setData({
            agreed_price: String(t.agreed_price ?? ''),
            move_in_date: t.move_in_date || '',
            due_day: (t as any).due_day != null ? String((t as any).due_day) : '',
        });
    };

    const submitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTenancy) return;
        editForm.put(`/admin/tenants/${editTenancy.id}/details`, {
            onSuccess: () => {
                setEditTenancy(null);
                toast.success('Data penyewaan berhasil diperbarui');
            },
            onError: () => toast.error('Gagal menyimpan perubahan'),
        });
    };

    const stats = [
        { label: 'Menunggu Approval', value: counts?.pending ?? 0, cls: 'bg-amber-50 border-amber-100 text-amber-800' },
        { label: 'Aktif', value: counts?.active ?? 0, cls: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
        { label: 'Perlu Perbaikan', value: counts?.rejected ?? 0, cls: 'bg-red-50 border-red-100 text-red-700' },
        { label: 'Total Tenant', value: counts?.total ?? 0, cls: 'bg-neutral-50 border-neutral-100 text-neutral-700' },
    ];

    return (
        <AdminLayout title="Tenant & Undangan">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#1A1A18]">Manajemen Tenant</h1>
                    <p className="text-[14px] md:text-[15px] text-[#6B6B67] mt-1.5">Undang calon penghuni, review onboarding, dan pantau status siklus sewa mereka.</p>
                </div>
                <AdminButton onClick={() => setShowModal(true)}>
                    + Buat Undangan
                </AdminButton>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map(s => (
                    <div key={s.label} className={`rounded-2xl border p-5 ${s.cls}`}>
                        <div className="text-3xl font-bold">{s.value}</div>
                        <div className="text-sm font-medium mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap gap-2 mb-6">
                {FILTERS.map(f => {
                    const active = (activeFilter || 'all') === f.key;
                    return (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                                active
                                    ? 'bg-[#1A1A18] text-white border-[#1A1A18]'
                                    : 'bg-white text-[#6B6B67] border-[#E8E7E3] hover:border-[#1A1A18] hover:text-[#1A1A18]'
                            }`}
                        >
                            {f.label}
                            {f.key === 'pending' && (counts?.pending ?? 0) > 0 && (
                                <span className="ml-2 px-1.5 py-0.5 text-[11px] rounded-full bg-amber-400 text-amber-950 font-bold">{counts.pending}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white border border-[#E8E7E3] rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-[#F7F7F5] text-[#6B6B67] border-b border-[#E8E7E3]">
                        <tr>
                            <th className="px-6 py-4 font-medium">Tenant</th>
                            <th className="px-6 py-4 font-medium">Unit</th>
                            <th className="px-6 py-4 font-medium">Harga Deal</th>
                            <th className="px-6 py-4 font-medium">Tgl Masuk</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E7E3]">
                        {tenancies?.map((t) => {
                            const info = badgeInfo(t);
                            const isPending = t.status === 'PENDING_ADMIN_APPROVAL' && t.approval_status !== 'REJECTED';
                            return (
                                <tr key={t.id} className="hover:bg-[#F7F7F5] transition-colors cursor-pointer" onClick={() => router.get(`/admin/tenants/${t.id}`)}>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-[#1A1A18]">{t.user?.name || 'Unknown'}</div>
                                        <div className="text-[#6B6B67]">{t.user?.email || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-[#1A1A18]">{t.property?.name || 'Unknown'}</div>
                                        <div className="text-xs text-[#8A8A84] uppercase tracking-wider">{t.property?.type || ''}</div>
                                    </td>
                                    <td className="px-6 py-4 text-[#6B6B67]">Rp {Number(t.agreed_price).toLocaleString('id-ID')}</td>
                                    <td className="px-6 py-4 text-[#6B6B67]">{t.move_in_date}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 text-[12px] font-medium rounded-full ${info.cls}`}>
                                            {info.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                        {isPending ? (
                                            <button
                                                onClick={() => router.get(`/admin/tenants/${t.id}`)}
                                                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#1A1A18] text-white hover:bg-black transition-colors"
                                            >
                                                Review
                                            </button>
                                         ) : (
                                            <>
                                                {onboardingStates.includes(t.status) && (
                                                    <button
                                                        onClick={() => router.get(`/admin/tenants/${t.id}/onboarding`)}
                                                        className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-[#1A1A18] text-[#1A1A18] hover:bg-[#1A1A18] hover:text-white transition-colors"
                                                    >
                                                        Lanjut Isi Data
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => router.get(`/admin/tenants/${t.id}`)}
                                                    className="px-4 py-1.5 text-xs font-medium rounded-lg border border-[#E8E7E3] text-[#6B6B67] hover:border-[#1A1A18] hover:text-[#1A1A18] transition-colors"
                                                >
                                                    Lihat Detail
                                                </button>
                                                <button
                                                    onClick={() => openEdit(t)}
                                                    className="ml-2 px-4 py-1.5 text-xs font-medium rounded-lg border border-[#E8E7E3] text-[#1A1A18] hover:border-[#1A1A18] transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteTenant(t)}
                                                    className="ml-2 px-4 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                                >
                                                    Hapus
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {tenancies.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-[#6B6B67]">Belum ada tenant atau undangan.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-4">
                {tenancies?.map((t) => {
                    const info = badgeInfo(t);
                    const isPending = t.status === 'PENDING_ADMIN_APPROVAL' && t.approval_status !== 'REJECTED';
                    return (
                        <div key={t.id} className="bg-white border border-[#E8E7E3] rounded-xl p-5 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-[#1A1A18]">{t.user?.name || 'Unknown'}</h3>
                                    <p className="text-sm text-[#6B6B67]">{t.user?.email || '-'}</p>
                                </div>
                                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${info.cls}`}>
                                    {info.label}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-y-3 pt-3 border-t border-[#E8E7E3]">
                                <div>
                                    <p className="text-xs text-[#8A8A84] uppercase tracking-wider font-semibold mb-0.5">Unit</p>
                                    <p className="text-sm font-medium text-[#1A1A18]">{t.property?.name || 'Unknown'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-[#8A8A84] uppercase tracking-wider font-semibold mb-0.5">Tgl Masuk</p>
                                    <p className="text-sm font-medium text-[#1A1A18]">{t.move_in_date}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-xs text-[#8A8A84] uppercase tracking-wider font-semibold mb-0.5">Harga Deal</p>
                                    <p className="text-sm font-bold text-[#1A1A18]">Rp {Number(t.agreed_price).toLocaleString('id-ID')}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => router.get(`/admin/tenants/${t.id}`)}
                                className={`mt-4 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                                    isPending
                                        ? 'bg-[#1A1A18] text-white hover:bg-black'
                                        : 'border border-[#E8E7E3] text-[#6B6B67] hover:text-[#1A1A18]'
                                }`}
                            >
                                {isPending ? 'Review Data' : 'Lihat Detail'}
                            </button>
                            {!isPending && (
                                <>
                                    {onboardingStates.includes(t.status) && (
                                        <button
                                            onClick={() => router.get(`/admin/tenants/${t.id}/onboarding`)}
                                            className="mt-2 w-full py-2.5 rounded-lg text-sm font-semibold border border-[#1A1A18] text-[#1A1A18] hover:bg-[#1A1A18] hover:text-white transition-colors"
                                        >
                                            Lanjut Isi Data Penghuni
                                        </button>
                                    )}
                                    <button
                                        onClick={() => openEdit(t)}
                                        className="mt-2 w-full py-2.5 rounded-lg text-sm font-semibold border border-[#E8E7E3] text-[#1A1A18] hover:border-[#1A1A18] transition-colors"
                                    >
                                        Edit Data
                                    </button>
                                    <button
                                        onClick={() => deleteTenant(t)}
                                        className="mt-2 w-full py-2.5 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        Hapus Akun
                                    </button>
                                </>
                            )}
                        </div>
                    );
                })}
                {tenancies.length === 0 && (
                    <div className="bg-white border border-[#E8E7E3] rounded-xl p-8 text-center text-[#6B6B67] shadow-sm">
                        Belum ada tenant atau undangan.
                    </div>
                )}
            </div>

            <AdminModal 
                isOpen={showModal} 
                onClose={() => !processing && setShowModal(false)}
                maxWidth="md"
            >
                <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
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
                                {availableProperties?.map(p => (
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

            <AdminModal
                isOpen={Boolean(editTenancy)}
                onClose={() => !editForm.processing && setEditTenancy(null)}
                maxWidth="md"
            >
                <form onSubmit={submitEdit} className="flex flex-col flex-1 min-h-0">
                    <AdminModalHeader
                        title="Edit Data Penyewaan"
                        description={editTenancy ? `Perbarui data sewa ${editTenancy.user?.name || ''} (${editTenancy.property?.name || ''}).` : ''}
                        onClose={() => !editForm.processing && setEditTenancy(null)}
                    />
                    <AdminModalContent>
                        <div className="mb-5">
                            <FormLabel>Harga Deal Bulanan (Rp)</FormLabel>
                            <CurrencyInput
                                value={editForm.data.agreed_price}
                                onChange={val => editForm.setData('agreed_price', val)}
                            />
                            <FormError>{editForm.errors.agreed_price}</FormError>
                        </div>
                        <div className="mb-5">
                            <FormLabel>Tanggal Masuk</FormLabel>
                            <DateInput
                                value={editForm.data.move_in_date}
                                onChange={e => editForm.setData('move_in_date', e.target.value)}
                            />
                            <FormError>{editForm.errors.move_in_date}</FormError>
                        </div>
                        <div className="mb-2">
                            <FormLabel>Jatuh Tempo (tanggal setiap bulan)</FormLabel>
                            <TextInput
                                type="number"
                                min={0}
                                max={31}
                                placeholder="0 = akhir bulan"
                                value={editForm.data.due_day}
                                onChange={e => editForm.setData('due_day', e.target.value)}
                            />
                            <FormHelper>Isi 0 untuk jatuh tempo di akhir bulan.</FormHelper>
                            <FormError>{editForm.errors.due_day}</FormError>
                        </div>
                    </AdminModalContent>
                    <AdminModalFooter>
                        <AdminButton type="button" variant="secondary" onClick={() => setEditTenancy(null)} disabled={editForm.processing}>
                            Batal
                        </AdminButton>
                        <AdminButton type="submit" isLoading={editForm.processing}>
                            Simpan Perubahan
                        </AdminButton>
                    </AdminModalFooter>
                </form>
            </AdminModal>
        </AdminLayout>
    );
}