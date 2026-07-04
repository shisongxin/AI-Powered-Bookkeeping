/**
 * 预算管理页面 — 对齐网页端 Analysis.tsx 中的预算功能
 * 功能：查看预算执行、手动设置预算、AI 智能生成、AI 预算建议
 */
import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Picker, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  getBudgetVsActual,
  createBudget,
  autoGenerateBudgets,
  suggestBudget,
  getCategories
} from '../../shared/api/client'
import { useDataStore } from '../../shared/stores/useDataStore'
import './index.css'

const YEAR_OPTIONS = [2024, 2025, 2026, 2027].map(y => ({ value: y, label: `${y}年` }))
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` }))

const BudgetPage: React.FC = () => {
  const billsVersion = useDataStore((s) => s.billsVersion)
  const lastVersionRef = React.useRef(billsVersion)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [budgetVs, setBudgetVs] = useState<any>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [autoGenLoading, setAutoGenLoading] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [autoGenMsg, setAutoGenMsg] = useState('')
  const [budgetForm, setBudgetForm] = useState<Record<string, string>>({})
  const [settingBudget, setSettingBudget] = useState(false)

  /** 加载预算数据 */
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [budgetRes, catRes] = await Promise.all([
        getBudgetVsActual(year, month).catch(() => null),
        getCategories().catch(() => [])
      ])
      setBudgetVs(budgetRes)
      setCategories(catRes || [])
    } catch (error) {
      console.error('加载预算数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { loadData() }, [loadData])

  useDidShow(() => {
    if (billsVersion !== lastVersionRef.current) {
      lastVersionRef.current = billsVersion
      loadData()
    }
  })

  /** 自动生成预算 — 基于上月消费 + 10% */
  const handleAutoGenerate = async () => {
    setAutoGenLoading(true)
    setAutoGenMsg('')
    try {
      const created = await autoGenerateBudgets(year, month)
      setAutoGenMsg(
        created.length === 0
          ? '上月无消费数据或当月预算已存在'
          : `已自动生成 ${created.length} 条预算（基于上月消费上浮 10%）`
      )
      loadData()
    } catch (err: any) {
      setAutoGenMsg(`生成失败: ${err?.message || '未知错误'}`)
    }
    setAutoGenLoading(false)
  }

  /** AI 预算建议 — 基于近 3 个月历史数据 */
  const handleSuggest = async () => {
    setSuggestLoading(true)
    try {
      const result = await suggestBudget(year, month)
      setSuggestions(result || [])
      if (result.length === 0) {
        Taro.showToast({ title: '暂无足够数据生成建议', icon: 'none' })
      }
    } catch (err: any) {
      Taro.showToast({ title: '获取建议失败', icon: 'none' })
    }
    setSuggestLoading(false)
  }

  /** 手动设置单条预算 */
  const handleSetBudget = async (category: string) => {
    const amt = parseFloat(budgetForm[category])
    if (isNaN(amt) || amt <= 0) {
      Taro.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    try {
      await createBudget({ year, month, category, amount: amt })
      setBudgetForm(prev => {
        const next = { ...prev }
        delete next[category]
        return next
      })
      Taro.showToast({ title: '设置成功', icon: 'success' })
      loadData()
    } catch (err: any) {
      Taro.showToast({ title: '设置失败', icon: 'none' })
    }
  }

  /** 应用 AI 建议 */
  const handleApplySuggestion = async (category: string, amount: number) => {
    try {
      await createBudget({ year, month, category, amount: Math.round(amount) })
      setSuggestions(prev => prev.filter(s => s.category !== category))
      Taro.showToast({ title: '已应用', icon: 'success' })
      loadData()
    } catch (err: any) {
      Taro.showToast({ title: '应用失败', icon: 'none' })
    }
  }

  const items = budgetVs?.items || []

  return (
    <ScrollView className='budget-container' scrollY>
      <View style={{ padding: '24rpx' }}>
      {/* 头部 */}
      <View className='page-header'>
        <View className='header-left'>
          <Text className='page-title'>预算管理</Text>
          <Text className='page-subtitle'>{year}年{month}月</Text>
        </View>
        <View className='header-selectors'>
          <Picker mode='selector' range={YEAR_OPTIONS} rangeKey='label'
            value={YEAR_OPTIONS.findIndex(y => y.value === year)}
            onChange={(e) => setYear(YEAR_OPTIONS[e.detail.value].value)}>
            <View className='header-picker'>
              <Text>{year}年</Text>
              <Text className='selector-arrow'>▼</Text>
            </View>
          </Picker>
          <Picker mode='selector' range={MONTH_OPTIONS} rangeKey='label'
            value={month - 1}
            onChange={(e) => setMonth(Number(e.detail.value) + 1)}>
            <View className='header-picker'>
              <Text>{month}月</Text>
              <Text className='selector-arrow'>▼</Text>
            </View>
          </Picker>
        </View>
      </View>

      {/* 总览卡片 */}
      {budgetVs && items.length > 0 && (
        <View className='budget-overview glass-card'>
          <View className='budget-overview-item'>
            <Text className='budget-overview-label'>预算合计</Text>
            <Text className='budget-overview-value'>¥{(budgetVs.total_budget || 0).toFixed(0)}</Text>
          </View>
          <View className='budget-overview-item'>
            <Text className='budget-overview-label'>实际支出</Text>
            <Text className='budget-overview-value color-expense'>¥{(budgetVs.total_actual || 0).toFixed(0)}</Text>
          </View>
          <View className='budget-overview-item'>
            <Text className='budget-overview-label'>剩余</Text>
            <Text className={`budget-overview-value ${(budgetVs.total_remaining || 0) >= 0 ? 'color-income' : 'color-expense'}`}>
              ¥{(budgetVs.total_remaining || 0).toFixed(0)}
            </Text>
          </View>
        </View>
      )}

      {/* 操作按钮 */}
      <View className='budget-actions glass-card'>
        <View className='budget-action-btn gold' onClick={handleAutoGenerate}>
          <Text>{autoGenLoading ? '生成中...' : '⚡ 智能生成预算'}</Text>
        </View>
        <View className='budget-action-btn' onClick={handleSuggest}>
          <Text>{suggestLoading ? '分析中...' : '🤖 AI 预算建议'}</Text>
        </View>
        <View className={`budget-action-btn ${settingBudget ? 'active' : ''}`} onClick={() => setSettingBudget(!settingBudget)}>
          <Text>{settingBudget ? '完成设置' : '✏️ 手动设置'}</Text>
        </View>
      </View>

      {/* 自动生成消息 */}
      {autoGenMsg && (
        <View className={`budget-msg ${autoGenMsg.startsWith('已自动') ? 'success' : autoGenMsg.startsWith('生成失败') ? 'error' : 'info'}`}>
          <Text>{autoGenMsg}</Text>
        </View>
      )}

      {/* AI 建议列表 */}
      {suggestions.length > 0 && (
        <View className='suggestions-section glass-card'>
          <Text className='section-title'>🤖 AI 预算建议</Text>
          <Text className='section-subtitle'>基于近 3 个月历史消费</Text>
          {suggestions.map((s: any) => (
            <View key={s.category} className='suggestion-item'>
              <View className='suggestion-info'>
                <Text className='suggestion-cat'>{s.category}</Text>
                <Text className='suggestion-reason'>{s.reason}</Text>
              </View>
              <View className='suggestion-right'>
                <Text className='suggestion-amount'>¥{s.suggested_amount?.toFixed(0)}</Text>
                <View className='suggestion-apply-btn' onClick={() => handleApplySuggestion(s.category, s.suggested_amount)}>
                  <Text>应用</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 预算执行列表 */}
      {loading ? (
        <View className='skeleton-card' />
      ) : items.length === 0 ? (
        <View className='budget-empty glass-card'>
          <Text className='empty-icon'>💰</Text>
          <Text className='empty-text'>本月未设置预算</Text>
          <Text className='empty-hint'>点击上方按钮生成或手动设置</Text>
        </View>
      ) : (
        <View className='budget-list glass-card'>
          <Text className='section-title'>预算执行</Text>
          {items.map((item: any) => {
            const pct = Math.min(item.percentage, 100)
            const barColor = item.status === '已超支' ? '#ef4444' : item.status === '接近上限' ? '#f59e0b' : '#10b981'
            const badgeClass = item.status === '已超支' ? 'badge-red' : item.status === '接近上限' ? 'badge-gold' : 'badge-green'

            return (
              <View key={item.category} className='budget-item'>
                <View className='budget-item-top'>
                  <Text className='budget-cat-name'>{item.category}</Text>
                  <View className={`badge ${badgeClass}`}>
                    <Text>{item.status} {item.percentage.toFixed(0)}%</Text>
                  </View>
                </View>
                <View className='budget-progress-track'>
                  <View className='budget-progress-fill' style={{ width: `${pct}%`, backgroundColor: barColor }} />
                </View>
                <View className='budget-item-bottom'>
                  <Text className='budget-amount-text'>实际 ¥{item.actual.toFixed(0)}</Text>
                  <Text className='budget-amount-text'>预算 ¥{item.budget.toFixed(0)}</Text>
                </View>
                {settingBudget && (
                  <View className='budget-edit-row'>
                    <Input className='budget-input' type='digit' placeholder='新预算'
                      value={budgetForm[item.category] || ''}
                      onInput={(e: any) => setBudgetForm({ ...budgetForm, [item.category]: e.detail.value })} />
                    <View className='budget-set-btn' onClick={() => handleSetBudget(item.category)}>
                      <Text>设置</Text>
                    </View>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      )}

      {/* 未设置预算的分类快速入口 */}
      {categories.length > 0 && settingBudget && (
        <View className='quick-set-section glass-card'>
          <Text className='section-title'>快速设置</Text>
          <View className='quick-set-grid'>
            {categories
              .filter((c: any) => !items.find((i: any) => i.category === c.name))
              .map((c: any) => (
                <View key={c.id} className='quick-set-item' onClick={() => handleSetBudget(c.name)}>
                  <Text className='quick-set-icon'>{c.icon || '📁'}</Text>
                  <Text className='quick-set-name'>{c.name}</Text>
                </View>
              ))}
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  )
}

export default BudgetPage
