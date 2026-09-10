<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Http;
use App\Services\KtpFieldExtractor;

echo "==================================================\n";
echo "TEST 1 — BYPASS FRONTEND & DATABASE\n";
echo "==================================================\n";

if ($argc < 2) {
    die("Error: Harap sertakan path foto KTP asli.\nContoh: php test_pipeline.php public/test.jpg\n");
}

$imagePath = __DIR__ . '/' . $argv[1];
if (!file_exists($imagePath)) {
    // try absolute
    $imagePath = $argv[1];
    if (!file_exists($imagePath)) {
        die("File " . $argv[1] . " tidak ditemukan!\n");
    }
}

$info = getimagesize($imagePath);
echo "IMAGE INPUT:\n";
echo "Path: {$imagePath}\n";
echo "Width: {$info[0]}\n";
echo "Height: {$info[1]}\n\n";

echo "==================================================\n";
echo "TEST 2 — PASTIKAN CONTAINER YANG DIPAKAI\n";
echo "==================================================\n";

$host = env('OCR_SERVICE_HOST', 'menteng-kos-ocr');
$url = "http://{$host}:8000/ocr";
echo "OCR Provider: paddleocr\n";
echo "Container URL: {$url}\n\n";

try {
    $response = Http::timeout(60)->attach(
        'file', file_get_contents($imagePath), basename($imagePath)
    )->post($url);
    
    if (!$response->successful()) {
        die("PaddleOCR error: " . $response->body() . "\n");
    }
} catch (\Exception $e) {
    if (str_contains($e->getMessage(), 'Could not resolve host') || str_contains($e->getMessage(), 'Connection refused')) {
        echo "Fallback to localhost...\n";
        $url = "http://localhost:8000/ocr";
        try {
            $response = Http::timeout(60)->attach(
                'file', file_get_contents($imagePath), basename($imagePath)
            )->post($url);
        } catch (\Exception $e2) {
            die("Exception Fallback: " . $e2->getMessage() . "\n");
        }
    } else {
        die("Exception: " . $e->getMessage() . "\n");
    }
}

$json = $response->json();
$rawOcr = $json['data'] ?? [];

echo "==================================================\n";
echo "TEST 3 — SIMPAN HASIL OCR RAW\n";
echo "==================================================\n";
echo json_encode($json, JSON_PRETTY_PRINT) . "\n\n";

echo "==================================================\n";
echo "TEST 4 — BANDINKAN RAW OCR VS EXTRACTOR\n";
echo "==================================================\n";

$extractor = app(KtpFieldExtractor::class);
$extracted = $extractor->extract($rawOcr);

echo "EXTRACTED PROFILE:\n";
print_r($extracted['data']);

echo "\nCONFIDENCES:\n";
print_r($extracted['confidences']);

echo "\n==================================================\n";
echo "KESIMPULAN SEMENTARA:\n";
echo "==================================================\n";

$data = $extracted['data'];
if (empty($rawOcr)) {
    echo "-> ROOT CAUSE (A): PaddleOCR tidak menghasilkan text apapun. Cek container OCR.\n";
} else if ($data['nik'] === '' && $data['name'] === '') {
    echo "-> ROOT CAUSE (B): RAW OCR ada, tapi Extractor gagal. Bounding box meleset atau regex label tidak cocok.\n";
} else {
    echo "-> ROOT CAUSE (C): Backend Extractor BERHASIL. Jika di UI tidak muncul, berarti bug ada di State Frontend (Wizard.tsx).\n";
}
echo "\n";
