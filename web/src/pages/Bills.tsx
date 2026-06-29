/** Bills — monthly fold cards with summary + search + inline edit */

import { useState, useEffect, useRef, useMemo } from 'react';
import { billsApi } from '../api/bills';
import { ocrApi } from '../api/ocr';
import { categoriesApi } from '../api/categories';
import type { BillResponse, BillUpdate, BillUploadResponse } from '../types/bill';
import type { CategoryResponse } from '../types/category';
import type { OCRResponse, ExtractedItem } from '../types/ocr';

const BILL_FILE_ACCEPT = '.csv,.xlsx,.xls,.pdf';
const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp';

interface MonthGroup { month: string; label: string; bills: BillResponse[]; income: number; expense: number; balance: number; }

export default function Bills() {
  const [allBills, setAllBills] = useState<BillResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const nowMonth = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }, []);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set([nowMonth]));
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [form, setForm] = useState({ amount: '', category: '', payee: '', description: '', transaction_date: '' });
  const [ocrResult, setOcrResult] = useState<OCRResponse | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const billFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);

  const loadBills = async () => {
    setLoading(true);
    try {
      const data = searchKeyword || searchCategory || searchDate
        ? await billsApi.search({ keyword: searchKeyword || undefined, category: searchCategory || undefined, start_date: searchDate || undefined, limit: 500 })
        : await billsApi.list(0, 500);
      setAllBills(data);
    } catch { /* */ }
    setLoading(false);
  };
  useEffect(() => { loadBills(); }, [searchKeyword, searchCategory, searchDate]);
  useEffect(() => { categoriesApi.list().then(setCategories).catch(() => {}); }, []);

  const monthGroups = useMemo(() => {
    const g: Record<string, MonthGroup> = {};
    for (const b of allBills) {
      const m = (b.transaction_date || b.created_at || '').slice(0, 7); if (!m) continue;
      if (!g[m]) { const [y, mo] = m.split('-'); g[m] = { month: m, label: `${y}年${mo}月`, bills: [], income: 0, expense: 0, balance: 0 }; }
      g[m].bills.push(b);
      // 统一使用 direction 字段判断收支
      if (b.direction === '收入') {
        g[m].income += Math.abs(b.amount);
      } else if (b.direction === '支出') {
        g[m].expense += Math.abs(b.amount);
      } else {
        // 对于没有 direction 的数据，使用 amount 符号
        if (b.amount > 0) g[m].income += b.amount;
        else g[m].expense += Math.abs(b.amount);
      }
      g[m].balance = g[m].income - g[m].expense;
    }
    return Object.values(g).sort((a, b) => b.month.localeCompare(a.month));
  }, [allBills]);

  const toggle = (m: string) => setExpandedMonths(p => { const n = new Set(p); n.has(m) ? n.delete(m) : n.add(m); return n; });
  const fmt = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(2)}`;

  // Upload
  const handleBillFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true); setUploadMsg('');
    try { const r: BillUploadResponse = await billsApi.upload(f); setUploadMsg(`✅ ${r.message} — 新建${r.data.created}条，跳过${r.data.skipped}条`); loadBills(); }
    catch (er: unknown) { setUploadMsg(`❌ ${er instanceof Error ? er.message : '失败'}`); }
    setUploading(false); if (billFileRef.current) billFileRef.current.value = '';
  };
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setOcrLoading(true);
    try { setOcrResult(await ocrApi.recognize(f)); } catch (er: unknown) { setUploadMsg(`❌ OCR 失败: ${er instanceof Error ? er.message : ''}`); }
    setOcrLoading(false); if (imageFileRef.current) imageFileRef.current.value = '';
  };

  // Create
  const handleCreate = async () => {
    const a = parseFloat(form.amount); if (isNaN(a) || !form.category) return;
    try { await billsApi.create({ amount: a, category: form.category, payee: form.payee || undefined, description: form.description || undefined, transaction_date: form.transaction_date ? new Date(form.transaction_date).toISOString() : undefined }); setForm({ amount: '', category: '', payee: '', description: '', transaction_date: '' }); setShowCreate(false); loadBills(); } catch { /* */ }
  };
  const createFromOCR = async (item: ExtractedItem) => {
    if (item.amount == null) return;
    try { await billsApi.create({ amount: item.amount, category: item.category || '其他', payee: item.payee || undefined, description: item.description || undefined, transaction_date: item.transaction_date || undefined }); loadBills(); setOcrResult(p => p ? { ...p, items: p.items.filter(i => i !== item) } : null); } catch { /* */ }
  };

  // Edit
  const startEdit = (b: BillResponse) => { setEditingBillId(b.id); setEditForm({ amount: String(b.amount), category: b.category || '', payee: b.payee || '', description: b.description || '', transaction_date: b.transaction_date?.slice(0, 10) || '' }); };
  const cancelEdit = () => { setEditingBillId(null); setEditForm({}); };
  const handleUpdate = async () => {
    if (editingBillId == null) return;
    const d: BillUpdate = {};
    if (editForm.amount && !isNaN(Number(editForm.amount))) d.amount = Number(editForm.amount);
    if (editForm.category) d.category = editForm.category;
    if (editForm.payee != null) d.payee = editForm.payee;
    if (editForm.description != null) d.description = editForm.description;
    if (editForm.transaction_date) d.transaction_date = editForm.transaction_date;
    try { await billsApi.update(editingBillId, d); cancelEdit(); loadBills(); } catch { /* */ }
  };

  const handleDeleteBill = async (id: number, label: string) => {
    if (!confirm(`确定删除「${label}」吗？此操作不可撤销。`)) return;
    try { await billsApi.delete(id); loadBills(); } catch { /* */ }
  };

  const renderRow = (b: BillResponse) => {
    // 统一使用 direction 字段判断收支
    const isIncome = b.direction === '收入' || (!b.direction && b.amount > 0)
    const amountColor = isIncome ? 'text-emerald-600' : 'text-coral-600'
    const amountSign = isIncome ? '+' : '-'

    if (editingBillId === b.id) {
      return (
        <tr key={b.id} className="bg-gold-50/50">
          <td className="px-3 py-2"><input type="date" value={editForm.transaction_date || ''} onChange={e => setEditForm({ ...editForm, transaction_date: e.target.value })} className="w-full border border-espresso-200 rounded-lg px-2 py-1 text-xs" /></td>
          <td className="px-3 py-2"><select value={editForm.category || ''} onChange={e => setEditForm({ ...editForm, category: e.target.value })} className="w-full border border-espresso-200 rounded-lg px-2 py-1 text-xs">{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></td>
          <td className="px-3 py-2"><input value={editForm.payee || ''} onChange={e => setEditForm({ ...editForm, payee: e.target.value })} className="w-full border border-espresso-200 rounded-lg px-2 py-1 text-xs" /></td>
          <td className="px-3 py-2 hidden md:table-cell"><input value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="w-full border border-espresso-200 rounded-lg px-2 py-1 text-xs" /></td>
          <td className="px-3 py-2 text-right"><input type="number" step="0.01" value={editForm.amount || ''} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} className="w-24 border border-espresso-200 rounded-lg px-2 py-1 text-xs text-right" /></td>
          <td className="px-3 py-2 text-center"><div className="flex gap-1 justify-center"><button onClick={handleUpdate} className="px-2.5 py-1 bg-emerald-500 text-white text-xs rounded-lg font-medium hover:bg-emerald-600 transition-colors">保存</button><button onClick={cancelEdit} className="px-2.5 py-1 bg-espresso-100 text-espresso-600 text-xs rounded-lg hover:bg-espresso-200 transition-colors">取消</button></div></td>
        </tr>
      );
    }
    return (
      <tr key={b.id} className="table-row group">
        <td className="px-3 py-3 text-espresso-400 text-xs whitespace-nowrap">{b.transaction_date?.slice(0, 10) || '-'}</td>
        <td className="px-3 py-3"><span className="badge">{b.category}</span></td>
        <td className="px-3 py-3 text-espresso-700 text-sm max-w-[180px] truncate font-medium">{b.payee || b.description || '-'}</td>
        <td className="px-3 py-3 text-espresso-400 text-xs max-w-[140px] truncate hidden md:table-cell">{b.description || b.remark || ''}</td>
        <td className={`px-3 py-3 text-right font-semibold text-sm tabular-nums whitespace-nowrap ${amountColor}`}>{amountSign}¥{Math.abs(b.amount).toFixed(2)}</td>
        <td className="px-3 py-3 text-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-center gap-1">
            <button onClick={() => startEdit(b)} className="px-2.5 py-1 text-xs text-gold-700 hover:bg-gold-100 rounded-lg transition-colors font-medium">编辑</button>
            <button onClick={() => handleDeleteBill(b.id, b.payee || b.description || '未命名')} className="px-2.5 py-1 text-xs text-coral-600 hover:bg-coral-50 rounded-lg transition-colors font-medium">删除</button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6 stagger-children">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-espresso-800 font-display">账单明细</h1>
          <p className="text-sm text-espresso-400 mt-0.5">{allBills.length} 条记录 · {monthGroups.length} 个月</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">+ 手动记账</button>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso-300"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} placeholder="搜索商户或描述…" className="input-field !pl-9 !w-52 !py-2" />
        </div>
        <select value={searchCategory} onChange={e => setSearchCategory(e.target.value)} className="select-field !w-32 !py-2"><option value="">全部分类</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
        <input type="month" value={searchDate} onChange={e => setSearchDate(e.target.value)} className="input-field !w-40 !py-2" />
        {(searchKeyword || searchCategory || searchDate) && <button onClick={() => { setSearchKeyword(''); setSearchCategory(''); setSearchDate(''); }} className="btn-ghost !text-xs">清除</button>}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="glass-card p-5 space-y-3 animate-scale-in">
          <h3 className="font-semibold text-espresso-700 text-sm">新建账单</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input type="number" step="0.01" placeholder="金额（支出为负）" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="input-field" />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="select-field">{<option value="">选择分类</option>}{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
            <input placeholder="商户名" value={form.payee} onChange={e => setForm({ ...form, payee: e.target.value })} className="input-field" />
            <input type="date" value={form.transaction_date} onChange={e => setForm({ ...form, transaction_date: e.target.value })} className="input-field" />
          </div>
          <input placeholder="描述（可选）" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" />
          <div className="flex gap-2"><button onClick={handleCreate} className="btn-primary !bg-emerald-500 !from-emerald-500 !to-emerald-600">确认创建</button><button onClick={() => setShowCreate(false)} className="btn-secondary">取消</button></div>
        </div>
      )}

      {/* Upload */}
      <div className="flex flex-wrap items-center gap-3">
        <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer transition-all ${uploading ? 'bg-espresso-100 text-espresso-400' : 'bg-white/80 border border-espresso-200 text-espresso-600 hover:border-gold-300 hover:text-gold-700 shadow-sm'}`}>
          📄 {uploading ? '上传中…' : '上传账单文件'}
          <input ref={billFileRef} type="file" accept={BILL_FILE_ACCEPT} onChange={handleBillFileUpload} disabled={uploading} className="hidden" />
        </label>
        <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer transition-all ${ocrLoading ? 'bg-espresso-100 text-espresso-400' : 'bg-white/80 border border-espresso-200 text-espresso-600 hover:border-gold-300 hover:text-gold-700 shadow-sm'}`}>
          📸 {ocrLoading ? '识别中…' : '上传截图识别'}
          <input ref={imageFileRef} type="file" accept={IMAGE_ACCEPT} onChange={handleImageUpload} disabled={ocrLoading} className="hidden" />
        </label>
        <span className="text-xs text-espresso-300">CSV · Excel · PDF · 图片</span>
      </div>
      {uploadMsg && <div className={`text-sm px-4 py-3 rounded-xl ${uploadMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-coral-50 text-coral-600 border border-coral-100'}`}>{uploadMsg}</div>}

      {/* OCR results */}
      {ocrResult && ocrResult.items.length > 0 && (
        <div className="glass-card p-4 border-emerald-200 bg-emerald-50/50">
          <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-emerald-800 text-sm">📸 识别到 {ocrResult.items.length} 条</h3><button onClick={() => setOcrResult(null)} className="text-xs text-emerald-600 hover:text-emerald-800">关闭</button></div>
          <div className="space-y-2">{ocrResult.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
              <div className="text-sm"><span className="font-medium text-espresso-800">{item.payee || '未知商户'}</span><span className="text-espresso-400 ml-2 text-xs">{item.category || ''}</span></div>
              <div className="flex items-center gap-3"><span className={`text-sm font-semibold ${item.amount && item.amount < 0 ? 'text-coral-600' : 'text-emerald-600'}`}>{item.amount ?? '?'}元</span><button onClick={() => createFromOCR(item)} className="px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600 transition-colors">记账</button></div>
            </div>
          ))}</div>
        </div>
      )}

      {/* Monthly Groups */}
      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : monthGroups.length === 0 ? (
        <div className="glass-card text-center py-16">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 text-espresso-200"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p className="text-espresso-400 font-medium">暂无账单记录</p>
          <p className="text-espresso-300 text-sm mt-1">上传文件或使用 AI 记账开始</p>
        </div>
      ) : (
        <div className="space-y-4">
          {monthGroups.map(group => {
            const open = expandedMonths.has(group.month);
            return (
              <div key={group.month} className="glass-card !p-0 overflow-hidden animate-slide-up">
                <button onClick={() => toggle(group.month)} className="month-header">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={`text-gold-500 transition-transform duration-300 shrink-0 ${open ? 'rotate-90' : ''}`}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <span className="font-bold text-espresso-700 font-display">{group.label}</span>
                  <span className="badge-gold">{group.bills.length} 笔</span>
                  <div className="flex items-center gap-5 ml-auto text-sm">
                    <Stat label="收入" value={group.income} color="text-emerald-600" />
                    <Stat label="支出" value={group.expense} color="text-coral-600" isExpense />
                    <Stat label="结余" value={group.balance} color={group.balance >= 0 ? 'text-blue-600' : 'text-coral-600'} />
                  </div>
                </button>
                {open && (
                  <div className="border-t border-espresso-100 overflow-x-auto animate-fade-in">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-espresso-50/50 text-espresso-400 text-xs uppercase tracking-wider">
                        <th className="text-left px-3 py-3 font-medium">日期</th><th className="text-left px-3 py-3 font-medium">分类</th>
                        <th className="text-left px-3 py-3 font-medium">商户</th><th className="text-left px-3 py-3 font-medium hidden md:table-cell">描述</th>
                        <th className="text-right px-3 py-3 font-medium">金额</th><th className="text-center px-3 py-3 font-medium w-14"></th>
                      </tr></thead>
                      <tbody className="divide-y divide-espresso-50">{group.bills.map(renderRow)}</tbody>
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

function Stat({ label, value, color, isExpense }: { label: string; value: number; color: string; isExpense?: boolean }) {
  // 支出显示为负数（如 -¥100），收入显示为正数（如 +¥500），结余根据正负显示
  const sign = isExpense ? '−' : (value < 0 ? '−' : '+')
  return <div className="text-right"><span className="text-xs text-espresso-300 mr-1">{label}</span><span className={`font-semibold tabular-nums ${color}`}>{sign}{Math.abs(value).toFixed(0)}</span></div>;
}
