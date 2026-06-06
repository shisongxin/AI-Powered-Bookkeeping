import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Bills from './pages/Bills';
import ChatPage from './pages/ChatPage';
import Analysis from './pages/Analysis';
import Categories from './pages/Categories';
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* 登录/注册 — 独立页面，无侧边栏 */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* 主应用 — 带侧边栏布局 */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/analysis" replace />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="bills" element={<Bills />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="categories" element={<Categories />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
