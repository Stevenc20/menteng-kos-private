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
        $cmd = sprintf('tesseract %s stdout -l ind+eng 2>&1', escapeshellarg($path));
        exec($cmd, $output, $exitCode);

        if ($exitCode !== 0) {
            throw new \RuntimeException('Tesseract exited with code ' . $exitCode . ': ' . implode("\n", $output));
        }

        return implode("\n", $output);
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
                if (isset($lines[$i + 1]) && preg_match('/(.+?),\s*(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})/i', $lines[$i + 1], $m)) {
                    $result['birth_place'] = trim($m[1]);
                    $result['birth_date'] = sprintf('%04d-%02d-%02d', $m[4], $m[3], $m[2]);
                    break;
                }
                if (preg_match('/(.+?),\s*(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})/i', $lines[$i], $m)) {
                    $result['birth_place'] = trim($m[1]);
                    $result['birth_date'] = sprintf('%04d-%02d-%02d', $m[4], $m[3], $m[2]);
                    break;
                }
                if (isset($lines[$i + 1]) && preg_match('/(.+?)\s+(\d{2})(\d{2})(\d{4})/i', $lines[$i + 1], $m)) {
                    $result['birth_place'] = trim($m[1]);
                    $result['birth_date'] = sprintf('%04d-%02d-%02d', $m[4], $m[3], $m[2]);
                    break;
                }
            }
            if (preg_match('/^([A-Z\s]+),\s*(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})$/i', $lines[$i], $m) && $result['birth_place'] === '') {
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
            if (preg_match('/^Alamat\s*$/i', $lines[$i])) {
                $addrLines = [];
                for ($j = $i + 1; $j < count($lines); $j++) {
                    $line = $lines[$j];
                    if (preg_match('/^(RT|RW|Kel|Desa|Kec|Kota|Kab|Provinsi|Agama|Kawin|Pekerjaan|Warganegara|Berlaku|NAma|NIK|Tempat|Jenis|Goldar)/i', $line)) {
                        break;
                    }
                    if ($line !== '') {
                        $addrLines[] = $line;
                    }
                }
                if (!empty($addrLines)) {
                    $result['address'] = implode(', ', $addrLines);
                }
                break;
            }
            if (preg_match('/^Alamat\s*[:\-\s]\s*(.+)$/i', $lines[$i], $m)) {
                $result['address'] = trim($m[1]);
                break;
            }
        }

        return $result;
    }
}
