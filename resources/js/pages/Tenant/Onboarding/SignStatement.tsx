import { useState, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import StatementDocument from '@/components/Tenant/StatementDocument';
import {
    buildStatementHTML as buildStatementTemplateHTML,
    indonesianToday,
    calcReminderDay,
    type StatementParams,
    type ProrataInfo,
} from '@/services/statement';

interface SignStatementProps {
    tenancy: any;
    profile: any;
    agreement: any;
    signatures?: any[];
}

export default function SignStatement({ tenancy, profile, agreement }: SignStatementProps) {
    const sigPad1 = useRef<any>(null);
    const parafPad1 = useRef<any>(null);
    const sigPad2 = useRef<any>(null);
    const parafPad2 = useRef<any>(null);

    const [paraf1Img, setParaf1Img] = useState('');
    const [paraf2Img, setParaf2Img] = useState('');
    const [sig1Img, setSig1Img] = useState('');
    const [sig2Img, setSig2Img] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const p = profile ?? {};
    const hasSecond = Boolean(p.ktp_2_name || p.ktp_2_nik || p.ktp_2_photo);
    const isKiosk = tenancy?.property?.type === 'KIOSK';
    const kioskSeparateWater = isKiosk
        && (Number(tenancy?.property?.normal_price) || 0) > 0
        && (Number(tenancy?.agreed_price) || 0) < (Number(tenancy?.property?.normal_price) || 0);

    const formatDisplayDate = (iso?: string) => {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        if (!y || !m || !d) return iso;
        return `${d}-${m}-${y}`;
    };
    const birthLine = (place?: string, date?: string) => [place, formatDisplayDate(date)].filter(Boolean).join(', ');

    const dueDay = tenancy?.due_day != null ? String(tenancy.due_day) : '1';
    const dendaPerDay = tenancy?.denda_per_day != null
        ? String(Math.round(Number(tenancy.denda_per_day)))
        : String(Math.round((Number(tenancy?.agreed_price) || 0) / 30));
    const sewaNumeral = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(tenancy?.agreed_price) || 0);
    const meteran = agreement?.meteran_start ?? '';
    const notes = agreement?.notes ?? '';
    const usaha = tenancy?.usaha ?? '';
    const waterAllowance = tenancy?.water_allowance ?? 5;
    const facilities: string[] = Array.isArray(tenancy?.facilities) && tenancy.facilities.length > 0
        ? tenancy.facilities
        : (Array.isArray(tenancy?.property?.facilities) ? tenancy.property.facilities : []);

    const prorataInfo: ProrataInfo | undefined = (tenancy?.initial_paid_until || tenancy?.prorata_days != null)
        ? {
            moveInDate: tenancy?.move_in_date,
            initialPaidUntil: tenancy?.initial_paid_until,
            prorataStartDate: tenancy?.prorata_start_date,
            prorataEndDate: tenancy?.prorata_end_date,
            prorataDays: tenancy?.prorata_days != null ? Number(tenancy.prorata_days) : undefined,
            dailyRate: tenancy?.prorata_daily_rate != null ? Number(tenancy.prorata_daily_rate) : undefined,
            prorataAmount: tenancy?.prorata_amount != null ? Number(tenancy.prorata_amount) : undefined,
            normalPeriodStartDate: tenancy?.normal_period_start_date,
        }
        : undefined;

    const occ1 = {
        name: p.ktp_1_name || tenancy?.user?.name || '-',
        birth: birthLine(p.ktp_1_birth_place, p.ktp_1_birth_date),
        job: p.ktp_1_job || '-',
        address: p.ktp_1_address || '-',
        nik: p.ktp_1_nik || '-',
    };
    const occ2 = {
        name: p.ktp_2_name || '-',
        birth: birthLine(p.ktp_2_birth_place, p.ktp_2_birth_date),
        job: p.ktp_2_job || '-',
        address: p.ktp_2_address || '-',
        nik: p.ktp_2_nik || '-',
    };

    const clearSignatures = () => {
        sigPad1.current?.clear();
        parafPad1.current?.clear();
        sigPad2.current?.clear();
        parafPad2.current?.clear();
        setParaf1Img('');
        setParaf2Img('');
        setSig1Img('');
        setSig2Img('');
    };

    const handleSubmit = () => {
        if (!paraf1Img || !sig1Img) {
            alert('Harap lengkapi Paraf dan Tanda Tangan Penghuni 1 terlebih dahulu.');
            return;
        }
        if (hasSecond && (!paraf2Img || !sig2Img)) {
            alert('Harap lengkapi Paraf dan Tanda Tangan Penghuni 2 terlebih dahulu.');
            return;
        }

        const params: StatementParams = {
            hasSecond,
            occ1,
            occ2,
            sewaNumeral,
            dueDay,
            reminderDay: calcReminderDay(dueDay),
            dendaPerDay,
            meteran,
            notes,
            waterAllowance,
            usaha,
            facilities,
            tanggal: indonesianToday(),
            kioskSeparateWater,
            prorataInfo,
            signatures: {
                paraf1: paraf1Img,
                paraf2: hasSecond ? paraf2Img : '',
                sig1: sig1Img,
                sig2: hasSecond ? sig2Img : '',
            },
        };

        setSubmitting(true);
        router.post('/tenant/onboarding/agreement', {
            document_html: buildStatementTemplateHTML(isKiosk, params),
            signature_1: sig1Img,
            paraf_1: paraf1Img,
            signature_2: hasSecond ? sig2Img : '',
            paraf_2: hasSecond ? paraf2Img : '',
            move_in_date: tenancy?.move_in_date,
        }, {
            onFinish: () => setSubmitting(false),
        });
    };

    return (
        <div className="min-h-screen bg-neutral-100 py-8 px-4 sm:px-6 lg:px-8 font-sans">
            <Head title="Baca & Tanda Tangani Surat Pernyataan | Menteng Kos Private" />

            <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                        <div>
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 uppercase tracking-wider mb-2">
                                Menunggu Paraf &amp; Tanda Tangan Anda
                            </span>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
                                Surat Pernyataan Penghuni — {tenancy?.property?.name}
                            </h1>
                            <p className="text-sm text-neutral-500 mt-1">
                                Seluruh data identitas, unit, harga sewa, tanggal masuk, jatuh tempo, dan fasilitas telah diisi oleh Admin.
                                Silakan baca dengan saksama, bubuhkan paraf pada setiap bagian yang ditentukan, lalu tanda tangani di bagian akhir.
                                <strong className="text-neutral-700"> Jika terdapat kesalahan data, hubungi Admin untuk memperbaikinya.</strong>
                            </p>
                        </div>
                    </div>

                    <StatementDocument
                        isKiosk={isKiosk}
                        hasSecond={hasSecond}
                        occ1={occ1}
                        occ2={occ2}
                        sewaNumeral={sewaNumeral}
                        dueDay={dueDay}
                        setDueDay={() => {}}
                        reminderDay={calcReminderDay(dueDay)}
                        dendaPerDay={dendaPerDay}
                        setDendaPerDay={() => {}}
                        meteran={meteran}
                        setMeteran={() => {}}
                        notes={notes}
                        setNotes={() => {}}
                        usaha={usaha}
                        setUsaha={() => {}}
                        facilities={facilities}
                        setFacilities={() => {}}
                        tanggal={indonesianToday()}
                        paraf1Img={paraf1Img}
                        paraf2Img={paraf2Img}
                        onParafEnd={(occ, url) => {
                            if (!url) return;
                            if (occ === 1) setParaf1Img(url);
                            else setParaf2Img(url);
                        }}
                        sig1Img={sig1Img}
                        sig2Img={sig2Img}
                        onSigEnd={(occ, url) => {
                            if (!url) return;
                            if (occ === 1) setSig1Img(url);
                            else setSig2Img(url);
                        }}
                        sigRef1={sigPad1}
                        parafRef1={parafPad1}
                        sigRef2={sigPad2}
                        parafRef2={parafPad2}
                        kioskSeparateWater={kioskSeparateWater}
                        waterAllowance={waterAllowance}
                        readOnlyFields={true}
                        prorataInfo={prorataInfo}
                    />

                    <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-6 border-t border-neutral-200">
                        <button
                            type="button"
                            onClick={clearSignatures}
                            className="px-6 py-3 rounded-xl font-medium text-neutral-600 border border-neutral-300 hover:bg-neutral-50 transition-colors"
                        >
                            Ulangi Paraf &amp; Tanda Tangan
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex-1 px-8 py-3 rounded-xl font-bold bg-neutral-900 text-white hover:bg-neutral-800 shadow-lg transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Menyimpan...' : 'Kirim Paraf & Tanda Tangan Digital'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
