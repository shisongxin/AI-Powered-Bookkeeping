/** Categories API — CRUD + 自动匹配 */

import client from './client';
import type {
  CategoryCreate, CategoryUpdate, CategoryResponse,
  MatchRequest, MatchResponse,
} from '../types/category';

export const categoriesApi = {
  create: (data: CategoryCreate) =>
    client.post<CategoryResponse>('/categories/', data).then((r) => r.data),

  list: () =>
    client.get<CategoryResponse[]>('/categories/').then((r) => r.data),

  get: (id: number) =>
    client.get<CategoryResponse>(`/categories/${id}`).then((r) => r.data),

  update: (id: number, data: CategoryUpdate) =>
    client.put<CategoryResponse>(`/categories/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    client.delete(`/categories/${id}`).then((r) => r.data),

  match: (data: MatchRequest) =>
    client.post<MatchResponse>('/categories/match', data).then((r) => r.data),
};
