<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class KtpOcrService
{
    /**
     * Run Tesseract OCR on a KTP image and extract structured data.
     *
     * @param string $absolutePath Full filesystem path to the image
     * @return array{raw: string, name: string, nik: string, birth_place: string, birth_date: string, address: string, gender: string}
     */
    public function extract(string $absolutePath): array
    {
        $raw = $this->runOcrWithPreferredProvider($absolutePath);

        Log::info('KTP OCR raw text:', ['raw' => $raw]);

        return $this->parse($raw);
    }

    /**
     * Tesseract (offline) adalah provider utama tanpa biaya. Google Cloud
     * Vision HANYA dipakai bila VISION_OCR_ENABLED=true DAN API key terisi
     * (opsi future) — tanpa itu OCR tetap berfungsi penuh via Tesseract.
     */
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
                Log::warning('KTP OCR google_vision returned empty text; falling back to tesseract');
            } catch (\Throwable $e) {
                Log::error('KTP OCR google_vision failed; falling back to tesseract', ['error' => $e->getMessage()]);
            }
        }

        Log::info('KTP OCR provider: tesseract');
        return $this->bestAttempt($absolutePath);
    }

    /**
     * Jalankan Tesseract pada beberapa variasi preprocessing + PSM, lalu ambil
     * hasil dengan skor tertinggi. Foto kamera HP sering miring/blur/sebagian
     * terbaca — mencoba banyak konfigurasi menaikkan peluang field terbaca.
     */
    private function bestAttempt(string $path): string
    {
        $attempts = [];
        $temps = [];

        foreach ($this->buildVariants($path, $temps) as $label => $image) {
            $psms = ($label === 'bin' || $label === 'rot') ? [6] : [3, 6];
            foreach ($psms as $psm) {
                try {
                    $raw = $this->runTesseract($image, $psm);
                    $attempts[] = ['raw' => $raw, 'score' => $this->scoreText($raw), 'label' => $label . '/psm' . $psm];
                    Log::info('KTP OCR attempt', ['label' => $label, 'psm' => $psm, 'words' => str_word_count($raw)]);
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

        usort($attempts, fn ($a, $b) => $b['score'] <=> $a['score']);
        $best = $attempts[0];
        Log::info('KTP OCR best attempt', ['label' => $best['label'], 'score' => $best['score']]);

        return $best['raw'];
    }

    /**
     * Bangun daftar [label => imagePath] variasi gambar untuk dicoba.
     * Temp file hasil preprocessing dicatat ke $temps agar dibersihkan.
     */
    private function buildVariants(string $path, array &$temps): array
    {
        $variants = ['original' => $path];

        $pre = $this->preprocessImage($path);
        if ($pre !== null) {
            $temps[] = $pre;
            $variants['pre'] = $pre;

            $rotation = $this->detectOrientation($pre);
            if ($rotation !== null && $rotation !== 0) {
                $rot = $this->rotateImage($pre, $rotation);
                if ($rot !== null) {
                    $temps[] = $rot;
                    $variants['rot'] = $rot;
                }
            }
        }

        $bin = $this->binarizeImage($path);
        if ($bin !== null) {
            $temps[] = $bin;
            $variants['bin'] = $bin;
        }

        return $variants;
    }

    /**
     * Deteksi rotasi lewat OSD (PSM 0). Kembalikan sudut derajat atau null.
     */
    private function detectOrientation(string $path): ?int
    {
        $bin = $this->findTesseract();
        if (!$bin) {
            return null;
        }

        $cmd = sprintf('%s %s stdout --psm 0', escapeshellarg($bin), escapeshellarg($path));
        exec($cmd . ' 2>/dev/null', $output, $exitCode);

        if ($exitCode !== 0) {
            return null;
        }

        foreach ($output as $line) {
            if (preg_match('/Rotate:\s*([0-9]+)/i', $line, $m)) {
                return (int) $m[1];
            }
        }

        return null;
    }

    /**
     * Putar foto agar ujungnya menghadap ke bawah (korreksi foto miring).
     */
    private function rotateImage(string $path, int $angle): ?string
    {
        if (!extension_loaded('gd')) {
            return null;
        }

        $src = @imagecreatefromstring(@file_get_contents($path));
        if (!$src) {
            return null;
        }

        $rotated = imagerotate($src, 360 - ($angle % 360), 0xffffff);
        imagedestroy($src);

        if ($rotated === false) {
            return null;
        }

        $tmp = tempnam(sys_get_temp_dir(), 'ktp_rot_') . '.png';
        imagepng($rotated, $tmp);
        imagedestroy($rotated);

        return $tmp;
    }

    /**
     * Versi biner (hitam-putih keras): upscale, sharpen, grayscale, contrast
     * tinggi + brightness — Tesseract kadang lebih akurat pada hasil biner.
     */
    private function binarizeImage(string $path): ?string
    {
        if (!extension_loaded('gd')) {
            return null;
        }

        $src = @imagecreatefromstring(@file_get_contents($path));
        if (!$src) {
            return null;
        }

        $srcW = imagesx($src);
        $srcH = imagesy($src);
        $targetWidth = 2000;
        $newW = $srcW;
        $newH = $srcH;
        if ($srcW < $targetWidth) {
            $newW = $targetWidth;
            $newH = (int) round($srcH * ($targetWidth / $srcW));
        }

        $dst = imagecreatetruecolor($newW, $newH);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $srcW, $srcH);

        if (function_exists('imageconvolution')) {
            $sharpen = [[0, -1, 0], [-1, 5, -1], [0, -1, 0]];
            imageconvolution($dst, $sharpen, 1, 0);
        }

        imagefilter($dst, IMG_FILTER_GRAYSCALE);
        imagefilter($dst, IMG_FILTER_CONTRAST, -100);
        imagefilter($dst, IMG_FILTER_BRIGHTNESS, 20);

        $tmp = tempnam(sys_get_temp_dir(), 'ktp_bin_') . '.png';
        imagepng($dst, $tmp);

        imagedestroy($src);
        imagedestroy($dst);

        return $tmp;
    }

    /**
     * Skor kualitas teks OCR: prioritas NIK 16 digit, lalu pengenal field KTP,
     * lalu jumlah kata yang terbaca.
     */
    private function scoreText(string $raw): int
    {
        $score = 0;

        if (preg_match('/\b\d{16}\b/', $raw, $m)) {
            $score += 120;
        }
        if (preg_match('/NIK\b/i', $raw)) {
            $score += 12;
        }
        if (preg_match('/Nama/i', $raw)) {
            $score += 12;
        }
        if (preg_match('/Tempat/i', $raw) && preg_match('/Lahir/i', $raw)) {
            $score += 12;
        }
        if (preg_match('/Jenis Kelamin|LAKI|PEREMPUAN/i', $raw)) {
            $score += 10;
        }
        if (preg_match('/Pekerjaan/i', $raw)) {
            $score += 8;
        }
        if (preg_match('/Alamat/i', $raw)) {
            $score += 8;
        }

        $score += min(str_word_count($raw), 60);

        return $score;
    }

    public function tesseractAvailable(): bool
    {
        return $this->findTesseract() !== null;
    }

    /**
     * Execute Tesseract on the image and return raw text.
     */
    private function runTesseract(string $path, int $psm = 3): string
    {
        $bin = $this->findTesseract();
        if (!$bin) {
            throw new \RuntimeException('Tesseract OCR engine not found on this system.');
        }

        // Prefer ind+eng but fall back to eng if ind is unavailable
        $langs = 'ind+eng';
        if (!$this->languageAvailable($bin, 'ind')) {
            $langs = 'eng';
        }

        // stdout only holds the recognized text; stderr is captured separately
        $cmd = sprintf('%s %s stdout -l %s --oem 1 --psm %d', escapeshellarg($bin), escapeshellarg($path), $langs, $psm);
        $stderrFile = tempnam(sys_get_temp_dir(), 'ktp_ocr_');
        exec($cmd . ' 2>' . escapeshellarg($stderrFile), $output, $exitCode);
        $stderr = file_get_contents($stderrFile);
        @unlink($stderrFile);

        if ($exitCode !== 0) {
            throw new \RuntimeException('Tesseract exited with code ' . $exitCode . ': ' . trim($stderr));
        }

        Log::info('KTP OCR tesseract stderr:', ['stderr' => trim($stderr)]);
        Log::info('KTP OCR language used:', ['langs' => $langs]);

        return implode("\n", $output);
    }

    /**
     * Upscale, convert to grayscale and boost contrast using GD when available.
     * Returns the path to a temporary preprocessed image, or null if GD can't process.
     */
    private function preprocessImage(string $path): ?string
    {
        if (!extension_loaded('gd')) {
            return null;
        }

        $src = @imagecreatefromstring(file_get_contents($path));
        if (!$src) {
            return null;
        }

        $srcW = imagesx($src);
        $srcH = imagesy($src);

        // Targets ~2000px wide for better Tesseract accuracy
        $targetWidth = 2000;
        $newW = $srcW;
        $newH = $srcH;
        if ($srcW < $targetWidth) {
            $newW = $targetWidth;
            $newH = (int) round($srcH * ($targetWidth / $srcW));
        }

        $dst = imagecreatetruecolor($newW, $newH);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $srcW, $srcH);

        imagefilter($dst, IMG_FILTER_GRAYSCALE);
        imagefilter($dst, IMG_FILTER_CONTRAST, -30);

        $tmp = tempnam(sys_get_temp_dir(), 'ktp_img_') . '.png';
        imagepng($dst, $tmp);

        imagedestroy($src);
        imagedestroy($dst);

        return $tmp;
    }

    /**
     * Check if the given language traineddata is installed.
     */
    private function languageAvailable(string $bin, string $lang): bool
    {
        $cmd = sprintf('%s --list-langs 2>&1', escapeshellarg($bin));
        exec($cmd, $output, $exitCode);
        return $exitCode === 0 && in_array($lang, array_map('trim', $output), true);
    }

    /**
     * Find the Tesseract binary path (cross-platform).
     */
    private function findTesseract(): ?string
    {
        // Check common locations
        $candidates = [
            'tesseract', // PATH
            '/usr/bin/tesseract', // Linux
            '/usr/local/bin/tesseract', // macOS Homebrew
            'C:\\Program Files\\Tesseract-OCR\\tesseract.exe', // Windows
            'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe', // Windows 32-bit
        ];

        foreach ($candidates as $candidate) {
            if (is_executable($candidate)) {
                return $candidate;
            }
        }

        // Try shell command to find it
        exec('where tesseract 2>nul', $whereOut, $whereCode);
        if ($whereCode === 0 && !empty($whereOut)) {
            return trim($whereOut[0]);
        }

        exec('which tesseract 2>/dev/null', $whichOut, $whichCode);
        if ($whichCode === 0 && !empty($whichOut)) {
            return trim($whichOut[0]);
        }

        return null;
    }

    /**
     * Parse raw OCR text into structured KTP fields.
     */
    /**
     * Normalize OCR misreads inside a NIK value: strip space/separators, O→0, I→1.
     */
    private function cleanNik(string $value): string
    {
        $value = strtoupper($value);
        $value = str_replace(['O', 'I'], ['0', '1'], $value);
        return preg_replace('/[^0-9]/', '', $value);
    }

    /**
     * Remove noise from a parsed name value (leading bullets/dashes from OCR).
     */
    private function cleanName(string $value): string
    {
        $name = preg_replace('/^[\s\-—–_.:*·"\'`]+/', '', trim($value));
        return trim($name) ?: '';
    }

    /**
     * Clean a job value: strip short trailing OCR noise fragments
     * (e.g. "PELAJAR/MAHASISWA se" -> "PELAJAR/MAHASISWA").
     */
    private function cleanJob(string $value): string
    {
        $job = $this->cleanName($value);

        // Remove trailing single letter/noise fragment (from the line below bleeding over)
        $job = preg_replace('/\s[A-Za-z]{1,2}$/', '', $job);

        // Remove trailing dash/colon artefacts
        $job = preg_replace('/[\s\-:]+$/', '', $job);

        return trim($job) ?: '';
    }

    /**
     * Remove Tesseract stderr chatter and empty lines from the OCR text.
     */
    private function cleanLines(string $raw): array
    {
        $lines = array_map('trim', explode("\n", $raw));

        return array_values(array_filter($lines, function (string $line) {
            if ($line === '') {
                return false;
            }
            // Tesseract info/warning chatter that is not KTP content
            if (preg_match('/^(Estimating|Warning|Error|Page\b|Loaded|Tesseract|Info\b|C13)/i', $line)) {
                return false;
            }
            return true;
        }));
    }

    private function parse(string $raw): array
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
        ];

        $fullText = implode("\n", $lines);

        // --- NIK (16 digits) ---
        if (preg_match('/(\d{16})/', $fullText, $m)) {
            $result['nik'] = $m[1];
        } elseif (preg_match('/NIK[\s:]*([\dOIl\s]{10,24})/i', $fullText, $m)) {
            $cleaned = $this->cleanNik($m[1]);
            if (preg_match('/(\d{16})/', $cleaned, $m2)) {
                $result['nik'] = $m2[1];
            }
        } elseif (preg_match('/(\d[\d\sOIl]{14,24})/', $fullText, $m)) {
            $cleaned = $this->cleanNik($m[1]);
            if (preg_match('/(\d{16})/', $cleaned, $m2)) {
                $result['nik'] = $m2[1];
            }
        }

        // --- Nama ---
        for ($i = 0; $i < count($lines); $i++) {
            if (preg_match('/^Nama\s*$/i', $lines[$i]) && isset($lines[$i + 1])) {
                $candidate = $this->cleanName($lines[$i + 1]);
                if ($candidate !== '' && !preg_match('/^\d+$/', $candidate)) {
                    $result['name'] = $candidate;
                    break;
                }
            }
            if (preg_match('/^Nama\s*[:\-\s]\s*(.+)$/i', $lines[$i], $m)) {
                $name = $this->cleanName($m[1]);
                if ($name !== '') {
                    $result['name'] = $name;
                    break;
                }
            }
        }

        // --- Tempat/Tgl Lahir ---
        for ($i = 0; $i < count($lines); $i++) {
            if (preg_match('/Tempat.*Tgl.*Lahir/i', $lines[$i])) {
                // Same line inline value: "Tempat/Tgl Lahir : BEKASI, 07-03-2002"
                if (preg_match('/Tempat.*Tgl.*Lahir\s*[:\-\s]*\s*(.+)$/i', $lines[$i], $mIn)) {
                    if (preg_match('/(.+?),\s*(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})/i', $mIn[1], $m)) {
                        $result['birth_place'] = trim($m[1]);
                        $result['birth_date'] = sprintf('%04d-%02d-%02d', $m[4], $m[3], $m[2]);
                        break;
                    }
                }
                // Value on next line: "Tempat/Tgl Lahir" then "BEKASI, 07-03-2002"
                if (isset($lines[$i + 1]) && preg_match('/(.+?),\s*(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})/i', $lines[$i + 1], $m)) {
                    $result['birth_place'] = trim($m[1]);
                    $result['birth_date'] = sprintf('%04d-%02d-%02d', $m[4], $m[3], $m[2]);
                    break;
                }
                // Compact date: "BEKASI 07032002"
                if (isset($lines[$i + 1]) && preg_match('/(.+?)\s+(\d{2})(\d{2})(\d{4})/i', $lines[$i + 1], $m)) {
                    $result['birth_place'] = trim($m[1]);
                    $result['birth_date'] = sprintf('%04d-%02d-%02d', $m[4], $m[3], $m[2]);
                    break;
                }
            }
            // Bare value line without label: "BEKASI, 07-03-2002"
            if (preg_match('/^([A-Z\s]{2,}),\s*(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})$/i', $lines[$i], $m) && $result['birth_place'] === '') {
                $result['birth_place'] = trim($m[1]);
                $result['birth_date'] = sprintf('%04d-%02d-%02d', $m[4], $m[3], $m[2]);
            }
        }

        // --- Jenis Kelamin ---
        if (preg_match('/LAKI[\s\-]*LAKI|LAKI/i', $fullText)) {
            $result['gender'] = 'LAKI-LAKI';
        } elseif (preg_match('/PEREMPUAN/i', $fullText)) {
            $result['gender'] = 'PEREMPUAN';
        }

        // --- Pekerjaan ---
        for ($i = 0; $i < count($lines); $i++) {
            // Inline: "Pekerjaan : PELAJAR/MAHASISWA"
            if (preg_match('/^Pekerjaan\s*[:\-\s]+\s*(.+)$/i', $lines[$i], $m)) {
                $job = $this->cleanJob($m[1]);
                if ($job !== '') {
                    $result['job'] = $job;
                }
                break;
            }
            // Label on its own line: "Pekerjaan" then value below
            if (preg_match('/^Pekerjaan\s*$/i', $lines[$i]) && isset($lines[$i + 1])) {
                $job = $this->cleanJob($lines[$i + 1]);
                if ($job !== '' && !preg_match('/^(Perkawinan|Agama|Kawin|Status|Alamat)/i', $job)) {
                    $result['job'] = $job;
                }
                break;
            }
        }

        // --- Alamat ---
        // Tolerant label match: OCR often mangles "Alamat" (e.g. "Alai", "Alamal")
        for ($i = 0; $i < count($lines); $i++) {
            if (preg_match('/^Al[a-z]{2,}\s*[:\-\s]+\s*(.+)$/i', $lines[$i], $m)) {
                $result['address'] = trim($m[1]);
                break;
            }
            // Label on its own line: "Alamat" then address lines below
            if (preg_match('/^Al[a-z]{2,}\s*$/i', $lines[$i])) {
                $addrLines = [];
                for ($j = $i + 1; $j < count($lines); $j++) {
                    $line = trim($lines[$j]);
                    if ($line === '') continue;
                    // Stop at unrelated KTP field labels
                    if (preg_match('/^(Agama|Kawin|Pekerjaan|Warganegara|Berlaku|Goldar|Nama|NIK|Tempat|Jenis|Gol\b)/i', $line)) {
                        break;
                    }
                    $addrLines[] = $line;
                }
                if (!empty($addrLines)) {
                    $result['address'] = implode(', ', $addrLines);
                }
                break;
            }
        }

        return $result;
    }
}
