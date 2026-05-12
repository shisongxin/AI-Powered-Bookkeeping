# app/services/bill_service.py
from sqlalchemy.orm import Session
from app.models.bill import Bill
from app.schemas.bill import BillCreate, BillResponse

class BillService:
    def __init__(self, db: Session):
        self.db = db

    def create_bill(self, bill_data: BillCreate) -> Bill:
        db_bill = Bill(**bill_data.model_dump())
        self.db.add(db_bill)
        self.db.commit()
        self.db.refresh(db_bill)
        return db_bill
        
    def get_bills(self, skip: int = 0, limit: int = 100):
        return self.db.query(Bill).offset(skip).limit(limit).all()