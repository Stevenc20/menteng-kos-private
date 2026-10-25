import { type ReactNode, useState, useRef } from 'react';
import SignatureModal from './SignatureModal';
import { type ProrataInfo } from '@/services/statement';

// Bagian surat yang bisa diisi dirender sebagai input tetap menyatu dengan
// desain dokumen (garis bawah putus-putus), mengikuti template PDF/docx resmi.
// Ketika readOnlyFields=true (untuk Tenant), seluruh field teks terkunci dan
// Tenant dipandu secara visual dari area Paraf Halaman 1 -> Paraf Halaman 2 -> Tanda Tangan Akhir.

interface Occ {
    name: string;
    birth: string;
    job: string;
    address: string;
    nik: string;
}

export interface StatementDocumentProps {
    isKiosk: boolean;
    hasSecond: boolean;
    occ1: Occ;
    occ2: Occ;
    sewaNumeral: string;
    dueDay: string;
    setDueDay: (v: string) => void;
    reminderDay: string;
    dendaPerDay: string;
    setDendaPerDay: (v: string) => void;
    meteran: string;
    setMeteran: (v: string) => void;
    notes?: string;
    setNotes?: (v: string) => void;
    usaha: string;
    setUsaha: (v: string) => void;
    facilities: string[];
    setFacilities: (v: string[]) => void;
    tanggal: string;
    paraf1Img: string;
    paraf2Img: string;
    onParafEnd: (occupant: 1 | 2, url: string) => void;
    sig1Img: string;
    sig2Img: string;
    onSigEnd: (occupant: 1 | 2, url: string) => void;
    sigRef1: any;
    parafRef1: any;
    sigRef2: any;
    parafRef2: any;
    kioskSeparateWater?: boolean;
    waterAllowance?: number | string;
    readOnlyFields?: boolean;
    prorataInfo?: ProrataInfo;
}

function SheetPage({ num, meteran, meteranValue, onMeteranChange, notesValue, onNotesChange, kioskSeparateWater, waterAllowance, readOnlyFields, children }: { num: number; meteran?: boolean; meteranValue?: string; onMeteranChange?: (v: string) => void; notesValue?: string; onNotesChange?: (v: string) => void; kioskSeparateWater?: boolean; waterAllowance?: number | string; readOnlyFields?: boolean; children: ReactNode }) {
    const allowanceNum = Number(waterAllowance ?? 5) || 5;
    return (
        <div className="relative mx-auto mb-6 w-full min-w-0 max-w-[794px] min-h-[1122px] bg-white shadow-lg border border-neutral-200">
            <div className="flex justify-between items-start px-[9%] pt-6">
                <span className="font-serif italic text-sm text-neutral-700">Menteng Kost</span>
                {meteran && (
                    <div className="border-[1.5px] border-neutral-600 px-3 py-1.5 text-center shrink-0">
                        <div className="text-xs font-bold tracking-wide whitespace-nowrap">START METERAN:</div>
                        <div className="text-[9px] italic text-neutral-500 whitespace-nowrap">WAJIB DIISI</div>
                        <DocInput
                            value={meteranValue ?? ''}
                            onChange={v => onMeteranChange?.(v.replace(/\D/g, ''))}
                            maxLength={7}
                            placeholder=".........."
                            className="mt-1.5 w-24"
                            readOnly={readOnlyFields}
                        />
                        {kioskSeparateWater ? (
                            <>
                                {meteranValue && (
                                    <div className="mt-1 text-[10px] font-semibold whitespace-nowrap text-neutral-700">
                                        {meteranValue}m³
                                    </div>
                                )}
                                <div className="text-[9px] italic text-neutral-500 whitespace-nowrap">Pemakaian diakumulasi s/d tiap tanggal jatuh tempo</div>
                            </>
                        ) : (
                            meteranValue && (
                                <div className="mt-1 text-[10px] font-semibold whitespace-nowrap text-neutral-700">
                                    {meteranValue}m³ - {Number(meteranValue) + allowanceNum}m³
                                </div>
                            )
                        )}
                        {(onNotesChange || notesValue) && (
                            <div className="mt-1.5 flex items-center gap-1 whitespace-nowrap">
                                <span className="text-[9px] italic text-neutral-500">Catatan:</span>
                                <DocInput
                                    value={notesValue ?? ''}
                                    onChange={v => onNotesChange?.(v)}
                                    maxLength={120}
                                    placeholder="................"
                                    className="w-28"
                                    readOnly={readOnlyFields}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="px-[9%] pt-3 pb-16 text-sm text-neutral-800 leading-relaxed">{children}</div>
            <div className="absolute left-0 right-0 bottom-4 text-center text-sm text-neutral-600">{num}</div>
        </div>
    );
}

export const DocInput = ({ value, onChange, maxLength, placeholder, className = '', readOnly = false }: {
    value: string;
    onChange: (v: string) => void;
    maxLength?: number;
    placeholder?: string;
    className?: string;
    readOnly?: boolean;
}) => {
    if (readOnly) {
        return (
            <span className={`inline-block min-w-[46px] max-w-full border-b border-dashed border-neutral-400 px-1 py-0 text-center font-semibold text-neutral-900 ${className}`}>
                {value || placeholder || '—'}
            </span>
        );
    }
    return (
        <input
            type="text"
            value={value}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={e => onChange(e.target.value)}
            className={`inline-block min-w-[46px] max-w-full rounded-none border-0 border-b border-dashed border-neutral-400 bg-transparent px-1 py-0 text-center font-semibold text-neutral-900 outline-none focus:border-neutral-900 ${className}`}
        />
    );
};

function ParafSlot({ side, drawn, label, onClick, topClass = 'top-[63%]', highlight = false, slotRef }: {
    side: 'left' | 'right';
    drawn: string;
    label: string;
    onClick: () => void;
    topClass?: string;
    highlight?: boolean;
    slotRef?: any;
}) {
    return (
        <div
            ref={slotRef}
            className={`absolute ${side === 'left' ? 'left-[0.5%]' : 'right-[0.5%]'} ${topClass} flex flex-col items-center w-[8%] min-w-[44px] max-w-[68px] z-10`}
        >
            {highlight && !drawn && (
                <span className="mb-1 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold whitespace-nowrap animate-bounce shadow">
                    Klik di sini ↓
                </span>
            )}
            <button
                type="button"
                onClick={onClick}
                title={`Klik untuk ${label.toLowerCase()}`}
                className={`w-full h-16 sm:h-20 rounded-sm flex items-center justify-center border transition-all ${
                    drawn
                        ? 'border-emerald-500 bg-white ring-2 ring-emerald-500/20'
                        : highlight
                        ? 'border-2 border-amber-500 bg-amber-50/80 ring-4 ring-amber-400/30 animate-pulse'
                        : 'border-dashed border-neutral-400 bg-neutral-50'
                } overflow-hidden`}
            >
                {drawn
                    ? <img src={drawn} alt={label} className="w-full h-full rounded-sm object-contain bg-white" />
                    : <span className={`text-[8px] sm:text-[9px] text-center leading-tight px-0.5 font-semibold ${highlight ? 'text-amber-800' : 'text-neutral-400'}`}>Klik {label.toLowerCase()}</span>}
            </button>
            <span className="mt-1 text-[10px] sm:text-xs text-neutral-500 whitespace-nowrap">
                {drawn ? `✓ ${label}` : label}
            </span>
        </div>
    );
}

function IdentityRows({ rows }: { rows: [string, string][] }) {
    return (
        <div className="space-y-0.5">
            {rows.map(([k, v]) => (
                <div key={k} className="flex items-start gap-1 leading-snug">
                    <span className="w-28 sm:w-32 shrink-0 text-neutral-600">{k}</span>
                    <span className="min-w-0 flex-1 break-words font-medium text-neutral-900">: {v}</span>
                </div>
            ))}
        </div>
    );
}

function FacilitiesEditor({ items, onChange, lines, readOnly = false }: {
    items: string[];
    onChange: (v: string[]) => void;
    lines: number;
    readOnly?: boolean;
}) {
    const count = Math.max(lines, items.length);
    if (readOnly) {
        return (
            <ol className="list-decimal pl-5 space-y-1">
                {Array.from({ length: count }, (_, i) => {
                    const val = items[i]?.trim();
                    return (
                        <li key={i} className="text-sm text-neutral-800">
                            {val ? <span className="font-medium">{val}</span> : <span className="text-neutral-400">______________________</span>}
                        </li>
                    );
                })}
            </ol>
        );
    }
    return (
        <ol className="space-y-1.5">
            {Array.from({ length: count }, (_, i) => (
                <li key={i} className="flex items-center gap-1 min-w-0">
                    <input
                        type="text"
                        value={items[i] ?? ''}
                        placeholder="______________________"
                        onChange={e => {
                            const next = [...items];
                            next[i] = e.target.value;
                            onChange(next);
                        }}
                        className="min-w-0 flex-1 border-b border-dotted border-neutral-400 bg-transparent px-0.5 py-0.5 text-sm text-neutral-800 outline-none focus:border-neutral-900"
                    />
                    {i >= lines && (
                        <button
                            type="button"
                            onClick={() => onChange(items.filter((_, j) => j !== i))}
                            className="shrink-0 text-neutral-300 hover:text-red-500 text-xs px-1"
                            title="Hapus fasilitas"
                        >×</button>
                    )}
                </li>
            ))}
            <li>
                <button
                    type="button"
                    onClick={() => onChange([...items, ''])}
                    className="text-xs text-neutral-400 hover:text-neutral-700 border border-dashed border-neutral-300 px-2 py-0.5 rounded"
                >
                    + Tambah fasilitas
                </button>
            </li>
        </ol>
    );
}

function PaymentTermsBox({ sewaNumeral, dueDay, prorataInfo }: { sewaNumeral: string; dueDay: string; prorataInfo?: ProrataInfo }) {
    if (!prorataInfo || (!prorataInfo.initialPaidUntil && (prorataInfo.prorataDays === undefined || prorataInfo.prorataDays === null))) {
        return null;
    }
    const fmt = (n?: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(n) || 0);
    const dueLabel = dueDay === '0' ? 'akhir bulan' : `tanggal ${dueDay || '1'} setiap bulan`;

    return (
        <div className="my-2 rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800">
            <div className="font-bold mb-1">Rincian Ketentuan Pembayaran Awal &amp; Penyesuaian Jatuh Tempo:</div>
            <ul className="list-disc pl-4 space-y-0.5">
                <li>Harga sewa bulanan: <strong>Rp {sewaNumeral} / bulan</strong></li>
                <li>Tanggal masuk: <strong>{prorataInfo.moveInDate || '-'}</strong> · Periode pembayaran awal dibayar s/d: <strong>{prorataInfo.initialPaidUntil || '-'}</strong></li>
                {(prorataInfo.prorataDays || 0) > 0 && (prorataInfo.prorataAmount || 0) > 0 ? (
                    <li>
                        Ketentuan biaya prorata (penyesuaian jatuh tempo): periode <strong>{prorataInfo.prorataStartDate} s/d {prorataInfo.prorataEndDate}</strong>{' '}
                        (<strong>{prorataInfo.prorataDays} hari</strong> × tarif harian <strong>Rp {fmt(prorataInfo.dailyRate)}</strong>) = <strong>Rp {fmt(prorataInfo.prorataAmount)}</strong>
                    </li>
                ) : (
                    <li>Ketentuan biaya prorata: <strong>Tidak ada biaya prorata tambahan (Rp 0)</strong></li>
                )}
                {prorataInfo.normalPeriodStartDate && (
                    <li>Periode sewa bulanan normal dimulai: <strong>{prorataInfo.normalPeriodStartDate}</strong></li>
                )}
                <li>Tanggal jatuh tempo sewa bulanan: <strong>{dueLabel}</strong></li>
            </ul>
        </div>
    );
}

export default function StatementDocument(props: StatementDocumentProps) {
    const { isKiosk, hasSecond, occ1, occ2, sewaNumeral, dueDay, setDueDay, reminderDay,
        dendaPerDay, setDendaPerDay, meteran, setMeteran, usaha, setUsaha,
        notes, setNotes,
        facilities, setFacilities, tanggal, paraf1Img, paraf2Img, onParafEnd,
        sig1Img, sig2Img, onSigEnd, sigRef1, parafRef1, sigRef2, parafRef2,
        kioskSeparateWater, waterAllowance, readOnlyFields = false, prorataInfo } = props;

    // Modal paraf / tanda tangan: 0 = tertutup, 1 = occupant 1, 2 = occupant 2.
    const [parafModal, setParafModal] = useState<0 | 1 | 2>(0);
    const [sigModal, setSigModal] = useState<0 | 1 | 2>(0);

    // Track per-page paraf confirmation for visual step-by-step guidance
    const [parafPage1Ack, setParafPage1Ack] = useState(false);
    const [parafPage2Ack, setParafPage2Ack] = useState(false);
    const [activeParafPage, setActiveParafPage] = useState<1 | 2>(1);

    const page1ParafRef = useRef<HTMLDivElement>(null);
    const page2ParafRef = useRef<HTMLDivElement>(null);
    const finalSigRef = useRef<HTMLDivElement>(null);

    const scrollToElement = (el?: HTMLElement | null) => {
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const openParafForPage = (pageNum: 1 | 2, occupant: 1 | 2) => {
        setActiveParafPage(pageNum);
        // If paraf image is already drawn on page 1, clicking page 2 paraf can either confirm it immediately or let user redraw
        if (pageNum === 2 && occupant === 1 && paraf1Img && !parafPage2Ack) {
            setParafPage2Ack(true);
            setTimeout(() => scrollToElement(finalSigRef.current), 250);
            return;
        }
        setParafModal(occupant);
    };

    const handleParafConfirm = (url: string) => {
        const occ = parafModal === 2 ? 2 : 1;
        onParafEnd(occ, url);
        if (occ === 1 && url) {
            if (activeParafPage === 1) {
                setParafPage1Ack(true);
                setTimeout(() => scrollToElement(page2ParafRef.current), 300);
            } else {
                setParafPage1Ack(true);
                setParafPage2Ack(true);
                setTimeout(() => scrollToElement(finalSigRef.current), 300);
            }
        }
    };

    // Determine next visual guidance action
    const step1Done = Boolean(paraf1Img) && (!hasSecond || Boolean(paraf2Img));
    const step2Done = step1Done && parafPage2Ack;
    const step3Done = Boolean(sig1Img) && (!hasSecond || Boolean(sig2Img));

    const guidanceBanner = (
        <div className="sticky top-2 z-30 mb-4 rounded-2xl border border-neutral-300 bg-white/95 backdrop-blur px-4 py-3 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap text-xs">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold ${step1Done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                    {step1Done ? '✓' : '1.'} Paraf Hal. 1
                </span>
                <span className="text-neutral-300">→</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold ${step2Done ? 'bg-emerald-100 text-emerald-800' : step1Done ? 'bg-amber-100 text-amber-900' : 'bg-neutral-100 text-neutral-500'}`}>
                    {step2Done ? '✓' : '2.'} Paraf Hal. 2
                </span>
                <span className="text-neutral-300">→</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold ${step3Done ? 'bg-emerald-100 text-emerald-800' : step2Done ? 'bg-amber-100 text-amber-900' : 'bg-neutral-100 text-neutral-500'}`}>
                    {step3Done ? '✓' : '3.'} Tanda Tangan Akhir
                </span>
            </div>
            <div className="flex items-center gap-2">
                {!step1Done && (
                    <button
                        type="button"
                        onClick={() => {
                            scrollToElement(page1ParafRef.current);
                            setActiveParafPage(1);
                            setParafModal(1);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors shadow-sm"
                    >
                        📍 Ke Area Paraf Hal. 1
                    </button>
                )}
                {step1Done && !step2Done && (
                    <button
                        type="button"
                        onClick={() => {
                            scrollToElement(page2ParafRef.current);
                            setParafPage2Ack(true);
                            setTimeout(() => scrollToElement(finalSigRef.current), 500);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors shadow-sm"
                    >
                        📍 Konfirmasi Paraf Hal. 2 &amp; Lanjut
                    </button>
                )}
                {step1Done && step2Done && !step3Done && (
                    <button
                        type="button"
                        onClick={() => {
                            scrollToElement(finalSigRef.current);
                            setSigModal(1);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors shadow-sm"
                    >
                        ✍️ Ke Area Tanda Tangan Akhir
                    </button>
                )}
                {step1Done && step3Done && (
                    <span className="text-xs font-semibold text-emerald-700">✓ Seluruh paraf &amp; tanda tangan lengkap</span>
                )}
            </div>
        </div>
    );

    const modals = (
        <>
            <SignatureModal
                open={parafModal !== 0}
                onClose={() => setParafModal(0)}
                title={parafModal === 2 ? 'Paraf (2)' : 'Paraf (1)'}
                subtitle={`Tulis ${parafModal === 2 ? occ2.name : occ1.name} lalu tekan Simpan.`}
                padRef={parafModal === 2 ? parafRef2 : parafRef1}
                padKey="paraf"
                initialImage={parafModal === 2 ? paraf2Img : paraf1Img}
                onConfirm={handleParafConfirm}
            />
            <SignatureModal
                open={sigModal !== 0}
                onClose={() => setSigModal(0)}
                title={sigModal === 2 ? 'Tanda Tangan (2)' : 'Tanda Tangan (1)'}
                subtitle={`Tulis ${sigModal === 2 ? occ2.name : occ1.name} lalu tekan Simpan.`}
                padRef={sigModal === 2 ? sigRef2 : sigRef1}
                padKey="sig"
                initialImage={sigModal === 2 ? sig2Img : sig1Img}
                onConfirm={(url) => onSigEnd(sigModal === 2 ? 2 : 1, url)}
            />
        </>
    );

    const duaDigit = (v: string) => v.replace(/\D/g, '');

    const identity1: [string, string][] = [
        ['Nama (1)', occ1.name],
        ['Tempat, Tgl Lahir', occ1.birth],
        ['Pekerjaan', occ1.job],
        ['Alamat', occ1.address],
        ['Nomor KTP', occ1.nik],
    ];
    const identity1k: [string, string][] = [
        ['Nama', occ1.name],
        ['Tempat, Tanggal Lahir', occ1.birth],
        ['Pekerjaan', occ1.job],
        ['Alamat', occ1.address],
        ['Nomor KTP', occ1.nik],
    ];
    const identity2: [string, string][] = [
        ['Nama (2)', occ2.name],
        ['Tempat, Tgl Lahir', occ2.birth],
        ['Pekerjaan', occ2.job],
        ['Alamat', occ2.address],
        ['Nomor KTP', occ2.nik],
    ];
    const identity2k: [string, string][] = identity2.map(([k2, v]) => [k2.replace(/ \(2\)/, ''), v]) as [string, string][];

    if (isKiosk) {
        return (
            <>
            {guidanceBanner}
            <div className="w-full min-w-0 bg-neutral-200/70 border border-neutral-300 rounded-xl p-2 sm:p-4">
                {/* HALAMAN 1 */}
                <SheetPage num={1} meteran meteranValue={meteran} onMeteranChange={setMeteran} notesValue={notes} onNotesChange={setNotes} kioskSeparateWater={kioskSeparateWater} readOnlyFields={readOnlyFields}>
                    <h2 className="text-center font-bold tracking-wide uppercase text-base sm:text-lg mb-1">Surat Pernyataan</h2>
                    <h2 className="text-center font-bold tracking-wide uppercase text-base mb-4">Kios</h2>
                    <div className="space-y-1">
                        <p>Yang bertanda tangan dibawah ini,</p>
                        <div className="space-y-0.5">
                            <IdentityRows rows={identity1k} />
                        </div>
                        {hasSecond && (
                            <>
                                <p className="pt-2">Dan pasangan saya,</p>
                                <div className="space-y-0.5">
                                    <IdentityRows rows={identity2k} />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="space-y-3 pt-3">
                        <p className="pt-2">Dengan ini saya menyatakan dengan sebenar-benarnya bahwa:</p>

                        <p className="font-bold">1. Menempati Kios</p>
                        <p className="text-justify">
                            Untuk usaha{' '}
                            <DocInput value={usaha} onChange={setUsaha} placeholder="______________________________" className="sm:w-56" readOnly={readOnlyFields} />
                            , serta tidak diperbolehkan pemindahan kepada pihak lain selain nama yang tertera dalam surat pernyataan.
                        </p>

                        <p className="font-bold">2. Pembayaran</p>
                        <p className="text-justify">
                            Saya menyewa kios sebesar <strong>Rp {sewaNumeral}</strong> setiap tanggal{' '}
                            <DocInput value={dueDay} onChange={v => setDueDay(duaDigit(v))} maxLength={2} readOnly={readOnlyFields} /> namun akan
                            direminder setiap tgl <strong>{reminderDay}</strong>, yang terdiri dari:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-justify">
                            {kioskSeparateWater ? (
                                <>
                                    <li>
                                        Uang sewa kios <strong>Rp {sewaNumeral}</strong>{' '}
                                        <span className="font-semibold">— harga ini TIDAK termasuk biaya pemakaian air PAM.</span>
                                    </li>
                                    <li>
                                        Biaya pemakaian air <strong>PAM</strong> dibayar <strong>terpisah</strong>, dihitung
                                        berdasarkan <strong>akumulasi pemakaian aktual</strong> dari <strong>start meteran</strong> sampai
                                        pembacaan pada <strong>setiap tanggal jatuh tempo</strong> sesuai <strong>meter air</strong> dengan
                                        tarif <strong>Rp 14.000/m³</strong>. Biaya pemakaian air PAM akan{' '}
                                        <strong>ditambahkan pada tagihan pembayaran bulanan</strong>. Rumus:{' '}
                                        <em>pemakaian air (m³) × Rp 14.000</em>.
                                    </li>
                                </>
                            ) : (
                                <>
                                    <li>Uang sewa kios <strong>Rp {sewaNumeral}</strong></li>
                                    <li>
                                        Uang air sebanyak <strong>5m³</strong> dengan meteran dari{' '}
                                        <DocInput value={meteran} onChange={v => setMeteran(duaDigit(v))} maxLength={7} placeholder="______" readOnly={readOnlyFields} />
                                        , lewat dari itu saya akan membayar air per 1m³ kena <strong>Rp 14.000</strong>, sesuai pemakaiaan.
                                    </li>
                                </>
                            )}
                        </ul>

                        <PaymentTermsBox sewaNumeral={sewaNumeral} dueDay={dueDay} prorataInfo={prorataInfo} />

                        <p className="font-bold">3. Kepatuhan Terhadap Pembayaran</p>
                        <p className="text-justify">
                            Saya menyadari apabila saya terlambat melakukan pembayaran setelah tanggal jatuh tempo, saya akan
                            dikenakan denda sebesar <strong>Rp </strong>
                            <DocInput value={dendaPerDay} onChange={v => setDendaPerDay(duaDigit(v))} maxLength={9} placeholder="0" readOnly={readOnlyFields} />
                            {' '}per hari keterlambatan sesuai dengan ketentuan yang berlaku. Maksimal denda keterlambatan{' '}
                            <strong>2 hari, diatas 2 hari wajib mengosongkan kios</strong>.
                        </p>

                        <p className="font-bold">4. Kepatuhan Terhadap Peraturan Kios</p>
                        <p className="text-justify">Saya menyadari untuk mematuhi segala peraturan kios baik yang tertulis maupun tidak tertulis, seperti:</p>
                        <ul className="list-disc pl-5 space-y-2 text-justify">
                            <li>Saat pertama kali menempati kios wajib menyerahkan <strong>KTP dan KK</strong>, 1x24 jam wajib lapor <strong>RT</strong>.</li>
                            <li>Saya bertanggung jawab penuh atas <strong>kerusakan</strong> atau <strong>kehilangan</strong> fasilitas yang ada di dalam <strong>KIOS</strong> selama <strong>masa sewa</strong>. Jika terjadi <strong>kerusakan akibat kelalaian saya</strong>, saya akan <strong>mengganti kerugian</strong> sesuai dengan <strong>nilai kerusakan</strong> yang ditentukan oleh <strong>pihak pengelola kos</strong>.</li>
                            <li>Mematuhi peraturan <strong>HUKUM</strong> yang berlaku di <strong>Indonesia</strong> dan <strong>Menjaga norma kesopanan</strong> serta <strong>tidak menimbulkan kegaduhan bagi penghuni lain</strong>.</li>
                            <li>Keluar masuk <strong>gerbang utama wajib menutup dan mengunci Kembali</strong>, apabila diatas <strong>pukul 22.00 WIB</strong>, <strong>wajib mengembok gerbang utama!</strong>.</li>
                        </ul>
                    </div>
                    <ParafSlot slotRef={page1ParafRef} highlight={!paraf1Img} topClass="top-[78%]" side="left" label="Paraf (1)" drawn={paraf1Img} onClick={() => openParafForPage(1, 1)} />
                    {hasSecond && <ParafSlot highlight={Boolean(paraf1Img) && !paraf2Img} topClass="top-[78%]" side="right" label="Paraf (2)" drawn={paraf2Img} onClick={() => openParafForPage(1, 2)} />}
                </SheetPage>

                {/* HALAMAN 2 */}
                <SheetPage num={2}>
                    <div className="space-y-2">
                        <p className="text-justify">
                            Kios yang saya terima beserta semua fasilitas dalam kondisi baik, dan saya wajib{' '}
                            <strong>MENJAGA</strong> dan <strong>MERAWAT</strong> fasilitas yang ada seperti:
                        </p>
                        <FacilitiesEditor items={facilities} onChange={setFacilities} lines={8} readOnly={readOnlyFields} />

                        <p className="font-bold pt-2">5. Pengosongan Kios</p>
                        <p className="text-justify">Jika saya berniat untuk mengakhiri masa sewa sebelum waktu yang disepakati, saya akan memberikan pemberitahuan kepada pihak <strong>PENGELOLA KOS</strong> 5 hari sebelumnya dan bertanggung jawab atas pembayaran sewa yang masih terhutang serta kewajiban lain, seperti: air <strong>PDAM</strong> yang <strong>telah digunakan</strong> hingga <strong>saat pengosongan dilakukan</strong>.</p>

                        <p className="font-bold">6. Peraturan Tambahan</p>
                        <p className="text-justify">➢ Saya menyadari bahwa <strong>PENGELOLA</strong> berhak meminta saya untuk mengosongkan kios apabila:</p>
                        <ol className="list-decimal pl-5 space-y-1 text-justify">
                            <li>Saya telat melakukan pembayaran melebihi 2 hari seperti di point 3 keterlambatan.</li>
                            <li>Saya melakukan <em><strong>PELANGGARAN BERAT</strong></em> terhadap peraturan hukum yang berlaku di Indonesia (seperti <strong>PERJUDIAN, NARKOBA</strong>, dan <strong>TINDAK PIDANA BERAT</strong> lainnya, yang DILARANG sesuai dengan <em><strong>Pasal 303 KUHP</strong></em> tentang <em><strong>perjudian</strong></em> dan <em><strong>Pasal 112, Pasal 113, Pasal 114 UU No. 35 Tahun 2003 tentang Narkotika</strong></em>).</li>
                        </ol>
                        <p className="text-justify">➢ Saya menyadari bahwa peraturan terkait <strong>pengelolaan kios dapat berubah</strong> <strong>sewaktu-waktu</strong>, dan <strong>saya berjanji</strong> untuk selalu <strong>mengikuti peraturan baru</strong> yang <strong>diberlakukan</strong> oleh pihak pengelola. Apabila saya telah <strong>menerima</strong> <strong>dua</strong> kali <strong>teguran</strong>, baik secara <em><strong>lisan</strong></em> maupun <em><strong>tertulis</strong></em>, dari <strong>PENGELOLA</strong> atas <strong>pelanggaran peraturan</strong> dan masih <strong>mengulanginya</strong> <strong>kembali</strong>, <strong>SAYA BERSEDIA</strong> untuk <strong>mengosongkan kios</strong> dan <strong>mengembalikan semua kunci kios</strong> dan <strong>menyerahkan kios dalam kondisi baik</strong> seperti saat saya terima, serta <strong>gembok pagar</strong> tanpa <strong>MENUNTUT KOMPENSASI APAPUN!</strong>, serta <strong>TETAP MEMBAYARKAN SISA KEWAJIBAN JIKA ADA</strong>.</p>

                        <p className="font-bold">Dokumentasi kios saat diserahkan</p>
                        <div className="border-[1.5px] border-dashed border-neutral-400 h-28 mb-1"></div>

                        <p className="text-justify pt-1">Demikian surat pernyataan ini saya buat dengan sebenar-benarnya tanpa ada paksaan atau tekanan dari pihak manapun.</p>
                        <p><strong>Dibuat di:</strong> Jakarta</p>
                        <p><strong>Pada tanggal:</strong> {tanggal}</p>
                        <p className="pt-4"><strong>Yang Membuat Pernyataan,</strong></p>
                        <SignatureBlock blockRef={finalSigRef} highlight={step1Done && !sig1Img} hasSecond={hasSecond} occ1={occ1} occ2={occ2} img1={sig1Img} img2={sig2Img} label="Tanda Tangan" onSigClick={(o) => setSigModal(o)} />
                    </div>
                    <ParafSlot slotRef={page2ParafRef} highlight={step1Done && !parafPage2Ack} topClass="top-[52%]" side="left" label="Paraf (1)" drawn={paraf1Img} onClick={() => openParafForPage(2, 1)} />
                    {hasSecond && <ParafSlot topClass="top-[52%]" side="right" label="Paraf (2)" drawn={paraf2Img} onClick={() => openParafForPage(2, 2)} />}
                </SheetPage>
            </div>
            {modals}
            </>
        );
    }

    return (
        <>
        {guidanceBanner}
        <div className="w-full min-w-0 bg-neutral-200/70 border border-neutral-300 rounded-xl p-2 sm:p-4">
            {/* HALAMAN 1 */}
            <SheetPage num={1} meteran meteranValue={meteran} onMeteranChange={setMeteran} notesValue={notes} onNotesChange={setNotes} waterAllowance={waterAllowance} readOnlyFields={readOnlyFields}>
                <h2 className="text-center font-bold tracking-wide uppercase text-base sm:text-lg mb-4">Surat Pernyataan</h2>
                <div className="space-y-1">
                    <p>Yang bertanda tangan di bawah ini:</p>
                    <IdentityRows rows={identity1} />
                    {hasSecond && (
                        <>
                            <p className="pt-2">Dan pasangan saya,</p>
                            <IdentityRows rows={identity2} />
                        </>
                    )}
                    <p className="pt-4">Dengan ini kami menyatakan dengan sebenar-benarnya bahwa:</p>
                    <p className="font-bold">1. Menempati Kosan</p>
                    <p className="text-justify">
                        {hasSecond
                            ? <>Yang menempati kos adalah <strong>{occ1.name}</strong> dan <strong>{occ2.name}</strong>, serta</>
                            : <>Yang menempati kos adalah <strong>{occ1.name}</strong>, serta</>}{' '}
                        Tidak diperbolehkan ada orang lain yang tinggal di kos ini selain nama-nama yang tertera dalam pernyataan ini, jika melanggar maka pengelola kos berhak <strong>memutus</strong> <strong>SEWA/KONTRAK</strong> dan penghuni wajib mengosongkan kamar tanpa <strong>KOMPENSASI</strong>.
                    </p>
                    <p className="font-bold">2. Kepatuhan Terhadap Peraturan Kos</p>
                    <p className="text-justify">Bersedia mematuhi segala peraturan kos baik yang tertulis maupun tidak tertulis, seperti:</p>
                    <ul className="list-disc pl-5 space-y-2 text-justify">
                        <li>Saat pertama kali menempati kosan wajib menyerahkan <strong>KTP dan KK</strong> yang akan menghuni, 1x24 jam wajib lapor <strong>RT</strong>.</li>
                        <li>Saya bertanggung jawab penuh atas <strong>kerusakan</strong> atau <strong>kehilangan</strong> fasilitas yang ada di dalam <strong>kamar kos</strong> selama <strong>masa sewa</strong>. Jika terjadi <strong>kerusakan akibat kelalaian saya</strong>, saya akan <strong>mengganti kerugian</strong> sesuai dengan <strong>nilai kerusakan</strong> yang ditentukan oleh <strong>pihak pengelola kos</strong>.</li>
                        <li>Mematuhi peraturan <strong>HUKUM</strong> yang berlaku di <strong>Indonesia</strong> dan <strong>Menjaga norma kesopanan</strong> serta <strong>kesusilaan (TIDAK BOLEH OPEN BO)</strong>. Dan <strong>tidak menimbulkan kegaduhan bagi penghuni lain</strong>.</li>
                        <li>Keluar masuk <strong>gerbang utama wajib menutup dan mengunci Kembali</strong>, dan bila diatas <strong>pukul 22.00 WIB</strong>, <strong>wajib mengembok gerbang utama!</strong>.</li>
                    </ul>
                    <p className="text-justify">Menjaga keamanan dan kenyaman Bersama, seperti:</p>
                </div>
                <ParafSlot slotRef={page1ParafRef} highlight={!paraf1Img} side="left" label="Paraf (1)" drawn={paraf1Img} onClick={() => openParafForPage(1, 1)} />
                {hasSecond && <ParafSlot highlight={Boolean(paraf1Img) && !paraf2Img} side="right" label="Paraf (2)" drawn={paraf2Img} onClick={() => openParafForPage(1, 2)} />}
            </SheetPage>

            {/* HALAMAN 2 */}
            <SheetPage num={2}>
                <div className="space-y-2">
                    <ul className="list-disc pl-5 space-y-2 text-justify">
                        <li>Selain penghuni kos-an dilarang membawa <strong>tamu</strong> kedalam <strong>kamar</strong> termasuk <strong>kurir</strong> dan <strong>tamu</strong> &ldquo;tidak dikenal&rdquo; hanya boleh diterima diluar kamar, kecuali ada <strong>izin</strong> dari <strong>PENGELOLA KOS</strong>.</li>
                        <li><strong>Dilarang</strong> menyewakan kamar kepada orang lain selain nama yang sudah tertera dalam <strong>SURAT PERNYATAAN</strong>, jika melanggar maka <strong>pengelola kos BERHAK memutus SEWA/KONTRAK</strong> dan penghuni wajib mengosongkan kamar serta membersihkan kamar seperti semula dan tidak menerima <strong>KOMPENSASI</strong>.</li>
                    </ul>
                    <p className="text-justify">Semua fasilitas yang ada wajib <strong>dirawat</strong> dan <strong>dijaga</strong> seperti:</p>
                    <FacilitiesEditor items={facilities} onChange={setFacilities} lines={6} readOnly={readOnlyFields} />
                    <p className="font-bold pt-2">3. Kepatuhan Terhadap Pembayaran</p>
                    <p className="font-bold">4. Kewajiban Terhadap Biaya Yang Terhutang</p>
                    <p className="text-justify">Saya sebagai penghuni kos bersedia <strong>membayar biaya yang terhutang</strong> seperti:</p>
                    <ol className="list-decimal pl-5 space-y-2 text-justify">
                        <li>Setiap kamar akan dikenakan biaya perbulan sebesar <strong>Rp 100.000</strong> (seratus ribu rupiah) untuk <strong>iuran sampah</strong> dan <strong>air</strong> sebanyak <strong>{Number(waterAllowance ?? 5) || 5}m³ per kamar</strong> dihitung berdasarkan angka meteran yang terpasang dimasing-masing kamar.</li>
                        <li>Biaya tambahan air <strong>PDAM</strong> sebesar <strong>Rp14.000/m³</strong> untuk pemakaian lebih dari <strong>{Number(waterAllowance ?? 5) || 5}m³</strong>, dihitung sesuai angka meteran permasing-masing kamar bersamaan tanggal pembayaran kos.</li>
                        <li><strong>Pembacaan meteran air</strong> akan dilakukan <strong>setiap tanggal</strong> pembayaran kos untuk masing-masing kamar.</li>
                    </ol>
                    <PaymentTermsBox sewaNumeral={sewaNumeral} dueDay={dueDay} prorataInfo={prorataInfo} />
                    <p className="font-bold">5. Keterlambatan Pembayaran</p>
                    <p className="text-justify">
                        saya menyatakan bahwa membayar biaya sewa kos sebesar <strong>Rp {sewaNumeral}</strong> per bulan.
                        Pembayaran dilakukan setiap bulan, 1 hari sebelum tanggal jatuh tempo, tanggal{' '}
                        <DocInput value={dueDay} onChange={v => setDueDay(duaDigit(v))} maxLength={2} readOnly={readOnlyFields} /> setiap bulannya.
                    </p>
                    <p className="text-justify">
                        Jika saya terlambat melakukan pembayaran setelah tanggal jatuh tempo, saya akan dikenakan denda sebesar{' '}
                        <strong>Rp </strong>
                        <DocInput value={dendaPerDay} onChange={v => setDendaPerDay(duaDigit(v))} maxLength={9} placeholder="0" readOnly={readOnlyFields} />
                        {' '}per hari keterlambatan sesuai dengan ketentuan yang berlaku. Maksimal denda keterlambatan{' '}
                        <strong>2 hari, diatas 2 hari wajib mengosongkan kosan</strong>.
                    </p>
                    <p className="text-justify">Jika saya berniat untuk mengakhiri masa sewa sebelum waktu yang disepakati, saya akan memberikan pemberitahuan kepada pihak <strong>PENGELOLA KOS</strong> 5 hari</p>
                </div>
                <ParafSlot slotRef={page2ParafRef} highlight={step1Done && !parafPage2Ack} side="left" label="Paraf (1)" drawn={paraf1Img} onClick={() => openParafForPage(2, 1)} />
                {hasSecond && <ParafSlot side="right" label="Paraf (2)" drawn={paraf2Img} onClick={() => openParafForPage(2, 2)} />}
            </SheetPage>

            {/* HALAMAN 3 */}
            <SheetPage num={3}>
                <div className="space-y-2">
                    <p className="text-justify">sebelumnya dan bertanggung jawab atas pembayaran sewa yang masih terhutang serta kewajiban lain, seperti: air <strong>PDAM</strong> yang <strong>telah digunakan</strong> hingga <strong>saat pengosongan dilakukan</strong>.</p>
                    <p className="font-bold">6. Pengosongan Kamar</p>
                    <p className="text-bold font-bold">7. Peraturan Tambahan</p>
                    <p className="text-justify">➢ Saya menyadari bahwa <strong>PENGELOLA KOS</strong> berhak meminta saya untuk mengosongkan kamar kosan apabila:</p>
                    <ol className="list-decimal pl-5 space-y-1 text-justify">
                        <li>Saya telat melakukan pembayaran melebihi 2 hari seperti di <em><strong>point 4</strong></em> <em><strong>keterlambatan</strong></em>.</li>
                        <li>Saya melakukan <em><strong>PELANGGARAN BERAT</strong></em> terhadap peraturan hukum yang berlaku di Indonesia (seperti <strong>PERJUDIAN, NARKOBA</strong>, dan <strong>TINDAK PIDANA BERAT</strong> lainnya, yang DILARANG sesuai dengan <em><strong>Pasal 303 KUHP</strong></em> tentang <em><strong>perjudian</strong></em> dan <em><strong>Pasal 112, Pasal 113, Pasal 114 UU No. 35 Tahun 2009 tentang Narkotika</strong></em>).</li>
                    </ol>
                    <p className="text-justify">➢ Saya menyadari bahwa peraturan terkait <em><strong>pengelolaan kos dapat berubah</strong></em> <em><strong>sewaktu-waktu</strong></em>, dan <strong>saya berjanji</strong> untuk selalu <strong>mengikuti peraturan baru</strong> yang <strong>diberlakukan</strong> oleh pihak pengelola kos. Apabila saya telah <strong>menerima</strong> <strong>dua</strong> kali <strong>teguran</strong>, baik secara <em><strong>lisan</strong></em> maupun <em><strong>tertulis</strong></em>, dari <strong>PENGELOLA KOS</strong> atas <strong>pelanggaran peraturan</strong> dan masih <strong>mengulanginya</strong> <strong>kembali</strong>, <strong>SAYA BERSEDIA</strong> untuk <strong>mengosongkan</strong> <strong>kosan</strong> dan <strong>mengembalikan</strong> <strong>kunci kamar</strong> serta <strong>gembok pagar</strong> tanpa <strong>MENUNTUT KOMPENSASI APAPUN!</strong>, serta <strong>TETAP MEMBAYARKAN SISA KEWAJIBAN JIKA ADA</strong>.</p>
                    <p className="text-justify">Demikian surat pernyataan ini saya buat dengan sebenar-benarnya tanpa ada paksaan atau tekanan dari pihak manapun.</p>
                    <p><strong>Dibuat di:</strong> Jakarta</p>
                    <p><strong>Pada tanggal:</strong> {tanggal}</p>
                    <p className="pt-4"><strong>Yang Membuat Pernyataan,</strong></p>
                    <SignatureBlock blockRef={finalSigRef} highlight={step1Done && !sig1Img} hasSecond={hasSecond} occ1={occ1} occ2={occ2} img1={sig1Img} img2={sig2Img} label="Tanda Tangan" onSigClick={(o) => setSigModal(o)} />
                </div>
            </SheetPage>
        </div>
        {modals}
        </>
    );
}

function SignatureBlock({ hasSecond, occ1, occ2, img1, img2, label, onSigClick, highlight = false, blockRef }: {
    hasSecond: boolean;
    occ1: Occ;
    occ2: Occ;
    img1: string;
    img2: string;
    label: string;
    onSigClick: (occupant: 1 | 2) => void;
    highlight?: boolean;
    blockRef?: any;
}) {
    return (
        <div ref={blockRef} className={`grid gap-10 pt-6 ${hasSecond ? 'grid-cols-1 sm:grid-cols-2' : 'max-w-[300px]'}`}>
            <div>
                <p className="flex items-center gap-2">
                    <span>{label} (1),</span>
                    {highlight && !img1 && (
                        <span className="px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold animate-bounce">
                            Klik untuk tanda tangan ↓
                        </span>
                    )}
                </p>
                <button
                    type="button"
                    onClick={() => onSigClick(1)}
                    title={`Klik untuk ${label.toLowerCase()} (1)`}
                    className={`mt-2 w-full h-28 max-w-[280px] rounded-sm flex items-center justify-center border transition-all ${
                        img1
                            ? 'border-emerald-500 bg-white ring-2 ring-emerald-500/20'
                            : highlight
                            ? 'border-2 border-amber-500 bg-amber-50/70 ring-4 ring-amber-400/20'
                            : 'border-dashed border-neutral-400 bg-neutral-50'
                    } overflow-hidden`}
                >
                    {img1
                        ? <img src={img1} alt={`${label} (1)`} className="w-full h-full rounded-sm object-contain bg-white" />
                        : <span className={`text-xs text-center px-2 font-semibold ${highlight ? 'text-amber-800' : 'text-neutral-400'}`}>Klik untuk tanda tangan</span>}
                </button>
                <p className="mt-3">Nama: <strong>{occ1.name}</strong>.</p>
                <p>No. KTP: <strong>{occ1.nik}</strong>.</p>
            </div>
            {hasSecond && (
                <div>
                    <p>{label} (2),</p>
                    <button
                        type="button"
                        onClick={() => onSigClick(2)}
                        title={`Klik untuk ${label.toLowerCase()} (2)`}
                        className={`mt-2 w-full h-28 max-w-[280px] rounded-sm flex items-center justify-center border ${img2 ? 'border-emerald-500 bg-white' : 'border-dashed border-neutral-400 bg-neutral-50'} overflow-hidden`}
                    >
                        {img2
                            ? <img src={img2} alt={`${label} (2)`} className="w-full h-full rounded-sm object-contain bg-white" />
                            : <span className="text-xs text-neutral-400 text-center px-2">Klik untuk tanda tangan</span>}
                    </button>
                    <p className="mt-3">Nama: <strong>{occ2.name}</strong>.</p>
                    <p>No. KTP: <strong>{occ2.nik}</strong>.</p>
                </div>
            )}
        </div>
    );
}
