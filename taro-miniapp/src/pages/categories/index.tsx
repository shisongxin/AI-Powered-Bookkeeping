import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Input, Button, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../../shared/api/client'
import './index.css'

/** 预设图标列表 — 30 个 emoji 预设 */
const PRESET_ICONS = [
  '🍔', '🚗', '🛒', '🏠', '💡', '🍜', '🎮', '💊', '📚', '💰',
  '🔄', '👗', '🧴', '🍎', '🍬', '⚽', '📱', '💄', '🛋️', '👶',
  '👴', '👥', '✈️', '🚬', '💻', '📖', '🐱', '🧧', '🎁', '💼',
  '🔧', '🎰'
]

/** 预设颜色 — 10 个常用色 */
const PRESET_COLORS = [
  '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#78716c'
]

interface Category {
  id: number
  name: string
  icon?: string | null
  color?: string | null
  keywords?: string | null
}

const CategoriesPage: React.FC = () => {
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', icon: '', color: '', keywords: '' })
  const [showIconPicker, setShowIconPicker] = useState(false)

  // 加载分类列表
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCategories()
      setCats(data)
    } catch (err: any) {
      setError(err?.message || '加载分类失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useDidShow(() => {
    load()
  })

  // 重置表单
  const reset = useCallback(() => {
    setForm({ name: '', icon: '', color: '', keywords: '' })
    setEditingId(null)
    setShowForm(false)
    setError('')
    setShowIconPicker(false)
  }, [])

  // 提交表单
  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      setError('请输入分类名称')
      return
    }
    setError('')
    try {
      if (editingId != null) {
        await updateCategory(editingId, {
          name: form.name.trim(),
          icon: form.icon || undefined,
          color: form.color || undefined,
          keywords: form.keywords || undefined
        })
      } else {
        await createCategory({
          name: form.name.trim(),
          icon: form.icon || undefined,
          color: form.color || undefined,
          keywords: form.keywords || undefined
        })
      }
      reset()
      load()
      Taro.showToast({
        title: editingId != null ? '保存成功' : '创建成功',
        icon: 'success',
        duration: 1500
      })
    } catch (err: any) {
      setError(err?.message || '操作失败')
    }
  }, [form, editingId, load, reset])

  // 编辑
  const handleEdit = useCallback((c: Category) => {
    setForm({
      name: c.name,
      icon: c.icon || '',
      color: c.color || '',
      keywords: c.keywords || ''
    })
    setEditingId(c.id)
    setShowForm(true)
    setError('')
    setShowIconPicker(false)
  }, [])

  // 删除
  const handleDelete = useCallback((id: number, name: string) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定删除「${name}」？`,
      confirmColor: '#f59e0b',
      success: (res) => {
        if (res.confirm) {
          deleteCategory(id)
            .then(() => {
              load()
              Taro.showToast({ title: '删除成功', icon: 'success', duration: 1500 })
            })
            .catch((err: any) => {
              Taro.showToast({ title: err?.message || '删除失败', icon: 'none', duration: 2000 })
            })
        }
      }
    })
  }, [load])


  // 颜色选择器 change handler
  const handleColorChange = useCallback((e: any) => {
    setForm(prev => ({ ...prev, color: e.detail.value }))
  }, [])

  return (
    <View className='categories-container page-enter'>
      {/* ===== 顶部导航栏 ===== */}
      <View className='nav-header'>
        <View className='nav-back' onClick={() => Taro.navigateBack()}>
          <Text className='back-icon'>‹</Text>
        </View>
        <Text className='nav-title'>分类管理</Text>
        <View className='nav-placeholder' />
      </View>

      {/* ===== 头部区域 ===== */}
      <View className='header-section'>
        <View className='header-info'>
          <Text className='header-title'>分类管理</Text>
          <Text className='header-subtitle'>{cats.length} 个分类</Text>
        </View>
        <Button
          className='add-btn'
          onClick={() => {
            reset()
            setShowForm(true)
          }}
        >
          <Text className='add-btn-text'>+ 新建分类</Text>
        </Button>
      </View>

      <ScrollView
        className='categories-scroll'
        scrollY
        enableFlex
      >
        <View style={{ padding: '20rpx 24rpx' }}>
        {/* ===== 表单卡片 ===== */}
        {showForm && (
          <View className='form-card animate-scale-in'>
            <Text className='form-title'>{editingId != null ? '编辑分类' : '新建分类'}</Text>

            {error && (
              <View className='form-error'>
                <Text className='form-error-text'>{error}</Text>
              </View>
            )}

            <View className='form-grid'>
              {/* 名称 */}
              <View className='form-field'>
                <Text className='field-label'>名称 *</Text>
                <Input
                  className='field-input'
                  type='text'
                  value={form.name}
                  onInput={(e) => setForm(prev => ({ ...prev, name: e.detail.value }))}
                  placeholder='如：餐饮'
                />
              </View>

              {/* 图标 */}
              <View className='form-field'>
                <Text className='field-label'>图标</Text>
                <View className='icon-picker-row'>
                  <View className='icon-picker-wrapper'>
                    <View
                      className='icon-picker-trigger'
                      onClick={() => setShowIconPicker(!showIconPicker)}
                    >
                      <Text className='icon-trigger-emoji'>{form.icon || '📁'}</Text>
                      <Text className='icon-trigger-hint'>{form.icon || '选择图标'}</Text>
                      <Text className='icon-trigger-arrow'>{showIconPicker ? '▲' : '▼'}</Text>
                    </View>
                    {showIconPicker && (
                      <View className='icon-picker-dropdown animate-scale-in'>
                        {PRESET_ICONS.map(icon => (
                          <View
                            key={icon}
                            className={`icon-option ${form.icon === icon ? 'selected' : ''}`}
                            onClick={() => {
                              setForm(prev => ({ ...prev, icon }))
                              setShowIconPicker(false)
                            }}
                          >
                            <Text className='icon-option-text'>{icon}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <Input
                    className='icon-custom-input'
                    type='text'
                    value={form.icon}
                    onInput={(e) => setForm(prev => ({ ...prev, icon: e.detail.value }))}
                    placeholder='自定义'
                  />
                </View>
              </View>

              {/* 颜色 */}
              <View className='form-field'>
                <Text className='field-label'>颜色</Text>
                <View className='color-picker-row'>
                  <View className='color-native-wrapper'>
                    <Picker
                      mode='selector'
                      range={PRESET_COLORS}
                      rangeKey=''
                      onChange={handleColorChange}
                    >
                      <View className='color-native-trigger'>
                        <View
                          className='color-native-swatch'
                          style={{ backgroundColor: form.color || '#f59e0b' }}
                        />
                        <Text className='color-native-hint'>{form.color || '选择'}</Text>
                      </View>
                    </Picker>
                  </View>
                  <View className='color-swatches'>
                    {PRESET_COLORS.map(c => (
                      <View
                        key={c}
                        className={`color-swatch ${form.color === c ? 'selected' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setForm(prev => ({ ...prev, color: c }))}
                      />
                    ))}
                  </View>
                </View>
              </View>

              {/* 关键词 */}
              <View className='form-field'>
                <Text className='field-label'>关键词 (逗号分隔)</Text>
                <Input
                  className='field-input'
                  type='text'
                  value={form.keywords}
                  onInput={(e) => setForm(prev => ({ ...prev, keywords: e.detail.value }))}
                  placeholder='麦当劳,外卖,快餐'
                />
              </View>
            </View>

            {/* 表单操作按钮 */}
            <View className='form-actions'>
              <Button className='form-btn-primary' onClick={handleSubmit}>
                <Text className='form-btn-primary-text'>{editingId != null ? '保存' : '创建'}</Text>
              </Button>
              <Button className='form-btn-secondary' onClick={reset}>
                <Text className='form-btn-secondary-text'>取消</Text>
              </Button>
            </View>
          </View>
        )}

        {/* ===== 加载状态 ===== */}
        {loading && (
          <View className='skeleton-grid'>
            {[...Array(6)].map((_, i) => (
              <View key={i} className='skeleton-card' />
            ))}
          </View>
        )}

        {/* ===== 空状态 ===== */}
        {!loading && cats.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-icon'>🏷️</Text>
            <Text className='empty-text'>暂无分类</Text>
            <Text className='empty-hint'>点击上方按钮创建</Text>
          </View>
        )}

        {/* ===== 分类卡片网格 ===== */}
        {!loading && cats.length > 0 && (
          <View className='cards-grid stagger-children'>
            {cats.map((c) => (
              <View
                key={c.id}
                className='cat-card glass-card animate-slide-up'
              >
                {/* 卡片头部：图标 + 操作按钮 */}
                <View className='cat-card-header'>
                  <View
                    className='cat-icon-box'
                    style={{
                      backgroundColor: (c.color || '#f59e0b') + '18',
                      borderColor: (c.color || '#f59e0b') + '30'
                    }}
                  >
                    <Text className='cat-icon-emoji'>{c.icon || '📁'}</Text>
                  </View>
                  <View className='cat-actions'>
                    <View
                      className='cat-action-btn edit'
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(c)
                      }}
                    >
                      <Text className='cat-action-text'>✏️</Text>
                    </View>
                    <View
                      className='cat-action-btn delete'
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(c.id, c.name)
                      }}
                    >
                      <Text className='cat-action-text'>🗑️</Text>
                    </View>
                  </View>
                </View>

                {/* 卡片内容 */}
                <Text className='cat-name'>{c.name}</Text>
                <Text className='cat-keywords' numberOfLines={2}>
                  {c.keywords
                    ? c.keywords.split(',').slice(0, 4).join(' · ')
                    : '暂无关键词'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 底部安全区域 */}
        <View style={{ height: 'calc(40rpx + env(safe-area-inset-bottom))' }} />
        </View>
      </ScrollView>
    </View>
  )
}

export default CategoriesPage
