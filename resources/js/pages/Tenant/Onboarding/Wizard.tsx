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
    whatsapp?: string;
    ktp_1_photo?: string | null;
    ktp_1_name?: string;
    ktp_1_nik?: string;
    ktp_1_birth_place?: string;
    ktp_1_birth_date?: string;
    ktp_1_job?: string;
    ktp_1_address?: string;
    ktp_2_photo?: string | null;
    ktp_2_name?: string;
    ktp_2_nik?: string;
    ktp_2_birth_place?: string;
    ktp_2_birth_date?: string;
    ktp_2_job?: string;
    ktp_2_address?: string;
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

    const p = (profile as Profile) ?? {};

    const inputClass = "w-full bg-white border border-neutral-300 rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 transition-colors";
    const textareaClass = "w-full bg-white border border-neutral-300 rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 transition-colors min-h-[96px] resize-y";
    const inputLabelClass = "block text-sm font-medium mb-1.5 text-neutral-700";

    const formatRupiah = (val: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val));

    const dailyLatePenalty = formatRupiah(Math.round(Number(tenancy.agreed_price) / 30));

    // Hidden file inputs for camera (capture) and gallery (file picker) per occupant
    const cameraInput1 = useRef<HTMLInputElement>(null);
    const galleryInput1 = useRef<HTMLInputElement>(null);
    const cameraInput2 = useRef<HTMLInputElement>(null);
    const galleryInput2 = useRef<HTMLInputElement>(null);

    const [uploading, setUploading] = useState<{ ktp_1: boolean; ktp_2: boolean }>({ ktp_1: false, ktp_2: false });
    const [uploadError, setUploadError] = useState<{ ktp_1: string; ktp_2: string }>({ ktp_1: '', ktp_2: '' });

    const { data, setData, post, processing, errors } = useForm({
        whatsapp: p.whatsapp ?? '',
        ktp_1_name: p.ktp_1_name ?? '',
        ktp_1_nik: p.ktp_1_nik ?? '',
        ktp_1_birth_place: p.ktp_1_birth_place ?? '',
        ktp_1_birth_date: p.ktp_1_birth_date ?? '',
        ktp_1_job: p.ktp_1_job ?? '',
        ktp_1_address: p.ktp_1_address ?? '',
        ktp_1_photo: null as File | null,
        ktp_1_photo_preview: (p.ktp_1_photo ? `/tenant/onboarding/ktp/ktp_1` : null) as string | null,
        ktp_1_photo_path: p.ktp_1_photo ?? '',
        
        has_second_occupant: false,
        
        ktp_2_name: p.ktp_2_name ?? '',
        ktp_2_nik: p.ktp_2_nik ?? '',
        ktp_2_birth_place: p.ktp_2_birth_place ?? '',
        ktp_2_birth_date: p.ktp_2_birth_date ?? '',
        ktp_2_job: p.ktp_2_job ?? '',
        ktp_2_address: p.ktp_2_address ?? '',
        ktp_2_photo: null as File | null,
        ktp_2_photo_preview: (p.ktp_2_photo ? `/tenant/onboarding/ktp/ktp_2` : null) as string | null,
        ktp_2_photo_path: p.ktp_2_photo ?? '',

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
                setData(d => ({ ...d, ktp_1_photo: file, ktp_1_photo_preview: previewUrl, ktp_1_photo_path: '' }));
            } else {
                setData(d => ({ ...d, ktp_2_photo: file, ktp_2_photo_preview: previewUrl, ktp_2_photo_path: '' }));
            }
        }
    };

    const getXsrfToken = () => {
        const match = document.cookie.match(new RegExp('(^|;\\s*)XSRF-TOKEN=([^;]*)'));
        return match ? decodeURIComponent(match[2]) : '';
    };

    const uploadKtp = async (occupant: 1 | 2): Promise<boolean> => {
        const file = occupant === 1 ? data.ktp_1_photo : data.ktp_2_photo;
        const errKey = occupant === 1 ? 'ktp_1' : 'ktp_2';
        if (!file) return false;

        setUploading(s => ({ ...s, [errKey]: true }));
        setUploadError(s => ({ ...s, [errKey]: '' }));

        const fd = new FormData();
        fd.append(occupant === 1 ? 'ktp_1_photo' : 'ktp_2_photo', file);

        try {
            const res = await fetch('/tenant/onboarding/ktp', {
                method: 'POST',
                body: fd,
                headers: {
                    'Accept': 'application/json',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
            });
            const json = await res.json();
            if (!res.ok) {
                setUploadError(s => ({ ...s, [errKey]: json.message || 'Gagal mengunggah foto KTP.' }));
                return false;
            }
            if (occupant === 1) {
                setData(d => ({ ...d, ktp_1_photo: null, ktp_1_photo_path: json.ktp_1_photo ?? d.ktp_1_photo_path }));
            } else {
                setData(d => ({ ...d, ktp_2_photo: null, ktp_2_photo_path: json.ktp_2_photo ?? d.ktp_2_photo_path }));
            }
            return true;
        } catch (e) {
            setUploadError(s => ({ ...s, [errKey]: 'Gagal mengunggah foto KTP. Periksa koneksi dan coba lagi.' }));
            return false;
        } finally {
            setUploading(s => ({ ...s, [errKey]: false }));
        }
    };

    const handleKtp1Next = async () => {
        if (!data.ktp_1_photo && !data.ktp_1_photo_path) {
            setUploadError(s => ({ ...s, ktp_1: 'Silakan unggah foto KTP terlebih dahulu.' }));
            return;
        }
        if (data.ktp_1_photo) {
            const ok = await uploadKtp(1);
            if (!ok) return;
        }
        nextStep();
    };

    const handleKtp2Next = async () => {
        if (data.ktp_2_photo) {
            const ok = await uploadKtp(2);
            if (!ok) return;
        }
        nextStep();
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
                        <h2 className="text-2xl font-bold tracking-tight">Upload Foto KTP</h2>
                        <p className="text-sm text-neutral-500">Pastikan foto KTP terlihat jelas dan seluruh bagian kartu terlihat. Foto disimpan secara aman (Private Storage).</p>
                        
                        {data.ktp_1_photo_preview ? (
                            <div className="space-y-4">
                                <div className="border-2 border-dashed border-neutral-300 rounded-2xl p-4 text-center bg-neutral-50">
                                    <img src={data.ktp_1_photo_preview} alt="KTP Preview" className="max-h-56 mx-auto rounded-lg shadow-sm" />
                                </div>
                                {data.ktp_1_photo_path && (
                                    <p className="text-xs text-green-600 font-medium text-center">Foto KTP berhasil tersimpan.</p>
                                )}
                                <div className="flex flex-wrap gap-3 justify-center">
                                    <button type="button" onClick={() => cameraInput1.current?.click()} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-colors">
                                        📷 Ganti dengan Kamera
                                    </button>
                                    <button type="button" onClick={() => galleryInput1.current?.click()} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-100 transition-colors">
                                        🖼️ Ganti dari Galeri
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <button type="button" onClick={() => cameraInput1.current?.click()} className="w-full p-6 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 hover:border-neutral-900 transition-colors flex flex-col items-center gap-2">
                                    <span className="text-2xl">📷</span>
                                    <span className="text-sm font-medium text-neutral-900">Ambil Foto dengan Kamera</span>
                                    <span className="text-xs text-neutral-500">Membuka kamera belakang HP</span>
                                </button>
                                <div className="flex items-center gap-3 text-xs text-neutral-400"><div className="flex-1 h-px bg-neutral-200"></div>atau<div className="flex-1 h-px bg-neutral-200"></div></div>
                                <button type="button" onClick={() => galleryInput1.current?.click()} className="w-full p-6 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 hover:border-neutral-900 transition-colors flex flex-col items-center gap-2">
                                    <span className="text-2xl">🖼️</span>
                                    <span className="text-sm font-medium text-neutral-900">Pilih Foto dari Galeri</span>
                                    <span className="text-xs text-neutral-500">Membuka galeri HP</span>
                                </button>
                            </div>
                        )}

                        <input ref={cameraInput1} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(e, 1)} />
                        <input ref={galleryInput1} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 1)} />

                        {uploadError.ktp_1 && <p className="text-red-500 text-sm font-medium">{uploadError.ktp_1}</p>}
                        {errors.ktp_1_photo && <p className="text-red-500 text-xs">{errors.ktp_1_photo}</p>}
                        
                        <div className="flex gap-3 pt-4">
                            <button onClick={prevStep} className="px-6 py-3 rounded-lg font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 w-1/3">Kembali</button>
                            <button onClick={handleKtp1Next} disabled={uploading.ktp_1} className="px-6 py-3 rounded-lg font-medium bg-neutral-900 text-white hover:bg-neutral-800 w-2/3 disabled:opacity-50 disabled:cursor-not-allowed">
                                {uploading.ktp_1 ? 'Mengunggah...' : 'Lanjut'}
                            </button>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold tracking-tight mb-2">Informasi Pribadi (Penghuni 1)</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className={inputLabelClass}>Nama Lengkap Sesuai KTP</label><input type="text" placeholder="Masukkan nama lengkap sesuai KTP" value={data.ktp_1_name} onChange={e => setData('ktp_1_name', e.target.value)} className={inputClass} required /></div>
                            <div><label className={inputLabelClass}>Nomor KTP (NIK)</label><input type="text" placeholder="Masukkan 16 digit NIK" value={data.ktp_1_nik} onChange={e => setData('ktp_1_nik', e.target.value)} className={inputClass} required /></div>
                            <div><label className={inputLabelClass}>Tempat Lahir</label><input type="text" placeholder="Masukkan tempat lahir" value={data.ktp_1_birth_place} onChange={e => setData('ktp_1_birth_place', e.target.value)} className={inputClass} required /></div>
                            <div><label className={inputLabelClass}>Tanggal Lahir</label><input type="date" value={data.ktp_1_birth_date} onChange={e => setData('ktp_1_birth_date', e.target.value)} className={inputClass} required /></div>
                            <div><label className={inputLabelClass}>Pekerjaan</label><input type="text" placeholder="Masukkan pekerjaan" value={data.ktp_1_job} onChange={e => setData('ktp_1_job', e.target.value)} className={inputClass} required /></div>
                            <div><label className={inputLabelClass}>No. WhatsApp</label><input type="text" placeholder="Contoh: 081234567890" value={data.whatsapp} onChange={e => setData('whatsapp', e.target.value)} className={inputClass} required /></div>
                            <div className="md:col-span-2"><label className={inputLabelClass}>Alamat Sesuai KTP</label><textarea placeholder="Masukkan alamat sesuai KTP" value={data.ktp_1_address} onChange={e => setData('ktp_1_address', e.target.value)} className={textareaClass} rows={3} required /></div>
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
                            
                            {/* Upload KTP Penghuni 2: camera / gallery */}
                            <div className="space-y-3">
                                <label className="block text-sm font-medium mb-1">Upload KTP Penghuni 2</label>
                                {data.ktp_2_photo_preview ? (
                                    <div className="space-y-3">
                                        <div className="border-2 border-dashed border-neutral-300 rounded-2xl p-3 text-center bg-neutral-50">
                                            <img src={data.ktp_2_photo_preview} className="max-h-40 mx-auto rounded-lg shadow-sm" alt="Preview KTP Penghuni 2"/>
                                        </div>
                                        <div className="flex flex-wrap gap-3 justify-center">
                                            <button type="button" onClick={() => cameraInput2.current?.click()} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-colors">
                                                📷 Ganti dengan Kamera
                                            </button>
                                            <button type="button" onClick={() => galleryInput2.current?.click()} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-100 transition-colors">
                                                🖼️ Ganti dari Galeri
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button type="button" onClick={() => cameraInput2.current?.click()} className="flex-1 px-4 py-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 hover:border-neutral-900 transition-colors flex items-center justify-center gap-2">
                                            <span>📷</span>
                                            <span className="text-sm font-medium text-neutral-900">Ambil Foto dengan Kamera</span>
                                        </button>
                                        <button type="button" onClick={() => galleryInput2.current?.click()} className="flex-1 px-4 py-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 hover:border-neutral-900 transition-colors flex items-center justify-center gap-2">
                                            <span>🖼️</span>
                                            <span className="text-sm font-medium text-neutral-900">Pilih dari Galeri</span>
                                        </button>
                                    </div>
                                )}
                                <input ref={cameraInput2} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhotoUpload(e, 2)} />
                                <input ref={galleryInput2} type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, 2)} />
                                {uploadError.ktp_2 && <p className="text-red-500 text-sm font-medium">{uploadError.ktp_2}</p>}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className={inputLabelClass}>Nama Lengkap</label><input type="text" placeholder="Masukkan nama lengkap" value={data.ktp_2_name} onChange={e => setData('ktp_2_name', e.target.value)} className={inputClass} required /></div>
                                <div><label className={inputLabelClass}>Nomor KTP (NIK)</label><input type="text" placeholder="Masukkan 16 digit NIK" value={data.ktp_2_nik} onChange={e => setData('ktp_2_nik', e.target.value)} className={inputClass} required /></div>
                                <div><label className={inputLabelClass}>Tempat Lahir</label><input type="text" placeholder="Masukkan tempat lahir" value={data.ktp_2_birth_place} onChange={e => setData('ktp_2_birth_place', e.target.value)} className={inputClass} required /></div>
                                <div><label className={inputLabelClass}>Tanggal Lahir</label><input type="date" value={data.ktp_2_birth_date} onChange={e => setData('ktp_2_birth_date', e.target.value)} className={inputClass} required /></div>
                                <div className="md:col-span-2"><label className={inputLabelClass}>Pekerjaan</label><input type="text" placeholder="Masukkan pekerjaan" value={data.ktp_2_job} onChange={e => setData('ktp_2_job', e.target.value)} className={inputClass} required /></div>
                                <div className="md:col-span-2"><label className={inputLabelClass}>Alamat Sesuai KTP</label><textarea placeholder="Masukkan alamat sesuai KTP" value={data.ktp_2_address} onChange={e => setData('ktp_2_address', e.target.value)} className={textareaClass} rows={2} required /></div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={prevStep} className="px-6 py-3 rounded-lg font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 w-1/3">Kembali</button>
                                <button onClick={handleKtp2Next} disabled={uploading.ktp_2} className="px-6 py-3 rounded-lg font-medium bg-neutral-900 text-white hover:bg-neutral-800 w-2/3 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {uploading.ktp_2 ? 'Mengunggah...' : 'Lanjut'}
                                </button>
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
