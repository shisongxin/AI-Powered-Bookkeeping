import React, { useState, useCallback, useEffect } from 'react'
import { View, Text, Textarea, Button, Input, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import AmountInput from '../../shared/components/AmountInput'
import { validateAmount, validateDate } from '../../shared/utils/validation'
import { createBill, getBillById, updateBill, getCategories } from '../../shared/api/client'
import { useDataStore } from '../../shared/stores/useDataStore'
import './add.css'

// 默认分类（API 不可用时降级使用）
const DEFAULT_EXPENSE_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: '餐饮', icon: '🍜' }, { name: '交通', icon: '🚗' }, { name: '购物', icon: '🛒' },
  { name: '娱乐', icon: '🎮' }, { name: '居住', icon: '🏠' }, { name: '医疗', icon: '💊' },
  { name: '教育', icon: '📚' }, { name: '超市', icon: '🛒' }, { name: '日用', icon: '🧴' },
  { name: '水果', icon: '🍎' }, { name: '零食', icon: '🍬' }, { name: '运动', icon: '⚽' },
  { name: '通讯', icon: '📱' }, { name: '服饰', icon: '👗' }, { name: '彩妆', icon: '💄' },
  { name: '住房', icon: '🏠' }, { name: '居家', icon: '🛋️' }, { name: '孩子', icon: '👶' },
  { name: '长辈', icon: '👴' }, { name: '社交', icon: '👥' }, { name: '旅行', icon: '✈️' },
  { name: '烟酒', icon: '🚬' }, { name: '数码', icon: '💻' }, { name: '汽车', icon: '🚗' },
  { name: '书籍', icon: '📚' }, { name: '学习', icon: '📖' }, { name: '宠物', icon: '🐱' },
  { name: '礼金', icon: '🧧' }, { name: '礼物', icon: '🎁' }, { name: '办公', icon: '💼' },
  { name: '维修', icon: '🔧' }, { name: '捐赠', icon: '🎁' }, { name: '彩票', icon: '🎰' },
  { name: '其他', icon: '📦' }
]

const DEFAULT_INCOME_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: '工资', icon: '💰' }, { name: '转账', icon: '🔄' }, { name: '理财', icon: '📈' },
  { name: '红包', icon: '🧧' }, { name: '报销', icon: '💼' }, { name: '退款', icon: '↩️' },
  { name: '其他', icon: '📦' }
]

const AddBillPage: React.FC = () => {
  const bumpBillsVersion = useDataStore((s) => s.bumpBillsVersion)
  const router = useRouter()
  const billId = router.params.id ? Number(router.params.id) : null
  const mode = router.params.mode || 'create' // 'create' or 'edit'

  const [amount, setAmount] = useState(0)
  const [category, setCategory] = useState('')
  const [payee, setPayee] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [direction, setDirection] = useState('out')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [apiCategories, setApiCategories] = useState<Array<{ name: string; icon: string }>>([])

  // 从 API 获取分类列表
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await getCategories()
        if (cancelled) return
        // 为分类添加 emoji 图标（API 返回的 icon 可能为空）
        const mapped = data.map((c: any) => ({
          name: c.name,
          icon: c.icon || DEFAULT_EXPENSE_CATEGORIES.find(d => d.name === c.name)?.icon || '📁'
        }))
        setApiCategories(mapped)
      } catch (e) {
        console.error('加载分类失败:', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // 优先使用 API 分类，降级到默认分类
  const expenseCats: Array<{ name: string; icon: string }> = apiCategories.length > 0
    ? apiCategories
    : DEFAULT_EXPENSE_CATEGORIES
  const incomeCats: Array<{ name: string; icon: string }> = apiCategories.length > 0
    ? apiCategories.filter((c: { name: string }) => ['工资', '转账', '理财', '红包', '报销', '退款', '收入'].some(n => c.name.includes(n)))
    : DEFAULT_INCOME_CATEGORIES
  const categories = direction === 'in' ? incomeCats : expenseCats

  // 如果是编辑模式，加载账单数据
  useEffect(() => {
    if (mode === 'edit' && billId) {
      setIsLoading(true)
      getBillById(billId)
        .then(bill => {
          setAmount(bill.amount)
          setDirection(bill.direction === '收入' ? 'in' : 'out')
          setDate(bill.transaction_date ? bill.transaction_date.slice(0, 10) : new Date().toISOString().split('T')[0])
          setDescription(bill.description || bill.note || '')
          setPayee(bill.payee || '')
          setCategory(bill.category || '')
        })
        .catch(err => {
          Taro.showToast({
            title: err?.message || '加载账单失败',
            icon: 'none',
            duration: 2000
          })
        })
        .finally(() => setIsLoading(false))
    }
  }, [mode, billId])

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {}
    const amountResult = validateAmount(amount)
    if (!amountResult.valid) {
      newErrors.amount = amountResult.message
    }
    if (!category) {
      newErrors.category = '请选择分类'
    }
    const dateResult = validateDate(date)
    if (!dateResult.valid) {
      newErrors.date = dateResult.message
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [amount, category, date])

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return
    setIsSubmitting(true)
    try {
      const billData = {
        amount,
        category: category || '未分类',
        payee: payee || undefined,
        description: description || undefined,
        transaction_date: new Date(date).toISOString(),
        direction: direction === 'in' ? '收入' : '支出'
      }

      if (mode === 'edit' && billId) {
        await updateBill(billId, billData)
        bumpBillsVersion()
        Taro.showToast({ title: '修改成功', icon: 'success', duration: 1500 })
      } else {
        await createBill(billData)
        bumpBillsVersion()
        Taro.showToast({ title: '添加成功', icon: 'success', duration: 1500 })
      }

      Taro.navigateBack()
    } catch (e: any) {
      Taro.showToast({
        title: e.message || (mode === 'edit' ? '修改失败，请重试' : '添加失败，请重试'),
        icon: 'none',
        duration: 2000
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [amount, category, payee, date, description, direction, mode, billId, validateForm])

  const handleBack = useCallback(() => {
    Taro.navigateBack()
  }, [])

  if (isLoading) {
    return (
      <View className='add-bill-container'>
        <View className='nav-header'>
          <View className='nav-back' onClick={handleBack}>
            <Text className='back-icon'>←</Text>
          </View>
          <Text className='nav-title'>编辑账单</Text>
          <View className='nav-placeholder' />
        </View>
        <View style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='add-bill-container'>
      {/* 导航栏 */}
      <View className='nav-header'>
        <View className='nav-back' onClick={handleBack}>
          <Text className='back-icon'>←</Text>
        </View>
        <Text className='nav-title'>{mode === 'edit' ? '编辑账单' : '记一笔'}</Text>
        <View className='nav-placeholder' />
      </View>

      {/* 收支类型切换 */}
      <View className='direction-tabs'>
        <View
          className={`tab ${direction === 'out' ? 'active expense' : ''}`}
          onClick={() => setDirection('out')}
        >
          <Text className='tab-text'>支出</Text>
        </View>
        <View
          className={`tab ${direction === 'in' ? 'active income' : ''}`}
          onClick={() => setDirection('in')}
        >
          <Text className='tab-text'>收入</Text>
        </View>
      </View>

      {/* 表单区域 - 仿 Web 端玻璃卡片 */}
      <View className='form-card'>
        {/* 金额 */}
        <View className='form-section'>
          <Text className='section-label'>金额</Text>
          <AmountInput
            value={amount}
            onChange={setAmount}
            placeholder='请输入金额'
          />
          {errors.amount && <Text className='error-text'>{errors.amount}</Text>}
        </View>

        {/* 分类选择 — 仿 Web 端 emoji 网格 */}
        <View className='form-section'>
          <Text className='section-label'>分类</Text>
          <View className='category-grid'>
            {categories.map((cat: { name: string; icon: string }) => (
              <View
                key={cat.name}
                className={`category-grid-item ${category === cat.name ? 'active' : ''}`}
                onClick={() => setCategory(cat.name)}
              >
                <Text className='category-grid-icon'>{cat.icon}</Text>
                <Text className='category-grid-name'>{cat.name}</Text>
              </View>
            ))}
          </View>
          {errors.category && <Text className='error-text'>{errors.category}</Text>}
        </View>

        {/* 商户 */}
        <View className='form-section'>
          <Text className='section-label'>商户</Text>
          <Input
            className='text-input'
            type='text'
            value={payee}
            onInput={(e) => setPayee(e.detail.value)}
            placeholder='商户名（可选）'
            maxlength={50}
          />
        </View>

        {/* 日期 — 下拉选择器 */}
        <View className='form-section'>
          <Text className='section-label'>日期</Text>
          <Picker
            mode='date'
            value={date}
            onChange={(e) => setDate(e.detail.value)}
          >
            <View className='picker-trigger'>
              <Text className={date ? 'picker-value' : 'picker-placeholder'}>
                {date || '选择日期'}
              </Text>
              <Text className='picker-arrow'>▼</Text>
            </View>
          </Picker>
          {errors.date && <Text className='error-text'>{errors.date}</Text>}
        </View>

        {/* 描述 */}
        <View className='form-section'>
          <Text className='section-label'>描述</Text>
          <Textarea
            className='note-textarea'
            value={description}
            onInput={(e) => setDescription(e.detail.value)}
            placeholder='描述（可选）'
            maxlength={200}
          />
        </View>
      </View>

      {/* 提交按钮 */}
      <View className='submit-section'>
        <Button
          className='submit-btn'
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? '保存中...'
            : mode === 'edit'
              ? '修改'
              : '保存'}
        </Button>
        <Button
          className='cancel-btn'
          onClick={handleBack}
        >
          取消
        </Button>
      </View>
    </View>
  )
}

export default AddBillPage
