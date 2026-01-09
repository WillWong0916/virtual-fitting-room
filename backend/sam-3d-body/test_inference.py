import cv2
import torch
import numpy as np
import os
import sys
import pickle

# 將當前目錄加入 Python 路徑，確保能讀取到 sam-3d-body 的模組
sys.path.append(os.getcwd())

try:
    from notebook.utils import setup_sam_3d_body
    from tools.vis_utils import visualize_sample_together
    print("Libraries loaded successfully.")
except ImportError as e:
    print(f"Error loading libraries: {e}")
    print("Please make sure you are running this script from the 'sam-3d-body' folder.")
    sys.exit(1)

def main():
    CACHE_FILE = "outputs_cache.pkl"
    image_path = "test_input.jpg"
    
    outputs = None
    estimator = None

    # 檢查是否有快取，方便快速 Testing
    if os.path.exists(CACHE_FILE):
        use_cache = input(f"偵測到快取檔案 {CACHE_FILE}，是否直接載入以節省時間？(y/n): ").lower()
        if use_cache == 'y':
            print("正在從快取載入 outputs...")
            with open(CACHE_FILE, 'rb') as f:
                outputs = pickle.load(f)
            
            # 即使載入快取，我們仍需要 estimator 來獲取 faces 資訊
            print("仍需載入模型結構以獲取 faces 資訊...")
            estimator = setup_sam_3d_body(hf_repo_id="facebook/sam-3d-body-dinov3", device=None)
            print(f"目前模型運作設備 (快取模式): {estimator.device}")

    if outputs is None:
        # 1. 設定模型
        print("Loading model... (This may take a while)")
        try:
            # 自動偵測設備：在 Windows/Linux 有 GPU 則用 GPU，Mac 則用 CPU
            estimator = setup_sam_3d_body(hf_repo_id="facebook/sam-3d-body-dinov3", device=None)
            print(f"目前模型運作設備 (推論模式): {estimator.device}")
            print("Model loaded!")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Error loading model: {e}")
            return

        # 2. 讀取圖片
        if not os.path.exists(image_path):
            print(f"Error: Image {image_path} not found. Please add a test image.")
            return
            
        img_bgr = cv2.imread(image_path)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        print(f"Processing image: {image_path}...")
        
        # 3. 執行推論 (Inference)
        with torch.no_grad():
            outputs = estimator.process_one_image(img_rgb)
        
        # 儲存快取
        print(f"正在將 outputs 儲存至 {CACHE_FILE}...")
        with open(CACHE_FILE, 'wb') as f:
            pickle.dump(outputs, f)

    # 4. 處理結果
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        print("Error: Could not reload image for visualization.")
        return

    print("Generating visualization...")
    # estimator.faces 是模型的網格面資訊
    rend_img = visualize_sample_together(img_bgr, outputs, estimator.faces)
    
    output_filename = "output_result.jpg"
    cv2.imwrite(output_filename, rend_img.astype(np.uint8))
    print(f"Success! Result saved to {output_filename}")

    # 5. 匯出 OBJ (支援多人)
    if len(outputs) > 0:
        try:
            import trimesh
            for i, person_output in enumerate(outputs):
                if 'pred_vertices' in person_output:
                    # 注意：outputs 裡面的 vertices 可能是 tensor 或 numpy
                    vertices = person_output['pred_vertices']
                    if isinstance(vertices, torch.Tensor):
                        vertices = vertices.cpu().numpy()
                    
                    # 如果是一個人就叫 output_body.obj，多個人則編號
                    filename = "output_body.obj" if len(outputs) == 1 else f"output_body_{i}.obj"
                    
                    faces = estimator.faces
                    mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
                    mesh.export(filename)
                    print(f"Success! Person {i} 3D Mesh saved to {filename}")
        except Exception as e:
            print(f"Could not save OBJ: {e}")

if __name__ == "__main__":
    main()
