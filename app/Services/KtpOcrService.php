<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class KtpOcrService
{
    /**
     * Run Tesseract OCR on a KTP image and extract structured data.
     */
    public function extract(string $absolutePath): array
    {
        Log::info('KTP OCR started', ['path' => $absolutePath]);
        
        $raw = $this->runOcrWithPreferredProvider($absolutePath);
        $result = $this->parse($raw);
        
        $fieldsFound = $this->countFields($result);
        
        Log::info('KTP OCR best attempt parsed result', [
            'fields_found' => $fieldsFound,
            'nik' => $result['nik'] !== '' ? $result['nik'] : null,
            'meaningful' => $fieldsFound >= 2 || $result['nik'] !== '',
        ]);

        if ($fieldsFound < 2 && $result['nik'] === '') {
            Log::warning('KTP OCR below confidence threshold; identity data preserved');
            // Empty out fields to prevent overwriting with garbage
            foreach (['name', 'nik', 'birth_place', 'birth_date', 'gender', 'job', 'address', 'rt_rw', 'kelurahan_desa', 'kecamatan', 'agama', 'status_perkawinan', 'kewarganegaraan'] as $f) {
                $result[$f] = '';
            }
        }

        return $result;
    }

    private function countFields(array $parsed): int
    {
        $c = 0;
        foreach (['name', 'nik', 'birth_place', 'birth_date', 'gender', 'job', 'address', 'rt_rw', 'kelurahan_desa', 'kecamatan', 'agama', 'status_perkawinan', 'kewarganegaraan'] as $f) {
            if (!empty($parsed[$f])) $c++;
        }
        return $c;
    }

    private function runOcrWithPreferredProvider(string $absolutePath): string
    {
        $vision = app(GoogleVisionKtpOcrService::class);
        if ((bool) config('services.vision.enabled', false) && $vision->available()) {
            try {
                $text = $vision->extractText($absolutePath);
                if (trim($text) !== '') {
                    Log::info('KTP OCR provider: google_vision');
                    return $text;
                }
            } catch (\Throwable $e) {}
        }

        Log::info('KTP OCR provider: tesseract');
        return $this->bestAttempt($absolutePath);
    }

    private function bestAttempt(string $path): string
    {
        $size = @getimagesize($path);
        Log::info('KTP OCR source image', [
            'width' => $size[0] ?? null,
            'height' => $size[1] ?? null,
        ]);

        $temps = [];
        $crop = null;

        if (extension_loaded('gd')) {
            $detector = app(KtpCardDetector::class);
            $card = $detector->detect($path);

            if ($card !== null) {
                Log::info('KTP OCR card detected', [
                    'bbox' => $card['bbox'],
                    'aspect' => round($card['aspect'], 3),
                    'threshold' => $card['threshold'] ?? null,
                ]);

                $crop = $detector->warp($path, $card['corners']);
                if ($crop !== null) {
                    $temps[] = $crop;
                }
            } else {
                Log::info('KTP OCR card detection: FAILED or ignored (>90%), OCR on full frame');
            }
        }

        $attempts = [];
        $variants = $this->buildVariants($path, $crop, $temps);
        
        foreach ($variants as $label => $image) {
            $psms = str_starts_with($label, 'rot') ? [6] : [3, 4, 6];
            foreach ($psms as $psm) {
                try {
                    $raw = $this->runTesseract($image, $psm);
                    $parsed = $this->parse($raw);
                    
                    $score = $this->scoreAttempt($raw, $parsed);
                    $fields = $this->countFields($parsed);
                    
                    $attempts[] = [
                        'raw' => $raw, 
                        'score' => $score, 
                        'label' => $label . '/psm' . $psm, 
                        'fields' => $fields,
                        'parsed' => $parsed
                    ];
                    
                    Log::info('KTP OCR attempt', [
                        'label' => $label,
                        'psm' => $psm,
                        'score' => $score,
                        'fields' => $fields,
                        'words' => str_word_count($raw),
                    ]);
                } catch (\Throwable $e) {
                    Log::warning('KTP OCR attempt failed', ['label' => $label, 'psm' => $psm, 'error' => $e->getMessage()]);
                }
            }
        }

        foreach ($temps as $tmp) {
            @unlink($tmp);
        }

        if (empty($attempts)) {
            throw new \RuntimeException('Tesseract OCR failed on all attempts.');
        }

        usort($attempts, fn ($a, $b) => [$b['score'], $b['fields']] <=> [$a['score'], $a['fields']]);
        $best = $attempts[0];
        Log::info('KTP OCR best attempt selected', [
            'label' => $best['label'],
            'score' => $best['score'],
            'fields' => $best['fields'],
            'preview' => mb_substr(preg_replace('/\s+/', ' ', trim($best['raw'])), 0, 120),
        ]);

        return $best['raw'];
    }

    private function scoreAttempt(string $raw, array $parsed): int
    {
        $score = 0;
        
        // 1. NIK valid 16 digit
        if (preg_match('/^\d{16}$/', $parsed['nik'])) {
            $score += 500;
        } elseif ($parsed['nik'] !== '') {
            $score += 100;
        }
        
        // 2. Label KTP
        if (preg_match('/KARTU\s*TANDA\s*PENDUDUK|PROVINSI/i', $raw)) {
            $score += 50;
        }

        // Add scores for found structural fields
        if ($parsed['name'] !== '') $score += 50;
        if ($parsed['birth_place'] !== '') $score += 30;
        if ($parsed['birth_date'] !== '') $score += 30;
        if ($parsed['gender'] !== '') $score += 30;
        if ($parsed['address'] !== '') $score += 30;
        if ($parsed['rt_rw'] !== '') $score += 20;
        if ($parsed['kelurahan_desa'] !== '') $score += 20;
        if ($parsed['kecamatan'] !== '') $score += 20;
        if ($parsed['agama'] !== '') $score += 20;
        if ($parsed['status_perkawinan'] !== '') $score += 20;
        if ($parsed['job'] !== '') $score += 20;
        if ($parsed['kewarganegaraan'] !== '') $score += 20;
        
        // Word count score (capped at 20) to slightly reward more text, but prevent noise from winning
        $words = str_word_count($raw);
        $score += min($words, 20);

        return $score;
    }

    private function buildVariants(string $path, ?string $crop, array &$temps): array
    {
        $variants = [];
        $base = $path;
        $baseLabel = 'original';

        if ($crop !== null) {
            $variants['card'] = $crop;
            $base = $crop;
            $baseLabel = 'card';

            $pre = $this->preprocessImage($crop);
            if ($pre !== null) {
                $temps[] = $pre;
                $variants['card-pre'] = $pre;
            }
        }

        // Always keep original (maybe resized)
        $opt = $this->optimizeImageSize($path);
        if ($opt !== null && $opt !== $path) {
            $temps[] = $opt;
            $variants['original_opt'] = $opt;
        } else {
            $variants['original'] = $path;
        }

        // Grayscale contrast
        $gray = $this->preprocessImage($opt ?? $path);
        if ($gray !== null) {
            $temps[] = $gray;
            $variants['gray'] = $gray;
        }

        return $variants;
    }

    private function optimizeImageSize(string $path): ?string
    {
        if (!extension_loaded('gd')) return null;
        $src = @imagecreatefromstring(@file_get_contents($path));
        if (!$src) return null;

        // Fix EXIF orientation
        if (function_exists('exif_read_data')) {
            $exif = @exif_read_data($path);
            if (!empty($exif['Orientation'])) {
                switch ($exif['Orientation']) {
                    case 3: $src = imagerotate($src, 180, 0); break;
                    case 6: $src = imagerotate($src, -90, 0); break;
                    case 8: $src = imagerotate($src, 90, 0); break;
                }
            }
        }

        $w = imagesx($src);
        $h = imagesy($src);
        
        // Auto rotate portrait to landscape
        if ($h > $w) {
            $src = imagerotate($src, 90, 0);
            $w = imagesx($src);
            $h = imagesy($src);
        }

        // Resize if too large
        $maxDim = 2000;
        if ($w > $maxDim || $h > $maxDim) {
            $scale = $maxDim / max($w, $h);
            $nw = (int)($w * $scale);
            $nh = (int)($h * $scale);
            $dst = imagecreatetruecolor($nw, $nh);
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
            $tmp = tempnam(sys_get_temp_dir(), 'ktp_opt_') . '.png';
            imagepng($dst, $tmp);
            imagedestroy($src);
            imagedestroy($dst);
            return $tmp;
        }
        
        $tmp = tempnam(sys_get_temp_dir(), 'ktp_opt_') . '.png';
        imagepng($src, $tmp);
        imagedestroy($src);
        return $tmp;
    }

    private function preprocessImage(string $path): ?string
    {
        if (!extension_loaded('gd')) return null;
        $src = @imagecreatefromstring(@file_get_contents($path));
        if (!$src) return null;

        imagefilter($src, IMG_FILTER_GRAYSCALE);
        imagefilter($src, IMG_FILTER_CONTRAST, -20); // Increase contrast (negative value)

        $tmp = tempnam(sys_get_temp_dir(), 'ktp_gray_') . '.png';
        imagepng($src, $tmp);
        imagedestroy($src);

        return $tmp;
    }

    private function runTesseract(string $path, int $psm): string
    {
        $bin = config('services.tesseract.bin', 'tesseract');
        // ind+eng fallback
        $cmd = sprintf('%s %s stdout -l ind+eng --psm %d quiet 2>/dev/null', escapeshellarg($bin), escapeshellarg($path), $psm);
        exec($cmd, $output, $code);
        return implode("\n", $output);
    }

    private function cleanLines(string $raw): array
    {
        $lines = array_map('trim', explode("\n", $raw));
        return array_values(array_filter(array_map(function (string $line) {
            return preg_replace('/^(?:[\s|:;?A*_?"?".\/\\\\#]+)/', '', $line);
        }, $lines), function (string $line) {
            if ($line === '') return false;
            if (preg_match('/^(Estimating|Warning|Error|Page\b|Loaded|Tesseract|Info\b|C13)/i', $line)) return false;
            return true;
        }));
    }

    private function cleanNik(string $value): string
    {
        $value = strtoupper($value);
        $value = str_replace(['O', 'I', 'L', 'S', 'B'], ['0', '1', '1', '5', '8'], $value);
        return preg_replace('/[^0-9]/', '', $value);
    }

    public function parse(string $raw): array
    {
        $lines = $this->cleanLines($raw);
        $result = [
            'raw'         => $raw,
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

        $fullText = implode("\n", $lines);

        // NIK (Lebih robust: NIK, N1K, NlK, NIK)
        if (preg_match('/N[I1l|][Kk][\s:]*([A-Z0-9\s]{10,24})/i', $fullText, $m)) {
            $cleaned = $this->cleanNik($m[1]);
            if (preg_match('/(\d{16})/', $cleaned, $m2)) {
                $result['nik'] = $m2[1];
            }
        }
        if ($result['nik'] === '' && preg_match('/(\d[\d\sOIlSB]{14,24})/', $fullText, $m)) {
            $cleaned = $this->cleanNik($m[1]);
            if (preg_match('/(\d{16})/', $cleaned, $m2)) {
                $result['nik'] = $m2[1];
            }
        }

        for ($i = 0; $i < count($lines); $i++) {
            $line = $lines[$i];

            // Nama (Lebih robust: NAMA, Nama, Narna, Namo)
            if ($result['name'] === '' && preg_match('/^N[aA][rmn][aAuo]\s*[:\-\s]\s*(.+)$/i', $line, $m)) {
                $result['name'] = trim(preg_replace('/[^A-Za-z\s\,\.\']/', '', $m[1]));
            } elseif ($result['name'] === '' && preg_match('/^N[aA][rmn][aAuo]\s*$/i', $line) && isset($lines[$i + 1])) {
                $result['name'] = trim(preg_replace('/[^A-Za-z\s\,\.\']/', '', $lines[$i + 1]));
            }

            // Tempat/Tgl Lahir
            if ($result['birth_place'] === '' && preg_match('/(T[eE]mp[aA]t|Tgl|L[aA]h[iI]r).*?\s*[:\-\s]*\s*(.+)$/i', $line, $mIn)) {
                $cleanedLine = str_replace(['O', 'l', 'I'], ['0', '1', '1'], $mIn[2]);
                if (preg_match('/(.+?),\s*(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})/i', $cleanedLine, $m)) {
                    $result['birth_place'] = preg_replace('/[^A-Za-z\s\-]/', '', trim($m[1]));
                    $result['birth_date'] = sprintf('%04d-%02d-%02d', $m[4], $m[3], $m[2]);
                }
            } elseif ($result['birth_place'] === '' && preg_match('/(T[eE]mp[aA]t|Tgl|L[aA]h[iI]r)/i', $line) && isset($lines[$i + 1])) {
                $cleanedLine = str_replace(['O', 'l', 'I'], ['0', '1', '1'], $lines[$i + 1]);
                if (preg_match('/(.+?),\s*(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})/i', $cleanedLine, $m)) {
                    $result['birth_place'] = preg_replace('/[^A-Za-z\s\-]/', '', trim($m[1]));
                    $result['birth_date'] = sprintf('%04d-%02d-%02d', $m[4], $m[3], $m[2]);
                }
            }

            // Jenis Kelamin
            if ($result['gender'] === '' && preg_match('/LAK[I1|][\s\-]*LAK[I1|]/i', $line)) {
                $result['gender'] = 'LAKI-LAKI';
            } elseif ($result['gender'] === '' && preg_match('/PEREMPUAN|PERENPUAN/i', $line)) {
                $result['gender'] = 'PEREMPUAN';
            }

            // Alamat (multiline support diletakkan duluan untuk tangkap string panjang)
            if ($result['address'] === '' && preg_match('/A[l1I]am[aA]t|A[l1I]arnat\s*[:\-\s]*\s*(.*)$/i', $line, $m)) {
                $addrLines = [];
                if (trim($m[1]) !== '') {
                    $addrLines[] = trim($m[1]);
                }
                for ($j = $i + 1; $j < count($lines); $j++) {
                    $nextLine = trim($lines[$j]);
                    if (preg_match('/^(R[T7][\s\/\\\.]*[R|B][W|M]|K[eE]l|K[eE]c|A[gG]am[aA]|S[tT]at|P[eE]kerj|K[eE]warga)/i', $nextLine)) {
                        break;
                    }
                    $addrLines[] = preg_replace('/[^A-Za-z0-9\s\.\,\-]/', '', $nextLine);
                }
                $result['address'] = trim(implode(' ', $addrLines));
            } elseif ($result['address'] === '' && preg_match('/A[l1I]am[aA]t|A[l1I]arnat/i', $line) && isset($lines[$i + 1])) {
                 // Kasus bila "Alamat" di baris tersendiri dan isinya di baris berikutnya
                 $addrLines = [];
                 for ($j = $i + 1; $j < count($lines); $j++) {
                    $nextLine = trim($lines[$j]);
                    if (preg_match('/^(R[T7][\s\/\\\.]*[R|B][W|M]|K[eE]l|K[eE]c|A[gG]am[aA]|S[tT]at|P[eE]kerj|K[eE]warga)/i', $nextLine)) {
                        break;
                    }
                    $addrLines[] = preg_replace('/[^A-Za-z0-9\s\.\,\-]/', '', $nextLine);
                }
                if (!empty($addrLines)) {
                    $result['address'] = trim(implode(' ', $addrLines));
                }
            }

            // RT/RW
            if ($result['rt_rw'] === '' && preg_match('/R[T7][\s\/\\\.]*[R|B][W|M]\s*[:\-\s]*([0-9OIS]{1,3}[\/\\\][0-9OIS]{1,3})/i', $line, $m)) {
                $result['rt_rw'] = str_replace(['O', 'I', 'S'], ['0', '1', '5'], trim($m[1]));
            }

            // Kel/Desa
            if ($result['kelurahan_desa'] === '' && preg_match('/K[eE]l[\s\/\\\.]+D[eE]s[aA]|K[eE]l[uU]r[aA]h[aA]n\s*[:\-\s]*\s*(.+)$/i', $line, $m)) {
                $result['kelurahan_desa'] = trim(preg_replace('/[^A-Za-z\s\-0-9]/', '', $m[1]));
            }

            // Kecamatan
            if ($result['kecamatan'] === '' && preg_match('/K[eE]c[aA]m[aA]t[aA]n|K[eE]c[aA]m\s*[:\-\s]*\s*(.+)$/i', $line, $m)) {
                $result['kecamatan'] = trim(preg_replace('/[^A-Za-z\s\-0-9]/', '', $m[1]));
            }

            // Agama
            if ($result['agama'] === '' && preg_match('/A[gG][aA]m[aA]\s*[:\-\s]*\s*(.+)$/i', $line, $m)) {
                $result['agama'] = trim(preg_replace('/[^A-Za-z\s]/', '', $m[1]));
            } elseif ($result['agama'] === '' && preg_match('/A[gG][aA]m[aA]/i', $line) && isset($lines[$i + 1])) {
                $result['agama'] = trim(preg_replace('/[^A-Za-z\s]/', '', $lines[$i + 1]));
            }

            // Status Perkawinan
            if ($result['status_perkawinan'] === '' && preg_match('/(S[tT][aA]t[uU]s|P[eE]rk[aA]w[iI]n[aA]n|K[aA]w[iI]n)\s*[:\-\s]*\s*(BELUM KAWIN|KAWIN|CERAI HIDUP|CERAI MATI)/i', $line, $m)) {
                $result['status_perkawinan'] = strtoupper(trim($m[2]));
            } elseif ($result['status_perkawinan'] === '' && preg_match('/(S[tT][aA]t[uU]s|P[eE]rk[aA]w[iI]n[aA]n|K[aA]w[iI]n)/i', $line) && isset($lines[$i + 1]) && preg_match('/(BELUM KAWIN|KAWIN|CERAI HIDUP|CERAI MATI)/i', $lines[$i + 1], $m)) {
                $result['status_perkawinan'] = strtoupper(trim($m[1]));
            }

            // Pekerjaan
            if ($result['job'] === '' && preg_match('/P[eE]k[eE]r[jJ|][aA][aA]n\s*[:\-\s]*\s*(.+)$/i', $line, $m)) {
                $result['job'] = trim(preg_replace('/[^A-Za-z\s\/]/', '', $m[1]));
            } elseif ($result['job'] === '' && preg_match('/P[eE]k[eE]r[jJ|][aA][aA]n/i', $line) && isset($lines[$i + 1])) {
                $result['job'] = trim(preg_replace('/[^A-Za-z\s\/]/', '', $lines[$i + 1]));
            }

            // Kewarganegaraan
            if ($result['kewarganegaraan'] === '' && preg_match('/K[eE]w[aA]r[gG][aA].*?\s*[:\-\s]*\s*(WNI|WNA)/i', $line, $m)) {
                $result['kewarganegaraan'] = strtoupper(trim($m[1]));
            }
        }

        // Clean up any remaining noise
        $result['address'] = preg_replace('/\s+/', ' ', $result['address']);
        $result['name'] = preg_replace('/\s+/', ' ', $result['name']);

        return $result;
    }
}
