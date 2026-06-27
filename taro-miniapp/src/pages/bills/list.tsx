import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getBills, deleteBill, searchBills } from '../../shared/api/client'
import './list.css'

const BillsListPage: React.FC = () => {
  const [bills, setBills] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterVisible, setFilterVisible] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterDirection, setFilterDirection] = useState('')
  const [editingBillId, setEditingBillId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})

  // 分类列表
  const categories = [
    '餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育',
    '工资', '转账', '超市', '日用', '水果', '零食', '运动',
    '通讯', '服饰', '彩妆', '住房', '居家', '孩子', '长辈',
    '社交', '旅行', '烟酒', '数码', '汽车', '书籍', '学习',
    '宠物', '礼金', '礼物', '办公', '维修', '捐赠', '彩票', '其他'
  ]

  // 加载账单列表
  const fetchBills = useCallback(async (reset = false) => {
    setIsLoading(true)
    setError('')
    try {
      const skip = reset ? 0 : (page - 1) * 20
      let data: any[]

      // 如果有搜索关键词或筛选条件，使用搜索接口
      if (searchKeyword || filterCategory || filterDate || filterDirection) {
        // 日期筛选精确到天
        let startDate = ''
        let endDate = ''
        if (filterDate) {
          startDate = filterDate
          endDate = filterDate
        }

        data = await searchBills({
          keyword: searchKeyword,
          start_date: startDate,
          end_date: endDate,
          category: filterCategory,
          skip,
          limit: 20
        })
      } else {
        data = await getBills({ skip, limit: 20, order: 'desc' })
      }

      if (reset) {
        setBills(data)
        setPage(2)
      } else {
        setBills(prev => [...prev, ...data])
        setPage(prev => prev + 1)
      }
      setHasMore(data.length === 20)
    } catch (err: any) {
      setError(err?.message || '获取账单失败')
    } finally {
      setIsLoading(false)
    }
  }, [page, searchKeyword, filterCategory, filterDate, filterDirection])

  useEffect(() => {
    fetchBills(true)
  }, [])

  useDidShow(() => {
    fetchBills(true)
  })

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchBills(true)
    setRefreshing(false)
    Taro.showToast({ title: '刷新成功', icon: 'success', duration: 1000 })
  }, [fetchBills])

  const handleLoadMore = useCallback(async () => {
    if (isLoading || !hasMore) return
    await fetchBills()
  }, [isLoading, hasMore, fetchBills])

  const handleDelete = useCallback(async (id: number) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这条账单吗？删除后不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            await deleteBill(id)
            setBills(prev => prev.filter(b => b.id !== id))
            Taro.showToast({ title: '删除成功', icon: 'success' })
          } catch (e) {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }, [])

  const handleViewBill = useCallback((id: number) => {
    Taro.navigateTo({ url: `/pages/bills/detail?id=${id}` })
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
    setFilterDate('')
    setFilterDirection('')
    setFilterVisible(false)
    fetchBills(true)
  }, [fetchBills])

  const handleClearAll = useCallback(() => {
    setSearchKeyword('')
    setFilterCategory('')
    setFilterDate('')
    setFilterDirection('')
    setFilterVisible(false)
    fetchBills(true)
  }, [fetchBills])

  const startEdit = useCallback((bill: any) => {
    setEditingBillId(bill.id)
    setEditForm({
      amount: String(bill.amount),
      category: bill.category || '',
      payee: bill.payee || '',
      description: bill.description || '',
      transaction_date: (bill.transaction_date || bill.created_at || '').slice(0, 10)
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingBillId(null)
    setEditForm({})
  }, [])

  const handleUpdate = useCallback(async () => {
    if (editingBillId == null) return
    try {
      const { updateBill } = require('../../shared/api/client')
      await updateBill(editingBillId, {
        amount: Number(editForm.amount),
        category: editForm.category,
        payee: editForm.payee,
        description: editForm.description,
        transaction_date: editForm.transaction_date ? new Date(editForm.transaction_date).toISOString() : undefined
      })
      cancelEdit()
      fetchBills(true)
      Taro.showToast({ title: '修改成功', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: '修改失败', icon: 'none' })
    }
  }, [editingBillId, editForm, fetchBills, cancelEdit])

  // 按日期分组
  const groupedBills = bills.reduce((groups: any, bill: any) => {
    const date = (bill.transaction_date || bill.created_at || '').slice(0, 10)
    if (!groups[date]) {
      groups[date] = { date, bills: [], income: 0, expense: 0 }
    }
    groups[date].bills.push(bill)
    if (bill.direction === '收入') {
      groups[date].income += bill.amount
    } else {
      groups[date].expense += bill.amount
    }
    return groups
  }, {})

  const groupList = Object.values(groupedBills).sort((a: any, b: any) =>
    b.date.localeCompare(a.date)
  )

  const totalIncome = bills.reduce((sum, b) => b.direction === '收入' ? sum + b.amount : sum, 0)
  const totalExpense = bills.reduce((sum, b) => b.direction === '支出' ? sum + b.amount : sum, 0)
  const hasFilters = searchKeyword || filterCategory || filterDate || filterDirection

  if (error && bills.length === 0) {
    return (
      <View className='bills-container'>
        <View className='error-state'>
          <Text>{error}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='bills-container'>
      {/* 顶部统计 */}
      <View className='summary-card'>
        <View className='summary-info'>
          <Text className='summary-text'>{bills.length} 笔 · {groupList.length} 天</Text>
          <Text className='summary-subtext'>
            收 ¥{totalIncome.toFixed(0)} / 支 ¥{totalExpense.toFixed(0)}
          </Text>
        </View>
        <Text className='summary-amount'>¥{totalExpense.toFixed(0)}</Text>
      </View>

      {/* 搜索栏 */}
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
              <Text>×</Text>
            </View>
          )}
        </View>
        <View
          className={`filter-btn ${filterVisible ? 'active' : ''}`}
          onClick={() => setFilterVisible(!filterVisible)}
        >
          <Text>筛选</Text>
        </View>
      </View>

      {/* 筛选面板 */}
      {filterVisible && (
        <View className='filter-panel'>
          {/* 全局搜索说明 */}
          <View className='search-hint'>
            <Text className='search-hint-text'>💡 搜索关键词会匹配商户、描述、分类等字段</Text>
          </View>

          {/* 分类选择 */}
          <View className='filter-row'>
            <Text className='filter-label'>分类</Text>
            <View className='filter-category-list'>
              <View
                className={`cat-btn ${filterCategory === '' ? 'active' : ''}`}
                onClick={() => setFilterCategory('')}
              >
                <Text>全部</Text>
              </View>
              {categories.slice(0, 8).map(cat => (
                <View
                  key={cat}
                  className={`cat-btn ${filterCategory === cat ? 'active' : ''}`}
                  onClick={() => setFilterCategory(cat)}
                >
                  <Text>{cat}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 日期选择 - 精确到天 */}
          <View className='filter-row'>
            <Text className='filter-label'>日期</Text>
            <Input
              className='date-input'
              type='text'
              value={filterDate}
              onInput={(e) => setFilterDate(e.detail.value)}
              placeholder='YYYY-MM-DD'
            />
          </View>

          {/* 类型选择 */}
          <View className='filter-row'>
            <Text className='filter-label'>类型</Text>
            <View className='filter-direction'>
              <View
                className={`dir-btn ${filterDirection === '' ? 'active' : ''}`}
                onClick={() => setFilterDirection('')}
              >
                <Text>全部</Text>
              </View>
              <View
                className={`dir-btn ${filterDirection === '支出' ? 'active' : ''}`}
                onClick={() => setFilterDirection('支出')}
              >
                <Text>支出</Text>
              </View>
              <View
                className={`dir-btn ${filterDirection === '收入' ? 'active' : ''}`}
                onClick={() => setFilterDirection('收入')}
              >
                <Text>收入</Text>
              </View>
            </View>
          </View>

          {/* 操作按钮 */}
          <View className='filter-actions'>
            <View className='filter-clear' onClick={handleClearAll}>
              <Text>清除全部</Text>
            </View>
            <View className='filter-reset' onClick={handleResetFilter}>
              <Text>重置</Text>
            </View>
            <View className='filter-apply' onClick={handleApplyFilter}>
              <Text>应用</Text>
            </View>
          </View>
        </View>
      )}

      {/* 账单列表 */}
      <ScrollView
        className='bills-scroll'
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={handleRefresh}
        onScrollToLower={handleLoadMore}
      >
        {/* 表头 */}
        <View className='bill-table-header'>
          <Text className='header-date'>日期</Text>
          <Text className='header-category'>分类</Text>
          <Text className='header-payee'>商户</Text>
          <Text className='header-desc'>描述</Text>
          <Text className='header-amount'>金额</Text>
          <Text className='header-action'>操作</Text>
        </View>

        {groupList.map((group: any) => (
          <View key={group.date} className='bill-group'>
            <View className='group-header'>
              <Text className='group-date'>{group.date}</Text>
              <Text className='group-summary'>
                收 {group.income.toFixed(0)} / 支 {group.expense.toFixed(0)}
              </Text>
            </View>
            {group.bills.map((bill: any) => (
              <View key={bill.id} className='bill-item-container'>
                {editingBillId === bill.id ? (
                  <View className='bill-edit-row'>
                    <Input className='edit-input edit-date' type='text' value={editForm.transaction_date || ''} onInput={(e) => setEditForm({ ...editForm, transaction_date: e.detail.value })} placeholder='日期' />
                    <Input className='edit-input edit-category' type='text' value={editForm.category || ''} onInput={(e) => setEditForm({ ...editForm, category: e.detail.value })} placeholder='分类' />
                    <Input className='edit-input edit-payee' type='text' value={editForm.payee || ''} onInput={(e) => setEditForm({ ...editForm, payee: e.detail.value })} placeholder='商户' />
                    <Input className='edit-input edit-amount' type='digit' value={editForm.amount || ''} onInput={(e) => setEditForm({ ...editForm, amount: e.detail.value })} placeholder='金额' />
                    <View className='edit-actions'>
                      <View className='edit-save' onClick={handleUpdate}><Text>✓</Text></View>
                      <View className='edit-cancel' onClick={cancelEdit}><Text>✕</Text></View>
                    </View>
                  </View>
                ) : (
                  <View className='bill-item' onClick={() => handleViewBill(bill.id)}>
                    <Text className='bill-date'>{(bill.transaction_date || bill.created_at || '').slice(5, 10)}</Text>
                    <View className='bill-category-wrapper'>
                      <Text className='bill-category'>{bill.category || '未分类'}</Text>
                    </View>
                    <Text className='bill-payee'>{bill.payee || '-'}</Text>
                    <Text className='bill-desc'>{bill.description || bill.note || '-'}</Text>
                    <Text className={`bill-amount ${bill.direction === '收入' ? 'in' : 'out'}`}>
                      {bill.direction === '收入' ? '+' : '-'}{bill.amount.toFixed(2)}
                    </Text>
                    <View className='bill-actions'>
                      <View className='bill-edit-btn' onClick={(e) => { e.stopPropagation(); startEdit(bill) }}><Text>✏️</Text></View>
                      <View className='bill-delete-btn' onClick={(e) => { e.stopPropagation(); handleDelete(bill.id) }}><Text>🗑️</Text></View>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}

        {isLoading && bills.length > 0 && (
          <View className='loading-more'><Text>加载中...</Text></View>
        )}

        {!isLoading && bills.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-icon'>📋</Text>
            <Text className='empty-text'>{hasFilters ? '没有找到匹配的账单' : '暂无账单'}</Text>
            <Text className='empty-hint'>{hasFilters ? '尝试调整筛选条件' : '点击下方按钮开始记账'}</Text>
          </View>
        )}

        {/* 手动记账按钮 - 放在列表底部 */}
        <View className='add-bill-footer'>
          <Button className='add-bill-btn' onClick={handleAdd}>
            <Text className='add-bill-icon'>+</Text>
            <Text className='add-bill-text'>手动记账</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  )
}

export default BillsListPage
