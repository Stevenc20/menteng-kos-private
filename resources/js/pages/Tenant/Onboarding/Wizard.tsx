import { useState, useRef } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import SignatureCanvas from 'react-signature-canvas';

interface Tenancy {
    id: number;
    agreed_price: string;
    move_in_date: string;
    property: {
        name: string;
        type: string;
    };
}

interface Profile {
    id?: number;
    // ...other existing profile fields if resuming
}

interface WizardProps {
    tenancy: Tenancy;
    profile: Profile;
}

export default function Wizard({ tenancy, profile }: WizardProps) {
    const [step, setStep] = useState(1);
    const totalSteps = 8;

    // React Signature Canvas refs
    const sigPad1 = useRef<any>(null);
    const parafPad1 = useRef<any>(null);
    const sigPad2 = useRef<any>(null);
    const parafPad2 = useRef<any>(null);

    const formatRupiah = (val: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val));

    const dailyLatePenalty = formatRupiah(Math.round(Number(tenancy.agreed_price) / 30));

    const { data, setData, post, processing, errors } = useForm({
        whatsapp: '',
        ktp_1_name: '',
        ktp_1_nik: '',
        ktp_1_birth_place: '',
        ktp_1_birth_date: '',
        ktp_1_job: '',
        ktp_1_address: '',
        ktp_1_photo: null as File | null,
        ktp_1_photo_preview: null as string | null,
        
        has_second_occupant: false,
        
        ktp_2_name: '',
        ktp_2_nik: '',
        ktp_2_birth_place: '',
        ktp_2_birth_date: '',
        ktp_2_job: '',
        ktp_2_address: '',
        ktp_2_photo: null as File | null,
        ktp_2_photo_preview: null as string | null,

        // For Final Agreement
        document_html: '',
        signature_1: '',
        paraf_1: '',
        signature_2: '',
        paraf_2: '',
    });

    const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, occupantNum: 1 | 2) => {
        const file = e.target.files?.[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            if (occupantNum === 1) {
                setData(d => ({ ...d, ktp_1_photo: file, ktp_1_photo_preview: previewUrl }));
            } else {
                setData(d => ({ ...d, ktp_2_photo: file, ktp_2_photo_preview: previewUrl }));
            }
        }
    };

    const submitInfo = () => {
        post('/tenant/onboarding/info', {
            preserveScroll: true,
            onSuccess: () => nextStep(),
        });
    };

    const generateAgreementHTML = () => {
        // Build agreement based on data
        const html = `
            <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                <h2 style="text-align: center; text-transform: uppercase;">Surat Pernyataan Penghuni</h2>
                <p>Yang bertanda tangan di bawah ini:</p>
                <table style="width: 100%; margin-bottom: 20px;">
                    <tr><td style="width: 150px;">Nama Lengkap</td><td>: ${data.ktp_1_name}</td></tr>
                    <tr><td>Tempat, Tgl Lahir</td><td>: ${data.ktp_1_birth_place}, ${data.ktp_1_birth_date}</td></tr>
                    <tr><td>Pekerjaan</td><td>: ${data.ktp_1_job}</td></tr>
                    <tr><td>No KTP</td><td>: ${data.ktp_1_nik}</td></tr>
                    <tr><td>Alamat</td><td>: ${data.ktp_1_address}</td></tr>
                </table>
                ${data.has_second_occupant ? `
                    <p>Dan Penghuni Kedua:</p>
                    <table style="width: 100%; margin-bottom: 20px;">
                        <tr><td style="width: 150px;">Nama Lengkap</td><td>: ${data.ktp_2_name}</td></tr>
                        <tr><td>No KTP</td><td>: ${data.ktp_2_nik}</td></tr>
                    </table>
                ` : ''}
                <p>Menyatakan setuju untuk menempati unit <strong>${tenancy.property.name}</strong> di Menteng Kos Private mulai tanggal <strong>${tenancy.move_in_date}</strong> dengan ketentuan sebagai berikut:</p>
                <ol>
                    <li>Biaya sewa per bulan adalah <strong>${formatRupiah(tenancy.agreed_price)}</strong>.</li>
                    <li>Tagihan jatuh tempo dihitung per siklus 30 hari. Denda keterlambatan adalah <strong>${dailyLatePenalty} / hari</strong>.</li>
                    <li>Jatah air (Included Allowance) adalah <strong>5 m³ / bulan</strong>. Kelebihan pemakaian air akan dikenakan biaya tambahan sebesar <strong>Rp14.000 / m³</strong> yang akan ditambahkan ke dalam total tagihan sewa.</li>
                    <li>Penghuni wajib menjaga kebersihan dan tidak merusak fasilitas properti. Segala kerusakan menjadi tanggung jawab penghuni.</li>
                </ol>
                <p>Demikian surat pernyataan ini dibuat dengan sebenar-benarnya tanpa paksaan dari pihak mana pun.</p>
            </div>
        `;
        setData('document_html', html);
        nextStep();
    };

    const clearSignatures = () => {
        sigPad1.current?.clear();
        parafPad1.current?.clear();
        sigPad2.current?.clear();
        parafPad2.current?.clear();
    };

    const submitAgreement = () => {
        if (sigPad1.current?.isEmpty() || parafPad1.current?.isEmpty()) {
            alert("Harap lengkapi Tanda Tangan dan Paraf Anda (Occupant 1).");
            return;
        }
        if (data.has_second_occupant && (sigPad2.current?.isEmpty() || parafPad2.current?.isEmpty())) {
            alert("Harap lengkapi Tanda Tangan dan Paraf Penghuni Kedua.");
            return;
        }

        const payload = {
            ...data,
            signature_1: sigPad1.current.getTrimmedCanvas().toDataURL('image/png'),
            paraf_1: parafPad1.current.getTrimmedCanvas().toDataURL('image/png'),
            signature_2: data.has_second_occupant ? sigPad2.current.getTrimmedCanvas().toDataURL('image/png') : '',
            paraf_2: data.has_second_occupant ? parafPad2.current.getTrimmedCanvas().toDataURL('image/png') : '',
        };

        router.post('/tenant/onboarding/agreement', payload);
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6 text-center">
                        <div className="w-16 h-16 bg-neutral-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight">Selamat Datang!</h2>
                        <p className="text-neutral-500 max-w-sm mx-auto">
                            Anda telah diundang menempati unit <strong>{tenancy.property.name}</strong>. Silakan selesaikan proses <i>onboarding</i> untuk mengaktifkan akun Anda.
                        </p>
                        <button onClick={nextStep} className="mt-8 bg-neutral-900 text-white px-8 py-3 rounded-full font-medium hover:bg-neutral-800 transition-colors w-full max-w-xs mx-auto block">
                            Mulai Onboarding
                        </button>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold tracking-tight">Upload KTP (Penghuni 1)</h2>
                        <p className="text-sm text-neutral-500">KTP wajib diunggah. Kami menyimpan data Anda dengan aman (Private Storage).</p>
                        
                        <div className="border-2 border-dashed border-neutral-300 rounded-2xl p-8 text-center relative hover:border-neutral-500 transition-colors bg-neutral-50">
                            {data.ktp_1_photo_preview ? (
                                <div className="space-y-4">
                                    <img src={data.ktp_1_photo_preview} alt="KTP Preview" className="max-h-48 mx-auto rounded-lg shadow-sm" />
                                    <label className="cursor-pointer text-sm font-medium text-neutral-900 underline">
                                        Ganti Foto
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 1)} />
                                    </label>
                                </div>
                            ) : (
                                <label className="cursor-pointer flex flex-col items-center gap-3">
                                    <svg className="w-10 h-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                                    <span className="text-sm font-medium text-neutral-900">Klik untuk upload foto KTP</span>
                                    <span className="text-xs text-neutral-500">Maksimal 5MB (JPG/PNG)</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 1)} />
                                </label>
                            )}
                        </div>
                        {errors.ktp_1_photo && <p className="text-red-500 text-xs">{errors.ktp_1_photo}</p>}
                        
                        <div className="flex gap-3 pt-4">
                            <button onClick={prevStep} className="px-6 py-3 rounded-lg font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 w-1/3">Kembali</button>
                            <button onClick={nextStep} disabled={!data.ktp_1_photo_preview} className="px-6 py-3 rounded-lg font-medium bg-neutral-900 text-white hover:bg-neutral-800 w-2/3 disabled:opacity-50 disabled:cursor-not-allowed">Lanjut</button>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold tracking-tight mb-2">Informasi Pribadi (Penghuni 1)</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Nama Lengkap Sesuai KTP</label><input type="text" value={data.ktp_1_name} onChange={e => setData('ktp_1_name', e.target.value)} className="w-full border-neutral-300 rounded-lg" required /></div>
                            <div><label className="block text-sm font-medium mb-1">Nomor KTP (NIK)</label><input type="text" value={data.ktp_1_nik} onChange={e => setData('ktp_1_nik', e.target.value)} className="w-full border-neutral-300 rounded-lg" required /></div>
                            <div><label className="block text-sm font-medium mb-1">Tempat Lahir</label><input type="text" value={data.ktp_1_birth_place} onChange={e => setData('ktp_1_birth_place', e.target.value)} className="w-full border-neutral-300 rounded-lg" required /></div>
                            <div><label className="block text-sm font-medium mb-1">Tanggal Lahir</label><input type="date" value={data.ktp_1_birth_date} onChange={e => setData('ktp_1_birth_date', e.target.value)} className="w-full border-neutral-300 rounded-lg" required /></div>
                            <div><label className="block text-sm font-medium mb-1">Pekerjaan</label><input type="text" value={data.ktp_1_job} onChange={e => setData('ktp_1_job', e.target.value)} className="w-full border-neutral-300 rounded-lg" required /></div>
                            <div><label className="block text-sm font-medium mb-1">No. WhatsApp</label><input type="text" value={data.whatsapp} onChange={e => setData('whatsapp', e.target.value)} className="w-full border-neutral-300 rounded-lg" required /></div>
                            <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Alamat Sesuai KTP</label><textarea value={data.ktp_1_address} onChange={e => setData('ktp_1_address', e.target.value)} className="w-full border-neutral-300 rounded-lg" rows={3} required /></div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button onClick={prevStep} className="px-6 py-3 rounded-lg font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 w-1/3">Kembali</button>
                            <button onClick={nextStep} className="px-6 py-3 rounded-lg font-medium bg-neutral-900 text-white hover:bg-neutral-800 w-2/3">Lanjut</button>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold tracking-tight">Apakah ada penghuni kedua?</h2>
                        <p className="text-sm text-neutral-500">Kamar kos ini maksimal ditempati oleh 2 penghuni.</p>

                        <div className="flex gap-4">
                            <button onClick={() => { setData('has_second_occupant', false); nextStep(); }} className="w-1/2 p-6 rounded-2xl border-2 border-neutral-200 hover:border-neutral-900 font-bold text-lg transition-colors">TIDAK</button>
                            <button onClick={() => { setData('has_second_occupant', true); nextStep(); }} className="w-1/2 p-6 rounded-2xl border-2 border-neutral-900 bg-neutral-900 text-white font-bold text-lg transition-colors">YA, ADA</button>
                        </div>
                        <div className="pt-4"><button onClick={prevStep} className="px-6 py-3 rounded-lg font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200">Kembali</button></div>
                    </div>
                );
            case 5:
                if (data.has_second_occupant) {
                    return (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold tracking-tight mb-2">Data Penghuni Kedua</h2>
                            
                            {/* Simple upload for occupant 2 */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Upload KTP Penghuni 2</label>
                                <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e, 2)} className="w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200"/>
                                {data.ktp_2_photo_preview && <img src={data.ktp_2_photo_preview} className="h-20 mt-2 rounded" alt="Preview"/>}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Nama Lengkap</label><input type="text" value={data.ktp_2_name} onChange={e => setData('ktp_2_name', e.target.value)} className="w-full border-neutral-300 rounded-lg" required /></div>
                                <div><label className="block text-sm font-medium mb-1">Nomor KTP (NIK)</label><input type="text" value={data.ktp_2_nik} onChange={e => setData('ktp_2_nik', e.target.value)} className="w-full border-neutral-300 rounded-lg" required /></div>
                                <div><label className="block text-sm font-medium mb-1">Tempat Lahir</label><input type="text" value={data.ktp_2_birth_place} onChange={e => setData('ktp_2_birth_place', e.target.value)} className="w-full border-neutral-300 rounded-lg" required /></div>
                                <div><label className="block text-sm font-medium mb-1">Tanggal Lahir</label><input type="date" value={data.ktp_2_birth_date} onChange={e => setData('ktp_2_birth_date', e.target.value)} className="w-full border-neutral-300 rounded-lg" required /></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Pekerjaan</label><input type="text" value={data.ktp_2_job} onChange={e => setData('ktp_2_job', e.target.value)} className="w-full border-neutral-300 rounded-lg" required /></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Alamat Sesuai KTP</label><textarea value={data.ktp_2_address} onChange={e => setData('ktp_2_address', e.target.value)} className="w-full border-neutral-300 rounded-lg" rows={2} required /></div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={prevStep} className="px-6 py-3 rounded-lg font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 w-1/3">Kembali</button>
                                <button onClick={nextStep} className="px-6 py-3 rounded-lg font-medium bg-neutral-900 text-white hover:bg-neutral-800 w-2/3">Lanjut</button>
                            </div>
                        </div>
                    );
                } else {
                    nextStep(); // Skip if no second occupant
                    return null;
                }
            case 6:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold tracking-tight">Review Data Anda</h2>
                        <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-200 text-sm space-y-4">
                            <div>
                                <h3 className="font-bold text-neutral-900 border-b border-neutral-200 pb-2 mb-2">Penghuni 1</h3>
                                <div className="grid grid-cols-2 gap-2 text-neutral-600">
                                    <span>Nama:</span> <span className="font-medium text-neutral-900">{data.ktp_1_name}</span>
                                    <span>NIK:</span> <span className="font-medium text-neutral-900">{data.ktp_1_nik}</span>
                                    <span>No. WA:</span> <span className="font-medium text-neutral-900">{data.whatsapp}</span>
                                </div>
                            </div>
                            {data.has_second_occupant && (
                                <div>
                                    <h3 className="font-bold text-neutral-900 border-b border-neutral-200 pb-2 mb-2">Penghuni 2</h3>
                                    <div className="grid grid-cols-2 gap-2 text-neutral-600">
                                        <span>Nama:</span> <span className="font-medium text-neutral-900">{data.ktp_2_name}</span>
                                        <span>NIK:</span> <span className="font-medium text-neutral-900">{data.ktp_2_nik}</span>
                                    </div>
                                </div>
                            )}
                            <div>
                                <h3 className="font-bold text-neutral-900 border-b border-neutral-200 pb-2 mb-2">Informasi Unit</h3>
                                <div className="grid grid-cols-2 gap-2 text-neutral-600">
                                    <span>Unit:</span> <span className="font-medium text-neutral-900">{tenancy.property.name}</span>
                                    <span>Harga Sewa:</span> <span className="font-medium text-neutral-900">{formatRupiah(tenancy.agreed_price)} / bulan</span>
                                    <span>Tanggal Masuk:</span> <span className="font-medium text-neutral-900">{tenancy.move_in_date}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setStep(3)} className="px-6 py-3 rounded-lg font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 w-1/3">Edit Data</button>
                            <button onClick={() => { submitInfo(); }} disabled={processing} className="px-6 py-3 rounded-lg font-medium bg-neutral-900 text-white hover:bg-neutral-800 w-2/3 disabled:opacity-50">
                                {processing ? 'Menyimpan...' : 'Data Sudah Benar'}
                            </button>
                        </div>
                    </div>
                );
            case 7:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold tracking-tight">Review Surat Pernyataan</h2>
                        <p className="text-sm text-neutral-500">Mohon baca dan pahami ketentuan sebelum menandatangani.</p>
                        
                        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm overflow-y-auto max-h-[50vh] text-sm"
                             dangerouslySetInnerHTML={{ __html: data.document_html || generateAgreementHTML() || '' }}
                        />

                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setStep(6)} className="px-6 py-3 rounded-lg font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 w-1/3">Kembali</button>
                            <button onClick={() => { if(!data.document_html) generateAgreementHTML(); nextStep(); }} className="px-6 py-3 rounded-lg font-medium bg-neutral-900 text-white hover:bg-neutral-800 w-2/3">Setuju & Lanjut</button>
                        </div>
                    </div>
                );
            case 8:
                return (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight mb-2">Tanda Tangan Digital</h2>
                            <p className="text-sm text-neutral-500">Berikan Tanda Tangan dan Paraf Anda sebagai bentuk persetujuan Surat Pernyataan.</p>
                        </div>
                        
                        {/* Occupant 1 Signatures */}
                        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                            <h3 className="font-bold mb-4">{data.ktp_1_name} (Penghuni 1)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-neutral-600">Tanda Tangan</label>
                                    <div className="bg-white border border-neutral-300 rounded-lg overflow-hidden">
                                        <SignatureCanvas ref={sigPad1} canvasProps={{ className: 'w-full h-32' }} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-neutral-600">Paraf</label>
                                    <div className="bg-white border border-neutral-300 rounded-lg overflow-hidden">
                                        <SignatureCanvas ref={parafPad1} canvasProps={{ className: 'w-full h-32' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Occupant 2 Signatures */}
                        {data.has_second_occupant && (
                            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                                <h3 className="font-bold mb-4">{data.ktp_2_name} (Penghuni 2)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-neutral-600">Tanda Tangan</label>
                                        <div className="bg-white border border-neutral-300 rounded-lg overflow-hidden">
                                            <SignatureCanvas ref={sigPad2} canvasProps={{ className: 'w-full h-32' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-neutral-600">Paraf</label>
                                        <div className="bg-white border border-neutral-300 rounded-lg overflow-hidden">
                                            <SignatureCanvas ref={parafPad2} canvasProps={{ className: 'w-full h-32' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-4 border-t border-neutral-200">
                            <button onClick={clearSignatures} className="px-6 py-3 rounded-lg font-medium text-neutral-600 border border-neutral-200 hover:bg-neutral-100">Bersihkan Canvas</button>
                            <div className="flex-1"></div>
                            <button onClick={prevStep} className="px-6 py-3 rounded-lg font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200">Kembali</button>
                            <button onClick={submitAgreement} className="px-8 py-3 rounded-lg font-bold bg-neutral-900 text-white hover:bg-neutral-800 shadow-lg">Submit & Selesai</button>
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="min-h-screen bg-neutral-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <Head title="Tenant Onboarding | Menteng Kos Private" />
            
            <div className="max-w-3xl mx-auto">
                {/* Header Progress */}
                <div className="mb-8">
                    <h1 className="text-xl font-bold tracking-tight uppercase text-center mb-6">Menteng Kos Private</h1>
                    <div className="flex justify-between items-center relative">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-neutral-200 rounded-full -z-10"></div>
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-neutral-900 rounded-full -z-10 transition-all duration-500" style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}></div>
                        
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${step >= i ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-neutral-300 text-neutral-400'}`}>
                                {i}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-neutral-200 overflow-hidden">
                    <div className="p-8 md:p-12">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                {renderStep()}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
