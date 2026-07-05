import React, { useState, useCallback, useEffect } from 'react'
import { View, Text, Textarea, Button, Input, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { validateAmount, validateDate } from '../../shared/utils/validation'
import { createBill, getBillById, updateBill, getCategories } from '../../shared/api/client'
import { useDataStore } from '../../shared/stores/useDataStore'
import './add.css'

/** 默认分类（API 不可用时降级使用） */
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
  const mode = router.params.mode || 'create'

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

  const expenseCats = apiCategories.length > 0
    ? apiCategories
    : DEFAULT_EXPENSE_CATEGORIES
  const incomeCats = apiCategories.length > 0
    ? apiCategories.filter((c: { name: string }) =>
        ['工资', '转账', '理财', '红包', '报销', '退款', '收入'].some(n => c.name.includes(n)))
    : DEFAULT_INCOME_CATEGORIES
  const categories = direction === 'in' ? incomeCats : expenseCats

  // 加载账单（编辑模式）
  useEffect(() => {
    if (mode === 'edit' && billId) {
      setIsLoading(true)
      getBillById(billId)
        .then(bill => {
          const rawAmount = bill.amount != null && bill.amount !== ''
            ? (typeof bill.amount === 'string' ? parseFloat(bill.amount) : Number(bill.amount))
            : 0
          const loadedAmount = Math.abs(rawAmount)
          if (!isNaN(loadedAmount)) {
            setAmount(loadedAmount)
          }
          setDirection(bill.direction === '收入' ? 'in' : 'out')
          setDate(bill.transaction_date
            ? String(bill.transaction_date).slice(0, 10)
            : new Date().toISOString().split('T')[0])
          setDescription(bill.description || bill.note || '')
          setPayee(bill.payee || '')
          setCategory(bill.category || '')
        })
        .catch(err => {
          Taro.showToast({ title: err?.message || '加载账单失败', icon: 'none', duration: 2000 })
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [mode, billId])

  // 切换收支类型 — 不重置已选分类（后端允许任意分类 + 任意收支）
  const handleDirectionChange = useCallback((dir: string) => {
    setDirection(dir)
  }, [])

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
      // 支出时金额存为负数（与后端数据格式一致）
      const signedAmount = direction === 'in' ? Math.abs(amount) : -Math.abs(amount)
      const billData = {
        amount: signedAmount,
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

  /** 格式化金额用于 Input value（编辑模式回填） */
  const amountInputValue = amount > 0 ? String(amount) : ''

  // 编辑模式加载状态
  if (isLoading) {
    return (
      <View className='add-bill-container'>
        <View className='add-header'>
          <View className='header-title-row'>
            <View className='header-back' onClick={handleBack}>
              <Text className='back-icon'>‹</Text>
            </View>
            <Text className='header-title'>编辑账单</Text>
            <View style={{ width: '60rpx' }} />
          </View>
        </View>
        <View className='loading-container'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='add-bill-container'>
      {/* ===== 深色头部区域 ===== */}
      <View className='add-header'>
        <View className='header-title-row'>
          <View className='header-back' onClick={handleBack}>
            <Text className='back-icon'>‹</Text>
          </View>
          <Text className='header-title'>{mode === 'edit' ? '编辑账单' : '记一笔'}</Text>
          <View style={{ width: '60rpx' }} />
        </View>

        {/* 收支类型切换 */}
        <View className='direction-tabs'>
          <View
            className={`tab ${direction === 'out' ? 'active expense' : ''}`}
            onClick={() => handleDirectionChange('out')}
          >
            <Text className='tab-text'>支出</Text>
          </View>
          <View
            className={`tab ${direction === 'in' ? 'active income' : ''}`}
            onClick={() => handleDirectionChange('in')}
          >
            <Text className='tab-text'>收入</Text>
          </View>
        </View>
      </View>

      {/* ===== 白色表单卡片（浮动覆盖头部底部） ===== */}
      <View className='form-card'>
        {/* 分类选择 */}
        <View className='category-section'>
          <Text className='section-label'>
            <Text className='section-label-icon'>{category ? '✅' : '📂'}</Text>
            选择分类
          </Text>
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

        {/* 金额输入 */}
        <View className='form-row'>
          <Text className='form-row-icon'>💰</Text>
          <View className='form-row-content'>
            <Text className='form-row-label'>金额</Text>
            <Input
              className='form-input'
              type='text'
              value={amountInputValue}
              onInput={(e) => {
                const val = parseFloat(e.detail.value)
                setAmount(isNaN(val) ? 0 : val)
              }}
              placeholder='0.00'
              maxlength={10}
            />
          </View>
          <Text style={{ fontSize: '24rpx', color: '#a89580' }}>元</Text>
        </View>
        {errors.amount && <Text className='error-text'>{errors.amount}</Text>}

        {/* 商户 */}
        <View className='form-row'>
          <Text className='form-row-icon'>🏪</Text>
          <View className='form-row-content'>
            <Text className='form-row-label'>商户</Text>
            <Input
              className='form-input'
              type='text'
              value={payee}
              onInput={(e) => setPayee(e.detail.value)}
              placeholder='商家名称（选填）'
              maxlength={50}
            />
          </View>
        </View>

        {/* 日期 */}
        <View className='form-row'>
          <Text className='form-row-icon'>📅</Text>
          <Picker
            mode='date'
            value={date}
            onChange={(e) => setDate(e.detail.value)}
          >
            <View style={{ flex: 1 }}>
              <Text className='form-row-value'>{date}</Text>
            </View>
          </Picker>
          <Text className='form-row-arrow'>›</Text>
        </View>
        {errors.date && <Text className='error-text'>{errors.date}</Text>}

        {/* 备注 — 自动高度 */}
        <View className='form-row form-row-textarea'>
          <Text className='form-row-icon form-row-icon-top'>📝</Text>
          <View className='form-row-content'>
            <Text className='form-row-label'>备注</Text>
            <Textarea
              className='form-textarea'
              value={description}
              onInput={(e) => setDescription(e.detail.value)}
              placeholder='添加备注（选填）'
              maxlength={200}
              auto-height
            />
          </View>
        </View>
      </View>

      {/* ===== 提交按钮 ===== */}
      <View className='submit-section'>
        <Button
          className={`submit-btn ${direction === 'out' ? 'expense' : 'income'}`}
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? '保存中...'
            : mode === 'edit'
              ? '保存修改'
              : '完成记账'}
        </Button>
        <Button className='cancel-btn' onClick={handleBack}>
          取消
        </Button>
      </View>
    </View>
  )
}

export default AddBillPage
