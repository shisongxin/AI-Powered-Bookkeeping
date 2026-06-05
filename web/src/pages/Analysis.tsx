/** 流水分析 — 收支折线图 + 分类饼图 + 预算 vs 实际 */

import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { statisticsApi } from '../api/statistics';
import { budgetsApi } from '../api/budgets';
import type { TrendItem, CategoryBreakdownItem } from '../types/statistics';
import type { BudgetVsActualResponse } from '../types/budget';

/** 饼图调色板 */
const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

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
  const [granularity, setGranularity] = useState('daily');
  const [trendYear, setTrendYear] = useState(cy);

  useEffect(() => {
    setLoading(true);
    const startD = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endD = `${year}-${String(month).padStart(2, '0')}-${endDay}`;

    // 趋势范围：默认查看当月每日趋势
    const trendStart = `${trendYear}-01-01`;
    const trendEnd = `${trendYear}-12-31`;

    Promise.all([
      statisticsApi.trend(trendStart, trendEnd, granularity).catch(() => []),
      statisticsApi.byCategory({ start_date: startD, end_date: endD, direction: '支出' }).catch(() => []),
      budgetsApi.vsActual(year, month).catch(() => null),
    ]).then(([t, b, v]) => {
      setTrend(t);
      setBreakdown(b);
      setBudgetVs(v);
    }).finally(() => setLoading(false));
  }, [year, month, granularity, trendYear]);

  // 格式化折线图数据
  const trendData = trend.map((t) => ({
    label: t.period.length > 7 ? t.period.slice(5) : t.period,  // 截短日期显示
    收入: t.income,
    支出: t.expense,
  }));

  // 格式化饼图数据
  const pieData = breakdown.map((item) => ({
    name: item.category,
    value: Math.round(item.amount * 100) / 100,
    percentage: item.percentage,
  }));

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

        <div className="border-l pl-3 ml-2 flex items-center gap-2 text-sm text-gray-500">
          <span>趋势:</span>
          <select value={trendYear} onChange={(e) => setTrendYear(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm">
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select value={granularity} onChange={(e) => setGranularity(e.target.value)}
            className="border rounded px-2 py-1 text-sm">
            <option value="daily">按日</option>
            <option value="weekly">按周</option>
            <option value="monthly">按月</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">加载中...</div>
      ) : (
        <>
          {/* ===== 收支趋势折线图 ===== */}
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <h2 className="font-semibold text-gray-700 mb-4">
              📉 {trendYear}年 收支趋势 ({granularity === 'daily' ? '按日' : granularity === 'weekly' ? '按周' : '按月'})
            </h2>
            {trendData.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">暂无趋势数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => `${Number(value).toFixed(2)}元`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="收入" stroke="#22c55e" strokeWidth={2}
                    dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="支出" stroke="#ef4444" strokeWidth={2}
                    dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ===== 分类支出饼图 ===== */}
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <h2 className="font-semibold text-gray-700 mb-4">🍩 {month}月分类支出</h2>
              {pieData.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">暂无数据</p>
              ) : (
                <div>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name} ${value}元`}
                        labelLine={{ strokeWidth: 1 }}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => `${Number(value).toFixed(2)}元`}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* 图例 */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
                    {pieData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-1 text-xs text-gray-500">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {d.name} {d.percentage}%
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ===== 预算 vs 实际 ===== */}
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <h2 className="font-semibold text-gray-700 mb-4">🎯 {month}月预算执行</h2>
              {!budgetVs || budgetVs.items.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">本月未设置预算</p>
              ) : (
                <div className="space-y-3">
                  {budgetVs.items.map((item) => (
                    <div key={item.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{item.category}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          item.status === '已超支' ? 'bg-red-100 text-red-600' :
                          item.status === '接近上限' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {item.status} · {item.percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-4 bg-gray-100 rounded-full relative overflow-hidden">
                        <div className={`h-full rounded-full absolute transition-all ${
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
                  {/* 合计摘要 */}
                  <div className="pt-3 border-t mt-4 flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">预算合计</span>
                      <span className="text-gray-800 font-medium">{budgetVs.total_budget.toFixed(0)}元</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">实际支出</span>
                      <span className="text-gray-800 font-medium">{budgetVs.total_actual.toFixed(0)}元</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">剩余</span>
                      <span className={`font-medium ${budgetVs.total_remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {budgetVs.total_remaining.toFixed(0)}元
                      </span>
                    </div>
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
