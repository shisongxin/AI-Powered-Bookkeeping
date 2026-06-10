/** AI Chat — premium bubbles, in-place status, editable confirm cards */

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatApi } from '../api/chat';
import { ocrApi } from '../api/ocr';
import { categoriesApi } from '../api/categories';
import ContentBlockRenderer from '../components/ContentBlockRenderer';
import type { ChatMessage, SSEEvent, ConfirmRequired, ContentBlock } from '../types/chat';
import type { OCRResponse, ExtractedItem } from '../types/ocr';
import type { CategoryResponse } from '../types/category';

const TOOL_LABELS: Record<string, string> = {
  query_bills: '查询账单中...',
  create_bill: '准备记账...',
  get_monthly_summary: '统计月度汇总...',
  get_category_breakdown: '分析分类分布...',
  get_trend: '计算消费趋势...',
  list_categories: '获取分类列表...',
  scan_receipt: '识别账单截图...',
  get_budget_status: '对比预算数据...',
  suggest_budget: '生成预算建议...',
};

const PERSONAS = [
  { value: '',        label: '默认风格' },
  { value: 'buddy',   label: '🔥 毒舌搭子' },
  { value: 'cat',     label: '🐱 猫咪管家' },
  { value: 'analyst', label: '📊 财务分析师' },
  { value: 'homie',   label: '🤝 老铁兄弟' },
];

/** ReactMarkdown 组件映射 — 完整支持表格/标题/列表/引用/代码块 */
const MARKDOWN_COMPONENTS: Record<string, React.FC<any>> = {
  // 标题
  h1: ({ children }) => <h1 className="text-lg font-bold text-espresso-800 mt-3 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold text-espresso-800 mt-3 mb-2 border-b border-espresso-100 pb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-espresso-700 mt-2 mb-1.5">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-semibold text-espresso-600 mt-2 mb-1">{children}</h4>,
  h5: ({ children }) => <h5 className="text-xs font-semibold text-espresso-600 mt-1.5 mb-1">{children}</h5>,
  h6: ({ children }) => <h6 className="text-xs font-medium text-espresso-500 mt-1.5 mb-1">{children}</h6>,
  // 段落
  p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
  // 内联代码
  code: ({ className, children }) => {
    const isInline = !className;
    return isInline
      ? <code className="bg-gold-100 text-gold-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
      : <code className="block bg-espresso-800 text-emerald-400 p-3 rounded-xl text-xs font-mono overflow-x-auto my-2">{children}</code>;
  },
  // 代码块
  pre: ({ children }) => <pre className="bg-espresso-800 text-emerald-400 p-3 rounded-xl text-xs font-mono overflow-x-auto my-2">{children}</pre>,
  // 表格
  table: ({ children }) => (
    <div className="overflow-x-auto my-2 rounded-xl border border-espresso-100">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-espresso-50">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-espresso-50">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-espresso-600 text-[11px] uppercase tracking-wider border-b border-espresso-100">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 text-espresso-700 whitespace-nowrap">{children}</td>,
  // 列表
  ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5 text-sm">{children}</ol>,
  li: ({ children }) => <li className="text-espresso-700">{children}</li>,
  // 引用
  blockquote: ({ children }) => (
    <blockquote className="border-l-3 border-gold-400 bg-gold-50/50 pl-3 py-2 my-2 rounded-r-lg text-sm text-espresso-600 italic">{children}</blockquote>
  ),
  // 强调
  strong: ({ children }) => <strong className="font-semibold text-espresso-800">{children}</strong>,
  em: ({ children }) => <em className="italic text-espresso-600">{children}</em>,
  // 链接
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-gold-600 underline hover:text-gold-700">{children}</a>,
  // 分割线
  hr: () => <hr className="my-3 border-espresso-100" />,
};

/**
 * 规范化 Markdown 内容 —— 修复 LLM 输出中常见的换行缺失：
 * 将同一行内粘连的表格行拆分，并在表格前插入 GFM 要求的空行。
 */
function normalizeMarkdown(content: string): string {
  if (!content) return content;

  // 1. 拆分粘连的表格行：每个 |...| 单元格后跟空格和另一个 | 时插入 \n
  //    匹配: | 内容 | 后跟空白和 | (非分隔行)
  //    例如: "| 餐饮 | 347元 | | 购物 |" → "| 餐饮 | 347元 |\n| 购物 |"
  let fixed = content.replace(/(\|[^|\n]+\|)\s+(?=\|[^-])/g, '$1\n');

  // 2. 表格分隔行（|---|---|）后紧跟内容时补换行
  //    例如: "|------|------| | 餐饮 |" → "|------|------|\n| 餐饮 |"
  fixed = fixed.replace(/(\|[-\s|:]+\|)\s+(?=\|)/g, '$1\n');

  // 3. 非 | 字符后紧跟 | (且 | 后跟非 - 字符 = 不是分隔行)
  //    例如: "支出构成| 分类 |" → "支出构成\n\n| 分类 |"
  //    只在 | 前字符不是 |, -, :, 空格时触发 (避免破坏表格分隔行)
  fixed = fixed.replace(/([^|\-:\s\n])\|(?=[^-\n])/g, '$1\n\n|');

  return fixed;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { const s = localStorage.getItem('billagent_messages'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('billagent_session_id'));
  const [persona, setPersona] = useState(() => localStorage.getItem('billagent_persona') || '');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [ocrResult, setOcrResult] = useState<OCRResponse | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [confirmMode, setConfirmMode] = useState(true);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  // per-bill editing state now managed inside ConfirmCard component

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamCtrlRef = useRef<AbortController | null>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages, statusText]);
  useEffect(() => { localStorage.setItem('billagent_messages', JSON.stringify(messages)); }, [messages]);
  useEffect(() => { if (sessionId) localStorage.setItem('billagent_session_id', sessionId); }, [sessionId]);
  useEffect(() => { localStorage.setItem('billagent_persona', persona); }, [persona]);
  useEffect(() => { categoriesApi.list().then(setCategories).catch(() => {}); }, []);

  const addMsg = useCallback((msg: ChatMessage) => setMessages(p => [...p, msg]), []);
  const appendAssistant = useCallback((chunk: string) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
      return [...prev, { role: 'assistant', content: chunk, timestamp: Date.now() }];
    });
  }, []);

  // ---- SSE event helpers ----
  const makeSSEHandler = (): (evt: SSEEvent) => void => (evt) => {
    switch (evt.event) {
      case 'status': setStatusText(evt.data); break;
      case 'tool_call': {
        try { setStatusText(TOOL_LABELS[JSON.parse(evt.data).tool_name] || '处理中...'); } catch { /* */ }
        break;
      }
      case 'confirm_required': {
        try { addMsg({ role: 'confirm_card', content: '请确认记账', confirmData: JSON.parse(evt.data), timestamp: Date.now() }); }
        catch { /* */ }
        break;
      }
      
      case 'reply_chunk': setStatusText(''); appendAssistant(evt.data); break;
      case 'content_block': {
        setStatusText('');
        try {
          const block = JSON.parse(evt.data) as ContentBlock;
          setMessages(prev => {
            let idx = prev.length - 1;
            while (idx >= 0 && prev[idx].role !== 'assistant') idx--;
            if (idx >= 0) {
              const target = prev[idx];
              return [...prev.slice(0, idx), {
                ...target,
                blocks: [...(target.blocks || []), block],
              }, ...prev.slice(idx + 1)];
            }
            return [...prev, { role: 'assistant', content: '', blocks: [block], timestamp: Date.now() }];
          });
        } catch { /* */ }
        break;
      }
      case 'done': try { const d = JSON.parse(evt.data); if (d.session_id) setSessionId(d.session_id); } catch { /* */ } break;
      case 'error': appendAssistant(`\n\n❌ ${evt.data}`); break;
    }
  };
  const makeErrorHandler = (): (err: Error) => void => (err) => {
    appendAssistant(`\n\n❌ ${err.message}`); setStatusText(''); setLoading(false);
  };

  // ---- Confirm / Reject (batch) ----
  const handleConfirm = useCallback((cd: ConfirmRequired, modifiedArgs?: Record<string, unknown>[], rejectIds?: string[]) => {
    if (!sessionId) return;
    const keepCount = cd.bills.length - (rejectIds?.length || 0);
    setLoading(true); setStatusText(`确认 ${keepCount} 笔记账...`);
    setMessages(p => p.map(m => m.role === 'confirm_card' ? { ...m, confirmed: true, rejected: false } : m));
    addMsg({ role: 'assistant', content: '', timestamp: Date.now() });
    streamCtrlRef.current = chatApi.confirmAction(
      { session_id: sessionId, action: 'confirm', modified_arguments: modifiedArgs, reject_ids: rejectIds },
      { onEvent: makeSSEHandler(), onError: makeErrorHandler(), onDone: (sid) => { if (sid) setSessionId(sid); setStatusText(''); setLoading(false); } }
    );
  }, [sessionId, addMsg, appendAssistant]);

  const handleReject = useCallback((cd: ConfirmRequired) => {
    if (!sessionId) return;
    setLoading(true); setStatusText('取消中...');
    setMessages(p => p.map(m => m.role === 'confirm_card' ? { ...m, confirmed: false, rejected: true } : m));
    addMsg({ role: 'assistant', content: '', timestamp: Date.now() });
    streamCtrlRef.current = chatApi.confirmAction(
      { session_id: sessionId, action: 'reject' },
      { onEvent: makeSSEHandler(), onError: makeErrorHandler(), onDone: (sid) => { if (sid) setSessionId(sid); setStatusText(''); setLoading(false); } }
    );
  }, [sessionId, addMsg, appendAssistant]);

  // ---- Send ----
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput(''); setOcrResult(null); setLoading(true); setStatusText('分析中...');
    addMsg({ role: 'user', content: text, timestamp: Date.now() });
    addMsg({ role: 'assistant', content: '', timestamp: Date.now() });
    streamCtrlRef.current = chatApi.sendStream(
      { message: text, session_id: sessionId, persona: persona || undefined, confirm_mode: confirmMode },
      { onEvent: makeSSEHandler(), onError: makeErrorHandler(), onDone: (sid) => { if (sid) setSessionId(sid); setStatusText(''); setLoading(false); } }
    );
  };

  // ---- OCR ----
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setOcrLoading(true); setStatusText('识别图片中...');
    try {
      const result = await ocrApi.recognize(file);
      setOcrResult(result);
      const itemsStr = result.items.map((it: ExtractedItem) =>
        `- ${it.payee || '未知商户'} | ${it.amount ?? '?'}元 | ${it.category || '未分类'} | ${it.transaction_date || ''}`).join('\n');
      addMsg({ role: 'user', content: `📸 OCR 识别结果 (${result.confidence}):\n${itemsStr}`, timestamp: Date.now() });
      if (result.items.length > 0 && result.confidence !== 'low') {
        addMsg({ role: 'assistant', content: '', timestamp: Date.now() }); setStatusText('分析识别结果...');
        streamCtrlRef.current = chatApi.sendStream(
          { message: `请根据以下 OCR 识别的交易记录帮我逐条创建账单：\n${itemsStr}`, session_id: sessionId, persona: persona || undefined, confirm_mode: confirmMode },
          { onEvent: makeSSEHandler(), onError: makeErrorHandler(), onDone: () => { setOcrLoading(false); setStatusText(''); } }
        );
      } else { setOcrLoading(false); setStatusText(''); }
    } catch (err: unknown) {
      addMsg({ role: 'assistant', content: `❌ OCR 失败: ${err instanceof Error ? err.message : '未知错误'}`, timestamp: Date.now() });
      setOcrLoading(false); setStatusText('');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/60 backdrop-blur-xl border-b border-espresso-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-gold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-espresso-800 font-display">AI 智能记账</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all
            ${confirmMode ? 'bg-gold-100 text-gold-800' : 'bg-espresso-100 text-espresso-500'}`}>
            <input type="checkbox" checked={confirmMode} onChange={e => setConfirmMode(e.target.checked)} className="w-3 h-3 rounded accent-gold-500" />
            确认模式
          </label>
          <select value={persona} onChange={e => setPersona(e.target.value)}
            className="select-field !py-1.5 !text-xs !w-auto">
            {PERSONAS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button onClick={() => { setMessages([]); setSessionId(null); setOcrResult(null); setStatusText(''); localStorage.removeItem('billagent_messages'); localStorage.removeItem('billagent_session_id'); }}
            className="btn-ghost !text-xs !py-1.5">新对话</button>
        </div>
      </header>

      {/* Messages — 独占剩余空间，内部滚动 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-6 px-4 space-y-2 min-h-0">
        {messages.length === 0 && (
          <div className="text-center mt-24 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-gold-lg">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-espresso-600 font-display font-bold text-lg">开始对话记账</p>
            <p className="text-espresso-400 text-sm mt-2">
              试试说 <code className="bg-gold-100 text-gold-800 px-2 py-0.5 rounded-md text-xs font-mono">今天午餐麦当劳35元</code>
            </p>
            <p className="text-espresso-300 text-xs mt-1.5">或点击 📎 上传账单截图自动识别</p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'confirm_card') return <ConfirmCard key={i} msg={msg} categories={categories} onConfirm={handleConfirm} onReject={handleReject} />;
          if (msg.role === 'tool_status') return null;
          const isUser = msg.role === 'user';
          if (!isUser && !msg.content && (!msg.blocks || msg.blocks.length === 0)) return null;

          return (
            <div key={i} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-slide-up`}>
              <div className={`w-8 h-8 rounded-xl shrink-0 mt-1 flex items-center justify-center text-sm
                ${isUser ? 'bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-gold' : 'bg-white border border-espresso-100 text-espresso-500 shadow-sm'}`}>
                {isUser ? '我' : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                )}
              </div>
              <div className={`max-w-[78%] ${isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                {isUser ? <p className="whitespace-pre-wrap">{msg.content}</p> : (
                  msg.blocks && msg.blocks.length > 0 ? (
                    <div className="space-y-0.5">
                      {msg.blocks.map((block, bi) => <ContentBlockRenderer key={bi} block={block} />)}
                    </div>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                      {normalizeMarkdown(msg.content) || '…'}
                    </ReactMarkdown>
                  )
                )}
              </div>
            </div>
          );
        })}

        {ocrResult && <OCRCard result={ocrResult} />}

        {/* In-place status indicator */}
        {statusText && (
          <div className="flex justify-center py-1 animate-scale-in">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/80 backdrop-blur border border-espresso-100 rounded-full shadow-sm">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gold-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-1.5 h-1.5 bg-gold-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 bg-gold-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </span>
              <span className="text-xs text-espresso-500 font-medium">{statusText}</span>
            </div>
          </div>
        )}

        {(loading || ocrLoading) && !statusText && (
          <div className="flex justify-center py-2">
            <span className="flex gap-1.5">
              <span className="w-2 h-2 bg-espresso-300 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-espresso-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-2 h-2 bg-espresso-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-white/60 backdrop-blur-xl border-t border-espresso-100 shrink-0">
        <div className="flex items-end gap-2">
          <button onClick={() => fileInputRef.current?.click()} disabled={ocrLoading}
            className="shrink-0 p-3 text-espresso-400 hover:text-gold-500 hover:bg-gold-50 rounded-xl transition-all disabled:opacity-40">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} className="hidden" />
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="说说你的账单…" rows={1}
            className="flex-1 resize-none bg-espresso-50/80 border border-espresso-200 rounded-2xl px-4 py-3 text-sm
                       focus:outline-none focus:border-gold-400 focus:bg-white placeholder:text-espresso-300 transition-all"
            disabled={loading} />
          <button onClick={handleSend} disabled={loading || !input.trim()}
            className="shrink-0 w-11 h-11 bg-gradient-to-br from-gold-400 to-gold-600 rounded-2xl flex items-center justify-center
                       hover:shadow-gold-lg disabled:opacity-30 disabled:hover:shadow-none transition-all active:scale-95">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Confirm Card ===== */
function ConfirmCard({ msg, categories, onConfirm, onReject }: {
  msg: ChatMessage; categories: CategoryResponse[];
  onConfirm: (d: ConfirmRequired, m?: Record<string, unknown>[], rejectIds?: string[]) => void;
  onReject: (d: ConfirmRequired) => void;
}) {
  const bills = msg.confirmData?.bills;
  if (!bills || bills.length === 0) return null;

  // per-bill state: { [tcId]: { editing, editForm } }
  const [states, setStates] = useState<Record<string, { editing: boolean; editForm: Record<string, string> }>>({});
  // 被逐条移除的账单
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const startEdit = (tcId: string, args: Record<string, unknown>) => {
    setStates(p => ({ ...p, [tcId]: { editing: true, editForm: {
      amount: String(args.amount ?? ''), category: String(args.category ?? ''),
      payee: String(args.payee ?? ''), description: String(args.description ?? ''),
      transaction_date: String(args.transaction_date ?? ''), payment_method: String(args.payment_method ?? ''),
    }}}));
  };
  const cancelEdit = (tcId: string) => {
    setStates(p => { const n = { ...p }; delete n[tcId]; return n; });
  };
  const updateField = (tcId: string, field: string, value: string) => {
    setStates(p => ({ ...p, [tcId]: { ...p[tcId], editForm: { ...p[tcId]?.editForm, [field]: value } } }));
  };

  const handleConfirmAll = () => {
    // 如果全部被移除，等同于取消全部
    if (removed.size >= bills.length) {
      onReject(msg.confirmData!);
      return;
    }
    // Build modified_arguments from per-bill edit forms (exclude removed)
    const modified: Record<string, unknown>[] = [];
    for (const bill of bills) {
      if (removed.has(bill.tool_call_id)) continue;
      const st = states[bill.tool_call_id];
      if (st?.editing && st.editForm) {
        const m: Record<string, unknown> = { tool_call_id: bill.tool_call_id };
        const a = parseFloat(st.editForm.amount);
        if (!isNaN(a)) m.amount = a;
        if (st.editForm.category) m.category = st.editForm.category;
        if (st.editForm.payee) m.payee = st.editForm.payee;
        if (st.editForm.description) m.description = st.editForm.description;
        if (st.editForm.transaction_date) m.transaction_date = st.editForm.transaction_date;
        if (st.editForm.payment_method) m.payment_method = st.editForm.payment_method;
        modified.push(m);
      }
    }
    onConfirm(msg.confirmData!, modified.length > 0 ? modified : undefined, Array.from(removed));
  };

  // Already confirmed or rejected
  if (msg.confirmed) return (
    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-sm animate-scale-in">
      <span>✅</span><span className="text-emerald-700 font-medium">已记账 {bills.length - removed.size} 笔</span>
      <span className="text-emerald-500 text-xs ml-auto">
        {bills.map(b => String(b.arguments.payee || '')).filter(Boolean).join('、')}
      </span>
    </div>
  );
  if (msg.rejected) return (
    <div className="flex items-center gap-2 px-4 py-2 bg-espresso-50 border border-espresso-100 rounded-xl text-sm animate-scale-in">
      <span>❌</span><span className="text-espresso-500">已取消全部</span>
    </div>
  );

  return (
    <div className="confirm-card animate-scale-in">
      <div className="flex items-center gap-2 mb-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold-600"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span className="font-semibold text-gold-800 text-sm">
          确认 {bills.length - removed.size} 笔记账？
          {removed.size > 0 && <span className="text-coral-500 text-xs ml-1">(已忽略 {removed.size} 笔)</span>}
        </span>
        <span className="text-xs text-gold-500 ml-auto">AI 生成</span>
      </div>

      {/* 每条账单一个卡片 */}
      <div className="space-y-2 mb-3 max-h-[360px] overflow-y-auto">
        {bills.filter(b => !removed.has(b.tool_call_id)).map((bill, idx) => {
          const tcId = bill.tool_call_id;
          const st = states[tcId];
          const isEditing = st?.editing;
          const args = isEditing ? { ...bill.arguments, ...st.editForm } : bill.arguments;
          const amount = args.amount as number | undefined;
          const isExpense = amount != null && amount < 0;

          return (
            <div key={tcId} className="bg-white rounded-xl p-3 text-sm border border-gold-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-espresso-500">#{idx + 1}</span>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); setRemoved(p => new Set([...p, tcId])); }}
                    className="text-xs text-coral-500 hover:text-coral-700 hover:bg-coral-50 rounded px-1.5 py-0.5 transition-colors" title="从批量中移除此账单">
                    ✕ 忽略
                  </button>
                  <span className={`text-xs font-bold ${isExpense ? 'text-coral-600' : 'text-emerald-600'}`}>
                    {amount != null ? `${isExpense ? '−' : '+'}${Math.abs(amount).toFixed(2)} 元` : '?'}
                  </span>
                </div>
              </div>
              {isEditing ? (
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-1">
                    <div><label className="text-[10px] text-espresso-400">金额</label>
                      <input type="number" step="0.01" value={st.editForm.amount} onChange={e => updateField(tcId, 'amount', e.target.value)} className="w-full border border-espresso-200 rounded px-1.5 py-0.5 text-xs" /></div>
                    <div><label className="text-[10px] text-espresso-400">分类</label>
                      <select value={st.editForm.category} onChange={e => updateField(tcId, 'category', e.target.value)} className="w-full border border-espresso-200 rounded px-1.5 py-0.5 text-xs bg-white">
                        <option value="">选择</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select></div>
                    <div><label className="text-[10px] text-espresso-400">商户</label>
                      <input value={st.editForm.payee} onChange={e => updateField(tcId, 'payee', e.target.value)} className="w-full border border-espresso-200 rounded px-1.5 py-0.5 text-xs" /></div>
                    <div><label className="text-[10px] text-espresso-400">描述</label>
                      <input value={st.editForm.description} onChange={e => updateField(tcId, 'description', e.target.value)} className="w-full border border-espresso-200 rounded px-1.5 py-0.5 text-xs" /></div>
                    <div><label className="text-[10px] text-espresso-400">日期</label>
                      <input type="date" value={st.editForm.transaction_date} onChange={e => updateField(tcId, 'transaction_date', e.target.value)} className="w-full border border-espresso-200 rounded px-1.5 py-0.5 text-xs" /></div>
                    <div><label className="text-[10px] text-espresso-400">支付</label>
                      <input value={st.editForm.payment_method} onChange={e => updateField(tcId, 'payment_method', e.target.value)} className="w-full border border-espresso-200 rounded px-1.5 py-0.5 text-xs" /></div>
                  </div>
                  <button onClick={() => cancelEdit(tcId)} className="text-xs text-gold-600 hover:text-gold-700 mt-1">完成编辑</button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {args.payee ? <div className="text-espresso-700 font-medium">{String(args.payee)}</div> : null}
                  <div className="flex flex-wrap gap-x-3 text-xs text-espresso-400">
                    {args.category ? <span>{String(args.category)}</span> : null}
                    {args.transaction_date ? <span>{String(args.transaction_date)}</span> : null}
                    {args.description ? <span className="truncate max-w-[120px]">{String(args.description)}</span> : null}
                  </div>
                  <button onClick={() => startEdit(tcId, bill.arguments)} className="text-xs text-blue-500 hover:text-blue-600 mt-0.5">✏️ 编辑</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button onClick={handleConfirmAll} className="flex-1 btn-primary !text-sm justify-center">✅ 确认全部</button>
        <button onClick={() => onReject(msg.confirmData!)} className="btn-ghost !text-sm !text-espresso-400">取消全部</button>
      </div>
    </div>
  );
}

function DRow({ label, value, emp }: { label: string; value: string; emp?: boolean }) {
  return <div className="flex justify-between"><span className="text-espresso-400">{label}</span><span className={emp ? 'font-semibold text-espresso-800' : 'text-espresso-600'}>{value}</span></div>;
}
function EF({ label, v, onChange, type, hint }: { label: string; v: string; onChange: (s: string) => void; type?: string; hint?: string }) {
  return <div className="flex items-center gap-2"><span className="text-espresso-400 w-14 shrink-0 text-xs">{label}</span><input type={type || 'text'} value={v} onChange={e => onChange(e.target.value)} className="flex-1 border border-espresso-200 rounded-lg px-2 py-1 text-sm" placeholder={hint} /></div>;
}

function OCRCard({ result }: { result: OCRResponse }) {
  return (
    <div className="mx-4 my-3 p-4 bg-emerald-50/80 border border-emerald-100 rounded-2xl animate-scale-in">
      <div className="flex items-center gap-2 mb-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <span className="font-semibold text-emerald-800 text-sm">OCR 识别完成 · {result.items.length} 条记录</span>
      </div>
      <div className="space-y-2">
        {result.items.map((item, i) => (
          <div key={i} className="flex flex-wrap gap-x-4 gap-y-1 text-sm bg-white rounded-xl px-4 py-2.5 shadow-sm">
            <span className="font-medium text-espresso-800">{item.payee || '未知商户'}</span>
            <span className={item.amount && item.amount < 0 ? 'text-coral-600 font-medium' : 'text-emerald-600 font-medium'}>{item.amount != null ? `${item.amount}元` : ''}</span>
            <span className="text-espresso-400">{item.category || ''}</span>
            <span className="text-espresso-300 text-xs">{item.transaction_date || ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
