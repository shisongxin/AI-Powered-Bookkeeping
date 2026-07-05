/** Register — branded auth page */

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
    e.preventDefault(); setError(''); setSuccess('');
    if (!username.trim()) { setError('请输入用户名'); return; }
    if (username.trim().length < 3) { setError('用户名至少3个字符'); return; }
    if (password.length < 6) { setError('密码至少6个字符'); return; }
    setLoading(true);
    try { await authApi.register({ username: username.trim(), password, email: email.trim() || undefined }); setSuccess('注册成功！即将跳转…'); setTimeout(() => navigate('/login'), 1500); }
    catch (er: unknown) { setError(er instanceof Error ? er.message : '注册失败'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-[#faf7f5]">
      <div className="hidden lg:flex w-[42%] bg-gradient-to-br from-espresso-900 via-espresso-800 to-espresso-950 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_70%_60%,#fbbf24,transparent_60%),radial-gradient(circle_at_30%_30%,#f59e0b,transparent_40%)]" />
        <div className="relative text-center px-12">
          <div className="w-28 h-28 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-gold-lg"><span className="text-white font-bold text-4xl">💰</span></div>
          <h1 className="text-3xl font-display font-bold text-white mb-3 tracking-tight">加入 BillAgent</h1>
          <p className="text-espresso-300 leading-relaxed">创建账户，开启智能记账之旅</p>
          <div className="mt-8 space-y-3 text-left max-w-xs mx-auto">
            {['📊 智能分类自动匹配','🤖 AI 对话记账','📸 截图 OCR 识别','📈 可视化流水分析'].map((f,i) => (
              <div key={i} className="flex items-center gap-3 text-espresso-300 text-sm"><span className="w-5 h-5 rounded-full bg-gold-500/10 flex items-center justify-center text-gold-400 text-xs font-bold">{i+1}</span>{f}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8"><div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-gold"><span className="text-white font-bold text-2xl">💰</span></div><h1 className="text-xl font-display font-bold text-espresso-800">BillAgent</h1></div>

          <form onSubmit={handleRegister} className="glass-card p-6 space-y-4 animate-scale-in">
            <h2 className="text-lg font-bold text-espresso-800 font-display">创建账号</h2>
            <p className="text-sm text-espresso-400 -mt-2">开始你的智能记账</p>
            {error && <div className="bg-coral-50 text-coral-600 text-sm px-4 py-3 rounded-xl border border-coral-100">{error}</div>}
            {success && <div className="bg-emerald-50 text-emerald-600 text-sm px-4 py-3 rounded-xl border border-emerald-100">{success}</div>}

            <div><label className="block text-xs font-medium text-espresso-500 mb-1.5">用户名 *</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} className="input-field" placeholder="至少3个字符" autoFocus /></div>
            <div><label className="block text-xs font-medium text-espresso-500 mb-1.5">密码 *</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="至少6个字符" /></div>
            <div><label className="block text-xs font-medium text-espresso-500 mb-1.5">邮箱 <span className="text-espresso-300">(选填)</span></label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="用于找回密码" /></div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center !py-3">{loading ? '注册中…' : '注册'}</button>

            <p className="text-center text-xs text-espresso-400">已有账号？<Link to="/login" className="text-gold-600 font-medium hover:text-gold-700">去登录 →</Link></p>
          </form>
        </div>
      </div>
    </div>
  );
}
