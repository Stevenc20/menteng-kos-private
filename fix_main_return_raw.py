with open('ocr-service/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

import re
replacement = """
        parsed_results = []
        if result and len(result) > 0 and result[0] is not None:
            # Check if result is a list of lines directly (sometimes happens in newer paddleocr versions)
            first_element = result[0]
            lines = first_element if isinstance(first_element, list) and len(first_element) > 0 and isinstance(first_element[0], list) else result
            
            try:
                for line in lines:
                    box = line[0]
                    text = line[1][0]
                    confidence = line[1][1]
                    parsed_results.append({
                        "box": box,
                        "text": text,
                        "confidence": confidence
                    })
            except Exception as e:
                return {"data": [], "raw_result_string": str(result), "error": str(e)}
        else:
            return {"data": [], "raw_result_string": str(result), "debug_msg": "result[0] was None or empty"}
            
        return {"data": parsed_results, "raw_result_string": str(result)}
"""

# Replace the block from parsed_results = [] down to return {"data": parsed_results}
content = re.sub(r'\s*parsed_results = \[\]\s*if result and len\(result\) > 0 and result\[0\] is not None:[\s\S]*?return \{"data": parsed_results\}', replacement, content)

with open('ocr-service/main.py', 'w', encoding='utf-8') as f:
    f.write(content)
