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

---

## 7. 技術債務與待優化項目
*   **3D 服裝與人體對齊**: 需要實現動態包裹算法，讓服裝能夠正確貼合人體模型。
*   **前端性能優化**: 考慮使用 React.memo 和 useMemo 優化渲染性能。
*   **錯誤處理增強**: 完善錯誤邊界和用戶友好的錯誤提示。
