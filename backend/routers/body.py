from fastapi import APIRouter, File, UploadFile, HTTPException
import shutil
from pathlib import Path
from body_service import body_service

router = APIRouter(
    prefix="/upload",
    tags=["body"],
)

# 定義路徑
BASE_DIR = Path(__file__).parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

@router.post("/body")
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
        # 這裡不刪除檔案，保留作為記錄。如果需要自動清理，可以另外實作定時任務。
        pass
