<?php

use App\Services\KtpOcrService;

it('extracts NIK from raw OCR text with 16 digits', function () {
    $service = new KtpOcrService();

    $raw = "Prov. DKI JAKARTA\n"
         . "Kota adm. JAKARTA SELATAN\n"
         . "Kec. Cilandak\n"
         . "Kel. Cilandak Timur\n"
         . "3275011503020001\n"
         . "Nama\n"
         . "STEVEN CHRISTIAN\n"
         . "Tempat/Tgl Lahir\n"
         . "BEKASI, 15-03-2002\n"
         . "Jenis Kelamin\n"
         . "LAKI-LAKI\n"
         . "Alamat\n"
         . "Jl. Test No. 123\n"
         . "RT 01/RW 02";

    // Use reflection to call parse directly
    $ref = new ReflectionClass($service);
    $parseMethod = $ref->getMethod('parse');
    $parseMethod->setAccessible(true);

    $result = $parseMethod->invoke($service, $raw);

    expect($result['nik'])->toBe('3275011503020001');
    expect($result['name'])->toBe('STEVEN CHRISTIAN');
    expect($result['birth_place'])->toBe('BEKASI');
    expect($result['birth_date'])->toBe('2002-03-15');
    expect($result['gender'])->toBe('LAKI-LAKI');
    expect($result['address'])->toContain('Jl. Test No. 123');
});

it('extracts name when label is on separate line', function () {
    $service = new KtpOcrService();
    $ref = new ReflectionClass($service);
    $parseMethod = $ref->getMethod('parse');
    $parseMethod->setAccessible(true);

    $raw = "Nama\nSITI NURHALIZA\nTempat/Tgl Lahir\nJAKARTA, 01-01-1990";

    $result = $parseMethod->invoke($service, $raw);

    expect($result['name'])->toBe('SITI NURHALIZA');
    expect($result['birth_place'])->toBe('JAKARTA');
    expect($result['birth_date'])->toBe('1990-01-01');
});

it('extracts gender as PEREMPUAN', function () {
    $service = new KtpOcrService();
    $ref = new ReflectionClass($service);
    $parseMethod = $ref->getMethod('parse');
    $parseMethod->setAccessible(true);

    $raw = "Jenis Kelamin\nPEREMPUAN\nAlamat\nJl. Mawar No. 5";

    $result = $parseMethod->invoke($service, $raw);

    expect($result['gender'])->toBe('PEREMPUAN');
});

it('handles missing fields gracefully', function () {
    $service = new KtpOcrService();
    $ref = new ReflectionClass($service);
    $parseMethod = $ref->getMethod('parse');
    $parseMethod->setAccessible(true);

    $raw = "Some random text\nwithout KTP structure";

    $result = $parseMethod->invoke($service, $raw);

    expect($result['nik'])->toBe('');
    expect($result['name'])->toBe('');
    expect($result['birth_place'])->toBe('');
    expect($result['birth_date'])->toBe('');
    expect($result['address'])->toBe('');
    expect($result['raw'])->toBe($raw);
});

it('cleans NIK from extra characters', function () {
    $service = new KtpOcrService();
    $ref = new ReflectionClass($service);
    $parseMethod = $ref->getMethod('parse');
    $parseMethod->setAccessible(true);

    $raw = "NIK: 3275 0115 0302 0001\nNama\nTEST USER";

    $result = $parseMethod->invoke($service, $raw);

    expect($result['nik'])->toBe('3275011503020001');
});
