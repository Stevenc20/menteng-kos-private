with open('ocr-service/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("lang='id'", "lang='en'")

with open('ocr-service/main.py', 'w', encoding='utf-8') as f:
    f.write(content)
