from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import shutil
import logging
import json
import threading
import queue
from pathlib import Path
from clothes_service import clothes_service
import cv2

logger = logging.getLogger("ClothesRouter")

router = APIRouter(prefix="/clothes", tags=["clothes"])

UPLOAD_DIR = Path("uploads/clothes")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 檔案驗證設定
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

@router.post("/upload/cloth")
async def upload_cloth(file: UploadFile = File(...)):
    """上傳衣物照片並生成 3D 模型"""
    logger.info(f"Received clothing upload request: {file.filename}")
    
    # 驗證檔案類型
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"不支援的檔案類型。請上傳圖片檔案 (JPG, PNG, WEBP)。收到: {file.content_type}"
        )
    
    # 驗證檔案大小
    file_content = await file.read()
    file_size = len(file_content)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"檔案大小超過限制。最大允許 {MAX_FILE_SIZE_MB}MB，收到: {file_size / (1024 * 1024):.2f}MB"
        )
    
    try:
        # 1. 儲存上傳的檔案
        file_path = UPLOAD_DIR / file.filename
        logger.info(f"Saving upload to {file_path}")
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
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

@router.post("/upload/cloth/stream")
async def upload_cloth_stream(file: UploadFile = File(...)):
    """上傳衣物照片並生成 3D 模型，使用 SSE 推送進度更新"""
    logger.info(f"Received clothing upload request (with progress): {file.filename}")
    
    # 驗證檔案類型
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"不支援的檔案類型。請上傳圖片檔案 (JPG, PNG, WEBP)。收到: {file.content_type}"
        )
    
    # 驗證檔案大小
    file_content = await file.read()
    file_size = len(file_content)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"檔案大小超過限制。最大允許 {MAX_FILE_SIZE_MB}MB，收到: {file_size / (1024 * 1024):.2f}MB"
        )
    
    async def generate_progress():
        try:
            # 1. 儲存上傳的檔案
            file_path = UPLOAD_DIR / file.filename
            logger.info(f"Saving upload to {file_path}")
            
            with open(file_path, "wb") as buffer:
                buffer.write(file_content)
            
            # 生成縮圖 URL（用於顯示）
            thumb_filename = f"{Path(file_path).stem}_thumb.jpg"
            thumbnail_url = f"/outputs/clothes/{thumb_filename}"
            
            # 發送初始狀態（包含縮圖）
            yield f"data: {json.dumps({'stage': 'upload', 'progress': 0, 'message': 'File uploaded', 'thumbnail_url': thumbnail_url})}\n\n"
            
            # 2. 定義進度回調（使用線程安全的隊列）
            progress_queue = queue.Queue()
            
            def progress_callback(stage, progress, message):
                try:
                    progress_queue.put({
                        'stage': stage,
                        'progress': progress,
                        'message': message
                    })
                except:
                    pass
            
            # 3. 在後台線程執行處理
            def process_in_background():
                try:
                    result_path = clothes_service.process_image(str(file_path), progress_callback=progress_callback)
                    
                    if not result_path:
                        progress_queue.put({
                            'stage': 'error',
                            'progress': 0,
                            'message': 'Failed to generate 3D model'
                        })
                        return
                    
                    # 生成縮圖
                    thumb_path = clothes_service.output_dir / thumb_filename
                    try:
                        img = cv2.imread(str(file_path))
                        if img is not None:
                            cv2.imwrite(str(thumb_path), img)
                            logger.info(f"Thumbnail created at {thumb_path}")
                    except Exception as thumb_e:
                        logger.warning(f"Failed to create thumbnail: {thumb_e}")
                    
                    # 發送完成消息
                    relative_model_path = f"/outputs/clothes/{Path(result_path).name}"
                    progress_queue.put({
                        'stage': 'complete',
                        'progress': 100,
                        'message': 'Success! 3D model generated.',
                        'model_url': relative_model_path,
                        'thumbnail_url': f"/outputs/clothes/{thumb_filename}"
                    })
                except Exception as e:
                    logger.error(f"Error in process_in_background: {e}", exc_info=True)
                    progress_queue.put({
                        'stage': 'error',
                        'progress': 0,
                        'message': str(e)
                    })
            
            # 啟動後台線程
            thread = threading.Thread(target=process_in_background, daemon=True)
            thread.start()
            
            # 4. 持續推送進度更新
            while True:
                try:
                    # 等待進度更新（使用超時避免阻塞）
                    try:
                        progress_data = progress_queue.get(timeout=0.1)
                        yield f"data: {json.dumps(progress_data)}\n\n"
                        
                        # 如果完成或出錯，結束
                        if progress_data['stage'] in ['complete', 'error']:
                            break
                    except queue.Empty:
                        # 檢查線程是否還在運行
                        if not thread.is_alive():
                            # 線程已結束，檢查是否有最後的消息
                            try:
                                while True:
                                    progress_data = progress_queue.get_nowait()
                                    yield f"data: {json.dumps(progress_data)}\n\n"
                                    if progress_data['stage'] in ['complete', 'error']:
                                        break
                            except queue.Empty:
                                pass
                            break
                        continue
                except Exception as e:
                    logger.error(f"Error in progress loop: {e}")
                    break
            
            # 等待線程完成
            thread.join(timeout=1)
            
        except Exception as e:
            logger.error(f"Error in upload_cloth_stream: {e}", exc_info=True)
            yield f"data: {json.dumps({'stage': 'error', 'progress': 0, 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

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
