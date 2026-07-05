/**
 * 登录页面 — 统一账号体系
 * 支持：
 * 1. 微信一键登录（小程序环境）
 * 2. 用户名密码登录（与网页端共享同一用户表）
 * 3. 注册入口（跳转到注册页面）
 *
 * 登录成功后调用 /auth/me 获取完整用户信息，
 * 保证两端用户数据一致
 */
import React, { useState, useCallback, useEffect } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAuth } from '../../shared/hooks/useAuth'
import { login as apiLogin, wechatLogin, getCurrentUser } from '../../shared/api/client'
import './login.css'

const LoginPage: React.FC = () => {
  const isMiniApp = Taro.getEnv() === 'WEAPP'

  // 默认密码登录（开发者工具模拟器无法调用微信登录）
  const [mode, setMode] = useState(isMiniApp ? 'wechat' : 'password')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { isLoading, error, clearError, login: authLogin } = useAuth()

  // 若已登录，自动跳转首页
  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (token) {
      Taro.switchTab({ url: '/pages/analysis/index' })
    }
  }, [])

  /** 登录成功后统一处理：获取用户信息 + 存储 token */
  const handleLoginSuccess = useCallback(async (accessToken: string, fallbackNickname: string) => {
    Taro.setStorageSync('token', accessToken)

    // 调用 /auth/me 获取完整用户信息，保证与网页端一致
    try {
      const userInfo = await getCurrentUser()
      const user = {
        id: userInfo.id,
        username: userInfo.username,
        email: userInfo.email,
        openid: userInfo.openid,
        nickname: userInfo.username || fallbackNickname,
        is_active: userInfo.is_active,
        created_at: userInfo.created_at
      }
      await authLogin({ token: accessToken, user })
    } catch {
      // /auth/me 失败时使用 fallback
      await authLogin({
        token: accessToken,
        user: { id: 0, nickname: fallbackNickname, username: username || '' }
      })
    }

    Taro.showToast({ title: '登录成功', icon: 'success', duration: 1500 })
    Taro.switchTab({ url: '/pages/analysis/index' })
  }, [authLogin, username])

  /** 微信一键登录 */
  const handleWeChatLogin = useCallback(async () => {
    clearError()
    try {
      const loginResult = await Taro.login()
      if (!loginResult.code) {
        throw new Error('获取登录凭证失败，请重试')
      }
      const res = await wechatLogin(loginResult.code)
      await handleLoginSuccess(res.access_token, res.is_new_user ? '新用户' : '微信用户')
    } catch (e: any) {
      Taro.showToast({ title: e.message || '微信登录失败', icon: 'none', duration: 2000 })
    }
  }, [clearError, handleLoginSuccess])

  /** 用户名密码登录 — 与网页端共用同一接口 */
  const handlePasswordLogin = useCallback(async () => {
    clearError()
    if (!username.trim()) {
      Taro.showToast({ title: '请输入用户名', icon: 'none', duration: 2000 })
      return
    }
    if (!password.trim()) {
      Taro.showToast({ title: '请输入密码', icon: 'none', duration: 2000 })
      return
    }
    try {
      const res = await apiLogin(username, password)
      await handleLoginSuccess(res.access_token, username)
    } catch (e: any) {
      Taro.showToast({ title: e.message || '用户名或密码错误', icon: 'none', duration: 2000 })
    }
  }, [username, password, clearError, handleLoginSuccess])

  /** 跳转到注册页面 */
  const handleGoRegister = useCallback(() => {
    Taro.navigateTo({ url: '/pages/register/index' })
  }, [])

  return (
    <View className='login-container'>
      <View className='login-card'>
        {/* Logo 区域 — 对齐网页端 brand panel 风格 */}
        <View className='logo-section'>
          <View className='logo-icon'><Text>💰</Text></View>
          <Text className='logo-title'>BillAgent</Text>
          <Text className='logo-subtitle'>AI 驱动的智能记账助手</Text>
        </View>

        {/* 错误提示 */}
        {error && (
          <View className='error-message'>
            <Text className='error-text'>{error}</Text>
          </View>
        )}

        {/* 微信登录 */}
        {mode === 'wechat' && (
          <View className='login-form'>
            <View className='wechat-desc'>
              <Text className='wechat-desc-text'>使用微信授权一键登录，无需注册</Text>
            </View>
            <Button className='wechat-login-btn' onClick={handleWeChatLogin} loading={isLoading} disabled={isLoading}>
              🔐 微信一键登录
            </Button>
            <View className='mode-switch'>
              <Text className='switch-link' onClick={() => setMode('password')}>使用密码登录 →</Text>
            </View>
          </View>
        )}

        {/* 密码登录 */}
        {mode === 'password' && (
          <View className='login-form'>
            <View className='input-group'>
              <Text className='input-label'>用户名</Text>
              <Input className='input-field' type='text' value={username}
                onInput={(e) => setUsername(e.detail.value)} placeholder='请输入用户名' maxlength={20} />
            </View>
            <View className='input-group'>
              <Text className='input-label'>密码</Text>
              <Input className='input-field' type='safe-password' value={password}
                onInput={(e) => setPassword(e.detail.value)} placeholder='请输入密码' maxlength={32} password />
            </View>
            <Button className='password-login-btn' onClick={handlePasswordLogin} loading={isLoading} disabled={isLoading}>
              {isLoading ? '登录中...' : '登 录'}
            </Button>
            {isMiniApp && (
              <View className='mode-switch'>
                <Text className='switch-link' onClick={() => setMode('wechat')}>← 返回微信登录</Text>
              </View>
            )}
          </View>
        )}

        {/* 注册入口 — 与网页端对齐 */}
        <View className='register-entry'>
          <Text className='register-text'>还没有账号？</Text>
          <Text className='register-link' onClick={handleGoRegister}>立即注册</Text>
        </View>

        {/* 底部协议 */}
        <View className='login-footer'>
          <Text className='footer-text'>登录即表示您同意</Text>
          <Text className='footer-link'>《用户协议》</Text>
          <Text className='footer-text'>和</Text>
          <Text className='footer-link'>《隐私政策》</Text>
        </View>
      </View>
    </View>
  )
}

export default LoginPage
