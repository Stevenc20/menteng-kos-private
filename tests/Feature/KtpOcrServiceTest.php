<?php

use App\Services\KtpOcrService;

function parseKtp(string $raw): array
{
    $service = new KtpOcrService();
    $ref = new ReflectionClass($service);
    $method = $ref->getMethod('parse');
    $method->setAccessible(true);
    return $method->invoke($service, $raw);
}

it('extracts NIK, name, birth data, gender and address from realistic KTP OCR', function () {
    $raw = "REPUBLIK INDONESIA\n"
         . "NIK\n"
         . "3275011503020001\n"
         . "Nama\n"
         . "STEVEN CHRISTIAN\n"
         . "Tempat/Tgl Lahir\n"
         . "BEKASI, 15-03-2002\n"
         . "Jenis Kelamin\n"
         . "LAKI-LAKI\n"
         . "Alamat\n"
         . "JL. H. MOKEN NO. 19 RT 01 RW 02\n"
         . "KEL. GANDARIA, KEC. JAGAKARSA\n"
         . "KOTA ADMINISTRASI JAKARTA SELATAN";

    $result = parseKtp($raw);

    expect($result['nik'])->toBe('3275011503020001');
    expect($result['name'])->toBe('STEVEN CHRISTIAN');
    expect($result['birth_place'])->toBe('BEKASI');
    expect($result['birth_date'])->toBe('2002-03-15');
    expect($result['gender'])->toBe('LAKI-LAKI');
    expect($result['address'])->toContain('JL. H. MOKEN NO. 19 RT 01 RW 02');
    expect($result['address'])->toContain('JAKARTA SELATAN');
});

it('handles inline label with colon for all fields', function () {
    $raw = "NIK : 3275011503020001\n"
         . "Nama : STEVEN CHRISTIAN\n"
         . "Tempat/Tgl Lahir : BEKASI, 07-03-2002\n"
         . "Jenis Kelamin : LAKI-LAKI\n"
         . "Alamat : Jl. Test No. 1 RT 002 RW 003";

    $result = parseKtp($raw);

    expect($result['nik'])->toBe('3275011503020001');
    expect($result['name'])->toBe('STEVEN CHRISTIAN');
    expect($result['birth_place'])->toBe('BEKASI');
    expect($result['birth_date'])->toBe('2002-03-07');
    expect($result['address'])->toBe('Jl. Test No. 1 RT 002 RW 003');
});

it('extracts gender as PEREMPUAN', function () {
    $result = parseKtp("Jenis Kelamin\nPEREMPUAN\nAlamat\nJl. Mawar No. 5");

    expect($result['gender'])->toBe('PEREMPUAN');
    expect($result['address'])->toBe('Jl. Mawar No. 5');
});

it('handles missing fields gracefully', function () {
    $raw = "Some random text\nwithout KTP structure";

    $result = parseKtp($raw);

    expect($result['nik'])->toBe('');
    expect($result['name'])->toBe('');
    expect($result['birth_place'])->toBe('');
    expect($result['birth_date'])->toBe('');
    expect($result['address'])->toBe('');
    expect($result['raw'])->toBe($raw);
});

it('cleans NIK from extra characters', function () {
    $result = parseKtp("NIK: 3275 0115 0302 0001\nNama\nTEST USER");

    expect($result['nik'])->toBe('3275011503020001');
    expect($result['name'])->toBe('TEST USER');
});

it('ignores tesseract chatter lines and strips name punctuation', function () {
    $raw = "Estimating resolution as 539\n"
         . "Nama\n"
         . "— NADHIRA RAYHANA AZKAPRIMA\n"
         . "Tempat/Tgl Lahir\n"
         . "BEKASI, 07-03-2002\n"
         . "Warning: Invalid resolution";

    $result = parseKtp($raw);

    expect($result['name'])->toBe('NADHIRA RAYHANA AZKAPRIMA');
    expect($result['birth_place'])->toBe('BEKASI');
    expect($result['birth_date'])->toBe('2002-03-07');
});

it('tolerates a mangled Alamat label from OCR', function () {
    $result = parseKtp("Alai: - JL KE\nRn HRW - $64/303\nKel/Desa- > KEBON PEDES");

    expect($result['address'])->toBe('JL KE');
});

it('recovers NIK when OCR misreads digits as letters', function () {
    $result = parseKtp("NIK : 3275OII5O3O2OOO1\nNama\nTEST USER");

    expect($result['nik'])->toBe('3275011503020001');
});
