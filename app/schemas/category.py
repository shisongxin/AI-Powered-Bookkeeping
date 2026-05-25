# app/schemas/category.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CategoryBase(BaseModel):
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    keywords: Optional[str] = None  # 逗号分隔的关键词


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    keywords: Optional[str] = None


class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MatchRequest(BaseModel):
    text: str


class MatchResponse(BaseModel):
    matched: bool
    category: Optional[CategoryResponse] = None
