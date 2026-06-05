/** 账单明细 — 列表 + 文件上传(CSV/Excel/PDF/图片) + 手动创建 */

import { useState, useEffect, useRef } from 'react';
import { billsApi } from '../api/bills';
import { ocrApi } from '../api/ocr';
import { categoriesApi } from '../api/categories';
import type { BillResponse, BillUploadResponse } from '../types/bill';
import type { CategoryResponse } from '../types/category';
import type { OCRResponse, ExtractedItem } from '../types/ocr';

const BILL_FILE_ACCEPT = '.csv,.xlsx,.xls,.pdf';
const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp';

export default function Bills() {
  const [bills, setBills] = useState<BillResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // 创建表单
  const [showCreate, setShowCreate] = useState(false);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [form, setForm] = useState({ amount: '', category: '', payee: '', description: '', transaction_date: '' });

  // OCR 结果
  const [ocrResult, setOcrResult] = useState<OCRResponse | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const billFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 20;

  // 加载账单
  const loadBills = async (p: number) => {
    setLoading(true);
    try {
      const data = await billsApi.list(p * PAGE_SIZE, PAGE_SIZE);
      setBills(data);
      // 如果返回数据少于页大小，说明是最后一页
      if (data.length < PAGE_SIZE) {
        setTotalCount(p * PAGE_SIZE + data.length);
      }
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { loadBills(page); }, [page]);

  // 加载分类列表
  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {});
  }, []);

  // ---------- 文件上传 ----------
  const handleBillFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const result: BillUploadResponse = await billsApi.upload(file);
      setUploadMsg(`✅ ${result.message} — 共${result.data.total}条，新建${result.data.created}条，跳过${result.data.skipped}条`);
      setPage(0);
      loadBills(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setUploadMsg(`❌ 上传失败: ${msg}`);
    }
    setUploading(false);
    if (billFileRef.current) billFileRef.current.value = '';
  };

  // ---------- 图片上传 OCR ----------
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      const result = await ocrApi.recognize(file);
      setOcrResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setUploadMsg(`❌ OCR 识别失败: ${msg}`);
    }
    setOcrLoading(false);
    if (imageFileRef.current) imageFileRef.current.value = '';
  };

  // ---------- 手动创建账单 ----------
  const handleCreate = async () => {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || !form.category) return;
    try {
      await billsApi.create({
        amount,
        category: form.category,
        payee: form.payee || undefined,
        description: form.description || undefined,
        transaction_date: form.transaction_date ? new Date(form.transaction_date).toISOString() : undefined,
      });
      setForm({ amount: '', category: '', payee: '', description: '', transaction_date: '' });
      setShowCreate(false);
      loadBills(0);
    } catch { /* */ }
  };

  // ---------- 从 OCR 结果创建账单 ----------
  const createFromOCR = async (item: ExtractedItem) => {
    if (item.amount == null) return;
    try {
      await billsApi.create({
        amount: item.amount,
        category: item.category || '未分类',
        payee: item.payee || undefined,
        description: item.description || undefined,
        transaction_date: item.transaction_date || undefined,
      });
      loadBills(0);
      // 从列表中移除已创建的
      setOcrResult((prev) => prev ? {
        ...prev,
        items: prev.items.filter((i) => i !== item),
      } : null);
    } catch { /* */ }
  };

  // 金额格式化
  const fmtAmount = (amount: number) => {
    const sign = amount < 0 ? '-' : '+';
    return `${sign}${Math.abs(amount).toFixed(2)}`;
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 账单明细</h1>
          {totalCount != null && <p className="text-xs text-gray-400 mt-0.5">共 {totalCount} 条</p>}
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          + 手动记账
        </button>
      </div>

      {/* 创建表单 */}
      {showCreate && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">新建账单</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input type="number" step="0.01" placeholder="金额（支出为负）" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input-field" />
            <select value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input-field">
              <option value="">选择分类</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.icon || ''} {c.name}</option>)}
            </select>
            <input placeholder="商户名" value={form.payee}
              onChange={(e) => setForm({ ...form, payee: e.target.value })}
              className="input-field" />
            <input type="date" value={form.transaction_date}
              onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
              className="input-field" />
          </div>
          <input placeholder="描述（可选）" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-field" />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary bg-green-500 hover:bg-green-600">确认创建</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">取消</button>
          </div>
        </div>
      )}

      {/* 文件上传区 */}
      <div className="flex flex-wrap items-center gap-3">
        <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer transition-all
          ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-sm'}`}>
          📄 {uploading ? '上传中...' : '上传账单文件'}
          <input ref={billFileRef} type="file" accept={BILL_FILE_ACCEPT}
            onChange={handleBillFileUpload} disabled={uploading} className="hidden" />
        </label>

        <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm cursor-pointer transition-all
          ${ocrLoading ? 'bg-gray-100 text-gray-400' : 'bg-purple-50 text-purple-700 hover:bg-purple-100 shadow-sm'}`}>
          📸 {ocrLoading ? '识别中...' : '上传截图识别'}
          <input ref={imageFileRef} type="file" accept={IMAGE_ACCEPT}
            onChange={handleImageUpload} disabled={ocrLoading} className="hidden" />
        </label>

        <span className="text-xs text-gray-400">支持 CSV / Excel / PDF / PNG / JPG / WebP</span>
      </div>

      {uploadMsg && (
        <div className={`text-sm px-4 py-3 rounded-xl ${uploadMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {uploadMsg}
        </div>
      )}

      {/* OCR 结果卡片 */}
      {ocrResult && ocrResult.items.length > 0 && (
        <div className="card border-purple-200 bg-purple-50/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-purple-800 text-sm">
              📸 识别到 {ocrResult.items.length} 条记录 (置信度: {ocrResult.confidence})
            </h3>
            <button onClick={() => setOcrResult(null)}
              className="text-sm text-purple-500 hover:text-purple-700 transition-colors">关闭</button>
          </div>
          <div className="space-y-2">
            {ocrResult.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
                <div className="text-sm min-w-0">
                  <span className="font-medium text-gray-800">{item.payee || '未知商户'}</span>
                  <span className="text-gray-400 ml-2 text-xs">{item.category || ''} · {item.transaction_date || ''}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className={`text-sm font-semibold ${item.amount && item.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {item.amount ?? '?'}元
                  </span>
                  <button onClick={() => createFromOCR(item)}
                    className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition-colors shadow-sm">
                    记账
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 账单列表 */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        ) : bills.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm">暂无账单记录</p>
            <p className="text-xs mt-1">上传账单文件或使用 AI 记账开始记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3.5 font-medium">日期</th>
                  <th className="text-left px-5 py-3.5 font-medium">分类</th>
                  <th className="text-left px-5 py-3.5 font-medium">商户/描述</th>
                  <th className="text-right px-5 py-3.5 font-medium">金额</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                      {b.transaction_date?.slice(0, 10) || '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-block px-2.5 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                        {b.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 max-w-xs truncate">
                      {b.payee || b.description || '-'}
                      {b.remark && <span className="text-gray-400 ml-1 text-xs">({b.remark})</span>}
                    </td>
                    <td className={`px-5 py-3.5 text-right font-semibold whitespace-nowrap ${b.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {fmtAmount(b.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分页 */}
      {bills.length > 0 && (
        <div className="flex justify-center items-center gap-3">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-30">← 上一页</button>
          <span className="text-sm text-gray-500 font-medium">第 {page + 1} 页</span>
          <button onClick={() => setPage(page + 1)} disabled={bills.length < PAGE_SIZE}
            className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-30">下一页 →</button>
        </div>
      )}
    </div>
  );
}
