/** 响应式布局 — 侧边栏导航 + 用户状态 + 内容区 */

import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import type { UserResponse } from '../types/auth';

const NAV_ITEMS = [
  { to: '/',           icon: '📊', label: '仪表盘',     end: true },
  { to: '/bills',      icon: '📋', label: '账单明细' },
  { to: '/chat',       icon: '🤖', label: 'AI 记账'  },
  { to: '/analysis',   icon: '📈', label: '流水分析' },
  { to: '/categories', icon: '🏷️', label: '分类管理' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<UserResponse | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('billagent_token');
    if (!token) {
      navigate('/login');
      return;
    }
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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* 侧边栏 */}
      <aside
        className={`${collapsed ? 'w-16' : 'w-60'} flex flex-col bg-white border-r border-gray-100
                    transition-all duration-300 shrink-0 shadow-sm`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-50">
          <span className="text-2xl shrink-0">💰</span>
          {!collapsed && (
            <div className="overflow-hidden">
              <span className="font-bold text-lg text-gray-800">BillAgent</span>
              <span className="block text-xs text-gray-400">AI 智能记账</span>
            </div>
          )}
        </div>

        {/* 导航 */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="text-lg shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* 用户区 */}
        <div className="border-t border-gray-100">
          {user && (
            <div className={`px-4 py-3 ${collapsed ? 'text-center' : ''}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-bold shrink-0">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-700 truncate">{user.username}</p>
                    <button
                      onClick={handleLogout}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
