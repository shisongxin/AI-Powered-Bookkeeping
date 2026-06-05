/** 对齐后端 app/schemas/bill.py */

export interface BillCreate {
  amount: number;
  category?: string;
  category_id?: number | null;
  note?: string | null;
  raw_text?: string | null;
  transaction_date?: string | null;
  payee?: string | null;
  description?: string | null;
  direction?: string | null;
  payment_method?: string | null;
  remark?: string | null;
}

export interface BillResponse {
  id: number;
  amount: number;
  category: string;
  category_id: number | null;
  direction: string | null;
  payee: string | null;
  description: string | null;
  transaction_type: string | null;
  payment_method: string | null;
  transaction_status: string | null;
  transaction_id: string | null;
  merchant_order_id: string | null;
  remark: string | null;
  source_file_type: string | null;
  note: string | null;
  raw_text: string | null;
  transaction_date: string | null;
  created_at: string;
}

export interface BillUploadResponse {
  success: boolean;
  message: string;
  data: {
    filename: string;
    total: number;
    created: number;
    skipped: number;
    errors: string[];
  };
}
