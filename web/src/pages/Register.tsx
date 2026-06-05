/** 注册页面 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/auth';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim()) { setError('请输入用户名'); return; }
    if (username.trim().length < 3) { setError('用户名至少3个字符'); return; }
    if (password.length < 6) { setError('密码至少6个字符'); return; }

    setLoading(true);
    try {
      await authApi.register({
        username: username.trim(),
        password,
        email: email.trim() || undefined,
      });
      setSuccess('注册成功！即将跳转到登录页...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '注册失败');
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
          <p className="text-gray-400 text-sm mt-1">创建你的记账账户</p>
        </div>

        {/* 表单卡片 */}
        <form onSubmit={handleRegister}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xl shadow-gray-200/50 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700">✨ 创建账号</h2>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded-xl border border-green-100">{success}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">用户名 *</label>
            <input type="text" value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field" placeholder="至少3个字符" autoFocus />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">密码 *</label>
            <input type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field" placeholder="至少6个字符" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">邮箱（选填）</label>
            <input type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field" placeholder="用于找回密码" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-primary-500 text-white rounded-xl font-medium
                       hover:bg-primary-600 disabled:opacity-50 transition-all shadow-sm hover:shadow-md">
            {loading ? '注册中...' : '注册'}
          </button>

          <p className="text-center text-xs text-gray-400">
            已有账号？<Link to="/login" className="text-primary-500 font-medium hover:underline">去登录</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
