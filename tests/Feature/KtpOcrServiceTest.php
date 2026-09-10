<?php

use App\Services\KtpOcrService;
use Illuminate\Support\Facades\Http;

/**
 * Helper membangun hasil OCR PaddleOCR (spatial): setiap box punya
 * 4 koordinat sudut, teks, dan confidence.
 */
function ktpBox(string $text, int $x, int $y, float $conf = 0.9): array
{
    $w = max(10, strlen($text) * 9);
    return [
        'box' => [[$x, $y], [$x + $w, $y], [$x + $w, $y + 12], [$x, $y + 12]],
        'text' => $text,
        'confidence' => $conf,
    ];
}

/**
 * Konversi daftar pasangan [label, value] menjadi box-box PaddleOCR.
 * Label di kiri, value di kanan satu baris (seperti layout KTP asli).
 */
function ktpBoxesFromPairs(array $pairs): array
{
    $boxes = [];
    $y = 20;
    foreach ($pairs as [$label, $value]) {
        $boxes[] = ktpBox($label, 0, $y);
        if ($value !== '') {
            $boxes[] = ktpBox($value, 300, $y, 0.95);
        }
        $y += 30;
    }
    return $boxes;
}

function realisticKtpBoxes(): array
{
    // Alamat ditaruh paling bawah agar collector multi-line tidak menelan label lain
    return ktpBoxesFromPairs([
        ['NIK', '3201110203920001'],
        ['Nama', 'BUDI SETIAWAN'],
        ['Tempat/Tgl Lahir', 'BEKASI, 02-03-1992'],
        ['Jenis Kelamin', 'LAKI-LAKI'],
        ['Pekerjaan', 'KARYAWAN'],
        ['Kewarganegaraan', 'WNI'],
        ['Alamat', 'JL. BERKAH NO 9'],
    ]);
}

function paddleExtract(array $boxes, ?callable $fixture = null): array
{
    Http::fake(['*' => Http::response(['data' => $boxes])]);
    $path = $fixture ? $fixture() : base_path('tests/fixtures/ktp_realistic.jpg');
    return app(KtpOcrService::class)->extract($path);
}

it('extracts fields from a paddle OCR response and returns a flat result', function () {
    $result = paddleExtract(realisticKtpBoxes());

    expect($result['success'])->toBeTrue();
    expect($result['fields_found'])->toContain('name', 'nik', 'job');
    expect($result['nik'])->toBe('3201110203920001');
    expect($result['name'])->toBe('BUDI SETIAWAN');
    expect($result['birth_place'])->toBe('BEKASI');
    expect($result['birth_date'])->toBe('1992-03-02');
    expect($result['gender'])->toBe('LAKI-LAKI');
    expect($result['job'])->toBe('KARYAWAN');
    expect($result['kewarganegaraan'])->toBe('WNI');
    expect($result['address'])->toBe('JL. BERKAH NO 9');
});

it('handles label dan value dalam satu box (inline colon) untuk semua field', function () {
    $boxes = ktpBoxesFromPairs([
        ['NIK : 3275011503020001', ''],
        ['Nama : STEVEN CHRISTIAN', ''],
        ['Tempat/Tgl Lahir : BEKASI, 07-03-2002', ''],
        ['Jenis Kelamin : LAKI-LAKI', ''],
        ['Pekerjaan : PELAJAR/MAHASISWA', ''],
        ['Alamat : Jl. Test No. 1 RT 002 RW 003', ''],
    ]);

    $result = paddleExtract($boxes);

    expect($result['nik'])->toBe('3275011503020001');
    expect($result['name'])->toBe('STEVEN CHRISTIAN');
    expect($result['birth_place'])->toBe('BEKASI');
    expect($result['birth_date'])->toBe('2002-03-07');
    expect($result['job'])->toBe('PELAJAR/MAHASISWA');
    expect($result['address'])->toBe('Jl. Test No. 1 RT 002 RW 003');
});

it('extracts gender sebagai PEREMPUAN', function () {
    $result = paddleExtract(ktpBoxesFromPairs([
        ['Jenis Kelamin', 'PEREMPUAN'],
        ['Alamat', 'Jl. Mawar No. 5'],
    ]));

    expect($result['gender'])->toBe('PEREMPUAN');
    expect($result['address'])->toBe('Jl. Mawar No. 5');
});

it('menangani field yang absen dengan aman', function () {
    $result = paddleExtract(ktpBoxesFromPairs([
        ['DELIMITER', 'some random'],
        ['other text', ''],
    ]));

    expect($result['nik'])->toBe('');
    expect($result['name'])->toBe('');
    expect($result['address'])->toBe('');
    expect($result['success'])->toBeFalse();
    expect($result['fields_found'])->toBe([]);
});

it('memulihkan NIK ketika OCR salah baca digit sebagai huruf', function () {
    $result = paddleExtract(ktpBoxesFromPairs([
        ['NIK', '3275OII5O3O2OOO1'],
        ['Nama', 'TEST USER'],
    ]));

    expect($result['nik'])->toBe('3275011503020001');
    expect($result['name'])->toBe('TEST USER');
});

it('membersihkan tanda baca di depan nama hasil OCR', function () {
    $result = paddleExtract(ktpBoxesFromPairs([
        ['Nama', '— NADHIRA RAYHANA AZKAPRIMA'],
        ['Tempat/Tgl Lahir', 'BEKASI, 07-03-2002'],
    ]));

    expect($result['name'])->toBe('NADHIRA RAYHANA AZKAPRIMA');
    expect($result['birth_place'])->toBe('BEKASI');
    expect($result['birth_date'])->toBe('2002-03-07');
});

it('memilih kandidat varian OCR terbaik (bukan noise)', function () {
    if (!extension_loaded('gd')) {
        $this->markTestSkipped('GD extension not available');
    }

    // Varian dijalankan berurutan: original, grayscale, contrast, sharpen
    Http::fakeSequence()
        ->push(['data' => [ktpBox('oe r . oF : i mae In | 4 ae', 0, 20)]])
        ->push(['data' => [ktpBox('oe r . oF : i mae In | 4 ae', 0, 20)]])
        ->push(['data' => [ktpBox('oe r . oF : i mae In | 4 ae', 0, 20)]])
        ->push(['data' => realisticKtpBoxes()]);

    $result = app(KtpOcrService::class)->extract(base_path('tests/fixtures/ktp_realistic.jpg'));

    expect($result['success'])->toBeTrue();
    expect($result['name'])->toBe('BUDI SETIAWAN');
    expect($result['nik'])->toBe('3201110203920001');
});

it('menangani file yang tidak ditemukan dengan aman', function () {
    $result = app(KtpOcrService::class)->extract('/no/such/ktp/file.jpg');

    expect($result['success'])->toBeFalse();
    expect($result['fields_found'])->toBe([]);
    expect($result['name'])->toBe('');
    expect($result['nik'])->toBe('');
});

it('tidak pernah memasukkan nilai TTL ke Nama (field kosong bila nilai tidak ditemukan)', function () {
    // box nilai GHAIDTSA hilang dari baris Nama; baris TTL ada di bawah
    $result = paddleExtract(ktpBoxesFromPairs([
        ['NIK', '3216066503050006'],
        ['Nama', ''],
        ['Tempat/Tgl Lahir', 'BEKASI, 25-03-2005'],
        ['Jenis Kelamin', 'PEREMPUAN'],
        ['Pekerjaan', 'PELAJAR/MAHASISWA'],
    ]));

    expect($result['name'])->toBe('');
    expect($result['birth_place'])->toBe('BEKASI');
    expect($result['birth_date'])->toBe('2005-03-25');
    expect($result['nik'])->toBe('3216066503050006');
});

it('menolak fragmen label (Tg/Tgl) dan memilih box nilai TTL yang benar', function () {
    $boxes = [
        ktpBox('Nama', 0, 20),
        ktpBox('GHAIDTSA ZANUBA', 300, 20, 0.95),
        ktpBox('Tempat/Tgl Lahir', 0, 50),
        ktpBox('Tg', 300, 50, 0.5),
        ktpBox('BEKASI, 25-03-2005', 450, 50, 0.9),
    ];

    $result = paddleExtract($boxes);

    expect($result['name'])->toBe('GHAIDTSA ZANUBA');
    expect($result['birth_place'])->toBe('BEKASI');
    expect($result['birth_date'])->toBe('2005-03-25');
});

it('menolak nilai berisi tanggal masuk ke Nama (contoh: BEKASI,25-03-2005)', function () {
    $boxes = [
        ktpBox('Nama', 0, 20),
        ktpBox('Tempat/Tgl Lahir', 0, 50),
        ktpBox('BEKASI,25-03-2005', 300, 50, 0.9),
    ];

    $result = paddleExtract($boxes);

    expect($result['name'])->toBe('');
    expect($result['birth_place'])->toBe('BEKASI');
    expect($result['birth_date'])->toBe('2005-03-25');
});

it('ekstraksi tiap KTP independen (tidak ada nilai silang antar tenant)', function () {
    if (!extension_loaded('gd')) {
        $this->markTestSkipped('GD extension not available');
    }

    $fA = ktpBoxesFromPairs([
        ['NIK', '3216066503050006'],
        ['Nama', 'GHAIDTSA ZANUBA'],
        ['Tempat/Tgl Lahir', 'BEKASI, 25-03-2005'],
        ['Alamat', 'KP. JALEN'],
    ]);
    $fB = ktpBoxesFromPairs([
        ['NIK', '3201110203920001'],
        ['Nama', 'BUDI SETIAWAN'],
        ['Tempat/Tgl Lahir', 'BANDUNG, 02-03-1992'],
        ['Alamat', 'JL. BERKAH NO 9'],
    ]);
    $fC = ktpBoxesFromPairs([
        ['NIK', '3275011503020001'],
        ['Nama', 'STEVEN CHRISTIAN'],
        ['Tempat/Tgl Lahir', 'JAKARTA, 07-03-2002'],
        ['Alamat', 'JL. TEST NO 1'],
    ]);

    Http::fakeSequence()
        ->push(['data' => $fA])->push(['data' => $fA])->push(['data' => $fA])->push(['data' => $fA])
        ->push(['data' => $fB])->push(['data' => $fB])->push(['data' => $fB])->push(['data' => $fB])
        ->push(['data' => $fC])->push(['data' => $fC])->push(['data' => $fC])->push(['data' => $fC]);

    $path = base_path('tests/fixtures/ktp_realistic.jpg');
    $svc = app(KtpOcrService::class);
    $a = $svc->extract($path);
    $b = $svc->extract($path);
    $c = $svc->extract($path);

    expect($a['name'])->toBe('GHAIDTSA ZANUBA');
    expect($b['name'])->toBe('BUDI SETIAWAN');
    expect($c['name'])->toBe('STEVEN CHRISTIAN');
    expect($a['birth_place'])->toBe('BEKASI');
    expect($b['birth_place'])->toBe('BANDUNG');
    expect($c['birth_place'])->toBe('JAKARTA');
    expect($a['address'])->not->toContain('BERKAH');
    expect($b['address'])->not->toContain('JALEN');
});

it('upload KTP baru menghasilkan profil baru (tidak mencampur field lama)', function () {
    if (!extension_loaded('gd')) {
        $this->markTestSkipped('GD extension not available');
    }

    $svc = app(KtpOcrService::class);
    $pathA = base_path('tests/fixtures/ktp_realistic.jpg');
    $pathB = base_path('tests/fixtures/ktp.jpg');

    $fA = ktpBoxesFromPairs([
        ['NIK', '3201110203920001'],
        ['Nama', 'BUDI SETIAWAN'],
        ['Tempat/Tgl Lahir', 'BEKASI, 02-03-1992'],
        ['Alamat', 'JL. BERKAH NO 9'],
    ]);
    $fB = ktpBoxesFromPairs([
        ['NIK', '3216066503050006'],
        ['Nama', 'GHAIDTSA ZANUBA'],
        ['Tempat/Tgl Lahir', 'BEKASI, 25-03-2005'],
        ['Alamat', 'KP. JALEN'],
    ]);

    Http::fakeSequence()
        ->push(['data' => $fA])->push(['data' => $fA])->push(['data' => $fA])->push(['data' => $fA])
        ->push(['data' => $fB])->push(['data' => $fB])->push(['data' => $fB])->push(['data' => $fB]);

    $rA = $svc->extract($pathA);
    $rB = $svc->extract($pathB);

    expect($rA['name'])->toBe('BUDI SETIAWAN');
    expect($rB['name'])->toBe('GHAIDTSA ZANUBA');
    expect($rB['nik'])->toBe('3216066503050006');
    expect($rB['birth_date'])->toBe('2005-03-25');
    expect($rB['address'])->toBe('KP. JALEN');
});