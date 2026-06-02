/** 对齐后端 app/schemas/ocr.py */

export interface ExtractedItem {
  transaction_date: string | null;
  amount: number | null;
  direction: string | null;
  payee: string | null;
  description: string | null;
  payment_method: string | null;
  category: string | null;
}

export interface OCRResponse {
  success: boolean;
  raw_text: string;
  items: ExtractedItem[];
  confidence: 'high' | 'medium' | 'low';
  message: string;
}
