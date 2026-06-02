/** 对齐后端 app/schemas/chat.py */

export interface ChatRequest {
  message: string;
  session_id?: string | null;
  persona?: string | null;
  image_base64?: string | null;
  image_content_type?: string;
}

export interface ToolCallRecord {
  tool_name: string;
  arguments: Record<string, unknown>;
  result: string | null;
}

export interface ChatResponse {
  reply: string;
  session_id: string | null;
  tool_calls: ToolCallRecord[];
  done: boolean;
}

/** SSE 事件类型 */
export type SSEEventType = 'status' | 'tool_call' | 'reply_chunk' | 'done' | 'error';

export interface SSEEvent {
  event: SSEEventType;
  data: string;
}

/** 对话消息（前端本地状态） */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool_status';
  content: string;
  toolCalls?: ToolCallRecord[];
  timestamp: number;
}
