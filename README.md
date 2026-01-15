# Virtual Fitting Room (虛擬試衣間) - 3D HMR 系統

本項目是一個基於 Meta **SAM 3D (Segment Anything in 3D)** 框架的虛擬試穿系統。系統能夠從單張 2D 照片自動生成高品質的 3D 人體模型 (HMR) 與服裝 3D 模型。

## 🏗 項目架構：「前店後廠 (Hybrid Architecture)」

為了平衡移動開發與高效能 AI 計算，項目採用混合架構：

- **Windows (主要開發與生產環境)**: 利用 RTX 4090 (CUDA) 進行高速 AI 推論。
    - **SAM 3D Body**: 人體生成速度僅需 **3 秒**。
    - **SAM 3D Objects**: 衣服工廠核心，支援高品質材質烘焙。
    - **API 伺服器**: FastAPI 驅動的後端服務。
    - **遠程開發支援**: 提供 SSH 服務，支援 Mac 遠程連接進行開發。
    - **網絡配置**: 配置 DDNS 和 Port Forwarding，支援從外網訪問 Frontend 和 Backend。
- **Mac (遠程開發終端)**: 外出工作時的遠程開發終端。
    - **遠程編碼**: 通過 SSH 連接到 Windows 主機進行遠程開發。
    - **UI/UX 開發**: 負責前端介面開發、移動端測試和優化。
    - **遠程訪問**: 通過 DDNS 和 Port Forwarding 在外地訪問 Windows 主機上的服務。

---

## 🚀 快速開始 (Quick Start)

### 環境配置說明
**重要**: 項目統一使用 `sam3d-objects` Conda 環境，該環境已配置為可同時運行 `sam-3d-body` 和 `sam-3d-objects`。

詳細的安裝步驟和環境配置請參閱 [SETUP_TROUBLESHOOTING.md](./SETUP_TROUBLESHOOTING.md)。

### 1. 後端 (Backend - Windows)
```powershell
# 激活統一環境
conda activate sam3d-objects

# 啟動後端服務
cd backend
python main.py
```

### 2. 前端 (Frontend)
需安裝 Node.js。
```bash
cd frontend
npm install
npm run dev
```

---

## ⚡️ 一鍵啟動 (Windows)
專案提供了一鍵啟動腳本，會同時開啟後端與前端視窗：
```powershell
.\start-all.ps1
```

---

## 🛠 核心功能
- **高品質人體重建**: 從照片生成精確的 3D 人體拓撲（僅需 3 秒）。
- **服裝材質烘焙**: 產出具備真實 PBR 貼圖的 3D 衣服模型。
- **3D 網頁預覽**: 支援 GLB/OBJ 格式的即時 3D 可視化。
- **衣物選擇系統**: 支援預設和動態生成的衣物模型選擇。
- **檔案驗證**: 前端和後端雙重檔案類型與大小驗證。
- **多語言支援**: 支援英文、繁體中文、簡體中文三種語言。
- **響應式設計**: 優化的手機版 UI，支援各種螢幕尺寸。

## 📝 開發日誌
詳細的技術突破與 Bug 修復歷程請參閱 [PROJECT_DEVELOPMENT_LOG.md](./PROJECT_DEVELOPMENT_LOG.md)。
