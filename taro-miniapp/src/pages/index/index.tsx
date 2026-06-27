import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAuth } from '../../shared/hooks/useAuth'
import { useDidShow } from '@tarojs/taro'
import { getMonthlySummary, getBills } from '../../shared/api/client'
import './index.css'

const HomePage: React.FC = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    transactionCount: 0
  })
  const [refreshing, setRefreshing] = useState(false)
  const [recentBills, setRecentBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // 未登录时显示空数据，用户可手动点击登录
  const isLoggedIn = !!Taro.getStorageSync('token')

  const loadData = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false)
      return
    }
    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1

      // 并行加载统计数据和最近账单
      const [summary, bills] = await Promise.all([
        getMonthlySummary(year, month),
        getBills({ limit: 10, order: 'desc' })
      ])

      setStats({
        totalIncome: summary.income,
        totalExpense: summary.expense,
        balance: summary.net,
        transactionCount: summary.transaction_count
      })
      setRecentBills(bills)
    } catch (error: any) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 页面重新显示时刷新数据（如从登录页返回）
  useDidShow(() => {
    const token = Taro.getStorageSync('token')
    if (token) {
      setLoading(true)
      loadData()
    }
  })

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    Taro.showToast({ title: '刷新成功', icon: 'success', duration: 1000 })
  }, [loadData])

  const handleQuickAdd = useCallback(() => {
    Taro.navigateTo({ url: '/pages/bills/add' })
  }, [])

  const handleViewBill = useCallback((id: number) => {
    Taro.navigateTo({ url: `/pages/bills/detail?id=${id}` })
  }, [])

  const userName = user?.nickname || '用户'
  const now = new Date()
  const dateStr = now.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })

  if (loading) {
    return (
      <View className='home-container'>
        {/* 骨架屏 */}
        <View className='skeleton-card' style={{ height: '180rpx', marginBottom: '24rpx' }} />
        <View style={{ display: 'flex', gap: '16rpx', marginBottom: '24rpx' }}>
          <View className='skeleton-card' style={{ flex: 1, height: '160rpx' }} />
          <View className='skeleton-card' style={{ flex: 1, height: '160rpx' }} />
          <View className='skeleton-card' style={{ flex: 1, height: '160rpx' }} />
        </View>
        <View className='skeleton-card' style={{ height: '400rpx' }} />
      </View>
    )
  }

  return (
    <ScrollView
      className='home-container'
      scrollY
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={handleRefresh}
    >
      {/* 用户卡片 */}
      <View className='user-card'>
        <View className='user-avatar'>
          <Text className='user-avatar-text'>💰</Text>
        </View>
        <View className='user-info'>
          <Text className='greeting'>你好，{userName} 👋</Text>
          <Text className='date'>{dateStr}</Text>
        </View>
      </View>

      {/* 统计卡片网格 */}
      <View className='stats-grid'>
        <View className='stat-card-mini income'>
          <View className='stat-icon stat-icon-income'>
            <Text>↓</Text>
          </View>
          <Text className='stat-label'>本月收入</Text>
          <Text className='stat-value-mini income'>
            ¥{stats.totalIncome.toFixed(0)}
          </Text>
        </View>
        <View className='stat-card-mini expense'>
          <View className='stat-icon stat-icon-expense'>
            <Text>↑</Text>
          </View>
          <Text className='stat-label'>本月支出</Text>
          <Text className='stat-value-mini expense'>
            ¥{stats.totalExpense.toFixed(0)}
          </Text>
        </View>
        <View className='stat-card-mini balance'>
          <View className='stat-icon stat-icon-balance'>
            <Text>≡</Text>
          </View>
          <Text className='stat-label'>结余</Text>
          <Text className={`stat-value-mini ${stats.balance >= 0 ? 'balance' : 'expense'}`}>
            ¥{stats.balance.toFixed(0)}
          </Text>
        </View>
      </View>

      {/* 快速记账按钮 */}
      <View className='quick-add-btn' onClick={handleQuickAdd}>
        <Text className='quick-add-icon'>+</Text>
        <Text className='quick-add-text'>记一笔</Text>
      </View>

      {/* 最近账单 */}
      <View className='recent-bills'>
        <View className='section-header'>
          <Text className='section-title'>最近账单</Text>
          <Text
            className='view-all'
            onClick={() => Taro.switchTab({ url: '/pages/bills/list' })}
          >
            查看全部 →
          </Text>
        </View>

        {recentBills.length > 0 ? (
          <View className='bill-list'>
            {recentBills.map((bill) => (
              <View
                key={bill.id}
                className='bill-item'
                onClick={() => handleViewBill(bill.id)}
              >
                <View className='bill-left'>
                  <View className='bill-icon'>
                    <Text>📦</Text>
                  </View>
                  <View className='bill-info'>
                    <Text className='bill-category'>
                      {bill.category || '未分类'}
                    </Text>
                    {bill.note && (
                      <Text className='bill-note'>{bill.note}</Text>
                    )}
                  </View>
                </View>
                <View className='bill-right'>
                  <Text className={`bill-amount ${bill.direction === '收入' ? 'in' : 'out'}`}>
                    {bill.direction === '收入' ? '+' : '-'}
                    ¥{bill.amount.toFixed(2)}
                  </Text>
                  <Text className='bill-time'>
                    {bill.created_at ? bill.created_at.slice(5, 16) : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className='empty-state'>
            <Text className='empty-icon'>📋</Text>
            <Text className='empty-text'>
              {isLoggedIn ? '暂无账单记录' : '请先登录'}
            </Text>
            <Text className='empty-hint'>
              {isLoggedIn ? '点击上方"记一笔"开始记账' : '登录后自动同步您的账单数据'}
            </Text>
            {!isLoggedIn && (
              <Button
                className='empty-login-btn'
                onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}
              >
                立即登录
              </Button>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  )
}

export default HomePage
