import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DataState } from './useDataStore.types'

// 尝试导入 Taro（小程序环境可用，Web 端可能失败）
let Taro: any = null
try {
  Taro = require('@tarojs/taro')
} catch (e) {
  // Web 端无 Taro，忽略
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
 * 全局数据版本 store
 * 用于跨页面同步：账单页面增删改后 bump 版本，首页/分析页监听版本变化并刷新
 */
export const useDataStore = create<DataState>()(
  persist<DataState>(
    (set) => ({
      billsVersion: 0,
      bumpBillsVersion: () => set((s: DataState) => ({ billsVersion: s.billsVersion + 1 })),
    }),
    {
      name: 'data-storage',
      storage: createSafeStorage()
    }
  )
)
