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

        $cmd = sprintf('%s %s stdout -l %s 2>&1', escapeshellarg($bin), escapeshellarg($path), $langs);
        exec($cmd, $output, $exitCode);

        if ($exitCode !== 0) {
            throw new \RuntimeException('Tesseract exited with code ' . $exitCode . ': ' . implode("\n", $output));
        }

        return implode("\n", $output);
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
    private function parse(string $raw): array
    {
        $lines = array_map('trim', explode("\n", $raw));
        $result = [
            'raw'         => $raw,
            'name'        => '',
            'nik'         => '',
            'birth_place' => '',
            'birth_date'  => '',
            'gender'      => '',
            'address'     => '',
        ];

        $fullText = implode("\n", $lines);

        // --- NIK (16 digits) ---
        if (preg_match('/(\d{16})/', $fullText, $m)) {
            $result['nik'] = $m[1];
        } elseif (preg_match('/NIK[\s:]*(\d[\d\s]{10,20})/i', $fullText, $m)) {
            $cleaned = preg_replace('/\s+/', '', $m[1]);
            if (preg_match('/(\d{16})/', $cleaned, $m2)) {
                $result['nik'] = $m2[1];
            }
        }

        // --- Nama ---
        for ($i = 0; $i < count($lines); $i++) {
            if (preg_match('/^Nama\s*$/i', $lines[$i]) && isset($lines[$i + 1])) {
                $candidate = trim($lines[$i + 1]);
                if ($candidate !== '' && !preg_match('/^\d+$/', $candidate)) {
                    $result['name'] = $candidate;
                    break;
                }
            }
            if (preg_match('/^Nama\s*[:\-\s]\s*(.+)$/i', $lines[$i], $m)) {
                $result['name'] = trim($m[1]);
                break;
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

        // --- Alamat ---
        for ($i = 0; $i < count($lines); $i++) {
            // Inline address: "Alamat : ..."
            if (preg_match('/^Alamat\s*[:\-\s]\s*(.+)$/i', $lines[$i], $m)) {
                $result['address'] = trim($m[1]);
                break;
            }
            // Label on its own line: "Alamat" then address lines below
            if (preg_match('/^Alamat\s*$/i', $lines[$i])) {
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
