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
export type SSEEventType = 'status' | 'tool_call' | 'confirm_required' | 'reply_chunk' | 'content_block' | 'done' | 'error';

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

// ============ ContentBlock 类型（结构化渲染）============

export type ContentBlockType = 'text' | 'heading' | 'table' | 'summary' | 'bill_list' | 'callout' | 'divider';

export interface TextBlock { type: 'text'; content: string; }
export interface HeadingBlock { type: 'heading'; level: 1 | 2 | 3; content: string; }
export interface SummaryCardItem { label: string; value: string; trend?: 'up' | 'down' | 'flat'; }
export interface SummaryBlock { type: 'summary'; cards: SummaryCardItem[]; }
export interface TableBlock { type: 'table'; headers: string[]; rows: string[][]; }
export interface BillListItem { date: string; category: string; payee: string; amount: string; }
export interface BillListBlock { type: 'bill_list'; bills: BillListItem[]; }
export interface CalloutBlock { type: 'callout'; level: 'info' | 'warning' | 'success'; content: string; }
export interface DividerBlock { type: 'divider'; }

export type ContentBlock = TextBlock | HeadingBlock | SummaryBlock | TableBlock | BillListBlock | CalloutBlock | DividerBlock;

/** 对话消息（前端本地状态） */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool_status' | 'confirm_card';
  content: string;
  /** 结构化内容块（assistant 消息使用，由 content_block SSE 事件填充） */
  blocks?: ContentBlock[];
  toolCalls?: ToolCallRecord[];
  confirmData?: ConfirmRequired;
  timestamp: number;
  confirmed?: boolean;
  rejected?: boolean;
  billStates?: Record<string, { confirmed?: boolean; rejected?: boolean; editForm?: Record<string, string> }>;
}
