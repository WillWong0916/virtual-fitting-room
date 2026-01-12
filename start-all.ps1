# 虛擬試衣間 一鍵啟動腳本 (Windows PowerShell)

Write-Host "🚀 Starting Virtual Fitting Room..." -ForegroundColor Cyan

# 1. 啟動後端
Write-Host "📦 Starting Backend (FastAPI)..." -ForegroundColor Yellow
$condaPath = "C:\Users\willw\anaconda3\Scripts\conda.exe"
$nodePath = "C:\Program Files\nodejs"
# 確保 node 在 PATH 中，因為 vite 需要它
$env:Path = "$nodePath;$env:Path"
# 使用 conda run 執行，這樣不需要先 activate
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; `$env:Path = '$nodePath;' + `$env:Path; & '$condaPath' run -n vfitting-body python main.py"

# 2. 啟動前端
Write-Host "🌐 Starting Frontend (Vite)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; `$env:Path = '$nodePath;' + `$env:Path; & '$nodePath\npm.cmd' run dev"

Write-Host "✅ Both services are starting in new windows!" -ForegroundColor Cyan
Write-Host "Check the new windows for logs."
