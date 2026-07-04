import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useAuth } from '../../shared/hooks/useAuth'
import { getMonthlySummary, getBills, getCategoryBreakdown } from '../../shared/api/client'
import { useDataStore } from '../../shared/stores/useDataStore'
import './index.css'

const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const billsVersion = useDataStore((s) => s.billsVersion)
  const lastVersionRef = useRef(billsVersion)
  const [summary, setSummary] = useState<{
    income: number
    expense: number
    net: number
    transaction_count: number
  } | null>(null)
  const [recentBills, setRecentBills] = useState<any[]>([])
  const [categoryBreakdown, setCategoryBreakdown] = useState<Array<{ category: string; amount: number; percentage: number }>>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // 计算分类支出占比
  const totalCategoryExpense = useMemo(
    () => categoryBreakdown.reduce((s, c) => s + c.amount, 0),
    [categoryBreakdown]
  )

  const loadData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const [summaryRes, billsRes, breakdownRes] = await Promise.all([
        getMonthlySummary(year, month),
        getBills({ limit: 10, order: 'transaction_date desc' }),
        getCategoryBreakdown(startDate, endDate, '支出').catch(() => [])
      ])
      setSummary(summaryRes)
      setRecentBills(billsRes || [])
      setCategoryBreakdown(breakdownRes || [])
    } catch (error: any) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, year, month])

  useEffect(() => {
    loadData()
  }, [loadData])

  useDidShow(() => {
    if (isAuthenticated) {
      // 版本变化时（账单增删改）强制刷新；首次进入也刷新
      if (billsVersion !== lastVersionRef.current) {
        lastVersionRef.current = billsVersion
        setLoading(true)
        loadData()
      }
    }
  })

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    Taro.showToast({ title: '刷新成功', icon: 'success', duration: 1000 })
  }, [loadData])

  const handleAIChat = useCallback(() => {
    Taro.switchTab({ url: '/pages/chat/index' })
  }, [])

  const handleViewAll = useCallback(() => {
    Taro.switchTab({ url: '/pages/bills/list' })
  }, [])

  const handleViewBill = useCallback((id: number) => {
    Taro.navigateTo({ url: `/pages/bills/detail/index?id=${id}` })
  }, [])

  const handleLogin = useCallback(() => {
    Taro.navigateTo({ url: '/pages/login/index' })
  }, [])

  // Skeleton loading state
  if (loading) {
    return (
      <View className='home-container'>
        {/* Header skeleton */}
        <View className='skeleton-card' style={{ height: '120rpx', marginBottom: '24rpx' }} />
        {/* Stat cards skeleton */}
        <View className='stats-grid'>
          <View className='skeleton-card' style={{ height: '180rpx' }} />
          <View className='skeleton-card' style={{ height: '180rpx' }} />
          <View className='skeleton-card' style={{ height: '180rpx' }} />
          <View className='skeleton-card' style={{ height: '180rpx' }} />
        </View>
        {/* Recent bills skeleton */}
        <View className='skeleton-card' style={{ height: '400rpx' }} />
      </View>
    )
  }

  // Not authenticated — show empty state with login
  if (!isAuthenticated) {
    return (
      <View className='home-container'>
        {/* Header */}
        <View className='dashboard-header'>
          <View className='header-left'>
            <Text className='header-title'>仪表盘</Text>
            <Text className='header-subtitle'>{month}月财务概览</Text>
          </View>
          <View className='header-right' />
        </View>

        {/* Empty state */}
        <View className='empty-state-full'>
          <Text className='empty-icon'>📋</Text>
          <Text className='empty-text'>请先登录</Text>
          <Text className='empty-hint'>登录后自动同步您的账单数据，查看本月财务概览</Text>
          <Button className='empty-login-btn' onClick={handleLogin}>
            立即登录
          </Button>
        </View>
      </View>
    )
  }

  const netGradient = summary && summary.net < 0 ? 'stat-card-expense' : 'stat-card-balance'

  return (
    <View className='home-container'>
    <ScrollView
      scrollY
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={handleRefresh}
      style={{ flex: 1 }}
    >
      {/* Header */}
      <View className='dashboard-header'>
        <View className='header-left'>
          <Text className='header-title'>仪表盘</Text>
          <Text className='header-subtitle'>{month}月财务概览</Text>
        </View>
        <View className='header-right' />
      </View>

      {/* Stat Cards */}
      {summary && (
        <View className='stats-grid stagger-children'>
          <View className='stat-card stat-card-income'>
            <View className='stat-card-header'>
              <Text className='stat-label'>收入</Text>
              <View className='stat-icon-wrapper stat-icon-income'>
                <Text className='stat-icon-text'>↑</Text>
              </View>
            </View>
            <Text className='stat-value'>{summary.income.toFixed(2)}</Text>
            <Text className='stat-unit'>元</Text>
          </View>

          <View className='stat-card stat-card-expense'>
            <View className='stat-card-header'>
              <Text className='stat-label'>支出</Text>
              <View className='stat-icon-wrapper stat-icon-expense'>
                <Text className='stat-icon-text'>↓</Text>
              </View>
            </View>
            <Text className='stat-value'>{Math.abs(summary.expense).toFixed(2)}</Text>
            <Text className='stat-unit'>元</Text>
          </View>

          <View className={`stat-card ${netGradient}`}>
            <View className='stat-card-header'>
              <Text className='stat-label'>结余</Text>
              <View className={`stat-icon-wrapper ${summary.net >= 0 ? 'stat-icon-balance' : 'stat-icon-expense'}`}>
                <Text className='stat-icon-text'>=</Text>
              </View>
            </View>
            <Text className='stat-value'>{summary.net.toFixed(2)}</Text>
            <Text className='stat-unit'>元</Text>
          </View>

          <View className='stat-card stat-card-total'>
            <View className='stat-card-header'>
              <Text className='stat-label'>交易笔数</Text>
              <View className='stat-icon-wrapper stat-icon-total'>
                <Text className='stat-icon-text'>#</Text>
              </View>
            </View>
            <Text className='stat-value'>{summary.transaction_count}</Text>
            <Text className='stat-unit'>笔</Text>
          </View>
        </View>
      )}

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <View className='card-glass category-card'>
          <View className='section-header'>
            <Text className='section-title'>{month}月支出分类</Text>
            <Text className='view-all' onClick={handleViewAll}>账单 →</Text>
          </View>
          <View className='category-list'>
            {categoryBreakdown.slice(0, 6).map((item) => {
              const pct = totalCategoryExpense > 0 ? (item.amount / totalCategoryExpense) * 100 : 0
              return (
                <View key={item.category} className='category-item'>
                  <View className='category-item-top'>
                    <Text className='category-name'>{item.category}</Text>
                    <Text className='category-amount'>¥{item.amount.toFixed(0)}</Text>
                  </View>
                  <View className='category-progress-track'>
                    <View
                      className='category-progress-fill'
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </View>
                  <Text className='category-pct'>{pct.toFixed(1)}%</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* Recent Bills */}
      <View className='card-glass bills-card'>
        <View className='section-header'>
          <Text className='section-title'>最近账单</Text>
          <Text className='view-all' onClick={handleViewAll}>查看全部 →</Text>
        </View>
        {recentBills.length === 0 ? (
          <View className='bills-empty'>
            <Text className='bills-empty-icon'>📋</Text>
            <Text className='bills-empty-text'>暂无账单</Text>
          </View>
        ) : (
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
                    <Text className='bill-payee'>
                      {bill.payee || bill.description || '未命名'}
                    </Text>
                    <View className='bill-meta'>
                      <Text className='bill-category-badge'>{bill.category || '未分类'}</Text>
                      <Text className='bill-date'>{bill.transaction_date?.slice(0, 10) || ''}</Text>
                    </View>
                  </View>
                </View>
                <Text className={`bill-amount ${bill.amount < 0 ? 'bill-amount-negative' : 'bill-amount-positive'}`}>
                  {bill.amount < 0 ? '−' : '+'}{Math.abs(bill.amount).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

        {/* Bottom spacer for floating button */}
      <View style={{ height: '200rpx' }} />
    </ScrollView>

    {/* AI 记账入口 */}
    {isAuthenticated && (
      <View className='quick-add-fab' onClick={handleAIChat}>
        <Text className='quick-add-fab-icon'>✨</Text>
        <Text className='quick-add-fab-text'>AI记账</Text>
      </View>
    )}
    </View>
  )
}

export default HomePage
