import Taro from '@tarojs/taro'

const BASE_URL = 'http://localhost:8000/api/v1'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
}

export async function request<T = any>(options: RequestOptions): Promise<T> {
  const token = Taro.getStorageSync('token')
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.header
  }
  if (token) {
    header['Authorization'] = `Bearer ${token}`
  }

  const res = await Taro.request({
    url: `${BASE_URL}${options.url}`,
    method: options.method || 'GET',
    data: options.data,
    header
  })

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as T
  }
  throw new Error(res.data?.detail || '请求失败')
}

// ========== 认证相关 ==========

export async function login(username: string, password: string) {
  return request<{ access_token: string; token_type: string }>({
    url: '/auth/login',
    method: 'POST',
    data: { username, password }
  })
}

export async function wechatLogin(code: string) {
  return request<{ access_token: string; token_type: string; is_new_user: boolean }>({
    url: '/wechat/login/code',
    method: 'POST',
    data: { code }
  })
}

// ========== 账单相关 ==========

export async function getBills(params?: { skip?: number; limit?: number; order?: string }) {
  const query = new URLSearchParams()
  if (params?.skip !== undefined) query.set('skip', String(params.skip))
  if (params?.limit !== undefined) query.set('limit', String(params.limit))
  if (params?.order) query.set('order', params.order)
  return request<any[]>({ url: `/bills/?${query.toString()}` })
}

export async function createBill(data: {
  amount: number
  category: string
  note?: string
  transaction_date?: string
  direction?: string
}) {
  return request<any>({ url: '/bills/', method: 'POST', data })
}

export async function deleteBill(id: number) {
  return request<any>({ url: `/bills/${id}`, method: 'DELETE' })
}

export async function getBillById(id: number) {
  return request<any>({ url: `/bills/${id}` })
}

export async function updateBill(id: number, data: {
  amount?: number
  category?: string
  note?: string
  transaction_date?: string
  direction?: string
}) {
  return request<any>({ url: `/bills/${id}`, method: 'PUT', data })
}

export async function searchBills(params?: {
  keyword?: string
  start_date?: string
  end_date?: string
  category?: string
  skip?: number
  limit?: number
}) {
  const query = new URLSearchParams()
  if (params?.keyword) query.set('keyword', params.keyword)
  if (params?.start_date) query.set('start_date', params.start_date)
  if (params?.end_date) query.set('end_date', params.end_date)
  if (params?.category) query.set('category', params.category)
  if (params?.skip !== undefined) query.set('skip', String(params.skip))
  if (params?.limit !== undefined) query.set('limit', String(params.limit))
  return request<any[]>({ url: `/bills/search?${query.toString()}` })
}

// ========== 统计相关 ==========

export async function getMonthlySummary(year: number, month: number) {
  return request<{
    year: number
    month: number
    income: number
    expense: number
    net: number
    transaction_count: number
  }>({ url: `/statistics/monthly-summary?year=${year}&month=${month}` })
}

export async function getCategoryBreakdown(start_date?: string, end_date?: string, direction?: string) {
  const query = new URLSearchParams()
  if (start_date) query.set('start_date', start_date)
  if (end_date) query.set('end_date', end_date)
  if (direction) query.set('direction', direction)
  return request<any[]>({ url: `/statistics/by-category?${query.toString()}` })
}

export async function getTrend(start_date: string, end_date: string, granularity: string) {
  return request<any[]>({ url: `/statistics/trend?start_date=${start_date}&end_date=${end_date}&granularity=${granularity}` })
}

export default {
  login,
  wechatLogin,
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
  searchBills,
  getMonthlySummary,
  getCategoryBreakdown,
  getTrend
}
