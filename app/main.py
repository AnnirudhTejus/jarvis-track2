from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from app.routes.companies import router as companies_router

app = FastAPI(title="Jarvis")

app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.include_router(companies_router, prefix="/api")

@app.get("/", response_class=HTMLResponse)
def root():
    with open("app/templates/index.html", "r") as f:
        return f.read()