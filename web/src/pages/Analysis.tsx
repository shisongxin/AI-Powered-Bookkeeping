/** Analysis — themed Recharts line + donut + budget progress */

import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { statisticsApi } from '../api/statistics';
import { budgetsApi } from '../api/budgets';
import type { TrendItem, CategoryBreakdownItem } from '../types/statistics';
import type { BudgetVsActualResponse } from '../types/budget';

const PIE_COLORS = ['#f59e0b','#d97706','#b45309','#fbbf24','#fcd34d','#eab308','#84cc16','#22c55e','#14b8a6','#6366f1','#a855f7','#ec4899'];

function nowYM() { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 }; }

export default function Analysis() {
  const { year: cy, month: cm } = nowYM();
  const [year, setYear] = useState(cy); const [month, setMonth] = useState(cm);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [breakdown, setBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [budgetVs, setBudgetVs] = useState<BudgetVsActualResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState('daily');
  const [trendYear, setTrendYear] = useState(cy);

  useEffect(() => {
    setLoading(true);
    const startD = `${year}-${String(month).padStart(2, '0')}-01`;
    const endD = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    Promise.all([
      statisticsApi.trend(`${trendYear}-01-01`, `${trendYear}-12-31`, granularity).catch(() => []),
      statisticsApi.byCategory({ start_date: startD, end_date: endD, direction: '支出' }).catch(() => []),
      budgetsApi.vsActual(year, month).catch(() => null),
    ]).then(([t, b, v]) => { setTrend(t); setBreakdown(b); setBudgetVs(v); }).finally(() => setLoading(false));
  }, [year, month, granularity, trendYear]);

  const trendData = trend.map(t => ({ label: t.period.length > 7 ? t.period.slice(5) : t.period, 收入: t.income, 支出: t.expense }));
  const pieData = breakdown.map(item => ({ name: item.category, value: Math.round(item.amount * 100) / 100, percentage: item.percentage }));

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6 stagger-children">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-espresso-800 font-display">流水分析</h1>
        <div className="flex items-center gap-3">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="select-field !py-1.5 !w-auto !text-sm">{[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}年</option>)}</select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="select-field !py-1.5 !w-auto !text-sm">{Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}月</option>)}</select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_,i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}</div>
      ) : (
        <>
          {/* Trend Line Chart */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-espresso-700 uppercase tracking-wider">收支趋势</h2>
              <div className="flex items-center gap-2">
                <select value={trendYear} onChange={e => setTrendYear(Number(e.target.value))} className="select-field !py-1 !text-xs !w-auto">{[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
                <select value={granularity} onChange={e => setGranularity(e.target.value)} className="select-field !py-1 !text-xs !w-auto"><option value="daily">按日</option><option value="weekly">按周</option><option value="monthly">按月</option></select>
              </div>
            </div>
            {trendData.length === 0 ? <div className="text-center py-12 text-espresso-300 text-sm">暂无趋势数据</div> : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d8" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8b7355' }} axisLine={{ stroke: '#d7ccc2' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#8b7355' }} axisLine={{ stroke: '#d7ccc2' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e7e0d8', backgroundColor: '#fffdf9' }} formatter={(v) => `${Number(v).toFixed(2)}元`} />
                  <Legend />
                  <Line type="monotone" dataKey="收入" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
                  <Line type="monotone" dataKey="支出" stroke="#f04444" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#f04444' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut Chart */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-espresso-700 uppercase tracking-wider mb-4">{month}月分类支出</h2>
              {pieData.length === 0 ? <div className="text-center py-12 text-espresso-300 text-sm">暂无数据</div> : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value"
                        label={({ name, value }) => `${name} ${value}`} labelLine={{ stroke: '#bca997', strokeWidth: 1 }}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="white" strokeWidth={2} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e7e0d8', backgroundColor: '#fffdf9' }} formatter={(v) => `${Number(v).toFixed(2)}元`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
                    {pieData.map((d, i) => <div key={d.name} className="flex items-center gap-1.5 text-xs text-espresso-500"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />{d.name} {d.percentage}%</div>)}
                  </div>
                </>
              )}
            </div>

            {/* Budget vs Actual */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-espresso-700 uppercase tracking-wider mb-4">{month}月预算执行</h2>
              {!budgetVs || budgetVs.items.length === 0 ? <div className="text-center py-12 text-espresso-300 text-sm">本月未设置预算</div> : (
                <div className="space-y-4">
                  {budgetVs.items.map(item => (
                    <div key={item.category}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-espresso-600 font-medium">{item.category}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.status==='已超支'?'bg-coral-50 text-coral-600':item.status==='接近上限'?'bg-gold-100 text-gold-700':'bg-emerald-50 text-emerald-600'}`}>{item.status} {item.percentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-3 bg-espresso-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${item.status==='已超支'?'bg-coral-500':item.status==='接近上限'?'bg-gold-400':'bg-emerald-500'}`} style={{width:`${Math.min(item.percentage,100)}%`}} />
                      </div>
                      <div className="flex justify-between text-xs text-espresso-400 mt-1"><span>实际 {item.actual.toFixed(0)}</span><span>预算 {item.budget.toFixed(0)}</span></div>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-espresso-100 grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-xs text-espresso-400">预算合计</p><p className="font-bold text-espresso-700">{budgetVs.total_budget.toFixed(0)}</p></div>
                    <div><p className="text-xs text-espresso-400">实际支出</p><p className="font-bold text-espresso-700">{budgetVs.total_actual.toFixed(0)}</p></div>
                    <div><p className="text-xs text-espresso-400">剩余</p><p className={`font-bold ${budgetVs.total_remaining>=0?'text-emerald-600':'text-coral-600'}`}>{budgetVs.total_remaining.toFixed(0)}</p></div>
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
