import React, { useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import './CategoryPicker.css'

interface Category {
  id: number
  name: string
  icon: string
  type: 'income' | 'expense'
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: '餐饮', icon: '🍜', type: 'expense' },
  { id: 2, name: '交通', icon: '🚗', type: 'expense' },
  { id: 3, name: '购物', icon: '🛒', type: 'expense' },
  { id: 4, name: '娱乐', icon: '🎮', type: 'expense' },
  { id: 5, name: '居住', icon: '🏠', type: 'expense' },
  { id: 6, name: '医疗', icon: '💊', type: 'expense' },
  { id: 7, name: '教育', icon: '📚', type: 'expense' },
  { id: 8, name: '工资', icon: '💰', type: 'income' },
  { id: 9, name: '转账', icon: '🔄', type: 'expense' },
  { id: 10, name: '其他', icon: '📦', type: 'expense' }
]

interface CategoryPickerProps {
  value?: number
  onChange?: (category: Category) => void
  categories?: Category[]
  type?: 'all' | 'income' | 'expense'
}

/**
 * 分类选择组件
 * 支持图标 + 名称选择
 */
const CategoryPicker: React.FC<CategoryPickerProps> = ({
  value,
  onChange,
  categories = DEFAULT_CATEGORIES,
  type = 'all'
}) => {
  const [selectedId, setSelectedId] = useState(value)

  const filteredCategories = categories.filter((cat) => {
    if (type === 'all') return true
    return cat.type === type
  })

  const handleSelect = useCallback((category: Category) => {
    setSelectedId(category.id)
    if (onChange) {
      onChange(category)
    }
  }, [onChange])

  return (
    <View className='category-picker-container'>
      <View className='category-picker-grid'>
        {filteredCategories.map((category) => {
          const itemClass = 'category-item' +
            (selectedId === category.id ? ' selected' : '')
          return (
            <View
              key={category.id}
              className={itemClass}
              onClick={() => handleSelect(category)}
            >
              <View className='category-icon-wrapper'>
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

export { DEFAULT_CATEGORIES }
export default CategoryPicker
