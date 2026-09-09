<?php

use App\Services\GoogleVisionKtpOcrService;
use App\Services\KtpOcrService;
use Illuminate\Support\Facades\Http;

function ktpOcrFixturePath(): string
{
    return base_path('tests/fixtures/ktp.jpg');
}

test('Tesseract reads a realistic KTP image end-to-end (no mocks)', function () {
    $fixture = base_path('tests/fixtures/ktp_realistic.jpg');
    if (!file_exists($fixture)) {
        $this->markTestSkipped('realistic KTP fixture not present');
    }

    $svc = app(KtpOcrService::class);
    if (!$svc->tesseractAvailable()) {
        $this->markTestSkipped('tesseract not available on this machine');
    }

    $result = $svc->extract($fixture);

    expect($result['nik'])->toBe('3201110203920001');
    expect($result['name'])->toBe('BUDI SETIAWAN');
    expect($result['birth_place'])->toBe('BEKASI');
    expect($result['birth_date'])->toBe('1992-03-02');
    expect($result['gender'])->toBe('LAKI-LAKI');
    expect($result['job'])->toBe('KARYAWAN');
    expect($result['address'])->toContain('JL. BERKAH NO 9');
});

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

test('KtpOcrService prefers Google Vision only when explicitly enabled with a key', function () {
    config(['services.vision.enabled' => true, 'services.vision.api_key' => 'test-api-key']);

    Http::fake([
        'vision.googleapis.com/*' => Http::response(['responses' => [['fullTextAnnotation' => ['text' => visionKtpText()]]]]),
    ]);

    $result = app(KtpOcrService::class)->extract(ktpOcrFixturePath());

    expect($result['name'])->toBe('BUDI SETIAWAN');
    expect($result['nik'])->toBe('3201110203920001');
    expect($result['birth_place'])->toBe('JAKARTA');
    expect($result['birth_date'])->toBe('1992-03-02');
    expect($result['gender'])->toBe('LAKI-LAKI');
    expect($result['job'])->toBe('KARYAWAN');
    expect($result['address'])->toBe('JL BARU NO 9');

    Http::assertSent(fn ($request) => str_contains($request->url(), 'vision.googleapis.com'));
});

test('KtpOcrService uses Tesseract by default even with an API key present', function () {
    // enabled = false (default) → Vision TIDAK boleh dipanggil.
    config(['services.vision.enabled' => false, 'services.vision.api_key' => 'test-api-key']);

    Http::fake([
        'vision.googleapis.com/*' => Http::response(['responses' => [['fullTextAnnotation' => ['text' => visionKtpText()]]]]),
    ]);

    $fixture = base_path('tests/fixtures/ktp_realistic.jpg');
    try {
        if (!app(KtpOcrService::class)->tesseractAvailable()) {
            throw new \RuntimeException('Tesseract not available');
        }
        $result = app(KtpOcrService::class)->extract($fixture);
        expect(is_array($result))->toBeTrue();
    } catch (RuntimeException $e) {
        expect($e->getMessage())->toContain('Tesseract');
    }

    Http::assertNotSent(fn ($request) => str_contains($request->url(), 'vision.googleapis.com'));
});

test('KtpOcrService falls back to Tesseract when Google Vision fails', function () {
    config(['services.vision.enabled' => true, 'services.vision.api_key' => 'test-api-key']);

    Http::fake([
        'vision.googleapis.com/*' => Http::response(['error' => ['message' => 'API key invalid']], 400),
    ]);

    try {
        $result = app(KtpOcrService::class)->extract(ktpOcrFixturePath());
        // Tesseract tersedia di mesin ini → hasil tetap array.
        expect(is_array($result))->toBeTrue();
    } catch (RuntimeException $e) {
        // Tanpa tesseract, fallback tetap berjalan menuju jalur tesseract.
        expect($e->getMessage())->toContain('Tesseract');
    }

    Http::assertSent(fn ($request) => str_contains($request->url(), 'vision.googleapis.com'));
});