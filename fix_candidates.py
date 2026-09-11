import re

with open('app/Services/KtpOcrService.php', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the variants building
old_variants = """        $variants = [
            'original' => $absolutePath,
            'grayscale' => $this->createGrayscale($absolutePath)
        ];"""

new_variants = """        $variants = [
            'original' => $absolutePath,
            'grayscale' => $this->createFilter($absolutePath, 'grayscale'),
            'contrast' => $this->createFilter($absolutePath, 'contrast'),
            'sharpen' => $this->createFilter($absolutePath, 'sharpen')
        ];"""

content = content.replace(old_variants, new_variants)

# Replace scoring logic
old_score = """                // Calculate score
                $data = $extracted['data'];
                $confidences = $extracted['confidences'];
                
                $fieldCount = count(array_filter($data, fn($v) => $v !== ''));
                $avgConf = count($confidences) > 0 ? array_sum($confidences) / count($confidences) : 0;
                $hasNik = ($data['nik'] !== '') ? 10 : 0; // NIK is super important
                
                $score = ($fieldCount * 2) + $hasNik + $avgConf;
                
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestExtracted = $extracted;
                }"""

new_score = """                // Calculate score
                $data = $extracted['data'];
                $confidences = $extracted['confidences'];
                
                $score = 0;
                if ($data['nik'] !== '') $score += 50;
                if ($data['name'] !== '') $score += 20;
                if ($data['birth_date'] !== '') $score += 10;
                if ($data['address'] !== '') $score += 5;
                if ($data['rt_rw'] !== '') $score += 2;
                if ($data['kelurahan_desa'] !== '') $score += 2;
                if ($data['kecamatan'] !== '') $score += 2;
                if ($data['agama'] !== '') $score += 2;
                if ($data['status_perkawinan'] !== '') $score += 2;
                if ($data['job'] !== '') $score += 2;
                if ($data['kewarganegaraan'] !== '') $score += 2;
                
                $avgConf = count($confidences) > 0 ? array_sum($confidences) / count($confidences) : 0;
                $score += $avgConf;
                
                Log::info("KTP OCR SCORE", [
                    'candidate' => $label,
                    'score' => $score,
                    'valid_fields' => count(array_filter($data, fn($v) => $v !== ''))
                ]);
                
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestExtracted = $extracted;
                }"""

content = content.replace(old_score, new_score)

# Replace createGrayscale with createFilter
old_filter = """    private function createGrayscale(string $path): ?string
    {
        if (!extension_loaded('gd')) return null;
        $src = @imagecreatefromstring(@file_get_contents($path));
        if (!$src) return null;
        imagefilter($src, IMG_FILTER_GRAYSCALE);
        $tmp = tempnam(sys_get_temp_dir(), 'ktp_gray_') . '.png';
        imagepng($src, $tmp);
        imagedestroy($src);
        return $tmp;
    }"""

new_filter = """    private function createFilter(string $path, string $type): ?string
    {
        if (!extension_loaded('gd')) return null;
        $src = @imagecreatefromstring(@file_get_contents($path));
        if (!$src) return null;
        
        if ($type === 'grayscale') {
            imagefilter($src, IMG_FILTER_GRAYSCALE);
        } elseif ($type === 'contrast') {
            imagefilter($src, IMG_FILTER_GRAYSCALE);
            imagefilter($src, IMG_FILTER_CONTRAST, -30);
        } elseif ($type === 'sharpen') {
            $matrix = [
                [-1, -1, -1],
                [-1, 16, -1],
                [-1, -1, -1]
            ];
            $divisor = array_sum(array_map('array_sum', $matrix));
            imageconvolution($src, $matrix, $divisor ?: 1, 0);
        }
        
        $tmp = tempnam(sys_get_temp_dir(), 'ktp_' . $type . '_') . '.png';
        imagepng($src, $tmp);
        imagedestroy($src);
        return $tmp;
    }"""

content = content.replace(old_filter, new_filter)

with open('app/Services/KtpOcrService.php', 'w', encoding='utf-8') as f:
    f.write(content)
