with open('app/Services/KtpOcrService.php', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# Update Nama regex
content = re.sub(
    r"if \(\\\['name'\] === '' && preg_match\('/(?:\(\?:[^']+|)N\[aA\]\[rmn\]\[aAuo\]\\\\s\*\[:\-\\\\s\]\\\\s\*\(\.\+\)\\\$\/i', \\, \\\)\) \{.*?\} elseif \(\\\['name'\] === '' && preg_match\('/(?:\(\?:[^']+|)N\[aA\]\[rmn\]\[aAuo\]\\\\s\*\\\$\/i', \\\) && isset\(\\\[\\ \+ 1\]\)\) \{.*?\}",
    r'''// Nama (Sangat robust)
            if (['name'] === '' && preg_match('/N[aA][rmn][aAuo][\s:\-\|]*(.+)$/i', , )) {
                 = trim(preg_replace('/[^A-Za-z\s\,\.\']/', '', [1]));
                if (strlen() > 2 && stripos(, 'NIK') === false) ['name'] = ;
            } elseif (['name'] === '' && preg_match('/N[aA][rmn][aAuo][\s:\-\|]*$/i', ) && isset([ + 1])) {
                 = trim(preg_replace('/[^A-Za-z\s\,\.\']/', '', [ + 1]));
                if (strlen() > 2 && stripos(, 'NIK') === false) ['name'] = ;
            }''',
    content,
    flags=re.DOTALL
)

# Replace NIK cleaner to allow 4->1 if it's province code (not strictly necessary, but helpful)
old_clean = r''' = str_replace(['O', 'I', 'L', 'S', 'B'], ['0', '1', '1', '5', '8'], );'''
new_clean = r''' = str_replace(['O', 'I', 'L', 'S', 'B'], ['0', '1', '1', '5', '8'], );
        if (str_starts_with(, '45'))  = '15' . substr(, 2);
        if (str_starts_with(, '46'))  = '16' . substr(, 2);'''
content = content.replace(old_clean, new_clean)

# Update Tempat/Tgl Lahir
old_lahir = r'''// Tempat/Tgl Lahir
            if (['birth_place'] === '' && preg_match('/(T[eE]mp[aA]t|Tgl|L[aA]h[iI]r).*?\s*[:\-\s]*\s*(.+)$/i', , )) {
                 = str_replace(['O', 'l', 'I'], ['0', '1', '1'], [2]);
                if (preg_match('/(.+?),\s*(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})/i', , )) {
                    ['birth_place'] = preg_replace('/[^A-Za-z\s\-]/', '', trim([1]));
                    ['birth_date'] = sprintf('%04d-%02d-%02d', [4], [3], [2]);
                }
            } elseif (['birth_place'] === '' && preg_match('/(T[eE]mp[aA]t|Tgl|L[aA]h[iI]r)/i', ) && isset([ + 1])) {
                 = str_replace(['O', 'l', 'I'], ['0', '1', '1'], [ + 1]);
                if (preg_match('/(.+?),\s*(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})/i', , )) {
                    ['birth_place'] = preg_replace('/[^A-Za-z\s\-]/', '', trim([1]));
                    ['birth_date'] = sprintf('%04d-%02d-%02d', [4], [3], [2]);
                }
            }'''

new_lahir = r'''// Tempat/Tgl Lahir
            if (['birth_place'] === '' && preg_match('/(T[eE]mp[aA]t|Tgl|L[aA]h[iI]r).*?[\s:\-\|]*(.+)$/i', , )) {
                 = str_replace(['O', 'l', 'I'], ['0', '1', '1'], [2]);
                if (preg_match('/([A-Za-z\s\-]+)[,\.]?\s*(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})/i', , )) {
                    ['birth_place'] = preg_replace('/[^A-Za-z\s\-]/', '', trim([1]));
                    ['birth_date'] = sprintf('%04d-%02d-%02d', [4], [3], [2]);
                }
            } elseif (['birth_place'] === '' && preg_match('/(T[eE]mp[aA]t|Tgl|L[aA]h[iI]r)/i', ) && isset([ + 1])) {
                 = str_replace(['O', 'l', 'I'], ['0', '1', '1'], [ + 1]);
                if (preg_match('/([A-Za-z\s\-]+)[,\.]?\s*(\d{2})[\-\/\.](\d{2})[\-\/\.](\d{4})/i', , )) {
                    ['birth_place'] = preg_replace('/[^A-Za-z\s\-]/', '', trim([1]));
                    ['birth_date'] = sprintf('%04d-%02d-%02d', [4], [3], [2]);
                }
            }'''
content = content.replace(old_lahir, new_lahir)

with open('app/Services/KtpOcrService.php', 'w', encoding='utf-8') as f:
    f.write(content)
print('Regex fixed')
