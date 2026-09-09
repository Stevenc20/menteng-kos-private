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
            return ['data' => $result];
        }

        $info = @getimagesize($absolutePath);
        if ($info) {
            Log::info('KTP OCR image', ['width' => $info[0], 'height' => $info[1]]);
        }
        Log::info('KTP OCR provider: paddleocr');

        $variants = [
            'original' => $absolutePath,
            'grayscale' => $this->createGrayscale($absolutePath)
        ];

        $bestExtracted = null;
        $bestScore = -1;

        foreach ($variants as $label => $path) {
            if (!$path) continue;
            
            Log::info("KTP OCR attempt variant: $label");
            $ocrData = $this->callPaddleOcr($path);
            
            if (!empty($ocrData)) {
                Log::info("KTP OCR detected boxes for $label", ['jumlah' => count($ocrData)]);
                $extracted = $this->extractor->extract($ocrData);
                
                // Calculate score
                $data = $extracted['data'];
                $confidences = $extracted['confidences'];
                
                $fieldCount = count(array_filter($data, fn($v) => $v !== ''));
                $avgConf = count($confidences) > 0 ? array_sum($confidences) / count($confidences) : 0;
                $hasNik = ($data['nik'] !== '') ? 10 : 0; // NIK is super important
                
                $score = ($fieldCount * 2) + $hasNik + $avgConf;
                
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestExtracted = $extracted;
                }
            }
        }

        if (!$bestExtracted) {
            Log::warning('KTP OCR paddleocr returned empty for all variants.');
            return ['data' => $result];
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

        foreach ($confidences as $field => $conf) {
            Log::info('KTP OCR field', ['field' => $field, 'confidence' => $conf]);
        }
        
        $fieldsFound = count(array_filter($result, fn($v) => $v !== ''));
        
        if ($fieldsFound < 2 && $result['nik'] === '') {
            Log::warning('KTP OCR below confidence threshold; identity data preserved');
            foreach (['name', 'nik', 'birth_place', 'birth_date', 'gender', 'job', 'address', 'rt_rw', 'kelurahan_desa', 'kecamatan', 'agama', 'status_perkawinan', 'kewarganegaraan'] as $f) {
                $result[$f] = '';
            }
        }

        Log::info('KTP OCR FINAL PROFILE', $result);
        return ['data' => $result];
    }

    private function createGrayscale(string $path): ?string
    {
        if (!extension_loaded('gd')) return null;
        $src = @imagecreatefromstring(@file_get_contents($path));
        if (!$src) return null;
        imagefilter($src, IMG_FILTER_GRAYSCALE);
        $tmp = tempnam(sys_get_temp_dir(), 'ktp_gray_') . '.png';
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
