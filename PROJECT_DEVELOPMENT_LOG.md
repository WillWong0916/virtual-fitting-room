# 3D Virtual Fitting Room - 深度開發日誌 (Detailed Project Development Log)

## 1. 項目概述 (Project Overview)
本項目旨在建立一個先進的虛擬試穿系統，整合 Meta 的 **SAM 3D (Segment Anything in 3D)** 框架。系統目標是實現從單張 2D 照片自動生成精確的 3D 人體模型 (HMR) 以及服裝 3D 重建。

為了優化開發效率並克服硬體限制，本項目採用了 **「前店後廠 (Hybrid Architecture)」** 的開發模式。

---

## 2. 混合開發架構 (Hybrid Architecture - 「前店後廠」)
為了同時兼顧移動展示與重型 AI 計算的需求，我們將專案拆解為兩個核心部分：

### 2.1 MacBook Air (「前店」 - 前端與展示)
*   **角色**: 產品展示終端、UI 開發環境。
*   **職責**:
    *   **React 前端**: 負責用戶介面、上傳流程與 3D 展示。
    *   **展示終端**: 透過 API 呼叫後端模型並展示結果。

### 2.2 Windows Desktop (「後廠」 - 重型生產中心)
*   **角色**: 核心計算與生產環境 (RTX 4090)。
*   **職責**:
    *   **SAM 3D Body**: 人體 3D 重建（極速 CUDA 推理）。
    *   **SAM 3D Objects**: 衣服高品質 3D 重建與材質烘焙。
    *   **API 伺服器**: FastAPI 驅動的後端服務。

### 2.3 專案目錄結構
```text
virtual-fitting-room/          (總專案資料夾)
├── frontend/                  (React 網頁)
├── backend/                   (FastAPI 主伺服器)
│   ├── sam-3d-body/           (人體 AI 模型組件)
│   └── outputs/               (存放生成的模型資源)
└── clothing-factory/          (衣服生產工廠)
    └── sam-3d-objects/        (服裝 AI 模型組件)
```

---

## 3. 開發環境與技術棧 (Stack)
*   **硬體**: NVIDIA RTX 4090 (24GB VRAM) / Mac Mini M4 (輔助)
*   **語言**: Python 3.11
*   **前端**: React 18, Vite, Three.js (@react-three/fiber)
*   **後端**: FastAPI, Uvicorn
*   **AI 核心**: PyTorch 2.4/2.5, Nvdiffrast, Diff-Gaussian-Rasterization, Kaolin, SAM

---

## 4. 詳細開發歷程 (Development Timeline)

### 第 1-11 章：從 Mac 啟動到 Windows 遷移 (2026-01-11)
*   **Mac 適配**: 成功在 Mac M4 上啟用 MPS 加速，但發現推理速度（>5 分鐘）無法滿足生產需求。
*   **Windows 遷移**: 正式將生產環境遷移至 Windows RTX 4090。
*   **依賴攻堅**: 克服了 `detectron2`、`PyTorch3D` 與 `spconv` 在 Windows 下的編譯挑戰。
*   **初步整合**: 打通了從上傳照片到產出基礎 3D 模型的完整 API 鏈路。

### 第 12 章：Windows 環境全線貫通與效能巔峰 (2026-01-12)
*   **效能飛躍**: 3D Body 生成從 Mac 的 5 分鐘縮短至 Windows 的 **3 秒**。
*   **環境定案**: 確立 PyTorch 2.4.0 + CUDA 12.4 + Kaolin 0.17.0 的穩定組合。
*   **SAM 3D Objects 啟動**: 成功運行服裝重建基礎 Demo。

### 第 13 章：高品質材質烘焙與原生渲染器集成 (2026-01-12)
在克服了複雜的環境依賴後，成功啟用了 `sam-3d-objects` 的原生高品質渲染路徑。

#### 1. 高性能渲染器安裝 (Nvdiffrast & Gaussian)
*   **Nvdiffrast**: 成功編譯 NVIDIA 微分渲染器，繞過了 Visual Studio 版本限制。
*   **Gaussian Rasterizer**: 成功安裝官方 `diff-gaussian-rasterization`，解決了 `glm` 子模組缺失問題。
*   **MoGe 整合**: 通過安裝特定版本 `MoGe` 獲取了相容的 `utils3d`，移除了所有臨時 Patch。

#### 2. 材質烘焙技術突破 (Texture Baking)
*   **自動化材質生成**: 實現了從 3D 高斯球數據烘焙出高品質 2D PBR 貼圖的功能。
*   **Bug 深度修復**:
    *   **參數對位**: 修正了 `GaussianRasterizationSettings` 的非標準參數報錯。
    *   **記憶體管理**: 解決了 250 張高品質視角渲染時的 VRAM 溢出問題。
    *   **變數遮蔽**: 修正了 Python 列表推導式導致的邏輯卡死問題。
*   **姿態校正**: 徹底解決了衣服模型「躺平」的問題，實現了正確的「烤雞旋轉（站立旋轉）」與自動置中。

#### 3. 後端架構重構 (Backend Refactor)
*   **服務模組化**: 新增 `ClothesReconstructionService` 單例，將複雜的衣服生成邏輯與人體邏輯解耦。
*   **API 路由拆分**: 建立 `routers/clothes.py`，提升了系統的可擴展性。

---

## 5. 取得成果 (Milestones Achieved)
1.  **滿血版生成器**: 實現了具備高品質貼圖與真實色彩的 3D 服裝生成。
2.  **極速推論**: 渲染 100-250 個視角僅需 1-2 秒，總體 3D 重建在 1 分鐘內完成。
3.  **工業級架構**: 完成了前後端模組化重構，專案具備良好的維護性與擴展性。
4.  **跨平台閉環**: 確立了 Windows 生產模型、Mac/Web 展示成果的「前店後廠」高效模式。

---

## 6. 後續開發計畫 (Future Roadmap)
*   **核心算法**: 研發 3D 服裝與 3D 人體的「動態包裹 (Skinning/Draping)」算法。
*   **前端增強**: 實作衣服與人體的即時組合預覽介面。
*   **自動化流**: 優化 Windows 與 Mac 之間的自動化檔案同步。

---
**日誌維護者**: Cursor AI & User
**最後更新日期**: 2026-01-12
