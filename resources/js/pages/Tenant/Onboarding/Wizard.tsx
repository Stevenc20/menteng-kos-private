import { useState, useRef, type ReactNode } from 'react';
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

function SheetPage({ num, meteran = false, children }: { num: number; meteran?: boolean; children: ReactNode }) {
    return (
        <div className="relative mx-auto mb-6 w-full min-w-0 max-w-[794px] min-h-[1122px] bg-white shadow-lg border border-neutral-200">
            <div className="flex justify-between items-start px-[9%] pt-6">
                <span className="font-serif italic text-sm text-neutral-700">Menteng Kost</span>
                {meteran && (
                    <div className="border-[1.5px] border-neutral-600 px-3 py-1 text-center shrink-0">
                        <div className="text-xs font-bold tracking-wide">START METERAN:</div>
                        <div className="text-[9px] italic text-neutral-500">WAJIB DIISI</div>
                    </div>
                )}
            </div>
            <div className="px-[9%] pt-3 pb-16 text-sm text-neutral-800 leading-relaxed">{children}</div>
            <div className="absolute left-0 right-0 bottom-4 text-center text-sm text-neutral-600">{num}</div>
        </div>
    );
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

    const formatRupiah = (val: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val));

    const dailyLatePenalty = formatRupiah(Math.round(Number(tenancy.agreed_price) / 30));

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const formatDisplayDate = (iso?: string) => {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        if (!y || !m || !d) return iso;
        return `${d}-${m}-${y}`;
    };

    const indonesianToday = () => {
        const t = new Date();
        return `${String(t.getDate()).padStart(2, '0')} ${monthNames[t.getMonth()]} ${t.getFullYear()}`;
    };

    // Hidden file inputs for camera (capture) and gallery (file picker) per occupant
    const cameraInput1 = useRef<HTMLInputElement>(null);
    const galleryInput1 = useRef<HTMLInputElement>(null);
    const cameraInput2 = useRef<HTMLInputElement>(null);
    const galleryInput2 = useRef<HTMLInputElement>(null);

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

        // For Final Agreement
        document_html: '',
        signature_1: '',
        paraf_1: '',
        signature_2: '',
        paraf_2: '',
    });

    // ─── Surat Pernyataan content (verbatim from reference PDF) ───
    const esc = (s?: string) => (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);

    const occ1Name = data.ktp_1_name || '(nama penghuni 1)';
    const occ2Name = data.ktp_2_name || '(nama penghuni 2)';
    const sewaNumeral = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(tenancy.agreed_price) || 0);
    const billingDay = tenancy.move_in_date ? tenancy.move_in_date.split('-')[2] : '';
    const billingDayLine = billingDay ? `tanggal ${billingDay} setiap bulannya` : 'tanggal ………………………… setiap bulannya';

    const birthLine = (place?: string, date?: string) => [place, formatDisplayDate(date)].filter(Boolean).join(', ');

    const pasal1Text = data.has_second_occupant
        ? `Yang menempati kos adalah <strong>${esc(occ1Name)}</strong> dan <strong>${esc(occ2Name)}</strong>, serta Tidak diperbolehkan ada orang lain yang tinggal di kos ini selain nama-nama yang tertera dalam pernyataan ini, jika melanggar maka pengelola kos berhak <strong>memutus</strong> <strong>SEWA/KONTRAK</strong> dan penghuni wajib mengosongkan kamar tanpa <strong>KOMPENSASI</strong>.`
        : `Yang menempati kos adalah <strong>${esc(occ1Name)}</strong>, serta Tidak diperbolehkan ada orang lain yang tinggal di kos ini selain nama-nama yang tertera dalam pernyataan ini, jika melanggar maka pengelola kos berhak <strong>memutus</strong> <strong>SEWA/KONTRAK</strong> dan penghuni wajib mengosongkan kamar tanpa <strong>KOMPENSASI</strong>.`;

    const peraturanCos = [
        'Saat pertama kali menempati kosan wajib menyerahkan <strong>KTP dan KK</strong> yang akan menghuni, 1x24 jam wajib lapor <strong>RT</strong>.',
        'Saya bertanggung jawab penuh atas <strong>kerusakan</strong> atau <strong>kehilangan</strong> fasilitas yang ada di dalam <strong>kamar kos</strong> selama <strong>masa sewa</strong>. Jika terjadi <strong>kerusakan akibat kelalaian saya</strong>, saya akan <strong>mengganti kerugian</strong> sesuai dengan <strong>nilai kerusakan</strong> yang ditentukan oleh <strong>pihak pengelola kos</strong>.',
        'Mematuhi peraturan <strong>HUKUM</strong> yang berlaku di <strong>Indonesia</strong> dan <strong>Menjaga norma kesopanan</strong> serta <strong>kesusilaan (TIDAK BOLEH OPEN BO)</strong>. Dan <strong>tidak menimbulkan kegaduhan bagi penghuni lain</strong>.',
        'Keluar masuk <strong>gerbang utama wajib menutup dan mengunci Kembali</strong>, dan bila diatas <strong>pukul 22.00 WIB</strong>, <strong>wajib mengembok gerbang utama!</strong>.',
    ];

    const menjagaKeamananItems = [
        'Selain penghuni kos-an dilarang membawa <strong>tamu</strong> kedalam <strong>kamar</strong> termasuk <strong>kurir</strong> dan <strong>tamu</strong> “tidak dikenal” hanya boleh diterima diluar kamar, kecuali ada <strong>izin</strong> dari <strong>PENGELOLA KOS</strong>.',
        '<strong>Dilarang</strong> menyewakan kamar kepada orang lain selain nama yang sudah tertera dalam <strong>SURAT PERNYATAAN</strong>, jika melanggar maka <strong>pengelola kos BERHAK memutus SEWA/KONTRAK</strong> dan penghuni wajib mengosongkan kamar serta membersihkan kamar seperti semula dan tidak menerima <strong>KOMPENSASI</strong>.',
    ];

    const biayaTerhutang = [
        'Setiap kamar akan dikenakan biaya perbulan sebesar <strong>Rp 100.000</strong> (seratus ribu rupiah) untuk <strong>iuran sampah</strong> dan <strong>air</strong> sebanyak <strong>5m³ per kamar</strong> dihitung berdasarkan angka meteran yang terpasang dimasing-masing kamar.',
        'Biaya tambahan air <strong>PDAM</strong> sebesar <strong>Rp14.000/m³</strong> untuk pemakaian lebih dari <strong>5m³</strong>, dihitung sesuai angka meteran permasing-masing kamar bersamaan tanggal pembayaran kos.',
        '<strong>Pembacaan meteran air</strong> akan dilakukan <strong>setiap tanggal</strong> pembayaran kos untuk masing-masing kamar.',
    ];

    const pasal5Intro = `saya menyatakan bahwa membayar biaya sewa kos sebesar <strong>Rp ${sewaNumeral}</strong> per bulan. Pembayaran dilakukan setiap bulan, 1 hari sebelum tanggal jatuh tempo, ${billingDayLine}.`;

    const pasal5Denda = `Jika saya terlambat melakukan pembayaran setelah tanggal jatuh tempo, saya akan dikenakan denda sebesar <strong>${dailyLatePenalty}</strong> per hari keterlambatan sesuai dengan ketentuan yang berlaku. Maksimal denda keterlambatan <strong>2 hari, diatas 2 hari wajib mengosongkan kosan</strong>.`;

    const pasal5AkhirP1 = 'Jika saya berniat untuk mengakhiri masa sewa sebelum waktu yang disepakati, saya akan memberikan pemberitahuan kepada pihak <strong>PENGELOLA KOS</strong> 5 hari';

    const pasal5AkhirP2 = 'sebelumnya dan bertanggung jawab atas pembayaran sewa yang masih terhutang serta kewajiban lain, seperti: air <strong>PDAM</strong> yang <strong>telah digunakan</strong> hingga <strong>saat pengosongan dilakukan</strong>.';

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
                const msg = json.message || 'Gagal mengunggah foto KTP.';
                setUploadError(s => ({ ...s, [errKey]: msg }));
                return false;
            }

            const prefix = occupant === 1 ? 'ktp_1' : 'ktp_2';
            const ocrData = json.ocr?.[`ktp_${occupant}`];
            const hasOcrFields = ocrData && !ocrData.error && (ocrData.name || ocrData.nik || ocrData.birth_place || ocrData.birth_date || ocrData.job || ocrData.address);

            setData(`${prefix}_photo`, null);
            setData(`${prefix}_photo_path`, json[`${prefix}_photo`] ?? data[`${prefix}_photo_path` as keyof typeof data]);

            if (hasOcrFields) {
                if (ocrData.name) setData(`${prefix}_name`, ocrData.name);
                if (ocrData.nik) setData(`${prefix}_nik`, ocrData.nik);
                if (ocrData.birth_place) setData(`${prefix}_birth_place`, ocrData.birth_place);
                if (ocrData.birth_date) setData(`${prefix}_birth_date`, ocrData.birth_date);
                if (ocrData.job) setData(`${prefix}_job`, ocrData.job);
                if (ocrData.address) setData(`${prefix}_address`, ocrData.address);
            }

            if (ocrData && !ocrData.error) {
                const filled = [ocrData.name, ocrData.nik, ocrData.birth_place, ocrData.birth_date, ocrData.job, ocrData.address].filter(Boolean).length;
                if (filled > 0) {
                    setOcrStatus(s => ({ ...s, [errKey]: `Data KTP berhasil dipindai (${filled} field terisi). Silakan periksa di langkah berikutnya.` }));
                } else {
                    setOcrStatus(s => ({ ...s, [errKey]: 'Foto tersimpan, namun data tidak terbaca otomatis. Silakan isi manual.' }));
                }
            } else {
                setOcrStatus(s => ({ ...s, [errKey]: 'Foto tersimpan. Silakan isi data secara manual.' }));
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

    const buildIdentityRows = (rows: [string, string][]) =>
        rows.map(([k, v], i) => (
            <div key={i} className="flex gap-2 items-start">
                <span className="w-28 sm:w-36 shrink-0 text-neutral-600">{k}</span>
                <span className="text-neutral-900 font-medium break-words min-w-0 flex-1">: {v}</span>
            </div>
        ));

    const buildStatementHTML = () => {
        // Build agreement based on data (full 3-page layout mirroring the reference PDF)
        const identity1: [string, string][] = [
            ['Nama (1)', occ1Name],
            ['Tempat, Tgl Lahir', birthLine(data.ktp_1_birth_place, data.ktp_1_birth_date)],
            ['Pekerjaan', data.ktp_1_job],
            ['Alamat', data.ktp_1_address],
            ['Nomor KTP', data.ktp_1_nik],
        ];
        const identity2: [string, string][] = [
            ['Nama (2)', occ2Name],
            ['Tempat, Tgl Lahir', birthLine(data.ktp_2_birth_place, data.ktp_2_birth_date)],
            ['Pekerjaan', data.ktp_2_job],
            ['Alamat', data.ktp_2_address],
            ['Nomor KTP', data.ktp_2_nik],
        ];
        const rowHtml = (r: [string, string][]) => r
            .map(([k, v]) => `<tr><td style="width:150px;vertical-align:top;padding:3px 0;">${k}</td><td style="padding:3px 0;">: ${esc(v)}</td></tr>`)
            .join('');

        const meteranBox = `
            <div style="border:1.5px solid #666;padding:5px 12px;text-align:center;font-size:11px;">
                <div style="font-weight:bold;">START METERAN:</div>
                <div style="font-style:italic;font-size:9px;">WAJIB DIISI</div>
            </div>`;

        const pageFrame = (num: number, inner: string, parafY?: string) => `
            <div style="position:relative;width:100%;max-width:794px;margin:0 auto 24px;min-height:1122px;padding:22px 9% 56px;box-sizing:border-box;border:1px solid #ddd;background:#fff;font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.65;font-size:14px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <span style="font-style:italic;">Menteng Kost</span>
                    ${num === 1 ? meteranBox : ''}
                </div>
                ${inner}
                <div style="position:absolute;bottom:16px;left:0;right:0;text-align:center;">${num}</div>
                ${parafY ? `
                    <div style="position:absolute;left:1.5%;top:${parafY};font-size:11px;">Paraf (1)</div>
                    <div style="position:absolute;right:1.5%;top:${parafY};font-size:11px;">Paraf (2)</div>
                ` : ''}
            </div>`;

        const p1Body = `
            <h2 style="text-align:center;letter-spacing:1px;margin:14px 0 18px;font-size:17px;">SURAT PERNYATAAN</h2>
            <p>Yang bertanda tangan di bawah ini:</p>
            <table style="width:100%;"><tbody>${rowHtml(identity1)}</tbody></table>
            ${data.has_second_occupant ? `
                <p style="margin:10px 0 2px;">Dan pasangan saya,</p>
                <table style="width:100%;"><tbody>${rowHtml(identity2)}</tbody></table>
            ` : ''}
            <p style="margin-top:18px;">Dengan ini kami menyatakan dengan sebenar-benarnya bahwa:</p>
            <p style="font-weight:bold;">1. Menempati Kosan</p>
            <p style="text-align:justify;">${pasal1Text}</p>
            <p style="font-weight:bold;">2. Kepatuhan Terhadap Peraturan Kos</p>
            <p style="text-align:justify;">Bersedia mematuhi segala peraturan kos baik yang tertulis maupun tidak tertulis, seperti:</p>
            <ul style="padding-left:24px;margin:4px 0;">
                ${peraturanCos.map(t => `<li style="margin:6px 0;text-align:justify;">${t}</li>`).join('')}
            </ul>
            <p style="text-align:justify;">Menjaga keamanan dan kenyaman Bersama, seperti:</p>`;

        const p2Body = `
            <ul style="padding-left:24px;margin:0;">
                ${menjagaKeamananItems.map(t => `<li style="margin:8px 0;text-align:justify;">${t}</li>`).join('')}
            </ul>
            <p style="text-align:justify;">Semua fasilitas yang ada wajib <strong>dirawat</strong> dan <strong>dijaga</strong> seperti:</p>
            <ol style="padding-left:24px;margin:4px 0;">
                ${[1, 2, 3, 4, 5, 6].map(n => `
                    <li style="margin:3px 0;">${n === 6 ? '<span style="text-decoration:underline;">______________________</span> <em style="font-size:11px;">!note: jika ada ac wajib mencuci ac 2 bulan sekali.</em>' : '<span style="text-decoration:underline;">______________________</span>'}</li>
                `).join('')}
            </ol>
            <p style="font-weight:bold;">3. Kepatuhan Terhadap Pembayaran</p>
            <p style="font-weight:bold;">4. Kewajiban Terhadap Biaya Yang Terhutang</p>
            <p style="text-align:justify;">Saya sebagai penghuni kos bersedia <strong>membayar biaya yang terhutang</strong> seperti:</p>
            <ol style="padding-left:24px;margin:4px 0;">
                ${biayaTerhutang.map(t => `<li style="margin:6px 0;text-align:justify;">${t}</li>`).join('')}
            </ol>
            <p style="font-weight:bold;">5. Keterlambatan Pembayaran</p>
            <p style="text-align:justify;">${pasal5Intro}</p>
            <p style="text-align:justify;">${pasal5Denda}</p>
            <p style="text-align:justify;">${pasal5AkhirP1}</p>`;

        const p3Body = `
            <p style="text-align:justify;">${pasal5AkhirP2}</p>
            <p style="font-weight:bold;">6. Pengosongan Kamar</p>
            <p style="font-weight:bold;">7. Peraturan Tambahan</p>
            <p style="text-align:justify;"><span style="font-family:Wingdings;">➢</span> Saya menyadari bahwa <strong>PENGELOLA KOS</strong> berhak meminta saya untuk mengosongkan kamar kosan apabila:</p>
            <ol style="padding-left:24px;margin:4px 0;">
                <li style="margin:4px 0;">Saya telat melakukan pembayaran melebihi 2 hari seperti di <em><strong>point 4</strong></em> <em><strong>keterlambatan</strong></em>.</li>
                <li style="margin:4px 0;">Saya melakukan <em><strong>PELANGGARAN BERAT</strong></em> terhadap peraturan hukum yang berlaku di Indonesia (seperti <strong>PERJUDIAN, NARKOBA</strong>, dan <strong>TINDAK PIDANA BERAT</strong> lainnya, yang DILARANG sesuai dengan <em><strong>Pasal 303 KUHP</strong></em> tentang <em><strong>perjudian</strong></em> dan <em><strong>Pasal 112, Pasal 113, Pasal 114 UU No. 35 Tahun 2009 tentang Narkotika</strong></em>).</li>
            </ol>
            <p style="text-align:justify;"><span style="font-family:Wingdings;">➢</span> Saya menyadari bahwa peraturan terkait <em><strong>pengelolaan kos dapat berubah</strong></em> <em><strong>sewaktu-waktu</strong></em>, dan <strong>saya berjanji</strong> untuk selalu <strong>mengikuti peraturan baru</strong> yang <strong>diberlakukan</strong> oleh pihak pengelola kos. Apabila saya telah <strong>menerima</strong> <strong>dua</strong> kali <strong>teguran</strong>, baik secara <em><strong>lisan</strong></em> maupun <em><strong>tertulis</strong></em>, dari <strong>PENGELOLA KOS</strong> atas <strong>pelanggaran peraturan</strong> dan masih <strong>mengulanginya</strong> <strong>kembali</strong>, <strong>SAYA BERSEDIA</strong> untuk <strong>mengosongkan</strong> <strong>kosan</strong> dan <strong>mengembalikan</strong> <strong>kunci kamar</strong> serta <strong>gembok pagar</strong> tanpa <strong>MENUNTUT KOMPENSASI APAPUN</strong>!, serta <strong>TETAP MEMBAYARKAN SISA KEWAJIBAN JIKA ADA</strong>.</p>
            <p style="text-align:justify;">Demikian surat pernyataan ini saya buat dengan sebenar-benarnya tanpa ada paksaan atau tekanan dari pihak manapun.</p>
            <p style="margin-top:14px;"><strong>Dibuat di:</strong> Jakarta</p>
            <p><strong>Pada tanggal:</strong> ${indonesianToday()}</p>
            <p style="margin-top:22px;"><strong>Yang Membuat Pernyataan,</strong></p>
            <div style="display:flex;gap:50px;margin-top:26px;">
                <div style="flex:1;max-width:300px;">
                    <p>Tanda Tangan (1),</p>
                    <div style="height:110px;"></div>
                    <p>Nama: <strong>${esc(occ1Name)}</strong>.</p>
                    <p>No. KTP: <strong>${esc(data.ktp_1_nik)}</strong>.</p>
                </div>
                ${data.has_second_occupant ? `
                    <div style="flex:1;max-width:300px;">
                        <p>Tanda Tangan (2),</p>
                        <div style="height:110px;"></div>
                        <p>Nama: <strong>${esc(occ2Name)}</strong>.</p>
                        <p>No. KTP: <strong>${esc(data.ktp_2_nik)}</strong>.</p>
                    </div>
                ` : ''}
            </div>`;

        return `
            <div style="font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.65;font-size:14px;">
                ${pageFrame(1, p1Body, '63%')}
                ${pageFrame(2, p2Body, '35%')}
                ${pageFrame(3, p3Body)}
            </div>
        `;
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

        const payload = {
            ...data,
            document_html: data.document_html || buildStatementHTML(),
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
                                    <p className="text-xs text-green-600 font-medium text-center">
                                        {ocrStatus.ktp_1 || 'Foto KTP berhasil tersimpan.'}
                                    </p>
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
                                {data.ktp_2_photo_path && ocrStatus.ktp_2 && (
                                    <p className="text-xs text-green-600 font-medium text-center">{ocrStatus.ktp_2}</p>
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
                const parafSlot = (occupant: 1 | 2, editable: boolean, side: 'left' | 'right', topClass: string) => {
                    const padRef = occupant === 1 ? parafPad1 : parafPad2;
                    const parafImg = occupant === 1 ? paraf1Img : paraf2Img;
                    return (
                        <div className={`absolute ${side === 'left' ? 'left-[0.5%]' : 'right-[0.5%]'} ${topClass} flex flex-col items-center w-[8%] min-w-[40px] max-w-[64px] z-10`}>
                            {editable ? (
                                <SignatureCanvas
                                    ref={padRef}
                                    onEnd={() => {
                                        const url = padRef.current?.getTrimmedCanvas().toDataURL('image/png');
                                        if (url) {
                                            if (occupant === 1) setParaf1Img(url);
                                            else setParaf2Img(url);
                                        }
                                    }}
                                    canvasProps={{ className: 'w-full h-16 sm:h-20 border border-neutral-400 rounded-sm bg-white' }}
                                />
                            ) : parafImg ? (
                                <img src={parafImg} alt={`Paraf ${occupant}`} className="w-full border border-neutral-400 rounded-sm bg-white" />
                            ) : (
                                <div className="w-full h-16 sm:h-20 rounded-sm bg-neutral-50"></div>
                            )}
                            <span className="mt-1 text-[10px] sm:text-xs text-neutral-500 whitespace-nowrap">Paraf ({occupant})</span>
                        </div>
                    );
                };

                return (
                    <div className="space-y-6 w-full min-w-0">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight mb-2">Tanda Tangan Digital</h2>
                            <p className="text-sm text-neutral-500">Baca surat sesuai halaman, lalu buat paraf pada tempat yang tersedia (Paraf 1 & 2) dan tanda tangan pada akhir surat.</p>
                        </div>

                        {/* Surat Pernyataan — document view, mirroring the PDF layout */}
                        <div className="w-full min-w-0 overflow-x-hidden bg-neutral-200/70 border border-neutral-300 rounded-xl p-2 sm:p-4">
                            {/* HALAMAN 1 */}
                            <SheetPage num={1} meteran>
                                <h2 className="text-center font-bold tracking-wide uppercase text-base sm:text-lg mb-4">Surat Pernyataan</h2>
                                <div className="space-y-1">
                                    <p>Yang bertanda tangan di bawah ini:</p>
                                    <div className="space-y-1">
                                        {buildIdentityRows([
                                            ['Nama (1)', data.ktp_1_name],
                                            ['Tempat, Tgl Lahir', birthLine(data.ktp_1_birth_place, data.ktp_1_birth_date)],
                                            ['Pekerjaan', data.ktp_1_job],
                                            ['Alamat', data.ktp_1_address],
                                            ['Nomor KTP', data.ktp_1_nik],
                                        ])}
                                    </div>

                                    {data.has_second_occupant && (
                                        <>
                                            <p className="pt-2">Dan pasangan saya,</p>
                                            <div className="space-y-1">
                                                {buildIdentityRows([
                                                    ['Nama (2)', data.ktp_2_name],
                                                    ['Tempat, Tgl Lahir', birthLine(data.ktp_2_birth_place, data.ktp_2_birth_date)],
                                                    ['Pekerjaan', data.ktp_2_job],
                                                    ['Alamat', data.ktp_2_address],
                                                    ['Nomor KTP', data.ktp_2_nik],
                                                ])}
                                            </div>
                                        </>
                                    )}

                                    <p className="pt-4">Dengan ini kami menyatakan dengan sebenar-benarnya bahwa:</p>
                                    <p className="font-bold">1. Menempati Kosan</p>
                                    <p className="text-justify" dangerouslySetInnerHTML={{ __html: pasal1Text }} />
                                    <p className="font-bold">2. Kepatuhan Terhadap Peraturan Kos</p>
                                    <p className="text-justify">Bersedia mematuhi segala peraturan kos baik yang tertulis maupun tidak tertulis, seperti:</p>
                                    <ul className="list-disc pl-5 space-y-2 text-justify">
                                        {peraturanCos.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}
                                    </ul>
                                    <p className="text-justify">Menjaga keamanan dan kenyaman Bersama, seperti:</p>
                                </div>
                                {parafSlot(1, true, 'left', 'top-[63%]')}
                                {data.has_second_occupant && parafSlot(2, true, 'right', 'top-[63%]')}
                            </SheetPage>

                            {/* HALAMAN 2 */}
                            <SheetPage num={2}>
                                <div className="space-y-2">
                                    <ul className="list-disc pl-5 space-y-2 text-justify">
                                        {menjagaKeamananItems.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}
                                    </ul>
                                    <p className="text-justify">Semua fasilitas yang ada wajib <strong>dirawat</strong> dan <strong>dijaga</strong> seperti:</p>
                                    <ol className="list-decimal pl-5 space-y-1">
                                        {[1, 2, 3, 4, 5].map(n => (
                                            <li key={n}><span className="underline decoration-dotted underline-offset-4">______________________</span></li>
                                        ))}
                                        <li>
                                            <span className="underline decoration-dotted underline-offset-4">______________________</span>
                                            <em className="text-xs text-neutral-500 ml-1">!note: jika ada ac wajib mencuci ac 2 bulan sekali.</em>
                                        </li>
                                    </ol>
                                    <p className="font-bold pt-2">3. Kepatuhan Terhadap Pembayaran</p>
                                    <p className="font-bold">4. Kewajiban Terhadap Biaya Yang Terhutang</p>
                                    <p className="text-justify">Saya sebagai penghuni kos bersedia <strong>membayar biaya yang terhutang</strong> seperti:</p>
                                    <ol className="list-decimal pl-5 space-y-2 text-justify">
                                        {biayaTerhutang.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}
                                    </ol>
                                    <p className="font-bold">5. Keterlambatan Pembayaran</p>
                                    <p className="text-justify" dangerouslySetInnerHTML={{ __html: pasal5Intro }} />
                                    <p className="text-justify" dangerouslySetInnerHTML={{ __html: pasal5Denda }} />
                                    <p className="text-justify" dangerouslySetInnerHTML={{ __html: pasal5AkhirP1 }} />
                                </div>
                                {parafSlot(1, false, 'left', 'top-[35%]')}
                                {data.has_second_occupant && parafSlot(2, false, 'right', 'top-[35%]')}
                            </SheetPage>

                            {/* HALAMAN 3 */}
                            <SheetPage num={3}>
                                <div className="space-y-2">
                                    <p className="text-justify" dangerouslySetInnerHTML={{ __html: pasal5AkhirP2 }} />
                                    <p className="font-bold">6. Pengosongan Kamar</p>
                                    <p className="font-bold">7. Peraturan Tambahan</p>
                                    <p className="text-justify"><span>➢</span> Saya menyadari bahwa <strong>PENGELOLA KOS</strong> berhak meminta saya untuk mengosongkan kamar kosan apabila:</p>
                                    <ol className="list-decimal pl-5 space-y-1 text-justify">
                                        <li>Saya telat melakukan pembayaran melebihi 2 hari seperti di <em><strong>point 4</strong></em> <em><strong>keterlambatan</strong></em>.</li>
                                        <li>Saya melakukan <em><strong>PELANGGARAN BERAT</strong></em> terhadap peraturan hukum yang berlaku di Indonesia (seperti <strong>PERJUDIAN, NARKOBA</strong>, dan <strong>TINDAK PIDANA BERAT</strong> lainnya, yang DILARANG sesuai dengan <em><strong>Pasal 303 KUHP</strong></em> tentang <em><strong>perjudian</strong></em> dan <em><strong>Pasal 112, Pasal 113, Pasal 114 UU No. 35 Tahun 2009 tentang Narkotika</strong></em>).</li>
                                    </ol>
                                    <p className="text-justify"><span>➢</span> Saya menyadari bahwa peraturan terkait <em><strong>pengelolaan kos dapat berubah</strong></em> <em><strong>sewaktu-waktu</strong></em>, dan <strong>saya berjanji</strong> untuk selalu <strong>mengikuti peraturan baru</strong> yang <strong>diberlakukan</strong> oleh pihak pengelola kos. Apabila saya telah <strong>menerima</strong> <strong>dua</strong> kali <strong>teguran</strong>, baik secara <em><strong>lisan</strong></em> maupun <em><strong>tertulis</strong></em>, dari <strong>PENGELOLA KOS</strong> atas <strong>pelanggaran peraturan</strong> dan masih <strong>mengulanginya</strong> <strong>kembali</strong>, <strong>SAYA BERSEDIA</strong> untuk <strong>mengosongkan</strong> <strong>kosan</strong> dan <strong>mengembalikan</strong> <strong>kunci kamar</strong> serta <strong>gembok pagar</strong> tanpa <strong>MENUNTUT KOMPENSASI APAPUN</strong>!, serta <strong>TETAP MEMBAYARKAN SISA KEWAJIBAN JIKA ADA</strong>.</p>
                                    <p className="text-justify pt-2">Demikian surat pernyataan ini saya buat dengan sebenar-benarnya tanpa ada paksaan atau tekanan dari pihak manapun.</p>

                                    <div className="pt-4">
                                        <p><strong>Dibuat di:</strong> Jakarta</p>
                                        <p><strong>Pada tanggal:</strong> {indonesianToday()}</p>
                                        <p className="pt-5"><strong>Yang Membuat Pernyataan,</strong></p>
                                    </div>

                                    <div className={`grid gap-10 pt-6 ${data.has_second_occupant ? 'grid-cols-1 sm:grid-cols-2' : 'max-w-[300px]'}`}>
                                        <div>
                                            <p>Tanda Tangan (1),</p>
                                            <div className="mt-2 bg-white border border-neutral-300 overflow-hidden max-w-[280px]">
                                                <SignatureCanvas ref={sigPad1} canvasProps={{ className: 'w-full h-28' }} />
                                            </div>
                                            <p className="mt-3">Nama: <strong>{data.ktp_1_name}</strong>.</p>
                                            <p>No. KTP: <strong>{data.ktp_1_nik}</strong>.</p>
                                        </div>
                                        {data.has_second_occupant && (
                                            <div>
                                                <p>Tanda Tangan (2),</p>
                                                <div className="mt-2 bg-white border border-neutral-300 overflow-hidden max-w-[280px]">
                                                    <SignatureCanvas ref={sigPad2} canvasProps={{ className: 'w-full h-28' }} />
                                                </div>
                                                <p className="mt-3">Nama: <strong>{data.ktp_2_name}</strong>.</p>
                                                <p>No. KTP: <strong>{data.ktp_2_nik}</strong>.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </SheetPage>
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
