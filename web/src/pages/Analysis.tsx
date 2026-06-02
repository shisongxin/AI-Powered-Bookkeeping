/** 流水分析 — 趋势 + 分类分布 + 预算 vs 实际 */

import { useState, useEffect } from 'react';
import { statisticsApi } from '../api/statistics';
import { budgetsApi } from '../api/budgets';
import type { TrendItem, CategoryBreakdownItem } from '../types/statistics';
import type { BudgetVsActualResponse } from '../types/budget';

function nowYM() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function Analysis() {
  const { year: cy, month: cm } = nowYM();
  const [year, setYear] = useState(cy);
  const [month, setMonth] = useState(cm);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [breakdown, setBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [budgetVs, setBudgetVs] = useState<BudgetVsActualResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState('monthly');
  const [trendRange, setTrendRange] = useState({ start: `${cy}-01-01`, end: `${cy}-12-31` });

  useEffect(() => {
    setLoading(true);
    const startD = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endD = `${year}-${String(month).padStart(2, '0')}-${endDay}`;

    Promise.all([
      statisticsApi.trend(trendRange.start, trendRange.end, granularity).catch(() => []),
      statisticsApi.byCategory({ start_date: startD, end_date: endD, direction: '支出' }).catch(() => []),
      budgetsApi.vsActual(year, month).catch(() => null),
    ]).then(([t, b, v]) => {
      setTrend(t);
      setBreakdown(b);
      setBudgetVs(v);
    }).finally(() => setLoading(false));
  }, [year, month, granularity, trendRange.start, trendRange.end]);

  const maxTrend = Math.max(...trend.map((t) => Math.max(t.income, t.expense)), 1);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">📈 流水分析</h1>

      {/* 月份选择 */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm">
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}月</option>)}
        </select>
        <span className="text-sm text-gray-400 ml-auto">
          趋势粒度:
          <select value={granularity} onChange={(e) => setGranularity(e.target.value)}
            className="border rounded px-2 py-1 ml-1 text-sm">
            <option value="monthly">按月</option>
            <option value="weekly">按周</option>
            <option value="daily">按日</option>
          </select>
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">加载中...</div>
      ) : (
        <>
          {/* 趋势图（简易柱状） */}
          {trend.length > 0 && (
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <h2 className="font-semibold text-gray-700 mb-4">📉 收支趋势</h2>
              <div className="flex items-end gap-2 h-40">
                {trend.map((t) => {
                  const incomeH = (t.income / maxTrend) * 100;
                  const expenseH = (t.expense / maxTrend) * 100;
                  return (
                    <div key={t.period} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <div className="w-full flex flex-col items-center" style={{ height: 140 }}>
                        <div className="w-full bg-green-400 rounded-t" style={{ height: `${incomeH}%`, minHeight: t.income > 0 ? 4 : 0 }} title={`收入 ${t.income}`} />
                        <div className="w-full bg-red-400 rounded-t" style={{ height: `${expenseH}%`, minHeight: t.expense > 0 ? 4 : 0 }} title={`支出 ${t.expense}`} />
                      </div>
                      <span className="text-xs text-gray-400 truncate w-full text-center">{t.period.slice(-2)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
                <span>🟢 收入</span><span>🔴 支出</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 分类分布 */}
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <h2 className="font-semibold text-gray-700 mb-4">🍩 {month}月分类支出</h2>
              {breakdown.length === 0 ? (
                <p className="text-gray-400 text-sm">暂无数据</p>
              ) : (
                <div className="space-y-3">
                  {breakdown.map((item) => (
                    <div key={item.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{item.category}</span>
                        <span className="text-gray-500">{item.amount.toFixed(0)}元 ({item.percentage}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${item.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 预算 vs 实际 */}
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <h2 className="font-semibold text-gray-700 mb-4">🎯 {month}月预算执行</h2>
              {!budgetVs || budgetVs.items.length === 0 ? (
                <p className="text-gray-400 text-sm">本月未设置预算</p>
              ) : (
                <div className="space-y-3">
                  {budgetVs.items.map((item) => (
                    <div key={item.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{item.category}</span>
                        <span className={`text-xs font-medium ${
                          item.status === '已超支' ? 'text-red-500' :
                          item.status === '接近上限' ? 'text-orange-500' : 'text-gray-500'
                        }`}>
                          {item.status} · 已用 {item.percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full relative">
                        <div className={`h-full rounded-full absolute ${
                          item.status === '已超支' ? 'bg-red-400' :
                          item.status === '接近上限' ? 'bg-orange-400' : 'bg-green-400'
                        }`} style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                        <span>实际 {item.actual.toFixed(0)}</span>
                        <span>预算 {item.budget.toFixed(0)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t text-sm flex justify-between">
                    <span className="text-gray-600">合计</span>
                    <span className="text-gray-800">
                      预算 {budgetVs.total_budget.toFixed(0)} · 实际 {budgetVs.total_actual.toFixed(0)} · 剩余 {budgetVs.total_remaining.toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
