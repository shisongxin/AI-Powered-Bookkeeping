/**
 * 认证状态管理 Store
 * 统一网页端和小程序端的账号体系：
 * - 网页端：用户名密码注册/登录 → JWT
 * - 小程序端：微信 openid 登录 或 用户名密码登录 → 同一 JWT 体系
 * - 两端共享同一用户表，数据完全互通
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 尝试导入 Taro（小程序环境可用，H5 端可能失败）
let Taro: any = null
try {
  Taro = require('@tarojs/taro')
} catch (e) {
  // H5 端无 Taro，忽略
}

/** 用户信息 — 与后端 User 模型对齐 */
export interface User {
  id: number
  username?: string
  email?: string | null
  openid?: string | null
  nickname?: string
  avatar_url?: string
  is_active?: boolean
  created_at?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (params: { token: string; user: User }) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
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
          try { return localStorage.getItem(name) } catch (e) { return null }
        },
        setItem: (name: string, value: any) => {
          try { localStorage.setItem(name, value) } catch (e) { /* ignore */ }
        },
        removeItem: (name: string) => {
          try { localStorage.removeItem(name) } catch (e) { /* ignore */ }
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

/** 认证状态管理 — 持久化到本地存储 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      /** 登录成功 — 存储 token 和用户信息 */
      login: async (params: { token: string; user: User }) => {
        set({ isLoading: true, error: null })
        try {
          set({
            token: params.token,
            user: params.user,
            isAuthenticated: true,
            isLoading: false
          })
        } catch (e: any) {
          set({ error: e.message || '登录失败', isLoading: false })
          throw e
        }
      },

      /** 登出 — 清除所有认证状态 */
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null
        })
      },

      /** 更新用户信息（如从 /auth/me 获取最新数据） */
      setUser: (user: User) => {
        set({ user })
      },

      /** 检查认证状态 */
      checkAuth: () => {
        const { token, user } = get()
        if (token && user) {
          set({ isAuthenticated: true })
        }
      },

      /** 清除错误 */
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
