/** Unified Analysis — trend + budget execution(手动设置/隐藏分类) */

import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { statisticsApi } from '../api/statistics';
import { budgetsApi } from '../api/budgets';
import type { MonthlySummary, TrendItem, CategoryBreakdownItem } from '../types/statistics';
import type { BudgetVsActualResponse, BudgetResponse } from '../types/budget';

const PIE_COLORS = ['#f59e0b','#d97706','#b45309','#fbbf24','#fcd34d','#eab308','#84cc16','#22c55e','#14b8a6','#6366f1','#a855f7','#ec4899'];

function nowYM() { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 }; }

export default function Analysis() {
  const { year: cy, month: cm } = nowYM();
  const [year, setYear] = useState(cy); const [month, setMonth] = useState(cm);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [breakdown, setBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [budgetVs, setBudgetVs] = useState<BudgetVsActualResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const [autoGenMsg, setAutoGenMsg] = useState('');
  const [granularity, setGranularity] = useState('daily');
  const [trendYear, setTrendYear] = useState(cy);
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie'); // 饼图/条状图

  // 预算手动设置
  const [budgetForm, setBudgetForm] = useState<Record<string, string>>({});
  const [settingBudget, setSettingBudget] = useState(false);
  // 隐藏的分类
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());

  const refreshData = () => {
    setLoading(true);
    const startD = `${year}-${String(month).padStart(2, '0')}-01`;
    const endD = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    Promise.all([
      statisticsApi.monthlySummary(year, month).catch(() => null),
      statisticsApi.trend(`${trendYear}-01-01`, `${trendYear}-12-31`, granularity).catch(() => []),
      statisticsApi.byCategory({ start_date: startD, end_date: endD, direction: '支出' }).catch(() => []),
      budgetsApi.vsActual(year, month).catch(() => null),
    ]).then(([s, t, b, v]) => { setSummary(s); setTrend(t); setBreakdown(b); setBudgetVs(v); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { refreshData(); }, [year, month, granularity, trendYear]);

  const handleAutoGenerate = async () => {
    setAutoGenLoading(true); setAutoGenMsg('');
    try {
      const created = await budgetsApi.autoGenerate(year, month);
      setAutoGenMsg(created.length === 0 ? '上月无消费数据或当月预算已存在' : `✅ 已自动生成 ${created.length} 条预算（基于上月消费上浮 10%）`);
      refreshData();
    } catch (err: unknown) { setAutoGenMsg(`❌ 生成失败: ${err instanceof Error ? err.message : '未知错误'}`); }
    setAutoGenLoading(false);
  };

  // 手动设置/更新单个分类预算
  const handleSetBudget = async (category: string) => {
    const amt = parseFloat(budgetForm[category]);
    if (isNaN(amt) || amt <= 0) return;
    try {
      await budgetsApi.create({ year, month, category, amount: amt });
      setBudgetForm(p => { const n = { ...p }; delete n[category]; return n; });
      refreshData();
    } catch { /* */ }
  };

  const toggleHidden = (cat: string) => {
    setHiddenCats(p => { const n = new Set(p); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  };

  const trendData = trend.map(t => ({ label: t.period.length > 7 ? t.period.slice(5) : t.period, 收入: t.income, 支出: t.expense }));
  const pieData = breakdown.map(item => ({ name: item.category, value: Math.round(item.amount * 100) / 100, percentage: item.percentage }));

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6 stagger-children">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-espresso-800 font-display">流水分析</h1>
          <p className="text-sm text-espresso-400 mt-0.5">{year}年{month}月</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="select-field !py-1.5 !w-auto !text-sm">{[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}年</option>)}</select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="select-field !py-1.5 !w-auto !text-sm">{Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}月</option>)}</select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(4)].map((_,i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>
      ) : (
        <>
          {/* Monthly Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard gradient="from-emerald-50 to-emerald-100/50" iconBg="bg-emerald-500/10" iconColor="text-emerald-600" label="收入" value={summary.income} />
              <StatCard gradient="from-coral-50 to-coral-100/50" iconBg="bg-coral-500/10" iconColor="text-coral-600" label="支出" value={Math.abs(summary.expense)} />
              <StatCard gradient={summary.net>=0?'from-blue-50 to-indigo-100/50':'from-coral-50 to-coral-100/50'} iconBg={summary.net>=0?'bg-blue-500/10':'bg-coral-500/10'} iconColor={summary.net>=0?'text-blue-600':'text-coral-600'} label="结余" value={summary.net} />
              <StatCard gradient="from-espresso-50 to-espresso-100/50" iconBg="bg-espresso-500/10" iconColor="text-espresso-500" label="交易笔数" value={summary.transaction_count} isInt />
            </div>
          )}

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
                  <Line type="monotone" dataKey="收入" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
                  <Line type="monotone" dataKey="支出" stroke="#f04444" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#f04444' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category Donut+ Budget Execution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 分类支出 — 饼图/条状图切换 */}
            <div className="glass-card p-5">
              <div className="w-full flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-espresso-700 uppercase tracking-wider">{month}月分类支出</h2>
                {(
                  <div className="flex items-center bg-espresso-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setChartType('pie')}
                      className={`px-2.5 py-1 text-xs rounded-md transition-all ${chartType === 'pie' ? 'bg-white text-espresso-700 shadow-sm font-medium' : 'text-espresso-400'}`}>
                      饼图
                    </button>
                    <button
                      onClick={() => setChartType('bar')}
                      className={`px-2.5 py-1 text-xs rounded-md transition-all ${chartType === 'bar' ? 'bg-white text-espresso-700 shadow-sm font-medium' : 'text-espresso-400'}`}>
                      条状
                    </button>
                  </div>
                )}
              </div>
              {pieData.length === 0 ? (
                <div className="text-center py-12 text-espresso-300 text-sm">暂无数据</div>
              ) : chartType === 'pie' ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value"
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
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={pieData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d8" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#8b7355' }} axisLine={{ stroke: '#d7ccc2' }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8b7355' }} axisLine={{ stroke: '#d7ccc2' }} width={50} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e7e0d8', backgroundColor: '#fffdf9' }} formatter={(v) => `${Number(v).toFixed(2)}元`} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>

            {/* Budget Execution — 手动设置 + 隐藏分类 */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-espresso-700 uppercase tracking-wider">{month}月预算执行</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSettingBudget(!settingBudget)}
                    className={`btn-ghost !text-xs ${settingBudget ? '!text-gold-600' : '!text-espresso-400'}`}>
                    {settingBudget ? '完成设置' : '✏️ 设置'}
                  </button>
                  <button onClick={handleAutoGenerate} disabled={autoGenLoading}
                    className="btn-ghost !text-xs !text-gold-600 hover:!text-gold-700 disabled:opacity-50">
                    {autoGenLoading ? '生成中…' : '⚡ 智能生成'}
                  </button>
                </div>
              </div>
              {autoGenMsg && (
                <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${autoGenMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-600' : autoGenMsg.startsWith('❌') ? 'bg-coral-50 text-coral-600' : 'bg-espresso-50 text-espresso-500'}`}>{autoGenMsg}</div>
              )}
              {!budgetVs || budgetVs.items.length === 0 ? (
                <div className="text-center py-10 text-espresso-300 text-sm">
                  <p className="mb-3">本月未设置预算</p>
                  <button onClick={handleAutoGenerate} disabled={autoGenLoading}
                    className="btn-primary !text-xs !py-2">
                    {autoGenLoading ? '正在分析上月数据…' : '📊 基于上月消费自动生成'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {budgetVs.items.filter(item => !hiddenCats.has(item.category)).map(item => (
                    <div key={item.category} className="relative">
                      <div className="flex justify-between text-sm mb-1">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => toggleHidden(item.category)}
                            className="text-xs text-espresso-300 hover:text-coral-500 transition-colors" title="隐藏此分类">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          </button>
                          <span className="text-espresso-600 font-medium">{item.category}</span>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.status==='已超支'?'bg-coral-50 text-coral-600':item.status==='接近上限'?'bg-gold-100 text-gold-700':'bg-emerald-50 text-emerald-600'}`}>{item.status} {item.percentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-3 bg-espresso-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${item.status==='已超支'?'bg-coral-500':item.status==='接近上限'?'bg-gold-400':'bg-emerald-500'}`} style={{width:`${Math.min(item.percentage,100)}%`}} />
                      </div>
                      <div className="flex justify-between text-xs text-espresso-400 mt-1">
                        <span>实际 {item.actual.toFixed(0)}</span>
                        <span>预算 {item.budget.toFixed(0)}</span>
                      </div>

                      {/* 手动设置预算表单 */}
                      {settingBudget && (
                        <div className="mt-2 flex items-center gap-2 animate-scale-in">
                          <input type="number" step="0.01" min="0"
                            placeholder="新预算"
                            value={budgetForm[item.category] || ''}
                            onChange={e => setBudgetForm({ ...budgetForm, [item.category]: e.target.value })}
                            className="input-field !py-1 !text-xs !w-28" />
                          <button onClick={() => handleSetBudget(item.category)}
                            className="px-3 py-1 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600 transition-colors">设置</button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 已隐藏的分类 */}
                  {hiddenCats.size > 0 && (
                    <div className="pt-2 border-t border-espresso-100">
                      <p className="text-xs text-espresso-400 mb-2">已隐藏的分类：</p>
                      <div className="flex flex-wrap gap-1">
                        {[...hiddenCats].map(cat => (
                          <button key={cat} onClick={() => toggleHidden(cat)}
                            className="px-2 py-0.5 text-xs bg-espresso-100 text-espresso-500 rounded-full hover:bg-espresso-200 transition-colors">
                            {cat} ↺
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 合计 */}
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

function StatCard({ gradient, iconBg, iconColor, label, value, isInt }: {
  gradient: string; iconBg: string; iconColor: string; label: string; value: number; isInt?: boolean;
}) {
  return (
    <div className={`stat-card bg-gradient-to-br ${gradient} border border-white/40`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-espresso-500 uppercase tracking-wider">{label}</span>
        <span className={`w-8 h-8 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center text-sm font-bold`}>
          {label === '收入' ? '↑' : label === '支出' ? '↓' : label === '结余' ? '=' : '#'}
        </span>
      </div>
      <p className="text-xl font-bold text-espresso-800 tabular-nums font-display">
        {isInt ? value : value.toFixed(2)}
      </p>
      <p className="text-xs text-espresso-400 mt-0.5">元</p>
    </div>
  );
}
