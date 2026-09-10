<?php

use App\Services\GoogleVisionKtpOcrService;
use Illuminate\Support\Facades\Http;

function ktpOcrFixturePath(): string
{
    return base_path('tests/fixtures/ktp.jpg');
}

function visionKtpText(): string
{
    return implode("\n", [
        'KOTA BEKASI',
        'NIK',
        '3201110203920001',
        'Nama',
        'BUDI SETIAWAN',
        'Tempat/Tgl Lahir',
        'JAKARTA, 02-03-1992',
        'Jenis Kelamin',
        'LAKI-LAKI',
        'Pekerjaan',
        'KARYAWAN',
        'Alamat',
        'JL BARU NO 9',
    ]);
}

test('Google Vision KTP OCR is unavailable when no API key is configured', function () {
    config(['services.vision.enabled' => true, 'services.vision.api_key' => null]);

    expect((new GoogleVisionKtpOcrService)->available())->toBeFalse();
});

test('Google Vision OCR sends DOCUMENT_TEXT_DETECTION and returns extracted text', function () {
    $service = new GoogleVisionKtpOcrService('test-api-key');

    Http::fake([
        'vision.googleapis.com/*' => Http::response(['responses' => [['fullTextAnnotation' => ['text' => visionKtpText()]]]]),
    ]);

    $text = $service->extractText(ktpOcrFixturePath());

    expect($text)->toContain('BUDI SETIAWAN');

    Http::assertSent(fn ($request) => $request->url() === 'https://vision.googleapis.com/v1/images:annotate'
        && $request->hasHeader('x-goog-api-key', 'test-api-key')
        && data_get($request->data(), 'requests.0.features.0.type') === 'DOCUMENT_TEXT_DETECTION');
});