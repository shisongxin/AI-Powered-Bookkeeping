/** 对齐后端 app/schemas/budget.py */

export interface BudgetCreate {
  year: number;
  month: number;
  category: string;
  amount: number;
  note?: string | null;
}

export interface BudgetUpdate {
  amount?: number | null;
  note?: string | null;
}

export interface BudgetResponse {
  id: number;
  year: number;
  month: number;
  category: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface BudgetVsActualItem {
  category: string;
  budget: number;
  actual: number;
  remaining: number;
  percentage: number;
  status: '正常' | '接近上限' | '已超支' | '无预算';
}

export interface BudgetVsActualResponse {
  year: number;
  month: number;
  items: BudgetVsActualItem[];
  total_budget: number;
  total_actual: number;
  total_remaining: number;
}

export interface BudgetSuggestionItem {
  category: string;
  suggested_amount: number;
  reason: string;
}
