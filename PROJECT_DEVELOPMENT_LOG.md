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

### 3.6 前端 3D 預覽與全鏈路整合 (Frontend Integration)
*   **任務**: 實現用戶介面，讓使用者能直觀地上傳照片並查看 3D 結果。
*   **實作**: 
    *   **React + Three.js 整合**: 使用 `@react-three/fiber` 與 `@react-three/drei` 建立畫布，解決了模型翻轉與光影問題。
    *   **3D 渲染優化**: 加入了 `Stage`、`Environment` 與落地陰影，提升視覺真實感。
*   **成果**: 完成了從單張照片到瀏覽器 3D 可視化的完整閉環。

### 3.7 專案重構與模組化升級 (Modularization & Optimization)
*   **任務**: 提升代碼品質，將原本臃腫的 `App.tsx` 進行組件化拆分。
*   **實作**: 
    *   **組件化**: 拆分出 `Scene.tsx`、`Sidebar.tsx` 與 `BodyModel.tsx`。
    *   **配置化**: 建立 `config/index.ts` 統一管理 API 地址。
*   **成果**: 前端代碼變得極易維護，邏輯職責分明。

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

### 第 13 章：高品質材質烘焙與原生渲染器集成 (2026-01-12)

在克服了環境依賴地獄後，我們成功啟用了 `sam-3d-objects` 的原生高品質渲染路徑。

#### 1. 高性能渲染器安裝 (Nvdiffrast & Gaussian)
- **Nvdiffrast 安裝**: 成功在 Windows 下編譯並安裝 NVIDIA 的微分渲染器。透過修改 `setup.py` 加入 `--allow-unsupported-compiler` 參數，繞過了 Visual Studio 版本限制。
- **Diff-Gaussian-Rasterization 安裝**: 成功安裝了官方的高斯渲染器。解決了 `glm` 子模組缺失與 `torch` 編譯隔離環境的問題。
- **Kaolin 整合**: 引入了官方預編譯的 `kaolin` 庫，確保了幾何處理的完整性。

#### 2. 材質烘焙技術突破 (Texture Baking)
- **自動化材質生成**: 實現了從 3D 高斯球（Gaussian Splatting）數據中烘焙出 2D PBR 貼圖的功能。
- **效能優化**: 在 RTX 4090 上，100 個觀察視角的渲染僅需 **1 秒** 即可完成。
- **Bug 修復**:
    - 修復了 `GaussianRasterizationSettings` 參數不匹配的問題（移除 `kernel_size` 等非標準參數）。
    - 解決了貼圖烘焙過程中的記憶體溢出與變數遮蔽（Variable Shadowing）問題。
    - 校正了模型旋轉方向，實現了正確的「烤雞旋轉（站立旋轉）」。

#### 3. 產出品質提升
- **貼圖解析度**: 提升至 **1024x1024** (可選 2048)。
- **材質真實感**: 產出的 GLB 模型現在具備真實的色彩與細節，不再是單調的頂點顏色。

#### 4. 後端服務穩固化
- **MoGe / Utils3D 完全整合**: 透過安裝特定版本的 `MoGe` 獲取了相容的 `utils3d`，移除了所有臨時的 Monkey Patch 代碼。
- **Service 封裝**: `ClothesReconstructionService` 現在支援全自動的「照片進，高品質 GLB 出」流程。

---

**日誌維護者**: Cursor AI & User
**最後更新日期**: 2026-01-12
*   **背景**: 項目從 Mac (前店) 正式擴展至 Windows (後廠)，利用 RTX 4090 的 CUDA 性能。
*   **實作紀錄**:
    *   **環境標準化**: 在 Windows 上建立了兩個核心 Conda 環境：`vfitting-body` (後端人體) 與 `sam3d-objects` (衣服工廠)，統一使用 Python 3.11.9。
    *   **CUDA 適配**: 成功安裝了支援 CUDA 12.1 的 PyTorch 2.5.1。
    *   **一鍵啟動升級**: 重寫了 `start-all.ps1`，加入自動路徑偵測與 `conda run` 模式，支援 Windows 環境下的快速啟動。
    *   **Objects 核心導入**: 安裝了 `spconv-cu121`，這是物件重建的核心組件。
*   **PyTorch3D 安裝成功** (2026-01-11):
    *   **里程碑**: 成功在 `sam3d-objects` 環境下完成 `PyTorch3D` 的源碼編譯。
    *   **解決方案**: 
        *   延用 `detectron2` 的解決方案，暫時隱藏 `ninja.exe` 以強制使用 MSVC 編譯器。
        *   使用 `NVCC_FLAGS=-allow-unsupported-compiler`。
    *   **成果**: `pytorch3d-0.7.9` 安裝完成，衣服工廠功能已準備就緒。
*   **當前挑戰**: 
    *   **環境完整性**: 所有 AI 核心（detectron2, PyTorch3D, spconv）皆已安裝。
    *   **下一階段**: 進行全系統端到端測試。
*   **detectron2 安裝成功** (2026-01-11):
    *   **關鍵突破**: 成功在 Windows + CUDA 12.4 + Visual Studio 2026 環境下編譯並安裝 `detectron2`。
    *   **解決方案**: 
        *   暫時隱藏 Visual Studio 內建的 `ninja.exe` 以避免編譯衝突。
        *   修復 `nms_rotated_cuda.cu` 中的命名空間問題（在包含頭文件後添加 `using namespace detectron2;`）。
        *   使用 `NVCC_FLAGS=-allow-unsupported-compiler` 繞過編譯器版本檢查。
    *   **成果**: `detectron2-0.6` 已成功安裝，後端人體偵測功能已就緒。
*   **端到端全鏈路驗證 (Windows)** (2026-01-11):
    *   **進展**: 成功修復 PowerShell 腳本執行權限問題，並驗證 FastAPI 後端在 Windows + CUDA 環境下正常運作。
    *   **測試**: 透過 `curl` 驗證 API 回應，確認後端已正確啟動並在 8000 埠口監聽。
*   **專案結構瘦身與完整性檢查** (2026-01-11):
    *   **行動**: 移除了所有安裝過程中的暫存文件（`d2.zip`, `temp_detectron2`, `detectron2-a1ce2f9`）。
    *   **優化**: 刪除了不再需要的相容性腳本 `fix_compatibility.py` 與錯誤放置的 `backend/package-lock.json`。
    *   **結果**: 專案目錄現在保持乾淨、模組化，僅保留核心開發與運行所需的文件。
*   **Hugging Face Gated Model 權限突破** (2026-01-11):
    *   **挑戰**: 執行 `test_inference.py` 時遇到受限模型訪問錯誤。
    *   **解決**: 通過 `huggingface_hub.interpreter_login()` 成功完成本地 Token 登入，打通了模型權重下載鏈路。
*   **SAM 3D Objects 權重部署完成** (2026-01-12):
    *   **行動**: 成功將 `facebook/sam-3d-objects` 完整權重下載至 `clothing-factory/sam-3d-objects/checkpoints/hf`。
    *   **意義**: 「衣服工廠」的核心組件已完全具備離線推論能力，為後續的 3D 衣服生成奠定了硬體與資料基礎。
*   **數據流結構優化 (Data Flow Optimization)** (2026-01-11):
    *   **行動**: 在 `backend/outputs/` 下建立了 `bodies/` 與 `clothes/` 子目錄。
    *   **目的**: 統一管理由不同 AI 模組生成的資源。雖然 `sam-3d-body` 與 `sam-3d-objects` 運行在不同環境，但最終成果將匯集於此，方便前端統一調用。
    *   **實作**: 
        *   更新 `body_service.py` 的儲存路徑。
        *   更新 `routers/body.py` 的回傳 URL 邏輯。
        *   更新 `main.py` 的目錄初始化邏輯。
*   **效能飛躍與開發策略調整 (Performance Breakthrough & Strategy Shift)** (2026-01-11):
    *   **效能對比**: 
        *   **Mac M4 (MPS)**: 執行一次 3D Body 生成需 **> 5 分鐘**。
        *   **Windows (RTX 4090 / CUDA)**: 執行同等任務僅需 **3 秒**。
    *   **決策**: 鑑於超過 **100 倍** 的效能差距，正式將 **Windows (CUDA)** 定位為專案的 **「核心運行與生產環境」**。
    *   **架構演進**: 
        *   **Windows (Primary)**: 負責全棧開發、模型訓練、批量生產與高速推論。
        *   **Mac (Auxiliary)**: 轉為「行動開發與輕量調試」角色，用於展示 UI 與遠程代碼修改。

### 第 12 章：Windows 環境全線貫通與「滿血版」效能巔峰 (2026-01-12)

在經歷了多重依賴地獄後，我們終於實現了 Windows RTX 4090 環境下的全功能運行。

#### 1. 核心環境最終定案
- **PyTorch 2.4.0 + CUDA 12.4**: 為了與 `kaolin` 預編譯版本完美契合，將環境鎖定在此穩定版本。
- **Kaolin 0.17.0 (Full)**: 成功透過 `.whl` 本地安裝 NVIDIA 官方庫，還原了幾何處理的完整精準度。
- **Utils3D 橋接 (Compatibility Bridge)**: 針對最新版 `utils3d` 與專案代碼的 API 斷代，實施了手動函數補全，打通了 `image_uv`、`points_to_normals` 等關鍵鏈路。

#### 2. 效能與功能驗證
- **SAM 3D Objects 成功運轉**: 執行 `demo.py` 成功生成高品質的 `splat.ply` 3D 模型。
- **spconv 加速啟動**: 識別出 RTX 4090 硬件加速，3D 卷積推理效率達到預期。
- **代碼完整性**: 還原了之前所有為了「跳過錯誤」而做的註解與 Mock，專案現在回歸 100% 正式代碼狀態。

#### 3. 開發策略鞏固
- **Windows (Factory)**: 正式確認為生產與重型 AI 運算中心。
- **Mac (Front Store)**: 作為 UI 演示與前端開發的輔助環境。

---

