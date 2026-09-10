<?php

use App\Services\KtpCardDetector;

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

    // Warp otomatis menyesuaikan resolusi (≥1400–2200 px) supaya teks kecil terbaca.
    expect($size[0])->toBeGreaterThanOrEqual(1400);
    expect($size[0])->toBeLessThanOrEqual(2200);
    expect(abs($size[1] - round($size[0] / KtpCardDetector::CARD_ASPECT)))->toBeLessThanOrEqual(2);

    @unlink($crop);
});