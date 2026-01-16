# 3D Virtual Fitting Room - 深度開發日誌 (Detailed Project Development Log)

## 1. 項目概述 (Project Overview)
本項目旨在建立一個先進的虛擬試穿系統，整合 Meta 的 **SAM 3D (Segment Anything in 3D)** 框架。系統目標是實現從單張 2D 照片自動生成精確的 3D 人體模型 (HMR) 以及服裝 3D 重建。

為了優化開發效率並克服硬體限制，本項目採用了 **「前店後廠 (Hybrid Architecture)」** 的開發模式。

---

## 2. 混合開發架構 (Hybrid Architecture - 「前店後廠」)
為了同時兼顧移動展示與重型 AI 計算的需求，我們將專案拆解為兩個核心部分：

### 2.1 MacBook Air (「前店」 - 遠程開發終端)
*   **角色**: 外出工作時的遠程開發終端、UI/UX 開發環境。
*   **職責**:
    *   **遠程編碼**: 通過 SSH 連接到 Windows 主機進行遠程開發。
    *   **React 前端開發**: 負責用戶介面、上傳流程與 3D 展示的開發與測試。
    *   **移動端測試**: 在 Mac 上進行移動端 UI/UX 的測試和優化。
*   **遠程訪問方式**:
    *   使用 SSH 進行遠程編碼和文件同步。
    *   通過 DDNS 和 Port Forwarding 在外地訪問 Windows 主機上的服務。

### 2.2 Windows Desktop (「後廠」 - 重型生產中心)
*   **角色**: 核心計算與生產環境 (RTX 4090)，同時作為開發主機。
*   **職責**:
    *   **SAM 3D Body**: 人體 3D 重建（極速 CUDA 推理）。
    *   **SAM 3D Objects**: 衣服高品質 3D 重建與材質烘焙。
    *   **API 伺服器**: FastAPI 驅動的後端服務。
    *   **遠程開發支援**: 提供 SSH 服務，支援 Mac 遠程連接進行開發。
*   **網絡配置**:
    *   **DDNS 設定**: 配置動態 DNS，確保在外地可以穩定訪問。
    *   **Port Forwarding**: 設定端口轉發，允許從外網訪問 Frontend 和 Backend 服務。
    *   **SSH 服務**: 啟用 SSH 服務，支援遠程編碼和文件管理。

### 2.3 專案目錄結構
```text
virtual-fitting-room/          (總專案資料夾)
├── frontend/                  (React 網頁)
│   ├── src/
│   │   ├── locales/           (多語言翻譯文件)
│   │   │   ├── en.json        (英文)
│   │   │   ├── zh-TW.json     (繁體中文)
│   │   │   └── zh-CN.json     (簡體中文)
│   │   ├── contexts/           (React Context)
│   │   │   └── I18nContext.tsx (多語言 Context)
│   │   └── components/        (React 組件)
├── backend/                   (FastAPI 主伺服器)
│   ├── sam-3d-body/           (人體 AI 模型組件)
│   └── outputs/               (存放生成的模型資源)
└── clothing-factory/          (服裝製作)
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

### 第 14 章：人體重建環境優化與 Detectron2 修復 (2026-01-12)
在整合 `sam-3d-body` 時，解決了環境中的關鍵依賴與導入衝突。

#### 1. Detectron2 深度編譯
*   **編譯挑戰**: 在 Windows 下安裝 `detectron2` 經常失敗。通過「隱藏 Ninja」策略與 `SETUPTOOLS_USE_DISTUTILS="stdlib"` 環境變數，成功完成了本地編譯。
*   **模型載入**: 成功載入 `ViTDet` 人體檢測模型，實現了人體 Bounding Box 的自動提取。

#### 2. 全域導入修復 (utils3d.pt Patch)
*   **問題描述**: `sam-3d-body` 與 `MoGe` 套件對 `utils3d` 的內部引用路徑不一致（`pt` vs `torch`），且 `MoGe v2` 調用了新版本才有的 `depth_map_to_point_map` 函數，導致 `FOV Estimator` 崩潰。
*   **解決方案**: 在 `backend/main.py` 的最頂端實施了全域 **Monkey Patch**。
    *   將 `utils3d.torch` 對應到 `utils3d.pt`。
    *   將 `utils3d.torch.depth_to_points` 別名為 `depth_map_to_point_map`。
    *   強制注入 `sys.modules["utils3d.pt"]` 以支援各類導入語法。
    *   此修正確保了 `sam-3d-body` 的 FOV 推算模組能正常運作。

#### 3. 系統穩定性增強
*   **熱重載優化**: 確保 `uvicorn` 在代碼變更時能正確重新套用 Patch。
*   **除錯日誌**: 增加了環境變數與路徑的啟動診斷資訊。

### 第 15 章：前端 UI/UX 全面升級與多語言系統 (2026-01-13)

#### 1. 設計風格現代化
*   **參考設計**: 參考 `sample-page.html` 的現代化設計風格，採用 Brutalist/Architectural 設計語言。
*   **顏色系統**: 
    *   背景色: `#E3E1DC` (Stone/Concrete)
    *   深色: `#121212`
    *   強調色: `#374336` (Deep Moss)
*   **字體系統**:
    *   顯示字體: `Syncopate` (標題)
    *   正文字體: `Manrope` (正文)
*   **視覺效果**: 添加 noise overlay 紋理效果，提升視覺質感。

#### 2. 動畫與交互增強
*   **GSAP 整合**: 整合 GSAP 和 ScrollTrigger 實現平滑動畫效果。
*   **Lenis 平滑滾動**: 使用 `@studio-freight/lenis` 實現高品質平滑滾動體驗。
*   **Preloader 組件**: 創建載入動畫組件，提升用戶體驗。
*   **Canvas 容器修復**: 修復 canvas 容器高度問題，確保 3D 場景正確填滿可用空間。

#### 3. 多語言國際化系統 (i18n)
*   **翻譯文件結構**: 
    *   創建 `frontend/src/locales/` 目錄
    *   支援三種語言: `en.json` (英文), `zh-TW.json` (繁體中文), `zh-CN.json` (簡體中文)
*   **i18n Context 系統**:
    *   創建 `I18nContext.tsx` 提供多語言 context
    *   自動檢測瀏覽器語言
    *   語言選擇持久化到 localStorage
    *   支援動態參數替換 (如 `{name}`)
*   **語言切換組件**: 
    *   創建 `LanguageSwitcher.tsx` 組件
    *   顯示國旗圖標和語言名稱
    *   響應式設計 (移動端只顯示國旗，桌面端顯示完整名稱)
*   **組件國際化**: 
    *   更新所有組件使用 `useTranslation` hook
    *   `App.tsx`, `FittingRoom.tsx`, `ClothingFactory.tsx`, `Sidebar.tsx`, `Preloader.tsx` 全部支援多語言

#### 4. 導航系統優化
*   **功能整合**: 移除 `nav-modern` 中重複的導航鏈接，統一使用 `mode-switcher-nav` 進行頁面切換。
*   **UI 簡化**: 簡化導航欄結構，保留 Logo、語言切換器和移動端菜單按鈕。

#### 5. 樣式優化
*   **字體顏色加深**: 加深 `.display` 類的顏色，提升可讀性。
*   **響應式改進**: 優化移動端和桌面端的顯示效果。

#### 6. Preloader 與動畫系統增強 (2026-01-13)
*   **Preloader 改進**:
    *   修復 Preloader 顯示問題，確保載入時立即顯示
    *   添加文字淡入動畫和進度條動畫
    *   延長動畫時長至約 3.5 秒，讓用戶能清楚看到載入過程
    *   改進進度條視覺效果（漸變色和陰影）
*   **高級文字動畫工具**:
    *   創建 `textAnimation.ts` 工具函數
    *   支援模糊、縮放、位移等多種視覺效果組合
    *   添加彈性回彈效果，提升動畫質感
    *   使用 `power4.out` 緩動函數，動畫更流暢
*   **標題動畫修復**:
    *   修復標題動畫有時不完整的問題
    *   使用 `gsap.fromTo()` 明確設置起始和結束狀態
    *   確保動畫完成後標題正確顯示

#### 7. UI/UX 細節優化 (2026-01-13)
*   **語言切換器改進**:
    *   移除國旗 emoji，簡化為純文字顯示
    *   添加滑動背景動畫效果
    *   改進 hover 和 active 狀態的視覺反饋
*   **按鈕樣式增強**:
    *   上傳按鈕添加漣漪效果（點擊時從中心擴散）
    *   使用 `cubic-bezier` 緩動函數，動畫更自然
    *   添加陰影效果，提升視覺層次
    *   改進 disabled 狀態的視覺反饋
*   **模式切換器優化**:
    *   增強背景模糊效果（`backdrop-filter: blur(20px)`）
    *   改進陰影層次（多層陰影）
    *   添加 hover 動畫和滑動背景效果
    *   統一視覺語言和動畫時長

#### 8. 預設模型自動載入 (2026-01-13)
*   **初始化改進**:
    *   頁面載入時自動顯示第一個預設 body 模型
    *   不再顯示空白正方體，直接展示 3D 人體模型
    *   側邊欄自動標記第一個預設模型為已選中狀態
    *   提升用戶首次體驗，無需手動選擇即可看到效果

### 第 16 章：統一模型管理與隱私保護 (2026-01-13)

#### 1. 統一模型存儲架構
*   **預設模型集中管理**:
    *   將預設 Body 模型移至 `backend/outputs/bodies/presets/` 目錄
    *   將預設 Clothing 模型移至 `backend/outputs/clothes/presets/` 目錄
    *   統一使用後端 API 提供模型列表，移除前端硬編碼
*   **API 端點擴展**:
    *   新增 `GET /bodies` 端點，返回所有預設 Body 模型
    *   更新 `GET /clothes` 端點，支援預設和動態生成的模型
    *   前端改為從 API 動態獲取模型列表

#### 2. 用戶隱私保護
*   **模型可見性控制**:
    *   `get_all_bodies()` 默認只返回預設模型 (`presets_only=True`)
    *   普通用戶在 FittingRoom 頁面只能看到預設 Body 模型
    *   用戶上傳的模型不會被其他用戶看到
    *   ClothingFactory 作為管理員頁面，仍可查看所有生成的衣物模型
*   **安全隔離**:
    *   動態生成的模型存儲在 `backend/outputs/bodies/` 和 `backend/outputs/clothes/` 根目錄
    *   預設模型存儲在各自的 `presets/` 子目錄中
    *   API 層面實現訪問控制，確保隱私安全

#### 3. 代碼清理與優化 (2026-01-13)
*   **移除未使用代碼**:
    *   刪除 `frontend/src/constants/presets.ts`（已改為 API 獲取）
    *   移除 `backend/routers/clothes.py` 中未使用的 `asyncio` 導入
    *   更新 API 文檔，移除未使用的端點說明
*   **代碼質量提升**:
    *   確保所有保留的代碼都有明確用途
    *   優化導入語句，移除冗餘依賴
    *   保持代碼庫整潔，提升可維護性

### 第 17 章：Fitting Room 功能擴展與用戶體驗優化 (2026-01-15)

#### 1. 衣物選擇功能實現
*   **Sidebar 標籤頁系統**:
    *   在 Sidebar 組件中添加標籤頁切換功能（「人體模型」/「衣物」）
    *   實現標籤頁的 active 狀態指示和動畫效果
    *   優化標籤頁樣式，使用底部下劃線動畫
*   **衣物列表顯示**:
    *   從後端 API (`/clothes/`) 獲取衣物列表
    *   使用與人體模型相同的卡片樣式，保持 UI 一致性
    *   支援預設衣物和動態生成衣物的顯示
    *   優先顯示預設模型，然後顯示用戶生成的模型
*   **試衣功能提示**:
    *   創建 Toast 彈出提示組件，用於顯示重要訊息
    *   當用戶點選衣物時，顯示「暫時未能提供試衣服務」的提示
    *   Toast 組件使用 GSAP 動畫，從底部滑入並自動消失
    *   提供清晰的視覺反饋，告知用戶功能狀態

#### 2. 檔案上傳驗證系統
*   **前端驗證工具**:
    *   創建 `fileValidation.ts` 統一驗證工具函數
    *   支援檔案類型驗證（JPG, PNG, WEBP）
    *   支援檔案大小驗證（預設最大 10MB，可配置）
    *   返回詳細的驗證結果和錯誤訊息
*   **前端頁面整合**:
    *   在 `FittingRoom.tsx` 和 `ClothingFactory.tsx` 中整合檔案驗證
    *   驗證失敗時顯示 Toast 提示，提供清晰的錯誤訊息
    *   驗證失敗時重置 input，避免重複提交
*   **後端雙重保護**:
    *   在 `backend/routers/body.py` 中添加檔案類型和大小驗證
    *   在 `backend/routers/clothes.py` 的兩個上傳端點中添加驗證
    *   驗證失敗時返回 HTTP 400 錯誤和詳細錯誤訊息
    *   確保前後端都有完整的驗證機制，提升系統安全性
*   **多語言支援**:
    *   在三個語言文件中添加驗證錯誤訊息翻譯
    *   `invalidFileType`: 不支援的檔案類型提示
    *   `fileTooLarge`: 檔案大小超過限制提示
    *   `fileRequired`: 請選擇要上傳的檔案提示

#### 3. 手機版 UI 優化
*   **Logo 文字顯示優化**:
    *   修復手機版 Logo 文字被截斷的問題
    *   允許文字換行顯示（移除 `white-space: nowrap`）
    *   在手機版（≤768px）增加字體大小至 `0.8rem`，`max-width` 至 `45%`
    *   在超小螢幕（≤480px）進一步優化顯示效果
    *   "VIRTUAL FITTING" 現在可以在手機版自動換行成兩行顯示
*   **Sidebar Tabs 溢出修復**:
    *   修復手機版 Sidebar tabs 按鈕溢出容器的問題
    *   在 `presets-panel` 添加 `overflow-x: hidden` 防止溢出
    *   優化按鈕間距（`gap` 從 `0.5rem` 減少到 `0.25rem`）
    *   減少按鈕 padding 和字體大小，確保在小螢幕上正常顯示
    *   添加 `min-width: 0` 確保 flex 項目可以正確縮小
    *   在超小螢幕（≤480px）進一步優化間距和字體

#### 4. Toast 通知組件
*   **組件設計**:
    *   創建 `Toast.tsx` 組件，提供統一的彈出提示功能
    *   使用 GSAP 實現流暢的滑入/滑出動畫
    *   支援自定義訊息和顯示時長（預設 3 秒）
    *   自動關閉機制，無需手動處理
*   **樣式設計**:
    *   深色半透明背景，毛玻璃效果（backdrop-filter）
    *   置中顯示在畫面底部，不遮擋主要內容
    *   響應式設計，適配各種螢幕尺寸
    *   包含警告圖標（⚠️）和訊息文字
*   **應用場景**:
    *   檔案驗證錯誤提示
    *   試衣功能未實裝提示
    *   未來可擴展用於其他通知場景

### 第 17.5 章：3D 模型手動旋轉調整功能實現 (2026-01-15)

#### 1. 功能需求與設計決策
*   **問題背景**:
    *   原本嘗試使用自動方向修正（基於 bounding box 尺寸判斷「窄」或「闊」服裝類型）
    *   發現自動判斷不可靠，不同服裝類型的初始 bounding box 尺寸差異很大
    *   無法找到一個通用的規則來準確判斷正確的旋轉策略
*   **設計決策**:
    *   從自動判斷改為**用戶手動調整**的方式
    *   在 GLB 文件生成後，自動跳轉到專用的旋轉調整頁面
    *   用戶可以以 90° 為單位調整 X、Y、Z 軸旋轉
    *   保存後返回衣物庫頁面，移除服裝類型選擇功能

#### 2. 後端實現
*   **移除自動方向修正**:
    *   刪除 `fix_mesh_orientation`、`fix_mesh_orientation_slim`、`fix_mesh_orientation_wide` 函數（約 150 行代碼）
    *   移除 `process_image` 方法中的 `garment_type` 和 `auto_fix_orientation` 參數
    *   簡化為只執行初始的接地與置中操作
*   **旋轉 API 端點**:
    *   創建 `RotateRequest` Pydantic 模型，接收 `filename` 和 `rotation_x/y/z`（以 90° 為單位）
    *   實現 `POST /clothes/rotate` 端點：
        *   載入 GLB 文件（使用 `trimesh`）
        *   應用旋轉矩陣（基於 `rotation_x/y/z * π/2`）
        *   自動執行接地與置中優化（確保模型底部對齊 Y=0，X/Z 置中）
        *   保存回原文件
*   **移除服裝類型選擇**:
    *   刪除 `GARMENT_TYPES` 常量和 `/clothes/garment-types` GET 端點
    *   簡化上傳流程，不再需要用戶選擇服裝類型

#### 3. 前端實現
*   **旋轉調整頁面** (`RotateCloth.tsx`):
    *   從 URL 參數獲取 `model_url` 和 `filename`
    *   使用 `@react-three/fiber` 和 `@react-three/drei` 顯示 3D 預覽
    *   實現 X、Y、Z 軸的 +/- 90° 旋轉按鈕
    *   即時更新 3D 模型顯示（使用 `useEffect` 監聽旋轉狀態變化）
    *   Reset 按鈕重置所有旋轉為 0
    *   Save & Finish 按鈕調用後端 API 保存旋轉並跳轉回 `/admin`
*   **路由配置**:
    *   在 `App.tsx` 中添加 `/admin/rotate` 路由
*   **上傳流程更新** (`ClothingFactory.tsx`):
    *   移除 `garmentType` 狀態和下拉選單 UI
    *   上傳成功後，自動導航到 `/admin/rotate?model_url=...&filename=...`
    *   添加 "Edit" 按鈕，允許用戶重新調整已生成的模型旋轉

#### 4. 遇到的問題與解決方案

##### 問題 1: 3D 模型緩存導致旋轉不更新
*   **問題描述**:
    *   用戶在旋轉頁面調整並保存後，返回衣物庫頁面查看時，3D 模型的面向和旋轉都沒有變化
    *   即使後端已經成功保存了修改後的 GLB 文件，前端仍然顯示舊的模型
*   **根本原因**:
    *   `useGLTF` hook 會緩存已載入的 GLB 模型
    *   即使文件內容已更新，React Three Fiber 仍使用緩存中的舊模型
    *   URL 查詢參數（如 `?t=timestamp`）對 `useGLTF` 的文件類型檢測可能造成問題
*   **解決方案**:
    *   **方案 1 - Cache Key 機制**:
        *   在 `ClothingFactory.tsx` 中添加 `previewCacheKey` 狀態
        *   當點擊模型預覽或從旋轉頁面返回時，更新 `cacheKey`（使用 `Date.now()`）
        *   將 `cacheKey` 作為 prop 傳遞給 `ClothViewer` 組件
    *   **方案 2 - 強制清除緩存**:
        *   在 `ClothViewer.tsx` 的 `Model` 組件中，使用 `useEffect` 監聽 `cacheKey` 或 `url` 變化
        *   當變化時，調用 `useGLTF.clear(url)` 清除該 URL 的緩存
        *   使用 `key={cacheKey}` 強制 `Model` 組件重新掛載
    *   **方案 3 - 組件卸載時清理**:
        *   在 `ClothingFactory.tsx` 的 `useEffect` cleanup 函數中，調用 `useGLTF.clear()` 清除整個緩存
        *   確保頁面切換時不會殘留舊緩存
*   **最終實現**:
    *   組合使用以上三種方案，確保緩存正確更新：
        *   傳遞 `cacheKey` 到 `ClothViewer`
        *   在 `Model` 組件中監聽 `cacheKey` 變化並清除緩存
        *   使用 `key={cacheKey}` 強制重新掛載
        *   頁面卸載時清除整個緩存

##### 問題 2: URL 查詢參數影響文件類型檢測
*   **問題描述**:
    *   使用 `url?t=timestamp` 進行緩存破壞時，`useGLTF` 可能無法正確識別文件類型
    *   導致模型載入失敗或顯示黑屏
*   **解決方案**:
    *   將原始 URL（不含查詢參數）傳遞給 `useGLTF`
    *   緩存破壞通過 `cacheKey` 和 `key` prop 實現，而非 URL 查詢參數
    *   確保 `useGLTF` 能正確識別 `.glb` 文件類型

#### 5. 修改的文件
*   **後端**:
    *   `backend/clothes_service.py`:
        *   移除 `fix_mesh_orientation`、`fix_mesh_orientation_slim`、`fix_mesh_orientation_wide` 函數
        *   簡化 `process_image` 方法簽名（移除 `garment_type` 和 `auto_fix_orientation` 參數）
        *   保留初始的接地與置中邏輯
    *   `backend/routers/clothes.py`:
        *   移除 `GARMENT_TYPES` 常量和 `garment_type` Form 參數
        *   添加 `RotateRequest` Pydantic 模型
        *   實現 `POST /clothes/rotate` 端點
        *   移除 `/clothes/garment-types` GET 端點
*   **前端**:
    *   `frontend/src/pages/RotateCloth.tsx` (新文件):
        *   創建專用的旋轉調整頁面組件
        *   實現 3D 預覽和旋轉控制 UI
        *   處理保存和導航邏輯
    *   `frontend/src/pages/ClothingFactory.tsx`:
        *   移除 `garmentType` 狀態和相關 UI
        *   上傳成功後導航到旋轉頁面
        *   添加 `previewCacheKey` 狀態管理
        *   添加 "Edit" 按鈕
        *   實現緩存清理邏輯
    *   `frontend/src/components/ClothViewer.tsx`:
        *   添加 `cacheKey` prop
        *   實現緩存清除和強制重新掛載邏輯
    *   `frontend/src/App.tsx`:
        *   添加 `/admin/rotate` 路由
    *   `frontend/src/locales/*.json`:
        *   添加旋轉頁面相關翻譯（`rotateCloth.title`、`rotateCloth.axis`、`rotateCloth.saveAndFinish` 等）
        *   移除未使用的 `download` 和 `downloadDisabled` 翻譯

#### 6. 技術總結
*   **設計理念**: 從不可靠的自動判斷改為用戶可控的手動調整，提升準確性和用戶體驗
*   **緩存管理**: 深入理解 React Three Fiber 的 `useGLTF` 緩存機制，實現多層次的緩存清理策略
*   **用戶流程**: 上傳 → 生成 → 調整 → 保存 → 查看，流程清晰且直觀

### 第 18 章：編譯優化嘗試與回退 (2026-01-15)

#### 1. 編譯優化嘗試
*   **目標**: 嘗試啟用 `torch.compile()` 以提升 Clothes 模型推理性能（預期提升 20-50%）
*   **實現方式**:
    *   在 `clothes_service.py` 中添加編譯嘗試邏輯
    *   檢查 triton 是否可用，然後嘗試使用 `compile=True` 加載模型
    *   實現錯誤處理和自動降級機制
*   **遇到的問題**:
    *   **Windows 緩存競態條件**: `torch.compile()` 在寫入緩存文件時發生 `FileExistsError: [WinError 183]`
    *   **Warmup 階段失敗**: 編譯在 warmup 階段（實際運行推理）時失敗，拋出 `InstantiationException`
    *   **suppress_errors 無效**: 即使設置了 `torch._dynamo.config.suppress_errors = True`，warmup 階段的錯誤仍會導致失敗
    *   **多次重試失敗**: 嘗試了預先清理緩存、使用 `suppress_errors` 重試等多種方法，均無法解決問題

#### 2. 問題分析
*   **根本原因**: 根據 [triton-windows 文檔](https://github.com/woct0rdho/triton-windows)，這是 Windows 上 `torch.compile()` 的已知問題
*   **可能的解決方案**:
    *   啟用 Windows 長路徑支持（需要重啟系統）
    *   升級到 PyTorch 2.6+（如果問題已修復）
    *   使用較低的編譯模式（需要修改源碼）
*   **決策**: 由於問題持續且需要系統級修改，決定回退到簡單的 eager 模式

#### 3. 代碼回退
*   **簡化 `clothes_service.py`**:
    *   移除了所有編譯嘗試邏輯（約 200+ 行代碼）
    *   移除了 `is_compiled()` 和 `get_compile_info()` 方法
    *   簡化 `load_model()` 方法，直接使用 `compile=False`
    *   移除了所有 triton 相關的檢查和錯誤處理
*   **簡化 `main.py`**:
    *   移除了健康端點中的編譯狀態檢查
    *   健康端點現在只顯示基本的模型加載狀態
*   **清理測試文件**:
    *   刪除了 `check_compile_status_simple.py`
    *   刪除了 `clear_torch_cache.py`
    *   刪除了 `test_triton_compatibility.py`
    *   刪除了 `TRITON_TEST_GUIDE.md`
    *   刪除了 `diagnose_compile.py`
    *   刪除了 `check_compile_status.py`

#### 4. 最終狀態
*   **模型加載**: 直接使用 `compile=False`（eager 模式）
*   **穩定性**: ✅ 完全穩定，無編譯相關錯誤
*   **啟動速度**: ✅ 更快（跳過編譯嘗試，節省 30-60 秒）
*   **推理速度**: ⚠️ 較慢（約慢 20-50%），但可接受
*   **代碼簡潔性**: ✅ 代碼更簡潔，易於維護

#### 5. 技術總結
*   **經驗教訓**: Windows 上 `torch.compile()` 的兼容性問題較多，需要謹慎使用
*   **未來方向**: 等待 PyTorch 官方修復 Windows 編譯問題，或考慮使用 WSL2 環境
*   **當前策略**: 優先考慮穩定性和開發效率，性能優化可以後續處理
*   **修改的文件**:
    *   `backend/clothes_service.py`: 
        *   簡化 `load_model()` 方法，移除所有編譯嘗試邏輯（約 200+ 行代碼）
        *   移除 `is_compiled()` 和 `get_compile_info()` 方法
        *   直接使用 `compile=False`（eager 模式）
        *   簡化環境變數註釋（移除 triton-windows 相關說明）
    *   `backend/main.py`: 
        *   移除健康端點中的編譯狀態檢查（`compiled` 和 `compile_mode` 字段）
        *   簡化環境變數註釋
*   **刪除的文件**:
    *   `backend/check_compile_status_simple.py` - 編譯狀態檢查腳本（通過 API）
    *   `backend/clear_torch_cache.py` - 清理緩存腳本
    *   `backend/test_triton_compatibility.py` - triton 兼容性測試
    *   `backend/TRITON_TEST_GUIDE.md` - triton 測試指南
    *   `backend/diagnose_compile.py` - 編譯診斷腳本
    *   `backend/check_compile_status.py` - 編譯狀態檢查腳本（詳細版）

### 第 19 章：試衣間 UI/UX 響應式優化與滾動修復 (2026-01-16)

#### 1. 桌面版左側垂直列表佈局
*   **佈局重構**:
    *   將桌面版（> 768px）的 Sidebar 從底部橫向滾動改為左側垂直列表
    *   `main-content` 使用 `flex-direction: row`，Sidebar 固定在左側（`width: 320px`）
    *   Scene 容器佔據右側剩餘空間（`flex: 1`），實現左右分欄佈局
    *   使用 `order` 屬性控制元素順序（Sidebar `order: 1`，Scene `order: 2`）
    *   優化視覺層次，提升桌面端使用體驗
*   **樣式優化**:
    *   Sidebar 使用 `overflow-y: auto` 實現垂直滾動，`overflow-x: hidden` 防止橫向滾動
    *   縮圖比例改為 `3:4`（`aspect-ratio: 3/4`），更適合垂直列表顯示
    *   調整卡片樣式：
        *   移除圓角（`border-radius: 0`）和陰影（`box-shadow: none`）
        *   採用更簡潔的邊框設計（`border: 1px solid rgba(18, 18, 18, 0.1)`）
        *   背景改為透明（`background: transparent`）
    *   優化間距和字體大小：
        *   Sidebar padding: `2rem`
        *   卡片間距: `gap: 1.25rem`
        *   標題字體: `0.875rem`，文字字體: `0.75rem`
*   **滾動條美化**:
    *   自定義滾動條樣式（寬度 6px，半透明設計）
    *   滾動條軌道: `rgba(18, 18, 18, 0.05)`
    *   滾動條滑塊: `rgba(18, 18, 18, 0.2)`，hover 時變為 `rgba(18, 18, 18, 0.3)`
    *   添加 hover 效果，提升交互體驗
    *   使用 `scrollbar-width: thin`（Firefox）和 `-webkit-overflow-scrolling: touch`（iOS）優化滾動性能

#### 2. 手機版保持底部橫向滾動
*   **響應式設計**:
    *   手機版（≤ 768px）保持底部橫向滾動（Roll 模式）
    *   `main-content` 使用 `flex-direction: column`，Sidebar 在底部（`order: 2`）
    *   Scene 容器在上方（`order: 1`）
    *   使用 `@media (max-width: 768px)` 媒體查詢實現響應式切換
    *   Sidebar 寬度改為 `100%`，高度 `auto`，`min-height: 250px`
*   **樣式保持**:
    *   手機版縮圖使用 `1:1` 方形比例（`aspect-ratio: 1/1`），適合橫向滾動
    *   保持卡片圓角（`border-radius: 12px`）和陰影效果（`box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05)`），維持視覺一致性
    *   卡片固定寬度：`flex: 0 0 140px`（768px 以下），`flex: 0 0 120px`（480px 以下）
    *   優化間距和字體大小，確保小螢幕上的可讀性
    *   Sidebar tabs 在手機版使用較小的間距和字體

#### 3. 滑鼠滾輪滾動修復
*   **問題診斷**:
    *   發現桌面版滾動條出現但滑鼠滾輪無法滾動的問題
    *   分析發現可能是子元素攔截滾動事件或 CSS 設置不當
    *   檢查發現 `.presets-list` 和 `.presets-panel` 都設置了 `overflow-y: auto`，導致滾動事件衝突
*   **根本原因**:
    *   雙層滾動容器：`.presets-panel` 和 `.presets-list` 都設置了 `overflow-y: auto`
    *   滾動事件被 `.presets-list` 攔截，但 `.presets-list` 的內容沒有超出其高度，所以無法滾動
    *   Flex 子元素的高度計算問題：`.presets-list` 沒有明確的高度限制，導致瀏覽器無法判斷是否需要滾動
*   **CSS 優化**:
    *   將滾動設置從 `.presets-list` 移到 `.presets-panel`（外層容器）
    *   `.presets-list` 設置 `overflow: visible`，讓它自然擴展，不再作為滾動容器
    *   添加 `overscroll-behavior: contain` 防止滾動事件外洩到父容器
    *   確保 flex 子元素正確設置：
        *   `.presets-panel`: `min-height: 0`（允許 flex 收縮）
        *   `.presets-list`: `flex: 1 1 auto`（佔據剩餘空間）和 `min-height: 0`（允許收縮）
    *   添加 `position: relative` 和 `will-change: scroll-position` 優化滾動性能
*   **JavaScript 滾動處理**:
    *   在 `Sidebar.tsx` 組件中添加 `wheel` 事件監聽器作為備用方案
    *   使用 `capture: true` 確保事件在捕獲階段處理，優先於子元素
    *   實現邊界檢測（頂部/底部），防止過度滾動：
        *   檢查 `scrollTop === 0`（頂部）和 `scrollTop + clientHeight >= scrollHeight - 1`（底部）
        *   在邊界時允許事件繼續傳播，不在邊界時手動執行滾動
    *   當內容可滾動且不在邊界時，手動執行 `panel.scrollTop += e.deltaY` 並阻止默認行為
*   **解決方案組合**:
    *   主要依靠 CSS 優化（正確的滾動容器設置）
    *   JavaScript 事件處理作為備用方案，確保在所有情況下都能正常滾動
    *   兩者結合確保了滾動功能的可靠性
*   **最終效果**:
    *   ✅ 桌面版左側列表可以正常使用滑鼠滾輪滾動
    *   ✅ 手機版底部橫向滾動保持正常
    *   ✅ 滾動條樣式美觀，交互流暢
    *   ✅ 滾動性能優化，無卡頓現象

#### 4. 修改的文件
*   **`frontend/src/App.css`**:
    *   重構 `.main-content` 和 `.presets-panel` 的佈局設置
        *   `.main-content`: `flex-direction: row`（桌面端），`flex-direction: column`（手機端）
        *   `.presets-panel`: 桌面端固定寬度 `320px`，手機端 `100%`
    *   添加桌面端和手機端的響應式樣式（`@media (max-width: 768px)`）
    *   優化滾動相關 CSS 屬性：
        *   將 `overflow-y: auto` 從 `.presets-list` 移到 `.presets-panel`
        *   添加 `overscroll-behavior: contain`
        *   設置 flex 子元素的 `min-height: 0` 和 `flex` 屬性
    *   添加自定義滾動條樣式（`.presets-panel::-webkit-scrollbar`）
    *   調整縮圖比例、卡片樣式、間距等視覺元素
*   **`frontend/src/components/Sidebar.tsx`**:
    *   導入 `useRef` 和 `useEffect` hooks
    *   添加 `panelRef` 引用指向 `presets-panel` DOM 元素
    *   實現 `wheel` 事件處理邏輯：
        *   檢查內容是否可滾動（`scrollHeight > clientHeight`）
        *   實現邊界檢測（頂部/底部）
        *   手動執行滾動並阻止默認行為（當不在邊界時）
        *   使用 `capture: true` 和 `passive: false` 選項
    *   確保滾動事件能正確傳播和處理

#### 5. 技術總結
*   **響應式設計原則**: 桌面端和手機端使用不同的佈局策略，充分利用各自的螢幕空間
*   **滾動容器設計**: 避免雙層滾動容器，確保只有一個明確的滾動容器
*   **Flex 佈局注意事項**: 
    *   Flex 子元素需要設置 `min-height: 0` 才能正確收縮
    *   滾動容器需要明確的高度限制（`height: 100%` 或 `max-height`）
*   **事件處理策略**: CSS 優化為主，JavaScript 事件處理作為備用方案，確保功能的可靠性
*   **用戶體驗優先**: 桌面端垂直列表更適合瀏覽大量項目，手機端橫向滾動更符合觸摸操作習慣

---

## 7. 技術債務與待優化項目
*   **3D 服裝與人體對齊**: 需要實現動態包裹算法，讓服裝能夠正確貼合人體模型。
*   **前端性能優化**: 考慮使用 React.memo 和 useMemo 優化渲染性能。
*   **錯誤處理增強**: 完善錯誤邊界和用戶友好的錯誤提示。
*   **試衣功能實裝**: 實現衣物套上人體的 3D 渲染功能（待開發）。
