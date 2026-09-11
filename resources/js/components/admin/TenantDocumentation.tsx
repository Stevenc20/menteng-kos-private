import { useState, useRef } from "react";
import { router, useForm } from "@inertiajs/react";
import { AdminButton } from "@/components/admin/AdminButton";
import { toast } from "sonner";
import { AdminModal, AdminModalHeader, AdminModalContent, AdminModalFooter } from "@/components/admin/AdminModal";

function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-2xl border border-[#E8E7E3] p-6 shadow-sm ${className}`}>
            {title && <h3 className="font-bold text-lg mb-4 border-b border-neutral-100 pb-2">{title}</h3>}
            {children}
        </div>
    );
}

export function TenantDocumentation({ tenancy, agreement, moveInDoc, moveOutDoc }: any) {
    const { data: suratData, setData: setSuratData, post: postSurat, processing: processingSurat } = useForm({
        document: null as File | null
    });

    const handleSuratUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSuratData("document", e.target.files[0]);
            router.post(route("admin.tenants.agreements.upload", tenancy.id), {
                document: e.target.files[0]
            }, {
                forceFormData: true,
                onSuccess: () => {
                    toast.success("Surat lama berhasil diunggah");
                    setSuratData("document", null);
                },
                onError: (e) => toast.error(e.document || "Gagal mengunggah surat")
            });
        }
    };

    const [showPropModal, setShowPropModal] = useState(false);

    const submitDoc = (type: string, files: File[] = [], propMediaId: string = "") => {
        const formData = new FormData();
        formData.append("type", type);
        files.forEach(f => formData.append("photos[]", f));
        if (propMediaId) formData.append("property_media_id", propMediaId);

        router.post(route("admin.tenants.documentations.store", tenancy.id), formData, {
            onSuccess: () => {
                toast.success("Dokumentasi berhasil ditambahkan");
                setShowPropModal(false);
            },
            onError: () => toast.error("Gagal menambah dokumentasi")
        });
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "MOVE_IN"|"MOVE_OUT") => {
        if (e.target.files && e.target.files.length > 0) {
            submitDoc(type, Array.from(e.target.files));
        }
    };

    const deleteMedia = (mediaId: number) => {
        if (confirm("Yakin ingin menghapus foto dokumentasi ini? Foto properti asli tidak akan terhapus.")) {
            router.delete(route("admin.tenants.documentations.media.destroy", mediaId), {
                onSuccess: () => toast.success("Foto dihapus")
            });
        }
    };

    return (
        <div className="space-y-6 mt-8">
            <Card title={`Surat Pernyataan ${tenancy.property?.type === "KIOSK" ? "Kios" : "Kamar"}`}>
                <div className="flex flex-col gap-4">
                    {agreement?.document_html ? (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                <p className="text-sm text-neutral-500">
                                    Tampilan identik dengan dokumen yang ditandatangani tenant ({tenancy.property?.type === "KIOSK" ? "template Kios" : "template Kamar"}).
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
                            (Belum ada Surat Pernyataan Digital dari tenant)
                        </div>
                    )}

                    {agreement?.uploaded_document_path ? (
                        <div className="border rounded-lg p-4 bg-neutral-50 flex items-center justify-between mt-4">
                            <div>
                                <p className="font-semibold text-sm">Dokumen Scan / Surat Fisik Lama Tersedia</p>
                                <p className="text-xs text-neutral-500">Telah diunggah oleh Admin</p>
                            </div>
                            <a href={route("admin.tenants.agreements.download", tenancy.id)} className="bg-[#1A1A18] text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
                                Unduh File
                            </a>
                        </div>
                    ) : (
                        <div className="border border-dashed border-neutral-300 p-6 rounded-xl flex flex-col items-center text-center bg-neutral-50/50 mt-4">
                            <svg className="w-8 h-8 text-neutral-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <h4 className="font-semibold text-sm mb-1">Upload / Scan Surat Lama</h4>
                            <p className="text-xs text-neutral-500 mb-4 max-w-sm">Gunakan fitur ini jika tenant sudah memiliki surat pernyataan fisik lama untuk diarsipkan secara digital.</p>
                            <label className="bg-white border border-neutral-200 text-neutral-700 px-4 py-2 flex items-center gap-2 cursor-pointer font-semibold rounded-lg hover:bg-neutral-100 transition shadow-sm text-sm">
                                {processingSurat ? "Mengunggah..." : "Pilih File / Buka Kamera"}
                                <input type="file" className="hidden" accept="image/*,application/pdf" capture="environment" onChange={handleSuratUpload} disabled={processingSurat} />
                            </label>
                        </div>
                    )}
                </div>
            </Card>

            <Card title="Dokumentasi Kondisi Unit">
                <p className="text-sm text-neutral-500 mb-6">Dokumentasi ini digunakan untuk mencatat snapshot historis kondisi unit sebelum dan sesudah ditempati.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h4 className="font-bold text-neutral-700 mb-3 flex items-center gap-2">
                            <span className="bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded text-xs">BEFORE</span>
                            Saat Tenant Masuk
                        </h4>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                            {moveInDoc?.media?.map((m: any) => (
                                <div key={m.id} className="relative group aspect-square bg-neutral-100 rounded-lg overflow-hidden border">
                                    <img src={`/storage/${m.file_path}`} className="object-cover w-full h-full" alt="Before" />
                                    <button onClick={() => deleteMedia(m.id)} className="absolute top-1 right-1 bg-white/90 text-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-50">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <label className="cursor-pointer bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-700 text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition">
                                Upload
                                <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, "MOVE_IN")} />
                            </label>
                            <label className="cursor-pointer bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-700 text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition">
                                Kamera
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhotoUpload(e, "MOVE_IN")} />
                            </label>
                            <button type="button" onClick={() => setShowPropModal(true)} className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition">
                                Pilih dari Properti
                            </button>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-neutral-700 mb-3 flex items-center gap-2">
                            <span className="bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded text-xs">AFTER</span>
                            Saat Tenant Keluar
                        </h4>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                            {moveOutDoc?.media?.map((m: any) => (
                                <div key={m.id} className="relative group aspect-square bg-neutral-100 rounded-lg overflow-hidden border">
                                    <img src={`/storage/${m.file_path}`} className="object-cover w-full h-full" alt="After" />
                                    <button onClick={() => deleteMedia(m.id)} className="absolute top-1 right-1 bg-white/90 text-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-50">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <label className="cursor-pointer bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-700 text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition">
                                Upload
                                <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, "MOVE_OUT")} />
                            </label>
                            <label className="cursor-pointer bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-700 text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition">
                                Kamera
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhotoUpload(e, "MOVE_OUT")} />
                            </label>
                        </div>
                    </div>
                </div>
            </Card>

            <AdminModal isOpen={showPropModal} onClose={() => setShowPropModal(false)}>
                <AdminModalHeader title="Pilih Foto dari Properti" onClose={() => setShowPropModal(false)} />
                <AdminModalContent>
                    <p className="text-sm text-neutral-500 mb-4">Pilih foto yang akan di-copy sebagai snapshot BEFORE untuk tenant ini. Foto asli pada properti tidak akan terhapus atau berubah.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {tenancy.property?.media?.length > 0 ? tenancy.property.media.map((m: any) => (
                            <div key={m.id} className="relative aspect-square group rounded-lg overflow-hidden border border-neutral-200 cursor-pointer" onClick={() => submitDoc("MOVE_IN", [], m.id)}>
                                <img src={m.url || `/storage/${m.original_path}`} className="object-cover w-full h-full group-hover:scale-105 transition" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition">
                                    <span className="opacity-0 group-hover:opacity-100 text-white font-bold text-sm bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-sm">Gunakan</span>
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full py-8 text-center text-neutral-500 border border-dashed rounded-lg">Properti ini belum memiliki foto.</div>
                        )}
                    </div>
                </AdminModalContent>
                <AdminModalFooter>
                    <AdminButton variant="secondary" onClick={() => setShowPropModal(false)}>Batal</AdminButton>
                </AdminModalFooter>
            </AdminModal>
        </div>
    );
}

