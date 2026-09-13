import TenantLayout from '@/layouts/TenantLayout';

interface AgreementProps {
    tenancy: any;
    agreement: any;
    signatures: any[];
    moveInPhotoUrls: string[];
}

const OCCUPANT_LABELS: Record<string, string> = {
    OCCUPANT_1: 'Penghuni 1',
    OCCUPANT_2: 'Penghuni 2',
};

export default function Agreement({ tenancy, agreement, signatures, moveInPhotoUrls }: AgreementProps) {
    const hasStatement = !!agreement?.document_html;

    return (
        <TenantLayout title="Surat Pernyataan">
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Surat Pernyataan</h1>
                <p className="text-neutral-500 mt-1">
                    Dokumen sewa unit <span className="font-medium text-neutral-700">{tenancy?.property?.name}</span>.
                </p>
            </div>

            {!agreement ? (
                <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-neutral-400">
                    <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="font-medium text-neutral-500">Belum ada Surat Pernyataan.</p>
                    <p className="text-sm mt-1 max-w-sm mx-auto">
                        Tim admin akan menyiapkan Surat Pernyataan unit Anda. Dokumen akan tampil di halaman ini setelah tersedia.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Statement document */}
                    {hasStatement && (
                        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
                            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                                <div>
                                    <h2 className="font-bold text-neutral-900">Surat Pernyataan Digital</h2>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        Status {agreement.status_label}
                                        {agreement.signed_at ? ` · Ditandatangani ${agreement.signed_at.split(' ')[0]}` : ''}
                                    </p>
                                </div>
                            </div>
                            <div
                                className="overflow-x-auto border border-neutral-200 rounded-xl bg-neutral-50 max-h-[70vh] overflow-y-auto"
                                dangerouslySetInnerHTML={{ __html: agreement.document_html }}
                            />
                        </div>
                    )}

                    {/* Uploaded scan */}
                    {agreement.has_uploaded && (
                        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <h2 className="font-bold text-neutral-900">Surat Pernyataan (fisik/scan)</h2>
                                <p className="text-xs text-neutral-500 mt-0.5">Versi dokumen yang diunggah oleh admin.</p>
                            </div>
                            <a
                                href={agreement.download_url}
                                className="bg-neutral-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors"
                            >
                                Unduh Dokumen
                            </a>
                        </div>
                    )}

                    {/* Signatures */}
                    {signatures.length > 0 && (
                        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
                            <h2 className="font-bold text-neutral-900 mb-4">Tanda Tangan &amp; Paraf</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {signatures.map((s: any) => (
                                    <div key={s.occupant_type} className="border border-neutral-200 rounded-xl p-4">
                                        <p className="text-sm font-semibold text-neutral-700 mb-3">{OCCUPANT_LABELS[s.occupant_type] ?? s.occupant_type}</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <span className="block text-xs text-neutral-500 mb-1">Tanda Tangan</span>
                                                {s.signature_image ? (
                                                    <img src={s.signature_image} alt="Tanda tangan" className="max-w-full h-20 object-contain border border-neutral-200 bg-white rounded" loading="lazy" />
                                                ) : (
                                                    <span className="text-xs text-neutral-400">—</span>
                                                )}
                                            </div>
                                            <div>
                                                <span className="block text-xs text-neutral-500 mb-1">Paraf</span>
                                                {s.paraf_image ? (
                                                    <img src={s.paraf_image} alt="Paraf" className="max-w-full h-20 object-contain border border-neutral-200 bg-white rounded" loading="lazy" />
                                                ) : (
                                                    <span className="text-xs text-neutral-400">—</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Move-in documentation */}
                    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
                        <h2 className="font-bold text-neutral-900 mb-1">Dokumentasi Kamar (Move-in)</h2>
                        <p className="text-xs text-neutral-500 mb-4">Foto kondisi unit saat pertama kali Anda terima.</p>
                        {moveInPhotoUrls.length === 0 ? (
                            <p className="text-sm text-neutral-400 text-center py-6">Belum ada foto dokumentasi kamar.</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {moveInPhotoUrls.map((url, idx) => (
                                    <a key={idx} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                                        <img src={url} alt={`Dokumentasi ${idx + 1}`} loading="lazy" className="w-full h-32 sm:h-36 object-cover hover:scale-105 transition-transform" />
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </TenantLayout>
    );
}