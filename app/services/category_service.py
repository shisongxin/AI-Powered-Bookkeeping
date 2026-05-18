# app/services/category_service.py

from sqlalchemy.orm import Session
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate
from typing import List, Optional, Dict


class CategoryService:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: CategoryCreate) -> Category:
        cat = Category(**data.model_dump())
        self.db.add(cat)
        self.db.commit()
        self.db.refresh(cat)
        return cat

    def get(self, category_id: int) -> Optional[Category]:
        return self.db.query(Category).filter(Category.id == category_id).first()

    def get_all(self) -> List[Category]:
        return self.db.query(Category).order_by(Category.id).all()

    def update(self, category_id: int, data: CategoryUpdate) -> Optional[Category]:
        cat = self.get(category_id)
        if not cat:
            return None
        for key, val in data.model_dump(exclude_unset=True).items():
            setattr(cat, key, val)
        self.db.commit()
        self.db.refresh(cat)
        return cat

    def delete(self, category_id: int) -> bool:
        cat = self.get(category_id)
        if not cat:
            return False
        self.db.delete(cat)
        self.db.commit()
        return True

    def auto_match(self, text: str) -> Optional[Category]:
        """根据文本关键词自动匹配分类，返回匹配度最高的分类"""
        if not text:
            return None
        categories = self.get_all()
        best: tuple[Optional[Category], int] = (None, 0)
        for cat in categories:
            if not cat.keywords:
                continue
            kw_list = [kw.strip() for kw in cat.keywords.split(",") if kw.strip()]
            score = sum(1 for kw in kw_list if kw in text)
            if score > best[1]:
                best = (cat, score)
        return best[0] if best[1] > 0 else None
