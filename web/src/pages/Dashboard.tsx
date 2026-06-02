/** 仪表盘 — 月度汇总 + 分类分布 + 最近账单 */

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
    return <div className="flex items-center justify-center h-64 text-gray-400">加载中...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">📊 仪表盘</h1>

      {/* 月度汇总卡片 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="收入" value={summary.income} color="text-green-600" bg="bg-green-50" />
          <StatCard label="支出" value={summary.expense} color="text-red-600" bg="bg-red-50" />
          <StatCard label="结余" value={summary.net} color="text-blue-600" bg="bg-blue-50" />
          <StatCard label="交易笔数" value={summary.transaction_count} color="text-gray-600" bg="bg-gray-50" isInt />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 分类分布 */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h2 className="font-semibold text-gray-700 mb-4">📈 本月支出分类</h2>
          {breakdown.length === 0 ? (
            <p className="text-gray-400 text-sm">暂无数据</p>
          ) : (
            <div className="space-y-3">
              {breakdown.slice(0, 6).map((item) => (
                <div key={item.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.category}</span>
                    <span className="text-gray-800 font-medium">{item.amount.toFixed(0)}元</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 最近账单 */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h2 className="font-semibold text-gray-700 mb-4">🕐 最近账单</h2>
          {recentBills.length === 0 ? (
            <p className="text-gray-400 text-sm">暂无账单</p>
          ) : (
            <div className="space-y-2">
              {recentBills.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{b.payee || b.description || '未命名'}</p>
                    <p className="text-xs text-gray-400">{b.category} · {b.transaction_date?.slice(0, 10)}</p>
                  </div>
                  <span className={`text-sm font-medium shrink-0 ml-2 ${b.amount < 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {b.amount < 0 ? '-' : '+'}{Math.abs(b.amount).toFixed(2)}元
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

/** 统计卡片子组件 */
function StatCard({ label, value, color, bg, isInt }: {
  label: string; value: number; color: string; bg: string; isInt?: boolean;
}) {
  return (
    <div className={`${bg} rounded-xl p-4`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {isInt ? value : value.toFixed(2)}
      </p>
    </div>
  );
}
