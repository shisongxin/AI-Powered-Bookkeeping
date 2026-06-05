/** AI 记账对话页面 — SSE 流式渲染 + 图片 OCR + 工具调用状态卡片 + 二次确认 */

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatApi } from '../api/chat';
import { ocrApi } from '../api/ocr';
import { categoriesApi } from '../api/categories';
import type { ChatMessage, SSEEvent, ConfirmRequired } from '../types/chat';
import type { OCRResponse, ExtractedItem } from '../types/ocr';
import type { CategoryResponse } from '../types/category';

/** 工具名称 → 中文状态文案 */
const TOOL_LABELS: Record<string, string> = {
  query_bills: '正在查询账单...',
  create_bill: '正在准备记账...',
  get_monthly_summary: '正在统计月度汇总...',
  get_category_breakdown: '正在分析分类分布...',
  get_trend: '正在计算消费趋势...',
  list_categories: '正在获取分类列表...',
  scan_receipt: '正在识别账单截图...',
  get_budget_status: '正在对比预算...',
  suggest_budget: '正在生成预算建议...',
};

const PERSONAS = [
  { value: '',        label: '🤖 默认' },
  { value: 'buddy',   label: '🔥 毒舌搭子' },
  { value: 'cat',     label: '🐱 猫咪管家' },
  { value: 'analyst', label: '📊 财务分析师' },
  { value: 'homie',   label: '🤝 老铁兄弟' },
];

export default function ChatPage() {
  // ---- 持久化状态 ----
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('billagent_messages');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [sessionId, setSessionId] = useState<string | null>(
    () => localStorage.getItem('billagent_session_id')
  );
  const [persona, setPersona] = useState(
    () => localStorage.getItem('billagent_persona') || ''
  );

  // ---- 本地状态 ----
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');       // 实时状态提示（原地更新）
  const [ocrResult, setOcrResult] = useState<OCRResponse | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [confirmMode, setConfirmMode] = useState(true);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);

  // 可编辑确认卡片
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamCtrlRef = useRef<AbortController | null>(null);

  // ---- 副作用 ----
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages, statusText]);

  // 会话持久化
  useEffect(() => { localStorage.setItem('billagent_messages', JSON.stringify(messages)); }, [messages]);
  useEffect(() => { if (sessionId) localStorage.setItem('billagent_session_id', sessionId); }, [sessionId]);
  useEffect(() => { localStorage.setItem('billagent_persona', persona); }, [persona]);

  // 加载分类列表（用于确认卡片的分类下拉）
  useEffect(() => { categoriesApi.list().then(setCategories).catch(() => {}); }, []);

  // ---- 消息操作 ----
  const addMsg = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  /** 向最后一条 assistant 消息追加内容，如不存在则新建 */
  const appendAssistant = useCallback((chunk: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
      }
      return [...prev, { role: 'assistant', content: chunk, timestamp: Date.now() }];
    });
  }, []);

  // ---- 确认/取消记账 ----
  const handleConfirm = useCallback((confirmData: ConfirmRequired, modifiedArgs?: Record<string, unknown>) => {
    if (!sessionId) return;
    setLoading(true);
    setStatusText('正在确认记账...');

    // 标记为已确认
    setMessages((prev) => prev.map((m) =>
      m.role === 'confirm_card' && m.confirmData?.tool_call_id === confirmData.tool_call_id
        ? { ...m, confirmed: true, rejected: false }
        : m
    ));

    // 预建 assistant 占位消息，确保流式 token 有处可追
    addMsg({ role: 'assistant', content: '', timestamp: Date.now() });

    streamCtrlRef.current = chatApi.confirmAction(
      { session_id: sessionId, action: 'confirm', modified_arguments: modifiedArgs },
      {
        onEvent: (evt: SSEEvent) => {
          switch (evt.event) {
            case 'status':
              setStatusText(evt.data);  // 原地更新，不追加到消息
              break;
            case 'tool_call': {
              try {
                const tc = JSON.parse(evt.data) as { tool_name: string };
                const label = TOOL_LABELS[tc.tool_name] || `正在执行 ${tc.tool_name}...`;
                addMsg({ role: 'tool_status', content: label, timestamp: Date.now() });
              } catch { /* */ }
              break;
            }
            case 'confirm_required': {
              try {
                const cr = JSON.parse(evt.data) as ConfirmRequired;
                addMsg({ role: 'confirm_card', content: '请确认记账', confirmData: cr, timestamp: Date.now() });
              } catch { /* */ }
              setStatusText('');
              setLoading(false);
              break;
            }
            case 'reply_chunk':
              setStatusText('');  // 首个 token 到达，清除状态提示
              appendAssistant(evt.data);
              break;
            case 'error':
              appendAssistant(`\n\n❌ ${evt.data}`);
              break;
          }
        },
        onError: (err) => {
          appendAssistant(`\n\n❌ 出错了: ${err.message}`);
          setStatusText('');
          setLoading(false);
        },
        onDone: (sid) => {
          if (sid) setSessionId(sid);
          setStatusText('');
          setLoading(false);
        },
      }
    );
  }, [sessionId, addMsg, appendAssistant]);

  const handleReject = useCallback((confirmData: ConfirmRequired) => {
    if (!sessionId) return;
    setLoading(true);
    setStatusText('正在取消...');

    setMessages((prev) => prev.map((m) =>
      m.role === 'confirm_card' && m.confirmData?.tool_call_id === confirmData.tool_call_id
        ? { ...m, confirmed: false, rejected: true }
        : m
    ));

    addMsg({ role: 'assistant', content: '', timestamp: Date.now() });

    streamCtrlRef.current = chatApi.confirmAction(
      { session_id: sessionId, action: 'reject' },
      {
        onEvent: (evt: SSEEvent) => {
          switch (evt.event) {
            case 'status':
              setStatusText(evt.data);
              break;
            case 'reply_chunk':
              setStatusText('');
              appendAssistant(evt.data);
              break;
            case 'error':
              appendAssistant(`\n\n❌ ${evt.data}`);
              break;
          }
        },
        onError: (err) => {
          appendAssistant(`\n\n❌ 出错了: ${err.message}`);
          setStatusText('');
          setLoading(false);
        },
        onDone: (sid) => {
          if (sid) setSessionId(sid);
          setStatusText('');
          setLoading(false);
        },
      }
    );
  }, [sessionId, addMsg, appendAssistant]);

  // ---- 发送消息 ----
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setOcrResult(null);
    setLoading(true);
    setStatusText('正在分析你的问题...');

    addMsg({ role: 'user', content: text, timestamp: Date.now() });
    // 预建 assistant 占位消息
    addMsg({ role: 'assistant', content: '', timestamp: Date.now() });

    streamCtrlRef.current = chatApi.sendStream(
      {
        message: text,
        session_id: sessionId,
        persona: persona || undefined,
        confirm_mode: confirmMode,
      },
      {
        onEvent: (evt: SSEEvent) => {
          switch (evt.event) {
            case 'status':
              setStatusText(evt.data);  // 原地更新
              break;

            case 'tool_call': {
              try {
                const tc = JSON.parse(evt.data) as { tool_name: string };
                const label = TOOL_LABELS[tc.tool_name] || `正在执行 ${tc.tool_name}...`;
                addMsg({ role: 'tool_status', content: label, timestamp: Date.now() });
              } catch { /* */ }
              break;
            }

            case 'confirm_required': {
              try {
                const cr = JSON.parse(evt.data) as ConfirmRequired;
                addMsg({ role: 'confirm_card', content: '请确认记账', confirmData: cr, timestamp: Date.now() });
              } catch { /* */ }
              break;
            }

            case 'reply_chunk':
              setStatusText('');  // 首个 token 到达，清除状态
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
          setStatusText('');
          setLoading(false);
        },
        onDone: (sid) => {
          if (sid) setSessionId(sid);
          setStatusText('');
          setLoading(false);
        },
      }
    );
  };

  // ---- 图片上传 OCR ----
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setStatusText('正在识别图片...');
    try {
      const result = await ocrApi.recognize(file);
      setOcrResult(result);

      const itemsStr = result.items
        .map((it: ExtractedItem) =>
          `- ${it.payee || '未知商户'} | ${it.amount ?? '?'}元 | ${it.category || '未分类'} | ${it.transaction_date || ''}`
        )
        .join('\n');

      const ocrMsg = `📸 OCR 识别结果 (${result.confidence}):\n${itemsStr}`;
      addMsg({ role: 'user', content: ocrMsg, timestamp: Date.now() });

      if (result.items.length > 0 && result.confidence !== 'low') {
        const aiPrompt = `请根据以下 OCR 识别的交易记录帮我逐条创建账单：\n${itemsStr}`;
        addMsg({ role: 'assistant', content: '', timestamp: Date.now() });
        setStatusText('正在分析识别结果...');

        streamCtrlRef.current = chatApi.sendStream(
          { message: aiPrompt, session_id: sessionId, persona: persona || undefined, confirm_mode: confirmMode },
          {
            onEvent: (evt: SSEEvent) => {
              if (evt.event === 'status') { setStatusText(evt.data); }
              if (evt.event === 'reply_chunk') { setStatusText(''); appendAssistant(evt.data); }
              if (evt.event === 'tool_call') {
                try {
                  const tc = JSON.parse(evt.data) as { tool_name: string };
                  const label = TOOL_LABELS[tc.tool_name] || `正在执行 ${tc.tool_name}...`;
                  addMsg({ role: 'tool_status', content: label, timestamp: Date.now() });
                } catch { /* */ }
              }
              if (evt.event === 'confirm_required') {
                try {
                  const cr = JSON.parse(evt.data) as ConfirmRequired;
                  addMsg({ role: 'confirm_card', content: '请确认记账', confirmData: cr, timestamp: Date.now() });
                } catch { /* */ }
              }
            },
            onError: (err) => { appendAssistant(`\n\n❌ ${err.message}`); setStatusText(''); },
            onDone: () => { setOcrLoading(false); setStatusText(''); },
          }
        );
      } else {
        setOcrLoading(false);
        setStatusText('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      addMsg({ role: 'assistant', content: `❌ OCR 识别失败: ${msg}`, timestamp: Date.now() });
      setOcrLoading(false);
      setStatusText('');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ---- 渲染确认卡片（支持编辑 + 分类下拉） ----
  const renderConfirmCard = (
    msg: ChatMessage,
    onConfirm: (data: ConfirmRequired, modifiedArgs?: Record<string, unknown>) => void,
    onReject: (data: ConfirmRequired) => void,
  ) => {
    const args = msg.confirmData?.arguments;
    const tcId = msg.confirmData?.tool_call_id || '';
    if (!args) return null;

    const isEditing = editingCardId === tcId;
    const displayArgs = isEditing ? { ...args, ...editForm } : args;
    const amount = displayArgs.amount as number | undefined;
    const isExpense = amount != null && amount < 0;

    const startEdit = () => {
      setEditingCardId(tcId);
      setEditForm({
        amount: String(args.amount ?? ''),
        category: String(args.category ?? ''),
        payee: String(args.payee ?? ''),
        description: String(args.description ?? ''),
        transaction_date: String(args.transaction_date ?? ''),
        payment_method: String(args.payment_method ?? ''),
      });
    };

    const cancelEdit = () => {
      setEditingCardId(null);
      setEditForm({});
    };

    const confirmWithEdit = () => {
      const modified: Record<string, unknown> = {};
      const editAmount = parseFloat(editForm.amount);
      if (!isNaN(editAmount)) modified.amount = editAmount;
      if (editForm.category) modified.category = editForm.category;
      if (editForm.payee) modified.payee = editForm.payee;
      if (editForm.description) modified.description = editForm.description;
      if (editForm.transaction_date) modified.transaction_date = editForm.transaction_date;
      if (editForm.payment_method) modified.payment_method = editForm.payment_method;
      onConfirm(msg.confirmData!, modified);
      setEditingCardId(null);
      setEditForm({});
    };

    const updateField = (field: string, value: string) => {
      setEditForm((prev) => ({ ...prev, [field]: value }));
    };

    // 已确认
    if (msg.confirmed) {
      return (
        <div className="flex items-center gap-2 my-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl shadow-sm">
          <span className="text-lg">✅</span>
          <span className="text-sm text-green-700 font-medium">已确认记账</span>
          <span className="text-xs text-green-500 ml-auto">
            {String(args.payee || '')} {amount != null ? `${Math.abs(amount).toFixed(2)}元` : ''}
          </span>
        </div>
      );
    }

    // 已取消
    if (msg.rejected) {
      return (
        <div className="flex items-center gap-2 my-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
          <span className="text-lg">❌</span>
          <span className="text-sm text-gray-500">已取消记账</span>
        </div>
      );
    }

    // 待确认
    return (
      <div className="my-2 px-4 py-3 bg-amber-50/80 border border-amber-200 rounded-xl shadow-sm backdrop-blur">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">⚠️</span>
          <span className="font-semibold text-amber-800 text-sm">确认记账？</span>
          <span className="text-xs text-amber-500 ml-auto">
            {isEditing ? '✏️ 修改账单信息' : 'AI 将创建此账单'}
          </span>
        </div>

        {/* 账单详情 / 编辑表单 */}
        <div className="bg-white rounded-lg p-3 mb-3 space-y-1.5 text-sm border border-amber-100">
          {isEditing ? (
            <>
              <EditField label="金额" value={editForm.amount}
                onChange={(v) => updateField('amount', v)} type="number" hint="支出为负数" />
              {/* 分类下拉 */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-16 shrink-0 text-xs">分类</span>
                <select
                  value={editForm.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary-500 bg-white"
                >
                  <option value="">选择分类</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.icon || '📁'} {c.name}</option>
                  ))}
                </select>
              </div>
              <EditField label="商户" value={editForm.payee}
                onChange={(v) => updateField('payee', v)} />
              <EditField label="描述" value={editForm.description}
                onChange={(v) => updateField('description', v)} />
              <EditField label="日期" value={editForm.transaction_date}
                onChange={(v) => updateField('transaction_date', v)} type="date" />
              <EditField label="支付方式" value={editForm.payment_method}
                onChange={(v) => updateField('payment_method', v)} />
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">金额</span>
                <span className={`font-bold ${isExpense ? 'text-red-600' : 'text-green-600'}`}>
                  {amount != null ? `${isExpense ? '-' : '+'}${Math.abs(amount).toFixed(2)}元` : '未知'}
                </span>
              </div>
              {displayArgs.category ? (
                <div className="flex justify-between">
                  <span className="text-gray-500">分类</span>
                  <span className="text-gray-700">{String(displayArgs.category)}</span>
                </div>
              ) : null}
              {displayArgs.payee ? (
                <div className="flex justify-between">
                  <span className="text-gray-500">商户</span>
                  <span className="text-gray-700">{String(displayArgs.payee)}</span>
                </div>
              ) : null}
              {displayArgs.description ? (
                <div className="flex justify-between">
                  <span className="text-gray-500">描述</span>
                  <span className="text-gray-700">{String(displayArgs.description)}</span>
                </div>
              ) : null}
              {displayArgs.transaction_date ? (
                <div className="flex justify-between">
                  <span className="text-gray-500">日期</span>
                  <span className="text-gray-700">{String(displayArgs.transaction_date)}</span>
                </div>
              ) : null}
              {displayArgs.payment_method ? (
                <div className="flex justify-between">
                  <span className="text-gray-500">支付方式</span>
                  <span className="text-gray-700">{String(displayArgs.payment_method)}</span>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={confirmWithEdit}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors shadow-sm">
                ✅ 确认修改并记账
              </button>
              <button onClick={cancelEdit}
                className="flex-1 px-4 py-2 bg-white text-gray-500 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                取消修改
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onConfirm(msg.confirmData!)}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors shadow-sm">
                ✅ 确认记账
              </button>
              <button onClick={startEdit}
                className="px-4 py-2 bg-white text-blue-500 border border-blue-300 rounded-lg text-sm hover:bg-blue-50 transition-colors">
                ✏️ 修改
              </button>
              <button onClick={() => onReject(msg.confirmData!)}
                className="px-4 py-2 bg-white text-gray-500 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                取消
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // ---- 渲染工具状态卡片 ----
  const renderToolCard = (label: string) => (
    <div className="flex items-center gap-3 my-2 px-4 py-3 bg-blue-50/80 border border-blue-200 rounded-xl shadow-sm">
      <span className="text-lg">⚙️</span>
      <span className="text-sm text-blue-700 font-medium">{label}</span>
      <div className="flex gap-1 ml-auto">
        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
      </div>
    </div>
  );

  // ---- 渲染 OCR 结果卡片 ----
  const renderOCRResult = () => {
    if (!ocrResult) return null;
    return (
      <div className="mx-4 my-3 p-4 bg-green-50/80 border border-green-200 rounded-xl shadow-sm">
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
      <header className="flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur border-b shrink-0">
        <h1 className="text-xl font-bold text-gray-800">🤖 AI 智能记账</h1>
        <div className="flex items-center gap-3">
          {/* 二次确认开关 */}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
            title="开启后，AI 创建账单前需要你确认">
            <input type="checkbox" checked={confirmMode} onChange={(e) => setConfirmMode(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-primary-500" />
            <span className={`${confirmMode ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>确认</span>
          </label>

          <select
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:border-primary-500"
          >
            {PERSONAS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setMessages([]);
              setSessionId(null);
              setOcrResult(null);
              setStatusText('');
              localStorage.removeItem('billagent_messages');
              localStorage.removeItem('billagent_session_id');
            }}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            新对话
          </button>
        </div>
      </header>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20 px-4">
            <p className="text-5xl mb-4">💬</p>
            <p className="text-lg font-medium text-gray-600">开始对话记账吧！</p>
            <p className="text-sm mt-2">试试说 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">今天午餐麦当劳35元</code></p>
            <p className="text-sm mt-1">或 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">这个月花了多少</code></p>
            <p className="text-sm mt-3 text-gray-300">也可以点击 📎 上传账单截图自动识别记账</p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'confirm_card') {
            return (
              <div key={i} className="px-4 py-1">
                {renderConfirmCard(msg, handleConfirm, handleReject)}
              </div>
            );
          }
          if (msg.role === 'tool_status') {
            return <div key={i}>{renderToolCard(msg.content)}</div>;
          }
          const isUser = msg.role === 'user';
          // 跳过空的 assistant 占位消息（等待流式填充中）
          if (!isUser && !msg.content && statusText) return null;

          return (
            <div key={i} className={`px-4 py-1 ${isUser ? '' : 'bg-gray-50/50'}`}>
              <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                <span className="text-2xl shrink-0 mt-1">{isUser ? '👤' : '🤖'}</span>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
                    ${isUser
                      ? 'bg-primary-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'}`}
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

        {/* 实时状态指示器（原地更新，不累积） */}
        {statusText && (
          <div className="px-4 py-1">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl shadow-sm">
              <span className="text-lg">💭</span>
              <span className="text-sm text-indigo-700 font-medium">{statusText}</span>
              <div className="flex gap-1 ml-auto">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}

        {/* 加载指示器（无状态文本时显示） */}
        {(loading || ocrLoading) && !statusText && (
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
      <div className="p-4 bg-white/90 backdrop-blur border-t shrink-0">
        <div className="flex items-end gap-2">
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
                       focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                       placeholder:text-gray-300"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="shrink-0 px-5 py-3 bg-primary-500 text-white rounded-xl font-medium
                       hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
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

/** 确认卡片中的可编辑字段子组件 */
function EditField({ label, value, onChange, type = 'text', hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 w-16 shrink-0 text-xs">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary-500"
        placeholder={hint}
      />
    </div>
  );
}
