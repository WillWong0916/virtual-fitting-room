# Virtual Fitting Room (虛擬試衣間) - 3D HMR 系統

本項目是一個基於 Meta **SAM 3D (Segment Anything in 3D)** 框架的虛擬試穿系統。系統能夠從單張 2D 照片自動生成高品質的 3D 人體模型 (HMR) 與服裝 3D 模型。

## 🏗 項目架構：「前店後廠 (Hybrid Architecture)」

為了平衡移動開發與高效能 AI 計算，項目採用混合架構：

- **Windows (主要開發與生產環境)**: 利用 RTX 4090 (CUDA) 進行高速 AI 推論。
    - **SAM 3D Body**: 人體生成速度僅需 **3 秒**。
    - **SAM 3D Objects**: 衣服工廠核心，支援高品質材質烘焙。
- **Mac (輔助與展示環境)**: 用於 UI/UX 調試及成果展示。

---

## 🚀 快速開始 (Quick Start)

### 1. 後端 (Backend - Mac/Windows)
需安裝 Python 3.11+。
#### Windows (Conda 推薦):
```powershell
cd backend
conda create -n vfitting-body python=3.11
conda activate vfitting-body
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt
python main.py
```

### 2. 前端 (Frontend)
需安裝 Node.js。
```bash
cd frontend
npm install
npm run dev
```

### 3. 衣服工廠 (Clothing Factory - Windows CUDA 巔峰版)
需具備 NVIDIA GPU 並安裝高品質渲染組件：
```powershell
cd clothing-factory/sam-3d-objects
# 1. 建立環境
conda create -n sam3d-objects python=3.11
conda activate sam3d-objects

# 2. 安裝特定版本 PyTorch (推薦 2.4.0 以兼容 Kaolin)
pip install torch==2.4.0 torchvision==0.19.0 torchaudio==2.4.0 --index-url https://download.pytorch.org/whl/cu124

# 3. 安裝核心依賴 (MoGe & Utils3D)
pip install "MoGe @ git+https://github.com/microsoft/MoGe.git@a8c37341bc0325ca99b9d57981cc3bb2bd3e255b"

# 4. 安裝高品質渲染器 (Nvdiffrast & Gaussian)
# 詳細編譯步驟請參考 PROJECT_DEVELOPMENT_LOG.md 第 13 章
```

---

## ⚡️ 一鍵啟動 (Windows)
專案提供了一鍵啟動腳本，會同時開啟後端與前端視窗：
```powershell
.\start-all.ps1
```

---

## 🛠 核心功能
- **高品質人體重建**: 從照片生成精確的 3D 人體拓撲。
- **服裝材質烘焙**: 產出具備真實 PBR 貼圖的 3D 衣服模型。
- **3D 網頁預覽**: 支援 GLB/OBJ 格式的即時 3D 可視化。

## 📝 開發日誌
詳細的技術突破與 Bug 修復歷程請參閱 [PROJECT_DEVELOPMENT_LOG.md](./PROJECT_DEVELOPMENT_LOG.md)。
