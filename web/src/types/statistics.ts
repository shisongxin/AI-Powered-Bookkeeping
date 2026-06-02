/** 对齐后端 app/schemas/statistics.py */

export interface MonthlySummary {
  year: number;
  month: number;
  income: number;
  expense: number;
  net: number;
  transaction_count: number;
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface TrendItem {
  period: string;
  income: number;
  expense: number;
  net: number;
}
