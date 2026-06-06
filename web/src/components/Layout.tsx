/** 响应式布局 — 侧边栏导航 + 用户状态 + 内容区 */

import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/auth';
import type { UserResponse } from '../types/auth';

const NAV_ITEMS = [
  { to: '/',           icon: 'dashboard',  label: '仪表盘',     end: true },
  { to: '/bills',      icon: 'receipt',    label: '账单明细' },
  { to: '/chat',       icon: 'chat',       label: 'AI 记账'  },
  { to: '/analysis',   icon: 'chart',      label: '流水分析' },
  { to: '/categories', icon: 'category',   label: '分类管理' },
];

const Icons: Record<string, JSX.Element> = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  receipt: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2.5-1.5L9 22l2.5-1.5L14 22l2.5-1.5L19 22V2l-2.5 1.5L14 2l-2.5 1.5L9 2 6.5 3.5z"/>
      <line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/>
    </svg>
  ),
  chat: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/>
    </svg>
  ),
  chart: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  category: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/>
      <rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>
    </svg>
  ),
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<UserResponse | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('billagent_token');
    if (!token) { navigate('/login'); return; }
    authApi.me().then(setUser).catch(() => {
      localStorage.removeItem('billagent_token');
      navigate('/login');
    });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('billagent_token');
    setUser(null);
    navigate('/login');
  };

  const isActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf7f5]">
      {/* ===== Dark Sidebar ===== */}
      <aside
        className={`${collapsed ? 'w-[68px]' : 'w-60'} flex flex-col shrink-0
                    bg-gradient-to-b from-espresso-900 via-espresso-900 to-espresso-950
                    border-r border-white/5 transition-all duration-300 relative z-20`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-5 h-[72px] border-b border-white/5`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600
                          flex items-center justify-center text-white font-bold text-sm shadow-gold shrink-0">
            B
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-display font-bold text-base text-white tracking-tight">BillAgent</p>
              <p className="text-[10px] text-espresso-400 tracking-wider uppercase">AI 智能记账</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.to, item.end);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={`nav-item ${active ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className={`shrink-0 transition-colors duration-300 ${active ? 'text-gold-400' : 'text-espresso-400'}`}>
                  {Icons[item.icon]}
                </span>
                {!collapsed && (
                  <span className={`truncate transition-colors duration-300 ${active ? 'text-gold-300' : 'text-espresso-300'}`}>
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Area */}
        <div className="border-t border-white/5">
          {user && !collapsed && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600
                                flex items-center justify-center text-white text-xs font-bold shadow-gold shrink-0">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-espresso-200 truncate">{user.username}</p>
                  <button onClick={handleLogout}
                    className="text-xs text-espresso-500 hover:text-coral-400 transition-colors">
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          )}
          {user && collapsed && (
            <div className="flex justify-center py-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600
                              flex items-center justify-center text-white text-xs font-bold shadow-gold"
                   title={user.username}>
                {user.username.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full py-3 flex justify-center text-espresso-500 hover:text-espresso-300
                       hover:bg-white/5 transition-all duration-200"
            title={collapsed ? '展开' : '收起'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* ===== Main Content ===== */}
      <main className="flex-1 overflow-y-auto">
        <div className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
