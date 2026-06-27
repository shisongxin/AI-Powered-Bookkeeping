import React, { useState, useCallback } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAuth } from '../../shared/hooks/useAuth'
import { login as apiLogin, wechatLogin } from '../../shared/api/client'
import './login.css'

/**
 * 登录页面
 * 支持微信小程序微信一键登录和账号密码登录
 */
const LoginPage: React.FC = () => {
  // 检测运行环境
  const isMiniApp = Taro.getEnv() === 'WEAPP'

  // 登录模式：默认密码登录（开发者工具模拟器无法调用微信登录）
  const [mode, setMode] = useState(isMiniApp ? 'wechat' : 'password')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { isLoading, error, clearError, login: authLogin } = useAuth()

  // 微信小程序微信一键登录
  const handleWeChatLogin = useCallback(async () => {
    clearError()
    try {
      // 1. 调用 wx.login 获取 code
      const loginResult = await Taro.login()
      if (!loginResult.code) {
        throw new Error('获取登录凭证失败，请重试')
      }

      console.log('微信登录 code:', loginResult.code)

      // 2. 调用后端微信登录接口（用 code 换取 openid）
      const res = await wechatLogin(loginResult.code)

      // 3. 存储 token 和用户信息
      Taro.setStorageSync('token', res.access_token)

      // 4. 更新认证状态
      authLogin({
        token: res.access_token,
        refreshToken: '',
        user: {
          id: 0,
          openid: '',
          nickname: res.is_new_user ? '新用户' : '微信用户',
          avatar_url: '',
          phone: ''
        }
      })

      // 5. 登录成功后跳转
      Taro.showToast({
        title: res.is_new_user ? '注册成功' : '登录成功',
        icon: 'success',
        duration: 1500
      })

      setTimeout(() => {
        Taro.switchTab({ url: '/pages/index/index' })
      }, 1500)
    } catch (e: any) {
      console.error('WeChat login error:', e)
      Taro.showToast({
        title: e.message || '微信登录失败，请稍后重试',
        icon: 'none',
        duration: 2000
      })
    }
  }, [clearError, authLogin])

  // 账号密码登录
  const handlePasswordLogin = useCallback(async () => {
    clearError()

    // 表单验证
    if (!username.trim()) {
      Taro.showToast({ title: '请输入用户名', icon: 'none', duration: 2000 })
      return
    }
    if (!password.trim()) {
      Taro.showToast({ title: '请输入密码', icon: 'none', duration: 2000 })
      return
    }

    try {
      // 调用后端登录 API
      const res = await apiLogin(username, password)

      // 存储 token
      Taro.setStorageSync('token', res.access_token)

      // 更新认证状态
      authLogin({
        token: res.access_token,
        refreshToken: '',
        user: {
          id: 0,
          nickname: username,
          avatar_url: '',
          phone: ''
        }
      })

      // 登录成功后跳转
      Taro.showToast({ title: '登录成功', icon: 'success', duration: 1500 })

      setTimeout(() => {
        Taro.switchTab({ url: '/pages/index/index' })
      }, 1500)
    } catch (e: any) {
      console.error('Password login error:', e)
      Taro.showToast({
        title: e.message || '用户名或密码错误',
        icon: 'none',
        duration: 2000
      })
    }
  }, [username, password, clearError, authLogin])

  return (
    <View className='login-container'>
      <View className='login-card'>
        {/* Logo 区域 */}
        <View className='logo-section'>
          <View className='logo-icon'>
            <Text>💰</Text>
          </View>
          <Text className='logo-title'>AI记账</Text>
          <Text className='logo-subtitle'>智能财务管理助手</Text>
        </View>

        {/* 错误提示 */}
        {error && (
          <View className='error-message'>
            <Text className='error-text'>{error}</Text>
          </View>
        )}

        {/* 微信登录表单（小程序环境默认显示） */}
        {mode === 'wechat' && (
          <View className='login-form'>
            <View className='wechat-desc'>
              <Text className='wechat-desc-text'>
                使用微信授权一键登录，无需注册
              </Text>
            </View>
            <Button
              className='wechat-login-btn'
              onClick={handleWeChatLogin}
              loading={isLoading}
              disabled={isLoading}
            >
              🔐 微信一键登录
            </Button>
            <View className='mode-switch'>
              <Text
                className='switch-link'
                onClick={() => setMode('password')}
              >
                使用密码登录 →
              </Text>
            </View>
          </View>
        )}

        {/* 密码登录表单 */}
        {mode === 'password' && (
          <View className='login-form'>
            <View className='demo-hint'>
              <Text className='demo-hint-text'>演示账号: admin / 123456</Text>
            </View>
            <View className='input-group'>
              <Text className='input-label'>用户名</Text>
              <Input
                className='input-field'
                type='text'
                value={username}
                onInput={(e) => setUsername(e.detail.value)}
                placeholder='请输入用户名'
                maxlength={20}
              />
            </View>
            <View className='input-group'>
              <Text className='input-label'>密码</Text>
              <Input
                className='input-field'
                type='safe-password'
                value={password}
                onInput={(e) => setPassword(e.detail.value)}
                placeholder='请输入密码'
                maxlength={32}
                password
              />
            </View>
            <Button
              className='password-login-btn'
              onClick={handlePasswordLogin}
              loading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '登 录'}
            </Button>
            {isMiniApp && (
              <View className='mode-switch'>
                <Text
                  className='switch-link'
                  onClick={() => setMode('wechat')}
                >
                  ← 返回微信登录
                </Text>
              </View>
            )}
          </View>
        )}

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
