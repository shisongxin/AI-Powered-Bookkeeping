import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 尝试导入 Taro（小程序环境可用，Web 端可能失败）
let Taro: any = null
try {
  Taro = require('@tarojs/taro')
} catch (e) {
  // Web 端无 Taro，忽略
}

export interface User {
  id: number
  openid?: string
  nickname: string
  avatar_url?: string
  phone?: string
  created_at?: string
  updated_at?: string
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (params: { token: string; refreshToken: string; user: User }) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
  checkAuth: () => void
  clearError: () => void
}

/**
 * 安全的存储适配器 - 兼容小程序和 H5 环境
 * Zustand persist 要求的 storage 格式
 */
const createSafeStorage = () => {
  // 优先使用 Taro 存储
  if (Taro && Taro.getStorageSync) {
    return {
      getItem: (name: string) => {
        try {
          const value = Taro.getStorageSync(name)
          return value !== '' ? value : null
        } catch (e) {
          return null
        }
      },
      setItem: (name: string, value: any) => {
        try {
          Taro.setStorageSync(name, value)
        } catch (e) { /* ignore */ }
      },
      removeItem: (name: string) => {
        try {
          Taro.removeStorageSync(name)
        } catch (e) { /* ignore */ }
      }
    }
  }

  // 降级到 localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      return {
        getItem: (name: string) => {
          try {
            return localStorage.getItem(name)
          } catch (e) {
            return null
          }
        },
        setItem: (name: string, value: any) => {
          try {
            localStorage.setItem(name, value)
          } catch (e) { /* ignore */ }
        },
        removeItem: (name: string) => {
          try {
            localStorage.removeItem(name)
          } catch (e) { /* ignore */ }
        }
      }
    }
  } catch (e) { /* ignore */ }

  // 最终降级：内存存储
  const memoryStore: Record<string, any> = {}
  return {
    getItem: (name: string) => memoryStore[name] || null,
    setItem: (name: string, value: any) => { memoryStore[name] = value },
    removeItem: (name: string) => { delete memoryStore[name] }
  }
}

/**
 * 认证状态管理 store
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // 登录
      login: async (params: { token: string; refreshToken: string; user: User }) => {
        set({ isLoading: true, error: null })
        try {
          set({
            token: params.token,
            refreshToken: params.refreshToken,
            user: params.user,
            isAuthenticated: true,
            isLoading: false
          })
        } catch (e: any) {
          set({ error: e.message || '登录失败', isLoading: false })
          throw e
        }
      },

      // 登出
      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null
        })
      },

      // 刷新 token
      refresh: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return
        try {
          // TODO: 调用刷新 token 的 API
          console.log('Refresh token:', refreshToken)
        } catch (e: any) {
          set({ error: e.message || '刷新失败' })
        }
      },

      // 检查认证状态
      checkAuth: () => {
        const { token, user } = get()
        if (token && user) {
          set({ isAuthenticated: true })
        }
      },

      // 清除错误
      clearError: () => {
        set({ error: null })
      }
    }),
    {
      name: 'auth-storage',
      storage: createSafeStorage()
    }
  )
)

export default useAuthStore
