/** Bills API — 创建/查询/文件上传 */

import client from './client';
import type { BillCreate, BillResponse, BillUploadResponse } from '../types/bill';

export const billsApi = {
  create: (data: BillCreate) =>
    client.post<BillResponse>('/bills/', data).then((r) => r.data),

  list: (skip = 0, limit = 100, order: 'desc' | 'asc' = 'desc') =>
    client.get<BillResponse[]>('/bills/', { params: { skip, limit, order } }).then((r) => r.data),

  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return client.post<BillUploadResponse>('/bills/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};
