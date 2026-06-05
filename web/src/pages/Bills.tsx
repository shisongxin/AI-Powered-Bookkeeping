/** 账单明细 — 按月折叠 + 搜索 + 编辑 + 文件上传 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { billsApi } from '../api/bills';
import { ocrApi } from '../api/ocr';
import { categoriesApi } from '../api/categories';
import type { BillResponse, BillUpdate, BillUploadResponse } from '../types/bill';
import type { CategoryResponse } from '../types/category';
import type { OCRResponse, ExtractedItem } from '../types/ocr';

const BILL_FILE_ACCEPT = '.csv,.xlsx,.xls,.pdf';
const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp';

/** 按月分组的数据结构 */
interface MonthGroup {
  month: string;          // "2026-06"
  label: string;          // "2026年06月"
  bills: BillResponse[];
  income: number;
  expense: number;
  balance: number;
}

export default function Bills() {
  const [allBills, setAllBills] = useState<BillResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  // 搜索
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [searchDate, setSearchDate] = useState('');

  // 展开的月份集合（默认本月展开）
  const nowMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set([nowMonth]));

  // 编辑
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  // 创建
  const [showCreate, setShowCreate] = useState(false);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [form, setForm] = useState({ amount: '', category: '', payee: '', description: '', transaction_date: '' });

  // OCR
  const [ocrResult, setOcrResult] = useState<OCRResponse | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const billFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);

  // ---- 加载全部账单 ----
  const loadBills = async () => {
    setLoading(true);
    try {
      // 用 search API 拉取所有账单（不带过滤条件 = 全部）
      const data = searchKeyword || searchCategory || searchDate
        ? await billsApi.search({
            keyword: searchKeyword || undefined,
            category: searchCategory || undefined,
            start_date: searchDate || undefined,
            limit: 500,
          })
        : await billsApi.list(0, 500);
      setAllBills(data);
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { loadBills(); }, [searchKeyword, searchCategory, searchDate]);
  useEffect(() => { categoriesApi.list().then(setCategories).catch(() => {}); }, []);

  // ---- 按月分组 ----
  const monthGroups = useMemo(() => {
    const groups: Record<string, MonthGroup> = {};
    for (const b of allBills) {
      const month = (b.transaction_date || b.created_at || '').slice(0, 7); // "YYYY-MM"
      if (!month) continue;
      if (!groups[month]) {
        const [y, m] = month.split('-');
        groups[month] = {
          month,
          label: `${y}年${m}月`,
          bills: [],
          income: 0,
          expense: 0,
          balance: 0,
        };
      }
      groups[month].bills.push(b);
      if (b.amount > 0) groups[month].income += b.amount;
      else groups[month].expense += Math.abs(b.amount);
      groups[month].balance = groups[month].income - groups[month].expense;
    }
    // 按月倒序
    return Object.values(groups).sort((a, b) => b.month.localeCompare(a.month));
  }, [allBills]);

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  // ---- 文件上传 ----
  const handleBillFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadMsg('');
    try {
      const result: BillUploadResponse = await billsApi.upload(file);
      setUploadMsg(`✅ ${result.message} — 共${result.data.total}条，新建${result.data.created}条，跳过${result.data.skipped}条`);
      loadBills();
    } catch (err: unknown) {
      setUploadMsg(`❌ 上传失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
    setUploading(false);
    if (billFileRef.current) billFileRef.current.value = '';
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    try { setOcrResult(await ocrApi.recognize(file)); }
    catch (err: unknown) { setUploadMsg(`❌ OCR 识别失败: ${err instanceof Error ? err.message : '未知错误'}`); }
    setOcrLoading(false);
    if (imageFileRef.current) imageFileRef.current.value = '';
  };

  // ---- 创建 ----
  const handleCreate = async () => {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || !form.category) return;
    try {
      await billsApi.create({
        amount, category: form.category, payee: form.payee || undefined,
        description: form.description || undefined,
        transaction_date: form.transaction_date ? new Date(form.transaction_date).toISOString() : undefined,
      });
      setForm({ amount: '', category: '', payee: '', description: '', transaction_date: '' });
      setShowCreate(false);
      loadBills();
    } catch { /* */ }
  };

  const createFromOCR = async (item: ExtractedItem) => {
    if (item.amount == null) return;
    try {
      await billsApi.create({
        amount: item.amount, category: item.category || '其他',
        payee: item.payee || undefined, description: item.description || undefined,
        transaction_date: item.transaction_date || undefined,
      });
      loadBills();
      setOcrResult((prev) => prev ? { ...prev, items: prev.items.filter((i) => i !== item) } : null);
    } catch { /* */ }
  };

  // ---- 编辑 ----
  const startEdit = (b: BillResponse) => {
    setEditingBillId(b.id);
    setEditForm({
      amount: String(b.amount),
      category: b.category || '',
      payee: b.payee || '',
      description: b.description || '',
      transaction_date: b.transaction_date?.slice(0, 10) || '',
    });
  };

  const cancelEdit = () => { setEditingBillId(null); setEditForm({}); };

  const handleUpdate = async () => {
    if (editingBillId == null) return;
    const data: BillUpdate = {};
    if (editForm.amount && !isNaN(Number(editForm.amount))) data.amount = Number(editForm.amount);
    if (editForm.category) data.category = editForm.category;
    if (editForm.payee != null) data.payee = editForm.payee;
    if (editForm.description != null) data.description = editForm.description;
    if (editForm.transaction_date) data.transaction_date = editForm.transaction_date;
    try {
      await billsApi.update(editingBillId, data);
      cancelEdit();
      loadBills();
    } catch { /* */ }
  };

  // ---- 表格行渲染 ----
  const renderRow = (b: BillResponse) => {
    const isEditing = editingBillId === b.id;
    const fmt = (v: number) => {
      const sign = v < 0 ? '-' : '+';
      return `${sign}${Math.abs(v).toFixed(2)}`;
    };

    if (isEditing) {
      return (
        <tr key={b.id} className="bg-blue-50/50">
          <td className="px-3 py-2">
            <input type="date" value={editForm.transaction_date || ''}
              onChange={(e) => setEditForm({ ...editForm, transaction_date: e.target.value })}
              className="w-full border rounded px-2 py-1 text-xs" />
          </td>
          <td className="px-3 py-2">
            <select value={editForm.category || ''}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              className="w-full border rounded px-2 py-1 text-xs">
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </td>
          <td className="px-3 py-2">
            <input value={editForm.payee || ''}
              onChange={(e) => setEditForm({ ...editForm, payee: e.target.value })}
              className="w-full border rounded px-2 py-1 text-xs" placeholder="商户" />
          </td>
          <td className="px-3 py-2">
            <input value={editForm.description || ''}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full border rounded px-2 py-1 text-xs" placeholder="描述" />
          </td>
          <td className="px-3 py-2 text-right">
            <input type="number" step="0.01" value={editForm.amount || ''}
              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              className="w-24 border rounded px-2 py-1 text-xs text-right" />
          </td>
          <td className="px-3 py-2 text-center">
            <div className="flex gap-1 justify-center">
              <button onClick={handleUpdate} className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">保存</button>
              <button onClick={cancelEdit} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200">取消</button>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr key={b.id} className="hover:bg-gray-50/50 transition-colors group">
        <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">
          {b.transaction_date?.slice(0, 10) || '-'}
        </td>
        <td className="px-3 py-2.5">
          <span className="inline-block px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
            {b.category}
          </span>
        </td>
        <td className="px-3 py-2.5 text-gray-700 text-sm max-w-[200px] truncate">
          {b.payee || b.description || '-'}
        </td>
        <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[150px] truncate hidden md:table-cell">
          {b.description || b.remark || ''}
        </td>
        <td className={`px-3 py-2.5 text-right font-semibold text-sm whitespace-nowrap ${b.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
          {fmt(b.amount)}
        </td>
        <td className="px-3 py-2.5 text-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => startEdit(b)}
            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors">编辑</button>
        </td>
      </tr>
    );
  };

  // 金额格式化
  const fmtMoney = (v: number) => {
    const sign = v >= 0 ? '+' : '';
    return `${sign}${v.toFixed(2)}`;
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 账单明细</h1>
          <p className="text-xs text-gray-400 mt-0.5">共 {allBills.length} 条 · {monthGroups.length} 个月</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">+ 手动记账</button>
      </div>

      {/* 搜索栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="🔍 搜索商户/描述..."
          className="input-field !w-48 !py-2 text-sm"
        />
        <select value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)}
          className="input-field !w-32 !py-2 text-sm">
          <option value="">全部分类</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <input type="month" value={searchDate} onChange={(e) => setSearchDate(e.target.value)}
          className="input-field !w-40 !py-2 text-sm" />
        {(searchKeyword || searchCategory || searchDate) && (
          <button onClick={() => { setSearchKeyword(''); setSearchCategory(''); setSearchDate(''); }}
            className="text-xs text-gray-400 hover:text-gray-600">清除筛选</button>
        )}
      </div>

      {/* 创建表单 */}
      {showCreate && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">新建账单</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input type="number" step="0.01" placeholder="金额（支出为负）" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field" />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input-field">
              <option value="">选择分类</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <input placeholder="商户名" value={form.payee}
              onChange={(e) => setForm({ ...form, payee: e.target.value })} className="input-field" />
            <input type="date" value={form.transaction_date}
              onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} className="input-field" />
          </div>
          <input placeholder="描述（可选）" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary bg-green-500 hover:bg-green-600">确认创建</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">取消</button>
          </div>
        </div>
      )}

      {/* 文件上传 */}
      <div className="flex flex-wrap items-center gap-3">
        <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer transition-all ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-sm'}`}>
          📄 {uploading ? '上传中...' : '上传账单文件'}
          <input ref={billFileRef} type="file" accept={BILL_FILE_ACCEPT} onChange={handleBillFileUpload} disabled={uploading} className="hidden" />
        </label>
        <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer transition-all ${ocrLoading ? 'bg-gray-100 text-gray-400' : 'bg-purple-50 text-purple-700 hover:bg-purple-100 shadow-sm'}`}>
          📸 {ocrLoading ? '识别中...' : '上传截图识别'}
          <input ref={imageFileRef} type="file" accept={IMAGE_ACCEPT} onChange={handleImageUpload} disabled={ocrLoading} className="hidden" />
        </label>
        <span className="text-xs text-gray-400">CSV / Excel / PDF / 图片</span>
      </div>

      {uploadMsg && (
        <div className={`text-sm px-4 py-3 rounded-xl ${uploadMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {uploadMsg}
        </div>
      )}

      {/* OCR 结果 */}
      {ocrResult && ocrResult.items.length > 0 && (
        <div className="card border-purple-200 bg-purple-50/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-purple-800 text-sm">📸 识别到 {ocrResult.items.length} 条记录</h3>
            <button onClick={() => setOcrResult(null)} className="text-sm text-purple-500 hover:text-purple-700">关闭</button>
          </div>
          <div className="space-y-2">
            {ocrResult.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
                <div className="text-sm min-w-0">
                  <span className="font-medium text-gray-800">{item.payee || '未知商户'}</span>
                  <span className="text-gray-400 ml-2 text-xs">{item.category || ''}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className={`text-sm font-semibold ${item.amount && item.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {item.amount ?? '?'}元
                  </span>
                  <button onClick={() => createFromOCR(item)}
                    className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition-colors shadow-sm">记账</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 按月折叠列表 ===== */}
      {loading ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
            <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>
      ) : monthGroups.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">暂无账单记录</p>
          <p className="text-xs mt-1">上传账单文件或使用 AI 记账开始记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {monthGroups.map((group) => {
            const isExpanded = expandedMonths.has(group.month);
            return (
              <div key={group.month} className="card !p-0 overflow-hidden">
                {/* 月份头部（可点击折叠） */}
                <button
                  onClick={() => toggleMonth(group.month)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                    <span className="font-semibold text-gray-700">{group.label}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {group.bills.length} 笔
                    </span>
                  </div>

                  {/* 月度汇总数字 */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <span className="text-xs text-gray-400">收入 </span>
                      <span className="font-semibold text-emerald-600">{fmtMoney(group.income)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">支出 </span>
                      <span className="font-semibold text-rose-600">{fmtMoney(-group.expense)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">结余 </span>
                      <span className={`font-semibold ${group.balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                        {fmtMoney(group.balance)}
                      </span>
                    </div>
                  </div>
                </button>

                {/* 折叠内容 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                          <th className="text-left px-3 py-2.5 font-medium w-[100px]">日期</th>
                          <th className="text-left px-3 py-2.5 font-medium w-[80px]">分类</th>
                          <th className="text-left px-3 py-2.5 font-medium">商户</th>
                          <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">描述</th>
                          <th className="text-right px-3 py-2.5 font-medium w-[100px]">金额</th>
                          <th className="text-center px-3 py-2.5 font-medium w-[60px]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {group.bills.map(renderRow)}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
