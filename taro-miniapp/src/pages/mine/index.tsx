/**
 * 个人中心页面 (Mine) — 统一账号体系
 * 展示用户信息、月度统计、功能菜单
 * 与网页端 Layout.tsx 中的用户信息展示对齐
 */
import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, Button, Textarea, Input } from '@tarojs/components'
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

  /* ===== 反馈弹窗 ===== */
  const [feedbackVisible, setFeedbackVisible] = useState(false)
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'other'>('bug')
  const [feedbackContent, setFeedbackContent] = useState('')
  const [feedbackContact, setFeedbackContact] = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)

  const openFeedback = useCallback(() => {
    setFeedbackType('bug')
    setFeedbackContent('')
    setFeedbackContact('')
    setFeedbackVisible(true)
  }, [])

  const closeFeedback = useCallback(() => {
    setFeedbackVisible(false)
  }, [])

  const submitFeedback = useCallback(async () => {
    if (!feedbackContent.trim()) {
      Taro.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }
    setFeedbackSubmitting(true)
    try {
      // 这里可以接入后端反馈接口，目前先本地收集
      await new Promise(resolve => setTimeout(resolve, 800))
      Taro.showToast({ title: '感谢反馈！', icon: 'success' })
      setFeedbackVisible(false)
    } catch {
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setFeedbackSubmitting(false)
    }
  }, [feedbackContent])

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

      {/* 帮助与反馈 */}
      <View className='menu-section'>
        <View className='menu-item' onClick={openFeedback}>
          <View className='menu-icon bg-feedback-light'><Text>💬</Text></View>
          <Text className='menu-title'>意见反馈</Text>
          <Text className='menu-arrow'>{'>'}</Text>
        </View>
        <View className='menu-item' onClick={() => Taro.showToast({ title: 'AI记账 v1.2.0 · 让记账更智能', icon: 'none', duration: 2000 })}>
          <View className='menu-icon bg-about-light'><Text>ℹ️</Text></View>
          <Text className='menu-title'>关于我们</Text>
          <Text className='menu-arrow'>{'>'}</Text>
        </View>
      </View>

      {/* 退出登录 */}
      <Button className='logout-btn' onClick={handleLogout}>退出登录</Button>

      {/* ===== 反馈弹窗 ===== */}
      {feedbackVisible && (
        <View className='feedback-overlay' onClick={closeFeedback}>
          <View className='feedback-modal' onClick={(e) => e.stopPropagation()}>
            {/* 弹窗头部 */}
            <View className='feedback-header'>
              <Text className='feedback-title'>意见反馈</Text>
              <View className='feedback-close' onClick={closeFeedback}>
                <Text className='feedback-close-text'>✕</Text>
              </View>
            </View>

            {/* 反馈类型 */}
            <View className='feedback-section'>
              <Text className='feedback-label'>反馈类型</Text>
              <View className='feedback-type-group'>
                <View
                  className={`feedback-type-btn ${feedbackType === 'bug' ? 'active bug' : ''}`}
                  onClick={() => setFeedbackType('bug')}
                >
                  <Text>🐛 问题反馈</Text>
                </View>
                <View
                  className={`feedback-type-btn ${feedbackType === 'feature' ? 'active feature' : ''}`}
                  onClick={() => setFeedbackType('feature')}
                >
                  <Text>💡 功能建议</Text>
                </View>
                <View
                  className={`feedback-type-btn ${feedbackType === 'other' ? 'active other' : ''}`}
                  onClick={() => setFeedbackType('other')}
                >
                  <Text>📝 其他</Text>
                </View>
              </View>
            </View>

            {/* 反馈内容 */}
            <View className='feedback-section'>
              <Text className='feedback-label'>反馈内容</Text>
              <Textarea
                className='feedback-textarea'
                value={feedbackContent}
                onInput={(e) => setFeedbackContent(e.detail.value)}
                placeholder='请详细描述您遇到的问题或建议，我们会认真阅读每一条反馈...'
                placeholderClass='feedback-textarea-placeholder'
                maxlength={500}
                autoHeight
              />
              <Text className='feedback-count'>{feedbackContent.length}/500</Text>
            </View>

            {/* 联系方式（选填） */}
            <View className='feedback-section'>
              <Text className='feedback-label'>联系方式（选填）</Text>
              <Input
                className='feedback-input'
                value={feedbackContact}
                onInput={(e) => setFeedbackContact(e.detail.value)}
                placeholder='手机号 / 微信 / 邮箱，方便我们回复您'
                placeholderClass='feedback-input-placeholder'
              />
            </View>

            {/* 提交按钮 */}
            <Button
              className={`feedback-submit-btn ${feedbackSubmitting ? 'submitting' : ''}`}
              onClick={submitFeedback}
              disabled={feedbackSubmitting}
            >
              {feedbackSubmitting ? '提交中...' : '提交反馈'}
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}

export default MinePage
