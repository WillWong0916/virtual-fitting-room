# 編譯優化回退變更日誌

**日期**: 2026-01-15  
**原因**: Windows 上 `torch.compile()` 在 warmup 階段失敗，無法穩定運行  
**參考**: [triton-windows 已知問題](https://github.com/woct0rdho/triton-windows)

## 修改的文件

### 1. `backend/clothes_service.py`

#### 變更前
- `load_model()` 方法包含約 200+ 行編譯嘗試邏輯
- 包含 `is_compiled()` 和 `get_compile_info()` 方法
- 包含 triton 檢查、緩存清理、錯誤處理等複雜邏輯
- 嘗試使用 `compile=True`，失敗後降級到 `compile=False`

#### 變更後
- `load_model()` 方法簡化為約 20 行
- 直接使用 `compile=False`（eager 模式）
- 移除所有編譯相關方法
- 移除所有 triton 相關檢查
- 簡化環境變數註釋

**關鍵變更**:
```python
# 變更前（複雜邏輯）
compile_enabled = True
try:
    import triton
    # ... 大量編譯嘗試邏輯 ...
except Exception:
    # ... 錯誤處理和降級邏輯 ...
    self.inference = Inference(str(config_path), compile=False)

# 變更後（簡潔）
self.inference = Inference(str(config_path), compile=False)
```

### 2. `backend/main.py`

#### 變更前
- 健康端點包含編譯狀態檢查
- 返回 `compiled` 和 `compile_mode` 字段

#### 變更後
- 健康端點只顯示基本模型狀態
- 移除編譯相關字段

**關鍵變更**:
```python
# 變更前
clothes_compile_info = clothes_service.get_compile_info()
return {
    "clothes": {
        "loaded": ...,
        "compiled": clothes_compile_info["compiled"],
        "compile_mode": clothes_compile_info["mode"]
    }
}

# 變更後
return {
    "clothes": {
        "loaded": ...,
        "device": ...
    }
}
```

## 刪除的文件

1. `backend/check_compile_status_simple.py` - 編譯狀態檢查腳本（通過 API）
2. `backend/clear_torch_cache.py` - 清理緩存腳本
3. `backend/test_triton_compatibility.py` - triton 兼容性測試
4. `backend/TRITON_TEST_GUIDE.md` - triton 測試指南
5. `backend/diagnose_compile.py` - 編譯診斷腳本
6. `backend/check_compile_status.py` - 編譯狀態檢查腳本（詳細版）

## 保留的內容

- `SETUPTOOLS_USE_DISTUTILS='stdlib'` 環境變數（仍需要，用於其他依賴）
- 基本的模型加載功能（使用 `compile=False`）

## 影響評估

### 正面影響
- ✅ **穩定性**: 完全穩定，無編譯相關錯誤
- ✅ **啟動速度**: 更快（跳過編譯嘗試，節省 30-60 秒）
- ✅ **代碼簡潔性**: 代碼更簡潔，易於維護
- ✅ **開發效率**: 減少調試時間

### 負面影響
- ⚠️ **推理速度**: 較慢（約慢 20-50%），但可接受
- ⚠️ **性能優化**: 暫時無法使用編譯加速

## 當前狀態

- **模型加載**: 直接使用 `compile=False`（eager 模式）
- **功能**: ✅ 完全正常
- **穩定性**: ✅ 完全穩定
- **性能**: ⚠️ 可接受（較慢但穩定）

## 未來方向

1. 等待 PyTorch 官方修復 Windows 編譯問題
2. 考慮使用 WSL2 環境（如果確實需要編譯加速）
3. 優先考慮穩定性和開發效率，性能優化可以後續處理
