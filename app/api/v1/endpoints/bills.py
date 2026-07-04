# app/api/v1/endpoints/bills.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.services.bill_service import BillService
from app.schemas.bill import BillCreate, BillUpdate, BillResponse
from app.utils.bill_parser import parse_bill
import os
import shutil
import tempfile
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bills", tags=["bills"])
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".pdf"}

@router.post("/", response_model=BillResponse)
def create_bill(bill: BillCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """创建账单（需要登录）"""
    service = BillService(db)
    return service.create_bill(bill, user_id=current_user.id)

@router.get("/", response_model=list[BillResponse])
def get_bills(
    skip: int = 0,
    limit: int = 100,
    order: str = "desc",
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_active_user),
):
    """获取当前用户的账单列表，默认按时间倒序（最新在前）。

    - 已登录用户：返回自己的账单
    - 未登录用户：返回所有账单（向后兼容）
    """
    service = BillService(db)
    user_id = current_user.id if current_user else None
    return service.get_bills(skip=skip, limit=limit, order=order, user_id=user_id)

# 文件上传接口
@router.post("/upload")
def upload_bill_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    上传账单文件并自动解析入库
    """
    
    filename = file.filename
    if not filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"不支持的文件格式：{ext}"
        )
    
    temp_path = None
    try:

        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            temp_path = tmp.name

        logger.info(
            f"开始解析账单文件: {filename}"
        )
        # 文件解析
        parsed_records = parse_bill(temp_path)
        if not parsed_records:
            raise HTTPException(status_code=400, detail="未解析出有效账单数据")
        logger.info(
            f"解析成功 records={len(parsed_records)}"
        )
       # 数据入库
        service = BillService(db)
        result = service.import_from_parsed_records(parsed_records, user_id=current_user.id)
        logger.info(
            f"账单导入完成 "
            f"created={result['created']} "
            f"skipped={result['skipped']}"
        )
        return {
            "success": True,
            "message": "账单导入成功",
            "data": {
                "filename": filename,
                "total": len(parsed_records),
                "created": result.get("created", 0),
                "skipped": result.get("skipped", 0),
                "errors": result.get("errors", [])
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            f"账单导入失败: {filename}"
        )
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
    finally:
        # 删除临时文件
        try:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
                logger.info(f"临时文件已删除: {temp_path}")
        except Exception:
            logger.warning(f"临时文件删除失败: {temp_path}")


@router.get("/{bill_id}", response_model=BillResponse)
def get_bill(bill_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """获取单个账单详情（仅可查看自己的账单）"""
    service = BillService(db)
    bill = service.get_bill_by_id(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")
    if bill.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看此账单")
    return bill


@router.put("/{bill_id}", response_model=BillResponse)
def update_bill(bill_id: int, data: BillUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """更新指定账单的部分字段（仅可更新自己的账单）"""
    service = BillService(db)
    bill = service.get_bill_by_id(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")
    if bill.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此账单")
    updated = service.update_bill(bill_id, data)
    return updated


@router.delete("/{bill_id}")
def delete_bill(bill_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """删除指定账单（仅可删除自己的账单）"""
    service = BillService(db)
    bill = service.get_bill_by_id(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")
    if bill.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此账单")
    service.delete_bill(bill_id)
    return {"success": True, "message": f"账单 {bill_id} 已删除"}


@router.get("/search", response_model=list[BillResponse])
def search_bills(
    keyword: str = "",
    start_date: str = "",
    end_date: str = "",
    category: str = "",
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_active_user),
):
    """搜索账单：支持关键词（匹配商户/描述/备注）、日期范围、分类过滤"""
    service = BillService(db)
    user_id = current_user.id if current_user else None
    return service.search_bills(
        keyword=keyword,
        start_date=start_date,
        end_date=end_date,
        category=category,
        skip=skip,
        limit=limit,
        user_id=user_id,
    )