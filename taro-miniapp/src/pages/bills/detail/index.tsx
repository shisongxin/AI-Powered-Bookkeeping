import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { getBillById, deleteBill } from '../../../shared/api/client'
import './detail.css'

/**
 * 账单详情页
 * 查看单笔账单的详细信息
 */
const BillDetailPage: React.FC = () => {
  const router = useRouter()
  const billId = Number(router.params.id)

  const [bill, setBill] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 加载账单详情
  const loadBill = useCallback(async () => {
    if (!billId || isNaN(billId)) {
      setError('无效的账单ID')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const data = await getBillById(billId)
      setBill(data)
    } catch (err: any) {
      setError(err?.message || '获取账单详情失败')
    } finally {
      setLoading(false)
    }
  }, [billId])

  useEffect(() => {
    loadBill()
  }, [loadBill])

  // 编辑账单
  const handleEdit = useCallback(() => {
    Taro.navigateTo({
      url: `/pages/bills/add?id=${billId}&mode=edit`
    })
  }, [billId])

  // 删除账单
  const handleDelete = useCallback(() => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这条账单吗？删除后不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            await deleteBill(billId)
            Taro.showToast({ title: '删除成功', icon: 'success', duration: 1500 })
            setTimeout(() => {
              Taro.navigateBack()
            }, 1500)
          } catch (err: any) {
            Taro.showToast({
              title: err?.message || '删除失败',
              icon: 'none',
              duration: 2000
            })
          }
        }
      }
    })
  }, [billId])

  // 返回
  const handleBack = useCallback(() => {
    Taro.navigateBack()
  }, [])

  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return dateStr.slice(0, 10)
  }

  // 格式化时间
  const formatTime = (dateStr: string) => {
    if (!dateStr) return '-'
    return dateStr.slice(11, 16)
  }

  // 加载状态
  if (loading) {
    return (
      <View className='detail-container'>
        <View className='nav-header'>
          <View className='nav-back' onClick={handleBack}>
            <Text className='back-icon'>←</Text>
          </View>
          <Text className='nav-title'>账单详情</Text>
          <View className='nav-placeholder' />
        </View>
        <View className='loading-container'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      </View>
    )
  }

  // 错误状态
  if (error) {
    return (
      <View className='detail-container'>
        <View className='nav-header'>
          <View className='nav-back' onClick={handleBack}>
            <Text className='back-icon'>←</Text>
          </View>
          <Text className='nav-title'>账单详情</Text>
          <View className='nav-placeholder' />
        </View>
        <View className='error-container'>
          <Text className='error-text'>{error}</Text>
          <Button className='retry-btn' onClick={loadBill}>
            重新加载
          </Button>
        </View>
      </View>
    )
  }

  // 空状态
  if (!bill) {
    return (
      <View className='detail-container'>
        <View className='nav-header'>
          <View className='nav-back' onClick={handleBack}>
            <Text className='back-icon'>←</Text>
          </View>
          <Text className='nav-title'>账单详情</Text>
          <View className='nav-placeholder' />
        </View>
        <View className='empty-container'>
          <Text className='empty-icon'>📋</Text>
          <Text className='empty-text'>账单不存在</Text>
        </View>
      </View>
    )
  }

  const isIncome = bill.direction === '收入'

  return (
    <View className='detail-container'>
      {/* 导航栏 */}
      <View className='nav-header'>
        <View className='nav-back' onClick={handleBack}>
          <Text className='back-icon'>←</Text>
        </View>
        <Text className='nav-title'>账单详情</Text>
        <View className='nav-placeholder' />
      </View>

      {/* 金额区域 */}
      <View className='amount-section'>
        <Text className='amount-label'>{isIncome ? '收入' : '支出'}金额</Text>
        <Text className={`amount-value ${isIncome ? 'income' : 'expense'}`}>
          {isIncome ? '+' : '-'}¥{bill.amount.toFixed(2)}
        </Text>
      </View>

      {/* 详细信息 */}
      <View className='info-section'>
        <View className='info-item'>
          <Text className='info-label'>分类</Text>
          <Text className='info-value'>{bill.category || '未分类'}</Text>
        </View>
        <View className='info-item'>
          <Text className='info-label'>日期</Text>
          <Text className='info-value'>{formatDate(bill.transaction_date || bill.created_at)}</Text>
        </View>
        <View className='info-item'>
          <Text className='info-label'>时间</Text>
          <Text className='info-value'>{formatTime(bill.transaction_date || bill.created_at)}</Text>
        </View>
        {bill.payee && (
          <View className='info-item'>
            <Text className='info-label'>交易对方</Text>
            <Text className='info-value'>{bill.payee}</Text>
          </View>
        )}
        {bill.note && (
          <View className='info-item'>
            <Text className='info-label'>备注</Text>
            <Text className='info-value'>{bill.note}</Text>
          </View>
        )}
        {bill.description && (
          <View className='info-item'>
            <Text className='info-label'>描述</Text>
            <Text className='info-value'>{bill.description}</Text>
          </View>
        )}
        {bill.payment_method && (
          <View className='info-item'>
            <Text className='info-label'>支付方式</Text>
            <Text className='info-value'>{bill.payment_method}</Text>
          </View>
        )}
        {bill.remark && (
          <View className='info-item'>
            <Text className='info-label'>备注</Text>
            <Text className='info-value'>{bill.remark}</Text>
          </View>
        )}
        <View className='info-item'>
          <Text className='info-label'>创建时间</Text>
          <Text className='info-value'>{bill.created_at ? new Date(bill.created_at).toLocaleString('zh-CN') : '-'}</Text>
        </View>
      </View>

      {/* 操作按钮 */}
      <View className='action-section'>
        <View className='action-buttons'>
          <Button className='action-btn edit' onClick={handleEdit}>
            编辑
          </Button>
          <Button className='action-btn delete' onClick={handleDelete}>
            删除
          </Button>
        </View>
      </View>
    </View>
  )
}

export default BillDetailPage
