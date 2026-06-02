import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Bills from './pages/Bills';
import ChatPage from './pages/ChatPage';
import Analysis from './pages/Analysis';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="bills" element={<Bills />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="analysis" element={<Analysis />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
