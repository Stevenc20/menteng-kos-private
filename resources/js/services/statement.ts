// ─── Statement / Surat Pernyataan templates (single source of truth) ───
// PDF/template resmi dijadikan blueprint, dibangun ulang sebagai dokumen
// digital interaktif (KAMAR vs KIOS) tanpa mengubah substansi isi surat.

export const formatRupiah = (val: string | number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val) || 0);

export const esc = (s?: string) =>
    (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const indonesianToday = () => {
    const t = new Date();
    return `${String(t.getDate()).padStart(2, '0')} ${monthNames[t.getMonth()]} ${t.getFullYear()}`;
};

// Jatuh tempo = satu hari sebelum tanggal masuk (move_in - 1).
// Jika masuk tanggal 1, gunakan tanggal terakhir bulan sebelumnya.
export const calcDueDay = (iso?: string): string => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return '';
    if (d > 1) return String(d - 1);
    return String(new Date(y, m - 1, 0).getDate());
};

// Reminder = 4 hari sebelum jatuh tempo (mengikuti template Kios: due 24 → reminder 20).
export const calcReminderDay = (dueDay: string): string => {
    const d = parseInt(dueDay, 10);
    if (!isFinite(d)) return '';
    const r = d - 4;
    return String(r >= 1 ? r : 1);
};

export interface StatementParams {
    hasSecond: boolean;
    occ1: { name: string; birth: string; job: string; address: string; nik: string };
    occ2: { name: string; birth: string; job: string; address: string; nik: string };
    sewaNumeral: string;       // "1.700.000"
    dueDay: string;            // "5"
    reminderDay: string;       // Kios: "1" (due - 4)
    dendaPerDay: string | number; // raw number
    meteran: string;           // start meteran
    usaha: string;             // Kios: jenis usaha
    facilities: string[];      // default dari property.facilities
    tanggal: string;           // "09 September 2026"
}

const RESPONSIVE_STYLE = `
<style>
    .stmt { overflow-wrap: anywhere; }
    @media (max-width: 640px) {
        .stmt { font-size: 11px !important; line-height: 1.45 !important; }
        .stmt h2 { font-size: 13px !important; letter-spacing: 0 !important; margin: 10px 0 12px !important; }
        .stmt td { padding: 1px 0 !important; }
        .stmt ol, .stmt ul { padding-left: 16px !important; }
    }
</style>`;

const identityTableHTML = (rows: [string, string][]) => `
    <table style="width:100%;border-collapse:collapse;">
        <tbody>
            ${rows.map(([k, v]) => `
                <tr>
                    <td style="width:130px;vertical-align:top;padding:2px 0;white-space:nowrap;">${k}</td>
                    <td style="padding:2px 0;">: ${esc(v)}</td>
                </tr>`).join('')}
        </tbody>
    </table>`;

const pageFrameHTML = (num: number, inner: string, header?: string, parafY?: string) => `
    <div style="position:relative;width:100%;max-width:794px;margin:0 auto 22px;min-height:1122px;padding:22px 9% 56px;box-sizing:border-box;border:1px solid #ddd;background:#fff;font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.6;font-size:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <span style="font-style:italic;">Menteng Kost</span>
            ${header || ''}
        </div>
        ${inner}
        <div style="position:absolute;bottom:16px;left:0;right:0;text-align:center;">${num}</div>
        ${parafY ? `
            <div style="position:absolute;left:1.5%;top:${parafY};font-size:11px;">Paraf (1)</div>
            <div style="position:absolute;right:1.5%;top:${parafY};font-size:11px;">Paraf (2)</div>
        ` : ''}
    </div>`;

const signatureColumnsHTML = (p: StatementParams) => `
    <div style="display:flex;gap:50px;margin-top:26px;">
        <div style="flex:1;max-width:300px;">
            <p>Tanda Tangan (1),</p>
            <div style="height:110px;"></div>
            <p>Nama: <strong>${esc(p.occ1.name)}</strong>.</p>
            <p>No. KTP: <strong>${esc(p.occ1.nik)}</strong>.</p>
        </div>
        ${p.hasSecond ? `
            <div style="flex:1;max-width:300px;">
                <p>Tanda Tangan (2),</p>
                <div style="height:110px;"></div>
                <p>Nama: <strong>${esc(p.occ2.name)}</strong>.</p>
                <p>No. KTP: <strong>${esc(p.occ2.nik)}</strong>.</p>
            </div>
        ` : ''}
    </div>`;

// ═══════════════════════ TEMPLATE KAMAR (3 halaman) ═══════════════════════

const meteranBoxHTML = (p: StatementParams) => `
    <div style="border:1.5px solid #666;padding:5px 12px;text-align:center;font-size:11px;">
        <div style="font-weight:bold;white-space:nowrap;">START METERAN:</div>
        <div style="font-style:italic;font-size:9px;color:#666;white-space:nowrap;">WAJIB DIISI</div>
        <div style="margin-top:2px;letter-spacing:2px;font-weight:bold;font-size:12px;white-space:nowrap;">${p.meteran ? `${esc(p.meteran)}m³ - ${Number(p.meteran) + 5}m³` : '..................'}</div>
    </div>`;

export const roomStatementHTML = (p: StatementParams) => {
    const facCount = Math.max(6, p.facilities.length);
    const facilityItems = Array.from({ length: facCount }, (_, i) => {
        const f = p.facilities[i]?.trim();
        if (i === 5 && !f) {
            return `<li style="margin:3px 0;"><span style="text-decoration:underline;display:inline-block;min-width:55%;">____________</span> <em style="font-size:11px;color:#555;">!note: jika ada ac wajib mencuci ac 2 bulan sekali.</em></li>`;
        }
        return f
            ? `<li style="margin:3px 0;">${esc(f)}</li>`
            : `<li style="margin:3px 0;"><span style="text-decoration:underline;display:inline-block;min-width:55%;">____________</span></li>`;
    }).join('');

    const p1 = `
        <h2 style="text-align:center;letter-spacing:1px;margin:14px 0 18px;font-size:17px;">SURAT PERNYATAAN</h2>
        <p>Yang bertanda tangan di bawah ini:</p>
        ${identityTableHTML([
            ['Nama (1)', p.occ1.name],
            ['Tempat, Tgl Lahir', p.occ1.birth],
            ['Pekerjaan', p.occ1.job],
            ['Alamat', p.occ1.address],
            ['Nomor KTP', p.occ1.nik],
        ])}
        ${p.hasSecond ? `
            <p style="margin:10px 0 2px;">Dan pasangan saya,</p>
            ${identityTableHTML([
                ['Nama (2)', p.occ2.name],
                ['Tempat, Tgl Lahir', p.occ2.birth],
                ['Pekerjaan', p.occ2.job],
                ['Alamat', p.occ2.address],
                ['Nomor KTP', p.occ2.nik],
            ])}
        ` : ''}
        <p style="margin-top:18px;">Dengan ini kami menyatakan dengan sebenar-benarnya bahwa:</p>
        <p style="font-weight:bold;">1. Menempati Kosan</p>
        <p style="text-align:justify;">
            ${
                p.hasSecond
                    ? `Yang menempati kos adalah <strong>${esc(p.occ1.name)}</strong> dan <strong>${esc(p.occ2.name)}</strong>, serta`
                    : `Yang menempati kos adalah <strong>${esc(p.occ1.name)}</strong>, serta`
            }
            Tidak diperbolehkan ada orang lain yang tinggal di kos ini selain nama-nama yang tertera dalam pernyataan ini, jika melanggar maka pengelola kos berhak <strong>memutus</strong> <strong>SEWA/KONTRAK</strong> dan penghuni wajib mengosongkan kamar tanpa <strong>KOMPENSASI</strong>.
        </p>
        <p style="font-weight:bold;">2. Kepatuhan Terhadap Peraturan Kos</p>
        <p style="text-align:justify;">Bersedia mematuhi segala peraturan kos baik yang tertulis maupun tidak tertulis, seperti:</p>
        <ul style="padding-left:24px;margin:4px 0;">
            <li style="margin:6px 0;text-align:justify;">Saat pertama kali menempati kosan wajib menyerahkan <strong>KTP dan KK</strong> yang akan menghuni, 1x24 jam wajib lapor <strong>RT</strong>.</li>
            <li style="margin:6px 0;text-align:justify;">Saya bertanggung jawab penuh atas <strong>kerusakan</strong> atau <strong>kehilangan</strong> fasilitas yang ada di dalam <strong>kamar kos</strong> selama <strong>masa sewa</strong>. Jika terjadi <strong>kerusakan akibat kelalaian saya</strong>, saya akan <strong>mengganti kerugian</strong> sesuai dengan <strong>nilai kerusakan</strong> yang ditentukan oleh <strong>pihak pengelola kos</strong>.</li>
            <li style="margin:6px 0;text-align:justify;">Mematuhi peraturan <strong>HUKUM</strong> yang berlaku di <strong>Indonesia</strong> dan <strong>Menjaga norma kesopanan</strong> serta <strong>kesusilaan (TIDAK BOLEH OPEN BO)</strong>. Dan <strong>tidak menimbulkan kegaduhan bagi penghuni lain</strong>.</li>
            <li style="margin:6px 0;text-align:justify;">Keluar masuk <strong>gerbang utama wajib menutup dan mengunci Kembali</strong>, dan bila diatas <strong>pukul 22.00 WIB</strong>, <strong>wajib mengembok gerbang utama!</strong>.</li>
        </ul>
        <p style="text-align:justify;">Menjaga keamanan dan kenyaman Bersama, seperti:</p>`;

    const p2 = `
        <ul style="padding-left:24px;margin:0;">
            <li style="margin:8px 0;text-align:justify;">Selain penghuni kos-an dilarang membawa <strong>tamu</strong> kedalam <strong>kamar</strong> termasuk <strong>kurir</strong> dan <strong>tamu</strong> &ldquo;tidak dikenal&rdquo; hanya boleh diterima diluar kamar, kecuali ada <strong>izin</strong> dari <strong>PENGELOLA KOS</strong>.</li>
            <li style="margin:8px 0;text-align:justify;"><strong>Dilarang</strong> menyewakan kamar kepada orang lain selain nama yang sudah tertera dalam <strong>SURAT PERNYATAAN</strong>, jika melanggar maka <strong>pengelola kos BERHAK memutus SEWA/KONTRAK</strong> dan penghuni wajib mengosongkan kamar serta membersihkan kamar seperti semula dan tidak menerima <strong>KOMPENSASI</strong>.</li>
        </ul>
        <p style="text-align:justify;">Semua fasilitas yang ada wajib <strong>dirawat</strong> dan <strong>dijaga</strong> seperti:</p>
        <ol style="padding-left:24px;margin:4px 0;">${facilityItems}</ol>
        <p style="font-weight:bold;">3. Kepatuhan Terhadap Pembayaran</p>
        <p style="font-weight:bold;">4. Kewajiban Terhadap Biaya Yang Terhutang</p>
        <p style="text-align:justify;">Saya sebagai penghuni kos bersedia <strong>membayar biaya yang terhutang</strong> seperti:</p>
        <ol style="padding-left:24px;margin:4px 0;">
            <li style="margin:6px 0;text-align:justify;">Setiap kamar akan dikenakan biaya perbulan sebesar <strong>Rp 100.000</strong> (seratus ribu rupiah) untuk <strong>iuran sampah</strong> dan <strong>air</strong> sebanyak <strong>5m³ per kamar</strong> dihitung berdasarkan angka meteran yang terpasang dimasing-masing kamar.</li>
            <li style="margin:6px 0;text-align:justify;">Biaya tambahan air <strong>PDAM</strong> sebesar <strong>Rp14.000/m³</strong> untuk pemakaian lebih dari <strong>5m³</strong>, dihitung sesuai angka meteran permasing-masing kamar bersamaan tanggal pembayaran kos.</li>
            <li style="margin:6px 0;text-align:justify;"><strong>Pembacaan meteran air</strong> akan dilakukan <strong>setiap tanggal</strong> pembayaran kos untuk masing-masing kamar.</li>
        </ol>
        <p style="font-weight:bold;">5. Keterlambatan Pembayaran</p>
        <p style="text-align:justify;">
            saya menyatakan bahwa membayar biaya sewa kos sebesar <strong>Rp ${esc(p.sewaNumeral)}</strong> per bulan.
            Pembayaran dilakukan setiap bulan, 1 hari sebelum tanggal jatuh tempo, tanggal <strong>${esc(p.dueDay)}</strong> setiap bulannya.
        </p>
        <p style="text-align:justify;">
            Jika saya terlambat melakukan pembayaran setelah tanggal jatuh tempo, saya akan dikenakan denda sebesar <strong>${esc(formatRupiah(p.dendaPerDay))}</strong> per hari keterlambatan sesuai dengan ketentuan yang berlaku. Maksimal denda keterlambatan <strong>2 hari, diatas 2 hari wajib mengosongkan kosan</strong>.
        </p>
        <p style="text-align:justify;">Jika saya berniat untuk mengakhiri masa sewa sebelum waktu yang disepakati, saya akan memberikan pemberitahuan kepada pihak <strong>PENGELOLA KOS</strong> 5 hari</p>`;

    const p3 = `
        <p style="text-align:justify;">sebelumnya dan bertanggung jawab atas pembayaran sewa yang masih terhutang serta kewajiban lain, seperti: air <strong>PDAM</strong> yang <strong>telah digunakan</strong> hingga <strong>saat pengosongan dilakukan</strong>.</p>
        <p style="font-weight:bold;">6. Pengosongan Kamar</p>
        <p style="font-weight:bold;">7. Peraturan Tambahan</p>
        <p style="text-align:justify;">➢ Saya menyadari bahwa <strong>PENGELOLA KOS</strong> berhak meminta saya untuk mengosongkan kamar kosan apabila:</p>
        <ol style="padding-left:24px;margin:4px 0;">
            <li style="margin:4px 0;">Saya telat melakukan pembayaran melebihi 2 hari seperti di <em><strong>point 4</strong></em> <em><strong>keterlambatan</strong></em>.</li>
            <li style="margin:4px 0;">Saya melakukan <em><strong>PELANGGARAN BERAT</strong></em> terhadap peraturan hukum yang berlaku di Indonesia (seperti <strong>PERJUDIAN, NARKOBA</strong>, dan <strong>TINDAK PIDANA BERAT</strong> lainnya, yang DILARANG sesuai dengan <em><strong>Pasal 303 KUHP</strong></em> tentang <em><strong>perjudian</strong></em> dan <em><strong>Pasal 112, Pasal 113, Pasal 114 UU No. 35 Tahun 2009 tentang Narkotika</strong></em>).</li>
        </ol>
        <p style="text-align:justify;">➢ Saya menyadari bahwa peraturan terkait <em><strong>pengelolaan kos dapat berubah</strong></em> <em><strong>sewaktu-waktu</strong></em>, dan <strong>saya berjanji</strong> untuk selalu <strong>mengikuti peraturan baru</strong> yang <strong>diberlakukan</strong> oleh pihak pengelola kos. Apabila saya telah <strong>menerima</strong> <strong>dua</strong> kali <strong>teguran</strong>, baik secara <em><strong>lisan</strong></em> maupun <em><strong>tertulis</strong></em>, dari <strong>PENGELOLA KOS</strong> atas <strong>pelanggaran peraturan</strong> dan masih <strong>mengulanginya</strong> <strong>kembali</strong>, <strong>SAYA BERSEDIA</strong> untuk <strong>mengosongkan</strong> <strong>kosan</strong> dan <strong>mengembalikan</strong> <strong>kunci kamar</strong> serta <strong>gembok pagar</strong> tanpa <strong>MENUNTUT KOMPENSASI APAPUN</strong>!, serta <strong>TETAP MEMBAYARKAN SISA KEWAJIBAN JIKA ADA</strong>.</p>
        <p style="text-align:justify;">Demikian surat pernyataan ini saya buat dengan sebenar-benarnya tanpa ada paksaan atau tekanan dari pihak manapun.</p>
        <p style="margin-top:14px;"><strong>Dibuat di:</strong> Jakarta</p>
        <p><strong>Pada tanggal:</strong> ${esc(p.tanggal)}</p>
        <p style="margin-top:22px;"><strong>Yang Membuat Pernyataan,</strong></p>
        ${signatureColumnsHTML(p)}`;

    return `${RESPONSIVE_STYLE}
    <div class="stmt" style="font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.6;font-size:14px;">
        ${pageFrameHTML(1, p1, meteranBoxHTML(p), '63%')}
        ${pageFrameHTML(2, p2, undefined, '35%')}
        ${pageFrameHTML(3, p3)}
    </div>`;
};

// ═══════════════════════ TEMPLATE KIOS (2 halaman) ═══════════════════════

export const kioskStatementHTML = (p: StatementParams) => {
    const facCount = Math.max(8, p.facilities.length);
    const dendaNumeral = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(p.dendaPerDay) || 0);
    const facilityItems = Array.from({ length: facCount }, (_, i) => {
        const f = p.facilities[i]?.trim();
        return f
            ? `<li style="margin:3px 0;">${esc(f)}</li>`
            : `<li style="margin:3px 0;"><span style="text-decoration:underline;display:inline-block;min-width:55%;">____________</span></li>`;
    }).join('');

    const block2 = p.hasSecond
        ? `<p style="margin:10px 0 2px;">Dan pasangan saya,</p>
           ${identityTableHTML([
                ['Nama (2)', p.occ2.name],
                ['Tempat, Tgl Lahir', p.occ2.birth],
                ['Pekerjaan', p.occ2.job],
                ['Alamat', p.occ2.address],
                ['Nomor KTP', p.occ2.nik],
            ])}`
        : '';

    const p1 = `
        <h2 style="text-align:center;letter-spacing:1px;margin:14px 0 6px;font-size:17px;">SURAT PERNYATAAN</h2>
        <h2 style="text-align:center;margin:0 0 18px;font-size:15px;">KIOS</h2>
        <p>Yang bertanda tangan dibawah ini,</p>
        ${identityTableHTML([
            ['Nama', p.occ1.name],
            ['Tempat, Tanggal Lahir', p.occ1.birth],
            ['Pekerjaan', p.occ1.job],
            ['Alamat', p.occ1.address],
            ['Nomor KTP', p.occ1.nik],
        ])}
        ${block2}
        <p style="margin-top:18px;">Dengan ini saya menyatakan dengan sebenar-benarnya bahwa:</p>

        <p style="font-weight:bold;">1. Menempati Kios</p>
        <p style="text-align:justify;">Untuk usaha <strong>${esc(p.usaha) || '<em>______________________________</em>'}</strong>, serta tidak diperbolehkan pemindahan kepada pihak lain selain nama yang tertera dalam surat pernyataan.</p>

        <p style="font-weight:bold;">2. Pembayaran</p>
        <p style="text-align:justify;">Saya menyewa kios sebesar <strong>Rp ${esc(p.sewaNumeral)}</strong> setiap tanggal <strong>${esc(p.dueDay)}</strong> namun akan direminder setiap tgl <strong>${esc(p.reminderDay)}</strong>, yang terdiri dari:</p>
        <ul style="padding-left:24px;margin:4px 0;">
            <li style="margin:4px 0;">Uang sewa kios <strong>Rp ${esc(p.sewaNumeral)}</strong></li>
            <li style="margin:4px 0;">Uang air sebanyak <strong>5m³</strong> dengan meteran dari <strong>${p.meteran ? `${esc(p.meteran)}m³ - ${Number(p.meteran) + 5}m³` : '_______________'}</strong>, lewat dari itu saya akan membayar air per 1m³ kena <strong>Rp 14.000</strong>, sesuai pemakaiaan.</li>
        </ul>

        <p style="font-weight:bold;">3. Kepatuhan Terhadap Pembayaran</p>
        <p style="text-align:justify;">Saya menyadari apabila saya terlambat melakukan pembayaran setelah tanggal jatuh tempo, saya akan dikenakan denda sebesar <strong>Rp ${esc(dendaNumeral)}</strong> per hari keterlambatan sesuai dengan ketentuan yang berlaku. Maksimal denda keterlambatan <strong>2 hari, diatas 2 hari wajib mengosongkan kios</strong>.</p>

        <p style="font-weight:bold;">4. Kepatuhan Terhadap Peraturan Kios</p>
        <p style="text-align:justify;">Saya menyadari untuk mematuhi segala peraturan kios baik yang tertulis maupun tidak tertulis, seperti:</p>
        <ul style="padding-left:24px;margin:4px 0;">
            <li style="margin:6px 0;text-align:justify;">Saat pertama kali menempati kios wajib menyerahkan <strong>KTP dan KK</strong>, 1x24 jam wajib lapor <strong>RT</strong>.</li>
            <li style="margin:6px 0;text-align:justify;">Saya bertanggung jawab penuh atas <strong>kerusakan</strong> atau <strong>kehilangan</strong> fasilitas yang ada di dalam <strong>KIOS</strong> selama <strong>masa sewa</strong>. Jika terjadi <strong>kerusakan akibat kelalaian saya</strong>, saya akan <strong>mengganti kerugian</strong> sesuai dengan <strong>nilai kerusakan</strong> yang ditentukan oleh <strong>pihak pengelola kos</strong>.</li>
            <li style="margin:6px 0;text-align:justify;">Mematuhi peraturan <strong>HUKUM</strong> yang berlaku di <strong>Indonesia</strong> dan <strong>Menjaga norma kesopanan</strong> serta <strong>tidak menimbulkan kegaduhan bagi penghuni lain</strong>.</li>
            <li style="margin:6px 0;text-align:justify;">Keluar masuk <strong>gerbang utama wajib menutup dan mengunci Kembali</strong>, apabila diatas <strong>pukul 22.00 WIB</strong>, <strong>wajib mengembok gerbang utama!</strong>.</li>
        </ul>`;

    const p2 = `
        <p style="text-align:justify;">Kios yang saya terima beserta semua fasilitas dalam kondisi baik, dan saya wajib <strong>MENJAGA</strong> dan <strong>MERAWAT</strong> fasilitas yang ada seperti:</p>
        <ol style="padding-left:24px;margin:4px 0;">${facilityItems}</ol>

        <p style="font-weight:bold;">5. Pengosongan Kios</p>
        <p style="text-align:justify;">Jika saya berniat untuk mengakhiri masa sewa sebelum waktu yang disepakati, saya akan memberikan pemberitahuan kepada pihak <strong>PENGELOLA KOS</strong> 5 hari sebelumnya dan bertanggung jawab atas pembayaran sewa yang masih terhutang serta kewajiban lain, seperti: air <strong>PDAM</strong> yang <strong>telah digunakan</strong> hingga <strong>saat pengosongan dilakukan</strong>.</p>

        <p style="font-weight:bold;">6. Peraturan Tambahan</p>
        <p style="text-align:justify;">➢ Saya menyadari bahwa <strong>PENGELOLA</strong> berhak meminta saya untuk mengosongkan kios apabila:</p>
        <ol style="padding-left:24px;margin:4px 0;">
            <li style="margin:4px 0;">Saya telat melakukan pembayaran melebihi 2 hari seperti di point 3 keterlambatan.</li>
            <li style="margin:4px 0;">Saya melakukan <em><strong>PELANGGARAN BERAT</strong></em> terhadap peraturan hukum yang berlaku di Indonesia (seperti <strong>PERJUDIAN, NARKOBA</strong>, dan <strong>TINDAK PIDANA BERAT</strong> lainnya, yang DILARANG sesuai dengan <em><strong>Pasal 303 KUHP</strong></em> tentang <em><strong>perjudian</strong></em> dan <em><strong>Pasal 112, Pasal 113, Pasal 114 UU No. 35 Tahun 2003 tentang Narkotika</strong></em>).</li>
        </ol>
        <p style="text-align:justify;">➢ Saya menyadari bahwa peraturan terkait <strong>pengelolaan kios dapat berubah</strong> <strong>sewaktu-waktu</strong>, dan <strong>saya berjanji</strong> untuk selalu <strong>mengikuti peraturan baru</strong> yang <strong>diberlakukan</strong> oleh pihak pengelola. Apabila saya telah <strong>menerima</strong> <strong>dua</strong> kali <strong>teguran</strong>, baik secara <em><strong>lisan</strong></em> maupun <em><strong>tertulis</strong></em>, dari <strong>PENGELOLA</strong> atas <strong>pelanggaran peraturan</strong> dan masih <strong>mengulanginya</strong> <strong>kembali</strong>, <strong>SAYA BERSEDIA</strong> untuk <strong>mengosongkan kios</strong> dan <strong>mengembalikan semua kunci kios</strong> dan <strong>menyerahkan kios dalam kondisi baik</strong> seperti saat saya terima, serta <strong>gembok pagar</strong> tanpa <strong>MENUNTUT KOMPENSASI APAPUN!</strong>, serta <strong>TETAP MEMBAYARKAN SISA KEWAJIBAN JIKA ADA</strong>.</p>

        <p style="font-weight:bold;">Dokumentasi kios saat diserahkan</p>
        <div style="border:1.5px dashed #999;height:110px;margin:4px 0 14px;"></div>

        <p style="text-align:justify;">Demikian surat pernyataan ini saya buat dengan sebenar-benarnya tanpa ada paksaan atau tekanan dari pihak manapun.</p>
        <p style="margin-top:10px;"><strong>Dibuat di:</strong> Jakarta</p>
        <p><strong>Pada tanggal:</strong> ${esc(p.tanggal)}</p>
        <p style="margin-top:20px;"><strong>Yang Membuat Pernyataan,</strong></p>
        ${signatureColumnsHTML(p)}`;

    return `${RESPONSIVE_STYLE}
    <div class="stmt" style="font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.6;font-size:14px;">
        ${pageFrameHTML(1, p1, meteranBoxHTML(p), '78%')}
        ${pageFrameHTML(2, p2, undefined, '52%')}
    </div>`;
};

export const buildStatementHTML = (isKiosk: boolean, p: StatementParams) =>
    isKiosk ? kioskStatementHTML(p) : roomStatementHTML(p);