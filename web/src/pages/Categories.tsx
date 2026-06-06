/** Categories — card grid + CRUD */

import { useState, useEffect } from 'react';
import { categoriesApi } from '../api/categories';
import type { CategoryResponse } from '../types/category';

export default function Categories() {
  const [cats, setCats] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', icon: '', color: '', keywords: '' });

  const load = async () => { setLoading(true); try { setCats(await categoriesApi.list()); } catch { /* */ } setLoading(false); };
  useEffect(() => { load(); }, []);

  const reset = () => { setForm({ name: '', icon: '', color: '', keywords: '' }); setEditingId(null); setShowForm(false); setError(''); };
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (!form.name.trim()) { setError('请输入分类名称'); return; } setError(''); try { if (editingId != null) await categoriesApi.update(editingId, { name: form.name.trim(), icon: form.icon || null, color: form.color || null, keywords: form.keywords || null }); else await categoriesApi.create({ name: form.name.trim(), icon: form.icon || null, color: form.color || null, keywords: form.keywords || null }); reset(); load(); } catch (er: unknown) { setError(er instanceof Error ? er.message : '操作失败'); } };
  const handleEdit = (c: CategoryResponse) => { setForm({ name: c.name, icon: c.icon || '', color: c.color || '', keywords: c.keywords || '' }); setEditingId(c.id); setShowForm(true); setError(''); };
  const handleDelete = async (id: number, name: string) => { if (!confirm(`确定删除「${name}」？`)) return; try { await categoriesApi.delete(id); load(); } catch (er: unknown) { setError(er instanceof Error ? er.message : '删除失败'); } };

  const RANDOM_COLORS = ['#f59e0b','#d97706','#10b981','#6366f1','#ec4899','#14b8a6','#f04444','#8b5cf6','#f97316'];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 stagger-children">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-espresso-800 font-display">分类管理</h1>
          <p className="text-sm text-espresso-400 mt-0.5">{cats.length} 个分类</p>
        </div>
        <button onClick={() => { reset(); setShowForm(true); }} className="btn-primary">+ 新建分类</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-5 space-y-3 animate-scale-in">
          <h3 className="font-semibold text-espresso-700 text-sm">{editingId != null ? '编辑分类' : '新建分类'}</h3>
          {error && <div className="bg-coral-50 text-coral-600 text-sm px-3 py-2 rounded-xl border border-coral-100">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-espresso-500 mb-1">名称 *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="如：餐饮" /></div>
            <div><label className="block text-xs font-medium text-espresso-500 mb-1">图标</label><input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className="input-field" placeholder="如：🍔" /></div>
            <div><label className="block text-xs font-medium text-espresso-500 mb-1">颜色</label><input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="input-field" placeholder="#FF6B6B" /></div>
            <div><label className="block text-xs font-medium text-espresso-500 mb-1">关键词 (逗号分隔)</label><input value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} className="input-field" placeholder="麦当劳,外卖,快餐" /></div>
          </div>
          <div className="flex gap-2"><button type="submit" className="btn-primary !bg-emerald-500 !from-emerald-500 !to-emerald-600">{editingId != null ? '保存' : '创建'}</button><button type="button" onClick={reset} className="btn-secondary">取消</button></div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
      ) : cats.length === 0 ? (
        <div className="glass-card text-center py-16">
          <span className="text-4xl mb-3 block">🏷️</span>
          <p className="text-espresso-400 font-medium">暂无分类</p>
          <p className="text-espresso-300 text-sm mt-1">点击上方按钮创建</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cats.map((c, i) => (
            <div key={c.id} className="glass-card p-5 group hover:shadow-card-hover transition-all duration-300 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-sm" style={{ backgroundColor: (c.color || RANDOM_COLORS[i % RANDOM_COLORS.length]) + '18', color: c.color || RANDOM_COLORS[i % RANDOM_COLORS.length] }}>{c.icon || '📁'}</div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(c)} className="p-1.5 text-espresso-400 hover:text-gold-600 hover:bg-gold-50 rounded-lg transition-colors" title="编辑">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => handleDelete(c.id, c.name)} className="p-1.5 text-espresso-400 hover:text-coral-500 hover:bg-coral-50 rounded-lg transition-colors" title="删除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
              <p className="font-semibold text-espresso-800">{c.name}</p>
              <p className="text-xs text-espresso-400 mt-1.5 line-clamp-2">{c.keywords ? c.keywords.split(',').slice(0, 4).join(' · ') : '暂无关键词'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
