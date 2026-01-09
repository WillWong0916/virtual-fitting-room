from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import shutil
from pathlib import Path
from body_service import body_service

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup directories
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Mount static files so frontend can access generated models/images
# 這讓你可以透過 http://localhost:8000/outputs/filename.obj 訪問檔案
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

@app.get("/")
async def root():
    return {"message": "Hello from 3D Fitting Room Backend"}

@app.post("/upload/body")
async def upload_body(file: UploadFile = File(...)):
    """
    接收前端上傳的人體照片，執行 AI 生成，並回傳 .obj 檔案的 URL
    """
    # 1. 儲存上傳的檔案
    file_path = UPLOAD_DIR / file.filename
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {e}")
    
    try:
        # 2. 呼叫 AI 服務進行處理
        print(f"Start processing body reconstruction for: {file.filename}")
        generated_files = body_service.process_image(str(file_path))
        
        if not generated_files:
            raise HTTPException(status_code=500, detail="AI failed to generate 3D model")
        
        # 3. 轉換為可訪問的 URL 路徑
        # 例如: /outputs/test_input_body_0.obj
        file_urls = [f"/outputs/{Path(f).name}" for f in generated_files]
        
        return {
            "status": "success",
            "message": f"Successfully generated {len(generated_files)} 3D models",
            "models": file_urls,
            "count": len(generated_files)
        }
        
    except Exception as e:
        print(f"Error during AI processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 選擇性：處理完後可以刪除原始上傳圖檔以節省空間
        # if file_path.exists():
        #     os.remove(file_path)
        pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
