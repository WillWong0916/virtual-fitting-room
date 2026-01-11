# Virtual Fitting Room (虛擬試衣間) - 3D HMR 系統

本項目是一個基於 Meta **SAM 3D (Segment Anything in 3D)** 框架的虛擬試穿系統。系統能夠從單張 2D 照片自動生成精確的 3D 人體模型 (HMR)，並預留了與 3D 衣服模型整合的接口。

## 🏗 項目架構：「前店後廠 (Hybrid Architecture)」

為了平衡移動開發與高效能 AI 計算，項目採用混合架構：

- **backend/ (Mac/Windows)**: FastAPI 伺服器，負責業務邏輯與 **SAM 3D Body** 推論。支援 Mac MPS 加速，但在 Windows + RTX 4090 上運行速度最快。
- **frontend/ (Mac/Windows)**: React + Three.js (R3F) 網頁，負責用戶 UI 與 3D 模型展示。
- **clothing-factory/ (Windows/Factory)**: 專門運行 CUDA 密集型的 **SAM 3D Objects** 模型，生產服裝 3D 模型 (.obj / .glb)。

---

## 🚀 快速開始 (Quick Start)

### 1. 後端 (Backend - Mac/Windows)
需安裝 Python 3.11+。
#### Mac:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 main.py
```
#### Windows (Conda):
```powershell
cd backend
conda create -n vfitting python=3.11
conda activate vfitting
pip install -r requirements.txt
python main.py
```

### 2. 前端 (Frontend - Mac)
需安裝 Node.js。
```bash
cd frontend
npm install
npm run dev
```

### 3. 衣服工廠 (Clothing Factory - Windows CUDA)
需具備 NVIDIA GPU。建議使用 **WSL2** 或原生 **Windows PowerShell**。
```powershell
cd clothing-factory/sam-3d-objects
# 建立 conda 環境 (推薦)
conda create -n sam3d-objects python=3.11
conda activate sam3d-objects
# 安裝依賴 (詳見 SETUP_TROUBLESHOOTING.md)
pip install -e .
```

---

## 🛠 核心功能
- **人體重建**: 上傳照片後，由 `sam-3d-body` 生成 `.obj` 模型。
- **3D 預覽**: 使用 `@react-three/fiber` 在瀏覽器中渲染 3D 人體。
- **混合加速**: 針對 Apple Silicon (M4) 優化的 MPS 推論流程。

## 📝 開發日誌
詳細的技術細節與開發歷程請參閱 [PROJECT_DEVELOPMENT_LOG.md](./PROJECT_DEVELOPMENT_LOG.md)。
