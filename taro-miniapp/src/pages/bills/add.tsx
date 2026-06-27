import React, { useState, useCallback, useEffect } from 'react'
import { View, Text, Textarea, Button, Input, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import AmountInput from '../../shared/components/AmountInput'
import { validateAmount, validateDate } from '../../shared/utils/validation'
import { createBill, getBillById, updateBill } from '../../shared/api/client'
import './add.css'

// 分类列表（与 Web 端对齐）
const EXPENSE_CATEGORIES = [
  '餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育',
  '超市', '日用', '水果', '零食', '运动', '通讯', '服饰',
  '彩妆', '住房', '居家', '孩子', '长辈', '社交', '旅行',
  '烟酒', '数码', '汽车', '书籍', '学习', '宠物', '礼金',
  '礼物', '办公', '维修', '捐赠', '彩票', '其他'
]

const INCOME_CATEGORIES = [
  '工资', '转账', '理财', '红包', '报销', '退款', '其他'
]

const AddBillPage: React.FC = () => {
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

  const categories = direction === 'in' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

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
        Taro.showToast({ title: '修改成功', icon: 'success', duration: 1500 })
      } else {
        await createBill(billData)
        Taro.showToast({ title: '添加成功', icon: 'success', duration: 1500 })
      }

      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
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

        {/* 分类选择 */}
        <View className='form-section'>
          <Text className='section-label'>分类</Text>
          <Picker
            mode='selector'
            range={categories}
            value={categories.indexOf(category)}
            onChange={(e) => setCategory(categories[e.detail.value])}
          >
            <View className='category-picker'>
              <Text>{category || '选择分类'}</Text>
              <Text className='picker-arrow'>▼</Text>
            </View>
          </Picker>
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

        {/* 日期 */}
        <View className='form-section'>
          <Text className='section-label'>日期</Text>
          <Input
            className='text-input'
            type='text'
            value={date}
            onInput={(e) => setDate(e.detail.value)}
            placeholder='YYYY-MM-DD'
          />
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
