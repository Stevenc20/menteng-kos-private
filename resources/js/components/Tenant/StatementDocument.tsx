import { type ReactNode } from 'react';
import SignaturePad from './SignaturePad';

// Bagian surat yang bisa diisi dirender sebagai input tetap menyatu dengan
// desain dokumen (garis bawah putus-putus), mengikuti template PDF/docx resmi.

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
    usaha: string;
    setUsaha: (v: string) => void;
    facilities: string[];
    setFacilities: (v: string[]) => void;
    tanggal: string;
    paraf1Img: string;
    paraf2Img: string;
    onParafEnd: (occupant: 1 | 2) => void;
    sigRef1: any;
    parafRef1: any;
    sigRef2: any;
    parafRef2: any;
    kioskSeparateWater?: boolean;
}

function SheetPage({ num, meteran, meteranValue, onMeteranChange, kioskSeparateWater, children }: { num: number; meteran?: boolean; meteranValue?: string; onMeteranChange?: (v: string) => void; kioskSeparateWater?: boolean; children: ReactNode }) {
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
                                    {meteranValue}m³ - {Number(meteranValue) + 5}m³
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
            <div className="px-[9%] pt-3 pb-16 text-sm text-neutral-800 leading-relaxed">{children}</div>
            <div className="absolute left-0 right-0 bottom-4 text-center text-sm text-neutral-600">{num}</div>
        </div>
    );
}

export const DocInput = ({ value, onChange, maxLength, placeholder, className = '' }: {
    value: string;
    onChange: (v: string) => void;
    maxLength?: number;
    placeholder?: string;
    className?: string;
}) => (
    <input
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`inline-block min-w-[46px] max-w-full rounded-none border-0 border-b border-dashed border-neutral-400 bg-transparent px-1 py-0 text-center font-semibold text-neutral-900 outline-none focus:border-neutral-900 ${className}`}
    />
);

function ParafSlot({ editable, side, drawn, onEnd, padRef, topClass = 'top-[63%]' }: {
    editable: boolean;
    side: 'left' | 'right';
    drawn: string;
    onEnd: () => void;
    padRef: any;
    topClass?: string;
}) {
    return (
        <div className={`absolute ${side === 'left' ? 'left-[0.5%]' : 'right-[0.5%]'} ${topClass} flex flex-col items-center w-[8%] min-w-[40px] max-w-[64px] z-10`}>
            {editable ? (
                <SignaturePad
                    ref={padRef}
                    onEnd={onEnd}
                    className="w-full h-16 sm:h-20 border border-neutral-400 rounded-sm bg-white"
                />
            ) : drawn ? (
                <img src={drawn} alt="Paraf" className="w-full border border-neutral-400 rounded-sm bg-white" />
            ) : (
                <div className="w-full h-16 sm:h-20 rounded-sm bg-neutral-50"></div>
            )}
            <span className="mt-1 text-[10px] sm:text-xs text-neutral-500 whitespace-nowrap">
                {side === 'left' ? 'Paraf (1)' : 'Paraf (2)'}
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

function FacilitiesEditor({ items, onChange, lines }: {
    items: string[];
    onChange: (v: string[]) => void;
    lines: number;
}) {
    const count = Math.max(lines, items.length);
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

export default function StatementDocument(props: StatementDocumentProps) {
    const { isKiosk, hasSecond, occ1, occ2, sewaNumeral, dueDay, setDueDay, reminderDay,
        dendaPerDay, setDendaPerDay, meteran, setMeteran, usaha, setUsaha,
        facilities, setFacilities, tanggal, paraf1Img, paraf2Img, onParafEnd,
        sigRef1, parafRef1, sigRef2, parafRef2, kioskSeparateWater } = props;

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
            <div className="w-full min-w-0 bg-neutral-200/70 border border-neutral-300 rounded-xl p-2 sm:p-4">
                {/* HALAMAN 1 */}
                <SheetPage num={1} meteran meteranValue={meteran} onMeteranChange={setMeteran} kioskSeparateWater={kioskSeparateWater}>
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
                            <DocInput value={usaha} onChange={setUsaha} placeholder="______________________________" className="sm:w-56" />
                            , serta tidak diperbolehkan pemindahan kepada pihak lain selain nama yang tertera dalam surat pernyataan.
                        </p>

                        <p className="font-bold">2. Pembayaran</p>
                        <p className="text-justify">
                            Saya menyewa kios sebesar <strong>Rp {sewaNumeral}</strong> setiap tanggal{' '}
                            <DocInput value={dueDay} onChange={v => setDueDay(duaDigit(v))} maxLength={2} /> namun akan
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
                                        <DocInput value={meteran} onChange={v => setMeteran(duaDigit(v))} maxLength={7} placeholder="______" />
                                        , lewat dari itu saya akan membayar air per 1m³ kena <strong>Rp 14.000</strong>, sesuai pemakaiaan.
                                    </li>
                                </>
                            )}
                        </ul>

                        <p className="font-bold">3. Kepatuhan Terhadap Pembayaran</p>
                        <p className="text-justify">
                            Saya menyadari apabila saya terlambat melakukan pembayaran setelah tanggal jatuh tempo, saya akan
                            dikenakan denda sebesar <strong>Rp </strong>
                            <DocInput value={dendaPerDay} onChange={v => setDendaPerDay(duaDigit(v))} maxLength={9} placeholder="0" />
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
                    <ParafSlot editable topClass="top-[78%]" padRef={parafRef1} side="left" drawn={paraf1Img} onEnd={() => onParafEnd(1)} />
                    {hasSecond && <ParafSlot editable topClass="top-[78%]" padRef={parafRef2} side="right" drawn={paraf2Img} onEnd={() => onParafEnd(2)} />}
                </SheetPage>

                {/* HALAMAN 2 */}
                <SheetPage num={2}>
                    <div className="space-y-2">
                        <p className="text-justify">
                            Kios yang saya terima beserta semua fasilitas dalam kondisi baik, dan saya wajib{' '}
                            <strong>MENJAGA</strong> dan <strong>MERAWAT</strong> fasilitas yang ada seperti:
                        </p>
                        <FacilitiesEditor items={facilities} onChange={setFacilities} lines={8} />

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
                        <SignatureBlock hasSecond={hasSecond} occ1={occ1} occ2={occ2} sigRef1={sigRef1} sigRef2={sigRef2} label="Tanda Tangan" />
                    </div>
                    <ParafSlot editable={false} topClass="top-[52%]" padRef={parafRef1} side="left" drawn={paraf1Img} onEnd={() => onParafEnd(1)} />
                    {hasSecond && <ParafSlot editable={false} topClass="top-[52%]" padRef={parafRef2} side="right" drawn={paraf2Img} onEnd={() => onParafEnd(2)} />}
                </SheetPage>
            </div>
        );
    }

    return (
        <div className="w-full min-w-0 bg-neutral-200/70 border border-neutral-300 rounded-xl p-2 sm:p-4">
            {/* HALAMAN 1 */}
            <SheetPage num={1} meteran meteranValue={meteran} onMeteranChange={setMeteran}>
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
                <ParafSlot editable padRef={parafRef1} side="left" drawn={paraf1Img} onEnd={() => onParafEnd(1)} />
                {hasSecond && <ParafSlot editable padRef={parafRef2} side="right" drawn={paraf2Img} onEnd={() => onParafEnd(2)} />}
            </SheetPage>

            {/* HALAMAN 2 */}
            <SheetPage num={2}>
                <div className="space-y-2">
                    <ul className="list-disc pl-5 space-y-2 text-justify">
                        <li>Selain penghuni kos-an dilarang membawa <strong>tamu</strong> kedalam <strong>kamar</strong> termasuk <strong>kurir</strong> dan <strong>tamu</strong> &ldquo;tidak dikenal&rdquo; hanya boleh diterima diluar kamar, kecuali ada <strong>izin</strong> dari <strong>PENGELOLA KOS</strong>.</li>
                        <li><strong>Dilarang</strong> menyewakan kamar kepada orang lain selain nama yang sudah tertera dalam <strong>SURAT PERNYATAAN</strong>, jika melanggar maka <strong>pengelola kos BERHAK memutus SEWA/KONTRAK</strong> dan penghuni wajib mengosongkan kamar serta membersihkan kamar seperti semula dan tidak menerima <strong>KOMPENSASI</strong>.</li>
                    </ul>
                    <p className="text-justify">Semua fasilitas yang ada wajib <strong>dirawat</strong> dan <strong>dijaga</strong> seperti:</p>
                    <FacilitiesEditor items={facilities} onChange={setFacilities} lines={6} />
                    <p className="font-bold pt-2">3. Kepatuhan Terhadap Pembayaran</p>
                    <p className="font-bold">4. Kewajiban Terhadap Biaya Yang Terhutang</p>
                    <p className="text-justify">Saya sebagai penghuni kos bersedia <strong>membayar biaya yang terhutang</strong> seperti:</p>
                    <ol className="list-decimal pl-5 space-y-2 text-justify">
                        <li>Setiap kamar akan dikenakan biaya perbulan sebesar <strong>Rp 100.000</strong> (seratus ribu rupiah) untuk <strong>iuran sampah</strong> dan <strong>air</strong> sebanyak <strong>5m³ per kamar</strong> dihitung berdasarkan angka meteran yang terpasang dimasing-masing kamar.</li>
                        <li>Biaya tambahan air <strong>PDAM</strong> sebesar <strong>Rp14.000/m³</strong> untuk pemakaian lebih dari <strong>5m³</strong>, dihitung sesuai angka meteran permasing-masing kamar bersamaan tanggal pembayaran kos.</li>
                        <li><strong>Pembacaan meteran air</strong> akan dilakukan <strong>setiap tanggal</strong> pembayaran kos untuk masing-masing kamar.</li>
                    </ol>
                    <p className="font-bold">5. Keterlambatan Pembayaran</p>
                    <p className="text-justify">
                        saya menyatakan bahwa membayar biaya sewa kos sebesar <strong>Rp {sewaNumeral}</strong> per bulan.
                        Pembayaran dilakukan setiap bulan, 1 hari sebelum tanggal jatuh tempo, tanggal{' '}
                        <DocInput value={dueDay} onChange={v => setDueDay(duaDigit(v))} maxLength={2} /> setiap bulannya.
                    </p>
                    <p className="text-justify">
                        Jika saya terlambat melakukan pembayaran setelah tanggal jatuh tempo, saya akan dikenakan denda sebesar{' '}
                        <strong>Rp </strong>
                        <DocInput value={dendaPerDay} onChange={v => setDendaPerDay(duaDigit(v))} maxLength={9} placeholder="0" />
                        {' '}per hari keterlambatan sesuai dengan ketentuan yang berlaku. Maksimal denda keterlambatan{' '}
                        <strong>2 hari, diatas 2 hari wajib mengosongkan kosan</strong>.
                    </p>
                    <p className="text-justify">Jika saya berniat untuk mengakhiri masa sewa sebelum waktu yang disepakati, saya akan memberikan pemberitahuan kepada pihak <strong>PENGELOLA KOS</strong> 5 hari</p>
                </div>
                <ParafSlot editable={false} padRef={parafRef1} side="left" drawn={paraf1Img} onEnd={() => onParafEnd(1)} />
                {hasSecond && <ParafSlot editable={false} padRef={parafRef2} side="right" drawn={paraf2Img} onEnd={() => onParafEnd(2)} />}
            </SheetPage>

            {/* HALAMAN 3 */}
            <SheetPage num={3}>
                <div className="space-y-2">
                    <p className="text-justify">sebelumnya dan bertanggung jawab atas pembayaran sewa yang masih terhutang serta kewajiban lain, seperti: air <strong>PDAM</strong> yang <strong>telah digunakan</strong> hingga <strong>saat pengosongan dilakukan</strong>.</p>
                    <p className="font-bold">6. Pengosongan Kamar</p>
                    <p className="font-bold">7. Peraturan Tambahan</p>
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
                    <SignatureBlock hasSecond={hasSecond} occ1={occ1} occ2={occ2} sigRef1={sigRef1} sigRef2={sigRef2} label="Tanda Tangan" />
                </div>
            </SheetPage>
        </div>
    );
}

function SignatureBlock({ hasSecond, occ1, occ2, sigRef1, sigRef2, label }: {
    hasSecond: boolean;
    occ1: Occ;
    occ2: Occ;
    sigRef1: any;
    sigRef2: any;
    label: string;
}) {
    return (
        <div className={`grid gap-10 pt-6 ${hasSecond ? 'grid-cols-1 sm:grid-cols-2' : 'max-w-[300px]'}`}>
            <div>
                <p>{label} (1),</p>
                <div className="mt-2 bg-white border border-neutral-300 overflow-hidden max-w-[280px]">
                    <SignaturePad ref={sigRef1} className="w-full h-28" />
                </div>
                <p className="mt-3">Nama: <strong>{occ1.name}</strong>.</p>
                <p>No. KTP: <strong>{occ1.nik}</strong>.</p>
            </div>
            {hasSecond && (
                <div>
                    <p>{label} (2),</p>
<div className="mt-2 bg-white border border-neutral-300 overflow-hidden max-w-[280px]">
                    <SignaturePad ref={sigRef2} className="w-full h-28" />
                </div>
                    <p className="mt-3">Nama: <strong>{occ2.name}</strong>.</p>
                    <p>No. KTP: <strong>{occ2.nik}</strong>.</p>
                </div>
            )}
        </div>
    );
}