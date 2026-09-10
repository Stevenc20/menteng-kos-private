<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class KtpFieldExtractor
{
    private array $boxes = [];
    private array $mappingLog = [];

    private const ANCHORS = [
        'nik' => ['nik'],
        'name' => ['nama', 'nome'],
        'place' => ['tempat'],
        'birth' => ['tempat tgl lahir', 'tgl lahir', 'tanggal lahir', 'tempat tgl',
                     'tempat tg lahir', 'tempat tg', 'tempat lahir'],
        'gender' => ['jenis kelamin'],
        'blood_type' => ['gol darah', 'gol. darah'],
        'address' => ['alamat', 'alamar'],
        'rt_rw' => ['rt rw', 'rt/rw'],
        'village' => ['kel desa', 'kelurahan', 'desa', 'ke/desa', 'kevdesa'],
        'district' => ['kecamatan'],
        'religion' => ['agama'],
        'marital_status' => ['status perkawinan'],
        'occupation' => ['pekerjaan'],
        'nationality' => ['kewarganegaraan'],
    ];

    public function extract(array $ocrData): array
    {
        $this->boxes = $ocrData;
        $this->mappingLog = [];

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
        unset($box);

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
            'nationality' => '',
        ];
        $confidences = [];

        $this->apply($result, $confidences, 'nik', $this->extractNik());

        $this->apply($result, $confidences, 'name', $this->extractByAnchor('name', 'name'));

        [$place, $date, $birthConf] = $this->extractBirth();
        if ($place !== null) {
            $result['birth_place'] = $place;
            $confidences['birth_place'] = $birthConf ?? 0.5;
        }
        if ($date !== null) {
            $result['birth_date'] = $date;
            $confidences['birth_date'] = $birthConf ?? 0.5;
        }

        $this->apply($result, $confidences, 'gender', $this->extractByAnchor('gender', 'gender'));
        $this->apply($result, $confidences, 'blood_type', $this->extractByAnchor('blood_type', 'blood_type'));
        $this->apply($result, $confidences, 'address', $this->extractAddress());
        $this->apply($result, $confidences, 'rt_rw', $this->extractByAnchor('rt_rw', 'text'));
        $this->apply($result, $confidences, 'village', $this->extractByAnchor('village', 'text'));
        $this->apply($result, $confidences, 'district', $this->extractByAnchor('district', 'text'));
        $this->apply($result, $confidences, 'religion', $this->extractByAnchor('religion', 'text'));
        $this->apply($result, $confidences, 'marital_status', $this->extractByAnchor('marital_status', 'text'));
        $this->apply($result, $confidences, 'occupation', $this->extractByAnchor('occupation', 'occupation'));
        $this->apply($result, $confidences, 'nationality', $this->extractByAnchor('nationality', 'text'));

        Log::info('KTP FIELD MAPPING DEBUG', $this->mappingLog);
        Log::info('KTP Field Extractor completed', ['data' => $result, 'confidences' => $confidences]);

        return ['data' => $result, 'confidences' => $confidences];
    }

    private function apply(array &$result, array &$confidences, string $key, ?array $parsed): void
    {
        if (!$parsed) return;
        $result[$key] = $parsed['value'];
        $confidences[$key] = $parsed['confidence'];
    }

    private function findAnchor(string $key): ?array
    {
        foreach ($this->boxes as $box) {
            $norm = $this->normalizeText($box['text']);
            foreach (self::ANCHORS[$key] as $phrase) {
                if (str_contains($norm, $phrase)) {
                    return $box;
                }
            }
        }
        return null;
    }

    private function valueRightOf(array $anchor): ?array
    {
        $cands = $this->candidatesRightOf($anchor);
        return $cands[0] ?? null;
    }

    private function candidatesRightOf(array $anchor): array
    {
        $raw = $anchor['text'];
        $candidates = [];

        if (preg_match('/:\s*(.+)$/i', $raw, $m)) {
            $v = trim($m[1]);
            $v = preg_replace('/^[^A-Za-z0-9]+/', '', $v);
            if ($v !== '' && !$this->looksLikeLabelFragment($v)) {
                $candidates[] = ['text' => $v, 'confidence' => $anchor['confidence'], 'box' => $anchor['box']];
            }
        }

        $neighbors = [];
        foreach ($this->boxes as $box) {
            if ($box === $anchor) continue;
            if (!$this->sameRow($box, $anchor, 2)) continue;
            if ($box['min_x'] <= $anchor['max_x']) continue;
            if ($this->looksLikeLabelFragment($box['text'])) continue;
            $dist = $box['min_x'] - $anchor['max_x'];
            if ($dist < 700) {
                $neighbors[] = $box;
            }
        }
        usort($neighbors, fn($a, $b) => $a['min_x'] <=> $b['min_x']);
        foreach ($neighbors as $box) {
            $candidates[] = ['text' => $box['text'], 'confidence' => $box['confidence'], 'box' => $box['box']];
        }

        $rest = trim(preg_replace('/^.+?\s{2,}/', '', $raw));
        if ($rest !== '' && $rest !== $raw) {
            $rest = preg_replace('/^[^A-Za-z0-9]+/', '', $rest);
            if ($rest !== '' && !$this->looksLikeLabelFragment($rest)) {
                $candidates[] = ['text' => $rest, 'confidence' => $anchor['confidence'], 'box' => $anchor['box']];
            }
        }

        return $candidates;
    }

    private function extractByAnchor(string $key, string $cleanType): ?array
    {
        $anchor = $this->findAnchor($key);
        if (!$anchor) {
            $this->logReject($key, 'label tidak ditemukan', null, null);
            return null;
        }

        $candidates = $this->candidatesRightOf($anchor);
        if (empty($candidates)) {
            $this->logReject($key, 'nilai tidak ditemukan (bukan di kanan label sebaris)', $anchor, null);
            return null;
        }

        foreach ($candidates as $value) {
            $parsed = $this->processValue($value['text'], $value['confidence'], $cleanType);
            if ($parsed) {
                $this->mappingLog[] = [
                    'field' => $key,
                    'label' => $anchor['text'],
                    'label_bbox' => $anchor['box'],
                    'candidate' => $parsed['value'],
                    'candidate_bbox' => $value['box'],
                    'accepted' => true,
                ];
                return $parsed;
            }
            $this->mappingLog[] = [
                'field' => $key,
                'label' => $anchor['text'],
                'label_bbox' => $anchor['box'],
                'candidate' => $value['text'],
                'candidate_bbox' => $value['box'],
                'accepted' => false,
                'reason' => 'validasi gagal ('.$cleanType.')',
            ];
        }

        $this->logReject($key, 'semua kandidat gagal validasi', $anchor, null);
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
                    $this->logAcceptNik($labelBox, $nik);
                    return ['value' => $nik, 'confidence' => $labelBox['confidence']];
                }
            }

            foreach ($this->boxes as $box) {
                if ($box === $labelBox) continue;
                if ($this->sameRow($box, $labelBox, 3)) {
                    if ($box['min_x'] > $labelBox['min_x']) {
                        $nik = $this->cleanNik($box['text']);
                        if (strlen($nik) === 16 && $box['confidence'] > 0.8) {
                            $this->logAcceptNik($labelBox, $nik);
                            return ['value' => $nik, 'confidence' => $box['confidence']];
                        }
                    }
                }
            }
        }

        foreach ($this->boxes as $box) {
            $nik = $this->cleanNik($box['text']);
            if (strlen($nik) === 16 && $box['confidence'] > 0.8) {
                $this->logAcceptNik($labelBox, $nik, 'fallback global');
                return ['value' => $nik, 'confidence' => $box['confidence']];
            }
        }

        $this->logReject('nik', 'NIK tidak ditemukan / bukan 16 digit', $labelBox, null);
        return null;
    }

    private function extractBirth(): array
    {
        $combined = $this->findAnchor('birth');
        $place = null;
        $date = null;
        $conf = null;

        if ($combined) {
            $candidates = $this->candidatesRightOf($combined);
            foreach ($candidates as $value) {
                $parsed = $this->parseBirthValue($value['text']);
                if ($parsed) {
                    $place = $parsed['place'];
                    $date = $parsed['date'];
                    $conf = $value['confidence'];
                    $this->mappingLog[] = [
                        'field' => 'birth',
                        'label' => $combined['text'],
                        'label_bbox' => $combined['box'],
                        'candidate' => $value['text'],
                        'candidate_bbox' => $value['box'],
                        'accepted' => true,
                        'birth_place' => $place,
                        'birth_date' => $date,
                    ];
                    return [$place, $date, $conf];
                }
            }
        }

        $placeAnchor = isset($combined) ? null : $this->findAnchor('place');
        if (!$place && $placeAnchor) {
            $candidates = $this->candidatesRightOf($placeAnchor);
            foreach ($candidates as $value) {
                $parsed = $this->parseBirthValue($value['text']);
                if ($parsed) {
                    $place = $parsed['place'] ?? null;
                    $date = $parsed['date'] ?? $date;
                    $conf = $value['confidence'];
                    break;
                }
            }
        }

        if ($place === null && $date === null) {
            $this->logReject('birth', 'nilai TTL tidak ditemukan / bukan format tanggal', $combined, null);
            return [null, null, null];
        }

        $this->mappingLog[] = [
            'field' => 'birth',
            'label' => $combined ? $combined['text'] : ($placeAnchor ? $placeAnchor['text'] : ''),
            'label_bbox' => $combined ? $combined['box'] : ($placeAnchor ? $placeAnchor['box'] : []),
            'candidate' => trim(($place ?? '') . ' ' . ($date ?? '')),
            'candidate_bbox' => $combined ? $combined['box'] : [],
            'accepted' => true,
            'birth_place' => $place,
            'birth_date' => $date,
        ];

        return [$place, $date, $conf];
    }

    private function parseBirthValue(string $val): ?array
    {
        $val = preg_replace('/^[^A-Za-z0-9]+/', '', trim($val));
        $val = preg_replace('/(\d{2})[\/\-\.](?=\d)/', '$1-', $val);

        $place = null;
        $date = null;

        if (preg_match('/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/', $val, $m)) {
            $dd = str_replace(['O', 'I', 'l', 'S', 'B'], ['0', '1', '1', '5', '8'], $m[1]);
            $mm = str_replace(['O', 'I', 'l', 'S', 'B'], ['0', '1', '1', '5', '8'], $m[2]);
            $yyyy = str_replace(['O', 'I', 'l', 'S', 'B'], ['0', '1', '1', '5', '8'], $m[3]);
            if (checkdate((int) $mm, (int) $dd, (int) $yyyy)) {
                $date = sprintf('%04d-%02d-%02d', (int) $yyyy, (int) $mm, (int) $dd);
            }
            $cut = strpos($val, $m[0]);
            if ($cut !== false) {
                $prefix = trim(substr($val, 0, $cut));
                $prefix = rtrim($prefix, ',:| -.');
                $place = $this->cleanBirthPlace($prefix);
            }
        } else {
            $date = null;
        }

        if ($place === null && $date === null) return null;
        return ['place' => $place, 'date' => $date];
    }

    private function cleanBirthPlace(string $p): ?string
    {
        $p = trim($p);
        $p = preg_replace('/^[^A-Za-z]+/', '', $p);
        $p = rtrim($p, '.,:; ');
        if ($p === '' ) return null;
        if ($this->looksLikeLabelFragment($p)) return null;
        if (preg_match('/\d/', $p)) return null;
        if ($p === '') return null;
        if (!preg_match('/^[A-Za-z][A-Za-z\s.\-\']*$/', $p)) return null;
        if (mb_strlen($p) < 3) return null;
        return $p;
    }

    private function extractAddress(): ?array
    {
        $anchor = $this->findAnchor('address');
        if (!$anchor) {
            $this->logReject('address', 'label tidak ditemukan', null, null);
            return null;
        }

        $lines = [];
        $value = $this->valueRightOf($anchor);
        if ($value) {
            $lines[] = preg_replace('/^[\s:\-\|\.]+/', '', $value['text']);
        }

        $yStart = $anchor['max_y'];
        $yEnd = $anchor['max_y'] + $anchor['height'] * 4;
        $collected = [];

        foreach ($this->boxes as $box) {
            if ($box === $anchor) continue;
            if ($value && isset($box['box']) && $value['box'] && $box['box'] === $value['box']) continue;
            if ($box['center_y'] <= $yStart || $box['center_y'] >= $yEnd) continue;
            if ($this->isLabelRow($box)) {
                $yEnd = min($yEnd, $box['min_y']);
                continue;
            }
            $collected[] = $box;
        }

        usort($collected, function ($a, $b) {
            if (abs($a['center_y'] - $b['center_y']) > 10) {
                return $a['center_y'] <=> $b['center_y'];
            }
            return $a['min_x'] <=> $b['min_x'];
        });

        foreach ($collected as $box) {
            $lines[] = preg_replace('/^[\s:\-\|\.]+/', '', $box['text']);
        }

        if (empty($lines)) {
            $this->logReject('address', 'nilai tidak ditemukan', $anchor, null);
            return null;
        }

        $addr = implode(' ', array_filter($lines, fn($l) => trim($l) !== ''));
        if (mb_strlen(trim($addr)) < 2) return null;

        $this->mappingLog[] = [
            'field' => 'address',
            'label' => $anchor['text'],
            'label_bbox' => $anchor['box'],
            'candidate' => $addr,
            'candidate_bbox' => ($value['box'] ?? $anchor['box']),
            'accepted' => true,
        ];

        return ['value' => $addr, 'confidence' => 0.9];
    }

    private function isLabelRow(array $box): bool
    {
        if ($this->looksLikeLabelFragment($box['text'])) return true;
        $norm = $this->normalizeText($box['text']);
        foreach (self::ANCHORS as $key => $phrases) {
            if (in_array($key, ['address', 'nik', 'name', 'birth', 'place'], true)) continue;
            foreach ($phrases as $phrase) {
                if (str_contains($norm, $phrase)) return true;
            }
        }
        return false;
    }

    private function processValue(string $val, float $conf, string $type): ?array
    {
        $val = trim($val);
        if ($val === '') return null;

        if ($type === 'name') {
            $val = preg_replace('/^[^A-Za-z.]+/', '', $val);
            if ($val === '') return null;
            if (preg_match('/[0-9]/', $val)) return null;
            if (preg_match('/(\d{1,4})[\/\-\. ](\d{1,4})/', $val)) return null;
            if (preg_match('/Tempat|Tgl|Lahir|Kelamin|Darah|Gol\.?\s*Darah|Pekerjaan|Status|Perkawinan|Kewarganegaraan|Agama|Alamat|Kecamatan|Kel\/Desa|Kelurahan|RT\/?RW|NIK|Jenis|Provinsi|Kota/i', $val)) return null;
            if ($this->looksLikeLabelFragment($val)) return null;
            $words = preg_split('/\s+/', $val, -1, PREG_SPLIT_NO_EMPTY);
            if (count($words) === 0) return null;
            foreach ($words as $w) {
                if (!preg_match('/^[A-Za-z.\-\']+$/', $w)) return null;
                if (strlen($w) < 3) return null;
            }
            return ['value' => $val, 'confidence' => $conf];
        }

        if ($type === 'text') {
            $val = preg_replace('/^[^A-Za-z0-9]+/', '', $val);
            if (strlen($val) < 2) return null;
            if ($this->looksLikeLabelFragment($val)) return null;
            return ['value' => $val, 'confidence' => $conf];
        }

        if ($type === 'occupation') {
            $val = preg_replace('/^[^A-Za-z0-9]+/', '', $val);
            if (strlen($val) < 2) return null;
            if ($this->looksLikeLabelFragment($val)) return null;
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

        return null;
    }

    private function cleanNik(string $value): string
    {
        $value = strtoupper($value);
        $value = preg_replace('/^[^0-9A-Z]+/', '', $value);
        $value = str_replace(['O', 'I', 'l', 'S', 'B'], ['0', '1', '1', '5', '8'], $value);
        return preg_replace('/[^0-9]/', '', $value);
    }

    private function normalizeText(string $t): string
    {
        $t = strtolower(trim($t));
        $t = str_replace('/', ' ', $t);
        $t = preg_replace("/[\"':\|\-_*]+/", ' ', $t);
        $t = preg_replace('/\s+/', ' ', $t);
        return trim($t);
    }

    private function looksLikeLabelFragment(string $t): bool
    {
        $bare = preg_replace('/[^a-z0-9]/', '', $this->normalizeText($t));
        if ($bare === '') return true;
        if (preg_match(
            '/^(tg|tgl|lahr|lahir|tempat|kelamin|darah|gol|status|perkawinan|kewarganegaraan|agama|alamat|kecamatan|kel|desa|rukun|rt|rw|jenis|pekerjaan|nik|provinsi|kota|nama)$/',
            $bare
        )) {
            return true;
        }
        return false;
    }

    private function sameRow(array $a, array $b, int $maxGap = 2): bool
    {
        $gap = max($a['min_y'], $b['min_y']) - min($a['max_y'], $b['max_y']);
        return $gap <= $maxGap;
    }

    private function logReject(string $field, string $reason, ?array $anchor, ?array $candidate): void
    {
        $this->mappingLog[] = [
            'field' => $field,
            'label' => $anchor['text'] ?? null,
            'label_bbox' => $anchor['box'] ?? null,
            'candidate' => $candidate['text'] ?? null,
            'candidate_bbox' => $candidate['box'] ?? null,
            'accepted' => false,
            'reason' => $reason,
        ];
    }

    private function logAcceptNik(?array $labelBox, string $nik, string $mode = 'label/value'): void
    {
        $this->mappingLog[] = [
            'field' => 'nik',
            'label' => $labelBox['text'] ?? null,
            'label_bbox' => $labelBox['box'] ?? null,
            'candidate' => $nik,
            'accepted' => true,
            'mode' => $mode,
        ];
    }
}