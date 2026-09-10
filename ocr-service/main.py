from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from paddleocr import PaddleOCR
import numpy as np
import cv2
import io

app = FastAPI()

# Initialize PaddleOCR
# lang='en' uses Indonesian dictionary if available, else 'en'
ocr = PaddleOCR(use_angle_cls=True, lang='en')

@app.post("/ocr")
async def process_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return JSONResponse(status_code=400, content={"error": "Invalid image"})

        # Run OCR
        result = ocr.ocr(img)
        
        parsed_results = []
        if result and result[0]:
            for line in result[0]:
                box = line[0]
                text = line[1][0]
                confidence = line[1][1]
                parsed_results.append({
                    "box": box,
                    "text": text,
                    "confidence": confidence
                })
                
        return {"data": parsed_results}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/health")
def health():
    return {"status": "ok"}
