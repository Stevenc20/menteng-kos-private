import { useMemo, useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { useForm, router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { Search, UserPlus, ShieldCheck, Users, UserX, Pencil, Trash2, Power } from 'lucide-react';
import {
    AdminModal,
    AdminModalHeader,
    AdminModalContent,
    AdminModalFooter,
} from '@/components/admin/AdminModal';
import {
    FormLabel,
    FormHelper,
    FormError,
    TextInput,
    SelectInput,
} from '@/components/admin/AdminForm';
import { AdminButton } from '@/components/admin/AdminButton';

interface AdminUser {
    id: number;
    name: string;
    email: string;
    is_super_admin: boolean;
    status: 'ACTIVE' | 'SUSPENDED';
    last_login_at: string | null;
    created_at: string;
}

interface UsersProps {
    users: AdminUser[];
    counts: { total: number; active: number; inactive: number };
}

const STATUS_LABELS: Record<string, string> = {
    ACTIVE: 'Aktif',
    SUSPENDED: 'Nonaktif',
};

function fmtDate(value: string | null): string {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function superBadge(isSuper: boolean) {
    return isSuper
        ? 'bg-[#1A1A18] text-white'
        : 'bg-neutral-100 text-neutral-700';
}

function statusBadge(status: string) {
    return status === 'ACTIVE'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-red-50 text-red-600';
}

export default function AdminUsers({ users, counts }: UsersProps) {
    const { auth } = usePage().props as any;
    const currentUserId = auth?.user?.id ?? null;

    const [search, setSearch] = useState('');
    const [superFilter, setSuperFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [editUser, setEditUser] = useState<AdminUser | null>(null);
    const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
    const [togglingId, setTogglingId] = useState<number | null>(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users.filter((u) => {
            if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
            if (superFilter === 'super' && !u.is_super_admin) return false;
            if (superFilter === 'regular' && u.is_super_admin) return false;
            if (statusFilter && u.status !== statusFilter) return false;
            return true;
        });
    }, [users, search, superFilter, statusFilter]);

    const addForm = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        is_super_admin: false,
        status: 'ACTIVE',
    });

    const editForm = useForm({
        name: '',
        email: '',
        is_super_admin: false,
        status: 'ACTIVE',
        password: '',
        password_confirmation: '',
    });

    const openAdd = () => {
        addForm.reset();
        addForm.clearErrors();
        setShowAdd(true);
    };

    const submitAdd = (e: React.FormEvent) => {
        e.preventDefault();
        addForm.post('/admin/users', {
            preserveScroll: true,
            onSuccess: () => {
                setShowAdd(false);
                addForm.reset();
                toast.success('Admin berhasil ditambahkan', {
                    description: 'Akun baru dapat langsung login menggunakan email & password.',
                });
            },
            onError: () => toast.error('Gagal menambahkan admin. Periksa kembali isian.'),
        });
    };

    const openEdit = (u: AdminUser) => {
        editForm.setData({
            name: u.name,
            email: u.email,
            is_super_admin: u.is_super_admin,
            status: u.status,
            password: '',
            password_confirmation: '',
        });
        editForm.clearErrors();
        setEditUser(u);
    };

    const submitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editUser) return;
        editForm.put(`/admin/users/${editUser.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditUser(null);
                toast.success('Data admin berhasil diperbarui');
            },
            onError: (err: any) => {
                toast.error(err._form ?? err.status ?? 'Gagal memperbarui admin.');
            },
        });
    };

    const toggleStatus = (u: AdminUser) => {
        const next = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        setTogglingId(u.id);
        router.put(
            `/admin/users/${u.id}`,
            { name: u.name, email: u.email, is_super_admin: u.is_super_admin, status: next },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(next === 'ACTIVE' ? 'Admin diaktifkan' : 'Admin dinonaktifkan');
                },
                onError: (err: any) => {
                    toast.error(err.status ?? err._form ?? 'Gagal mengubah status admin.');
                },
                onFinish: () => setTogglingId(null),
            }
        );
    };

    const confirmDelete = () => {
        if (!deleteUser) return;
        router.delete(`/admin/users/${deleteUser.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setDeleteUser(null);
                toast.success('Admin berhasil dihapus');
            },
            onError: (err: any) => {
                toast.error(err._form ?? 'Gagal menghapus admin.');
            },
        });
    };

    const EmptyState = (
        <div className="text-center py-16">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F0F0ED] flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-neutral-400" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#1A1A18]">
                {users.length === 0 ? 'Belum ada admin tambahan.' : 'Tidak ada hasil yang cocok.'}
            </h3>
            <p className="text-[13px] text-[#6B6B67] mt-1">{users.length === 0 ? 'Klik "+ Tambah Admin" untuk membuat akun baru.' : 'Coba ubah kata kunci pencarian atau filter.'}</p>
            {users.length === 0 && (
                <div className="mt-5">
                    <AdminButton onClick={openAdd}>
                        <UserPlus className="w-4 h-4" />
                        Tambah Admin
                    </AdminButton>
                </div>
            )}
        </div>
    );

    return (
        <AdminLayout title="Manajemen Admin / User">
            <div className="mb-8">
                <h1 className="text-[26px] md:text-[30px] font-bold text-[#1A1A18] tracking-tight">
                    Manajemen Admin / User
                </h1>
                <p className="text-[14px] text-[#6B6B67] mt-1.5">
                    Kelola akun yang memiliki akses ke sistem Menteng Kos Private.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total User', value: counts.total, icon: Users, cls: 'bg-white' },
                    { label: 'Admin Aktif', value: counts.active, icon: ShieldCheck, cls: 'bg-white' },
                    { label: 'Admin Nonaktif', value: counts.inactive, icon: UserX, cls: 'bg-white' },
                ].map((card) => (
                    <div key={card.label} className={`${card.cls} border border-[#E8E7E3] rounded-[16px] p-5 flex items-center gap-4`}>
                        <div className="w-11 h-11 rounded-xl bg-[#1A1A18]/[0.04] flex items-center justify-center">
                            <card.icon className="w-5 h-5 text-[#1A1A18]" />
                        </div>
                        <div>
                            <div className="text-[22px] font-bold text-[#1A1A18] leading-none">{card.value}</div>
                            <div className="text-[12px] text-[#6B6B67] mt-1">{card.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white border border-[#E8E7E3] rounded-[16px] overflow-hidden">
                <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 border-b border-[#E8E7E3]">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <TextInput
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari nama atau email..."
                            className="pl-10"
                        />
                    </div>
                    <div className="flex gap-3">
                        <SelectInput value={superFilter} onChange={(e) => setSuperFilter(e.target.value)} className="min-w-[150px]">
                            <option value="">Semua Hak Akses</option>
                            <option value="super">Super Admin</option>
                            <option value="regular">Admin</option>
                        </SelectInput>
                        <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-w-[150px]">
                            <option value="">Semua Status</option>
                            <option value="ACTIVE">Aktif</option>
                            <option value="SUSPENDED">Nonaktif</option>
                        </SelectInput>
                    </div>
                    <AdminButton className="shrink-0" onClick={openAdd}>
                        <UserPlus className="w-4 h-4" />
                        Tambah Admin
                    </AdminButton>
                </div>

                <div className="overflow-x-auto">
                    {filtered.length === 0 ? (
                        EmptyState
                    ) : (
                        <table className="w-full text-left text-[14px]">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-widest text-neutral-400 border-b border-neutral-100">
                                    {['Nama', 'Email', 'Hak Akses', 'Status', 'Terakhir Login', 'Dibuat', 'Aksi'].map((h) => (
                                        <th key={h} className="px-5 py-3 font-semibold whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((u) => {
                                    const isSelf = u.id === currentUserId;
                                    return (
                                        <tr key={u.id} className="border-b border-neutral-100 last:border-0 hover:bg-[#FCFCFA]">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="font-medium text-[#1A1A18] whitespace-nowrap">{u.name}</span>
                                                    {isSelf && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wide bg-[#1A1A18] text-white rounded-full px-2 py-0.5">Anda</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-[#6B6B67] whitespace-nowrap">{u.email}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium ${superBadge(u.is_super_admin)}`}>
                                                    {u.is_super_admin ? 'Super Admin' : 'Admin'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium ${statusBadge(u.status)}`}>
                                                    {STATUS_LABELS[u.status] ?? u.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-[#6B6B67] whitespace-nowrap">{fmtDate(u.last_login_at)}</td>
                                            <td className="px-5 py-3.5 text-[#6B6B67] whitespace-nowrap">{fmtDate(u.created_at)}</td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => openEdit(u)}
                                                        title="Edit"
                                                        className="p-2 rounded-lg text-neutral-500 hover:bg-[#F7F7F5] hover:text-[#1A1A18] transition-colors"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => toggleStatus(u)}
                                                        disabled={isSelf || togglingId === u.id}
                                                        title={u.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                                                        className={`p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                                            isSelf
                                                                ? 'text-neutral-300 cursor-not-allowed'
                                                                : u.status === 'ACTIVE'
                                                                    ? 'text-amber-500 hover:bg-amber-50'
                                                                    : 'text-emerald-600 hover:bg-emerald-50'
                                                        }`}
                                                    >
                                                        <Power className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteUser(u)}
                                                        disabled={isSelf}
                                                        title="Hapus"
                                                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <AdminModal isOpen={showAdd} onClose={() => setShowAdd(false)}>
                <AdminModalHeader
                    title="Tambah Admin"
                    description="Buat akun baru yang dapat mengakses dashboard admin."
                    onClose={() => setShowAdd(false)}
                />
                <form onSubmit={submitAdd}>
                    <AdminModalContent>
                        <div className="space-y-4">
                            <div>
                                <FormLabel htmlFor="add-name">Nama</FormLabel>
                                <TextInput id="add-name" value={addForm.data.name} onChange={(e) => addForm.setData('name', e.target.value)} placeholder="Nama lengkap admin" />
                                <FormError>{addForm.errors.name}</FormError>
                            </div>
                            <div>
                                <FormLabel htmlFor="add-email">Email</FormLabel>
                                <TextInput id="add-email" type="email" value={addForm.data.email} onChange={(e) => addForm.setData('email', e.target.value)} placeholder="admin@example.com" />
                                <FormError>{addForm.errors.email}</FormError>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <FormLabel htmlFor="add-status">Status</FormLabel>
                                    <SelectInput id="add-status" value={addForm.data.status} onChange={(e) => addForm.setData('status', e.target.value)}>
                                        <option value="ACTIVE">Aktif</option>
                                        <option value="SUSPENDED">Nonaktif</option>
                                    </SelectInput>
                                    <FormError>{addForm.errors.status}</FormError>
                                </div>
                                <div>
                                    <FormLabel>Hak Akses</FormLabel>
                                    <label className="flex items-center gap-3 rounded-xl border border-[#E8E7E3] bg-[#FCFCFA] px-4 py-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 accent-[#1A1A18]"
                                            checked={addForm.data.is_super_admin}
                                            onChange={(e) => addForm.setData('is_super_admin', e.target.checked)}
                                        />
                                        <span>
                                            <span className="block text-[14px] font-medium text-[#1A1A18]">Super Admin</span>
                                            <span className="block text-[12px] text-[#6B6B67]">Akses penuh untuk mengelola seluruh sistem.</span>
                                        </span>
                                    </label>
                                    <FormError>{addForm.errors.is_super_admin}</FormError>
                                </div>
                            </div>
                            <div>
                                <FormLabel htmlFor="add-password">Password</FormLabel>
                                <TextInput id="add-password" type="password" value={addForm.data.password} onChange={(e) => addForm.setData('password', e.target.value)} placeholder="Password baru" />
                                <FormHelper>Kosongkan jika akun hanya login via Google.</FormHelper>
                                <FormError>{addForm.errors.password}</FormError>
                            </div>
                            <div>
                                <FormLabel htmlFor="add-password-confirm">Konfirmasi Password</FormLabel>
                                <TextInput id="add-password-confirm" type="password" value={addForm.data.password_confirmation} onChange={(e) => addForm.setData('password_confirmation', e.target.value)} placeholder="Ulangi password" />
                                <FormError>{addForm.errors.password_confirmation}</FormError>
                            </div>
                        </div>
                    </AdminModalContent>
                    <AdminModalFooter>
                        <AdminButton variant="secondary" type="button" onClick={() => setShowAdd(false)}>Batal</AdminButton>
                        <AdminButton type="submit" isLoading={addForm.processing}>
                            <UserPlus className="w-4 h-4" />
                            Simpan Admin
                        </AdminButton>
                    </AdminModalFooter>
                </form>
            </AdminModal>

            <AdminModal isOpen={editUser !== null} onClose={() => setEditUser(null)}>
                <AdminModalHeader
                    title="Edit Admin"
                    description={editUser ? `Perbarui akun ${editUser.name}.` : undefined}
                    onClose={() => setEditUser(null)}
                />
                <form onSubmit={submitEdit}>
                    <AdminModalContent>
                        <div className="space-y-4">
                            <div>
                                <FormLabel htmlFor="edit-name">Nama</FormLabel>
                                <TextInput id="edit-name" value={editForm.data.name} onChange={(e) => editForm.setData('name', e.target.value)} />
                                <FormError>{editForm.errors.name}</FormError>
                            </div>
                            <div>
                                <FormLabel htmlFor="edit-email">Email</FormLabel>
                                <TextInput id="edit-email" type="email" value={editForm.data.email} onChange={(e) => editForm.setData('email', e.target.value)} />
                                <FormError>{editForm.errors.email}</FormError>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <FormLabel htmlFor="edit-status">Status</FormLabel>
                                    <SelectInput id="edit-status" value={editForm.data.status} onChange={(e) => editForm.setData('status', e.target.value)}>
                                        <option value="ACTIVE">Aktif</option>
                                        <option value="SUSPENDED">Nonaktif</option>
                                    </SelectInput>
                                    <FormError>{editForm.errors.status}</FormError>
                                </div>
                                <div>
                                    <FormLabel>Hak Akses</FormLabel>
                                    <label className="flex items-center gap-3 rounded-xl border border-[#E8E7E3] bg-[#FCFCFA] px-4 py-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 accent-[#1A1A18]"
                                            checked={editForm.data.is_super_admin}
                                            onChange={(e) => editForm.setData('is_super_admin', e.target.checked)}
                                        />
                                        <span>
                                            <span className="block text-[14px] font-medium text-[#1A1A18]">Super Admin</span>
                                            <span className="block text-[12px] text-[#6B6B67]">Akses penuh untuk mengelola seluruh sistem.</span>
                                        </span>
                                    </label>
                                    <FormError>{editForm.errors.is_super_admin}</FormError>
                                </div>
                            </div>
                            <div>
                                <FormLabel htmlFor="edit-password">Password Baru</FormLabel>
                                <TextInput id="edit-password" type="password" value={editForm.data.password} onChange={(e) => editForm.setData('password', e.target.value)} placeholder="Kosongkan jika tidak diganti" />
                                <FormHelper>Kosongkan jika login via Google / tidak diubah.</FormHelper>
                                <FormError>{editForm.errors.password}</FormError>
                            </div>
                            <div>
                                <FormLabel htmlFor="edit-password-confirm">Konfirmasi Password Baru</FormLabel>
                                <TextInput id="edit-password-confirm" type="password" value={editForm.data.password_confirmation} onChange={(e) => editForm.setData('password_confirmation', e.target.value)} placeholder="Ulangi password baru" />
                                <FormError>{editForm.errors.password_confirmation}</FormError>
                            </div>
                        </div>
                    </AdminModalContent>
                    <AdminModalFooter>
                        <AdminButton variant="secondary" type="button" onClick={() => setEditUser(null)}>Batal</AdminButton>
                        <AdminButton type="submit" isLoading={editForm.processing}>Simpan Perubahan</AdminButton>
                    </AdminModalFooter>
                </form>
            </AdminModal>

            <AdminModal isOpen={deleteUser !== null} onClose={() => setDeleteUser(null)} maxWidth="sm">
                <AdminModalHeader
                    title="Hapus Admin?"
                    description={deleteUser ? `Akun ${deleteUser.name} (${deleteUser.email}) akan dinonaktifkan permanen dari sistem.` : undefined}
                    onClose={() => setDeleteUser(null)}
                />
                <AdminModalContent>
                    <p className="text-[14px] text-[#6B6B67] leading-relaxed">
                        Tindakan ini menghapus akses akun tersebut. Data historis tetap diamankan di dalam sistem.
                    </p>
                </AdminModalContent>
                <AdminModalFooter>
                    <AdminButton variant="secondary" onClick={() => setDeleteUser(null)}>Batal</AdminButton>
                    <AdminButton variant="danger" onClick={confirmDelete}>
                        <Trash2 className="w-4 h-4" />
                        Hapus Admin
                    </AdminButton>
                </AdminModalFooter>
            </AdminModal>
        </AdminLayout>
    );
}