/** 登录页面 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/auth';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const result = await authApi.login({ username: username.trim(), password });
      localStorage.setItem('billagent_token', result.access_token);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登录失败');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-primary-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg mb-4">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">BillAgent</h1>
          <p className="text-gray-400 text-sm mt-1">AI 智能记账助手</p>
        </div>

        {/* 表单卡片 */}
        <form onSubmit={handleLogin}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xl shadow-gray-200/50 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700">👋 欢迎回来</h2>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">用户名</label>
            <input
              type="text" value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field" placeholder="请输入用户名" autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">密码</label>
            <input
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field" placeholder="请输入密码"
            />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-primary-500 text-white rounded-xl font-medium
                       hover:bg-primary-600 disabled:opacity-50 transition-all shadow-sm hover:shadow-md">
            {loading ? '登录中...' : '登录'}
          </button>

          <p className="text-center text-xs text-gray-400">
            还没有账号？<Link to="/register" className="text-primary-500 font-medium hover:underline">立即注册</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
