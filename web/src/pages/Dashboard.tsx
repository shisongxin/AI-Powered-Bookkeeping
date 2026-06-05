/** 仪表盘 — 月度汇总卡片 + 分类分布 + 最近账单 */

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
    const end = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

    Promise.all([
      statisticsApi.monthlySummary(year, month).catch(() => null),
      statisticsApi.byCategory({ start_date: start, end_date: end, direction: '支出' }).catch(() => []),
      billsApi.list(0, 5).catch(() => []),
    ]).then(([s, c, b]) => {
      setSummary(s);
      setBreakdown(c);
      setRecentBills(b);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <h1 className="text-2xl font-bold text-gray-800">📊 仪表盘</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="stat-card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-12 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const monthLabel = nowYM().month;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📊 仪表盘</h1>
        <span className="text-sm text-gray-400">{monthLabel}月概览</span>
      </div>

      {/* 月度汇总卡片 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon="💰" label="收入" value={summary.income}
            color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-100"
          />
          <StatCard
            icon="💳" label="支出" value={Math.abs(summary.expense)}
            color="text-rose-600" bg="bg-rose-50" border="border-rose-100"
          />
          <StatCard
            icon="📊" label="结余" value={summary.net}
            color={summary.net >= 0 ? 'text-blue-600' : 'text-red-600'}
            bg={summary.net >= 0 ? 'bg-blue-50' : 'bg-red-50'}
            border={summary.net >= 0 ? 'border-blue-100' : 'border-red-100'}
          />
          <StatCard
            icon="📝" label="交易笔数" value={summary.transaction_count}
            color="text-gray-600" bg="bg-gray-50" border="border-gray-100" isInt
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 分类分布 */}
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-4">📈 {monthLabel}月支出分类</h2>
          {breakdown.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">本月暂无支出数据</p>
            </div>
          ) : (
            <div className="space-y-4">
              {breakdown.slice(0, 6).map((item) => (
                <div key={item.category}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600 font-medium">{item.category}</span>
                    <span className="text-gray-800">{item.amount.toFixed(0)}元</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 最近账单 */}
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-4">🕐 最近账单</h2>
          {recentBills.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">暂无账单记录</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentBills.map((b) => (
                <div key={b.id}
                  className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 font-medium truncate">
                      {b.payee || b.description || '未命名'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {b.category} · {b.transaction_date?.slice(0, 10) || '-'}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ml-3 ${b.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {b.amount < 0 ? '-' : '+'}{Math.abs(b.amount).toFixed(2)}
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

/** 统计卡片 */
function StatCard({ icon, label, value, color, bg, border, isInt }: {
  icon: string; label: string; value: number; color: string; bg: string; border: string; isInt?: boolean;
}) {
  return (
    <div className={`stat-card ${bg} ${border}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>
        {isInt ? value : value.toFixed(2)}
        <span className="text-xs font-normal text-gray-400 ml-1">元</span>
      </p>
    </div>
  );
}
