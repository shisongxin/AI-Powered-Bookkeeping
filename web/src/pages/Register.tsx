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
      const msg = err instanceof Error ? err.message : '注册失败';
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">💰</span>
          <h1 className="text-2xl font-bold text-gray-800 mt-3">BillAgent</h1>
          <p className="text-gray-400 text-sm mt-1">创建你的记账账户</p>
        </div>

        <form onSubmit={handleRegister} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-700">注册</h2>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 text-green-600 text-sm px-4 py-2 rounded-lg">{success}</div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">用户名 *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              placeholder="至少3个字符"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">密码 *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              placeholder="至少6个字符"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">邮箱（选填）</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              placeholder="用于找回密码"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {loading ? '注册中...' : '注册'}
          </button>

          <p className="text-center text-xs text-gray-400">
            已有账号？<Link to="/login" className="text-primary-500 hover:underline">去登录</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
