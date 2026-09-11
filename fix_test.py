with open('test_pipeline.php', 'r', encoding='latin1') as f:
    content = f.read()

content = content.replace("echo json_encode($rawOcr, JSON_PRETTY_PRINT)", "echo json_encode($json, JSON_PRETTY_PRINT)")

with open('test_pipeline.php', 'w', encoding='latin1') as f:
    f.write(content)
