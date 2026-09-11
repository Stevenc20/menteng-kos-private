with open('ocr-service/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

import re
replacement = """
        print(f"DEBUG: image shape {img.shape}")
        result = ocr.ocr(img)
        print(f"DEBUG: OCR result raw type {type(result)}")
        print(f"DEBUG: OCR result raw {result}")
        
        parsed_results = []
        if result and len(result) > 0 and result[0] is not None:
            for line in result[0]:
"""

content = re.sub(r'\s*result = ocr\.ocr\(img\)\s*parsed_results = \[\]\s*if result and result\[0\]:\s*for line in result\[0\]:', replacement, content)

with open('ocr-service/main.py', 'w', encoding='utf-8') as f:
    f.write(content)
