import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAuth } from '../../shared/hooks/useAuth'
import { getMonthlySummary } from '../../shared/api/client'
import './index.css'

/**
 * 个人中心页面
 * 展示用户信息、统计数据和功能入口
 */
const MinePage: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth()
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    transactionCount: 0
  })
  const [loading, setLoading] = useState(true)

  // 加载统计数据
  const loadStats = useCallback(async () => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1

      const summary = await getMonthlySummary(year, month)
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

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // 页面显示时刷新
  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (token) {
      loadStats()
    }
  }, [loadStats])

  // 登录
  const handleLogin = useCallback(() => {
    Taro.navigateTo({ url: '/pages/login/index' })
  }, [])

  // 退出登录
  const handleLogout = useCallback(() => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          logout()
          Taro.showToast({ title: '已退出登录', icon: 'success', duration: 1500 })
        }
      }
    })
  }, [logout])

  // 跳转到账单列表
  const handleViewBills = useCallback(() => {
    Taro.switchTab({ url: '/pages/bills/list' })
  }, [])

  // 跳转到数据分析
  const handleViewAnalysis = useCallback(() => {
    Taro.switchTab({ url: '/pages/analysis/index' })
  }, [])

  // 查看关于
  const handleAbout = useCallback(() => {
    Taro.showToast({ title: 'AI记账 v1.0.0', icon: 'none', duration: 2000 })
  }, [])

  // 未登录状态
  if (!isAuthenticated && !Taro.getStorageSync('token')) {
    return (
      <View className='mine-container'>
        <View className='login-prompt'>
          <Text className='login-prompt-icon'>👤</Text>
          <Text className='login-prompt-text'>请先登录以查看个人信息</Text>
          <Button className='login-btn' onClick={handleLogin}>
            立即登录
          </Button>
        </View>
      </View>
    )
  }

  const displayName = user?.nickname || '用户'
  const displayId = user?.openid || user?.id || '未绑定'

  return (
    <View className='mine-container'>
      {/* 用户信息卡片 */}
      <View className='user-card'>
        <View className='user-avatar'>
          <Text>👤</Text>
        </View>
        <View className='user-info'>
          <Text className='user-name'>{displayName}</Text>
          <Text className='user-id'>
            ID: {typeof displayId === 'string' && displayId.length > 12
              ? displayId.slice(0, 12) + '...'
              : displayId}
          </Text>
        </View>
      </View>

      {/* 统计摘要 */}
      <View className='stats-summary'>
        <View className='stat-item'>
          <Text className='stat-value'>
            {loading ? '--' : `¥${stats.totalIncome.toFixed(0)}`}
          </Text>
          <Text className='stat-label'>本月收入</Text>
        </View>
        <View className='stat-divider' />
        <View className='stat-item'>
          <Text className='stat-value'>
            {loading ? '--' : `¥${stats.totalExpense.toFixed(0)}`}
          </Text>
          <Text className='stat-label'>本月支出</Text>
        </View>
        <View className='stat-divider' />
        <View className='stat-item'>
          <Text className='stat-value'>
            {loading ? '--' : stats.transactionCount}
          </Text>
          <Text className='stat-label'>交易笔数</Text>
        </View>
      </View>

      {/* 菜单列表 */}
      <View className='menu-section'>
        <View className='menu-item' onClick={handleViewBills}>
          <View className='menu-icon'>
            <Text>📋</Text>
          </View>
          <Text className='menu-title'>账单管理</Text>
          <Text className='menu-arrow'>›</Text>
        </View>

        <View className='menu-item' onClick={handleViewAnalysis}>
          <View className='menu-icon'>
            <Text>📊</Text>
          </View>
          <Text className='menu-title'>数据分析</Text>
          <Text className='menu-arrow'>›</Text>
        </View>

        <View className='menu-item' onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none', duration: 1500 })}>
          <View className='menu-icon'>
            <Text>💰</Text>
          </View>
          <Text className='menu-title'>预算管理</Text>
          <View className='menu-badge'>
            <Text>New</Text>
          </View>
          <Text className='menu-arrow'>›</Text>
        </View>

        <View className='menu-item' onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none', duration: 1500 })}>
          <View className='menu-icon'>
            <Text>📁</Text>
          </View>
          <Text className='menu-title'>账单导入</Text>
          <Text className='menu-arrow'>›</Text>
        </View>

        <View className='menu-item' onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none', duration: 1500 })}>
          <View className='menu-icon'>
            <Text>⚙️</Text>
          </View>
          <Text className='menu-title'>设置</Text>
          <Text className='menu-arrow'>›</Text>
        </View>
      </View>

      {/* 关于 */}
      <View className='menu-section'>
        <View className='menu-item' onClick={handleAbout}>
          <View className='menu-icon'>
            <Text>ℹ️</Text>
          </View>
          <Text className='menu-title'>关于我们</Text>
          <Text className='menu-arrow'>›</Text>
        </View>
      </View>

      {/* 退出登录 */}
      <Button className='logout-btn' onClick={handleLogout}>
        退出登录
      </Button>

      {/* 版本信息 */}
      <View className='version-info'>
        <Text className='version-text'>AI记账 v1.0.0</Text>
      </View>
    </View>
  )
}

export default MinePage
