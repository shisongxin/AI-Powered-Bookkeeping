import { useAuthStore, User } from '../stores/useAuthStore'

/**
 * 认证 Hook
 * 提供用户认证状态和操作方法
 */
export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const error = useAuthStore((state) => state.error)
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  const refresh = useAuthStore((state) => state.refresh)
  const checkAuth = useAuthStore((state) => state.checkAuth)
  const clearError = useAuthStore((state) => state.clearError)

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refresh,
    checkAuth,
    clearError
  }
}

export default useAuth
