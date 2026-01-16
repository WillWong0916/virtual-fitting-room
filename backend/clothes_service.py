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
            
            # 策略 1: 使用中心點作為主要提示，並使用四角作為負面提示（排除背景）
            # 正面提示點：中心區域（衣物通常在中心）
            positive_points = np.array([
                [w // 2, h // 2],           # 中心
            ])
            positive_labels = np.ones(len(positive_points))
            
            # 負面提示點：四角（背景通常在角落）
            negative_points = np.array([
                [w * 0.05, h * 0.05],      # 左上角
                [w * 0.95, h * 0.05],      # 右上角
                [w * 0.05, h * 0.95],      # 左下角
                [w * 0.95, h * 0.95],      # 右下角
            ])
            negative_labels = np.zeros(len(negative_points))  # 0 表示背景
            
            # 合併所有提示點
            all_points = np.vstack([positive_points, negative_points])
            all_labels = np.hstack([positive_labels, negative_labels])
            
            logger.info(f"Running SAM prediction with {len(positive_points)} positive and {len(negative_points)} negative points...")
            
            # 使用正面和負面提示點
            masks, scores, logits = predictor.predict(
                point_coords=all_points,
                point_labels=all_labels,
                multimask_output=True
            )
            
            logger.info(f"SAM prediction completed. Found {len(masks)} mask candidates")
            
            # 策略 2: 選擇最適合的 mask（避免選擇背景）
            # 計算每個 mask 的面積和覆蓋率
            mask_areas = [np.sum(mask) for mask in masks]
            mask_coverage_ratios = [area / (h * w) for area in mask_areas]
            
            # 過濾掉過大（可能是背景）或過小（可能是圖案）的 mask
            # 理想的衣物 mask 應該覆蓋 20%-70% 的圖片
            valid_indices = [
                i for i, coverage in enumerate(mask_coverage_ratios)
                if 0.2 <= coverage <= 0.7
            ]
            
            if not valid_indices:
                # 如果沒有符合條件的，選擇中等大小的
                logger.warning("No mask in ideal coverage range (20%-70%), selecting medium-sized mask")
                sorted_indices = np.argsort(mask_areas)
                # 選擇中等大小的（不是最大也不是最小）
                best_mask_idx = sorted_indices[len(sorted_indices) // 2]
            else:
                # 從有效範圍內選擇面積最大的
                valid_areas = [mask_areas[i] for i in valid_indices]
                best_valid_idx = valid_indices[np.argmax(valid_areas)]
                best_mask_idx = best_valid_idx
            
            mask_bool = masks[best_mask_idx]
            best_coverage = mask_coverage_ratios[best_mask_idx] * 100
            logger.info(f"Selected mask {best_mask_idx} with coverage: {best_coverage:.2f}%")
            
            # 策略 3: 只合併重疊的 mask（避免合併背景）
            # 不再自動合併所有大 mask，因為可能包含背景
            # 只合併與主 mask 有明顯重疊的小 mask（可能是物件的其他部分）
            main_mask_area = mask_areas[best_mask_idx]
            for idx, mask in enumerate(masks):
                if idx == best_mask_idx:
                    continue
                
                # 計算重疊率
                overlap = np.sum(mask & mask_bool)
                overlap_ratio = overlap / np.sum(mask) if np.sum(mask) > 0 else 0
                
                # 只合併小 mask（可能是物件的一部分）且重疊率 > 50%
                if mask_areas[idx] < main_mask_area * 0.5 and overlap_ratio > 0.5:
                    mask_bool = mask_bool | mask
                    logger.info(f"Merging overlapping mask {idx} (overlap: {overlap_ratio:.2%})")
            
            # 策略 4: 形態學處理來平滑 mask 邊緣
            mask_uint8 = mask_bool.astype(np.uint8) * 255
            
            # 先閉運算（closing）填充小洞
            kernel_closing = np.ones((15, 15), np.uint8)
            mask_closed = cv2.morphologyEx(mask_uint8, cv2.MORPH_CLOSE, kernel_closing)
            
            # 再輕微擴張（dilation）確保邊緣完整
            kernel_dilate = np.ones((10, 10), np.uint8)
            dilated_mask = cv2.dilate(mask_closed, kernel_dilate, iterations=1)
            
            final_mask = dilated_mask > 0
            
            final_coverage = np.sum(final_mask) / final_mask.size * 100
            logger.info(f"Final mask coverage: {final_coverage:.2f}%")
            logger.info(f"Mask processing completed. Mask shape: {final_mask.shape}")
            
            return final_mask
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

    def process_image(self, image_path: str, progress_callback=None, auto_unload=True):
        """
        處理圖片並生成 3D 模型
        
        Args:
            image_path: 圖片路徑
            progress_callback: 可選的進度回調函數，接收 (stage, progress, message) 參數
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

            emit_progress("export", 75, "Re-exporting GLB with high-quality settings...")
            
            # 始終使用更好的參數重新生成 GLB，確保高品質紋理和細節
            mesh_obj = None
            if "mesh" in output and "gaussian" in output:
                # 直接調用 to_glb 使用更好的參數
                logger.info("Generating high-quality GLB with improved settings...")
                logger.info("  - Texture size: 2048 (instead of 1024) for better pattern/logo quality")
                logger.info("  - Simplify: 0.7 (keeps 30% triangles instead of 5%) for more detail")
                from sam3d_objects.model.backbone.tdfy_dit.utils import postprocessing_utils
                
                mesh_obj = postprocessing_utils.to_glb(
                    output["gaussian"][0],
                    output["mesh"][0],
                    simplify=0.7,  # 保留 30% 的三角形（而不是 5%），保持更多細節
                    texture_size=2048,  # 使用 2048 紋理（而不是 1024），更好的圖案/logo 品質
                    fill_holes=True,
                    fill_holes_max_size=0.04,
                    verbose=True,
                    with_mesh_postprocess=True,
                    with_texture_baking=True,
                    use_vertex_color=False,
                    rendering_engine=inf._pipeline.rendering_engine,
                )
                logger.info("High-quality GLB generated successfully!")
            elif output.get("glb") is not None:
                # 如果沒有 gaussian/mesh 但已有 GLB，使用它（降級方案）
                logger.warning("Using pipeline-generated GLB (may have lower quality)")
                mesh_obj = output.get("glb")
            
            if mesh_obj is not None:
                glb_path = self.output_dir / f"{base_name}_cloth.glb"
                if isinstance(mesh_obj, trimesh.Trimesh):
                    # --- 自動接地與置中優化 ---
                    # 生成後先做基本接地，後續由用戶在前端手動旋轉
                    bounds = mesh_obj.bounds
                    centroid = mesh_obj.centroid
                    translation = [
                        -centroid[0],      # X 置中
                        -bounds[0, 1],     # Y 接地 (底部對齊 0)
                        -centroid[2]       # Z 置中
                    ]
                    mesh_obj.apply_translation(translation)
                    logger.info(f"Initial grounding and centering applied. Translation: {translation}")
                    
                    mesh_obj.export(str(glb_path))
                logger.info(f"Success! High-quality textured GLB saved: {glb_path}")
                emit_progress("export", 100, "Success! 3D model generated.")
                return str(glb_path)
            else:
                logger.warning("No mesh object generated from pipeline")
                return None

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
