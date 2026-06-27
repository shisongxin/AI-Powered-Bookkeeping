import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getMonthlySummary, getCategoryBreakdown, getTrend } from '../../shared/api/client'
import { useDidShow } from '@tarojs/taro'
import './index.css'

// 颜色常量（与 Web 端对齐）
const COLORS = [
  '#f59e0b', '#d97706', '#b45309', '#fbbf24',
  '#fcd34d', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#6366f1', '#a855f7', '#ec4899'
]

const CATEGORY_ICONS: Record<string, string> = {
  '餐饮': '🍜', '交通': '🚗', '购物': '🛒', '娱乐': '🎮',
  '居住': '🏠', '医疗': '💊', '教育': '📚', '工资': '💰',
  '转账': '🔄', '餐饮美食': '🍜', '美食': '🍜',
  '超市': '🛒', '服饰': '👗', '日用': '🧴', '水果': '🍎',
  '零食': '🍬', '运动': '⚽', '通讯': '📱', '服饰鞋帽': '👗',
  '彩妆': '💄', '住房': '🏠', '居家': '🛋️', '孩子': '👶',
  '长辈': '👴', '社交': '👥', '旅行': '✈️', '烟酒': '🚬',
  '数码': '💻', '汽车': '🚗', '医疗健康': '💊', '书籍': '📚',
  '学习': '📖', '宠物': '🐱', '礼金': '🧧', '礼物': '🎁',
  '办公': '💼', '维修': '🔧', '捐赠': '🎁', '彩票': '🎰'
}

const AnalysisPage: React.FC = () => {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie')
  const [direction, setDirection] = useState('支出')
  const [summary, setSummary] = useState<any>(null)
  const [categoryData, setCategoryData] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // 生成年份选项
  const yearOptions = [2024, 2025, 2026, 2027].map(y => ({ value: y, label: `${y}年` }))
  // 生成月份选项
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` }))

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const [summaryRes, categoryRes, trendRes] = await Promise.all([
        getMonthlySummary(year, month),
        getCategoryBreakdown(startDate, endDate, direction),
        getTrend(startDate, endDate, 'daily')
      ])

      setSummary(summaryRes)
      setCategoryData(categoryRes || [])
      setTrendData(trendRes || [])
    } catch (error: any) {
      console.error('加载分析数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [year, month, direction])

  useEffect(() => {
    loadData()
  }, [loadData])

  useDidShow(() => {
    loadData()
  })

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    Taro.showToast({ title: '刷新成功', icon: 'success', duration: 1000 })
  }, [loadData])

  // 获取分类图标
  const getCategoryIcon = (category: string) => {
    return CATEGORY_ICONS[category] || '📦'
  }

  // 计算分类百分比
  const getCategoryPercent = (amount: number) => {
    const total = categoryData.reduce((sum, item) => sum + item.amount, 0)
    if (total === 0) return 0
    return ((amount / total) * 100).toFixed(1)
  }

  // 饼图 SVG 路径计算
  const calculatePiePath = (startAngle: number, endAngle: number, radius: number, cx: number, cy: number) => {
    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle)
    const y2 = cy + radius * Math.sin(endAngle)
    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0
    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`
  }

  // 渲染饼图 - 使用 View 包裹 SVG 确保渲染
  const renderPieChart = () => {
    const total = categoryData.reduce((sum, item) => sum + item.amount, 0)
    if (total === 0) return null

    const radius = 120
    const cx = 150
    const cy = 150
    let currentAngle = -Math.PI / 2

    return (
      <View className='pie-chart'>
        <View style={{ width: '300rpx', height: '300rpx', margin: '0 auto' }}>
          <svg viewBox='0 0 300 300' style='width:100%;height:100%'>
            {categoryData.slice(0, 10).map((item, index) => {
              const percent = item.amount / total
              const sliceAngle = percent * 2 * Math.PI
              const path = calculatePiePath(currentAngle, currentAngle + sliceAngle, radius, cx, cy)
              currentAngle += sliceAngle

              return (
                <path
                  key={item.category}
                  d={path}
                  fill={COLORS[index % COLORS.length]}
                  stroke='#ffffff'
                  strokeWidth='2'
                />
              )
            })}
            <circle cx={cx} cy={cy} r='55' fill='#ffffff' />
            <text x={cx} y={cy - 5} textAnchor='middle' fontSize='14' fill='#8b7355'>{direction}总额</text>
            <text x={cx} y={cy + 14} textAnchor='middle' fontSize='20' fill='#2d241c' fontWeight='bold'>¥{total.toFixed(0)}</text>
          </svg>
        </View>

        {/* 图例 */}
        <View className='pie-legend'>
          {categoryData.slice(0, 6).map((item, index) => (
            <View key={item.category} className='legend-item'>
              <View className='legend-color' style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <Text>{item.category}</Text>
              <Text style={{ marginLeft: '8rpx', color: '#a89580' }}>{getCategoryPercent(item.amount)}%</Text>
            </View>
          ))}
        </View>
      </View>
    )
  }

  // 渲染柱状图
  const renderBarChart = () => {
    if (categoryData.length === 0) return null

    const maxAmount = Math.max(...categoryData.map(d => d.amount))
    if (maxAmount === 0) return null

    const chartHeight = 250
    const barWidth = 36
    const barGap = 12
    const chartWidth = categoryData.slice(0, 8).length * (barWidth + barGap) + barGap

    return (
      <View className='bar-chart'>
        <View style={{ width: `${chartWidth}rpx`, height: `${chartHeight + 40}rpx`, margin: '0 auto' }}>
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} style='width:100%;height:100%'>
            {categoryData.slice(0, 8).map((item, index) => {
              const barHeight = Math.max((item.amount / maxAmount) * chartHeight, 4)
              const x = barGap + index * (barWidth + barGap)
              const y = chartHeight - barHeight

              return (
                <g key={item.category}>
                  <rect x={x} y={y} width={barWidth} height={barHeight} fill={COLORS[index % COLORS.length]} rx='3' />
                  <text x={x + barWidth / 2} y={chartHeight + 15} textAnchor='middle' fontSize='12' fill='#8b7355'>
                    {item.category}
                  </text>
                  <text x={x + barWidth / 2} y={y - 5} textAnchor='middle' fontSize='11' fill='#2d241c'>
                    ¥{item.amount.toFixed(0)}
                  </text>
                </g>
              )
            })}
          </svg>
        </View>
      </View>
    )
  }

  // 渲染趋势图
  const renderTrendChart = () => {
    if (trendData.length === 0) return null

    const maxValue = Math.max(...trendData.map(d => Math.max(d.income, d.expense)))
    if (maxValue === 0) return null

    const width = 500
    const height = 280
    const padding = { top: 15, right: 15, bottom: 35, left: 45 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const xStep = chartWidth / Math.max(trendData.length - 1, 1)

    // 生成路径点
    const expensePoints = trendData.map((d, i) => ({
      x: padding.left + i * xStep,
      y: padding.top + chartHeight - (d.expense / maxValue) * chartHeight
    }))

    const incomePoints = trendData.map((d, i) => ({
      x: padding.left + i * xStep,
      y: padding.top + chartHeight - (d.income / maxValue) * chartHeight
    }))

    // 生成平滑曲线
    const pointsToSmoothPath = (points: { x: number; y: number }[]) => {
      if (points.length < 2) return ''
      let path = `M ${points[0].x} ${points[0].y}`
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]
        const curr = points[i]
        const cp1x = prev.x + (curr.x - prev.x) / 3
        const cp1y = prev.y
        const cp2x = curr.x - (curr.x - prev.x) / 3
        const cp2y = curr.y
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`
      }
      return path
    }

    return (
      <View className='trend-chart'>
        <View style={{ width: '100%', height: '280rpx' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style='width:100%;height:100%'>
            {/* 网格线 */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = padding.top + chartHeight * (1 - ratio)
              return (
                <g key={i}>
                  <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke='#f0ebe5' strokeWidth='1' />
                  <text x={padding.left - 5} y={y + 4} textAnchor='end' fontSize='12' fill='#a89580'>
                    {Math.round(maxValue * ratio)}
                  </text>
                </g>
              )
            })}

            {/* 支出线（红色） */}
            <path d={pointsToSmoothPath(expensePoints)} fill='none' stroke='#ef4444' strokeWidth='2' />

            {/* 收入线（绿色） */}
            <path d={pointsToSmoothPath(incomePoints)} fill='none' stroke='#10b981' strokeWidth='2' />

            {/* 数据点 */}
            {expensePoints.map((p, i) => (
              <g key={`expense-${i}`}>
                <circle cx={p.x} cy={p.y} r='3' fill='#ef4444' />
                {i % Math.ceil(trendData.length / 5) === 0 && (
                  <text x={p.x} y={height - padding.bottom + 18} textAnchor='middle' fontSize='10' fill='#a89580'>
                    {trendData[i]?.period?.slice(5) || ''}
                  </text>
                )}
              </g>
            ))}

            {/* 图例 */}
            <circle cx={width - 100} cy={10} r='3' fill='#ef4444' />
            <text x={width - 92} y={14} fontSize='12' fill='#8b7355'>支出</text>
            <circle cx={width - 50} cy={10} r='3' fill='#10b981' />
            <text x={width - 42} y={14} fontSize='12' fill='#8b7355'>收入</text>
          </svg>
        </View>
      </View>
    )
  }

  if (loading && !summary) {
    return (
      <View className='analysis-container'>
        <View className='page-header'>
          <Text className='page-title'>数据分析</Text>
          <Text className='page-subtitle'>智能分析您的收支情况</Text>
        </View>
        <View className='loading-container'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      className='analysis-container'
      scrollY
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={handleRefresh}
    >
      {/* 页面标题 */}
      <View className='page-header'>
        <Text className='page-title'>流水分析</Text>
        <Text className='page-subtitle'>{year}年{month}月</Text>
      </View>

      {/* 年份/月份选择器 */}
      <View className='date-selector'>
        <View className='selector-item'>
          <Text className='selector-label'>年份</Text>
          <Picker
            mode='selector'
            range={yearOptions}
            rangeKey='label'
            value={yearOptions.findIndex(y => y.value === year)}
            onChange={(e) => setYear(yearOptions[e.detail.value].value)}
          >
            <View className='selector-picker'>
              <Text>{year}年</Text>
              <Text className='selector-arrow'>▼</Text>
            </View>
          </Picker>
        </View>
        <View className='selector-item'>
          <Text className='selector-label'>月份</Text>
          <Picker
            mode='selector'
            range={monthOptions}
            rangeKey='label'
            value={month - 1}
            onChange={(e) => setMonth(Number(e.detail.value) + 1)}
          >
            <View className='selector-picker'>
              <Text>{month}月</Text>
              <Text className='selector-arrow'>▼</Text>
            </View>
          </Picker>
        </View>
      </View>

      {/* 收支方向切换 */}
      <View className='direction-tabs'>
        <View
          className={`direction-tab ${direction === '支出' ? 'active' : ''}`}
          onClick={() => setDirection('支出')}
        >
          <Text>支出分析</Text>
        </View>
        <View
          className={`direction-tab ${direction === '收入' ? 'active' : ''}`}
          onClick={() => setDirection('收入')}
        >
          <Text>收入分析</Text>
        </View>
      </View>

      {/* 统计卡片 */}
      {summary && (
        <View className='stats-card'>
          <Text className='stats-title'>{month}月收支概况</Text>
          <View className='stats-row'>
            <View className='stats-item'>
              <Text className='stats-label'>收入</Text>
              <Text className='stats-value income'>¥{summary.income.toFixed(0)}</Text>
            </View>
            <View className='stats-divider' />
            <View className='stats-item'>
              <Text className='stats-label'>支出</Text>
              <Text className='stats-value expense'>¥{summary.expense.toFixed(0)}</Text>
            </View>
            <View className='stats-divider' />
            <View className='stats-item'>
              <Text className='stats-label'>结余</Text>
              <Text className={`stats-value ${summary.net >= 0 ? 'balance' : 'expense'}`}>
                ¥{summary.net.toFixed(0)}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: '16rpx', textAlign: 'center' }}>
            <Text style={{ fontSize: '22rpx', opacity: 0.7 }}>共 {summary.transaction_count} 笔交易</Text>
          </View>
        </View>
      )}

      {/* 分类图表（饼图/柱状图切换） */}
      <View className='chart-section'>
        <View className='chart-header'>
          <Text className='chart-title'>{month}月分类{direction}</Text>
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
              <Text>柱状</Text>
            </View>
          </View>
        </View>
        {categoryData.length > 0 ? (
          chartType === 'pie' ? renderPieChart() : renderBarChart()
        ) : (
          <View className='empty-state'>
            <Text className='empty-icon'>📊</Text>
            <Text className='empty-text'>暂无数据</Text>
          </View>
        )}
      </View>

      {/* 趋势图 */}
      <View className='chart-section'>
        <Text className='chart-title'>收支趋势</Text>
        {trendData.length > 0 ? (
          renderTrendChart()
        ) : (
          <View className='empty-state'>
            <Text className='empty-icon'>📈</Text>
            <Text className='empty-text'>暂无趋势数据</Text>
          </View>
        )}
      </View>

      {/* 分类排行 */}
      {categoryData.length > 0 && (
        <View className='category-rank'>
          <Text className='chart-title'>分类排行</Text>
          {categoryData.slice(0, 8).map((item, index) => (
            <View key={item.category} className='rank-item'>
              <View className='rank-info'>
                <View className='rank-icon'>
                  <Text>{getCategoryIcon(item.category)}</Text>
                </View>
                <Text className='rank-name'>{item.category}</Text>
              </View>
              <View className='rank-bar'>
                <View
                  className='rank-bar-fill'
                  style={{
                    width: `${getCategoryPercent(item.amount)}%`,
                    backgroundColor: COLORS[index % COLORS.length]
                  }}
                />
              </View>
              <Text className='rank-amount'>¥{item.amount.toFixed(0)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

export default AnalysisPage
