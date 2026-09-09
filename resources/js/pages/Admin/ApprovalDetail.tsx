import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { useForm, router } from '@inertiajs/react';
import { motion } from 'framer-motion';

interface ApprovalDetailProps {
    tenancy: any;
    profile: any;
    agreement: any;
    signatures: any[];
    moveInDoc: any;
    waterMeter: any;
}

export default function ApprovalDetail({ tenancy, profile, agreement, signatures, moveInDoc, waterMeter }: ApprovalDetailProps) {
    const formatRupiah = (val: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val));

    // Data Approval Form (Simple Post)
    const approveData = () => {
        if(confirm("Apakah Anda yakin data tenant dan TTD sudah benar?")) {
            router.post(`/admin/approvals/${tenancy.id}/approve`);
        }
    };

    // Move-in Doc Form
    const docForm = useForm({
        documentation_date: new Date().toISOString().split('T')[0],
        notes: '',
        photos: [] as File[],
    });

    const handleDocSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        docForm.post(`/admin/approvals/${tenancy.id}/move-in-doc`);
    };

    // Water Meter Form
    const waterForm = useForm({
        date: new Date().toISOString().split('T')[0],
        start_meter: '',
        photo: null as File | null,
    });

    const handleWaterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        waterForm.post(`/admin/approvals/${tenancy.id}/water-meter`);
    };

    return (
        <AdminLayout title="Proses Aktivasi Tenant">
            <div className="mb-8">
                <button onClick={() => router.get('/admin/tenants')} className="text-sm font-medium text-neutral-500 hover:text-neutral-900 mb-2 flex items-center gap-2">
                    &larr; Kembali ke Daftar Tenant
                </button>
                <h1 className="text-3xl font-bold tracking-tight">Proses Aktivasi Tenant</h1>
                <p className="text-neutral-500 mt-1">Selesaikan langkah-langkah di bawah untuk mengaktifkan akun {tenancy.user.name}.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Status Sidebar */}
                <div className="col-span-1 space-y-4">
                    <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                        <h3 className="font-bold text-lg mb-4 border-b border-neutral-100 pb-2">Informasi Utama</h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="text-neutral-500 block">Unit</span>
                                <span className="font-medium">{tenancy.property.name}</span>
                            </div>
                            <div>
                                <span className="text-neutral-500 block">Nama Tenant</span>
                                <span className="font-medium">{tenancy.user.name} ({tenancy.user.email})</span>
                            </div>
                            <div>
                                <span className="text-neutral-500 block">Harga Kesepakatan</span>
                                <span className="font-medium">{formatRupiah(tenancy.agreed_price)} / bulan</span>
                            </div>
                            <div>
                                <span className="text-neutral-500 block">Status Saat Ini</span>
                                <span className="inline-block mt-1 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                                    {tenancy.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                        <h3 className="font-bold text-lg mb-4 border-b border-neutral-100 pb-2">Progress Flow</h3>
                        <ul className="space-y-4 text-sm font-medium">
                            <li className={`flex items-center gap-3 ${tenancy.status !== 'PENDING_ADMIN_APPROVAL' ? 'text-green-600' : 'text-neutral-900'}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${tenancy.status !== 'PENDING_ADMIN_APPROVAL' ? 'border-green-600 bg-green-50' : 'border-neutral-900 bg-neutral-900 text-white'}`}>1</div>
                                Review Identitas & TTD
                            </li>
                            <li className={`flex items-center gap-3 ${tenancy.status === 'PENDING_WATER_METER' || tenancy.status === 'ACTIVE' ? 'text-green-600' : (tenancy.status === 'PENDING_MOVE_IN_DOCUMENTATION' ? 'text-neutral-900' : 'text-neutral-400')}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${tenancy.status === 'PENDING_WATER_METER' || tenancy.status === 'ACTIVE' ? 'border-green-600 bg-green-50' : (tenancy.status === 'PENDING_MOVE_IN_DOCUMENTATION' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300')}`}>2</div>
                                Move-in Documentation
                            </li>
                            <li className={`flex items-center gap-3 ${tenancy.status === 'ACTIVE' ? 'text-green-600' : (tenancy.status === 'PENDING_WATER_METER' ? 'text-neutral-900' : 'text-neutral-400')}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${tenancy.status === 'ACTIVE' ? 'border-green-600 bg-green-50' : (tenancy.status === 'PENDING_WATER_METER' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300')}`}>3</div>
                                Start Water Meter
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Action Area */}
                <div className="col-span-1 lg:col-span-2 space-y-6">
                    {tenancy.status === 'PENDING_ADMIN_APPROVAL' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
                            <h2 className="text-xl font-bold mb-4">Step 1: Review Data Tenant</h2>
                            <p className="text-neutral-500 mb-6">Pastikan data yang diisi tenant (KTP dan Tanda Tangan) sudah sesuai.</p>
                            
                            <div className="bg-neutral-50 p-4 rounded-xl mb-6 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><span className="text-neutral-500">Nama KTP 1:</span> <span className="font-medium block">{profile?.ktp_1_name}</span></div>
                                    <div><span className="text-neutral-500">NIK 1:</span> <span className="font-medium block">{profile?.ktp_1_nik}</span></div>
                                    <div><span className="text-neutral-500">No WA:</span> <span className="font-medium block">{profile?.whatsapp}</span></div>
                                </div>
                            </div>
                            
                            {/* Surat Pernyataan + TTD asli yang dikirim tenant */}
                            {agreement?.document_html ? (
                                <div className="mb-6">
                                    <p className="text-sm font-medium text-neutral-500 mb-2">Surat Pernyataan &amp; Tanda Tangan Tenant</p>
                                    <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4 text-sm overflow-x-hidden"
                                         dangerouslySetInnerHTML={{ __html: agreement.document_html }}
                                    />
                                </div>
                            ) : (
                                <div className="mb-6 p-4 border border-dashed border-neutral-300 rounded-xl text-center text-sm text-neutral-500">
                                    (Belum ada Surat Pernyataan dari tenant)
                                </div>
                            )}

                            {signatures?.length > 0 && (
                                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {signatures.map((s: any) => (
                                        <div key={s.id} className="bg-neutral-50 rounded-xl border border-neutral-200 p-4">
                                            <p className="text-sm font-medium text-neutral-500 mb-3">
                                                {s.occupant_type === 'OCCUPANT_1' ? 'Penghuni 1' : 'Penghuni 2'}
                                            </p>
                                            {s.signature_image && (
                                                <div className="mb-3">
                                                    <p className="text-xs text-neutral-400 mb-1">Tanda Tangan</p>
                                                    <img src={s.signature_image} alt={s.occupant_type} className="w-full max-w-[280px] border border-neutral-300 bg-white rounded" />
                                                </div>
                                            )}
                                            {s.paraf_image && (
                                                <div>
                                                    <p className="text-xs text-neutral-400 mb-1">Paraf</p>
                                                    <img src={s.paraf_image} alt={s.occupant_type} className="w-24 border border-neutral-300 bg-white rounded" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button onClick={approveData} className="w-full bg-neutral-900 text-white font-medium py-3 rounded-lg hover:bg-neutral-800 transition-colors">
                                Approve Data & Agreement
                            </button>
                        </motion.div>
                    )}

                    {tenancy.status === 'PENDING_MOVE_IN_DOCUMENTATION' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
                            <h2 className="text-xl font-bold mb-4">Step 2: Move-In Room Documentation</h2>
                            <p className="text-neutral-500 mb-6 text-sm">Dokumentasikan kondisi awal kamar. Foto/video ini akan menjadi bukti historis sebelum tenant masuk.</p>
                            
                            <form onSubmit={handleDocSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Tanggal Dokumentasi</label>
                                    <input type="date" value={docForm.data.documentation_date} onChange={e => docForm.setData('documentation_date', e.target.value)} className="w-full border-neutral-300 rounded-lg" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Upload Media (Foto/Video Kondisi Kamar)</label>
                                    <input type="file" multiple accept="image/*,video/*" onChange={e => docForm.setData('photos', Array.from(e.target.files || []))} className="w-full border-neutral-300 rounded-lg text-sm p-2 bg-neutral-50" required />
                                    {docForm.errors.photos && <div className="text-red-500 text-xs mt-1">{docForm.errors.photos}</div>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Catatan Kondisi (Notes)</label>
                                    <textarea value={docForm.data.notes} onChange={e => docForm.setData('notes', e.target.value)} className="w-full border-neutral-300 rounded-lg" rows={4} placeholder="Contoh: AC dingin, ada sedikit noda di tembok, kasur bersih." />
                                </div>
                                <button type="submit" disabled={docForm.processing} className="w-full bg-neutral-900 text-white font-medium py-3 rounded-lg hover:bg-neutral-800 disabled:opacity-50">
                                    Simpan Dokumentasi
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {tenancy.status === 'PENDING_WATER_METER' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
                            <h2 className="text-xl font-bold mb-4">Step 3: Start Water Meter</h2>
                            <p className="text-neutral-500 mb-6 text-sm">Catat meteran air awal sebelum tenant resmi menempati kamar. Akun tenant akan otomatis menjadi ACTIVE setelah ini.</p>
                            
                            <form onSubmit={handleWaterSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Tanggal Pencatatan</label>
                                    <input type="date" value={waterForm.data.date} onChange={e => waterForm.setData('date', e.target.value)} className="w-full border-neutral-300 rounded-lg" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Angka Start Meter (m³)</label>
                                    <input type="number" min="0" value={waterForm.data.start_meter} onChange={e => waterForm.setData('start_meter', e.target.value)} className="w-full border-neutral-300 rounded-lg" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Upload Bukti Foto Meteran</label>
                                    <input type="file" accept="image/*" onChange={e => waterForm.setData('photo', e.target.files?.[0] || null)} className="w-full border-neutral-300 rounded-lg text-sm p-2 bg-neutral-50" required />
                                </div>
                                <button type="submit" disabled={waterForm.processing} className="w-full bg-green-600 text-white font-medium py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-lg mt-4">
                                    Simpan & Aktifkan Tenant
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {tenancy.status === 'ACTIVE' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl border border-green-200 p-8 shadow-sm text-center">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Tenant Aktif!</h2>
                            <p className="text-neutral-500 mb-6">Tenant sudah aktif, tagihan berjalan otomatis, dan tenant sudah bisa mengakses dasbornya.</p>
                            <button onClick={() => router.get('/admin/tenants')} className="bg-neutral-900 text-white px-6 py-2 rounded-lg font-medium">
                                Kembali ke Daftar
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
