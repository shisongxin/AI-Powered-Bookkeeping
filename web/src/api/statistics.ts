/** Statistics API — 月度汇总/分类分布/趋势 */

import client from './client';
import type { MonthlySummary, CategoryBreakdownItem, TrendItem } from '../types/statistics';

export const statisticsApi = {
  monthlySummary: (year: number, month: number) =>
    client.get<MonthlySummary>('/statistics/monthly-summary', { params: { year, month } }).then((r) => r.data),

  byCategory: (params: { start_date?: string; end_date?: string; direction?: string }) =>
    client.get<CategoryBreakdownItem[]>('/statistics/by-category', { params }).then((r) => r.data),

  trend: (start_date: string, end_date: string, granularity: string = 'monthly') =>
    client.get<TrendItem[]>('/statistics/trend', { params: { start_date, end_date, granularity } }).then((r) => r.data),
};
