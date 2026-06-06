/** Budgets API — CRUD + vs-actual + AI 建议 */

import client from './client';
import type {
  BudgetCreate, BudgetUpdate, BudgetResponse,
  BudgetVsActualResponse, BudgetSuggestionItem,
} from '../types/budget';

export const budgetsApi = {
  create: (data: BudgetCreate) =>
    client.post<BudgetResponse>('/budgets/', data).then((r) => r.data),

  list: (year: number, month: number) =>
    client.get<BudgetResponse[]>('/budgets/', { params: { year, month } }).then((r) => r.data),

  update: (id: number, data: BudgetUpdate) =>
    client.put<BudgetResponse>(`/budgets/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    client.delete(`/budgets/${id}`).then((r) => r.data),

  vsActual: (year: number, month: number) =>
    client.get<BudgetVsActualResponse>('/budgets/vs-actual', { params: { year, month } }).then((r) => r.data),

  suggest: (year: number, month: number) =>
    client.get<BudgetSuggestionItem[]>('/budgets/suggest', { params: { year, month } }).then((r) => r.data),

  autoGenerate: (year: number, month: number) =>
    client.post<BudgetResponse[]>('/budgets/auto-generate', null, { params: { year, month } }).then((r) => r.data),
};
