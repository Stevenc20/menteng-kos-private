<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class KtpFieldExtractor
{
    private array $boxes = [];

    public function extract(array $ocrData): array
    {
        $this->boxes = $ocrData;
        
        // Calculate centers for all boxes
        foreach ($this->boxes as &$box) {
            $coords = $box['box'];
            $xs = [$coords[0][0], $coords[1][0], $coords[2][0], $coords[3][0]];
            $ys = [$coords[0][1], $coords[1][1], $coords[2][1], $coords[3][1]];
            
            $box['center_x'] = array_sum($xs) / 4;
            $box['center_y'] = array_sum($ys) / 4;
            $box['min_x'] = min($xs);
            $box['max_x'] = max($xs);
            $box['min_y'] = min($ys);
            $box['max_y'] = max($ys);
            $box['height'] = $box['max_y'] - $box['min_y'];
        }

        $result = [
            'name' => '',
            'nik' => '',
            'birth_place' => '',
            'birth_date' => '',
            'gender' => '',
            'blood_type' => '',
            'address' => '',
            'rt_rw' => '',
            'village' => '',
            'district' => '',
            'religion' => '',
            'marital_status' => '',
            'occupation' => '',
            'nationality' => ''
        ];

        $confidences = [];

        // NIK is special
        $nikData = $this->extractNik();
        if ($nikData) {
            $result['nik'] = $nikData['value'];
            $confidences['nik'] = $nikData['confidence'];
        }

        // Standard fields
        $mappings = [
            'name' => ['regex' => '/^N[aA][rmn][aAuo]/i', 'clean' => 'text'],
            'birth_place' => ['regex' => '/(?:T[eE]mp[aA]t|L[aA]h[iI]r|Tgl)/i', 'clean' => 'birth_place'],
            'birth_date' => ['regex' => '/(?:T[eE]mp[aA]t|L[aA]h[iI]r|Tgl)/i', 'clean' => 'birth_date'],
            'gender' => ['regex' => '/Jenis\s*Kelamin|Kelamin/i', 'clean' => 'gender'],
            'blood_type' => ['regex' => '/Gol\.\s*Darah|Darah/i', 'clean' => 'blood_type'],
            'address' => ['regex' => '/Alamat/i', 'clean' => 'text'],
            'rt_rw' => ['regex' => '/RT\/?RW/i', 'clean' => 'text'],
            'village' => ['regex' => '/Kel\/Desa|Kelurahan/i', 'clean' => 'text'],
            'district' => ['regex' => '/Kecamatan/i', 'clean' => 'text'],
            'religion' => ['regex' => '/Agama/i', 'clean' => 'text'],
            'marital_status' => ['regex' => '/Status\s*Perkawinan|Perkawinan/i', 'clean' => 'text'],
            'occupation' => ['regex' => '/Pekerjaan/i', 'clean' => 'text'],
            'nationality' => ['regex' => '/Kewarganegaraan/i', 'clean' => 'text'],
        ];

        foreach ($mappings as $key => $mapping) {
            if ($key === 'nik') continue;
            
            $fieldData = $this->findFieldByLabel($mapping['regex'], $mapping['clean'], $key);
            if ($fieldData) {
                $result[$key] = $fieldData['value'];
                $confidences[$key] = $fieldData['confidence'];
            }
        }

        $final = ['data' => $result, 'confidences' => $confidences];
        Log::info('KTP Field Extractor completed', $final);
        return $final;
    }

    private function findFieldByLabel(string $labelRegex, string $cleanType, string $key): ?array
    {
        $labelBox = null;
        foreach ($this->boxes as $box) {
            if (preg_match($labelRegex, $box['text'])) {
                $labelBox = $box;
                break;
            }
        }

if (!$labelBox) {
            return null;
        }

        $valueBox = null;
        $minDist = 999999;
        
        if (str_contains($labelBox['text'], ':') || preg_match('/:\s*(.+)$/', $labelBox['text'])) {
            $parts = explode(':', $labelBox['text'], 2);
            if (count($parts) == 2 && trim($parts[1]) !== '') {
                $val = trim($parts[1]);
                return $this->processValue($val, $labelBox['confidence'], $cleanType);
            }
        } else {
// Try to strip the label itself using the regex
            $val = trim(preg_replace($labelRegex, '', $labelBox['text']));
            // Sisa teks yang MASIH mengandung kata label (mis. "Tempat/Tgl Lahir"
            // hanya terpotong "Tempat" menjadi "/Tgl Lahir") bukan nilai field —
            // lanjut ke pencarian box tetangga.
if ($val !== '' && $val !== $labelBox['text'] && !preg_match($labelRegex, $val)) {
                $val = preg_replace('/^[^A-Za-z0-9]+/', '', $val);
                if ($val !== '') {
                    return $this->processValue($val, $labelBox['confidence'], $cleanType);
                }
            }
        }

foreach ($this->boxes as $box) {
            if ($box === $labelBox) continue;
            
            // Box PaddleOCR asli sering miring (quad), sehingga center_y meleset
            // dari baris label walau sebenarnya satu baris. Pakai overlap/rapat
            // vertikal (toleransi 2px) sebagai pengganti pusat baris.
            if ($this->sameRow($box, $labelBox, 2)) {
                if ($box['min_x'] > $labelBox['min_x']) {
                    $dist = $box['min_x'] - $labelBox['max_x'];
                    if ($dist > -20 && $dist < $minDist) {
                        $minDist = $dist;
                        $valueBox = $box;
                    }
                }
            }
        }

        if ($key === 'address') {
            $addressLines = [];
            if ($valueBox) {
                // If there's text right next to 'Alamat', keep it
                $addressLines[] = preg_replace('/^[\s:\-\|\.]+/', '', $valueBox['text']);
            }
            
            // Now find everything below the label and value, but stop when encountering other fields like RT/RW
            $addressYStart = $labelBox['max_y'];
            $addressYEnd = $labelBox['max_y'] + $labelBox['height'] * 4; // allow up to 4 lines
            
            $collectedBoxes = [];
            foreach ($this->boxes as $box) {
                if ($box === $labelBox || $box === $valueBox) continue;
                if ($box['center_y'] > $addressYStart && $box['center_y'] < $addressYEnd) {
// Berhenti hanya pada LABEL field lain (teks pendek, tanpa digit)
                // — "RT 001/RW 002, JL. ..." berisi digit dan bagian dari alamat.
                if (preg_match('/(RT\/?RW|Kel\/Desa|Kelurahan|Kecamatan|Agama)/i', $box['text'])
                    && !preg_match('/\d/', $box['text'])
                    && strlen($box['text']) <= 12) {
                        // Adjust YEnd to stop before this label
                        $addressYEnd = min($addressYEnd, $box['min_y']);
                        continue;
                    }
                    if ($box['center_y'] < $addressYEnd) {
                        $collectedBoxes[] = $box;
                    }
                }
            }
            
            // Sort collected boxes by Y first (lines), then X
            usort($collectedBoxes, function($a, $b) {
                if (abs($a['center_y'] - $b['center_y']) > 10) {
                    return $a['center_y'] <=> $b['center_y'];
                }
                return $a['min_x'] <=> $b['min_x'];
            });
            
            foreach ($collectedBoxes as $box) {
                $addressLines[] = preg_replace('/^[\s:\-\|\.]+/', '', $box['text']);
            }
            
            if (!empty($addressLines)) {
                $val = implode(' ', $addressLines);
                return $this->processValue($val, 0.9, $cleanType);
            }
            return null;
        }

if ($valueBox) {
            $val = $valueBox['text'];
            $val = preg_replace('/^[\s:\-\|\.]+/', '', $val);
            return $this->processValue($val, $valueBox['confidence'], $cleanType);
        }

        return null;
    }

    private function processValue(string $val, float $conf, string $type): ?array
    {
        $val = trim($val);
        if ($val === '') return null;

        if ($type === 'text') {
            $val = preg_replace('/^[^A-Za-z0-9]+/', '', $val);
            if (strlen($val) < 2) return null;
            return ['value' => $val, 'confidence' => $conf];
        }

        if ($type === 'gender') {
            if (preg_match('/LAK/i', $val)) return ['value' => 'LAKI-LAKI', 'confidence' => $conf];
            if (preg_match('/PEREM/i', $val)) return ['value' => 'PEREMPUAN', 'confidence' => $conf];
            return null;
        }

if ($type === 'blood_type') {
            $val = str_replace('0', 'O', $val);
            $val = preg_replace('/[^ABO\-]/i', '', $val);
            if (in_array(strtoupper($val), ['A', 'B', 'AB', 'O', '-'])) {
                return ['value' => strtoupper($val), 'confidence' => $conf];
            }
            return null;
        }

if ($type === 'birth_place') {
            // JANGAN substitusi O/I/l di nama tempat — huruf bisa ikut berubah
            // (BEKASI → BEKAS1). Ambil nama kota hanya, tidak tanggal.
            if (preg_match('/([A-Za-z][A-Za-z\s\-]*)[,\.]?\s*\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}/i', $val, $m)) {
                return ['value' => trim($m[1]), 'confidence' => $conf];
            }
            if (preg_match('/^[A-Za-z][A-Za-z\s\-]*$/', $val)) {
                return ['value' => trim($val), 'confidence' => $conf];
            }
            return null;
        }

        if ($type === 'birth_date') {
            // Hanya digit tanggal yang dinormalisasi (O→0, I→1, l→1).
            $clean = str_replace(['O', 'l', 'I'], ['0', '1', '1'], $val);
            if (preg_match('/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/', $clean, $m)) {
                return ['value' => sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]), 'confidence' => $conf];
            }
            return null;
        }

        return null;
    }

    private function extractNik(): ?array
    {
        $labelBox = null;
        foreach ($this->boxes as $box) {
            if (preg_match('/N[I1l|][Kk]/i', $box['text'])) {
                $labelBox = $box;
                break;
            }
        }

        if ($labelBox) {
            if (preg_match('/:\s*([A-Z0-9\s]+)$/', $labelBox['text'], $m)) {
                $nik = $this->cleanNik($m[1]);
                if (strlen($nik) === 16 && $labelBox['confidence'] > 0.8) {
                    return ['value' => $nik, 'confidence' => $labelBox['confidence']];
                }
            }

$tolerance = 0;
            foreach ($this->boxes as $box) {
                if ($box === $labelBox) continue;
                if ($this->sameRow($box, $labelBox, 3)) {
                    if ($box['min_x'] > $labelBox['min_x']) {
                        $nik = $this->cleanNik($box['text']);
                        if (strlen($nik) === 16 && $box['confidence'] > 0.8) {
                            return ['value' => $nik, 'confidence' => $box['confidence']];
                        }
                    }
                }
            }
        }

        foreach ($this->boxes as $box) {
            $nik = $this->cleanNik($box['text']);
            if (strlen($nik) === 16 && $box['confidence'] > 0.8) {
                return ['value' => $nik, 'confidence' => $box['confidence']];
            }
        }
        
        return null;
    }

private function cleanNik(string $value): string
    {
        $value = strtoupper($value);
        $value = preg_replace('/^[^0-9A-Z]+/', '', $value);
        $value = str_replace(['O', 'I', 'l', 'S', 'B'], ['0', '1', '1', '5', '8'], $value);
        return preg_replace('/[^0-9]/', '', $value);
    }

    private function sameRow(array $a, array $b, int $maxGap = 2): bool
    {
        $gap = max($a['min_y'], $b['min_y']) - min($a['max_y'], $b['max_y']);
        return $gap <= $maxGap;
    }
}
