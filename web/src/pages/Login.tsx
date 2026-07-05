/** Login — branded auth page */

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
    setLoading(true); setError('');
    try { const r = await authApi.login({ username: username.trim(), password }); localStorage.setItem('billagent_token', r.access_token); navigate('/'); }
    catch (er: unknown) { setError(er instanceof Error ? er.message : '登录失败'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-[#faf7f5]">
      {/* Left — brand panel */}
      <div className="hidden lg:flex w-[42%] bg-gradient-to-br from-espresso-900 via-espresso-800 to-espresso-950 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_30%_50%,#fbbf24,transparent_70%),radial-gradient(circle_at_70%_20%,#f59e0b,transparent_50%)]" />
        <div className="absolute top-12 left-12 w-24 h-24 rounded-full border border-gold-500/20" />
        <div className="absolute bottom-20 right-16 w-40 h-40 rounded-full border border-gold-500/10" />
        <div className="relative text-center px-12">
          <div className="w-28 h-28 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-gold-lg">
            <span className="text-white font-bold text-4xl">💰</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-3 tracking-tight">BillAgent</h1>
          <p className="text-espresso-300 leading-relaxed">AI 驱动的智能记账助手<br/>让每一笔账都清晰可见</p>
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div><p className="text-gold-400 font-bold text-xl font-display">9+</p><p className="text-espresso-400 text-xs mt-1">智能工具</p></div>
              <div><p className="text-gold-400 font-bold text-xl font-display">SSE</p><p className="text-espresso-400 text-xs mt-1">实时流式</p></div>
              <div><p className="text-gold-400 font-bold text-xl font-display">OCR</p><p className="text-espresso-400 text-xs mt-1">图片识别</p></div>
            </div>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-gold"><span className="text-white font-bold text-2xl">💰</span></div>
            <h1 className="text-xl font-display font-bold text-espresso-800">BillAgent</h1>
          </div>

          <form onSubmit={handleLogin} className="glass-card p-6 space-y-4 animate-scale-in">
            <h2 className="text-lg font-bold text-espresso-800 font-display">欢迎回来</h2>
            <p className="text-sm text-espresso-400 -mt-2">登录你的账户继续记账</p>

            {error && <div className="bg-coral-50 text-coral-600 text-sm px-4 py-3 rounded-xl border border-coral-100">{error}</div>}

            <div><label className="block text-xs font-medium text-espresso-500 mb-1.5">用户名</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} className="input-field" placeholder="请输入用户名" autoFocus /></div>
            <div><label className="block text-xs font-medium text-espresso-500 mb-1.5">密码</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="请输入密码" /></div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center !py-3">{loading ? '登录中…' : '登录'}</button>

            <p className="text-center text-xs text-espresso-400">还没有账号？<Link to="/register" className="text-gold-600 font-medium hover:text-gold-700">立即注册 →</Link></p>
          </form>
        </div>
      </div>
    </div>
  );
}
