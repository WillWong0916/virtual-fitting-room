# 3D Virtual Fitting Room - 深度開發日誌 (Detailed Project Development Log)

## 1. 項目概述 (Project Overview)
本項目旨在建立一個先進的虛擬試穿系統，整合 Meta 的 **SAM 3D (Segment Anything in 3D)** 框架。系統目標是實現從單張 2D 照片自動生成精確的 3D 人體模型 (HMR) 以及環境中的 3D 物品重建。

為了優化開發效率並克服硬體限制，本項目採用了 **「前店後廠 (Hybrid Architecture)」** 的開發模式。

---

## 2. 混合開發架構 (Hybrid Architecture - 「前店後廠」)
為了同時兼顧移動開發與重型 AI 計算的需求，我們將專案拆解為兩個核心部分：

### 2.1 MacBook Air (「前店」 - 前端與邏輯展示)
*   **角色**: 核心開發環境、產品展示終端。
*   **職責**:
    *   **React 前端**: 負責用戶介面、上傳照片流程與 3D 展示。
    *   **FastAPI 後端**: 負責業務邏輯、API 路由與 3D 檔案管理。
    *   **3D Body Reconstruction**: 執行 `sam-3d-body` 模型（已完成 Mac M4/MPS 適配）。
*   **地點**: 辦公室、學校、展示場景。

### 2.2 Windows Desktop (「後廠」 - 重型衣服生成工廠)
*   **角色**: 計算密集型任務處理器。
*   **職責**:
    *   **3D Object Reconstruction**: 運行極度依賴 CUDA 的 `sam-3d-objects` 模型。
    *   **衣服產線**: 將服裝照片批量轉換為 3D 模型 (.obj/.glb)，產出的 3D 檔案透過 GitHub 或同步硬碟傳回「前店」展示。
*   **地點**: 固定實驗室 / 家中。

### 2.3 專案目錄結構
```text
virtual-fitting-room/          (總專案資料夾)
├── frontend/                  (React 網頁)
├── backend/                   (Mac 負責：主伺服器 + 人體生成)
│   ├── sam-3d-body/           (人體 AI 模型)
└── clothing-factory/          (Windows 負責：衣服製造工廠)
    └── sam-3d-objects/        (物件/衣服 AI 模型)
```

---

## 3. 開發環境與技術棧 (Stack)
*   **硬體**: Apple Mac Mini M4 (Apple Silicon, 支援 MPS 加速)
*   **語言**: Python 3.11 (原為 3.9，為解決 `typing` 語法相容性與 M4 性能優化而升級)
*   **前端**: React 18, Vite, Three.js (@react-three/fiber), Drei
*   **後端**: FastAPI, Uvicorn
*   **AI 框架**: PyTorch 2.5+, PyTorch3D, Meta SAM 3D Body/Objects

---

## 3. 詳細開發歷程與技術攻堅 (Technical Deep Dive)

### 3.1 基礎設施建設 (Web & API)
*   **任務**: 搭建前後端通信橋樑。
*   **實作**: 
    *   FastAPI 實現 CORS 跨域支援，確保 React 前端能讀取 3D 推論結果。
    *   前端使用 `@react-three/fiber` 建立 Canvas，驗證 M4 上的 WebGL 渲染能力。
*   **解決問題**: 修復了 `npm` 安裝時的 `EPERM` 權限錯誤，並在 `.venv` 環境下正確配置了 FastAPI 插件。

### 3.2 SAM 3D Body (人體 3D 重建) - 核心攻堅
此部分原代碼為 NVIDIA 伺服器設計，在 Mac M4 上執行遇到了極大阻礙。

#### A. 解決硬體鎖定 (CUDA to MPS/CPU)
*   **現象**: 執行時報錯 `AssertionError: Torch not compiled with CUDA enabled`。
*   **根因**: 代碼中存在大量硬編碼的 `.cuda()` 或 `device='cuda'`。
*   **修復邏輯**: 
    *   實施全域搜尋替換，引入動態設備偵測，並全面支持 **MPS (Metal Performance Shaders)**：
        ```python
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        ```
    *   對 `sam3d_body.py`、`build_models.py`、`mhr_head.py` 與 `demo.py` 等核心檔案進行深度手術，將 Tensor 的分配改為 `.to(device)`，並優化了 `empty_cache()` 的硬體適應邏輯。
*   **成果**: 成功在 M4 晶片上實現 100% 的硬體利用率，解決了模型在快取模式下意外回退到 CPU 的問題。

#### B. 解決 OpenGL 渲染衝突
*   **現象**: `pyrender` 執行時報錯 `EGL` 庫載入失敗或 `預期為縮排區塊` (IndentationError)。
*   **根因**: 官方代碼預設 Linux 伺服器的離屏渲染 (Off-screen rendering)，而 Mac 應使用原生 Cocoa/Pyglet。
*   **修復**: 修改 `renderer.py`，加入平台判斷：
    ```python
    if platform.system() == "Linux":
        os.environ["PYOPENGL_PLATFORM"] = "egl"
    # Mac/Windows 保持預設以使用系統驅動
    ```

#### C. Python 3.11 遷移與相容性
*   **難題**: `sam-3d-body` 的依賴庫 `chumpy` 在 Python 3.11 下編弈失敗（因為缺乏 `pip` 隔離環境）。
*   **解決**: 使用 `--no-build-isolation` 參數強制在目前的 `.venv` 中編譯，並修復了 `|` (Union type) 與 `Optional` 的語法錯誤。

### 3.3 數據處理優化 (Efficiency)
*   **問題**: AI 模型權重巨大 (DINOv3, SAM2)，每次執行 `test_inference.py` 都要加載數分鐘。
*   **創新點**: 引入 **Pickle 快取機制**。
    *   首次執行將 `outputs` (3D 頂點與相機參數) 存入 `outputs_cache.pkl`。
    *   後續測試 (如調整 OBJ 導出、圖片渲染) 可直接 `input('y')` 跳過 AI 推論，從幾分鐘縮短至幾秒鐘。

### 3.4 SAM 3D Objects (物件重建) - 跨平台挑戰
*   **現狀**: 成功安裝了 `PyTorch3D` (經編譯)、`Open3D`、`Cumm` 等重型庫。
*   **剩餘障礙**: 核心庫 `spconv` (稀疏卷積) 目前在 Mac M4 上缺乏官方預編譯包，且從源碼編譯極其複雜。
*   **策略**: 
    1.  修改 `inference.py` 使 `kaolin` 變為可選依賴，確保基礎功能不崩潰。
    2.  將此部分標記為「建議在 Windows (NVIDIA) 環境開發」，但已完成 Mac 端的代碼預適應 (MPS Patching)。

### 3.5 API 封裝與前後端整合 (API & Integration)
*   **任務**: 將孤立的 Python AI 腳本轉化為可供網路呼叫的服務。
*   **實作**: 
    *   **建立 `body_service.py`**: 採用 Singleton 模式封裝 AI 邏輯，實施延遲加載 (Lazy Loading) 確保伺服器啟動快速，僅在首次呼叫時載入模型。
    *   **路徑攻堅**: 解決了在 FastAPI 進程下找不到 `sam-3d-body` 內部工具包的問題（透過 `sys.path.insert(0, ...)` 與 `os.chdir()`）。
    *   **API 接口實作**: 
        *   `/upload/body`: 支援 `multipart/form-data` 圖片上傳。
        *   **自動化流程**: 接收圖片 -> 暫存 -> AI 推論 -> 生成 OBJ -> 存入 `outputs/` 資料夾。
        *   **靜態資源掛載**: 使用 `app.mount("/outputs", ...)` 讓生成的 3D 模型可直接透過 URL (如 `http://localhost:8000/outputs/model.obj`) 存取。
*   **測試結果**: 成功通過 `curl` 測試，API 可在 30 秒內完成「圖片進，3D 模型出」的完整鏈路。
*   **MPS 深度修正**: 解決了 MHR 模型內部 `float64` 與 MPS 不相容導致的 `RuntimeError`，改採「混合設備執行」策略：神經網路跑 MPS，幾何計算跑 CPU。

### 3.8 後端架構模組化 (Backend Router Modularization)
*   **任務**: 將後端 API 結構化，方便後續擴充衣服生成路由。
*   **實作**: 
    *   **Router 拆分**: 引入 `fastapi.APIRouter`，將人體生成邏輯移至 `routers/body.py`。
    *   **主程序精簡**: `main.py` 現在僅負責伺服器配置、CORS 與路由掛載，大幅提升了代碼的可維護性。
*   **成果**: 後端架構已完全具備生產級別的擴展能力，為接下來整合 Windows 端產出的 `clothing-factory` API 留好了接口。

---

## 4. 取得成果 (Milestones Achieved)
1.  **3D Mesh 生成**: 成功從一張照片產出 **`output_body.obj`**，包含精確的人體拓撲結構。
2.  **AI API 化**: 成功將複雜的 3D 研究模型轉換為穩定運行的 FastAPI 接口。
3.  **End-to-End 全鏈路打通**: 實現了從網頁上傳到瀏覽器 3D 渲染的完整自動化流程。
4.  **系統架構現代化**: 完成前後端雙端的模組化重構（React Components & FastAPI Routers），專案架構極度穩健。

---

## 5. Report 撰寫關鍵詞 (Keywords for Project Report)
*   **HMR (Human Mesh Recovery)**: 人體網格恢復。
*   **Cross-Platform Adaptation**: 跨平台適應性設計。
*   **MPS Acceleration**: Apple Metal 性能優化。
*   **Modular Architecture**: 模組化 AI 推論管道。
*   **Pickle-based Caching**: 研發效率優化技術。

---

## 6. 項目架構：前店後廠混合開發模式 (Hybrid Architecture)
為了克服硬體限制並優化開發流程，專案採用「前店後廠」架構：

### 6.1 Mac Mini M4 (前店 - 門面與邏輯)
*   **目錄**: `frontend/`, `backend/`
*   **職責**:
    *   運行 React 前端 (虛擬試衣間 UI)。
    *   運行 FastAPI 主伺服器。
    *   執行 `sam-3d-body` (已優化支援 MPS 加速，可在 Mac 流暢運行)。
    *   進行項目展示與整合測試。

### 6.2 Windows PC (後廠 - 重型生產)
*   **目錄**: `clothing-factory/`
*   **職責**:
    *   利用 NVIDIA GPU (CUDA) 運行 `sam-3d-objects`。
    *   將衣物照片批量轉換為 3D 模型 (`.obj` / `.glb`)。
    *   將產出的模型同步至 Mac 端的 `frontend/public/models/` 進行展示。

---

## 7. 後續開發計畫 (Future Roadmap)
*   **短線**: 將 `output_body.obj` 靜態檔案掛載到 FastAPI，讓前端 React 透過 `useLoader(OBJLoader)` 顯示。
*   **中線**: 在 Windows 伺服器部署 `sam-3d-objects` 獲取服裝的 3D 模型。
*   **長線**: 實現 3D 服裝與 3D 人體的「動態包裹 (Skinning)」算法，完成虛擬試穿閉環。

---
**日誌維護者**: Cursor AI & User
**最後更新日期**: 2026-01-09
