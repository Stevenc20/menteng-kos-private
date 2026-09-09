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

        $otsu = $this->otsuThreshold($small, $dw, $dh);

        // Cascade threshold: Otsu dulu (kartu penuh frame / latar gelap), lalu
        // naikkan bertahap supaya lantai/pola terang rontok dan menyisakan
        // permukaan kartu (KTP selalu paling terang di foto).
        $candidates = [];
        $thresholds = [];
        foreach ([$otsu, $otsu + 30, 205, 225] as $t) {
            $t = (int) round($t);
            if ($t >= 20 && $t <= 247 && !in_array($t, $thresholds, true)) {
                $thresholds[] = $t;
            }
        }
        sort($thresholds);

        $bestError = INF;
        foreach ($thresholds as $t) {
            $binary = $this->binarizeToString($small, $dw, $dh, $t);
            foreach ($this->connectedComponents($binary, $dw, $dh) as $c) {
                $score = $this->scoreCandidate($c, $dw, $dh);
                if ($score !== null && $score['error'] < $bestError) {
                    $bestError = $score['error'];
                    $card = $c;
                    $threshold = $t;
                }
            }
        }

        imagedestroy($src);
        imagedestroy($small);

        if (!isset($card)) {
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
            'threshold' => $threshold,
        ];
    }

    /**
     * Potong + luruskan area kartu hasil detect() ke PNG sementara.
     * Pemetaan bilinear quad→rect (mendekati perspective correction).
     */
    public function warp(string $path, array $corners, int $outW = 0, int $outH = 0): ?string
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

        // Default: pertahankan resolusi asli kartu (jangan downscale) supaya
        // teks kecil tetap terbaca tesseract. Cap 2200 px demi waktu proses.
        if ($outW <= 0) {
            $pixelW = sqrt(pow($tr[0] - $tl[0], 2) + pow($tr[1] - $tl[1], 2));
            $outW = max(1400, min(2200, (int) round($pixelW * 1.1)));
        }
        if ($outH <= 0) {
            $outH = (int) round($outW / self::CARD_ASPECT);
        }
        $outW = max(2, $outW);
        $outH = max(2, $outH);

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
     * Nilai seberapa mirip komponen dengan kartu identitas. Higher score lower.
     *
     * @param array<string, int> $c
     * @return array{error: float}|null
     */
    private function scoreCandidate(array $c, int $dw, int $dh): ?array
    {
        $cw = $c['maxx'] - $c['minx'] + 1;
        $ch = $c['maxy'] - $c['miny'] + 1;
        if ($cw <= 0 || $ch <= 0) {
            return null;
        }

        $imgArea = $dw * $dh;
        $areaPct = $c['area'] / $imgArea;
        if ($areaPct < 0.01) { // Lebih toleran untuk foto dari jauh (1% area)
            return null;
        }

        $density = $c['area'] / ($cw * $ch);
        if ($density < 0.25) { // Lebih toleran
            return null;
        }

        // Hitung aspect ratio tanpa peduli orientasi potret/landscape (KTP portrait = sama rasio)
        $aspect = max($cw, $ch) / min($cw, $ch);
        if ($aspect < 1.10 || $aspect > 2.5) {
            return null;
        }

        // Komponen yang praktis memenuhi seluruh frame = lantai/gambar latar
        // yang menyatu, BUKAN kartu. Deteksi seperti ini membuat crop = foto
        // asli (tidak berguna). Tolak keras.
        $boxAreaPct = ($cw * $ch) / $imgArea;
        if ($cw >= $dw * 0.90 && $ch >= $dh * 0.90) {
            return null; // Reject >90% width AND height
        }
        if ($boxAreaPct > 0.90) {
            return null; // Reject >90% bounding box area
        }

        $error = abs(log($aspect / self::CARD_ASPECT));

        // Kartu sungguhan biasanya ada di tengah (tidak menyentuh tepi frame).
        $touchesFrame = $c['minx'] === 0 || $c['maxx'] === $dw - 1
            || $c['miny'] === 0 || $c['maxy'] === $dh - 1;
        $error += $touchesFrame ? 0.25 : 0.0;

        // Merged block besar (lantai sisi kartu masih ikut) -> penalti kuat.
        $error += $boxAreaPct > 0.85 ? 0.6 : 0.0;
        $error += $boxAreaPct > 0.75 ? 0.3 : 0.0;

        return ['error' => $error];
    }
}