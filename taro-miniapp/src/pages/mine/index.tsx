/**
 * 个人中心页面 (Mine) — 统一账号体系
 * 展示用户信息、月度统计、功能菜单
 * 与网页端 Layout.tsx 中的用户信息展示对齐
 */
import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useAuth } from '../../shared/hooks/useAuth'
import { getMonthlySummary } from '../../shared/api/client'
import './index.css'

const MinePage: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth()
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    transactionCount: 0
  })
  const [loading, setLoading] = useState(true)

  /** 加载月度统计数据 */
  const loadStats = useCallback(async () => {
    const token = Taro.getStorageSync('token')
    if (!token) { setLoading(false); return }
    try {
      const now = new Date()
      const summary = await getMonthlySummary(now.getFullYear(), now.getMonth() + 1)
      setStats({
        totalIncome: summary.income,
        totalExpense: summary.expense,
        balance: summary.net,
        transactionCount: summary.transaction_count
      })
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])
  useDidShow(() => { loadStats() })

  /** 退出登录 */
  const handleLogout = useCallback(() => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmColor: '#f59e0b',
      success: (res) => {
        if (res.confirm) {
          logout()
          Taro.removeStorageSync('token')
          Taro.showToast({ title: '已退出登录', icon: 'success', duration: 1500 })
        }
      }
    })
  }, [logout])

  /** 跳转到预算管理 */
  const handleBudget = useCallback(() => {
    Taro.navigateTo({ url: '/pages/budget/index' })
  }, [])

  /** 未登录状态 */
  if (!isAuthenticated && !Taro.getStorageSync('token')) {
    return (
      <View className='mine-container'>
        <View className='login-prompt'>
          <Text className='login-prompt-icon'>👤</Text>
          <Text className='login-prompt-text'>请先登录以查看个人信息</Text>
          <Button className='login-btn' onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}>
            立即登录
          </Button>
        </View>
      </View>
    )
  }

  // 统一用户信息展示 — 与网页端对齐
  const displayName = user?.nickname || user?.username || '用户'
  const displayId = user?.username || user?.openid || user?.id || '未绑定'

  return (
    <View className='mine-container'>
      {/* 用户信息卡片 */}
      <View className='user-card'>
        <View className='user-avatar'>
          <Text className='user-avatar-text'>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View className='user-info'>
          <Text className='user-name'>{displayName}</Text>
          <Text className='user-id'>ID: {displayId}</Text>
        </View>
      </View>

      {/* 月度统计摘要 */}
      <View className='stats-summary'>
        <View className='stat-item'>
          <Text className='stat-value color-income'>
            {loading ? '--' : `¥${stats.totalIncome.toFixed(0)}`}
          </Text>
          <Text className='stat-label'>本月收入</Text>
        </View>
        <View className='stat-divider' />
        <View className='stat-item'>
          <Text className='stat-value color-expense'>
            {loading ? '--' : `¥${Math.abs(stats.totalExpense).toFixed(0)}`}
          </Text>
          <Text className='stat-label'>本月支出</Text>
        </View>
        <View className='stat-divider' />
        <View className='stat-item'>
          <Text className='stat-value'>{loading ? '--' : stats.transactionCount}</Text>
          <Text className='stat-label'>交易笔数</Text>
        </View>
      </View>

      {/* AI 记账入口 */}
      <View className='menu-section'>
        <View className='menu-item menu-item-chat' onClick={() => Taro.switchTab({ url: '/pages/chat/index' })}>
          <View className='menu-icon bg-chat-gradient'><Text>✨</Text></View>
          <Text className='menu-title menu-title-bold'>AI 记账</Text>
          <Text className='menu-arrow'>{'>'}</Text>
        </View>
      </View>

      {/* 功能菜单 */}
      <View className='menu-section'>
        <View className='menu-item' onClick={() => Taro.switchTab({ url: '/pages/bills/list' })}>
          <View className='menu-icon bg-income-light'><Text>📋</Text></View>
          <Text className='menu-title'>账单明细</Text>
          <Text className='menu-arrow'>{'>'}</Text>
        </View>
        <View className='menu-item' onClick={() => Taro.switchTab({ url: '/pages/analysis/index' })}>
          <View className='menu-icon bg-balance-light'><Text>📊</Text></View>
          <Text className='menu-title'>流水分析</Text>
          <Text className='menu-arrow'>{'>'}</Text>
        </View>
        <View className='menu-item' onClick={() => Taro.navigateTo({ url: '/pages/categories/index' })}>
          <View className='menu-icon bg-gold-light'><Text>🏷️</Text></View>
          <Text className='menu-title'>分类管理</Text>
          <Text className='menu-arrow'>{'>'}</Text>
        </View>
        <View className='menu-item' onClick={handleBudget}>
          <View className='menu-icon bg-expense-light'><Text>💰</Text></View>
          <Text className='menu-title'>预算管理</Text>
          <Text className='menu-arrow'>{'>'}</Text>
        </View>
      </View>

      {/* 关于 */}
      <View className='menu-section'>
        <View className='menu-item' onClick={() => Taro.showToast({ title: 'AI记账 v1.1.0', icon: 'none', duration: 2000 })}>
          <View className='menu-icon'><Text>ℹ️</Text></View>
          <Text className='menu-title'>关于我们</Text>
          <Text className='menu-arrow'>{'>'}</Text>
        </View>
      </View>

      {/* 退出登录 */}
      <Button className='logout-btn' onClick={handleLogout}>退出登录</Button>
    </View>
  )
}

export default MinePage
