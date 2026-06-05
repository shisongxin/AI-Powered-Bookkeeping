/** Chat API — 非流式 + SSE 流式对话 */

import type { ChatRequest, ChatResponse, ConfirmActionRequest, SSEEvent } from '../types/chat';

const API_BASE = '/api/v1';

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
   *
   * 使用示例：
   *   const ctrl = chatApi.sendStream(request, {
   *     onEvent: (evt) => { ... },
   *     onError: (err) => { ... },
   *     onDone: () => { ... },
   *   });
   *   // 取消：ctrl.abort()
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
    const token = localStorage.getItem('billagent_token');

    fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          callbacks.onError(new Error(err.detail || `HTTP ${res.status}`));
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) { callbacks.onError(new Error('No response body')); return; }

        const decoder = new TextDecoder();
        let buffer = '';
        let sessionId = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // 解析 SSE 帧
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 不完整的行留在 buffer

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6);
              callbacks.onEvent({ event: currentEvent as SSEEvent['event'], data });

              // 从 done 事件中提取 session_id
              if (currentEvent === 'done') {
                try { const d = JSON.parse(data); sessionId = d.session_id || ''; } catch { /* */ }
              }
            }
          }
        }
        callbacks.onDone(sessionId);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          callbacks.onError(err);
        }
      });

    return controller;
  },

  /**
   * 确认/取消待确认的 create_bill 操作（需配合 confirm_mode=True 使用）
   * 返回 SSE 流，继续 AI 对话。
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
    const token = localStorage.getItem('billagent_token');

    fetch(`${API_BASE}/chat/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          callbacks.onError(new Error(err.detail || `HTTP ${res.status}`));
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) { callbacks.onError(new Error('No response body')); return; }

        const decoder = new TextDecoder();
        let buffer = '';
        let sessionId = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6);
              callbacks.onEvent({ event: currentEvent as SSEEvent['event'], data });

              if (currentEvent === 'done') {
                try { const d = JSON.parse(data); sessionId = d.session_id || ''; } catch { /* */ }
              }
            }
          }
        }
        callbacks.onDone(sessionId);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          callbacks.onError(err);
        }
      });

    return controller;
  },
};
