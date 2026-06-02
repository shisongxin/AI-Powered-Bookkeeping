/** 响应式布局 — 侧边栏导航 + 内容区 */

import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/',        icon: '📊', label: '仪表盘',  end: true },
  { to: '/bills',   icon: '📋', label: '账单明细' },
  { to: '/chat',    icon: '🤖', label: 'AI 记账'  },
  { to: '/analysis',icon: '📈', label: '流水分析' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 侧边栏 */}
      <aside
        className={`${collapsed ? 'w-16' : 'w-56'} flex flex-col bg-white border-r border-gray-200
                    transition-all duration-200 shrink-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-100">
          <span className="text-2xl">💰</span>
          {!collapsed && <span className="font-bold text-lg text-gray-800">BillAgent</span>}
        </div>

        {/* 导航 */}
        <nav className="flex-1 p-3 space-y-1">
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
              <span className="text-xl shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* 折叠按钮 */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-3 text-gray-400 hover:text-gray-600 border-t border-gray-100 text-sm"
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
