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
        $raw = $this->runTesseract($absolutePath);

        Log::info('KTP OCR raw text:', ['raw' => $raw]);

        return $this->parse($raw);
    }

    /**
     * Execute Tesseract on the image and return raw text.
     */
    private function runTesseract(string $path): string
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

        $imagePath = $this->preprocessImage($path) ?? $path;

        // stdout only holds the recognized text; stderr is captured separately
        $cmd = sprintf('%s %s stdout -l %s', escapeshellarg($bin), escapeshellarg($imagePath), $langs);
        $stderrFile = tempnam(sys_get_temp_dir(), 'ktp_ocr_');
        exec($cmd . ' 2>' . escapeshellarg($stderrFile), $output, $exitCode);
        $stderr = file_get_contents($stderrFile);
        @unlink($stderrFile);

        // Clean up the temp preprocessed image if it was created
        if ($imagePath !== $path) {
            @unlink($imagePath);
        }

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
