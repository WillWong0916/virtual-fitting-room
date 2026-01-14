import torch
import numpy as np
import os
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
    def __init__(self):
        self.inference = None
        self.sam_predictor = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.output_dir = CURRENT_DIR / "outputs" / "clothes"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # 由於已經安裝了正確版本的 MoGe 和 utils3d，不再需要強制設定 LIDRA_SKIP_INIT
        logger.info(f"Initialized ClothesService on {self.device}")

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
        if predictor is None: return None
        predictor.set_image(image_np)
        h, w = image_np.shape[:2]
        input_point = np.array([[w // 2, h // 2]])
        input_label = np.array([1])
        masks, scores, logits = predictor.predict(point_coords=input_point, point_labels=input_label, multimask_output=True)
        mask_bool = masks[np.argmax(scores)]
        kernel = np.ones((10, 10), np.uint8)
        mask_uint8 = mask_bool.astype(np.uint8) * 255
        dilated_mask = cv2.dilate(mask_uint8, kernel, iterations=1)
        return dilated_mask > 0

    def load_model(self):
        if self.inference is None:
            logger.info("Loading SAM 3D Objects model with Native Nvdiffrast & MoGe support...")
            try:
                # 這裡不再需要任何 Monkey Patch，因為我們已經安裝了正確版本的 MoGe / utils3d
                from inference import Inference
                tag = "hf"
                config_path = CLOTHING_FACTORY_DIR / "checkpoints" / tag / "checkpoints" / "pipeline.yaml"
                
                self.inference = Inference(str(config_path), compile=False)
                
                # 確認渲染引擎為 nvdiffrast
                self.inference._pipeline.rendering_engine = "nvdiffrast"
                
                logger.info("Clothes model loaded with native Nvdiffrast & MoGe engine!")
            except Exception as e:
                logger.error(f"Failed to load clothes model: {e}", exc_info=True)
                raise e
        return self.inference

    def fix_mesh_orientation(self, mesh: trimesh.Trimesh):
        """將模型扶正並置中 (將 Z-up 轉為 Y-up)"""
        # 官方輸出的衣服模型通常是 Z-up (躺著)
        # 我們需要把它繞 X 軸轉 -90 度，讓它 Y-up (站立)
        rotation = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
        mesh.apply_transform(rotation)
        
        # 將模型中心移至原點
        mesh.vertices -= mesh.center_mass
        return mesh

    def process_image(self, image_path: str):
        inf = self.load_model()
        img_pil = Image.open(image_path).convert("RGB")
        img_np = np.array(img_pil)
        
        logger.info("Running Auto-Masking with SAM...")
        mask_bool = self.get_auto_mask(img_np)
        if mask_bool is None: mask_bool = np.ones(img_np.shape[:2], dtype=bool)

        logger.info("Starting High-Quality Native 3D reconstruction...")
        try:
            rgba_image = inf.merge_mask_to_rgba(img_np, mask_bool)
            
            with torch.no_grad():
                output = inf._pipeline.run(
                    rgba_image, None, seed=42,
                    stage1_only=False,
                    with_mesh_postprocess=True, # 使用 MoGe 版本 utils3d 的原生意實作
                    with_texture_baking=True,    
                    with_layout_postprocess=False,
                    use_vertex_color=False       
                )
            
            if not output: return None
            base_name = Path(image_path).stem

            mesh_obj = output.get("glb")
            if mesh_obj is not None:
                glb_path = self.output_dir / f"{base_name}_cloth.glb"
                if isinstance(mesh_obj, trimesh.Trimesh):
                    mesh_obj = self.fix_mesh_orientation(mesh_obj)
                    mesh_obj.export(str(glb_path))
                logger.info(f"Success! Native textured GLB saved: {glb_path}")
                return str(glb_path)

        except Exception as e:
            logger.error(f"Native 3D Reconstruction failed: {e}", exc_info=True)
            raise e

    def get_all_clothes(self):
        clothes_dict = {}
        for ext in ["*.ply", "*.obj", "*.glb"]:
            for file in self.output_dir.glob(ext):
                name = file.stem.replace("_cloth", "")
                
                # 尋找對應的縮圖 (thumb)
                thumb_name = f"{name}_thumb.jpg"
                thumb_path = self.output_dir / thumb_name
                thumbnail_url = f"/outputs/clothes/{thumb_name}" if thumb_path.exists() else None
                
                clothes_dict[name] = {
                    "name": name,
                    "url": f"/outputs/clothes/{file.name}",
                    "format": file.suffix[1:],
                    "thumbnail": thumbnail_url
                }
        return list(clothes_dict.values())

# 建立全域單例
clothes_service = ClothesReconstructionService()
