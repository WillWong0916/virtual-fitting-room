from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import logging
from pathlib import Path
from clothes_service import clothes_service
import cv2

logger = logging.getLogger("ClothesRouter")

router = APIRouter(prefix="/clothes", tags=["clothes"])

UPLOAD_DIR = Path("uploads/clothes")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/upload/cloth")
async def upload_cloth(file: UploadFile = File(...)):
    """上傳衣物照片並生成 3D 模型"""
    logger.info(f"Received clothing upload request: {file.filename}")
    try:
        # 1. 儲存上傳的檔案
        file_path = UPLOAD_DIR / file.filename
        logger.info(f"Saving upload to {file_path}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 2. 呼叫 AI 服務進行處理
        logger.info("Calling clothes_service.process_image...")
        result_path = clothes_service.process_image(str(file_path))
        
        if not result_path:
            logger.error("clothes_service returned None")
            raise HTTPException(status_code=500, detail="Failed to generate 3D model")
        
        # 3. 準備回傳結果
        relative_model_path = f"/outputs/clothes/{Path(result_path).name}"
        
        # 嘗試生成縮圖 (Thumbnail)
        thumb_filename = f"{Path(file_path).stem}_thumb.jpg"
        thumb_path = clothes_service.output_dir / thumb_filename
        try:
            img = cv2.imread(str(file_path))
            if img is not None:
                cv2.imwrite(str(thumb_path), img)
                logger.info(f"Thumbnail created at {thumb_path}")
        except Exception as thumb_e:
            logger.warning(f"Failed to create thumbnail: {thumb_e}")

        logger.info(f"Successfully generated model: {relative_model_path}")
        
        return {
            "status": "success",
            "model_url": relative_model_path,
            "thumbnail_url": f"/outputs/clothes/{thumb_filename}",
            "message": "Clothing model generated successfully"
        }
    except Exception as e:
        logger.error(f"Error in upload_cloth: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

@router.get("/")
async def list_clothes():
    """獲取所有已生成的衣物清單"""
    try:
        clothes = clothes_service.get_all_clothes()
        return {
            "status": "success",
            "clothes": clothes
        }
    except Exception as e:
        logger.error(f"Error in list_clothes: {e}")
        return {"status": "error", "message": str(e)}
