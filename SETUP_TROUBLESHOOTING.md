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
# 設定 CUDA 12.1 指向
$env:PIP_EXTRA_INDEX_URL="https://pypi.ngc.nvidia.com https://download.pytorch.org/whl/cu121"

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
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### 步驟 C: 安裝依賴
參考 **第 2 章** 的步驟 3, 5, 6, 7, 8。在 Windows 上，`detectron2` 和 `MoGe` 同樣建議使用 `--no-build-isolation`。

### 步驟 D: 啟動
```powershell
python main.py
```

---
*更新日期: 2026-01-11*
