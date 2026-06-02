/** OCR API — 上传图片提取交易 */

import client from './client';
import type { OCRResponse } from '../types/ocr';

export const ocrApi = {
  /** 上传图片文件进行 OCR 识别 */
  recognize: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return client.post<OCRResponse>('/ocr/recognize', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then((r) => r.data);
  },

  /** 通过 base64 图片进行 OCR（用于聊天内嵌） */
  recognizeBase64: (imageBase64: string, contentType: string = 'image/jpeg') =>
    client.post<OCRResponse>('/ocr/recognize-base64', { image_base64: imageBase64, content_type: contentType })
      .then((r) => r.data),
};
