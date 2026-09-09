var e=e=>new Intl.NumberFormat(`id-ID`,{style:`currency`,currency:`IDR`,maximumFractionDigits:0}).format(Number(e)||0),t=e=>(e||``).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e]),n=[`Januari`,`Februari`,`Maret`,`April`,`Mei`,`Juni`,`Juli`,`Agustus`,`September`,`Oktober`,`November`,`Desember`],r=()=>{let e=new Date;return`${String(e.getDate()).padStart(2,`0`)} ${n[e.getMonth()]} ${e.getFullYear()}`},i=e=>{if(!e)return``;let[t,n,r]=e.split(`-`).map(Number);return!t||!n||!r?``:String(r>1?r-1:new Date(t,n-1,0).getDate())},a=e=>{let t=parseInt(e,10);if(!isFinite(t))return``;let n=t-4;return String(n>=1?n:1)},o=`
<style>
    .stmt { overflow-wrap: anywhere; }
    @media (max-width: 640px) {
        .stmt { font-size: 11px !important; line-height: 1.45 !important; }
        .stmt h2 { font-size: 13px !important; letter-spacing: 0 !important; margin: 10px 0 12px !important; }
        .stmt td { padding: 1px 0 !important; }
        .stmt ol, .stmt ul { padding-left: 16px !important; }
    }
</style>`,s=e=>`
    <table style="width:100%;border-collapse:collapse;">
        <tbody>
            ${e.map(([e,n])=>`
                <tr>
                    <td style="width:130px;vertical-align:top;padding:2px 0;white-space:nowrap;">${e}</td>
                    <td style="padding:2px 0;">: ${t(n)}</td>
                </tr>`).join(``)}
        </tbody>
    </table>`,c=(e,t,n,r,i,a)=>`
    <div style="position:relative;width:100%;max-width:794px;margin:0 auto 22px;min-height:1122px;padding:22px 9% 56px;box-sizing:border-box;border:1px solid #ddd;background:#fff;font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.6;font-size:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <span style="font-style:italic;">Menteng Kost</span>
            ${n||``}
        </div>
        ${t}
        <div style="position:absolute;bottom:16px;left:0;right:0;text-align:center;">${e}</div>
        ${r?`
            <div style="position:absolute;left:1.5%;top:${r};">
                ${i?`<img src="${i}" alt="Paraf (1)" style="max-height:64px;max-width:120px;border:1px solid #ccc;background:#fff;display:block;" />`:`<div style="font-size:11px;">Paraf (1)</div>`}
            </div>
            <div style="position:absolute;right:1.5%;top:${r};">
                ${a?`<img src="${a}" alt="Paraf (2)" style="max-height:64px;max-width:120px;border:1px solid #ccc;background:#fff;display:block;" />`:`<div style="font-size:11px;">Paraf (2)</div>`}
            </div>
        `:``}
    </div>`,l=e=>`
    <div style="display:flex;gap:50px;margin-top:26px;">
        <div style="flex:1;max-width:300px;">
            <p>Tanda Tangan (1),</p>
            ${e.signatures?.sig1?`<img src="${e.signatures.sig1}" alt="Tanda Tangan (1)" style="width:100%;max-width:280px;max-height:130px;object-fit:contain;margin-top:6px;background:#fff;border:1px solid #ddd;display:block;" />`:`<div style="height:110px;"></div>`}
            <p>Nama: <strong>${t(e.occ1.name)}</strong>.</p>
            <p>No. KTP: <strong>${t(e.occ1.nik)}</strong>.</p>
        </div>
        ${e.hasSecond?`
            <div style="flex:1;max-width:300px;">
                <p>Tanda Tangan (2),</p>
                ${e.signatures?.sig2?`<img src="${e.signatures.sig2}" alt="Tanda Tangan (2)" style="width:100%;max-width:280px;max-height:130px;object-fit:contain;margin-top:6px;background:#fff;border:1px solid #ddd;display:block;" />`:`<div style="height:110px;"></div>`}
                <p>Nama: <strong>${t(e.occ2.name)}</strong>.</p>
                <p>No. KTP: <strong>${t(e.occ2.nik)}</strong>.</p>
            </div>
        `:``}
    </div>`,u=e=>`
    <div style="border:1.5px solid #666;padding:5px 12px;text-align:center;font-size:11px;">
        <div style="font-weight:bold;white-space:nowrap;">START METERAN:</div>
        <div style="font-style:italic;font-size:9px;color:#666;white-space:nowrap;">WAJIB DIISI</div>
        ${e.kioskSeparateWater?`<div style="margin-top:2px;letter-spacing:2px;font-weight:bold;font-size:12px;white-space:nowrap;">${e.meteran?`${t(e.meteran)}m³`:`..................`}</div>
                   <div style="font-style:italic;font-size:9px;color:#666;white-space:nowrap;">Pemakaian diakumulasi s/d tiap tanggal jatuh tempo</div>`:`<div style="margin-top:2px;letter-spacing:2px;font-weight:bold;font-size:12px;white-space:nowrap;">${e.meteran?`${t(e.meteran)}m³ - ${Number(e.meteran)+5}m³`:`..................`}</div>`}
    </div>`,d=n=>{let r=Math.max(6,n.facilities.length),i=Array.from({length:r},(e,r)=>{let i=n.facilities[r]?.trim();return r===5&&!i?`<li style="margin:3px 0;"><span style="text-decoration:underline;display:inline-block;min-width:55%;">____________</span> <em style="font-size:11px;color:#555;">!note: jika ada ac wajib mencuci ac 2 bulan sekali.</em></li>`:i?`<li style="margin:3px 0;">${t(i)}</li>`:`<li style="margin:3px 0;"><span style="text-decoration:underline;display:inline-block;min-width:55%;">____________</span></li>`}).join(``),a=`
        <h2 style="text-align:center;letter-spacing:1px;margin:14px 0 18px;font-size:17px;">SURAT PERNYATAAN</h2>
        <p>Yang bertanda tangan di bawah ini:</p>
        ${s([[`Nama (1)`,n.occ1.name],[`Tempat, Tgl Lahir`,n.occ1.birth],[`Pekerjaan`,n.occ1.job],[`Alamat`,n.occ1.address],[`Nomor KTP`,n.occ1.nik]])}
        ${n.hasSecond?`
            <p style="margin:10px 0 2px;">Dan pasangan saya,</p>
            ${s([[`Nama (2)`,n.occ2.name],[`Tempat, Tgl Lahir`,n.occ2.birth],[`Pekerjaan`,n.occ2.job],[`Alamat`,n.occ2.address],[`Nomor KTP`,n.occ2.nik]])}
        `:``}
        <p style="margin-top:18px;">Dengan ini kami menyatakan dengan sebenar-benarnya bahwa:</p>
        <p style="font-weight:bold;">1. Menempati Kosan</p>
        <p style="text-align:justify;">
            ${n.hasSecond?`Yang menempati kos adalah <strong>${t(n.occ1.name)}</strong> dan <strong>${t(n.occ2.name)}</strong>, serta`:`Yang menempati kos adalah <strong>${t(n.occ1.name)}</strong>, serta`}
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
        <p style="text-align:justify;">Menjaga keamanan dan kenyaman Bersama, seperti:</p>`,d=`
        <ul style="padding-left:24px;margin:0;">
            <li style="margin:8px 0;text-align:justify;">Selain penghuni kos-an dilarang membawa <strong>tamu</strong> kedalam <strong>kamar</strong> termasuk <strong>kurir</strong> dan <strong>tamu</strong> &ldquo;tidak dikenal&rdquo; hanya boleh diterima diluar kamar, kecuali ada <strong>izin</strong> dari <strong>PENGELOLA KOS</strong>.</li>
            <li style="margin:8px 0;text-align:justify;"><strong>Dilarang</strong> menyewakan kamar kepada orang lain selain nama yang sudah tertera dalam <strong>SURAT PERNYATAAN</strong>, jika melanggar maka <strong>pengelola kos BERHAK memutus SEWA/KONTRAK</strong> dan penghuni wajib mengosongkan kamar serta membersihkan kamar seperti semula dan tidak menerima <strong>KOMPENSASI</strong>.</li>
        </ul>
        <p style="text-align:justify;">Semua fasilitas yang ada wajib <strong>dirawat</strong> dan <strong>dijaga</strong> seperti:</p>
        <ol style="padding-left:24px;margin:4px 0;">${i}</ol>
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
            saya menyatakan bahwa membayar biaya sewa kos sebesar <strong>Rp ${t(n.sewaNumeral)}</strong> per bulan.
            Pembayaran dilakukan setiap bulan, 1 hari sebelum tanggal jatuh tempo, tanggal <strong>${t(n.dueDay)}</strong> setiap bulannya.
        </p>
        <p style="text-align:justify;">
            Jika saya terlambat melakukan pembayaran setelah tanggal jatuh tempo, saya akan dikenakan denda sebesar <strong>${t(e(n.dendaPerDay))}</strong> per hari keterlambatan sesuai dengan ketentuan yang berlaku. Maksimal denda keterlambatan <strong>2 hari, diatas 2 hari wajib mengosongkan kosan</strong>.
        </p>
        <p style="text-align:justify;">Jika saya berniat untuk mengakhiri masa sewa sebelum waktu yang disepakati, saya akan memberikan pemberitahuan kepada pihak <strong>PENGELOLA KOS</strong> 5 hari</p>`,f=`
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
        <p><strong>Pada tanggal:</strong> ${t(n.tanggal)}</p>
        <p style="margin-top:22px;"><strong>Yang Membuat Pernyataan,</strong></p>
        ${l(n)}`;return`${o}
    <div class="stmt" style="font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.6;font-size:14px;">
        ${c(1,a,u(n),`63%`,n.signatures?.paraf1,n.signatures?.paraf2)}
        ${c(2,d,void 0,`35%`,n.signatures?.paraf1,n.signatures?.paraf2)}
        ${c(3,f)}
    </div>`},f=n=>{let r=Math.max(8,n.facilities.length),i=new Intl.NumberFormat(`id-ID`,{maximumFractionDigits:0}).format(Number(n.dendaPerDay)||0),a=Array.from({length:r},(e,r)=>{let i=n.facilities[r]?.trim();return i?`<li style="margin:3px 0;">${t(i)}</li>`:`<li style="margin:3px 0;"><span style="text-decoration:underline;display:inline-block;min-width:55%;">____________</span></li>`}).join(``),d=n.hasSecond?`<p style="margin:10px 0 2px;">Dan pasangan saya,</p>
           ${s([[`Nama (2)`,n.occ2.name],[`Tempat, Tgl Lahir`,n.occ2.birth],[`Pekerjaan`,n.occ2.job],[`Alamat`,n.occ2.address],[`Nomor KTP`,n.occ2.nik]])}`:``,f=`
        <h2 style="text-align:center;letter-spacing:1px;margin:14px 0 6px;font-size:17px;">SURAT PERNYATAAN</h2>
        <h2 style="text-align:center;margin:0 0 18px;font-size:15px;">KIOS</h2>
        <p>Yang bertanda tangan dibawah ini,</p>
        ${s([[`Nama`,n.occ1.name],[`Tempat, Tanggal Lahir`,n.occ1.birth],[`Pekerjaan`,n.occ1.job],[`Alamat`,n.occ1.address],[`Nomor KTP`,n.occ1.nik]])}
        ${d}
        <p style="margin-top:18px;">Dengan ini saya menyatakan dengan sebenar-benarnya bahwa:</p>

        <p style="font-weight:bold;">1. Menempati Kios</p>
        <p style="text-align:justify;">Untuk usaha <strong>${t(n.usaha)||`<em>______________________________</em>`}</strong>, serta tidak diperbolehkan pemindahan kepada pihak lain selain nama yang tertera dalam surat pernyataan.</p>

        <p style="font-weight:bold;">2. Pembayaran</p>
        <p style="text-align:justify;">Saya menyewa kios sebesar <strong>Rp ${t(n.sewaNumeral)}</strong> setiap tanggal <strong>${t(n.dueDay)}</strong> namun akan direminder setiap tgl <strong>${t(n.reminderDay)}</strong>, yang terdiri dari:</p>
        <ul style="padding-left:24px;margin:4px 0;">
            <li style="margin:4px 0;">Uang sewa kios <strong>Rp ${t(n.sewaNumeral)}</strong>${n.kioskSeparateWater?` — harga ini <strong>TIDAK termasuk</strong> biaya pemakaian air PAM.</li>
            <li style="margin:4px 0;">Biaya pemakaian air <strong>PAM</strong> dibayar <strong>terpisah</strong>, dihitung berdasarkan <strong>akumulasi pemakaian aktual</strong> dari <strong>start meteran</strong> sampai pembacaan pada <strong>setiap tanggal jatuh tempo</strong> sesuai <strong>meter air</strong> dengan tarif <strong>Rp ${e(14e3)}/m³</strong>. Biaya pemakaian air PAM akan <strong>ditambahkan pada tagihan pembayaran bulanan</strong>. Rumus: <em>pemakaian air (m³) × Rp ${e(14e3)}</em>.</li>`:`.</li>
            <li style="margin:4px 0;">Uang air sebanyak <strong>5m³</strong> dengan meteran dari <strong>${n.meteran?`${t(n.meteran)}m³ - ${Number(n.meteran)+5}m³`:`_______________`}</strong>, lewat dari itu saya akan membayar air per 1m³ kena <strong>Rp 14.000</strong>, sesuai pemakaiaan.</li>`}
        </ul>

        <p style="font-weight:bold;">3. Kepatuhan Terhadap Pembayaran</p>
        <p style="text-align:justify;">Saya menyadari apabila saya terlambat melakukan pembayaran setelah tanggal jatuh tempo, saya akan dikenakan denda sebesar <strong>Rp ${t(i)}</strong> per hari keterlambatan sesuai dengan ketentuan yang berlaku. Maksimal denda keterlambatan <strong>2 hari, diatas 2 hari wajib mengosongkan kios</strong>.</p>

        <p style="font-weight:bold;">4. Kepatuhan Terhadap Peraturan Kios</p>
        <p style="text-align:justify;">Saya menyadari untuk mematuhi segala peraturan kios baik yang tertulis maupun tidak tertulis, seperti:</p>
        <ul style="padding-left:24px;margin:4px 0;">
            <li style="margin:6px 0;text-align:justify;">Saat pertama kali menempati kios wajib menyerahkan <strong>KTP dan KK</strong>, 1x24 jam wajib lapor <strong>RT</strong>.</li>
            <li style="margin:6px 0;text-align:justify;">Saya bertanggung jawab penuh atas <strong>kerusakan</strong> atau <strong>kehilangan</strong> fasilitas yang ada di dalam <strong>KIOS</strong> selama <strong>masa sewa</strong>. Jika terjadi <strong>kerusakan akibat kelalaian saya</strong>, saya akan <strong>mengganti kerugian</strong> sesuai dengan <strong>nilai kerusakan</strong> yang ditentukan oleh <strong>pihak pengelola kos</strong>.</li>
            <li style="margin:6px 0;text-align:justify;">Mematuhi peraturan <strong>HUKUM</strong> yang berlaku di <strong>Indonesia</strong> dan <strong>Menjaga norma kesopanan</strong> serta <strong>tidak menimbulkan kegaduhan bagi penghuni lain</strong>.</li>
            <li style="margin:6px 0;text-align:justify;">Keluar masuk <strong>gerbang utama wajib menutup dan mengunci Kembali</strong>, apabila diatas <strong>pukul 22.00 WIB</strong>, <strong>wajib mengembok gerbang utama!</strong>.</li>
        </ul>`,p=`
        <p style="text-align:justify;">Kios yang saya terima beserta semua fasilitas dalam kondisi baik, dan saya wajib <strong>MENJAGA</strong> dan <strong>MERAWAT</strong> fasilitas yang ada seperti:</p>
        <ol style="padding-left:24px;margin:4px 0;">${a}</ol>

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
        <p><strong>Pada tanggal:</strong> ${t(n.tanggal)}</p>
        <p style="margin-top:20px;"><strong>Yang Membuat Pernyataan,</strong></p>
        ${l(n)}`;return`${o}
    <div class="stmt" style="font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.6;font-size:14px;">
        ${c(1,f,u(n),`78%`,n.signatures?.paraf1,n.signatures?.paraf2)}
        ${c(2,p,void 0,`52%`,n.signatures?.paraf1,n.signatures?.paraf2)}
    </div>`},p=(e,t)=>e?f(t):d(t);export{r as a,e as i,i as n,a as r,p as t};