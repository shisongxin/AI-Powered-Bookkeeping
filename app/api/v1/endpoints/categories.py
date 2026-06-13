# app/api/v1/endpoints/categories.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.category_service import CategoryService
from app.services.default_categories import DefaultCategoryService
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
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """删除分类"""
    svc = CategoryService(db, current_user)
    ok = svc.delete(category_id)
    if not ok:
        raise HTTPException(status_code=404, detail="分类不存在")
    return {"detail": "已删除"}


@router.post("/reset", response_model=list[CategoryResponse])
def reset_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """重置分类为默认分类（删除所有现有分类，重新创建默认分类）"""
    created = DefaultCategoryService.reset_user_categories(db, current_user)
    return created


@router.get("/defaults", response_model=list[dict])
def get_default_categories():
    """获取默认分类配置（用于前端展示）"""
    return DefaultCategoryService.get_default_categories()
