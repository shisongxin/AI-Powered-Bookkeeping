import React, { useState, useCallback, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getCategories } from '../api/client'
import './CategoryPicker.css'

interface Category {
  id: number
  name: string
  icon: string
  color?: string
  keywords?: string
}

interface CategoryPickerProps {
  value?: string
  onChange?: (category: Category) => void
  categories?: Category[]
  type?: 'all' | 'income' | 'expense'
  fetchFromApi?: boolean
}

/**
 * 分类选择组件
 * 支持图标 + 名称选择，可选从 API 获取分类列表
 */
const CategoryPicker: React.FC<CategoryPickerProps> = ({
  value,
  onChange,
  categories: propCategories,
  type = 'all',
  fetchFromApi = false
}) => {
  const [apiCategories, setApiCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)

  // 从 API 获取分类列表
  useEffect(() => {
    if (!fetchFromApi) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await getCategories()
        if (!cancelled) {
          // 为没有 icon 的分类添加默认 emoji
          const mapped = data.map((c: any) => ({
            id: c.id,
            name: c.name,
            icon: c.icon || '📁',
            color: c.color || '#f59e0b',
            keywords: c.keywords || ''
          }))
          setApiCategories(mapped)
        }
      } catch (e) {
        console.error('加载分类失败:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [fetchFromApi])

  const categories = fetchFromApi ? apiCategories : (propCategories || [])

  const filteredCategories = categories.filter((cat: Category) => {
    if (type === 'all') return true
    // 根据分类名称简单判断类型（收入/支出）
    const incomeNames = ['工资', '转账', '理财', '红包', '报销', '退款', '收入']
    const isIncome = incomeNames.some(name => cat.name.includes(name))
    if (type === 'income') return isIncome
    return !isIncome
  })

  const handleSelect = useCallback((category: Category) => {
    if (onChange) {
      onChange(category)
    }
  }, [onChange])

  if (loading) {
    return (
      <View className='category-picker-container'>
        <View className='category-loading'>加载中...</View>
      </View>
    )
  }

  if (filteredCategories.length === 0) {
    return (
      <View className='category-picker-container'>
        <View className='category-empty'>暂无分类</View>
      </View>
    )
  }

  return (
    <View className='category-picker-container'>
      <View className='category-picker-grid'>
        {filteredCategories.map((category: Category) => {
          const itemClass = 'category-item' +
            (value === category.name ? ' selected' : '')
          return (
            <View
              key={category.id}
              className={itemClass}
              onClick={() => handleSelect(category)}
            >
              <View
                className='category-icon-wrapper'
                style={{ backgroundColor: (category.color || '#f59e0b') + '18' }}
              >
                <Text className='category-icon'>{category.icon}</Text>
              </View>
              <Text className='category-name'>{category.name}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

export { CategoryPicker }
export default CategoryPicker
