import { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { router, useForm } from '@inertiajs/react';
import { AdminModal, AdminModalHeader, AdminModalContent, AdminModalFooter } from '@/components/admin/AdminModal';
import { AdminButton } from '@/components/admin/AdminButton';
import { calcDueDay } from '@/services/statement';

interface ApprovalDetailProps {
    tenancy: any;
    profile: any;
    agreement: any;
    signatures: any[];
    approvedBy: any;
    moveInDoc: any;
    waterMeter: any;
    effectiveMoveInDate?: string | null;
    moveInDateIsStale?: boolean;
    dueDayNumber?: number;
    dueDayLabel?: string;
    nextDueDate?: string | null;
}

function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-2xl border border-[#E8E7E3] p-6 shadow-sm ${className}`}>
            {title && <h3 className="font-bold text-lg mb-4 border-b border-neutral-100 pb-2">{title}</h3>}
            {children}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
    return (
        <div>
            <span className="text-neutral-500 block text-sm">{label}</span>
            <span className="font-medium text-[#1A1A18]">{value ?? '-'}</span>
        </div>
    );
}

const formatRupiah = (val: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val));

const formatDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

export default function ApprovalDetail({ tenancy, profile, agreement, signatures, approvedBy, moveInDoc, waterMeter, effectiveMoveInDate, moveInDateIsStale, dueDayLabel, nextDueDate }: ApprovalDetailProps) {
    const isPending = tenancy.status === 'PENDING_ADMIN_APPROVAL' && tenancy.approval_status !== 'REJECTED';
    const isRejected = tenancy.approval_status === 'REJECTED';
    const isApproved = tenancy.status === 'ACTIVE';

    // Approve Confirmation Modal
    const [confirmModal, setConfirmModal] = useState(false);
    const approveProcessing = useForm({ status: '' }).processing;

    // Reject Modal
    const rejectForm = useForm({ rejection_reason: '' });
    const [rejectModal, setRejectModal] = useState(false);
    const submitReject = (e: React.FormEvent) => {
        e.preventDefault();
        rejectForm.post(`/admin/tenants/${tenancy.id}/reject`, {
            onSuccess: () => setRejectModal(false),
        });
    };

    const openReject = () => {
        rejectForm.reset();
        setRejectModal(true);
    };

    // KTP Preview Modal
    const [preview, setPreview] = useState<{ label: string; url: string } | null>(null);
    const [zoom, setZoom] = useState(false);

    const ktpUrl = (kind: string) => `/admin/tenants/${tenancy.id}/ktp/${kind}`;

    const occupant1 = [
        ['Nama Lengkap', profile?.ktp_1_name],
        ['NIK', profile?.ktp_1_nik],
        ['Tempat Lahir', profile?.ktp_1_birth_place],
        ['Tanggal Lahir', profile?.ktp_1_birth_date],
        ['Pekerjaan', profile?.ktp_1_job],
        ['Alamat', profile?.ktp_1_address],
    ].filter(([, v]) => v) as [string, string][];

    const occupant2 = profile?.ktp_2_name ? [
        ['Nama Lengkap', profile?.ktp_2_name],
        ['NIK', profile?.ktp_2_nik],
        ['Tempat Lahir', profile?.ktp_2_birth_place],
        ['Tanggal Lahir', profile?.ktp_2_birth_date],
        ['Pekerjaan', profile?.ktp_2_job],
        ['Alamat', profile?.ktp_2_address],
    ].filter(([, v]) => v) as [string, string][] : [];

    const hasSecondOccupant = occupant2.length > 0 || Boolean(profile?.ktp_2_photo);

    const ktpDocuments = [
        { label: 'KTP Penghuni 1', url: ktpUrl('1'), downloadUrl: ktpUrl('1') + '/download', has: Boolean(profile?.ktp_1_photo) },
        { label: 'KTP Penghuni 2', url: ktpUrl('2'), downloadUrl: ktpUrl('2') + '/download', has: Boolean(profile?.ktp_2_photo) },
    ].filter(k => k.label === 'KTP Penghuni 1' || hasSecondOccupant);

    const hasAnyKtp = Boolean(profile?.ktp_1_photo) || hasSecondOccupant;

    return (
        <>
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .printable-statement, .printable-statement * { visibility: visible !important; }
                    .printable-statement {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 24px !important;
                        border: none !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                        background: white !important;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>
            <AdminLayout title="Detail Tenant | Admin">
            <div className="mb-8">
                <button onClick={() => router.get('/admin/tenants')} className="text-sm font-medium text-neutral-500 hover:text-neutral-900 mb-2 flex items-center gap-2">
                    &larr; Kembali ke Daftar Tenant
                </button>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Detail Tenant</h1>
                        <p className="text-neutral-500 mt-1">Review keseluruhan data &amp; dokumen onboarding sebelum memutuskan.</p>
                    </div>
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full uppercase tracking-wider ${
                        isRejected ? 'bg-red-50 text-red-700' :
                        isApproved ? 'bg-emerald-50 text-emerald-700' :
                        tenancy.status === 'PENDING_ADMIN_APPROVAL' ? 'bg-amber-50 text-amber-800' :
                        'bg-gray-100 text-gray-600'
                    }`}>
                        {isRejected ? 'Perlu Perbaikan' : isApproved ? 'Aktif' : tenancy.status.replace(/_/g, ' ')}
                    </span>
                </div>
            </div>

            {/* Info Header */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <Card className="lg:col-span-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <InfoRow label="Nama Tenant" value={tenancy.user?.name} />
                        <InfoRow label="Email" value={tenancy.user?.email} />
                        <InfoRow label="Unit" value={`${tenancy.property?.name} (${tenancy.property?.type === 'KIOSK' ? 'Kios' : 'Kamar'})`} />
                        <InfoRow label="Harga Deal" value={`${formatRupiah(tenancy.agreed_price)} / bulan`} />
                        <InfoRow label="Tanggal Masuk" value={
                            <span className="inline-flex items-center gap-2">
                                {formatDate(effectiveMoveInDate || tenancy.move_in_date)}
                                {moveInDateIsStale && (
                                    <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                                        disesuaikan ke tanggal pengajuan
                                    </span>
                                )}
                            </span>
                        } />
                        <InfoRow label="Tanggal Pengajuan" value={formatDate(tenancy.created_at)} />
                        <InfoRow label="Jatuh Tempo Pembayaran" value={dueDayLabel ? `tanggal ${dueDayLabel} setiap bulan` : `tanggal ${calcDueDay(effectiveMoveInDate || tenancy.move_in_date)} setiap bulan`} />
                        {isApproved && (
                            <>
                                <InfoRow label="Disetujui Pada" value={formatDate(tenancy.approved_at)} />
                                <InfoRow label="Disetujui Oleh" value={approvedBy?.name ?? 'Admin'} />
                            </>
                        )}
                    </div>
                </Card>

                {/* Approval Status */}
                {(isPending || isRejected || isApproved) && (
                    <Card className={`flex flex-col justify-between ${
                        isRejected ? 'ring-1 ring-red-200' : isApproved ? 'ring-1 ring-emerald-200' : ''
                    }`}>
                        <div>
                            {isPending && (
                                <>
                                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-amber-900 mb-2">Menunggu Persetujuan Admin</h2>
                                    <p className="text-sm text-neutral-500 leading-relaxed">
                                        Tenant telah menyelesaikan seluruh proses onboarding. Silakan periksa data dan dokumen sebelum menyetujui tenant.
                                    </p>
                                </>
                            )}
                            {isRejected && (
                                <>
                                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-red-700 mb-2">Ditolak / Perlu Perbaikan</h2>
                                    <p className="text-sm text-neutral-500 mb-3">Alasan yang dikirim ke tenant:</p>
                                    <p className="text-sm bg-red-50 text-red-800 rounded-xl p-3 border border-red-100">{tenancy.rejection_reason}</p>
                                </>
                            )}
                            {isApproved && (
                                <>
                                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-emerald-700 mb-2">Tenant Disetujui</h2>
                                    <p className="text-sm text-neutral-500 leading-relaxed">Akun tenant aktif dan unit sudah berstatus Occupied.</p>
                                </>
                            )}
                        </div>

                        <div className="flex flex-col gap-2 mt-6">
                            {isPending && (
                                <>
                                    <AdminButton variant="danger" onClick={openReject}>Tolak / Minta Perbaikan</AdminButton>
                                    <AdminButton onClick={() => setConfirmModal(true)}>Setujui Tenant</AdminButton>
                                </>
                            )}
                            {isRejected && (
                                <AdminButton variant="secondary" onClick={() => router.post(`/admin/tenants/${tenancy.id}/reopen`)}>
                                    Buka Kembali Review
                                </AdminButton>
                            )}
                            {isApproved && (
                                <AdminButton variant="secondary" onClick={() => router.get('/admin/tenants')}>Kembali ke Daftar</AdminButton>
                            )}
                        </div>
                    </Card>
                )}
            </div>

            <div className="space-y-6">
                {/* Data Penyewaan */}
                <Card title="Data Penyewaan">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                        <InfoRow label="Jenis Unit" value={tenancy.property?.type === 'KIOSK' ? 'Kios' : 'Kamar'} />
                        <InfoRow label="Nama / Nomor Unit" value={tenancy.property?.name} />
                        <InfoRow label="Harga Deal" value={`${formatRupiah(tenancy.agreed_price)} / bulan`} />
                        <InfoRow label="Tanggal Masuk" value={formatDate(effectiveMoveInDate || tenancy.move_in_date)} />
                        <InfoRow label="Tanggal Jatuh Tempo" value={dueDayLabel ? `tanggal ${dueDayLabel} setiap bulan` : `tanggal ${calcDueDay(effectiveMoveInDate || tenancy.move_in_date)} setiap bulan`} />
                        {nextDueDate && <InfoRow label="Jatuh Tempo Berikutnya" value={formatDate(nextDueDate)} />}
                    </div>
                </Card>

                {/* Data Penghuni */}
                <Card title="Data Penghuni">
                    <p className="text-sm text-neutral-500 mb-4">
                        Jumlah Penghuni: <span className="font-semibold text-[#1A1A18]">{hasSecondOccupant ? 2 : 1} Orang</span>
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <p className="text-sm font-semibold text-[#6B6B67] uppercase tracking-wider mb-3">Penghuni 1</p>
                            <div className="grid grid-cols-1 gap-y-3 text-sm">
                                {occupant1.map(([k, v]) => (
                                    <InfoRow key={k} label={k} value={v} />
                                ))}
                                <InfoRow label="No WhatsApp" value={profile?.whatsapp} />
                            </div>
                        </div>
                        {occupant2.length > 0 && (
                            <div>
                                <p className="text-sm font-semibold text-[#6B6B67] uppercase tracking-wider mb-3">Penghuni 2</p>
                                <div className="grid grid-cols-1 gap-y-3 text-sm">
                                    {occupant2.map(([k, v]) => (
                                        <InfoRow key={k} label={k} value={v} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Dokumen KTP */}
                <Card title="Dokumen KTP">
                    {!hasAnyKtp && !profile ? (
                        <div className="p-4 border border-dashed border-neutral-300 rounded-xl text-center text-sm text-neutral-500">
                            Belum ada data KTP untuk tenant ini.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {ktpDocuments.map(k => (
                                <div key={k.label}>
                                    <p className="text-sm font-medium text-neutral-500 mb-2">{k.label}</p>
                                    {k.has ? (
                                        <div>
                                            <button onClick={() => { setZoom(false); setPreview({ label: k.label, url: k.url }); }} className="block w-full">
                                                <img src={k.url} alt={k.label} className="w-full max-w-[360px] border border-[#E8E7E3] rounded-xl bg-neutral-50 hover:opacity-90 transition-opacity" />
                                                <span className="text-xs text-neutral-400 hover:text-neutral-700 mt-1 inline-block">Klik untuk preview lebih besar &amp; zoom</span>
                                            </button>
                                            <a href={k.downloadUrl} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#1A1A18] hover:underline">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                Download
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="w-full max-w-[360px] h-40 border border-dashed border-neutral-300 rounded-xl flex items-center justify-center text-center text-sm text-neutral-400 px-4">
                                            {profile?.ktp_1_name || profile?.ktp_2_name
                                                ? 'Dokumen KTP belum terhubung ke data tenant'
                                                : 'Belum diupload'}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Surat Pernyataan */}
                <Card title={`Surat Pernyataan ${tenancy.property?.type === 'KIOSK' ? 'Kios' : 'Kamar'}`}>
                    {agreement?.document_html ? (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                <p className="text-sm text-neutral-500">
                                    Tampilan identik dengan dokumen yang ditandatangani tenant ({tenancy.property?.type === 'KIOSK' ? 'template Kios' : 'template Kamar'}).
                                </p>
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="no-print inline-flex items-center gap-2 bg-[#1A1A18] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#333333] transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H7a2 2 0 00-2 2v4h12z" /></svg>
                                    Cetak Surat
                                </button>
                            </div>
                            <div className="printable-statement bg-neutral-50 rounded-xl border border-neutral-200 p-4 sm:p-6 text-sm overflow-x-hidden"
                                 dangerouslySetInnerHTML={{ __html: agreement.document_html }}
                            />
                        </>
                    ) : (
                        <div className="no-print p-4 border border-dashed border-neutral-300 rounded-xl text-center text-sm text-neutral-500">
                            (Belum ada Surat Pernyataan dari tenant)
                        </div>
                    )}
                </Card>

                {/* Paraf & Tanda Tangan */}
                <Card title="Paraf & Tanda Tangan">
                    {signatures?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {signatures.map((s: any) => (
                                <div key={s.id} className="bg-neutral-50 rounded-xl border border-neutral-200 p-5">
                                    <p className="text-sm font-semibold text-[#6B6B67] uppercase tracking-wider mb-4">
                                        {s.occupant_type === 'OCCUPANT_1' ? 'Penghuni 1' : 'Penghuni 2'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-neutral-400 mb-1">Tanda Tangan</p>
                                            {s.signature_image ? (
                                                <img src={s.signature_image} alt={s.occupant_type} className="max-w-full border border-neutral-300 bg-white rounded" />
                                            ) : (
                                                <div className="h-20 border border-dashed border-neutral-300 rounded flex items-center justify-center text-xs text-neutral-400">Kosong</div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs text-neutral-400 mb-1">Paraf (ditandatangani di setiap halaman)</p>
                                            {s.paraf_image ? (
                                                <img src={s.paraf_image} alt={s.occupant_type} className="max-w-full border border-neutral-300 bg-white rounded" />
                                            ) : (
                                                <div className="h-20 border border-dashed border-neutral-300 rounded flex items-center justify-center text-xs text-neutral-400">Kosong</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 border border-dashed border-neutral-300 rounded-xl text-center text-sm text-neutral-500">
                            (Belum ada paraf / tanda tangan tersimpan)
                        </div>
                    )}
                </Card>

                {/* Legacy multi-step activation (untuk record lama yang belum melalui alur approval baru) */}
                {tenancy.status === 'PENDING_WATER_METER' || tenancy.status === 'PENDING_MOVE_IN_DOCUMENTATION' ? (
                    <LegacySteps tenancy={tenancy} moveInDoc={moveInDoc} waterMeter={waterMeter} />
                ) : null}
            </div>

            {/* Approve Confirmation Modal */}
            <AdminModal isOpen={confirmModal} onClose={() => !approveProcessing && setConfirmModal(false)} maxWidth="md">
                <AdminModalHeader
                    title="Setujui Tenant?"
                    description="Anda akan menyetujui tenant ini."
                    onClose={() => !approveProcessing && setConfirmModal(false)}
                />
                <AdminModalContent>
                    <p className="text-sm text-neutral-500 mb-4">Setelah disetujui:</p>
                    <ul className="space-y-2 text-sm text-neutral-700">
                        <li className="flex items-center gap-2"><span className="w-4 h-4 text-emerald-500">✓</span> Tenant akan menjadi aktif.</li>
                        <li className="flex items-center gap-2"><span className="w-4 h-4 text-emerald-500">✓</span> Proses onboarding selesai.</li>
                        <li className="flex items-center gap-2"><span className="w-4 h-4 text-emerald-500">✓</span> Data tenant resmi masuk ke sistem.</li>
                        <li className="flex items-center gap-2"><span className="w-4 h-4 text-emerald-500">✓</span> Unit berstatus Occupied.</li>
                    </ul>
                </AdminModalContent>
                <AdminModalFooter>
                    <AdminButton variant="secondary" onClick={() => setConfirmModal(false)} disabled={approveProcessing}>Batal</AdminButton>
                    <AdminButton
                        isLoading={approveProcessing}
                        onClick={() => router.post(`/admin/tenants/${tenancy.id}/approve`)}
                    >
                        Ya, Setujui Tenant
                    </AdminButton>
                </AdminModalFooter>
            </AdminModal>

            {/* Reject Modal */}
            <AdminModal isOpen={rejectModal} onClose={() => !rejectForm.processing && setRejectModal(false)} maxWidth="md">
                <form onSubmit={submitReject} className="flex flex-col flex-1 min-h-0">
                    <AdminModalHeader
                        title="Tolak / Minta Perbaikan"
                        description="Tuliskan alasan agar tenant dapat memperbaiki datanya."
                        onClose={() => !rejectForm.processing && setRejectModal(false)}
                    />
                    <AdminModalContent>
                        <label className="block text-sm font-medium mb-2">Alasan Penolakan / Perbaikan</label>
                        <textarea
                            value={rejectForm.data.rejection_reason}
                            onChange={e => rejectForm.setData('rejection_reason', e.target.value)}
                            className="w-full border border-neutral-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A18] min-h-[120px]"
                            placeholder="Contoh: Foto KTP kurang jelas. Mohon upload ulang KTP dengan pencahayaan yang lebih baik."
                            required
                        />
                        {rejectForm.errors.rejection_reason && (
                            <p className="text-red-500 text-xs mt-1">{rejectForm.errors.rejection_reason}</p>
                        )}
                    </AdminModalContent>
                    <AdminModalFooter>
                        <AdminButton type="button" variant="secondary" onClick={() => setRejectModal(false)} disabled={rejectForm.processing}>Batal</AdminButton>
                        <AdminButton type="submit" variant="danger" isLoading={rejectForm.processing}>Kirim Penolakan</AdminButton>
                    </AdminModalFooter>
                </form>
            </AdminModal>

            {/* KTP Preview Modal */}
            <AdminModal isOpen={Boolean(preview)} onClose={() => setPreview(null)} maxWidth="lg">
                <AdminModalHeader title={preview?.label ?? ''} onClose={() => setPreview(null)} />
                <AdminModalContent className="flex items-center justify-center bg-neutral-50">
                    {preview && (
                        <img
                            src={preview.url}
                            alt={preview.label}
                            onClick={() => setZoom(z => !z)}
                            className={`max-w-full object-contain rounded-xl transition-transform cursor-zoom-in ${zoom ? 'scale-[1.6]' : 'scale-100'}`}
                            style={{ maxHeight: '70dvh' }}
                        />
                    )}
                </AdminModalContent>
                <AdminModalFooter>
                    <span className="text-xs text-neutral-400 mr-auto">Klik gambar untuk zoom {zoom ? 'keluar' : 'masuk'}</span>
                    <AdminButton variant="secondary" onClick={() => setPreview(null)}>Tutup</AdminButton>
                </AdminModalFooter>
            </AdminModal>
        </AdminLayout>
        </>
    );
}

/* Legacy flow — hanya muncul untuk tenancy yang masih di alur lama (move-in doc / water meter). */
function LegacySteps({ tenancy, moveInDoc, waterMeter }: { tenancy: any; moveInDoc: any; waterMeter: any }) {
    const docForm = useForm({
        documentation_date: new Date().toISOString().split('T')[0],
        notes: '',
        photos: [] as File[],
    });
    const handleDocSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        docForm.post(`/admin/approvals/${tenancy.id}/move-in-doc`);
    };

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
        <>
            {tenancy.status === 'PENDING_MOVE_IN_DOCUMENTATION' && (
                <Card title="Move-In Documentation">
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
                            <textarea value={docForm.data.notes} onChange={e => docForm.setData('notes', e.target.value)} className="w-full border-neutral-300 rounded-lg" rows={4} />
                        </div>
                        <AdminButton type="submit" isLoading={docForm.processing}>Simpan Dokumentasi</AdminButton>
                    </form>
                </Card>
            )}
            {tenancy.status === 'PENDING_WATER_METER' && (
                <Card title="Start Water Meter">
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
                        <AdminButton type="submit" isLoading={waterForm.processing} className="bg-emerald-600 hover:bg-emerald-700 hover:text-white text-white">
                            Simpan &amp; Aktifkan Tenant
                        </AdminButton>
                    </form>
                </Card>
            )}
        </>
    );
}