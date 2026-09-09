with open('resources/js/utils/cropImage.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("image.setAttribute('crossOrigin', 'anonymous');", "")

with open('resources/js/utils/cropImage.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Removed crossOrigin')
