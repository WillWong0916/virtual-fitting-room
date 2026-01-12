import cv2
import torch
import numpy as np
import os
import sys
import trimesh
from pathlib import Path

# 將 sam-3d-body 的目錄加入 Python 路徑
CURRENT_DIR = Path(__file__).parent.absolute()
SAM_3D_BODY_DIR = CURRENT_DIR / "sam-3d-body"

# 關鍵修正：
# 1. 將 sam-3d-body 加入 sys.path 的最前面
if str(SAM_3D_BODY_DIR) not in sys.path:
    sys.path.insert(0, str(SAM_3D_BODY_DIR))

# 全域導入 flag
AI_MODULES_AVAILABLE = False
IMPORT_ERROR_MSG = ""

try:
    from notebook.utils import setup_sam_3d_body
    AI_MODULES_AVAILABLE = True
except ImportError as e:
    IMPORT_ERROR_MSG = str(e)
    # 如果還是失敗，嘗試更激進的路徑策略
    try:
        sys.path.append(str(SAM_3D_BODY_DIR / "sam_3d_body"))
        from notebook.utils import setup_sam_3d_body
        AI_MODULES_AVAILABLE = True
    except ImportError as e2:
        IMPORT_ERROR_MSG = f"Original error: {e}, Secondary error: {e2}"

class BodyReconstructionService:
    def __init__(self):
        self.estimator = None
        self.device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
        self.output_dir = CURRENT_DIR / "outputs" / "bodies"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def load_model(self):
        """延遲加載模型，確保只在第一次呼叫時加載"""
        if not AI_MODULES_AVAILABLE:
            raise RuntimeError(f"Body reconstruction AI modules are not available in current environment: {IMPORT_ERROR_MSG}")
            
        if self.estimator is None:
            print(f"Loading SAM 3D Body model on {self.device}...")
            self.estimator = setup_sam_3d_body(
                hf_repo_id="facebook/sam-3d-body-dinov3", 
                device=None # 會自動偵測
            )
            print("Model loaded successfully!")
        return self.estimator

    def process_image(self, image_path: str):
        """
        處理單張圖片並生成 3D 模型
        回傳: 生成的 .obj 檔案路徑清單
        """
        estimator = self.load_model()
        
        # 1. 讀取並轉換圖片
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            raise ValueError(f"Could not read image at {image_path}")
        
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        # 2. 執行 AI 推論
        with torch.no_grad():
            outputs = estimator.process_one_image(img_rgb)

        if not outputs:
            return []

        # 3. 匯出 3D Mesh (.obj)
        generated_files = []
        faces = estimator.faces
        
        for i, person_output in enumerate(outputs):
            if 'pred_vertices' in person_output:
                vertices = person_output['pred_vertices']
                if isinstance(vertices, torch.Tensor):
                    vertices = vertices.cpu().numpy()
                
                # 建立唯一的檔名 (可以使用時間戳或原始圖片名)
                base_name = Path(image_path).stem
                obj_filename = f"{base_name}_body_{i}.obj"
                obj_path = self.output_dir / obj_filename
                
                mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
                mesh.export(str(obj_path))
                generated_files.append(str(obj_path))
                
                print(f"Generated 3D mesh: {obj_path}")

        return generated_files

# 建立全域單例，讓 FastAPI 呼叫
body_service = BodyReconstructionService()
