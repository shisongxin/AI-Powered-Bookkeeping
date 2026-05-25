# app/api/v1/endpoints/categories.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.category_service import CategoryService
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse, MatchRequest, MatchResponse

router = APIRouter(prefix="/categories", tags=["categories"])


@router.post("/", response_model=CategoryResponse, status_code=201)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    """创建分类"""
    svc = CategoryService(db)
    return svc.create(data)


@router.get("/", response_model=list[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    """获取当前所有分类"""
    svc = CategoryService(db)
    return svc.get_all()


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(category_id: int, db: Session = Depends(get_db)):
    """查询id所对应的分类"""
    svc = CategoryService(db)
    cat = svc.get(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    return cat


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    """更新分类"""
    svc = CategoryService(db)
    cat = svc.update(category_id, data)
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    return cat


@router.post("/match", response_model=MatchResponse)
def match_category(data: MatchRequest, db: Session = Depends(get_db)):
    """自动匹配当前已有分类"""
    svc = CategoryService(db)
    matched = svc.auto_match(data.text)
    if matched is None:
        return MatchResponse(matched=False)
    return MatchResponse(matched=True, category=CategoryResponse.model_validate(matched))


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    """删除分类"""
    svc = CategoryService(db)
    ok = svc.delete(category_id)
    if not ok:
        raise HTTPException(status_code=404, detail="分类不存在")
    return {"detail": "已删除"}
