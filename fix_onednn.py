with open('ocr-service/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# Add env vars at the very top
env_vars = """import os
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"
"""
if "FLAGS_enable_pir_api" not in content:
    content = env_vars + "\n" + content

# Add enable_mkldnn=False to PaddleOCR
content = content.replace("ocr = PaddleOCR(use_angle_cls=True, lang='en')", "ocr = PaddleOCR(use_angle_cls=True, lang='en', enable_mkldnn=False)")

with open('ocr-service/main.py', 'w', encoding='utf-8') as f:
    f.write(content)
