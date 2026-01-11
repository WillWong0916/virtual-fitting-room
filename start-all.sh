#!/bin/bash

# 虛擬試衣間 一鍵啟動腳本

echo "🚀 Starting Virtual Fitting Room..."

# 1. 啟動後端
echo "📦 Starting Backend (FastAPI)..."
cd "backend"
if [ -d ".venv" ]; then
    source ".venv/bin/activate"
fi
# 使用 python3 執行，並將日誌輸出到 backend.log
python3 main.py > "../backend.log" 2>&1 &
BACKEND_PID=$!
cd ".."

# 2. 啟動前端
echo "🌐 Starting Frontend (Vite)..."
cd "frontend"
npm run dev &
FRONTEND_PID=$!
cd ".."

echo "✅ Both services are starting up!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Check backend.log for backend output."
echo "Press Ctrl+C to stop both (not fully supported by this script, use kill)"

# 簡單的清理機制
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
wait
