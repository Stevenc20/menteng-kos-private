<?php

namespace App\Services;

/**
 * Mendeteksi kartu KTP di dalam foto kamera HP (bukan meng-OCR seluruh gambar)
 * lalu meluruskan + memotong area kartu. Murni PHP + GD — tanpa OpenCV.
 *
 * Strategi:
 *  1. Downscale foto (untuk kecepatan) + grayscale.
 *  2. Otsu threshold → peta biner (latar kartu putih terang = foreground).
 *  3. Connected components (8-connectivity) → cari area terang terbesar
 *     yang bentuknya mendekati rasio kartu ID-1 (1.586).
 *  4. Ambil 4 sudut dari ekstrem diagonal komponen.
 *  5. Perspective correction via pemetaan bilinear quad → persegi panjang.
 */
class KtpCardDetector
{
    public const CARD_ASPECT = 1.586; // 85.60 / 53.98 (ISO/IEC 7810 ID-1)

    private int $maxDim = 560;

    /**
     * Cari area kartu KTP dalam foto.
     *
     * @return array{
     *     bbox: array{0:int,1:int,2:int,3:int},
     *     corners: array<int, array{0:int,1:int}>,
     *     aspect: float,
     *     scale: float,
     * }|null null bila GD tidak tersedia atau kartu tidak ditemukan.
     */
    public function detect(string $path): ?array
    {
        if (!extension_loaded('gd')) {
            return null;
        }

        $src = @imagecreatefromstring(@file_get_contents($path));
        if (!$src) {
            return null;
        }

        $w = imagesx($src);
        $h = imagesy($src);
        if ($w < 1 || $h < 1) {
            imagedestroy($src);
            return null;
        }

        $scale = $this->maxDim / max($w, $h);
        $dw = max(8, (int) round($w * $scale));
        $dh = max(8, (int) round($h * $scale));

        $small = imagecreatetruecolor($dw, $dh);
        imagecopyresampled($small, $src, 0, 0, 0, 0, $dw, $dh, $w, $h);
        imagefilter($small, IMG_FILTER_GRAYSCALE);

        $threshold = $this->otsuThreshold($small, $dw, $dh);
        $binary = $this->binarizeToString($small, $dw, $dh, $threshold);
        $components = $this->connectedComponents($binary, $dw, $dh);

        imagedestroy($src);
        imagedestroy($small);

        $card = $this->pickCard($components, $dw * $dh);
        if ($card === null) {
            return null;
        }

        $cw = $card['maxx'] - $card['minx'] + 1;
        $ch = $card['maxy'] - $card['miny'] + 1;

        // Koordinat asli = koordinat kecil / scale; kunci sudut pakai ekstrem diagonal.
        $toOrig = static fn (int $p): array => [
            (int) round(($p % $dw) / $scale),
            (int) round(intdiv($p, $dw) / $scale),
        ];

        return [
            'bbox' => [
                (int) round($card['minx'] / $scale),
                (int) round($card['miny'] / $scale),
                (int) round($cw / $scale),
                (int) round($ch / $scale),
            ],
            'corners' => [
                $toOrig($card['tl']), // top-left
                $toOrig($card['tr']), // top-right
                $toOrig($card['br']), // bottom-right
                $toOrig($card['bl']), // bottom-left
            ],
            'aspect' => $ch > 0 ? $cw / $ch : 0.0,
            'scale' => $scale,
        ];
    }

    /**
     * Potong + luruskan area kartu hasil detect() ke PNG sementara.
     * Pemetaan bilinear quad→rect (mendekati perspective correction).
     */
    public function warp(string $path, array $corners, int $outW = 1200, int $outH = 756): ?string
    {
        if (!extension_loaded('gd')) {
            return null;
        }

        $src = @imagecreatefromstring(@file_get_contents($path));
        if (!$src) {
            return null;
        }

        $sw = max(1, imagesx($src));
        $sh = max(1, imagesy($src));

        [$tl, $tr, $br, $bl] = $corners;

        $dst = imagecreatetruecolor($outW, $outH);
        imagefilledrectangle($dst, 0, 0, $outW, $outH, 0xFFFFFF);

        $lastRow = $outH - 1;
        $lastCol = $outW - 1;

        for ($j = 0; $j < $outH; $j++) {
            $v = $lastRow > 0 ? $j / $lastRow : 0;
            // Lerp horizontal antar ujung-ujung quad untuk baris ini
            $inv = 1 - $v;
            for ($i = 0; $i < $outW; $i++) {
                $u = $lastCol > 0 ? $i / $lastCol : 0;
                $sx = $inv * ($tl[0] * (1 - $u) + $tr[0] * $u)
                    + $v * ($bl[0] * (1 - $u) + $br[0] * $u);
                $sy = $inv * ($tl[1] * (1 - $u) + $tr[1] * $u)
                    + $v * ($bl[1] * (1 - $u) + $br[1] * $u);

                $x0 = (int) floor($sx);
                $y0 = (int) floor($sy);
                $fx = $sx - $x0;
                $fy = $sy - $y0;
                $x0 = max(0, min($x0, $sw - 1));
                $y0 = max(0, min($y0, $sh - 1));
                $x1 = min($x0 + 1, $sw - 1);
                $y1 = min($y0 + 1, $sh - 1);

                $c00 = imagecolorat($src, $x0, $y0);
                $c10 = imagecolorat($src, $x1, $y0);
                $c01 = imagecolorat($src, $x0, $y1);
                $c11 = imagecolorat($src, $x1, $y1);

                $r = (int) round(
                    ($c00 >> 16 & 0xFF) * (1 - $fx) * (1 - $fy)
                    + ($c10 >> 16 & 0xFF) * $fx * (1 - $fy)
                    + ($c01 >> 16 & 0xFF) * (1 - $fx) * $fy
                    + ($c11 >> 16 & 0xFF) * $fx * $fy
                );
                $g = (int) round(
                    ($c00 >> 8 & 0xFF) * (1 - $fx) * (1 - $fy)
                    + ($c10 >> 8 & 0xFF) * $fx * (1 - $fy)
                    + ($c01 >> 8 & 0xFF) * (1 - $fx) * $fy
                    + ($c11 >> 8 & 0xFF) * $fx * $fy
                );
                $b = (int) round(
                    ($c00 & 0xFF) * (1 - $fx) * (1 - $fy)
                    + ($c10 & 0xFF) * $fx * (1 - $fy)
                    + ($c01 & 0xFF) * (1 - $fx) * $fy
                    + ($c11 & 0xFF) * $fx * $fy
                );

                imagesetpixel($dst, $i, $j, ($r << 16) | ($g << 8) | $b);
            }
        }

        $tmp = tempnam(sys_get_temp_dir(), 'ktp_crop_') . '.png';
        imagepng($dst, $tmp);

        imagedestroy($src);
        imagedestroy($dst);

        return $tmp;
    }

    private function otsuThreshold($img, int $w, int $h): int
    {
        $hist = array_fill(0, 256, 0);
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $rgb = imagecolorat($img, $x, $y);
                $g = (int) round(
                    0.299 * ($rgb >> 16 & 0xFF)
                    + 0.587 * ($rgb >> 8 & 0xFF)
                    + 0.114 * ($rgb & 0xFF)
                );
                $hist[$g]++;
            }
        }

        $total = $w * $h;
        $sum = 0;
        foreach ($hist as $i => $c) {
            $sum += $i * $c;
        }

        $sumB = 0;
        $wB = 0;
        $maxVar = -1.0;
        $threshold = 127;

        for ($t = 0; $t < 256; $t++) {
            $wB += $hist[$t];
            if ($wB === 0) {
                continue;
            }
            $wF = $total - $wB;
            if ($wF === 0) {
                break;
            }
            $sumB += $t * $hist[$t];
            $mB = $sumB / $wB;
            $mF = ($sum - $sumB) / $wF;
            $between = $wB * $wF * ($mB - $mF) * ($mB - $mF);
            if ($between > $maxVar) {
                $maxVar = $between;
                $threshold = $t;
            }
        }

        return $threshold;
    }

    private function binarizeToString($img, int $w, int $h, int $threshold): string
    {
        $b = '';
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $rgb = imagecolorat($img, $x, $y);
                $g = (int) round(
                    0.299 * ($rgb >> 16 & 0xFF)
                    + 0.587 * ($rgb >> 8 & 0xFF)
                    + 0.114 * ($rgb & 0xFF)
                );
                $b .= $g >= $threshold ? "\1" : "\0";
            }
        }
        return $b;
    }

    /**
     * Complete 8-konektivitas + statistika area terang.
     *
     * @return list<array<string, int>>
     */
    private function connectedComponents(string $binary, int $w, int $h): array
    {
        $visited = str_repeat("\0", $w * $h);
        $total = $w * $h;
        $components = [];
        $lastCol = $w - 1;
        $lastRow = $h - 1;

        for ($start = 0; $start < $total; $start++) {
            if ($binary[$start] !== "\1" || $visited[$start] !== "\0") {
                continue;
            }

            $stack = [$start];
            $visited[$start] = "\1";

            $area = 0;
            $minx = PHP_INT_MAX;
            $maxx = -1;
            $miny = PHP_INT_MAX;
            $maxy = -1;
            $tl = $tr = $br = $bl = -1;
            $tlSum = PHP_INT_MAX;
            $trDiff = PHP_INT_MIN;
            $brSum = PHP_INT_MIN;
            $blDiff = PHP_INT_MAX;

            while ($stack) {
                $p = array_pop($stack);
                $x = $p % $w;
                $y = intdiv($p, $w);

                $area++;
                if ($x < $minx) $minx = $x;
                if ($x > $maxx) $maxx = $x;
                if ($y < $miny) $miny = $y;
                if ($y > $maxy) $maxy = $y;

                $sum = $x + $y;
                $diff = $x - $y;
                if ($sum < $tlSum) { $tlSum = $sum; $tl = $p; }
                if ($diff > $trDiff) { $trDiff = $diff; $tr = $p; }
                if ($sum > $brSum) { $brSum = $sum; $br = $p; }
                if ($diff < $blDiff) { $blDiff = $diff; $bl = $p; }

                $nbs = [];
                if ($x > 0) {
                    $nbs[] = $p - 1;
                    if ($y > 0) $nbs[] = $p - $w - 1;
                    if ($y < $lastRow) $nbs[] = $p + $w - 1;
                }
                if ($x < $lastCol) {
                    $nbs[] = $p + 1;
                    if ($y > 0) $nbs[] = $p - $w + 1;
                    if ($y < $lastRow) $nbs[] = $p + $w + 1;
                }
                if ($y > 0) $nbs[] = $p - $w;
                if ($y < $lastRow) $nbs[] = $p + $w;

                foreach ($nbs as $nb) {
                    if ($binary[$nb] === "\1" && $visited[$nb] === "\0") {
                        $visited[$nb] = "\1";
                        $stack[] = $nb;
                    }
                }
            }

            $components[] = [
                'area' => $area,
                'minx' => $minx,
                'maxx' => $maxx,
                'miny' => $miny,
                'maxy' => $maxy,
                'tl' => $tl,
                'tr' => $tr,
                'br' => $br,
                'bl' => $bl,
            ];
        }

        return $components;
    }

    /**
     * Pilih komponen yang paling mirip kartu identitas: luas cukup besar,
     * kepadatan tinggi (bukan blob tidak beraturan), rasio mendekati 1.586.
     *
     * @param list<array<string, int>> $components
     * @return array<string, int>|null
     */
    private function pickCard(array $components, int $imgArea): ?array
    {
        $best = null;
        $bestError = INF;

        foreach ($components as $c) {
            $cw = $c['maxx'] - $c['minx'] + 1;
            $ch = $c['maxy'] - $c['miny'] + 1;
            if ($cw <= 0 || $ch <= 0) {
                continue;
            }

            $areaPct = $c['area'] / $imgArea;
            if ($areaPct < 0.04) {
                continue; // terlalu kecil untuk kartu dalam frame
            }

            $density = $c['area'] / ($cw * $ch);
            if ($density < 0.35) {
                continue; // komponen terlalu jarang/tidak teratur
            }

            $aspect = $cw / $ch;
            if ($aspect < 0.9 || $aspect > 2.4) {
                continue;
            }

            $error = abs(log($aspect / self::CARD_ASPECT));
            if ($error < $bestError) {
                $bestError = $error;
                $best = $c;
            }
        }

        return $best;
    }
}