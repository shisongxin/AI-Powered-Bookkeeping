# app/main.py
from fastapi import FastAPI
from app.api.v1.endpoints import bills, categories, chat, statistics
from app.config import settings

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

# 注册路由
app.include_router(bills.router, prefix=settings.API_V1_PREFIX)
app.include_router(categories.router, prefix=settings.API_V1_PREFIX)
app.include_router(chat.router, prefix=settings.API_V1_PREFIX)
app.include_router(statistics.router, prefix=settings.API_V1_PREFIX)

@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.APP_NAME}"}