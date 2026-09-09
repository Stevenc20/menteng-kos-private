<?php

use App\Services\KtpCardDetector;
use App\Services\KtpOcrService;

/**
 * Regression fixture: KTP dipegang tangan, miring 7°, background lantai,
 * kartu tidak memenuhi frame — meniru foto kamera HP production.
 */
function handPhoneFixturePath(): string
{
    return base_path('tests/fixtures/ktp_hand_phone.jpg');
}

function skipUnlessPipelineRunable(): void
{
    if (!extension_loaded('gd')) {
        test()->markTestSkipped('GD extension not available');
    }
    if (!file_exists(handPhoneFixturePath())) {
        test()->markTestSkipped('ktp_hand_phone.jpg fixture not present');
    }
}

test('card detector finds the KTP among background and hand', function () {
    skipUnlessPipelineRunable();

    $detector = new KtpCardDetector();
    $result = $detector->detect(handPhoneFixturePath());

    expect($result)->not->toBeNull();

    $aspect = $result['bbox'][2] / $result['bbox'][3];
    expect($aspect)->toBeGreaterThan(1.2);
    expect($aspect)->toBeLessThan(2.0);

    // Kartu tidak boleh dianggap memenuhi seluruh frame.
    expect($result['bbox'][2] / 1280)->toBeLessThan(0.85);
});

test('card detector returns null when no card is present', function () {
    if (!extension_loaded('gd')) {
        $this->markTestSkipped('GD extension not available');
    }

    $img = imagecreatetruecolor(800, 1000);
    for ($y = 0; $y < 1000; $y++) {
        $shade = 40 + (int) ((120 - 40) * ($y / 1000));
        $color = ($shade << 16) | ($shade << 8) | $shade;
        imageline($img, 0, $y, 799, $y, $color);
    }

    // Blob terang namun TIDAK berbentuk kartu (batang tegak tipis):
    // rasio 0.25 harus ditolak oleh filter aspect detector.
    imagefilledrectangle($img, 300, 0, 380, 400, 0xF0F0F0);

    $tmp = tempnam(sys_get_temp_dir(), 'ktp_none_') . '.png';
    imagepng($img, $tmp);
    imagedestroy($img);

    $result = (new KtpCardDetector)->detect($tmp);
    @unlink($tmp);

    expect($result)->toBeNull();
});

test('warp straightens the detected card to card aspect', function () {
    skipUnlessPipelineRunable();

    $detector = new KtpCardDetector();
    $result = $detector->detect(handPhoneFixturePath());

    $crop = $detector->warp(handPhoneFixturePath(), $result['corners']);
    expect($crop)->not->toBeNull();

    $size = getimagesize($crop);
    expect($size[0])->toBe(1200);
    expect($size[1])->toBe(756);

    @unlink($crop);
});

test('scoring prefers structural KTP data over high word counts', function () {
    $svc = app(KtpOcrService::class);

    $noise = str_repeat('oe r . oF : i mae In | 4 ae ', 30); // ~360 kata, 0 struktur
    $structured = "NIK\n3201110203920001\nNama\nBUDI SETIAWAN\nTempat/Tgl Lahir\nBEKASI, 02-03-1992\n";

    $noiseScore = $svc->scoreText($noise);
    $structuredScore = $svc->scoreText($structured);

    expect($structuredScore)->toBeGreaterThan($noiseScore);
});

test('end-to-end: phone photo with background+hand is detected, cropped and OCR read', function () {
    skipUnlessPipelineRunable();

    if (!app(KtpOcrService::class)->tesseractAvailable()) {
        $this->markTestSkipped('tesseract not available on this machine');
    }

    $result = app(KtpOcrService::class)->extract(handPhoneFixturePath());

    expect($result['nik'])->toBe('3201110203920001');
    expect($result['name'])->toBe('BUDI SETIAWAN');
    expect($result['birth_place'])->toBe('BEKASI');
    expect($result['birth_date'])->toBe('1992-03-02');
    expect($result['gender'])->toBe('LAKI-LAKI');
    expect($result['job'])->toBe('KARYAWAN');
});