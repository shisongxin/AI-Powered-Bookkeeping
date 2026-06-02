/** 账单明细 — 列表 + 文件上传(CSV/Excel/PDF/图片) + 手动创建 */

import { useState, useEffect, useRef } from 'react';
import { billsApi } from '../api/bills';
import { ocrApi } from '../api/ocr';
import { categoriesApi } from '../api/categories';
import type { BillResponse, BillUploadResponse } from '../types/bill';
import type { CategoryResponse } from '../types/category';
import type { OCRResponse, ExtractedItem } from '../types/ocr';

/** 后端支持的文件格式 */
const FILE_ACCEPT = '.csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp';
const BILL_FILE_ACCEPT = '.csv,.xlsx,.xls,.pdf';
const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp';

export default function Bills() {
  const [bills, setBills] = useState<BillResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploading, setUploading] = useState(false);

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
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { loadBills(page); }, [page]);

  // 加载分类列表
  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {});
  }, []);

  // ---------- 文件上传（CSV/Excel/PDF） ----------
  const handleBillFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const result: BillUploadResponse = await billsApi.upload(file);
      setUploadMsg(`✅ ${result.message} — 共${result.data.total}条，新建${result.data.created}条，跳过${result.data.skipped}条`);
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📋 账单明细</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600"
        >
          + 手动记账
        </button>
      </div>

      {/* 创建表单 */}
      {showCreate && (
        <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input type="number" step="0.01" placeholder="金额（支出为负）" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm" />
            <select value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm">
              <option value="">选择分类</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <input placeholder="商户名" value={form.payee}
              onChange={(e) => setForm({ ...form, payee: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={form.transaction_date}
              onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <input placeholder="描述（可选）" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm w-full" />
          <button onClick={handleCreate}
            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
            确认创建
          </button>
        </div>
      )}

      {/* 文件上传区 */}
      <div className="flex flex-wrap gap-3">
        {/* CSV/Excel/PDF 上传 */}
        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm cursor-pointer
          ${uploading ? 'bg-gray-200 text-gray-500' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
          📄 {uploading ? '上传中...' : '上传账单文件'}
          <input ref={billFileRef} type="file" accept={BILL_FILE_ACCEPT}
            onChange={handleBillFileUpload} disabled={uploading} className="hidden" />
        </label>

        {/* 图片 OCR 上传 */}
        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm cursor-pointer
          ${ocrLoading ? 'bg-gray-200 text-gray-500' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>
          📸 {ocrLoading ? '识别中...' : '上传截图识别'}
          <input ref={imageFileRef} type="file" accept={IMAGE_ACCEPT}
            onChange={handleImageUpload} disabled={ocrLoading} className="hidden" />
        </label>

        <span className="text-xs text-gray-400 self-center">
          支持 CSV / Excel / PDF / PNG / JPG / WebP
        </span>
      </div>

      {uploadMsg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${uploadMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {uploadMsg}
        </div>
      )}

      {/* OCR 结果卡片 */}
      {ocrResult && ocrResult.items.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-purple-800">
              📸 识别到 {ocrResult.items.length} 条记录 (置信度: {ocrResult.confidence})
            </h3>
            <button onClick={() => setOcrResult(null)} className="text-sm text-purple-500 hover:text-purple-700">关闭</button>
          </div>
          <div className="space-y-2">
            {ocrResult.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg px-4 py-2">
                <div className="text-sm">
                  <span className="font-medium text-gray-800">{item.payee || '未知商户'}</span>
                  <span className="text-gray-400 ml-2">{item.category || ''} · {item.transaction_date || ''}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={item.amount && item.amount < 0 ? 'text-red-500' : 'text-green-500'}>
                    {item.amount ?? '?'}元
                  </span>
                  <button onClick={() => createFromOCR(item)}
                    className="px-3 py-1 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600">
                    记账
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 账单列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : bills.length === 0 ? (
          <div className="p-8 text-center text-gray-400">暂无账单记录</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">日期</th>
                <th className="text-left px-4 py-3">分类</th>
                <th className="text-left px-4 py-3">商户/描述</th>
                <th className="text-right px-4 py-3">金额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bills.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{b.transaction_date?.slice(0, 10) || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs">{b.category}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {b.payee || b.description || '-'}
                    {b.remark && <span className="text-gray-400 ml-1">({b.remark})</span>}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${b.amount < 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {b.amount < 0 ? '-' : '+'}{Math.abs(b.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页 */}
      <div className="flex justify-center gap-2">
        <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50">上一页</button>
        <span className="px-3 py-1 text-sm text-gray-500">第 {page + 1} 页</span>
        <button onClick={() => setPage(page + 1)} disabled={bills.length < PAGE_SIZE}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50">下一页</button>
      </div>
    </div>
  );
}
