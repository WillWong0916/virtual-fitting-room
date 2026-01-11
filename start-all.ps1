# 虛擬試衣間 一鍵啟動腳本 (Windows PowerShell)

Write-Host "🚀 Starting Virtual Fitting Room..." -ForegroundColor Cyan

# 1. 啟動後端
Write-Host "📦 Starting Backend (FastAPI)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; if (Test-Path '.venv') { .\.venv\Scripts\activate } elseif (Get-Command conda -ErrorAction SilentlyContinue) { conda activate vfitting-body }; python main.py"

# 2. 啟動前端
Write-Host "🌐 Starting Frontend (Vite)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "✅ Both services are starting in new windows!" -ForegroundColor Cyan
Write-Host "Check the new windows for logs."
