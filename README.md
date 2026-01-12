# Virtual Fitting Room (虛擬試衣間) - 3D HMR 系統

本項目是一個基於 Meta **SAM 3D (Segment Anything in 3D)** 框架的虛擬試穿系統。系統能夠從單張 2D 照片自動生成精確的 3D 人體模型 (HMR)，並預留了與 3D 衣服模型整合的接口。

## 🏗 項目架構：「前店後廠 (Hybrid Architecture)」

為了平衡移動開發與高效能 AI 計算，項目採用混合架構：

- **Windows (主要開發與生產環境)**: 利用 RTX 4090 (CUDA) 進行高速 AI 推論。
    - **SAM 3D Body**: 生成速度僅需 **3 秒** (對比 Mac > 5 分鐘)。
    - **SAM 3D Objects**: 衣服工廠核心，專供高強度 3D 重建任務。
- **Mac (輔助與行動開發環境)**: 用於 UI/UX 調試、業務邏輯修改及外出展示。支援 MPS 加速，但主要作為展示終端。

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
conda create -n vfitting-body python=3.11
conda activate vfitting-body
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
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

### 3. 衣服工廠 (Clothing Factory - Windows CUDA 巔峰版)
需具備 NVIDIA GPU (建議 RTX 30/40 系列)。
```powershell
cd clothing-factory/sam-3d-objects
# 1. 建立環境
conda create -n sam3d-objects python=3.11
conda activate sam3d-objects
# 2. 安裝特定版本 PyTorch (推薦 2.4.0 以兼容 Kaolin)
pip install torch==2.4.0 torchvision==0.19.0 torchaudio==2.4.0 --index-url https://download.pytorch.org/whl/cu124
# 3. 安裝 Kaolin 預編譯包 (在資料夾內)
pip install kaolin-0.17.0-cp311-cp311-win_amd64.whl
# 4. 安裝高品質渲染器 (Nvdiffrast & Gaussian)
# 請參考 PROJECT_DEVELOPMENT_LOG.md 中的詳細編譯步驟
# 5. 安裝其餘依賴與 Patch (詳見 SETUP_TROUBLESHOOTING.md)
pip install -r requirements.txt
```
> **注意**: 如果遇到 `utils3d` 函數缺失報錯，請參考 `SETUP_TROUBLESHOOTING.md` 中的手動補全方案。


---

## ⚡️ 一鍵啟動 (Windows)
專案提供了一鍵啟動腳本，會同時開啟後端與前端視窗：
```powershell
# 如果是第一次執行，請先以管理員權限執行一次：
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

.\start-all.ps1
```

---

## 🛠 核心功能
- **人體重建**: 上傳照片後，由 `sam-3d-body` 生成 `.obj` 模型。
- **3D 預覽**: 使用 `@react-three/fiber` 在瀏覽器中渲染 3D 人體。
- **混合加速**: 針對 Apple Silicon (M4) 優化的 MPS 推論流程。

## 📝 開發日誌
詳細的技術細節與開發歷程請參閱 [PROJECT_DEVELOPMENT_LOG.md](./PROJECT_DEVELOPMENT_LOG.md)。
