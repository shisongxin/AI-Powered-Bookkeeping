/** Chat API — 非流式 + SSE 流式对话 */

import type { ChatRequest, ChatResponse, ConfirmActionRequest, SSEEvent } from '../types/chat';

const API_BASE = '/api/v1';

/** SSE 帧解析器：处理多行 data: 聚合（适配 markdown 换行） */
function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: {
    onEvent: (evt: SSEEvent) => void;
    onError: (err: Error) => void;
    onDone: (sessionId: string) => void;
  }
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  let sessionId = '';
  let currentEvent = '';
  let currentData = '';

  const emit = () => {
    if (currentEvent && currentData !== '') {
      callbacks.onEvent({ event: currentEvent as SSEEvent['event'], data: currentData });
      if (currentEvent === 'done') {
        try { const d = JSON.parse(currentData); sessionId = d.session_id || ''; } catch { /* */ }
      }
    }
    currentEvent = '';
    currentData = '';
  };

  const pump = async (): Promise<void> => {
    const { done, value } = await reader.read();
    if (done) { emit(); callbacks.onDone(sessionId); return; }
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // 不完整的行留到下次

    for (const line of lines) {
      if (line === '') {
        // 空行 = SSE 帧结束
        emit();
      } else if (line.startsWith('event: ')) {
        // 新事件开始 → 先触发上一个事件
        emit();
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const chunk = line.slice(6);
        currentData = currentData ? currentData + '\n' + chunk : chunk;
      }
    }
    return pump();
  };

  return pump();
}

/** 创建 SSE fetch 管道 */
function sseFetch(
  url: string,
  body: unknown,
  callbacks: {
    onEvent: (evt: SSEEvent) => void;
    onError: (err: Error) => void;
    onDone: (sessionId: string) => void;
  },
  signal?: AbortSignal,
): void {
  const token = localStorage.getItem('billagent_token');
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        callbacks.onError(new Error(err.detail || `HTTP ${res.status}`));
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) { callbacks.onError(new Error('No response body')); return; }
      return parseSSEStream(reader, callbacks);
    })
    .catch((err) => {
      if (err.name !== 'AbortError') callbacks.onError(err);
    });
}

export const chatApi = {
  /** 非流式对话 */
  send: async (data: ChatRequest): Promise<ChatResponse> => {
    const token = localStorage.getItem('billagent_token');
    const res = await fetch(`${API_BASE}/chat/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },

  /**
   * SSE 流式对话 — 返回可取消的 AbortController
   */
  sendStream: (
    data: ChatRequest,
    callbacks: {
      onEvent: (evt: SSEEvent) => void;
      onError: (err: Error) => void;
      onDone: (sessionId: string) => void;
    }
  ): AbortController => {
    const controller = new AbortController();
    sseFetch(`${API_BASE}/chat/stream`, data, callbacks, controller.signal);
    return controller;
  },

  /**
   * 确认/取消待确认的 create_bill 操作
   */
  confirmAction: (
    data: ConfirmActionRequest,
    callbacks: {
      onEvent: (evt: SSEEvent) => void;
      onError: (err: Error) => void;
      onDone: (sessionId: string) => void;
    }
  ): AbortController => {
    const controller = new AbortController();
    sseFetch(`${API_BASE}/chat/confirm`, data, callbacks, controller.signal);
    return controller;
  },
};
