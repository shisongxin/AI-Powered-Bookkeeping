/** 分类管理页面 — CRUD + 关键词管理 */

import { useState, useEffect } from 'react';
import { categoriesApi } from '../api/categories';
import type { CategoryResponse } from '../types/category';

export default function Categories() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 表单
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', icon: '', color: '', keywords: '' });

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await categoriesApi.list();
      setCategories(data);
    } catch { /* */ }
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
          name: form.name.trim(),
          icon: form.icon || null,
          color: form.color || null,
          keywords: form.keywords || null,
        });
      } else {
        await categoriesApi.create({
          name: form.name.trim(),
          icon: form.icon || null,
          color: form.color || null,
          keywords: form.keywords || null,
        });
      }
      resetForm();
      loadCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      setError(msg);
    }
  };

  const handleEdit = (cat: CategoryResponse) => {
    setForm({
      name: cat.name,
      icon: cat.icon || '',
      color: cat.color || '',
      keywords: cat.keywords || '',
    });
    setEditingId(cat.id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定删除分类「${name}」吗？`)) return;
    try {
      await categoriesApi.delete(id);
      loadCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除失败';
      setError(msg);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">🏷️ 分类管理</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600"
        >
          + 新建分类
        </button>
      </div>

      {/* 创建/编辑表单 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 border border-gray-200 space-y-3">
          <h3 className="font-semibold text-gray-700">
            {editingId != null ? '编辑分类' : '新建分类'}
          </h3>

          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">名称 *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="如：餐饮、交通"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">图标</label>
              <input
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="如：🍔"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">颜色</label>
              <input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="如：#FF6B6B"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">关键词（逗号分隔）</label>
              <input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="如：麦当劳,肯德基,外卖"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit"
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
              {editingId != null ? '保存修改' : '创建'}
            </button>
            <button type="button" onClick={resetForm}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
              取消
            </button>
          </div>
        </form>
      )}

      {/* 分类列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-gray-400">暂无分类，点击上方按钮创建</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{cat.icon || '📁'}</span>
                  <div>
                    <p className="font-medium text-gray-800">{cat.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {cat.keywords || '暂无关键词'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button onClick={() => handleEdit(cat)}
                    className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    编辑
                  </button>
                  <button onClick={() => handleDelete(cat.id, cat.name)}
                    className="px-3 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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
