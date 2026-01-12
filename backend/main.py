import sys
from pathlib import Path

# 關鍵修正：解決 utils3d.pt 導入問題 (必須在所有 AI 模組之前)
print(f"DEBUG: Current Python executable: {sys.executable}")
print(f"DEBUG: sys.path: {sys.path[:3]} ...")
try:
    import utils3d
    import utils3d.torch
    # 強制設定 pt 屬性
    utils3d.pt = utils3d.torch
    # 解決 MoGe v2 期待 depth_map_to_point_map 但 utils3d 0.0.2 只有 depth_to_points 的問題
    if hasattr(utils3d.torch, "depth_to_points") and not hasattr(utils3d.torch, "depth_map_to_point_map"):
        utils3d.torch.depth_map_to_point_map = utils3d.torch.depth_to_points
        print("Successfully aliased utils3d.torch.depth_map_to_point_map -> depth_to_points")
    
    # 強制注入 sys.modules 以支援 "import utils3d.pt"
    sys.modules["utils3d.pt"] = utils3d.torch
    print("Successfully patched utils3d.pt -> utils3d.torch globally")
except ImportError as e:
    print(f"Warning: utils3d or utils3d.torch not found: {e}")
except Exception as e:
    print(f"Unexpected error during utils3d patch: {e}")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from routers import body, clothes

import logging
import sys

# 配置日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger("uvicorn")

app = FastAPI(title="Virtual Fitting Room API")


# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup directories
BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "outputs"
(OUTPUT_DIR / "bodies").mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / "clothes").mkdir(parents=True, exist_ok=True)

# Mount static files
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

# Include routers
app.include_router(body.router)
app.include_router(clothes.router)

@app.get("/")
async def root():
    return {
        "message": "3D Fitting Room API is running",
        "endpoints": {
            "upload_body": "/upload/body",
            "upload_cloth": "/clothes/upload/cloth",
            "list_clothes": "/clothes",
            "static_models": "/outputs"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
