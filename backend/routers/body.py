from fastapi import APIRouter, File, UploadFile, HTTPException
import shutil
from pathlib import Path
from body_service import body_service

# 檔案驗證設定
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

router = APIRouter(
    prefix="/upload",
    tags=["body"],
)

# 添加新的 router 用於獲取 body 列表
bodies_router = APIRouter(
    prefix="/bodies",
    tags=["bodies"],
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
    # 驗證檔案類型
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"不支援的檔案類型。請上傳圖片檔案 (JPG, PNG, WEBP)。收到: {file.content_type}"
        )
    
    # 驗證檔案大小（需要讀取檔案內容來檢查大小）
    file_content = await file.read()
    file_size = len(file_content)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"檔案大小超過限制。最大允許 {MAX_FILE_SIZE_MB}MB，收到: {file_size / (1024 * 1024):.2f}MB"
        )
    
    # 1. 儲存上傳的檔案（直接寫入已讀取的內容）
    file_path = UPLOAD_DIR / file.filename
    try:
        with file_path.open("wb") as buffer:
            buffer.write(file_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {e}")
    
    try:
        # 2. 呼叫 AI 服務進行處理
        print(f"Start processing body reconstruction for: {file.filename}")
        generated_files = body_service.process_image(str(file_path))
        
        if not generated_files:
            raise HTTPException(status_code=500, detail="AI failed to generate 3D model")
        
        # 3. 轉換為可訪問的 URL 路徑
        file_urls = [f"/outputs/bodies/{Path(f).name}" for f in generated_files]
        
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

@bodies_router.get("/")
async def list_bodies():
    """獲取預設 body 模型列表（用戶只能看到預設模型，不能看到其他用戶上傳的）"""
    try:
        # 只返回預設模型，不返回其他用戶上傳的模型
        bodies = body_service.get_all_bodies(presets_only=True)
        return {
            "status": "success",
            "bodies": bodies
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
