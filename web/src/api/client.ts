/** Axios 实例 — JWT 拦截器 + 基础配置 */

import axios from 'axios';

const API_BASE = '/api/v1';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器：从 localStorage 读取 JWT token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('billagent_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：401 时清除 token 并跳转登录
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('billagent_token');
      // 非 auth 接口才跳转
      if (!err.config.url?.includes('/auth/')) {
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(err);
  }
);

export default client;
