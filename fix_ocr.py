import re

with open('app/Services/KtpOcrService.php', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Change maxDim
content = content.replace('\ = 2000;', '\ = 1200;')

# 2 & 3. Update preprocessImage and buildVariants
old_pre = '''    private function preprocessImage(string \): ?string
    {
        if (!extension_loaded('gd')) return null;
        \ = @imagecreatefromstring(@file_get_contents(\));
        if (!\) return null;

        imagefilter(\, IMG_FILTER_GRAYSCALE);
        imagefilter(\, IMG_FILTER_CONTRAST, -20); // Increase contrast (negative value)

        \ = tempnam(sys_get_temp_dir(), 'ktp_gray_') . '.png';
        imagepng(\, \);
        imagedestroy(\);

        return \;
    }'''

new_pre = '''    private function preprocessImage(string \, bool \ = false): ?string
    {
        if (!extension_loaded('gd')) return null;
        \ = @imagecreatefromstring(@file_get_contents(\));
        if (!\) return null;

        imagefilter(\, IMG_FILTER_GRAYSCALE);
        if (\) {
            imagefilter(\, IMG_FILTER_CONTRAST, -100); // Max contrast for B&W
        } else {
            imagefilter(\, IMG_FILTER_CONTRAST, -20);
        }

        \ = tempnam(sys_get_temp_dir(), 'ktp_gray_') . '.png';
        imagepng(\, \);
        imagedestroy(\);

        return \;
    }'''

content = content.replace(old_pre, new_pre)

old_build = '''        // Grayscale contrast
        \ = \->preprocessImage(\);
        if (\ !== null) {
            \[] = \;
            \['gray'] = \;
        }'''

new_build = '''        // Grayscale contrast
        \ = \->preprocessImage(\);
        if (\ !== null) {
            \[] = \;
            \['gray'] = \;
        }
        
        // Threshold (B&W)
        \ = \->preprocessImage(\, true);
        if (\ !== null) {
            \[] = \;
            \['bw'] = \;
        }'''

content = content.replace(old_build, new_build)

# 4. Relax Regex in parse()
content = content.replace('/^N[aA][rmn][aAuo]\s*[:\-\s]\s*(.+)$/i', '/(?:^|[^A-Za-z])N[aA][rmn][aAuo]\s*[:\-\s]\s*(.+)$/i')
content = content.replace('/^N[aA][rmn][aAuo]\s*$/i', '/(?:^|[^A-Za-z])N[aA][rmn][aAuo]\s*$/i')

with open('app/Services/KtpOcrService.php', 'w', encoding='utf-8') as f:
    f.write(content)
print('Regex and OCR preprocessing updated.')
