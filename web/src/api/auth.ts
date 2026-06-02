/** Auth API — 注册/登录/个人信息 */

import client from './client';
import type { RegisterRequest, LoginRequest, TokenResponse, UserResponse } from '../types/auth';

export const authApi = {
  register: (data: RegisterRequest) =>
    client.post<TokenResponse>('/auth/register', data).then((r) => r.data),

  login: (data: LoginRequest) =>
    client.post<TokenResponse>('/auth/login', data).then((r) => r.data),

  me: () =>
    client.get<UserResponse>('/auth/me').then((r) => r.data),
};
