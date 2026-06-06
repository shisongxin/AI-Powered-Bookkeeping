/** 对齐后端 app/schemas/chat.py */

export interface ChatRequest {
  message: string;
  session_id?: string | null;
  persona?: string | null;
  image_base64?: string | null;
  image_content_type?: string;
  confirm_mode?: boolean;
}

export interface ConfirmActionRequest {
  session_id: string;
  action: 'confirm' | 'reject';
  modified_arguments?: Record<string, unknown>[];
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
export type SSEEventType = 'status' | 'tool_call' | 'confirm_required' | 'reply_chunk' | 'done' | 'error';

export interface SSEEvent {
  event: SSEEventType;
  data: string;
}

/** 单条待确认账单 */
export interface PendingBill {
  tool_name: string;
  arguments: Record<string, unknown>;
  tool_call_id: string;
}

/** 确认请求信息（来自 confirm_required 事件，支持批量） */
export interface ConfirmRequired {
  bills: PendingBill[];
}

/** 对话消息（前端本地状态） */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool_status' | 'confirm_card';
  content: string;
  toolCalls?: ToolCallRecord[];
  confirmData?: ConfirmRequired;
  timestamp: number;
  /** 确认卡片状态（批量时 bills[*] 各自维护） */
  confirmed?: boolean;
  rejected?: boolean;
  /** 批量账单各自的确认/取消/编辑状态: { [tool_call_id]: { confirmed?, rejected?, editForm? } } */
  billStates?: Record<string, { confirmed?: boolean; rejected?: boolean; editForm?: Record<string, string> }>;
}
