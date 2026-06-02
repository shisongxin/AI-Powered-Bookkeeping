/** AI 记账对话页面 — SSE 流式渲染 + 图片 OCR + 工具调用状态卡片 */

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatApi } from '../api/chat';
import { ocrApi } from '../api/ocr';
import type { ChatMessage, ToolCallRecord, SSEEvent } from '../types/chat';
import type { OCRResponse, ExtractedItem } from '../types/ocr';

/** 工具名称 → 中文状态文案 */
const TOOL_LABELS: Record<string, string> = {
  query_bills: '正在查询账单...',
  create_bill: '正在记账...',
  get_monthly_summary: '正在统计月度汇总...',
  get_category_breakdown: '正在分析分类分布...',
  get_trend: '正在计算消费趋势...',
  list_categories: '正在获取分类列表...',
  scan_receipt: '正在识别账单截图...',
  get_budget_status: '正在对比预算...',
  suggest_budget: '正在生成预算建议...',
};

const PERSONAS = [
  { value: '',        label: '默认' },
  { value: 'buddy',   label: '毒舌搭子' },
  { value: 'cat',     label: '猫咪管家' },
  { value: 'analyst', label: '财务分析师' },
  { value: 'homie',   label: '老铁兄弟' },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState('');
  const [ocrResult, setOcrResult] = useState<OCRResponse | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamCtrlRef = useRef<AbortController | null>(null);

  // 自动滚到底部
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  // 添加消息
  const addMsg = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // 更新最后一条 assistant 消息（流式追加用）
  const appendAssistant = useCallback((chunk: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
      }
      return [...prev, { role: 'assistant', content: chunk, timestamp: Date.now() }];
    });
  }, []);

  // ---------- 发送消息 ----------
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setOcrResult(null);
    setLoading(true);

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    addMsg(userMsg);

    // 占位 assistant 消息（流式填充）
    addMsg({ role: 'assistant', content: '', timestamp: Date.now() });

    streamCtrlRef.current = chatApi.sendStream(
      {
        message: text,
        session_id: sessionId,
        persona: persona || undefined,
      },
      {
        onEvent: (evt: SSEEvent) => {
          switch (evt.event) {
            case 'status':
              // 显示 AI 状态提示
              appendAssistant(`💭 ${evt.data}\n\n`);
              break;

            case 'tool_call': {
              // 解析工具调用信息，插入状态卡片
              try {
                const tc = JSON.parse(evt.data) as { tool_name: string; arguments: Record<string, unknown> };
                const label = TOOL_LABELS[tc.tool_name] || `正在执行 ${tc.tool_name}...`;
                addMsg({ role: 'tool_status', content: label, timestamp: Date.now() });
              } catch { /* ignore parse error */ }
              break;
            }

            case 'reply_chunk':
              // 流式 token
              appendAssistant(evt.data);
              break;

            case 'done':
              try {
                const d = JSON.parse(evt.data);
                if (d.session_id) setSessionId(d.session_id);
              } catch { /* */ }
              break;

            case 'error':
              appendAssistant(`\n\n❌ ${evt.data}`);
              break;
          }
        },
        onError: (err) => {
          appendAssistant(`\n\n❌ 出错了: ${err.message}`);
          setLoading(false);
        },
        onDone: (sid) => {
          if (sid) setSessionId(sid);
          setLoading(false);
        },
      }
    );
  };

  // ---------- 图片上传 OCR ----------
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    try {
      const result = await ocrApi.recognize(file);
      setOcrResult(result);

      // 将 OCR 结果注入为 user 消息
      const itemsStr = result.items
        .map((it: ExtractedItem) =>
          `- ${it.payee || '未知商户'} | ${it.amount ?? '?'}元 | ${it.category || '未分类'} | ${it.transaction_date || ''}`
        )
        .join('\n');

      const ocrMsg = `📸 OCR 识别结果 (${result.confidence}):\n${itemsStr}`;
      addMsg({ role: 'user', content: ocrMsg, timestamp: Date.now() });

      // 自动发送 OCR 结果给 AI 进行记账
      if (result.items.length > 0 && result.confidence !== 'low') {
        const aiPrompt = `请根据以下 OCR 识别的交易记录帮我逐条创建账单：\n${itemsStr}`;
        addMsg({ role: 'assistant', content: '', timestamp: Date.now() });

        streamCtrlRef.current = chatApi.sendStream(
          { message: aiPrompt, session_id: sessionId, persona: persona || undefined },
          {
            onEvent: (evt: SSEEvent) => {
              if (evt.event === 'reply_chunk') appendAssistant(evt.data);
              if (evt.event === 'tool_call') {
                try {
                  const tc = JSON.parse(evt.data) as { tool_name: string };
                  const label = TOOL_LABELS[tc.tool_name] || `正在执行 ${tc.tool_name}...`;
                  addMsg({ role: 'tool_status', content: label, timestamp: Date.now() });
                } catch { /* */ }
              }
            },
            onError: (err) => appendAssistant(`\n\n❌ ${err.message}`),
            onDone: () => setOcrLoading(false),
          }
        );
      } else {
        setOcrLoading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      addMsg({ role: 'assistant', content: `❌ OCR 识别失败: ${msg}`, timestamp: Date.now() });
      setOcrLoading(false);
    }
    // 重置 input，允许重复选同一文件
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ---------- 渲染工具状态卡片 ----------
  const renderToolCard = (label: string) => (
    <div className="flex items-center gap-3 my-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl animate-pulse">
      <span className="text-lg">⚙️</span>
      <span className="text-sm text-blue-700 font-medium">{label}</span>
      <div className="flex gap-1 ml-auto">
        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
      </div>
    </div>
  );

  // ---------- 渲染 OCR 结果卡片 ----------
  const renderOCRResult = () => {
    if (!ocrResult) return null;
    return (
      <div className="mx-4 my-3 p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📸</span>
          <span className="font-semibold text-green-800">
            OCR 识别完成 · {ocrResult.items.length} 条记录 · 置信度 {ocrResult.confidence}
          </span>
        </div>
        <div className="space-y-2">
          {ocrResult.items.map((item, i) => (
            <div key={i} className="flex flex-wrap gap-x-4 gap-y-1 text-sm bg-white rounded-lg p-3 shadow-sm">
              <span className="font-medium text-gray-800">{item.payee || '未知商户'}</span>
              <span className={item.amount && item.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                {item.amount != null ? `${item.amount}元` : ''}
              </span>
              <span className="text-gray-500">{item.category || ''}</span>
              <span className="text-gray-400">{item.transaction_date || ''}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* 顶栏 */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b shrink-0">
        <h1 className="text-xl font-bold text-gray-800">🤖 AI 智能记账</h1>
        <div className="flex items-center gap-3">
          <select
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white text-gray-600"
          >
            {PERSONAS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button
            onClick={() => { setMessages([]); setSessionId(null); setOcrResult(null); }}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            新对话
          </button>
        </div>
      </header>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-5xl mb-4">💬</p>
            <p className="text-lg">开始对话记账吧！</p>
            <p className="text-sm mt-2">试试说 "今天午餐麦当劳35元" 或 "这个月花了多少"</p>
            <p className="text-sm mt-1">也可以点击 📎 上传账单截图自动识别记账</p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'tool_status') {
            return <div key={i}>{renderToolCard(msg.content)}</div>;
          }
          const isUser = msg.role === 'user';
          return (
            <div key={i} className={`px-4 py-1 ${isUser ? '' : 'bg-gray-50'}`}>
              <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                <span className="text-2xl shrink-0 mt-1">{isUser ? '👤' : '🤖'}</span>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                    ${isUser ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                        code: ({ children }) => (
                          <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-xs">{children}</code>
                        ),
                      }}
                    >
                      {msg.content || '...'}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {renderOCRResult()}

        {/* 正在加载指示器 */}
        {(loading || ocrLoading) && (
          <div className="px-4 py-2">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        )}
      </div>

      {/* 输入栏 */}
      <div className="p-4 bg-white border-t shrink-0">
        <div className="flex items-end gap-2">
          {/* 图片上传按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrLoading}
            className="shrink-0 p-3 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-xl transition-colors disabled:opacity-50"
            title="上传账单截图"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageUpload}
            className="hidden"
          />

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="说说你的账单... (Enter 发送, Shift+Enter 换行)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm
                       focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="shrink-0 px-5 py-3 bg-primary-500 text-white rounded-xl font-medium
                       hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            发送
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          AI 可能产生不准确信息，请核对记账结果
        </p>
      </div>
    </div>
  );
}
