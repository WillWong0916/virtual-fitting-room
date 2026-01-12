# 項目搬遷與環境配置故障排除指南 (Setup & Troubleshooting Guide)

本文件紀錄了專案在轉移目錄、更換機器或重新配置環境時遇到的常見問題及其解決方案。

## 1. 核心環境要求 (Core Requirements)
*   **Python 版本**: 必須使用 **Python 3.10+** (推薦 3.11)。
    *   *原因*: 許多 AI 組件（如 `MoGe`）使用了 Python 3.10 引入的 `ParamSpec` 等新特性。
    *   *問題*: 如果使用 Python 3.9，會報錯 `name 'ParamSpec' is not defined`。

## 2. 後端環境恢復步驟 (Backend Recovery)
如果你刪除了 `.venv` 或搬遷了目錄，請執行以下步驟：

```bash
cd backend
# 1. 使用 Python 3.11 建立虛擬環境
/opt/homebrew/bin/python3.11 -m venv .venv
source .venv/bin/activate

# 2. 升級 pip
pip install --upgrade pip

# 3. 安裝基礎依賴
pip install -r requirements.txt

# 4. 安裝 PyTorch (Mac MPS 支援)
pip install torch torchvision torchaudio

# 5. 安裝 AI 核心組件 (注意安裝順序)
pip install numpy
pip install pytorch-lightning yacs scikit-image einops timm dill pandas rich hydra-core chumpy roma joblib seaborn wandb loguru optree fvcore black pycocotools tensorboard huggingface_hub

# 6. 安裝 3D 渲染組件 (Mac 兼容版)
pip install PyOpenGL pyrender

# 7. 安裝特殊編譯組件
pip install wheel
pip install xtcocotools --no-build-isolation
pip install 'git+https://github.com/facebookresearch/detectron2.git@a1ce2f9' --no-build-isolation --no-deps
pip install git+https://github.com/microsoft/MoGe.git --no-build-isolation

# 8. 修正 iopath 版本衝突 (detectron2 要求)
pip install iopath==0.1.9
```

## 3. AI 模型權重 (AI Models & Weights)
本專案依賴多個大型 AI 模型，首次執行推論時系統會嘗試自動下載。請確保有足夠的硬碟空間（約 10GB+）及穩定的網路連線。

### A. Detectron2 / ViTDet 權重 (約 2.7GB)
*   **用途**: 人體偵測 (Object Detection)。
*   **下載路徑**: `~/.torch/iopath_cache/s/dl.fbaipublicfiles.com/detectron2/ViTDet/...`
*   **報錯現象**: `Failed to download model_final_f05665.pkl`。

### B. SAM 3D Body / Hugging Face 權重 (約 3-5GB)
*   **用途**: 3D 人體重建核心模型。
*   **下載路徑**: `~/.cache/huggingface/hub/models--facebook--sam-3d-body-dinov3`
*   **手動下載**: 可使用 `huggingface-cli download facebook/sam-3d-body-dinov3`。

### C. DINOv3 核心權重
*   **用途**: 特徵提取。
*   **下載路徑**: `~/.cache/torch/hub/facebookresearch_dinov3_main`

---

## 4. 常見錯誤與排除 (Common Issues)

### A. `name 'ParamSpec' is not defined`
*   **原因**: Python 版本太低 (3.9 或更低)。
*   **解決**: 重新使用 Python 3.11 建立 `.venv`。

### B. `No module named 'moge'`
*   **原因**: `MoGe` 模組未正確安裝或路徑未加入 `sys.path`。
*   **解決**: 參考上述步驟 7 重新安裝，並檢查 `body_service.py` 中的路徑加載邏輯。

### C. `Failed to download model_final_f05665.pkl` / `Connection error`
*   **原因**: 首次運行需要從 Meta 伺服器下載 2.7GB 的 ViTDet 權重。
*   **解決**: 確保網路連線正常，或手動放置權重至 `~/.torch/iopath_cache/`。

### D. `backend.log` 權限問題或路徑報錯
*   **原因**: `start-all.sh` 在新目錄下沒有執行權限。
*   **解決**: 執行 `chmod +x start-all.sh`。

### E. Hugging Face 權限與登入 (Gated Models)
*   **問題**: 執行 `sam-3d-body-dinov3` 時報錯 `Access to model ... is restricted`。
*   **原因**: 該模型是受限模型，需要手動同意協議並在本地登入。
*   **解決步驟**:
    1. 前往 [Hugging Face 模型頁面](https://huggingface.co/facebook/sam-3d-body-dinov3) 點擊 **"Agree and access repository"**。
    2. 在 [Tokens 頁面](https://huggingface.co/settings/tokens) 生成一個 **Read** Token。
    3. 在終端機執行登入（如果 `huggingface-cli` 找不到，請使用 Python 指令）：
       ```powershell
       python -c "from huggingface_hub import interpreter_login; interpreter_login()"
       ```
    4. 貼上 Token 並按 Enter 即可完成授權。

## 5. 前端恢復 (Frontend Recovery)
```bash
cd frontend
npm install
```

---

## 6. Windows 衣服工廠環境配置 (Windows/CUDA Setup)
`sam-3d-objects` 是一個極度依賴 CUDA 的重型模型，建議在具備 NVIDIA GPU (推薦 32GB+ VRAM) 的 Windows 機器上開發。

### 步驟 A: 安裝 Conda
推薦安裝 [Miniconda](https://docs.anaconda.com/miniconda/) 或 Anaconda。

### 步驟 B: 建立環境
```powershell
cd clothing-factory/sam-3d-objects
conda create -n sam3d-objects python=3.11 -y
conda activate sam3d-objects
```

### 步驟 C: 安裝核心 CUDA 依賴
```powershell
# 設定 CUDA 12.4 指向
$env:PIP_EXTRA_INDEX_URL="https://pypi.ngc.nvidia.com https://download.pytorch.org/whl/cu124"

# 安裝基礎
pip install -e ".[dev]"

# 安裝 PyTorch3D (Windows 下編譯較複雜，建議預編譯包或參考官方文件)
pip install -e ".[p3d]"

# 安裝推論組件 (包含 Kaolin)
$env:PIP_FIND_LINKS="https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.5.1_cu121.html"
pip install -e ".[inference]"
```

### 步驟 D: 下載權重
```powershell
pip install huggingface-hub[cli]
hf auth login
huggingface-cli download facebook/sam-3d-objects --local-dir checkpoints/hf
```

### 常見 Windows 錯誤:
1.  **C++ Build Tools 缺失**: 安裝 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) 並勾選 "Desktop development with C++"。
2.  **PyTorch3D 編譯失敗**: Windows 上建議直接安裝 wheels 檔案或使用 WSL2 (Linux 模式)。
3.  **CUDA Out of Memory**: 如果 VRAM 小於 24GB，推論大型場景可能會報錯。
4.  **Utils3D 函數缺失 (ImportError: cannot import name ...)**:
    由於 `EasternJournalist/utils3d` 庫更新頻繁，最新版與專案代碼存在 API 斷代。若遇到 `image_uv` 或 `points_to_normals` 缺失，請將以下橋接代碼追加至 `site-packages/utils3d/numpy/__init__.py` 末尾：
    ```python
    # Manual compatibility bridges
    import numpy as np

    def points_to_normals(points, mask=None):
        h, w = points.shape[:2]
        dx = np.gradient(points, axis=1)
        dy = np.gradient(points, axis=0)
        n = np.cross(dx, dy)
        norm = np.linalg.norm(n, axis=-1, keepdims=True)
        normals = np.divide(n, norm, out=np.zeros_like(n), where=norm!=0)
        normals_mask = mask if mask is not None else np.ones((h, w), dtype=bool)
        return normals, normals_mask

    def image_uv(width, height):
        u, v = np.meshgrid(np.linspace(0, 1, width), np.linspace(0, 1, height))
        return np.stack([u, v], axis=-1)

    def image_mesh(points, colors, uvs, mask=None, tri=True):
        h, w = points.shape[:2]
        if mask is None: mask = np.ones((h, w), dtype=bool)
        indices = np.full((h, w), -1, dtype=np.int32)
        valid_idx = np.where(mask.reshape(-1))[0]
        indices.reshape(-1)[valid_idx] = np.arange(len(valid_idx))
        vertices = points.reshape(-1, 3)[valid_idx]
        vert_colors = colors.reshape(-1, 3)[valid_idx]
        vert_uvs = uvs.reshape(-1, 2)[valid_idx]
        i, j = np.meshgrid(np.arange(h - 1), np.arange(w - 1), indexing='ij')
        v00, v01, v10, v11 = indices[i, j], indices[i, j+1], indices[i+1, j], indices[i+1, j+1]
        m1 = (v00 >= 0) & (v01 >= 0) & (v10 >= 0)
        f1 = np.stack([v00[m1], v01[m1], v10[m1]], axis=-1)
        m2 = (v11 >= 0) & (v01 >= 0) & (v10 >= 0)
        f2 = np.stack([v11[m2], v10[m2], v01[m2]], axis=-1)
        faces = np.concatenate([f1, f2], axis=0)
        return faces, vertices, vert_colors, vert_uvs
    ```


## 7. Windows 運行 SAM 3D Body (高效能 4090 模式)
如果你想在 Windows 上運行人體重建以獲得更高速度，請執行以下步驟：

### 步驟 A: 建立環境
```powershell
cd backend
conda create -n vfitting-body python=3.11 -y
conda activate vfitting-body
```

### 步驟 B: 安裝 CUDA 版 PyTorch
```powershell
# 推薦使用 CUDA 12.4 版本以獲得 RTX 4090 最佳支援
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

### 步驟 C: 安裝依賴
參考 **第 2 章** 的步驟 3, 5, 6, 7, 8。在 Windows 上，`detectron2` 和 `MoGe` 同樣建議使用 `--no-build-isolation`。

### 步驟 D: 啟動
```powershell
python main.py
```

### 步驟 E: 常見問題 (Windows)
1. **路徑無效**: 如果 `npm` 或 `conda` 找不到，請檢查 `C:\Program Files\nodejs` 和 `C:\Users\willw\anaconda3\Scripts` 是否在 PATH 中。
2. **編譯錯誤**: 安裝 `detectron2` 前必須先手動設定 `$env:CUDA_HOME = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4"` 且安裝了 C++ Build Tools。
3. **手動安裝核心組件 (detectron2)**: 如果自動安裝失敗，請開啟 **「x64 Native Tools Command Prompt for VS 2022」** 並執行：
   ```cmd
   rem 1. 修復 Conda 路徑
   set PATH=C:\Users\willw\anaconda3;C:\Users\willw\anaconda3\Scripts;C:\Users\willw\anaconda3\Library\bin;%PATH%
   
   rem 2. 下載源碼到專案目錄
   D:
   cd D:\VTC\IndividualProjects\SourceCode\virtual-fitting-room
   curl.exe -L https://github.com/facebookresearch/detectron2/archive/a1ce2f9.zip -o d2.zip
   powershell -Command "Expand-Archive -Path d2.zip -DestinationPath . -Force"
   
   rem 3. 暫時隱藏 Ninja (避免編譯衝突)
   ren "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe" ninja.exe.bak
   
   rem 4. 進入源碼目錄並安裝
   cd detectron2-a1ce2f9
   conda activate vfitting-body
   pip install wheel setuptools
   set FORCE_CUDA=1
   set DISTUTILS_USE_SDK=1
   set USE_NINJA=0
   set NVCC_FLAGS=-allow-unsupported-compiler
   pip install . --no-build-isolation
   
   rem 5. 安裝成功後，恢復 Ninja
   ren "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe.bak" ninja.exe
   ```
   
   **重要修復**: 如果遇到 `nms_rotated_cuda.cu` 編譯錯誤，需要修改源碼：
   - 在 `detectron2-a1ce2f9/detectron2/layers/csrc/nms_rotated/nms_rotated_cuda.cu` 中，在包含頭文件後添加 `using namespace detectron2;`

4. **手動安裝核心組件 (PyTorch3D)**: 在 **「x64 Native Tools Command Prompt for VS 2022」** 中執行：
   ```cmd
   rem 1. 修復 Conda 路徑
   set PATH=C:\Users\willw\anaconda3;C:\Users\willw\anaconda3\Scripts;C:\Users\willw\anaconda3\Library\bin;%PATH%
   
   rem 2. 暫時隱藏 Ninja (避免編譯衝突)
   ren "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe" ninja.exe.bak
   
   rem 3. 進入 sam3d-objects 環境並安裝
   conda activate sam3d-objects
   pip install wheel setuptools
   set FORCE_CUDA=1
   set DISTUTILS_USE_SDK=1
   set USE_NINJA=0
   set NVCC_FLAGS=-allow-unsupported-compiler
   pip install git+https://github.com/facebookresearch/pytorch3d.git --no-build-isolation
   
   rem 4. 安裝成功後，恢復 Ninja
   ren "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja\ninja.exe.bak" ninja.exe
   ```
   
   **注意**: PyTorch3D 的構建系統會自動檢測並使用 ninja，即使設定了 `USE_NINJA=0`。因此必須暫時隱藏 ninja.exe 才能成功編譯。

## 8. 一鍵啟動腳本 (start-all.ps1) 故障排除
如果在 Windows 執行 `.\start-all.ps1` 失敗：

### A. 權限錯誤 (UnauthorizedAccess)
*   **現象**: 報錯 `因為這個系統上已停用指令碼執行`。
*   **解決**: 
    1. 開啟管理員權限的 PowerShell。
    2. 執行 `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`。
    3. 或使用 `powershell -ExecutionPolicy Bypass -File .\start-all.ps1` 執行。

### B. 後端視窗無內容
*   **現象**: 彈出的後端視窗沒有輸出 log。
*   **原因**: 
    1. 模型正在下載或加載（初次啟動較慢）。
    2. 使用了延遲加載 (Lazy Loading)，需上傳照片後才會觸發日誌。
*   **驗證**: 在主終端機執行 `curl.exe http://localhost:8000/`，若有 JSON 回應代表後端正常。

---
*更新日期: 2026-01-12*
