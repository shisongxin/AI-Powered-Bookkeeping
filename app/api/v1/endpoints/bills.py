# app/api/v1/endpoints/bills.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.bill_service import BillService
from app.schemas.bill import BillCreate, BillResponse
from app.utils.bill_parser import parse_bill
import os
import shutil
import tempfile
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bills", tags=["bills"])
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".pdf"}
# 创建账单列表接口
@router.post("/", response_model=BillResponse)
def create_bill(bill: BillCreate, db: Session = Depends(get_db)):
    service = BillService(db)
    return service.create_bill(bill)

# 获取账单列表接口
@router.get("/", response_model=list[BillResponse])
def get_bills(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = BillService(db)
    return service.get_bills(skip=skip, limit=limit)

# 文件上传接口
@router.post("/upload")
def upload_bill_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
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
        result = service.import_from_parsed_records(parsed_records)
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