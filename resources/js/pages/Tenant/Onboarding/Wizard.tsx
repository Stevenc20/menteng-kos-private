import { useState, useRef, useEffect } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import StatementDocument from '@/components/Tenant/StatementDocument';
import KtpCaptureFlow from '@/components/KtpCaptureFlow';
import { buildStatementHTML as buildStatementTemplateHTML, formatRupiah, indonesianToday, calcDueDay, calcReminderDay, type StatementParams } from '@/services/statement';

interface Tenancy {
    id: number;
    agreed_price: string;
    move_in_date: string;
    property: {
        name: string;
        type: string;
        normal_price?: string;
        facilities?: string[] | null;
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

    // Rendered paraf images (drawn once, reused on all required pages)
    const [paraf1Img, setParaf1Img] = useState('');
    const [paraf2Img, setParaf2Img] = useState('');

    const p = (profile as Profile) ?? {};

    const inputClass = "w-full bg-white border border-neutral-300 rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 transition-colors";
    const textareaClass = "w-full bg-white border border-neutral-300 rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 transition-colors min-h-[96px] resize-y";
    const inputLabelClass = "block text-sm font-medium mb-1.5 text-neutral-700";

    const isKiosk = tenancy.property?.type === 'KIOSK';
    const kioskSeparateWater = isKiosk
        && (Number(tenancy.property?.normal_price) || 0) > 0
        && (Number(tenancy.agreed_price) || 0) < (Number(tenancy.property?.normal_price) || 0);

    const formatDisplayDate = (iso?: string) => {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        if (!y || !m || !d) return iso;
        return `${d}-${m}-${y}`;
    };

    const birthLine = (place?: string, date?: string) => [place, formatDisplayDate(date)].filter(Boolean).join(', ');

    // Nilai awal field interaktif surat (jatuh tempo & denda dihitung otomatis)
    const todayISO = () => {
        const t = new Date();
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    };
    // Tanggal masuk = hari ini saat onboarding. Jika admin sudah mengatur tanggal
    // resmi di masa depan, ikuti itu; jika kosong/berada di masa lalu, pakai hari ini.
    const givenMoveIn = tenancy.move_in_date;
    const todayStr = todayISO();
    const moveInDate = !givenMoveIn || givenMoveIn < todayStr ? todayStr : givenMoveIn;
    const initDueDay = calcDueDay(moveInDate);
    const initDenda = String(Math.round(Number(tenancy.agreed_price) / 30) || 0);
    const initFacilities = Array.from({ length: isKiosk ? 8 : 6 }, (_, i) => tenancy.property?.facilities?.[i] ?? '');
    const sewaNumeral = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(tenancy.agreed_price) || 0);

    const [captureOccupant, setCaptureOccupant] = useState<1 | 2 | null>(null);

    const [uploading, setUploading] = useState<{ ktp_1: boolean; ktp_2: boolean }>({ ktp_1: false, ktp_2: false });
    const [uploadError, setUploadError] = useState<{ ktp_1: string; ktp_2: string }>({ ktp_1: '', ktp_2: '' });
    const [ocrStatus, setOcrStatus] = useState<{ ktp_1: string; ktp_2: string }>({ ktp_1: '', ktp_2: '' });

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

        // Field interaktif Surat Pernyataan
        usaha: '',
        meteran_air: '',
        due_date_day: initDueDay,
        denda_per_day: initDenda,
        facilities: initFacilities,

        // For Final Agreement
        document_html: '',
        signature_1: '',
        paraf_1: '',
        signature_2: '',
        paraf_2: '',
    });

    // ─── Draft recovery: simpan draft form ke sessionStorage dan pulihkan
    // setelah refresh browser. Profil backend tetap menang — draft hanya mengisi
    // field yang masih kosong (data yang belum sempat tersimpan tidak hilang).
    const DRAFT_KEY = 'tenant_onboarding_draft_v2';

    useEffect(() => {
        try {
            const { ktp_1_photo, ktp_2_photo, ktp_1_photo_preview, ktp_2_photo_preview, ...draft } = data as any;
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch { /* quota/serialization: abaikan */ }
    }, [data]);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(DRAFT_KEY);
            if (!raw) return;
            const draft = JSON.parse(raw);
            const patch: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(draft)) {
                if (typeof v === 'string' && v !== '' && (data as any)[k] === '') {
                    patch[k] = v;
                }
            }
            if (Object.keys(patch).length) setData(patch);
        } catch { /* corrupted draft: abaikan */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Helpers surat: konten & builder kini di services/statement ───

    const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const handleCapturedPhoto = (file: File, occupantNum: 1 | 2) => {
        setCaptureOccupant(null); // Close modal
        
        const prefix = occupantNum === 1 ? 'ktp_1' : 'ktp_2';
        const errKey = occupantNum === 1 ? 'ktp_1' : 'ktp_2';
        const previewUrl = URL.createObjectURL(file);

        setData(d => ({
            ...d,
            [`${prefix}_photo`]: file,
            [`${prefix}_photo_preview`]: previewUrl,
            [`${prefix}_photo_path`]: '',
        }));
        setOcrStatus(s => ({ ...s, [errKey]: 'Membaca data KTP...' }));
        setUploadError(s => ({ ...s, [errKey]: '' }));
        setUploading(s => ({ ...s, [errKey]: true }));

        // Upload + OCR langsung saat foto dipilih
        void uploadKtp(occupantNum, file);
    };

    const getXsrfToken = () => {
        const match = document.cookie.match(new RegExp('(^|;\\s*)XSRF-TOKEN=([^;]*)'));
        return match ? decodeURIComponent(match[2]) : '';
    };

    const buildProfilePatch = (occProfile: any, prefix?: 'ktp_1' | 'ktp_2') => {
        const profileToFormMap: Record<string, string> = {
            ktp_1_name: 'ktp_1_name',
            ktp_1_nik: 'ktp_1_nik',
            ktp_1_birth_place: 'ktp_1_birth_place',
            ktp_1_birth_date: 'ktp_1_birth_date',
            ktp_1_job: 'ktp_1_job',
            ktp_1_address: 'ktp_1_address',
            ktp_2_name: 'ktp_2_name',
            ktp_2_nik: 'ktp_2_nik',
            ktp_2_birth_place: 'ktp_2_birth_place',
            ktp_2_birth_date: 'ktp_2_birth_date',
            ktp_2_job: 'ktp_2_job',
            ktp_2_address: 'ktp_2_address',
        };

        const patch: Record<string, any> = {};
        for (const [backendKey, formKey] of Object.entries(profileToFormMap)) {
            // Jika ada prefix, hanya proses field yang sesuai dengan prefix tersebut
            if (prefix && !backendKey.startsWith(prefix)) continue;

            const v = occProfile[backendKey];
            patch[formKey] = v ?? '';
        }
        return patch;
    };

    const fetchLatestProfileAndHydrate = async () => {
        try {
            const res = await fetch('/tenant/onboarding/profile', {
                headers: { 'Accept': 'application/json' },
            });
            if (!res.ok) return;
            const json = await res.json();
            if (json.profile) {
                const patch = buildProfilePatch(json.profile);
                setData(prev => ({ ...prev, ...patch }));
            }
        } catch {
            // Jika gagal fetch, lanjutkan dengan state yang ada
        }
    };

    const uploadKtp = async (occupant: 1 | 2, explicitFile?: File): Promise<boolean> => {
        const file = explicitFile ?? (occupant === 1 ? data.ktp_1_photo : data.ktp_2_photo);
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
                const msg = json.message || 'Gagal mengunggah foto KTP.';
                setUploadError(s => ({ ...s, [errKey]: msg }));
                return false;
            }

            const prefix = occupant === 1 ? 'ktp_1' : 'ktp_2';
            const ocrData = json.ocr?.[`ktp_${occupant}`];

            const patch = buildProfilePatch(json.profile ?? {}, prefix);
            patch[`${prefix}_photo`] = null as any;
            patch[`${prefix}_photo_path`] = json[`${prefix}_photo`] ?? json.profile?.[`${prefix}_photo`] ?? data[`${prefix}_photo_path` as keyof typeof data];

            setData(prev => ({ ...prev, ...patch }));

            if (ocrData && !ocrData.error) {
                const filled = [ocrData.name, ocrData.nik, ocrData.birth_place, ocrData.birth_date, ocrData.job, ocrData.address].filter(Boolean).length;
                if (filled === 6) {
                    setOcrStatus(s => ({ ...s, [errKey]: `Data KTP berhasil terbaca otomatis (${filled} data).` }));
                } else if (filled > 2) {
                    setOcrStatus(s => ({ ...s, [errKey]: `Data KTP berhasil dibaca (${filled} data). Silakan periksa dan lengkapi jika ada data yang belum sesuai.` }));
                } else {
                    setOcrStatus(s => ({ ...s, [errKey]: `Foto berhasil disimpan. Beberapa data belum dapat terbaca, silakan lengkapi secara manual.` }));
                }
            } else {
                setOcrStatus(s => ({ ...s, [errKey]: 'Foto berhasil disimpan. Beberapa data belum dapat terbaca, silakan lengkapi secara manual.' }));
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
        if (uploading.ktp_1) return;
        if (!data.ktp_1_photo && !data.ktp_1_photo_path) {
            setUploadError(s => ({ ...s, ktp_1: 'Silakan unggah foto KTP terlebih dahulu.' }));
            return;
        }
        if (data.ktp_1_photo) {
            const ok = await uploadKtp(1);
            if (!ok) return;
        }
        
        // Single source of truth: fetch snapshot profil terbaru dari database
        await fetchLatestProfileAndHydrate();
        nextStep();
    };

    const handleKtp2Next = async () => {
        if (uploading.ktp_2) return;
        if (data.ktp_2_photo) {
            const ok = await uploadKtp(2);
            if (!ok) return;
        }
        
        await fetchLatestProfileAndHydrate();
        nextStep();
    };

    const submitInfo = () => {
        post('/tenant/onboarding/info', {
            preserveScroll: true,
            onSuccess: () => nextStep(),
        });
    };

    const buildStatementHTML = (signatures?: StatementParams['signatures']) => {
        // Single source of truth: services/statement (KAMAR vs KIOS)
        const params: StatementParams = {
            hasSecond: data.has_second_occupant,
            occ1: {
                name: data.ktp_1_name || '(nama penghuni 1)',
                birth: birthLine(data.ktp_1_birth_place, data.ktp_1_birth_date),
                job: data.ktp_1_job,
                address: data.ktp_1_address,
                nik: data.ktp_1_nik,
            },
            occ2: {
                name: data.ktp_2_name || '(nama penghuni 2)',
                birth: birthLine(data.ktp_2_birth_place, data.ktp_2_birth_date),
                job: data.ktp_2_job,
                address: data.ktp_2_address,
                nik: data.ktp_2_nik,
            },
            sewaNumeral,
            dueDay: data.due_date_day || initDueDay,
            reminderDay: calcReminderDay(data.due_date_day || initDueDay),
            dendaPerDay: data.denda_per_day || initDenda,
            meteran: data.meteran_air,
            usaha: data.usaha,
            facilities: data.facilities,
            tanggal: indonesianToday(),
            signatures,
            kioskSeparateWater,
        };
        return buildStatementTemplateHTML(isKiosk, params);
    };

    const generateAgreementHTML = () => {
        setData('document_html', buildStatementHTML());
    };

    const clearSignatures = () => {
        sigPad1.current?.clear();
        parafPad1.current?.clear();
        sigPad2.current?.clear();
        parafPad2.current?.clear();
        setParaf1Img('');
        setParaf2Img('');
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
        if (!data.meteran_air.trim()) {
            alert("Harap isi START METERAN (WAJIB DIISI) pada halaman pertama surat.");
            return;
        }
        const dueNum = Number(data.due_date_day);
        const dendaNum = Number(data.denda_per_day);
        if (!Number.isInteger(dueNum) || dueNum < 1 || dueNum > 31) {
            alert("Tanggal jatuh tempo pembayaran tidak valid (harus 1-31).");
            return;
        }
        if (!Number.isFinite(dendaNum) || dendaNum <= 0) {
            alert("Denda keterlambatan per hari tidak valid (harus angka lebih dari 0).");
            return;
        }

        const sig1 = sigPad1.current?.getImage?.() ?? '';
        const sig2 = data.has_second_occupant ? sigPad2.current?.getImage?.() ?? '' : '';
        const paraf1 = parafPad1.current?.getImage?.() ?? '';
        const paraf2 = data.has_second_occupant ? parafPad2.current?.getImage?.() ?? '' : '';

        const payload = {
            ...data,
            move_in_date: moveInDate,
            document_html: buildStatementHTML({ paraf1, paraf2, sig1, sig2 }),
            due_date_day: dueNum,
            denda_per_day: String(dendaNum),
            signature_1: sig1,
            paraf_1: paraf1,
            signature_2: sig2,
            paraf_2: paraf2,
        };

        router.post('/tenant/onboarding/agreement', payload, {
            onSuccess: () => {
                // Onboarding selesai & data tersimpan permanen → draft tidak perlu lagi.
                try {
                    sessionStorage.removeItem(DRAFT_KEY);
                } catch { /* abaikan */ }
            },
        });
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
                                {data.ktp_1_photo_preview && (
                                    <p className={`text-xs font-medium text-center ${uploading.ktp_1 ? 'text-neutral-500' : 'text-green-600'}`}>
                                        {uploading.ktp_1
                                            ? 'Membaca data KTP dari foto...'
                                            : (ocrStatus.ktp_1 || 'Foto KTP berhasil tersimpan.')}
                                    </p>
                                )}
                                <div className="flex flex-wrap gap-3 justify-center">
                                    <button type="button" onClick={() => setCaptureOccupant(1)} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-colors">
                                        📷 Ganti dengan Kamera
                                    </button>
                                    <button type="button" onClick={() => setCaptureOccupant(1)} className="hidden">
                                        🖼️ Ganti dari Galeri
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <button type="button" onClick={() => setCaptureOccupant(1)} className="w-full p-6 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 hover:border-neutral-900 transition-colors flex flex-col items-center gap-2">
                                    <span className="text-2xl">📷</span>
                                    <span className="text-sm font-medium text-neutral-900">Ambil Foto dengan Kamera</span>
                                    <span className="text-xs text-neutral-500">Membuka kamera belakang HP</span>
                                </button>
                                <div className="flex items-center gap-3 text-xs text-neutral-400"><div className="flex-1 h-px bg-neutral-200"></div>atau<div className="flex-1 h-px bg-neutral-200"></div></div>
                                <button type="button" onClick={() => setCaptureOccupant(1)} className="hidden">
                                    <span className="text-2xl">🖼️</span>
                                    <span className="text-sm font-medium text-neutral-900">Pilih Foto dari Galeri</span>
                                    <span className="text-xs text-neutral-500">Membuka galeri HP</span>
                                </button>
                            </div>
                        )}




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
                                            <button type="button" onClick={() => setCaptureOccupant(2)} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-colors">
                                                📷 Ganti dengan Kamera
                                            </button>
                                            <button type="button" onClick={() => setCaptureOccupant(2)} className="hidden">
                                                🖼️ Ganti dari Galeri
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button type="button" onClick={() => setCaptureOccupant(2)} className="flex-1 px-4 py-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 hover:border-neutral-900 transition-colors flex items-center justify-center gap-2">
                                            <span>📷</span>
                                            <span className="text-sm font-medium text-neutral-900">Ambil Foto dengan Kamera</span>
                                        </button>
                                        <button type="button" onClick={() => setCaptureOccupant(2)} className="hidden">
                                            <span>🖼️</span>
                                            <span className="text-sm font-medium text-neutral-900">Pilih dari Galeri</span>
                                        </button>
                                    </div>
                                )}


                                {data.ktp_2_photo_preview && (
                                    <p className={`text-xs font-medium text-center ${uploading.ktp_2 ? 'text-neutral-500' : 'text-green-600'}`}>
                                        {uploading.ktp_2
                                            ? 'Membaca data KTP dari foto...'
                                            : (ocrStatus.ktp_2 || 'Foto KTP berhasil tersimpan.')}
                                    </p>
                                )}
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
                                    <span>Jenis:</span> <span className="font-medium text-neutral-900">{isKiosk ? 'Kios' : 'Kamar'}</span>
                                    <span>Harga Sewa:</span> <span className="font-medium text-neutral-900">{formatRupiah(tenancy.agreed_price)} / bulan</span>
                                    <span>Tanggal Masuk:</span> <span className="font-medium text-neutral-900">{formatDisplayDate(moveInDate)}</span>
                                    <span>Jatuh Tempo:</span> <span className="font-medium text-neutral-900">tanggal {initDueDay} setiap bulan</span>
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
                        
                        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm overflow-x-hidden text-sm"
                             dangerouslySetInnerHTML={{ __html: data.document_html || buildStatementHTML() }}
                        />

                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setStep(6)} className="px-6 py-3 rounded-lg font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 w-1/3">Kembali</button>
                            <button onClick={() => { if(!data.document_html) generateAgreementHTML(); nextStep(); }} className="px-6 py-3 rounded-lg font-medium bg-neutral-900 text-white hover:bg-neutral-800 w-2/3">Setuju & Lanjut</button>
                        </div>
                    </div>
                );
            case 8:
                return (
                    <div className="space-y-6 w-full min-w-0">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight mb-2">Tanda Tangan Digital</h2>
                            <p className="text-sm text-neutral-500">
                                Dokumen menggunakan template {isKiosk ? <strong className="text-neutral-900">KIOS</strong> : <strong className="text-neutral-900">KAMAR</strong>}. Baca surat sesuai halaman, isi kolom bergaris, lalu buat paraf pada setiap halaman dan tanda tangan pada akhir surat.
                            </p>
                        </div>

                        <div className="w-full min-w-0 overflow-x-hidden bg-neutral-200/70 border border-neutral-300 rounded-xl p-2 sm:p-4">
                            <StatementDocument
                                isKiosk={isKiosk}
                                hasSecond={data.has_second_occupant}
                                occ1={{
                                    name: data.ktp_1_name || '(nama penghuni 1)',
                                    birth: birthLine(data.ktp_1_birth_place, data.ktp_1_birth_date),
                                    job: data.ktp_1_job,
                                    address: data.ktp_1_address,
                                    nik: data.ktp_1_nik,
                                }}
                                occ2={{
                                    name: data.ktp_2_name || '(nama penghuni 2)',
                                    birth: birthLine(data.ktp_2_birth_place, data.ktp_2_birth_date),
                                    job: data.ktp_2_job,
                                    address: data.ktp_2_address,
                                    nik: data.ktp_2_nik,
                                }}
                                sewaNumeral={sewaNumeral}
                                dueDay={data.due_date_day}
                                setDueDay={(v) => setData('due_date_day', v)}
                                reminderDay={calcReminderDay(data.due_date_day || initDueDay)}
                                dendaPerDay={data.denda_per_day}
                                setDendaPerDay={(v) => setData('denda_per_day', v)}
                                meteran={data.meteran_air}
                                setMeteran={(v) => setData('meteran_air', v)}
                                usaha={data.usaha}
                                setUsaha={(v) => setData('usaha', v)}
                                facilities={data.facilities}
                                setFacilities={(v) => setData('facilities', v)}
                                tanggal={indonesianToday()}
                                paraf1Img={paraf1Img}
                                paraf2Img={paraf2Img}
                                onParafEnd={(occupant) => {
                                    const url = occupant === 1 ? parafPad1.current?.getImage?.() : parafPad2.current?.getImage?.();
                                    if (url) {
                                        if (occupant === 1) setParaf1Img(url);
                                        else setParaf2Img(url);
                                    }
                                }}
                                sigRef1={sigPad1}
                                parafRef1={parafPad1}
                                sigRef2={sigPad2}
                                parafRef2={parafPad2}
                                kioskSeparateWater={kioskSeparateWater}
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full">
                            <button onClick={clearSignatures} className="w-full sm:w-auto px-6 py-3 rounded-lg font-medium text-neutral-600 border border-neutral-200 hover:bg-neutral-100 transition-colors">
                                Bersihkan Canvas
                            </button>
                            <button onClick={prevStep} className="w-full sm:w-auto px-6 py-3 rounded-lg font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors">
                                Kembali
                            </button>
                            <button onClick={submitAgreement} className="w-full sm:flex-1 px-8 py-3 rounded-lg font-bold bg-neutral-900 text-white hover:bg-neutral-800 shadow-lg transition-colors">
                                Submit & Selesai
                            </button>
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