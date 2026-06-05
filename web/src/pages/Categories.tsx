/** 分类管理页面 — CRUD + 关键词管理 */

import { useState, useEffect } from 'react';
import { categoriesApi } from '../api/categories';
import type { CategoryResponse } from '../types/category';

export default function Categories() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', icon: '', color: '', keywords: '' });

  const loadCategories = async () => {
    setLoading(true);
    try { setCategories(await categoriesApi.list()); } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { loadCategories(); }, []);

  const resetForm = () => {
    setForm({ name: '', icon: '', color: '', keywords: '' });
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('请输入分类名称'); return; }
    setError('');
    try {
      if (editingId != null) {
        await categoriesApi.update(editingId, {
          name: form.name.trim(), icon: form.icon || null,
          color: form.color || null, keywords: form.keywords || null,
        });
      } else {
        await categoriesApi.create({
          name: form.name.trim(), icon: form.icon || null,
          color: form.color || null, keywords: form.keywords || null,
        });
      }
      resetForm();
      loadCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleEdit = (cat: CategoryResponse) => {
    setForm({
      name: cat.name, icon: cat.icon || '',
      color: cat.color || '', keywords: cat.keywords || '',
    });
    setEditingId(cat.id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定删除分类「${name}」吗？`)) return;
    try { await categoriesApi.delete(id); loadCategories(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : '删除失败'); }
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🏷️ 分类管理</h1>
          <p className="text-xs text-gray-400 mt-0.5">共 {categories.length} 个分类</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
          + 新建分类
        </button>
      </div>

      {/* 表单 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">
            {editingId != null ? '✏️ 编辑分类' : '✨ 新建分类'}
          </h3>
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg border border-red-100">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">名称 *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field" placeholder="如：餐饮、交通" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">图标</label>
              <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="input-field" placeholder="如：🍔" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">颜色</label>
              <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="input-field" placeholder="如：#FF6B6B" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">关键词</label>
              <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                className="input-field" placeholder="逗号分隔：麦当劳,外卖" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary bg-green-500 hover:bg-green-600">
              {editingId != null ? '保存修改' : '创建'}
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary">取消</button>
          </div>
        </form>
      )}

      {/* 分类列表 */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-3xl mb-2">🏷️</p>
            <p className="text-sm">暂无分类</p>
            <p className="text-xs mt-1">点击上方按钮创建你的第一个分类</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl shrink-0"
                    style={cat.color ? { backgroundColor: cat.color + '20', color: cat.color } : {}}>
                    {cat.icon || '📁'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{cat.name}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {cat.keywords ? cat.keywords.split(',').slice(0, 3).join(' · ') : '暂无关键词'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <button onClick={() => handleEdit(cat)}
                    className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium">
                    编辑
                  </button>
                  <button onClick={() => handleDelete(cat.id, cat.name)}
                    className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors font-medium">
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
