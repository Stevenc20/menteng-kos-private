<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class KtpOcrService
{
    private KtpFieldExtractor $extractor;

    public function __construct(KtpFieldExtractor $extractor)
    {
        $this->extractor = $extractor;
    }

    public function extract(string $absolutePath): array
    {
        Log::info('KTP OCR started', ['path' => $absolutePath]);

        $result = [
            'raw'         => '',
            'name'        => '',
            'nik'         => '',
            'birth_place' => '',
            'birth_date'  => '',
            'gender'      => '',
            'job'         => '',
            'address'     => '',
            'rt_rw'       => '',
            'kelurahan_desa' => '',
            'kecamatan'   => '',
            'agama'       => '',
            'status_perkawinan' => '',
            'kewarganegaraan' => '',
        ];

        if (!file_exists($absolutePath)) {
            Log::error('KTP OCR failed: file not found');
            return array_merge($result, ['success' => false, 'fields_found' => []]);
        }

        $info = @getimagesize($absolutePath);
        if ($info) {
            Log::info('KTP OCR image', ['width' => $info[0], 'height' => $info[1]]);
        }
        Log::info('KTP OCR provider: paddleocr');

        $variants = [
            'original' => $absolutePath,
            'grayscale' => $this->createFilter($absolutePath, 'grayscale'),
            'contrast' => $this->createFilter($absolutePath, 'contrast'),
            'sharpen' => $this->createFilter($absolutePath, 'sharpen')
        ];

        $bestExtracted = null;
        $bestScore = -1;
        $bestRaw = '';

        foreach ($variants as $label => $path) {
            if (!$path) continue;
            
            Log::info("KTP OCR attempt variant: $label");
            $ocrData = $this->callPaddleOcr($path);
            
            if (!empty($ocrData)) {
                Log::info("KTP OCR RAW RESULT", $ocrData);
                Log::info("KTP OCR detected boxes for $label", ['jumlah' => count($ocrData)]);
                $extracted = $this->extractor->extract($ocrData);
                
                // Calculate score
                $data = $extracted['data'];
                $confidences = $extracted['confidences'];
                
                $score = 0;
                if ($data['nik'] !== '') $score += 50;
                if ($data['name'] !== '') $score += 20;
                if ($data['birth_date'] !== '') $score += 10;
                if ($data['address'] !== '') $score += 5;
                if ($data['rt_rw'] !== '') $score += 2;
                if ($data['village'] !== '') $score += 2;
                if ($data['district'] !== '') $score += 2;
                if ($data['religion'] !== '') $score += 2;
                if ($data['marital_status'] !== '') $score += 2;
                if ($data['occupation'] !== '') $score += 2;
                if ($data['nationality'] !== '') $score += 2;
                
                $avgConf = count($confidences) > 0 ? array_sum($confidences) / count($confidences) : 0;
                $score += $avgConf;
                
                Log::info("KTP OCR SCORE", [
                    'candidate' => $label,
                    'score' => $score,
                    'valid_fields' => count(array_filter($data, fn($v) => $v !== ''))
                ]);
                
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestExtracted = $extracted;
                    $bestRaw = implode("\n", array_column($ocrData, 'text'));
                }
            }
        }

        if (!$bestExtracted) {
            Log::warning('KTP OCR paddleocr returned empty for all variants.');
            return array_merge($result, ['success' => false, 'fields_found' => []]);
        }

        $data = $bestExtracted['data'];
        $confidences = $bestExtracted['confidences'];

        $result['name'] = $data['name'] ?? '';
        $result['nik'] = $data['nik'] ?? '';
        $result['birth_place'] = $data['birth_place'] ?? '';
        $result['birth_date'] = $data['birth_date'] ?? '';
        $result['gender'] = $data['gender'] ?? '';
        $result['job'] = $data['occupation'] ?? '';
        $result['address'] = $data['address'] ?? '';
        $result['rt_rw'] = $data['rt_rw'] ?? '';
        $result['kelurahan_desa'] = $data['village'] ?? '';
        $result['kecamatan'] = $data['district'] ?? '';
        $result['agama'] = $data['religion'] ?? '';
        $result['status_perkawinan'] = $data['marital_status'] ?? '';
        $result['kewarganegaraan'] = $data['nationality'] ?? '';
        $result['raw'] = $bestRaw;

        foreach ($confidences as $field => $conf) {
            Log::info('KTP OCR field', ['field' => $field, 'confidence' => $conf]);
        }
        
        $fieldsFound = count(array_filter($result, fn($v) => $v !== ''));

        if ($fieldsFound < 2 && $result['nik'] === '') {
            Log::warning('KTP OCR below confidence threshold; returning empty result');
            foreach (['name', 'nik', 'birth_place', 'birth_date', 'gender', 'job', 'address', 'rt_rw', 'kelurahan_desa', 'kecamatan', 'agama', 'status_perkawinan', 'kewarganegaraan'] as $f) {
                $result[$f] = '';
            }
            $fieldsFound = 0;
        }

        $result['fields_found'] = array_values(array_filter([
            'name', 'nik', 'birth_place', 'birth_date', 'gender', 'job', 'address',
            'rt_rw', 'kelurahan_desa', 'kecamatan', 'agama', 'status_perkawinan', 'kewarganegaraan',
        ], fn($f) => !empty($result[$f])));
        $result['success'] = $fieldsFound >= 2 || $result['nik'] !== '';

        Log::info('KTP OCR FINAL PROFILE', $result);
        return $result;
    }

    private function createFilter(string $path, string $type): ?string
    {
        if (!extension_loaded('gd')) return null;
        $src = @imagecreatefromstring(@file_get_contents($path));
        if (!$src) return null;
        
        if ($type === 'grayscale') {
            imagefilter($src, IMG_FILTER_GRAYSCALE);
        } elseif ($type === 'contrast') {
            imagefilter($src, IMG_FILTER_GRAYSCALE);
            imagefilter($src, IMG_FILTER_CONTRAST, -30);
        } elseif ($type === 'sharpen') {
            $matrix = [
                [-1, -1, -1],
                [-1, 16, -1],
                [-1, -1, -1]
            ];
            $divisor = array_sum(array_map('array_sum', $matrix));
            imageconvolution($src, $matrix, $divisor ?: 1, 0);
        }
        
        $tmp = tempnam(sys_get_temp_dir(), 'ktp_' . $type . '_') . '.png';
        imagepng($src, $tmp);
        imagedestroy($src);
        return $tmp;
    }

    private function callPaddleOcr(string $path): array
    {
        try {
            $host = env('OCR_SERVICE_HOST', 'menteng-kos-ocr');
            $url = "http://{$host}:8000/ocr";
            
            $response = Http::timeout(30)->attach(
                'file', file_get_contents($path), basename($path)
            )->post($url);

            if ($response->successful()) {
                return $response->json()['data'] ?? [];
            }
        } catch (\Exception $e) {
            Log::error('PaddleOCR request exception', ['msg' => $e->getMessage()]);
            if (str_contains($e->getMessage(), 'Could not resolve host') || str_contains($e->getMessage(), 'Connection refused')) {
                try {
                    $response = Http::timeout(30)->attach(
                        'file', file_get_contents($path), basename($path)
                    )->post('http://localhost:8000/ocr');
                    if ($response->successful()) {
                        return $response->json()['data'] ?? [];
                    }
                } catch (\Exception $e2) {}
            }
        }
        return [];
    }
}
