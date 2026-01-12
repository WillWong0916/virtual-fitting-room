from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from routers import body

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

@app.get("/")
async def root():
    return {
        "message": "3D Fitting Room API is running",
        "endpoints": {
            "upload_body": "/upload/body",
            "static_models": "/outputs"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
