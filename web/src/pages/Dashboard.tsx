/** Dashboard — glass stat cards + category breakdown + recent bills */

import { useState, useEffect } from 'react';
import { statisticsApi } from '../api/statistics';
import { billsApi } from '../api/bills';
import type { MonthlySummary, CategoryBreakdownItem } from '../types/statistics';
import type { BillResponse } from '../types/bill';

function nowYM() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function Dashboard() {
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [breakdown, setBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [recentBills, setRecentBills] = useState<BillResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { year, month } = nowYM();
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endD = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    Promise.all([
      statisticsApi.monthlySummary(year, month).catch(() => null),
      statisticsApi.byCategory({ start_date: start, end_date: endD, direction: '支出' }).catch(() => []),
      billsApi.list(0, 5).catch(() => []),
    ]).then(([s, c, b]) => { setSummary(s); setBreakdown(c); setRecentBills(b); })
      .finally(() => setLoading(false));
  }, []);

  const monthLabel = nowYM().month;

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="skeleton h-9 w-40" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8 stagger-children">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-espresso-800 font-display">仪表盘</h1>
          <p className="text-sm text-espresso-400 mt-0.5">{monthLabel}月财务概览</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-espresso-400">更新于</p>
          <p className="text-sm text-espresso-600 font-medium">{new Date().toLocaleDateString('zh-CN')}</p>
        </div>
      </div>

      {/* Stat Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            gradient="from-emerald-50 to-emerald-100/50"
            iconBg="bg-emerald-500/10" iconColor="text-emerald-600"
            label="收入" value={summary.income}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            }
          />
          <StatCard
            gradient="from-coral-50 to-coral-100/50"
            iconBg="bg-coral-500/10" iconColor="text-coral-600"
            label="支出" value={Math.abs(summary.expense)}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            }
          />
          <StatCard
            gradient={summary.net >= 0
              ? 'from-blue-50 to-indigo-100/50'
              : 'from-coral-50 to-coral-100/50'}
            iconBg={summary.net >= 0 ? 'bg-blue-500/10' : 'bg-coral-500/10'}
            iconColor={summary.net >= 0 ? 'text-blue-600' : 'text-coral-600'}
            label="结余" value={summary.net}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>
              </svg>
            }
          />
          <StatCard
            gradient="from-espresso-50 to-espresso-100/50"
            iconBg="bg-espresso-500/10" iconColor="text-espresso-500"
            label="交易笔数" value={summary.transaction_count} isInt
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-espresso-700 uppercase tracking-wider mb-5">
            {monthLabel}月支出分类
          </h2>
          {breakdown.length === 0 ? (
            <div className="text-center py-10 text-espresso-300">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-3 opacity-40">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
              </svg>
              <p className="text-sm">暂无支出数据</p>
            </div>
          ) : (
            <div className="space-y-4">
              {breakdown.slice(0, 6).map((item, i) => (
                <div key={item.category} style={{ animationDelay: `${i * 0.08}s` }}
                  className="animate-slide-up">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-espresso-600 font-medium">{item.category}</span>
                    <span className="text-espresso-500 tabular-nums">
                      {item.amount.toFixed(0)}
                      <span className="text-xs text-espresso-400 ml-0.5">元</span>
                    </span>
                  </div>
                  <div className="h-2 bg-espresso-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.min(item.percentage, 100)}%`,
                        background: `linear-gradient(90deg, #fbbf24, #f59e0b ${100 - item.percentage}%, #d97706)`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Bills */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-espresso-700 uppercase tracking-wider mb-5">最近账单</h2>
          {recentBills.length === 0 ? (
            <div className="text-center py-10 text-espresso-300">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-3 opacity-40">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <p className="text-sm">暂无账单</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentBills.map((b, i) => (
                <div key={b.id}
                  className="flex items-center justify-between py-3 px-3 -mx-3 rounded-xl
                             hover:bg-espresso-50/50 transition-colors duration-150"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-espresso-800 font-medium truncate">
                      {b.payee || b.description || '未命名'}
                    </p>
                    <p className="text-xs text-espresso-400 mt-0.5">
                      <span className="badge mr-1.5">{b.category}</span>
                      {b.transaction_date?.slice(0, 10)}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums shrink-0 ml-3
                    ${b.amount < 0 ? 'text-coral-600' : 'text-emerald-600'}`}>
                    {b.amount < 0 ? '−' : '+'}{Math.abs(b.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ gradient, iconBg, iconColor, label, value, icon, isInt }: {
  gradient: string; iconBg: string; iconColor: string;
  label: string; value: number; icon: JSX.Element; isInt?: boolean;
}) {
  return (
    <div className={`stat-card bg-gradient-to-br ${gradient} border border-white/40`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-espresso-500 uppercase tracking-wider">{label}</span>
        <span className={`w-9 h-9 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center`}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold text-espresso-800 tabular-nums font-display">
        {isInt ? value : value.toFixed(2)}
      </p>
      <p className="text-xs text-espresso-400 mt-0.5">元</p>
    </div>
  );
}
