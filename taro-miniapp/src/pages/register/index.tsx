/**
 * 注册页面 — 与网页端 Register.tsx 对齐
 * 使用同一后端接口 /api/v1/auth/register
 * 注册成功后自动创建默认分类，与网页端行为一致
 */
import React, { useState, useCallback } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { register as apiRegister, getCurrentUser } from '../../shared/api/client'
import { useAuth } from '../../shared/hooks/useAuth'
import './register.css'

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { login: authLogin } = useAuth()

  const handleRegister = useCallback(async () => {
    setError('')
    setSuccess('')

    // 表单验证 — 与网页端一致
    if (!username.trim()) { setError('请输入用户名'); return }
    if (username.trim().length < 3) { setError('用户名至少3个字符'); return }
    if (password.length < 6) { setError('密码至少6个字符'); return }

    setLoading(true)
    try {
      // 调用注册接口（与网页端共用）
      const res = await apiRegister(username.trim(), password, email.trim() || undefined)
      setSuccess('注册成功！即将跳转…')

      // 存储 token 并获取用户信息
      Taro.setStorageSync('token', res.access_token)
      try {
        const userInfo = await getCurrentUser()
        await authLogin({
          token: res.access_token,
          user: {
            id: userInfo.id,
            username: userInfo.username,
            email: userInfo.email,
            nickname: userInfo.username,
            is_active: userInfo.is_active,
            created_at: userInfo.created_at
          }
        })
      } catch {
        await authLogin({
          token: res.access_token,
          user: { id: 0, nickname: username.trim(), username: username.trim() }
        })
      }

      setTimeout(() => {
        Taro.showToast({ title: '注册成功', icon: 'success', duration: 1500 })
        Taro.switchTab({ url: '/pages/analysis/index' })
      }, 1000)
    } catch (e: any) {
      setError(e.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }, [username, password, email, authLogin])

  return (
    <View className='register-container'>
      <View className='register-card'>
        {/* Logo */}
        <View className='logo-section'>
          <View className='logo-icon'><Text>💰</Text></View>
          <Text className='logo-title'>创建账号</Text>
          <Text className='logo-subtitle'>开始你的智能记账之旅</Text>
        </View>

        {/* 错误/成功提示 */}
        {error && (
          <View className='error-message'>
            <Text className='error-text'>{error}</Text>
          </View>
        )}
        {success && (
          <View className='success-message'>
            <Text className='success-text'>{success}</Text>
          </View>
        )}

        {/* 注册表单 */}
        <View className='register-form'>
          <View className='input-group'>
            <Text className='input-label'>用户名 *</Text>
            <Input className='input-field' type='text' value={username}
              onInput={(e) => setUsername(e.detail.value)} placeholder='至少3个字符' maxlength={20} />
          </View>
          <View className='input-group'>
            <Text className='input-label'>密码 *</Text>
            <Input className='input-field' type='safe-password' value={password}
              onInput={(e) => setPassword(e.detail.value)} placeholder='至少6个字符' maxlength={32} password />
          </View>
          <View className='input-group'>
            <Text className='input-label'>邮箱 <Text className='input-optional'>(选填)</Text></Text>
            <Input className='input-field' type='text' value={email}
              onInput={(e) => setEmail(e.detail.value)} placeholder='用于找回密码' maxlength={50} />
          </View>

          <Button className='register-btn' onClick={handleRegister} loading={loading} disabled={loading}>
            {loading ? '注册中...' : '注 册'}
          </Button>

          <View className='login-entry'>
            <Text className='login-text'>已有账号？</Text>
            <Text className='login-link' onClick={() => Taro.navigateBack()}>去登录 →</Text>
          </View>
        </View>

        {/* 功能亮点 */}
        <View className='feature-list'>
          {['📊 智能分类自动匹配', '🤖 AI 对话记账', '📸 截图 OCR 识别', '📈 可视化流水分析'].map((f, i) => (
            <View key={i} className='feature-item'>
              <Text className='feature-text'>{f}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

export default RegisterPage
