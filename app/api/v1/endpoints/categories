# app/api/v1/endpoints/categories.py
from fastapi import APIRouter

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("/")
async def get_categories():
    return [{"id": 1, "name": "餐饮"}, {"id": 2, "name": "购物"}]