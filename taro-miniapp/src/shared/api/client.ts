/**
 * 小程序 API 客户端
 * 统一封装所有后端接口调用，自动附加 JWT Token
 * 与网页端共享同一套后端 API，保证数据一致性
 */
import Taro from '@tarojs/taro'

const BASE_URL = 'http://localhost:8000/api/v1'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
}

/**
 * 通用请求方法 — 自动附加 Token，统一错误处理
 */
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
  // 序列化错误信息：detail 可能是字符串、对象或数组
  const detail = res.data?.detail
  let message = '请求失败'
  if (typeof detail === 'string') {
    message = detail
  } else if (Array.isArray(detail)) {
    message = detail.map((d: any) => d?.msg || d?.detail || JSON.stringify(d)).join('; ')
  } else if (detail && typeof detail === 'object') {
    message = detail.msg || detail.message || JSON.stringify(detail)
  }
  throw new Error(message)
}

// ========== 认证相关 ==========

/** 账号密码登录 */
export async function login(username: string, password: string) {
  return request<{ access_token: string; token_type: string }>({
    url: '/auth/login',
    method: 'POST',
    data: { username, password }
  })
}

/** 账号密码注册 — 与网页端共用同一注册接口，保证账号统一 */
export async function register(username: string, password: string, email?: string) {
  return request<{ access_token: string; token_type: string; user: any }>({
    url: '/auth/register',
    method: 'POST',
    data: { username, password, email }
  })
}

/** 获取当前用户信息 — 与网页端 /auth/me 对齐 */
export async function getCurrentUser() {
  return request<{
    id: number
    username: string
    email: string | null
    openid: string | null
    is_active: boolean
    created_at: string
  }>({ url: '/auth/me' })
}

/** 微信登录（code 换 token） */
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
  payee?: string
  description?: string
  payment_method?: string
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
  payee?: string
  description?: string
  payment_method?: string
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

// ========== 预算相关 ==========

export async function getBudgetVsActual(year: number, month: number) {
  return request<{
    year: number
    month: number
    items: Array<{
      category: string
      budget: number
      actual: number
      percentage: number
      status: string
    }>
    total_budget: number
    total_actual: number
    total_remaining: number
  }>({ url: `/budgets/vs-actual?year=${year}&month=${month}` })
}

export async function createBudget(data: {
  year: number
  month: number
  category: string
  amount: number
}) {
  return request<any>({ url: '/budgets/', method: 'POST', data })
}

export async function updateBudget(id: number, data: { amount: number }) {
  return request<any>({ url: `/budgets/${id}`, method: 'PUT', data })
}

export async function deleteBudget(id: number) {
  return request<any>({ url: `/budgets/${id}`, method: 'DELETE' })
}

export async function autoGenerateBudgets(year: number, month: number) {
  return request<Array<{ category: string; amount: number }>>({
    url: `/budgets/auto-generate?year=${year}&month=${month}`,
    method: 'POST'
  })
}

/** AI 预算建议 — 对齐网页端 */
export async function suggestBudget(year: number, month: number) {
  return request<Array<{ category: string; suggested_amount: number; reason: string }>>({
    url: `/budgets/suggest?year=${year}&month=${month}`
  })
}

// ========== 分类相关 ==========

export async function getCategories() {
  return request<any[]>({ url: '/categories/' })
}

export async function createCategory(data: {
  name: string
  icon?: string
  color?: string
  keywords?: string
}) {
  return request<any>({ url: '/categories/', method: 'POST', data })
}

export async function updateCategory(id: number, data: {
  name?: string
  icon?: string
  color?: string
  keywords?: string
}) {
  return request<any>({ url: `/categories/${id}`, method: 'PUT', data })
}

export async function deleteCategory(id: number) {
  return request<any>({ url: `/categories/${id}`, method: 'DELETE' })
}

/** 文本自动匹配分类 — 对齐网页端 */
export async function matchCategory(text: string) {
  return request<{ category: string; confidence: number }>({
    url: '/categories/match',
    method: 'POST',
    data: { text }
  })
}

/** 重置为默认分类 */
export async function resetCategories() {
  return request<{ message: string }>({ url: '/categories/reset', method: 'POST' })
}

// ========== OCR 相关 ==========

/** OCR 图片识别（base64）— 对齐网页端独立 OCR 能力 */
export async function ocrRecognizeBase64(imageBase64: string, contentType: string = 'image/jpeg') {
  return request<{
    success: boolean
    transactions: Array<{
      payee: string
      amount: number
      category: string
      transaction_date: string
      description: string
    }>
    confidence: string
  }>({
    url: '/ocr/recognize-base64',
    method: 'POST',
    data: { image_base64: imageBase64, image_content_type: contentType }
  })
}

// ========== 聊天相关 ==========

export async function sendMessage(message: string, sessionId?: string) {
  return request<any>({
    url: '/chat/',
    method: 'POST',
    data: { message, session_id: sessionId }
  })
}

export async function getChatHistory(sessionId?: string) {
  return request<any[]>({
    url: `/chat/history${sessionId ? `?session_id=${sessionId}` : ''}`
  })
}

export default {
  login,
  register,
  getCurrentUser,
  wechatLogin,
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
  searchBills,
  getMonthlySummary,
  getCategoryBreakdown,
  getTrend,
  getBudgetVsActual,
  createBudget,
  updateBudget,
  deleteBudget,
  autoGenerateBudgets,
  suggestBudget,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  matchCategory,
  resetCategories,
  ocrRecognizeBase64,
  sendMessage,
  getChatHistory
}
