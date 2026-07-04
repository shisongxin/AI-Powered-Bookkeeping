/**
 * 账单明细页面 — 对齐网页端 Bills.tsx
 * 功能：按月分组展示、搜索、筛选（分类/日期/类型）、行内编辑、删除、分页加载
 * 分类筛选使用 API 动态获取，与网页端保持一致
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, ScrollView, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getBills, searchBills, getMonthlySummary, getCategories } from '../../shared/api/client'
import { useDataStore } from '../../shared/stores/useDataStore'
import './list.css'

interface Bill {
  id: number
  amount: number
  category?: string
  payee?: string
  description?: string
  note?: string
  transaction_date?: string
  created_at?: string
  direction?: string
}

interface MonthGroup {
  month: string
  label: string
  bills: Bill[]
  income: number
  expense: number
  balance: number
}

const PAGE_SIZE = 20

/** 分类筛选 — 优先使用 API 动态获取，失败时使用默认分类 */
const FALLBACK_CATEGORIES = ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '工资', '转账', '其他']

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

const BillsListPage: React.FC = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const [bills, setBills] = useState<Bill[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterVisible, setFilterVisible] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [filterDirection, setFilterDirection] = useState('')
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [animatingGroups, setAnimatingGroups] = useState<Set<string>>(new Set())
  const [monthlySummary, setMonthlySummary] = useState<{ income: number; expense: number; net: number; transaction_count: number } | null>(null)
  const [dynamicCategories, setDynamicCategories] = useState<string[]>(FALLBACK_CATEGORIES)
  const billsVersion = useDataStore((s) => s.billsVersion)

  // ─── Fetch monthly summary ───
  const fetchMonthlySummary = useCallback(async () => {
    try {
      const summary = await getMonthlySummary(year, month)
      setMonthlySummary({
        income: summary.income,
        expense: summary.expense,
        net: summary.net,
        transaction_count: summary.transaction_count
      })
    } catch (e) {
      console.error('加载月度汇总失败:', e)
    }
  }, [year, month])

  useEffect(() => {
    fetchMonthlySummary()
  }, [fetchMonthlySummary])

  // ─── Compute month groups ───
  // 使用与后端一致的逻辑：direction === "收入" 为收入，direction === "支出" 为支出
  const monthGroups = useMemo<MonthGroup[]>(() => {
    const groups: Record<string, MonthGroup> = {}
    for (const b of bills) {
      const rawDate = b.transaction_date || b.created_at || ''
      const m = rawDate.slice(0, 7) // YYYY-MM
      if (!m || m.length < 7) continue
      if (!groups[m]) {
        const [y, mo] = m.split('-')
        const monthIndex = parseInt(mo, 10) - 1
        groups[m] = {
          month: m,
          label: `${y}年${MONTH_NAMES[monthIndex] || mo + '月'}`,
          bills: [],
          income: 0,
          expense: 0,
          balance: 0
        }
      }
      groups[m].bills.push(b)
      // 使用 direction 字段判断收支（与后端 monthly_summary 一致）
      if (b.direction === '收入') {
        groups[m].income += Math.abs(b.amount)
      } else if (b.direction === '支出') {
        groups[m].expense += Math.abs(b.amount)
      } else {
        // 降级：对于没有 direction 的旧数据，使用 amount 符号
        if (b.amount > 0) {
          groups[m].income += Math.abs(b.amount)
        } else {
          groups[m].expense += Math.abs(b.amount)
        }
      }
      groups[m].balance = groups[m].income - groups[m].expense
    }
    return Object.values(groups).sort((a, b) => b.month.localeCompare(a.month))
  }, [bills])

  // Auto-expand current month on load
  useEffect(() => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setExpandedMonths(prev => {
      const next = new Set(prev)
      next.add(currentMonth)
      return next
    })
  }, [])

  // ─── Summary stats ───
  const totalIncome = useMemo(() => monthGroups.reduce((s, g) => s + g.income, 0), [monthGroups])
  const totalExpense = useMemo(() => monthGroups.reduce((s, g) => s + g.expense, 0), [monthGroups])
  const netAmount = totalIncome - totalExpense
  const totalDays = useMemo(() => {
    const dates = new Set(bills.map(b => (b.transaction_date || b.created_at || '').slice(0, 10)))
    return dates.size
  }, [bills])

  const hasFilters = !!(searchKeyword || filterCategory || filterStartDate || filterEndDate || filterDirection)

  // ─── Fetch bills ───
  const fetchBills = useCallback(async (reset = false) => {
    if (reset) {
      setIsLoading(true)
      setError('')
    } else {
      setIsLoadingMore(true)
    }
    try {
      const skip = reset ? 0 : (page - 1) * PAGE_SIZE
      let data: Bill[]

      if (searchKeyword || filterCategory || filterStartDate || filterEndDate || filterDirection) {
        data = await searchBills({
          keyword: searchKeyword,
          start_date: filterStartDate,
          end_date: filterEndDate,
          category: filterCategory,
          skip,
          limit: PAGE_SIZE
        })
      } else {
        data = await getBills({ skip, limit: PAGE_SIZE, order: 'desc' })
      }

      if (reset) {
        setBills(data)
        setPage(2)
      } else {
        setBills(prev => {
          // Deduplicate by id
          const existingIds = new Set(prev.map(b => b.id))
          const newItems = data.filter(b => !existingIds.has(b.id))
          return [...prev, ...newItems]
        })
        setPage(prev => prev + 1)
      }
      setHasMore(data.length === PAGE_SIZE)
    } catch (err: any) {
      setError(err?.message || '获取账单失败')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [page, searchKeyword, filterCategory, filterStartDate, filterEndDate, filterDirection])

  /** 加载动态分类列表 — 与网页端对齐 */
  useEffect(() => {
    getCategories()
      .then(cats => {
        if (cats && cats.length > 0) {
          setDynamicCategories(cats.map((c: any) => c.name))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchBills(true)
  }, [])

  // 只在 billsVersion 变化或首次加载时刷新，避免频繁切换页面时重复请求
  const lastBillsVersionRef = useRef(billsVersion)
  useDidShow(() => {
    if (lastBillsVersionRef.current !== billsVersion) {
      lastBillsVersionRef.current = billsVersion
      fetchBills(true)
      fetchMonthlySummary()
    }
  })

  // ─── Handlers ───
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchBills(true)
    setRefreshing(false)
    Taro.showToast({ title: '刷新成功', icon: 'success', duration: 1000 })
  }, [fetchBills])

  const handleLoadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return
    await fetchBills()
  }, [isLoading, isLoadingMore, hasMore, fetchBills])

  const handleViewBill = useCallback((id: number) => {
    Taro.navigateTo({ url: `/pages/bills/detail/index?id=${id}` })
  }, [])

  const handleAdd = useCallback(() => {
    Taro.navigateTo({ url: '/pages/bills/add' })
  }, [])

  const handleSearch = useCallback((e: any) => {
    setSearchKeyword(e.detail.value)
  }, [])

  const handleSearchSubmit = useCallback(() => {
    fetchBills(true)
  }, [fetchBills])

  const handleSearchReset = useCallback(() => {
    setSearchKeyword('')
    fetchBills(true)
  }, [fetchBills])

  const handleApplyFilter = useCallback(() => {
    setFilterVisible(false)
    fetchBills(true)
  }, [fetchBills])

  const handleResetFilter = useCallback(() => {
    setFilterCategory('')
    setFilterStartDate('')
    setFilterEndDate('')
    setFilterDirection('')
  }, [])

  const handleClearAll = useCallback(() => {
    setSearchKeyword('')
    setFilterCategory('')
    setFilterStartDate('')
    setFilterEndDate('')
    setFilterDirection('')
    setFilterVisible(false)
    fetchBills(true)
  }, [fetchBills])

  // ─── Month expand/collapse ───
  const toggleMonth = useCallback((month: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(month)) {
        next.delete(month)
      } else {
        next.add(month)
      }
      return next
    })
  }, [])

  // ─── Staggered animation on month groups ───
  const handleGroupAnimationEnd = useCallback((month: string) => {
    setAnimatingGroups(prev => {
      const next = new Set(prev)
      next.delete(month)
      return next
    })
  }, [])

  // ─── Error state ───
  if (error && bills.length === 0) {
    return (
      <View className='bills-container'>
        <View className='error-state'>
          <Text className='error-icon'>⚠️</Text>
          <Text className='error-text'>{error}</Text>
          <Button className='btn-primary retry-btn' onClick={() => fetchBills(true)}>重新加载</Button>
        </View>
      </View>
    )
  }

  return (
    <View className='bills-container'>
      {/* ─── Summary Card (dark gradient) ─── */}
      <View className='summary-card'>
        <View className='summary-top'>
          <Text className='summary-title'>账单总览</Text>
          <Text className='summary-count'>{`${year}-${String(month).padStart(2, '0')}`}共{monthlySummary?.transaction_count ?? bills.length}笔</Text>
        </View>
        <View className='summary-stats'>
          <View className='stat-item'>
            <Text className='stat-label'>收入</Text>
            <Text className='stat-value income'>¥{(monthlySummary?.income ?? totalIncome).toFixed(2)}</Text>
          </View>
          <View className='stat-divider' />
          <View className='stat-item'>
            <Text className='stat-label'>支出</Text>
            <Text className='stat-value expense'>¥{(monthlySummary?.expense ?? totalExpense).toFixed(2)}</Text>
          </View>
          <View className='stat-divider' />
        </View>
        <View className='summary-net'>
          <Text className='summary-net-label'>结余</Text>
          <Text className={`summary-net-amount ${((monthlySummary?.net ?? 0) >= 0) ? 'net-positive' : 'net-negative'}`}>
            {((monthlySummary?.net ?? 0) >= 0) ? '+' : ''}¥{(monthlySummary?.net ?? 0).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* ─── Search Bar ─── */}
      <View className='search-bar'>
        <View className='search-input-wrapper'>
          <Text className='search-icon'>🔍</Text>
          <Input
            className='search-input'
            type='text'
            value={searchKeyword}
            onInput={handleSearch}
            onConfirm={handleSearchSubmit}
            placeholder='搜索商户、描述、分类...'
            confirmType='search'
          />
          {searchKeyword && (
            <View className='search-clear' onClick={handleSearchReset}>
              <Text className='search-clear-text'>✕</Text>
            </View>
          )}
        </View>
        <View
          className={`filter-toggle-btn ${filterVisible ? 'active' : ''} ${hasFilters ? 'has-filters' : ''}`}
          onClick={() => setFilterVisible(!filterVisible)}
        >
          <Text className='filter-toggle-text'>{filterVisible ? '收起' : '筛选'}</Text>
          {hasFilters && <View className='filter-dot' />}
        </View>
      </View>

      {/* ─── Filter Panel (collapsible) ─── */}
      {filterVisible && (
        <View className='filter-panel animate-scale-in'>
          <View className='filter-panel-inner'>
            {/* Category chips */}
            <View className='filter-section'>
              <Text className='filter-section-label'>分类</Text>
              <View className='filter-category-list'>
                <View
                  className={`cat-chip ${filterCategory === '' ? 'active' : ''}`}
                  onClick={() => setFilterCategory('')}
                >
                  <Text className='cat-chip-text'>全部</Text>
                </View>
                {dynamicCategories.map((cat: string) => (
                  <View
                    key={cat}
                    className={`cat-chip ${filterCategory === cat ? 'active' : ''}`}
                    onClick={() => setFilterCategory(cat)}
                  >
                    <Text className='cat-chip-text'>{cat}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Date range */}
            <View className='filter-section'>
              <Text className='filter-section-label'>日期范围</Text>
              <View className='filter-date-row'>
                <Input
                  className='filter-date-input'
                  type='text'
                  value={filterStartDate}
                  onInput={(e) => setFilterStartDate(e.detail.value)}
                  placeholder='开始 YYYY-MM-DD'
                />
                <Text className='filter-date-sep'>至</Text>
                <Input
                  className='filter-date-input'
                  type='text'
                  value={filterEndDate}
                  onInput={(e) => setFilterEndDate(e.detail.value)}
                  placeholder='结束 YYYY-MM-DD'
                />
              </View>
            </View>

            {/* Direction */}
            <View className='filter-section'>
              <Text className='filter-section-label'>类型</Text>
              <View className='filter-direction'>
                <View
                  className={`dir-btn ${filterDirection === '' ? 'active' : ''}`}
                  onClick={() => setFilterDirection('')}
                >
                  <Text className='dir-btn-text'>全部</Text>
                </View>
                <View
                  className={`dir-btn ${filterDirection === '支出' ? 'active' : ''}`}
                  onClick={() => setFilterDirection('支出')}
                >
                  <Text className='dir-btn-text'>支出</Text>
                </View>
                <View
                  className={`dir-btn ${filterDirection === '收入' ? 'active' : ''}`}
                  onClick={() => setFilterDirection('收入')}
                >
                  <Text className='dir-btn-text'>收入</Text>
                </View>
              </View>
            </View>

            {/* Action buttons */}
            <View className='filter-actions'>
              <View className='filter-action-btn clear' onClick={handleClearAll}>
                <Text className='filter-action-text'>清除全部</Text>
              </View>
              <View className='filter-action-btn reset' onClick={handleResetFilter}>
                <Text className='filter-action-text'>重置</Text>
              </View>
              <View className='filter-action-btn apply' onClick={handleApplyFilter}>
                <Text className='filter-action-text apply-text'>应用筛选</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ─── Bills Scroll ─── */}
      {/* scroll-view 在 webview 模式下不支持 padding，用 wrapper View 替代 */}
      <ScrollView
        className='bills-scroll'
        scrollY
        enhanced
        showScrollbar={false}
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={handleRefresh}
        onScrollToLower={handleLoadMore}
        lowerThreshold={200}
      >
        <View style={{ padding: '16rpx 24rpx' }}>
        {/* Loading skeleton */}
        {isLoading && bills.length === 0 && (
          <View className='skeleton-container'>
            {[1, 2, 3].map(i => (
              <View key={i} className='skeleton-group'>
                <View className='skeleton-group-header' />
                <View className='skeleton-row' />
                <View className='skeleton-row' />
              </View>
            ))}
          </View>
        )}

        {/* Month groups */}
        {monthGroups.map((group, groupIndex) => {
          const isExpanded = expandedMonths.has(group.month)
          const isAnimating = animatingGroups.has(group.month)
          return (
            <View
              key={group.month}
              className={`month-group ${isAnimating ? 'animate-slide-up' : ''}`}
              style={{ animationDelay: `${groupIndex * 0.05}s` }}
              onAnimationEnd={() => handleGroupAnimationEnd(group.month)}
            >
              {/* Month header */}
              <View className='month-header' onClick={() => toggleMonth(group.month)}>
                <View className='month-header-left'>
                  <Text className={`month-chevron ${isExpanded ? 'expanded' : ''}`}>▶</Text>
                  <Text className='month-label'>{group.label}</Text>
                  <Text className='month-count-badge'>{group.bills.length} 笔</Text>
                </View>
                <View className='month-header-right'>
                  <View className='month-stat'>
                    <Text className='month-stat-label'>收</Text>
                    <Text className='month-stat-value income'>{group.income.toFixed(0)}</Text>
                  </View>
                  <View className='month-stat'>
                    <Text className='month-stat-label'>支</Text>
                    <Text className='month-stat-value expense'>{group.expense.toFixed(0)}</Text>
                  </View>
                  <View className='month-stat'>
                    <Text className='month-stat-label'>结</Text>
                    <Text className={`month-stat-value ${group.balance >= 0 ? 'net-positive' : 'net-negative'}`}>
                      {group.balance >= 0 ? '+' : ''}{group.balance.toFixed(0)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Expanded bill rows */}
              {isExpanded && (
                <View className='month-bills animate-fade-in'>
                  {group.bills.map((bill, billIndex) => {
                    // 使用与后端一致的逻辑：direction === "收入" 为收入
                    const isIncome = bill.direction === '收入' || (!bill.direction && bill.amount > 0)
                    const amountColor = isIncome ? 'income' : 'expense'
                    // 只显示月-日，年月已在月份组头部展示
                    const displayDate = (bill.transaction_date || bill.created_at || '').slice(5, 10)

                    return (
                      <View
                        key={bill.id}
                        className={`bill-row ${billIndex % 2 === 0 ? 'even' : 'odd'}`}
                        onClick={() => handleViewBill(bill.id)}
                      >
                        <View className='bill-cell date-cell'>
                          <Text className='bill-date-main'>{displayDate}</Text>
                        </View>
                        <View className='bill-cell category-cell'>
                          <Text className='bill-category-tag'>{bill.category || '其他'}</Text>
                        </View>
                        <View className='bill-cell desc-cell'>
                          <Text className='bill-desc-text' numberOfLines={1}>{bill.description || bill.note || '-'}</Text>
                        </View>
                        <View className={`bill-cell amount-cell ${amountColor}`}>
                          <Text className='bill-amount-text'>
                            {isIncome ? '+' : '-'}{Math.abs(bill.amount).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )
        })}

        {/* Loading more indicator */}
        {isLoadingMore && (
          <View className='loading-more'>
            <View className='loading-spinner' />
            <Text className='loading-text'>加载更多...</Text>
          </View>
        )}

        {/* No more data */}
        {!hasMore && bills.length > 0 && (
          <View className='no-more'>
            <Text className='no-more-text'>— 已加载全部 {bills.length} 条 —</Text>
          </View>
        )}

        {/* Empty state */}
        {!isLoading && bills.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-icon'>📋</Text>
            <Text className='empty-title'>{hasFilters ? '没有找到匹配的账单' : '暂无账单记录'}</Text>
            <Text className='empty-hint'>{hasFilters ? '尝试调整筛选条件' : '点击下方按钮开始记账'}</Text>
            {!hasFilters && (
              <Button className='btn-primary empty-add-btn' onClick={handleAdd}>
                + 手动记账
              </Button>
            )}
          </View>
        )}

        {/* Bottom safe area spacer */}
        <View className='scroll-bottom-spacer' />
        </View>
      </ScrollView>

      {/* ─── Floating Add Button ─── */}
      <View className='floating-add-btn-wrapper safe-area-bottom' onClick={handleAdd}>
        <View className='floating-add-btn'>
          <Text className='floating-add-icon'>+</Text>
          <Text className='floating-add-text'>手动记账</Text>
        </View>
      </View>
    </View>
  )
}

export default BillsListPage
