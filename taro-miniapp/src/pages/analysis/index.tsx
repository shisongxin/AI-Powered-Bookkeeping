/** 流水分析(对齐 web/Analysis.tsx) — ECharts for WeChat mini-program */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { View, Text, ScrollView, Picker, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useDataStore } from '../../shared/stores/useDataStore'
import Chart from '../../shared/components/Chart'
import {
  getMonthlySummary,
  getCategoryBreakdown,
  getTrend,
  getBudgetVsActual,
  createBudget,
  autoGenerateBudgets
} from '../../shared/api/client'
import './index.css'

const COLORS = [
  '#f59e0b', '#d97706', '#b45309', '#fbbf24',
  '#fcd34d', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#6366f1', '#a855f7', '#ec4899'
]

const GRANULARITY_OPTIONS = [
  { value: 'daily', label: '按日' },
  { value: 'weekly', label: '按周' },
  { value: 'monthly', label: '按月' }
]

/** 填充趋势数据中缺失的日期/周期，确保消费为0的日期也能在图表中显示 */
function fillTrendGaps(data: any[], granularity: string, startDate: string, endDate: string) {
  if (data.length === 0) return data
  const result: any[] = []
  const dataMap = new Map(data.map(d => [d.period, d]))

  if (granularity === 'daily') {
    // 遍历起止日期之间的每一天
    const start = new Date(startDate)
    const end = new Date(endDate)
    const cursor = new Date(start)
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      const existing = dataMap.get(key)
      result.push(existing || { period: key, income: 0, expense: 0, net: 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
  } else if (granularity === 'monthly') {
    // 遍历起止月份之间的每个月
    const [sY, sM] = startDate.split('-').map(Number)
    const [eY, eM] = endDate.split('-').map(Number)
    let y = sY, m = sM
    while (y < eY || (y === eY && m <= eM)) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      const existing = dataMap.get(key)
      result.push(existing || { period: key, income: 0, expense: 0, net: 0 })
      m++
      if (m > 12) { m = 1; y++ }
    }
  } else {
    // weekly — 按周遍历
    const start = new Date(startDate)
    const end = new Date(endDate)
    const cursor = new Date(start)
    while (cursor <= end) {
      const weekNum = getWeekNumber(cursor)
      const key = `${cursor.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
      const existing = dataMap.get(key)
      result.push(existing || { period: key, income: 0, expense: 0, net: 0 })
      cursor.setDate(cursor.getDate() + 7)
    }
  }
  return result
}

/** 获取日期所在年的周数 */
function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const YEAR_OPTIONS = [2024, 2025, 2026, 2027].map(y => ({ value: y, label: `${y}年` }))
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` }))

const AnalysisPage: React.FC = () => {
  const billsVersion = useDataStore((s) => s.billsVersion)
  const lastVersionRef = useRef(billsVersion)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [granularity, setGranularity] = useState('daily')
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie')

  const [summary, setSummary] = useState<any>(null)
  const [categoryData, setCategoryData] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [budgetVs, setBudgetVs] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Budget manual-setting mode
  const [settingBudget, setSettingBudget] = useState(false)
  const [budgetForm, setBudgetForm] = useState<Record<string, string>>({})
  const [autoGenLoading, setAutoGenLoading] = useState(false)
  const [autoGenMsg, setAutoGenMsg] = useState('')
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set())

  // ===== Data loading =====
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      // Trend: full year when monthly, otherwise current month
      const trendStart = granularity === 'monthly' ? `${year}-01-01` : startDate
      const trendEnd = granularity === 'monthly' ? `${year}-12-31` : endDate

      const [summaryRes, categoryRes, trendRes, budgetRes] = await Promise.all([
        getMonthlySummary(year, month),
        getCategoryBreakdown(startDate, endDate, '支出'),
        getTrend(trendStart, trendEnd, granularity),
        getBudgetVsActual(year, month).catch(() => null)
      ])

      setSummary(summaryRes)
      setCategoryData(categoryRes || [])
      // 填充缺失日期/周期，确保消费为0的日期也能在图表中显示
      setTrendData(fillTrendGaps(trendRes || [], granularity, trendStart, trendEnd))
      setBudgetVs(budgetRes)
    } catch (error: any) {
      console.error('加载分析数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [year, month, granularity])

  useEffect(() => {
    loadData()
  }, [loadData])

  useDidShow(() => {
    if (billsVersion !== lastVersionRef.current) {
      lastVersionRef.current = billsVersion
      loadData()
    }
  })

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    Taro.showToast({ title: '刷新成功', icon: 'success', duration: 1000 })
  }, [loadData])

  // ===== Budget handlers =====
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

  const handleSetBudget = async (category: string) => {
    const amt = parseFloat(budgetForm[category])
    if (isNaN(amt) || amt <= 0) return
    try {
      await createBudget({ year, month, category, amount: amt })
      setBudgetForm(prev => {
        const next = { ...prev }
        delete next[category]
        return next
      })
      loadData()
    } catch (err: any) {
      Taro.showToast({ title: '设置失败', icon: 'none' })
    }
  }

  const toggleHidden = (cat: string) => {
    setHiddenCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }

  // ===== ECharts options =====
  const pieOption = useMemo(() => {
    if (categoryData.length === 0) return {}
    const total = categoryData.reduce((sum, item) => sum + item.amount, 0)
    return {
      color: COLORS,
      tooltip: {
        trigger: 'item',
        formatter: '{b}: ¥{c} ({d}%)'
      },
      legend: {
        show: false
      },
      series: [
        {
          name: '支出',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold' }
          },
          data: categoryData.slice(0, 12).map(item => ({
            name: item.category,
            value: Math.round(item.amount * 100) / 100
          }))
        }
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '42%',
          style: {
            text: '支出总额',
            textAlign: 'center',
            fill: '#8b7355',
            fontSize: 12
          }
        },
        {
          type: 'text',
          left: 'center',
          top: '52%',
          style: {
            text: `¥${total.toFixed(0)}`,
            textAlign: 'center',
            fill: '#2d241c',
            fontSize: 20,
            fontWeight: 'bold'
          }
        }
      ]
    }
  }, [categoryData])

  const barOption = useMemo(() => {
    if (categoryData.length === 0) return {}
    // 取消费前5个分类；若总消费为0则按分类名字符顺序取前5
    const totalExpense = categoryData.reduce((s: number, d: any) => s + (d.amount || 0), 0)
    const sorted = [...categoryData].sort((a: any, b: any) => {
      if (totalExpense === 0) {
        return a.category.localeCompare(b.category, 'zh')
      }
      return (b.amount || 0) - (a.amount || 0)
    })
    const visibleData = sorted.slice(0, 5)
    return {
      color: COLORS,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = params[0]
          return `${p.name}<br/>¥${p.value.toFixed(2)}`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: '8%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: visibleData.map(d => d.category),
        axisLabel: {
          fontSize: 10,
          fill: '#8b7355',
          interval: 0,
          rotate: visibleData.length > 6 ? 30 : 0
        },
        axisLine: { lineStyle: { color: '#d7ccc2' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, fill: '#a89580' },
        splitLine: { lineStyle: { color: '#f0ebe5', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [
        {
          name: '支出',
          type: 'bar',
          barWidth: '50%',
          data: visibleData.map((d, i) => ({
            value: Math.round(d.amount * 100) / 100,
            itemStyle: { color: COLORS[i % COLORS.length], borderRadius: [4, 4, 0, 0] }
          })),
          label: {
            show: true,
            position: 'top',
            fontSize: 10,
            fill: '#2d241c',
            formatter: (p: any) => `¥${p.value.toFixed(0)}`
          }
        }
      ]
    }
  }, [categoryData])

  const trendOption = useMemo(() => {
    if (trendData.length === 0) return {}
    const maxValue = Math.max(...trendData.map(d => Math.max(d.income, d.expense)))
    if (maxValue === 0) return {}

    return {
      color: ['#ef4444', '#10b981'],
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let s = params[0].axisValue
          params.forEach((p: any) => {
            s += `<br/>${p.marker} ${p.seriesName}: ¥${p.value.toFixed(2)}`
          })
          return s
        }
      },
      legend: {
        data: ['支出', '收入'],
        top: 0,
        right: 0,
        textStyle: { fontSize: 11, fill: '#8b7355' },
        itemWidth: 12,
        itemHeight: 8
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '14%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trendData.map(d => d.period),
        axisLabel: {
          fontSize: 10,
          fill: '#a89580',
          interval: Math.ceil(trendData.length / 6) - 1
        },
        axisLine: { lineStyle: { color: '#d7ccc2' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        max: maxValue * 1.1,
        axisLabel: {
          fontSize: 10,
          fill: '#a89580',
          formatter: (v: number) => v.toFixed(0)
        },
        splitLine: { lineStyle: { color: '#f0ebe5', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [
        {
          name: '支出',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: trendData.map(d => Math.round(d.expense * 100) / 100),
          lineStyle: { width: 2.5, color: '#ef4444' },
          itemStyle: { color: '#ef4444' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(239,68,68,0.15)' },
                { offset: 1, color: 'rgba(239,68,68,0.01)' }
              ]
            }
          }
        },
        {
          name: '收入',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: trendData.map(d => Math.round(d.income * 100) / 100),
          lineStyle: { width: 2.5, color: '#10b981' },
          itemStyle: { color: '#10b981' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16,185,129,0.15)' },
                { offset: 1, color: 'rgba(16,185,129,0.01)' }
              ]
            }
          }
        }
      ]
    }
  }, [trendData])

  // ===== Render: Budget Section =====
  const renderBudgetSection = () => {
    const items = budgetVs?.items || []
    const visibleItems = items.filter((item: any) => !hiddenCats.has(item.category))

    return (
      <View className='budget-section glass-card'>
        {/* Header */}
        <View className='budget-header'>
          <Text className='budget-title'>{month}月预算执行</Text>
          <View className='budget-actions'>
            <View
              className={`budget-action-btn ${settingBudget ? 'active' : ''}`}
              onClick={() => setSettingBudget(!settingBudget)}
            >
              <Text>{settingBudget ? '完成设置' : '设置'}</Text>
            </View>
            <View
              className='budget-action-btn gold'
              onClick={handleAutoGenerate}
            >
              <Text>{autoGenLoading ? '生成中...' : '智能生成'}</Text>
            </View>
          </View>
        </View>

        {/* Auto-gen message */}
        {autoGenMsg && (
          <View className={`budget-msg ${autoGenMsg.startsWith('已自动') ? 'success' : autoGenMsg.startsWith('生成失败') ? 'error' : 'info'}`}>
            <Text>{autoGenMsg}</Text>
          </View>
        )}

        {/* Empty state */}
        {!budgetVs || items.length === 0 ? (
          <View className='budget-empty'>
            <Text className='budget-empty-text'>本月未设置预算</Text>
            <View className='btn-primary budget-auto-btn' onClick={handleAutoGenerate}>
              <Text>{autoGenLoading ? '正在分析上月数据...' : '基于上月消费自动生成'}</Text>
            </View>
          </View>
        ) : (
          <View className='budget-list'>
            {visibleItems.map((item: any) => {
              const pct = Math.min(item.percentage, 100)
              const barColor = item.status === '已超支' ? '#ef4444' : item.status === '接近上限' ? '#f59e0b' : '#10b981'
              const badgeClass = item.status === '已超支' ? 'badge-red' : item.status === '接近上限' ? 'badge-gold' : 'badge-green'

              return (
                <View key={item.category} className='budget-item'>
                  <View className='budget-item-top'>
                    <View className='budget-item-left'>
                      <View className='budget-hide-btn' onClick={() => toggleHidden(item.category)}>
                        <Text className='budget-hide-icon'>✕</Text>
                      </View>
                      <Text className='budget-cat-name'>{item.category}</Text>
                    </View>
                    <View className={`badge ${badgeClass}`}>
                      <Text>{item.status} {item.percentage.toFixed(0)}%</Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View className='budget-progress-track'>
                    <View
                      className='budget-progress-fill'
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </View>

                  <View className='budget-item-bottom'>
                    <Text className='budget-amount-text'>实际 ¥{item.actual.toFixed(0)}</Text>
                    <Text className='budget-amount-text'>预算 ¥{item.budget.toFixed(0)}</Text>
                  </View>

                  {/* Inline edit row */}
                  {settingBudget && (
                    <View className='budget-edit-row animate-scale-in'>
                      <Input
                        className='budget-input'
                        type='digit'
                        placeholder='新预算'
                        value={budgetForm[item.category] || ''}
                        onInput={(e: any) => setBudgetForm({ ...budgetForm, [item.category]: e.detail.value })}
                      />
                      <View className='budget-set-btn' onClick={() => handleSetBudget(item.category)}>
                        <Text>设置</Text>
                      </View>
                    </View>
                  )}
                </View>
              )
            })}

            {/* Hidden categories */}
            {hiddenCats.size > 0 && (
              <View className='budget-hidden'>
                <Text className='budget-hidden-title'>已隐藏的分类：</Text>
                <View className='budget-hidden-tags'>
                  {[...hiddenCats].map(cat => (
                    <View key={cat} className='budget-hidden-tag' onClick={() => toggleHidden(cat)}>
                      <Text>{cat} ↺</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Summary */}
            <View className='budget-summary'>
              <View className='budget-summary-item'>
                <Text className='budget-summary-label'>预算合计</Text>
                <Text className='budget-summary-value'>¥{(budgetVs.total_budget || 0).toFixed(0)}</Text>
              </View>
              <View className='budget-summary-item'>
                <Text className='budget-summary-label'>实际支出</Text>
                <Text className='budget-summary-value'>¥{(budgetVs.total_actual || 0).toFixed(0)}</Text>
              </View>
              <View className='budget-summary-item'>
                <Text className='budget-summary-label'>剩余</Text>
                <Text className={`budget-summary-value ${(budgetVs.total_remaining || 0) >= 0 ? 'color-income' : 'color-expense'}`}>
                  ¥{(budgetVs.total_remaining || 0).toFixed(0)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }

  // ===== Loading skeleton =====
  if (loading && !summary) {
    return (
      <ScrollView className='analysis-container' scrollY>
        <View className='skeleton-header' />
        <View className='skeleton-row'>
          <View className='skeleton-card' />
          <View className='skeleton-card' />
          <View className='skeleton-card' />
          <View className='skeleton-card' />
        </View>
        <View className='skeleton-chart' />
        <View className='skeleton-chart' />
      </ScrollView>
    )
  }

  return (
    <ScrollView
      className='analysis-container stagger-children'
      scrollY
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={handleRefresh}
    >
      <View style={{ paddingBottom: '40rpx' }}>
      {/* Header with year/month selectors side by side */}
      <View className='page-header'>
        <View className='header-left'>
          <Text className='page-title'>流水分析</Text>
          <Text className='page-subtitle'>{year}年{month}月</Text>
        </View>
        <View className='header-selectors'>
          <Picker
            mode='selector'
            range={YEAR_OPTIONS}
            rangeKey='label'
            value={YEAR_OPTIONS.findIndex(y => y.value === year)}
            onChange={(e) => setYear(YEAR_OPTIONS[e.detail.value].value)}
          >
            <View className='header-picker'>
              <Text>{year}年</Text>
              <Text className='selector-arrow'>▼</Text>
            </View>
          </Picker>
          <Picker
            mode='selector'
            range={MONTH_OPTIONS}
            rangeKey='label'
            value={month - 1}
            onChange={(e) => setMonth(Number(e.detail.value) + 1)}
          >
            <View className='header-picker'>
              <Text>{month}月</Text>
              <Text className='selector-arrow'>▼</Text>
            </View>
          </Picker>
        </View>
      </View>

      {/* 4 Stat Cards in 2-col grid */}
      {summary && (
        <View className='stats-grid'>
          <View className='stat-card stat-card-income'>
            <View className='stat-card-header'>
              <Text className='stat-label'>收入</Text>
              <View className='stat-icon stat-icon-income'>
                <Text className='stat-icon-text'>↑</Text>
              </View>
            </View>
            <Text className='stat-value'>¥{summary.income.toFixed(2)}</Text>
            <Text className='stat-unit'>元</Text>
          </View>

          <View className='stat-card stat-card-expense'>
            <View className='stat-card-header'>
              <Text className='stat-label'>支出</Text>
              <View className='stat-icon stat-icon-expense'>
                <Text className='stat-icon-text'>↓</Text>
              </View>
            </View>
            <Text className='stat-value'>¥{Math.abs(summary.expense).toFixed(2)}</Text>
            <Text className='stat-unit'>元</Text>
          </View>

          <View className={`stat-card ${summary.net >= 0 ? 'stat-card-balance' : 'stat-card-expense'}`}>
            <View className='stat-card-header'>
              <Text className='stat-label'>结余</Text>
              <View className={`stat-icon ${summary.net >= 0 ? 'stat-icon-balance' : 'stat-icon-expense'}`}>
                <Text className='stat-icon-text'>=</Text>
              </View>
            </View>
            <Text className='stat-value'>¥{summary.net.toFixed(2)}</Text>
            <Text className='stat-unit'>元</Text>
          </View>

          <View className='stat-card stat-card-total'>
            <View className='stat-card-header'>
              <Text className='stat-label'>交易笔数</Text>
              <View className='stat-icon stat-icon-total'>
                <Text className='stat-icon-text'>#</Text>
              </View>
            </View>
            <Text className='stat-value integer'>{summary.transaction_count}</Text>
            <Text className='stat-unit'>笔</Text>
          </View>
        </View>
      )}

      {/* Trend Chart (glass card) */}
      <View className='chart-section glass-card'>
        <View className='chart-section-header'>
          <Text className='chart-section-title'>
            {granularity === 'monthly' ? `${year}年收支趋势` : `${year}年${month}月收支趋势`}
          </Text>
          <View className='granularity-selector'>
            {GRANULARITY_OPTIONS.map(opt => (
              <View
                key={opt.value}
                className={`granularity-btn ${granularity === opt.value ? 'active' : ''}`}
                onClick={() => setGranularity(opt.value)}
              >
                <Text>{opt.label}</Text>
              </View>
            ))}
          </View>
        </View>
        {trendData.length > 0 ? (
          <Chart key="trend" option={trendOption} height={300} />
        ) : (
          <View className='empty-state'>
            <Text className='empty-icon'>📈</Text>
            <Text className='empty-text'>暂无趋势数据</Text>
          </View>
        )}
      </View>

      {/* Category Chart + Budget side by side on wide screens, stacked on narrow */}
      <View className='charts-row'>
        {/* Category Chart (glass card) */}
        <View className='chart-section glass-card chart-narrow'>
          <View className='chart-section-header'>
            <Text className='chart-section-title'>{month}月分类支出</Text>
            <View className='chart-toggle'>
              <View
                className={`toggle-btn ${chartType === 'pie' ? 'active' : ''}`}
                onClick={() => setChartType('pie')}
              >
                <Text>饼图</Text>
              </View>
              <View
                className={`toggle-btn ${chartType === 'bar' ? 'active' : ''}`}
                onClick={() => setChartType('bar')}
              >
                <Text>条状</Text>
              </View>
            </View>
          </View>
          {categoryData.length > 0 ? (
            chartType === 'pie'
              ? <Chart key="pie" option={pieOption} height={320} />
              : <Chart key="bar" option={barOption} height={300} />
          ) : (
            <View className='empty-state'>
              <Text className='empty-icon'>📊</Text>
              <Text className='empty-text'>暂无数据</Text>
            </View>
          )}
        </View>

        {/* Budget Execution (glass card) */}
        {renderBudgetSection()}
      </View>
      </View>
    </ScrollView>
  )
}

export default AnalysisPage
