var e=e=>new Intl.NumberFormat(`id-ID`,{style:`currency`,currency:`IDR`,maximumFractionDigits:0}).format(Number(e)||0),t=e=>(e||``).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e]),n=[`Januari`,`Februari`,`Maret`,`April`,`Mei`,`Juni`,`Juli`,`Agustus`,`September`,`Oktober`,`November`,`Desember`],r=()=>{let e=new Date;return`${String(e.getDate()).padStart(2,`0`)} ${n[e.getMonth()]} ${e.getFullYear()}`},i=e=>{if(!e)return``;let[t,n,r]=e.split(`-`).map(Number);return!t||!n||!r?``:String(r>1?r-1:new Date(t,n-1,0).getDate())},a=e=>{let t=parseInt(e,10);if(!isFinite(t))return``;let n=t-4;return String(n>=1?n:1)},o=(e,t,n,r=`ACTUAL`,i)=>{let a=Number(e)||0;if(a<=0||!t||!n)return{ready:!1,reason:n?`Data tanggal masuk atau tarif sewa belum lengkap.`:`Tanggal akhir periode pembayaran awal belum dikonfirmasi admin.`,moveInDate:t||``,monthlyRent:a,initialPaidUntil:n||``,prorataStartDate:``,prorataEndDate:``,prorataDays:0,basisMode:r,basisDays:30,dailyRate:0,prorataAmount:0,normalPeriodStartDate:``,segments:[]};let o=e=>{let[t,n,r]=e.split(`-`).map(Number);return new Date(Date.UTC(t,n-1,r))},s=e=>e.toISOString().slice(0,10),c=(e,t)=>new Date(Date.UTC(e,t+1,0)).getUTCDate(),l=o(t),u=o(n),d=u.getTime()>l.getTime()?new Date(u.getTime()):new Date(l.getTime()),f;if(f=i?o(i):d.getUTCDate()===1?new Date(d.getTime()):new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)),f.getTime()<=d.getTime()){let e=r===`30_DAYS`?30:c(d.getUTCFullYear(),d.getUTCMonth()),i=d.getUTCDate()===1?s(d):s(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)));return{ready:!0,reason:null,moveInDate:t,monthlyRent:a,initialPaidUntil:n,prorataStartDate:s(d),prorataEndDate:s(d),prorataDays:0,basisMode:r,basisDays:e,dailyRate:Math.round(a/e*100)/100,prorataAmount:0,normalPeriodStartDate:i,segments:[]}}let p=[],m=new Date(d.getTime()),h=0,g=0;for(;m.getTime()<f.getTime();){let e=new Date(Date.UTC(m.getUTCFullYear(),m.getUTCMonth()+1,1)),t=e.getTime()<f.getTime()?e:new Date(f.getTime()),n=Math.round((t.getTime()-m.getTime())/864e5),i=r===`30_DAYS`?30:c(m.getUTCFullYear(),m.getUTCMonth()),o=a/i,l=o*n;p.push({month:s(m).slice(0,7),startDate:s(m),endDate:s(t),days:n,basisDays:i,dailyRate:Math.round(o*100)/100,subtotal:Math.round(l)}),h+=n,g+=l,m=t}let _=p.length===1?p[0].basisDays:r===`30_DAYS`?30:c(d.getUTCFullYear(),d.getUTCMonth()),v=p.length===1?Math.round(a/_*100)/100:h>0?Math.round(g/h*100)/100:0;return{ready:!0,reason:null,moveInDate:t,monthlyRent:a,initialPaidUntil:n,prorataStartDate:s(d),prorataEndDate:s(f),prorataDays:h,basisMode:r,basisDays:_,dailyRate:v,prorataAmount:Math.round(g),normalPeriodStartDate:s(f),segments:p}},s=e=>{let n=e.prorataInfo;if(!n||!n.initialPaidUntil&&(n.prorataDays===void 0||n.prorataDays===null))return``;let r=e.dueDay===`0`?`akhir bulan`:`tanggal ${t(e.dueDay||`1`)} setiap bulan`,i=[`<li>Harga sewa bulanan: <strong>Rp ${t(e.sewaNumeral)} / bulan</strong></li>`,`<li>Tanggal masuk: <strong>${t(n.moveInDate||`-`)}</strong> · Periode pembayaran awal dibayar s/d: <strong>${t(n.initialPaidUntil||`-`)}</strong></li>`];if((n.prorataDays||0)>0&&(n.prorataAmount||0)>0){let e=new Intl.NumberFormat(`id-ID`,{maximumFractionDigits:0}).format(Number(n.dailyRate)||0),r=new Intl.NumberFormat(`id-ID`,{maximumFractionDigits:0}).format(Number(n.prorataAmount)||0);i.push(`<li>Ketentuan biaya prorata (penyesuaian jatuh tempo): periode <strong>${t(n.prorataStartDate)} s/d ${t(n.prorataEndDate)}</strong> (<strong>${n.prorataDays} hari</strong> × tarif harian <strong>Rp ${e}</strong>) = <strong>Rp ${r}</strong></li>`)}else i.push(`<li>Ketentuan biaya prorata: <strong>Tidak ada biaya prorata tambahan (Rp 0)</strong></li>`);return n.normalPeriodStartDate&&i.push(`<li>Periode sewa bulanan normal dimulai: <strong>${t(n.normalPeriodStartDate)}</strong></li>`),i.push(`<li>Tanggal jatuh tempo sewa bulanan: <strong>${r}</strong></li>`),`<div data-payment-terms-block="1" style="border:1px solid #d4d4d0;background:#fafaf8;padding:8px 12px;margin:8px 0;font-size:12px;line-height:1.5;"><div style="font-weight:bold;margin-bottom:4px;">Rincian Ketentuan Pembayaran Awal &amp; Penyesuaian Jatuh Tempo:</div><ul style="padding-left:18px;margin:0;">${i.join(``)}</ul></div>`},c=`
<style>
    .stmt { overflow-wrap: anywhere; }
    @media (max-width: 640px) {
        .stmt { font-size: 11px !important; line-height: 1.45 !important; }
        .stmt h2 { font-size: 13px !important; letter-spacing: 0 !important; margin: 10px 0 12px !important; }
        .stmt td { padding: 1px 0 !important; }
        .stmt ol, .stmt ul { padding-left: 16px !important; }
    }
</style>`,l=e=>`
    <table style="width:100%;border-collapse:collapse;">
        <tbody>
            ${e.map(([e,n])=>`
                <tr>
                    <td style="width:130px;vertical-align:top;padding:2px 0;white-space:nowrap;">${e}</td>
                    <td style="padding:2px 0;">: ${t(n)}</td>
                </tr>`).join(``)}
        </tbody>
    </table>`,u=(e,t,n,r,i,a)=>`
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
    </div>`,d=e=>`
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
    </div>`,f=e=>{let n=Number(e.waterAllowance??5)||5;return`
    <div style="border:1.5px solid #666;padding:5px 12px;text-align:center;font-size:11px;">
        <div style="font-weight:bold;white-space:nowrap;">START METERAN:</div>
        <div style="font-style:italic;font-size:9px;color:#666;white-space:nowrap;">WAJIB DIISI</div>
        <div data-meteran-value="1" style="margin-top:2px;letter-spacing:2px;font-weight:bold;font-size:12px;white-space:nowrap;min-height:14px;">
            ${e.kioskSeparateWater?`${e.meteran?`${t(e.meteran)}m³`:`..................`}<br style="letter-spacing:0;font-weight:normal;" /><span style="letter-spacing:0;font-weight:normal;">Pemakaian diakumulasi s/d tiap tanggal jatuh tempo</span>`:`${e.meteran?`${t(e.meteran)}m³ - ${Number(e.meteran)+n}m³`:`..................`}`}
        </div>
        ${e.notes?`<div data-meteran-notes="1" style="margin-top:3px;font-style:italic;font-size:9px;color:#555;text-align:left;white-space:normal;">${t(e.notes)}</div>`:``}
    </div>`},p=n=>{let r=Math.max(6,n.facilities.length),i=Array.from({length:r},(e,r)=>{let i=n.facilities[r]?.trim();return r===5&&!i?`<li style="margin:3px 0;"><span style="text-decoration:underline;display:inline-block;min-width:55%;">____________</span> <em style="font-size:11px;color:#555;">!note: jika ada ac wajib mencuci ac 2 bulan sekali.</em></li>`:i?`<li style="margin:3px 0;">${t(i)}</li>`:`<li style="margin:3px 0;"><span style="text-decoration:underline;display:inline-block;min-width:55%;">____________</span></li>`}).join(``),a=`
        <h2 style="text-align:center;letter-spacing:1px;margin:14px 0 18px;font-size:17px;">SURAT PERNYATAAN</h2>
        <p>Yang bertanda tangan di bawah ini:</p>
        ${l([[`Nama (1)`,n.occ1.name],[`Tempat, Tgl Lahir`,n.occ1.birth],[`Pekerjaan`,n.occ1.job],[`Alamat`,n.occ1.address],[`Nomor KTP`,n.occ1.nik]])}
        ${n.hasSecond?`
            <p style="margin:10px 0 2px;">Dan pasangan saya,</p>
            ${l([[`Nama (2)`,n.occ2.name],[`Tempat, Tgl Lahir`,n.occ2.birth],[`Pekerjaan`,n.occ2.job],[`Alamat`,n.occ2.address],[`Nomor KTP`,n.occ2.nik]])}
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
        <p style="text-align:justify;">Menjaga keamanan dan kenyaman Bersama, seperti:</p>`,o=Number(n.waterAllowance??5)||5,p=`
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
            <li style="margin:6px 0;text-align:justify;">Setiap kamar akan dikenakan biaya perbulan sebesar <strong>Rp 100.000</strong> (seratus ribu rupiah) untuk <strong>iuran sampah</strong> dan <strong>air</strong> sebanyak <strong>${o}m³ per kamar</strong> dihitung berdasarkan angka meteran yang terpasang dimasing-masing kamar.</li>
            <li style="margin:6px 0;text-align:justify;">Biaya tambahan air <strong>PDAM</strong> sebesar <strong>Rp14.000/m³</strong> untuk pemakaian lebih dari <strong>${o}m³</strong>, dihitung sesuai angka meteran permasing-masing kamar bersamaan tanggal pembayaran kos.</li>
            <li style="margin:6px 0;text-align:justify;"><strong>Pembacaan meteran air</strong> akan dilakukan <strong>setiap tanggal</strong> pembayaran kos untuk masing-masing kamar.</li>
        </ol>
        ${s(n)}
        <p style="font-weight:bold;">5. Keterlambatan Pembayaran</p>
        <p style="text-align:justify;">
            saya menyatakan bahwa membayar biaya sewa kos sebesar <strong>Rp ${t(n.sewaNumeral)}</strong> per bulan.
            Pembayaran dilakukan setiap bulan, 1 hari sebelum tanggal jatuh tempo, tanggal <strong>${t(n.dueDay)}</strong> setiap bulannya.
        </p>
        <p style="text-align:justify;">
            Jika saya terlambat melakukan pembayaran setelah tanggal jatuh tempo, saya akan dikenakan denda sebesar <strong>${t(e(n.dendaPerDay))}</strong> per hari keterlambatan sesuai dengan ketentuan yang berlaku. Maksimal denda keterlambatan <strong>2 hari, diatas 2 hari wajib mengosongkan kosan</strong>.
        </p>
        <p style="text-align:justify;">Jika saya berniat untuk mengakhiri masa sewa sebelum waktu yang disepakati, saya akan memberikan pemberitahuan kepada pihak <strong>PENGELOLA KOS</strong> 5 hari</p>`,m=`
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
        ${d(n)}`;return`${c}
    <div class="stmt" style="font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.6;font-size:14px;">
        ${u(1,a,f(n),`63%`,n.signatures?.paraf1,n.signatures?.paraf2)}
        ${u(2,p,void 0,`35%`,n.signatures?.paraf1,n.signatures?.paraf2)}
        ${u(3,m)}
    </div>`},m=n=>{let r=Math.max(8,n.facilities.length),i=new Intl.NumberFormat(`id-ID`,{maximumFractionDigits:0}).format(Number(n.dendaPerDay)||0),a=Array.from({length:r},(e,r)=>{let i=n.facilities[r]?.trim();return i?`<li style="margin:3px 0;">${t(i)}</li>`:`<li style="margin:3px 0;"><span style="text-decoration:underline;display:inline-block;min-width:55%;">____________</span></li>`}).join(``),o=n.hasSecond?`<p style="margin:10px 0 2px;">Dan pasangan saya,</p>
           ${l([[`Nama (2)`,n.occ2.name],[`Tempat, Tgl Lahir`,n.occ2.birth],[`Pekerjaan`,n.occ2.job],[`Alamat`,n.occ2.address],[`Nomor KTP`,n.occ2.nik]])}`:``,p=`
        <h2 style="text-align:center;letter-spacing:1px;margin:14px 0 6px;font-size:17px;">SURAT PERNYATAAN</h2>
        <h2 style="text-align:center;margin:0 0 18px;font-size:15px;">KIOS</h2>
        <p>Yang bertanda tangan dibawah ini,</p>
        ${l([[`Nama`,n.occ1.name],[`Tempat, Tanggal Lahir`,n.occ1.birth],[`Pekerjaan`,n.occ1.job],[`Alamat`,n.occ1.address],[`Nomor KTP`,n.occ1.nik]])}
        ${o}
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
        ${s(n)}

        <p style="font-weight:bold;">3. Kepatuhan Terhadap Pembayaran</p>
        <p style="text-align:justify;">Saya menyadari apabila saya terlambat melakukan pembayaran setelah tanggal jatuh tempo, saya akan dikenakan denda sebesar <strong>Rp ${t(i)}</strong> per hari keterlambatan sesuai dengan ketentuan yang berlaku. Maksimal denda keterlambatan <strong>2 hari, diatas 2 hari wajib mengosongkan kios</strong>.</p>

        <p style="font-weight:bold;">4. Kepatuhan Terhadap Peraturan Kios</p>
        <p style="text-align:justify;">Saya menyadari untuk mematuhi segala peraturan kios baik yang tertulis maupun tidak tertulis, seperti:</p>
        <ul style="padding-left:24px;margin:4px 0;">
            <li style="margin:6px 0;text-align:justify;">Saat pertama kali menempati kios wajib menyerahkan <strong>KTP dan KK</strong>, 1x24 jam wajib lapor <strong>RT</strong>.</li>
            <li style="margin:6px 0;text-align:justify;">Saya bertanggung jawab penuh atas <strong>kerusakan</strong> atau <strong>kehilangan</strong> fasilitas yang ada di dalam <strong>KIOS</strong> selama <strong>masa sewa</strong>. Jika terjadi <strong>kerusakan akibat kelalaian saya</strong>, saya akan <strong>mengganti kerugian</strong> sesuai dengan <strong>nilai kerusakan</strong> yang ditentukan oleh <strong>pihak pengelola kos</strong>.</li>
            <li style="margin:6px 0;text-align:justify;">Mematuhi peraturan <strong>HUKUM</strong> yang berlaku di <strong>Indonesia</strong> dan <strong>Menjaga norma kesopanan</strong> serta <strong>tidak menimbulkan kegaduhan bagi penghuni lain</strong>.</li>
            <li style="margin:6px 0;text-align:justify;">Keluar masuk <strong>gerbang utama wajib menutup dan mengunci Kembali</strong>, apabila diatas <strong>pukul 22.00 WIB</strong>, <strong>wajib mengembok gerbang utama!</strong>.</li>
        </ul>`,m=`
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
        ${d(n)}`;return`${c}
    <div class="stmt" style="font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.6;font-size:14px;">
        ${u(1,p,f(n),`78%`,n.signatures?.paraf1,n.signatures?.paraf2)}
        ${u(2,m,void 0,`52%`,n.signatures?.paraf1,n.signatures?.paraf2)}
    </div>`},h=(e,t)=>e?m(t):p(t);export{e as a,o as i,i as n,r as o,a as r,h as t};