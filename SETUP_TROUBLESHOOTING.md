# 項目搬遷與環境配置故障排除指南 (Setup & Troubleshooting Guide)

本文件紀錄了專案在轉移目錄、更換機器或重新配置環境時遇到的常見問題及其解決方案。

## 1. 核心環境要求 (Core Requirements)
*   **Python 版本**: 必須使用 **Python 3.11**。
    *   *原因*: 許多 AI 組件（如 `MoGe`）使用了 Python 3.10 引入的特性，且 `kaolin` 的預編譯包對 3.11 支援最穩。
    *   *問題*: 如果使用 Python 3.9，會報錯 `name 'ParamSpec' is not defined`。

## 2. 後端環境恢復步驟 (Backend Recovery)
如果你在 Mac 上需要恢復環境：
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install torch torchvision torchaudio
# 安裝特定版本 MoGe 以獲取相容的 utils3d
pip install "MoGe @ git+https://github.com/microsoft/MoGe.git@a8c37341bc0325ca99b9d57981cc3bb2bd3e255b"
```

## 3. AI 模型權重 (AI Models & Weights)
### A. Hugging Face 權限 (Gated Models)
*   **問題**: 報錯 `Access to model ... is restricted`。
*   **解決**: 
    1. 在 Hugging Face 官網同意協議。
    2. 執行 `python -c "from huggingface_hub import interpreter_login; interpreter_login()"` 並輸入 Token。

## 4. Windows 衣服工廠環境配置 (Windows/RTX 4090)
`sam-3d-objects` 高品質渲染需要極其精確的環境配置。

### 步驟 A: 基礎環境
```powershell
conda create -n sam3d-objects python=3.11 -y
conda activate sam3d-objects
pip install torch==2.4.0 torchvision==0.19.0 torchaudio==2.4.0 --index-url https://download.pytorch.org/whl/cu124
# 務必安裝這個特定 commit，它自帶 utils3d-0.0.2，解決所有導入錯誤
pip install "MoGe @ git+https://github.com/microsoft/MoGe.git@a8c37341bc0325ca99b9d57981cc3bb2bd3e255b"
```

### 步驟 B: 安裝高品質渲染器 (Nvdiffrast)
1. 手動下載 `nvdiffrast` 源碼。
2. **關鍵**: 為了繞過 Windows C++ 編譯器版本檢查，執行安裝時設定：
```powershell
$env:SETUPTOOLS_USE_DISTUTILS="stdlib"
$env:NVCC_FLAGS="--allow-unsupported-compiler"
python setup.py install
```

### 步驟 C: 安裝高斯渲染器 (Diff-Gaussian-Rasterization)
1. Clone 官方庫: `https://github.com/graphdeco-inria/diff-gaussian-rasterization`
2. **重要**: 確保 `third_party/glm` 不是空的（若為空，需手動 `git clone https://github.com/g-truc/glm.git` 到該處）。
3. 修改 `setup.py`，在 `extra_compile_args` 的 `nvcc` 中加入 `"--allow-unsupported-compiler"`。
4. 執行 `python setup.py install`。

## 5. 常見高品質渲染錯誤 (Rendering Troubleshooting)

### A. `GaussianRasterizationSettings` 報錯 `unexpected keyword argument 'kernel_size'`
*   **原因**: 使用了官方標準版渲染器，但代碼傳入了非標準參數。
*   **解決**: 在 `gaussian_render.py` 中，將 `GaussianRasterizationSettings` 初始化中的 `kernel_size` 與 `subpixel_offset` 參數移除。

### B. 材質烘焙 (Texture Baking) 卡死或 GPU 溢出
*   **現象**: 顯示 `Baking texture...` 後進度條不走，或 GPU 使用率極低。
*   **解決**: 
    1. 檢查 `postprocessing_utils.py` 裡的 `bake_texture` 函數。
    2. **變數遮蔽修復**: 確保列表推導式沒有使用相同的變數名（如 `[obs for obs in observations]`）。
    3. **記憶體優化**: 在處理大量視角時（如 250 個），將 UV Map 暫存在 CPU (`.cpu()`)，優化時再移回 GPU。

### C. 模型旋轉問題 (Pizza Rotation vs. Rotisserie Chicken)
*   **現象**: 衣服模型橫躺在地上轉。
*   **原因**: 多重座標系轉換衝突（Z-up vs Y-up）。
*   **解決**: 
    1. 註釋掉 `postprocessing_utils.py` 內部的自動旋轉。
    2. 統一在 `clothes_service.py` 透過 `fix_mesh_orientation` 進行旋轉：
       ```python
       rotation = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
       mesh.apply_transform(rotation)
       ```

## 6. Windows 編譯衝突 (Ninja/MSVC)
*   **問題**: 安裝 `detectron2` 或 `PyTorch3D` 時報錯 `ninja` 相關衝突。
*   **解決**: 暫時將 Visual Studio 內的 `ninja.exe` 改名（如 `ninja.exe.bak`），強制使用 MSVC 編譯，安裝完後再改回來。

---
*最後更新日期: 2026-01-12 (高品質渲染版)*
