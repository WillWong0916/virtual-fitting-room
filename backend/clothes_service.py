import os
# 修復 setuptools 兼容性問題（運行時也需要，特別是當 triton 被導入時）
os.environ.setdefault('SETUPTOOLS_USE_DISTUTILS', 'stdlib')

import torch
import numpy as np
import sys
import logging
from pathlib import Path
from PIL import Image
import cv2
import trimesh

# 將 sam-3d-objects 的目錄加入 Python 路徑
CURRENT_DIR = Path(__file__).parent.absolute()
CLOTHING_FACTORY_DIR = CURRENT_DIR.parent / "clothing-factory" / "sam-3d-objects"

# 關鍵路徑設定
if str(CLOTHING_FACTORY_DIR) not in sys.path:
    sys.path.insert(0, str(CLOTHING_FACTORY_DIR))
if str(CLOTHING_FACTORY_DIR / "notebook") not in sys.path:
    sys.path.insert(0, str(CLOTHING_FACTORY_DIR / "notebook"))

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("ClothesService")

class ClothesReconstructionService:
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """確保單例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """初始化（只執行一次）"""
        if not ClothesReconstructionService._initialized:
            self.inference = None
            self.sam_predictor = None
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            self.output_dir = CURRENT_DIR / "outputs" / "clothes"
            self.output_dir.mkdir(parents=True, exist_ok=True)
            
            # 由於已經安裝了正確版本的 MoGe 和 utils3d，不再需要強制設定 LIDRA_SKIP_INIT
            logger.info(f"Initialized ClothesService on {self.device}")
            ClothesReconstructionService._initialized = True

    def load_sam(self):
        if self.sam_predictor is None:
            logger.info("Loading SAM for Auto-Masking...")
            try:
                from segment_anything import sam_model_registry, SamPredictor
                sam_checkpoint = CLOTHING_FACTORY_DIR / "checkpoints" / "sam" / "sam_vit_h_4b8939.pth"
                if not sam_checkpoint.exists():
                    logger.warning(f"SAM checkpoint not found at {sam_checkpoint}.")
                    return None
                
                model_type = "vit_h"
                sam = sam_model_registry[model_type](checkpoint=str(sam_checkpoint))
                sam.to(device=self.device)
                self.sam_predictor = SamPredictor(sam)
                logger.info("SAM loaded successfully!")
            except Exception as e:
                logger.error(f"Failed to load SAM: {e}")
                return None
        return self.sam_predictor

    def get_auto_mask(self, image_np):
        predictor = self.load_sam()
        if predictor is None: 
            logger.warning("SAM predictor is None, using full image mask")
            return None
        
        try:
            logger.info(f"Setting image to SAM predictor (shape: {image_np.shape})...")
            predictor.set_image(image_np)
            logger.info("Image set to SAM predictor successfully")
            
            h, w = image_np.shape[:2]
            input_point = np.array([[w // 2, h // 2]])
            input_label = np.array([1])
            
            logger.info(f"Running SAM prediction (center point: {input_point[0]})...")
            masks, scores, logits = predictor.predict(
                point_coords=input_point, 
                point_labels=input_label, 
                multimask_output=True
            )
            logger.info(f"SAM prediction completed. Found {len(masks)} masks, best score: {np.max(scores):.4f}")
            
            mask_bool = masks[np.argmax(scores)]
            kernel = np.ones((10, 10), np.uint8)
            mask_uint8 = mask_bool.astype(np.uint8) * 255
            dilated_mask = cv2.dilate(mask_uint8, kernel, iterations=1)
            logger.info(f"Mask processing completed. Mask shape: {dilated_mask.shape}")
            return dilated_mask > 0
        except Exception as e:
            logger.error(f"Error in get_auto_mask: {e}", exc_info=True)
            return None


    def load_model(self, unload_other_model=True):
        """
        加載 SAM 3D Objects 模型
        
        Args:
            unload_other_model: 如果為 True，會先卸載 Body 模型以釋放 VRAM
        """
        # 如果指定要卸載其他模型，則卸載 Body 模型以釋放 VRAM
        if unload_other_model and self.inference is None:
            from body_service import body_service
            if body_service.estimator is not None:
                logger.info("Unloading Body model to free VRAM for Clothes model...")
                body_service.unload_model()
        
        if self.inference is None:
            logger.info("Loading SAM 3D Objects model with Native Nvdiffrast & MoGe support...")
            try:
                # 這裡不再需要任何 Monkey Patch，因為我們已經安裝了正確版本的 MoGe / utils3d
                from inference import Inference
                tag = "hf"
                config_path = CLOTHING_FACTORY_DIR / "checkpoints" / tag / "checkpoints" / "pipeline.yaml"
                
                # 使用 eager 模式（compile=False）以確保穩定性
                self.inference = Inference(str(config_path), compile=False)
                
                # 確認渲染引擎為 nvdiffrast
                self.inference._pipeline.rendering_engine = "nvdiffrast"
                
                logger.info("✅ Clothes model loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load clothes model: {e}", exc_info=True)
                raise e
        return self.inference

    def unload_model(self):
        """卸載模型以釋放 VRAM"""
        if self.inference is not None:
            logger.info("Unloading Clothes model to free VRAM...")
            try:
                # 卸載主模型
                if hasattr(self.inference, '_pipeline') and self.inference._pipeline is not None:
                    # 嘗試清理 pipeline 中的模型
                    if hasattr(self.inference._pipeline, 'model') and self.inference._pipeline.model is not None:
                        if hasattr(self.inference._pipeline.model, 'cpu'):
                            self.inference._pipeline.model.cpu()
                        del self.inference._pipeline.model
                
                # 卸載 SAM predictor
                if self.sam_predictor is not None:
                    if hasattr(self.sam_predictor, 'model'):
                        if hasattr(self.sam_predictor.model, 'cpu'):
                            self.sam_predictor.model.cpu()
                        del self.sam_predictor.model
                    del self.sam_predictor
                    self.sam_predictor = None
                
                del self.inference
                self.inference = None
                
                # 清理 CUDA 快取
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                elif torch.backends.mps.is_available():
                    torch.mps.empty_cache()
                
                logger.info("✅ Clothes model unloaded successfully!")
            except Exception as e:
                logger.warning(f"Error unloading Clothes model: {e}")
                self.inference = None
                self.sam_predictor = None

    def fix_mesh_orientation(self, mesh: trimesh.Trimesh):
        """將模型扶正並置中 (將 Z-up 轉為 Y-up)"""
        # 官方輸出的衣服模型通常是 Z-up (躺著)
        # 我們需要把它繞 X 軸轉 -90 度，讓它 Y-up (站立)
        rotation = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
        mesh.apply_transform(rotation)
        
        # 將模型中心移至原點
        mesh.vertices -= mesh.center_mass
        return mesh

    def process_image(self, image_path: str, progress_callback=None, auto_unload=True):
        """
        處理圖片並生成 3D 模型
        
        Args:
            image_path: 圖片路徑
            progress_callback: 可選的進度回調函數，接收 (stage, progress, message) 參數
                - stage: 階段名稱 (str)
                - progress: 進度百分比 (0-100) (float)
                - message: 進度消息 (str)
            auto_unload: 處理完成後是否自動卸載模型以釋放 VRAM
        """
        def emit_progress(stage, progress, message):
            if progress_callback:
                progress_callback(stage, progress, message)
            logger.info(f"[{stage}] {progress:.1f}% - {message}")
        
        try:
            inf = self.load_model()
            img_pil = Image.open(image_path).convert("RGB")
            img_np = np.array(img_pil)
            
            emit_progress("masking", 5, "Running Auto-Masking with SAM...")
            mask_bool = self.get_auto_mask(img_np)
            if mask_bool is None: 
                logger.warning("Auto-masking failed, using full image mask")
                mask_bool = np.ones(img_np.shape[:2], dtype=bool)
            else:
                logger.info(f"Auto-mask generated successfully. Mask coverage: {np.sum(mask_bool) / mask_bool.size * 100:.2f}%")
            emit_progress("masking", 10, "Auto-masking completed")

            emit_progress("preparation", 15, "Starting High-Quality Native 3D reconstruction...")
            emit_progress("preparation", 20, "Merging mask to RGBA image...")
            rgba_image = inf.merge_mask_to_rgba(img_np, mask_bool)
            logger.info(f"RGBA image prepared. Shape: {rgba_image.shape}")

            emit_progress("inference", 25, "Running inference pipeline...")
            emit_progress("inference", 30, "Stage 1: Sampling sparse structure...")
            
            with torch.no_grad():
                output = inf._pipeline.run(
                    rgba_image, None, seed=42,
                    stage1_only=False,
                    with_mesh_postprocess=True,
                    with_texture_baking=True,    
                    with_layout_postprocess=False,
                    use_vertex_color=False       
                )
            
            emit_progress("inference", 70, "Inference pipeline completed!")
            
            if not output: return None
            base_name = Path(image_path).stem

            emit_progress("export", 85, "Exporting GLB file...")
            mesh_obj = output.get("glb")
            if mesh_obj is not None:
                glb_path = self.output_dir / f"{base_name}_cloth.glb"
                if isinstance(mesh_obj, trimesh.Trimesh):
                    mesh_obj = self.fix_mesh_orientation(mesh_obj)
                    mesh_obj.export(str(glb_path))
                logger.info(f"Success! Native textured GLB saved: {glb_path}")
                emit_progress("export", 100, "Success! 3D model generated.")
                return str(glb_path)

        except Exception as e:
            logger.error(f"Native 3D Reconstruction failed: {e}", exc_info=True)
            if progress_callback:
                progress_callback("error", 0, f"Error: {str(e)}")
            raise e
        finally:
            # 處理完成後自動卸載模型以釋放 VRAM
            if auto_unload:
                self.unload_model()

    def get_all_clothes(self, presets_only=False):
        """
        獲取 clothes 模型列表
        
        Args:
            presets_only: 如果為 True，只返回預設模型；如果為 False，返回所有模型（包括用戶上傳的）
                        注意：ClothingFactory 是管理員頁面，默認顯示所有模型
        """
        clothes_dict = {}
        
        # 1. 獲取預設模型（如果存在 presets 目錄）
        presets_dir = self.output_dir / "presets"
        if presets_dir.exists():
            for ext in ["*.ply", "*.obj", "*.glb"]:
                for file in presets_dir.glob(ext):
                    name = file.stem.replace("_cloth", "")
                    
                    # 尋找對應的縮圖
                    thumb_name = f"{name}_thumb.jpg"
                    thumb_path = presets_dir / thumb_name
                    thumbnail_url = f"/outputs/clothes/presets/{thumb_name}" if thumb_path.exists() else None
                    
                    clothes_dict[name] = {
                        "name": name,
                        "url": f"/outputs/clothes/presets/{file.name}",
                        "format": file.suffix[1:],
                        "thumbnail": thumbnail_url,
                        "is_preset": True
                    }
        
        # 2. 如果 presets_only 為 False，也包含動態生成的 clothes
        if not presets_only:
            for ext in ["*.ply", "*.obj", "*.glb"]:
                for file in self.output_dir.glob(ext):
                    # 跳過 presets 目錄
                    if "presets" in str(file):
                        continue
                    
                    name = file.stem.replace("_cloth", "")
                    
                    # 如果已經有預設模型，跳過（預設模型優先）
                    if name in clothes_dict:
                        continue
                    
                    # 尋找對應的縮圖 (thumb)
                    thumb_name = f"{name}_thumb.jpg"
                    thumb_path = self.output_dir / thumb_name
                    thumbnail_url = f"/outputs/clothes/{thumb_name}" if thumb_path.exists() else None
                    
                    clothes_dict[name] = {
                        "name": name,
                        "url": f"/outputs/clothes/{file.name}",
                        "format": file.suffix[1:],
                        "thumbnail": thumbnail_url,
                        "is_preset": False
                    }
        
        return list(clothes_dict.values())

# 建立全域單例
clothes_service = ClothesReconstructionService()
