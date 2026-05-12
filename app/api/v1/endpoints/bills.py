# app/api/v1/endpoints/bills.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.bill_service import BillService
from app.schemas.bill import BillCreate, BillResponse

router = APIRouter(prefix="/bills", tags=["bills"])

@router.post("/", response_model=BillResponse)
def create_bill(bill: BillCreate, db: Session = Depends(get_db)):
    service = BillService(db)
    return service.create_bill(bill)

@router.get("/", response_model=list[BillResponse])
def get_bills(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = BillService(db)
    return service.get_bills(skip=skip, limit=limit)