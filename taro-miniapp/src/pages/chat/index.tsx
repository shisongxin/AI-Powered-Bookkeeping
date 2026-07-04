/**
 * AI Chat — 对话式智能记账
 * Mirrors web/ChatPage design for Taro Mini Program
 */

/**
 * AI 对话记账页面 — 对齐网页端 ChatPage.tsx
 * 功能：SSE 流式对话、批量确认记账、角色切换、OCR 图片上传、内容块渲染
 * 支持 7 种结构化内容块：text, heading, summary, table, bill_list, callout, divider
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, Textarea, Button, Input, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useAuth } from '../../shared/hooks/useAuth'
import { sendMessage, getChatHistory, getCategories } from '../../shared/api/client'
import { useDataStore } from '../../shared/stores/useDataStore'
import ContentBlockRenderer from '../../shared/components/ContentBlockRenderer'
import './index.css'

// ---- Types ----

interface BillArgs {
  amount?: number
  category?: string
  payee?: string
  description?: string
  transaction_date?: string
  payment_method?: string
}

interface ConfirmBill {
  tool_call_id: string
  arguments: BillArgs
}

interface ConfirmData {
  bills: ConfirmBill[]
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'confirm_card'
  content: string
  timestamp: number
  confirmData?: ConfirmData
  confirmed?: boolean
  rejected?: boolean
  blocks?: any[]
}

interface SSEEvent {
  event: string
  data: string
}

interface Category {
  id: number
  name: string
  icon?: string
  color?: string
}

// ---- Constants ----

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
}

const PERSONAS = [
  { value: '', label: '默认风格' },
  { value: 'buddy', label: '🔥 毒舌搭子' },
  { value: 'cat', label: '🐱 猫咪管家' },
  { value: 'analyst', label: '📊 财务分析师' },
  { value: 'homie', label: '🤝 老铁兄弟' },
]

// ---- Confirm Card Component ----

interface ConfirmCardProps {
  msg: ChatMessage
  categories: Category[]
  onConfirm: (data: ConfirmData, modified?: Record<string, unknown>[], rejectIds?: string[]) => void
  onReject: (data: ConfirmData) => void
}

const ConfirmCard: React.FC<ConfirmCardProps> = ({ msg, categories, onConfirm, onReject }) => {
  const bills = msg.confirmData?.bills || []
  const [states, setStates] = useState<Record<string, { editing: boolean; editForm: Record<string, string> }>>({})
  const [removed, setRemoved] = useState<Set<string>>(new Set())

  const startEdit = (tcId: string, args: BillArgs) => {
    setStates(prev => {
      const existing = prev[tcId]?.editForm
      const base = existing ?? {
        amount: String(args.amount ?? ''),
        category: String(args.category ?? ''),
        payee: String(args.payee ?? ''),
        description: String(args.description ?? ''),
        transaction_date: String(args.transaction_date ?? ''),
        payment_method: String(args.payment_method ?? ''),
      }
      return { ...prev, [tcId]: { editing: true, editForm: { ...base } } }
    })
  }

  const finishEdit = (tcId: string) => {
    setStates(prev => prev[tcId]?.editing ? { ...prev, [tcId]: { ...prev[tcId], editing: false } } : prev)
  }

  const updateField = (tcId: string, field: string, value: string) => {
    setStates(prev => ({
      ...prev,
      [tcId]: { ...prev[tcId], editForm: { ...prev[tcId]?.editForm, [field]: value } }
    }))
  }

  const handleConfirmAll = () => {
    if (removed.size >= bills.length) {
      onReject(msg.confirmData!)
      return
    }
    const modified: Record<string, unknown>[] = []
    for (const bill of bills) {
      if (removed.has(bill.tool_call_id)) continue
      const st = states[bill.tool_call_id]
      if (st?.editForm) {
        const m: Record<string, unknown> = { tool_call_id: bill.tool_call_id }
        const a = parseFloat(st.editForm.amount)
        if (!isNaN(a)) m.amount = a
        if (st.editForm.category) m.category = st.editForm.category
        if (st.editForm.payee) m.payee = st.editForm.payee
        if (st.editForm.description) m.description = st.editForm.description
        if (st.editForm.transaction_date) m.transaction_date = st.editForm.transaction_date
        if (st.editForm.payment_method) m.payment_method = st.editForm.payment_method
        modified.push(m)
      }
    }
    onConfirm(msg.confirmData!, modified.length > 0 ? modified : undefined, Array.from(removed))
  }

  if (msg.confirmed) {
    return (
      <View className='chat-confirm-done'>
        <Text className='chat-confirm-done-icon'>✅</Text>
        <Text className='chat-confirm-done-text'>已记账 {bills.length - removed.size} 笔</Text>
      </View>
    )
  }

  if (msg.rejected) {
    return (
      <View className='chat-confirm-rejected'>
        <Text className='chat-confirm-rejected-icon'>❌</Text>
        <Text className='chat-confirm-rejected-text'>已取消全部</Text>
      </View>
    )
  }

  return (
    <View className='confirm-card'>
      <View className='confirm-card-header'>
        <Text className='confirm-card-icon'>⚠️</Text>
        <Text className='confirm-card-title'>
          确认 {bills.length - removed.size} 笔记账？
        </Text>
        {removed.size > 0 && (
          <Text className='confirm-card-removed'>(已忽略 {removed.size} 笔)</Text>
        )}
        <Text className='confirm-card-tag'>AI 生成</Text>
      </View>

      <View className='confirm-card-bills'>
        {bills.filter(b => !removed.has(b.tool_call_id)).map((bill, idx) => {
          const tcId = bill.tool_call_id
          const st = states[tcId]
          const isEditing = st?.editing
          const args = isEditing
            ? { ...bill.arguments, ...st.editForm }
            : (st?.editForm ? { ...bill.arguments, ...st.editForm } : bill.arguments)
          const hasEdits = !!st?.editForm
          const amount = args.amount as number | undefined
          const isExpense = amount != null && amount < 0

          return (
            <View key={tcId} className='confirm-bill-item'>
              <View className='confirm-bill-top'>
                <Text className='confirm-bill-index'>#{idx + 1}</Text>
                <View className='confirm-bill-actions'>
                  <Text
                    className='confirm-bill-ignore'
                    onClick={() => setRemoved(prev => new Set([...prev, tcId]))}
                  >
                    ✕ 忽略
                  </Text>
                  <Text className={`confirm-bill-amount ${isExpense ? 'expense' : 'income'}`}>
                    {amount != null ? `${isExpense ? '−' : '+'}${Math.abs(amount).toFixed(2)} 元` : '?'}
                  </Text>
                </View>
              </View>

              {isEditing ? (
                <View className='confirm-bill-edit-form'>
                  <View className='confirm-bill-edit-row'>
                    <View className='confirm-bill-edit-field'>
                      <Text className='confirm-bill-edit-label'>金额</Text>
                      <Input
                        type='digit'
                        value={st.editForm.amount}
                        onInput={e => updateField(tcId, 'amount', e.detail.value)}
                        className='confirm-bill-edit-input'
                      />
                    </View>
                    <View className='confirm-bill-edit-field'>
                      <Text className='confirm-bill-edit-label'>分类</Text>
                      <Picker
                        mode='selector'
                        range={categories}
                        rangeKey='name'
                        onChange={e => updateField(tcId, 'category', categories[e.detail.value]?.name || '')}
                        className='confirm-bill-edit-input'
                      >
                        <Text>{st.editForm.category || '选择'}</Text>
                      </Picker>
                    </View>
                  </View>
                  <View className='confirm-bill-edit-row'>
                    <View className='confirm-bill-edit-field'>
                      <Text className='confirm-bill-edit-label'>商户</Text>
                      <Input
                        type='text'
                        value={st.editForm.payee}
                        onInput={e => updateField(tcId, 'payee', e.detail.value)}
                        className='confirm-bill-edit-input'
                      />
                    </View>
                    <View className='confirm-bill-edit-field'>
                      <Text className='confirm-bill-edit-label'>描述</Text>
                      <Input
                        type='text'
                        value={st.editForm.description}
                        onInput={e => updateField(tcId, 'description', e.detail.value)}
                        className='confirm-bill-edit-input'
                      />
                    </View>
                  </View>
                  <View className='confirm-bill-edit-row'>
                    <View className='confirm-bill-edit-field'>
                      <Text className='confirm-bill-edit-label'>日期</Text>
                      <Input
                        type='text'
                        value={st.editForm.transaction_date}
                        onInput={e => updateField(tcId, 'transaction_date', e.detail.value)}
                        className='confirm-bill-edit-input'
                        placeholder='YYYY-MM-DD'
                      />
                    </View>
                    <View className='confirm-bill-edit-field'>
                      <Text className='confirm-bill-edit-label'>支付</Text>
                      <Input
                        type='text'
                        value={st.editForm.payment_method}
                        onInput={e => updateField(tcId, 'payment_method', e.detail.value)}
                        className='confirm-bill-edit-input'
                      />
                    </View>
                  </View>
                  <Text className='confirm-bill-edit-done' onClick={() => finishEdit(tcId)}>
                    完成编辑
                  </Text>
                </View>
              ) : (
                <View className='confirm-bill-display'>
                  <View className='confirm-bill-payee-row'>
                    {args.payee && <Text className='confirm-bill-payee'>{String(args.payee)}</Text>}
                    {hasEdits && <Text className='confirm-bill-edited-badge'>已修改</Text>}
                  </View>
                  <View className='confirm-bill-meta'>
                    {args.category && <Text className='confirm-bill-meta-item'>{String(args.category)}</Text>}
                    {args.transaction_date && <Text className='confirm-bill-meta-item'>{String(args.transaction_date)}</Text>}
                    {args.description && <Text className='confirm-bill-meta-item confirm-bill-desc'>{String(args.description)}</Text>}
                  </View>
                  <Text
                    className='confirm-bill-edit-btn'
                    onClick={() => startEdit(tcId, bill.arguments)}
                  >
                    {hasEdits ? '✏️ 继续编辑' : '✏️ 编辑'}
                  </Text>
                </View>
              )}
            </View>
          )
        })}
      </View>

      <View className='confirm-card-actions'>
        <Button className='confirm-btn-primary' onClick={handleConfirmAll}>
          ✅ 确认全部
        </Button>
        <Text className='confirm-btn-reject' onClick={() => onReject(msg.confirmData!)}>
          取消全部
        </Text>
      </View>
    </View>
  )
}

// ---- Main Page Component ----

const ChatPage: React.FC = () => {
  const { user } = useAuth()
  const bumpBillsVersion = useDataStore((s) => s.bumpBillsVersion)

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const s = Taro.getStorageSync('billagent_messages')
      return s ? JSON.parse(s) : []
    } catch { return [] }
  })

  const [sessionId, setSessionId] = useState<string | null>(() => Taro.getStorageSync('billagent_session_id') || null)
  const [persona, setPersona] = useState(() => Taro.getStorageSync('billagent_persona') || '')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [confirmMode, setConfirmMode] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [showPersonaPicker, setShowPersonaPicker] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)

  const scrollRef = useRef<any>(null)
  const streamAbortRef = useRef<{ abort: () => void } | null>(null)
  const loadingRef = useRef(false) // 用于在 effect 中判断是否正在流式传输

  // Persist messages — 流式传输中不写存储，避免阻塞 UI
  useEffect(() => {
    if (loadingRef.current) return // SSE 流期间跳过，流结束后统一写入
    Taro.setStorageSync('billagent_messages', JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    if (sessionId) {
      Taro.setStorageSync('billagent_session_id', sessionId)
    }
  }, [sessionId])

  useEffect(() => {
    Taro.setStorageSync('billagent_persona', persona)
  }, [persona])

  // Load categories
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
  }, [])

  // Scroll to bottom — 流式传输中不滚动，避免频繁重绘
  useEffect(() => {
    if (loadingRef.current) return
    const timer = setTimeout(() => {
      Taro.createSelectorQuery()
        .select('.chat-messages')
        .node((res) => {
          if (res && res.node) {
            res.node.scrollTo({ scrollTop: 999999, animated: true })
          }
        })
        .exec()
    }, 100)
    return () => clearTimeout(timer)
  }, [messages, statusText])


  // Load history on show
  useDidShow(() => {
    if (sessionId) {
      getChatHistory(sessionId).then(history => {
        if (history && history.length > 0) {
          // Convert history to messages format
          const loaded: ChatMessage[] = []
          for (const h of history) {
            if (h.role === 'user') {
              loaded.push({ role: 'user', content: h.content || '', timestamp: h.timestamp || Date.now() })
            } else if (h.role === 'assistant') {
              loaded.push({ role: 'assistant', content: h.content || '', timestamp: h.timestamp || Date.now() })
            }
          }
          if (loaded.length > 0) {
            setMessages(prev => {
              // Merge avoiding duplicates
              const existing = new Set(prev.map(m => `${m.role}:${m.content}`))
              const merged = [...prev]
              for (const m of loaded) {
                const key = `${m.role}:${m.content}`
                if (!existing.has(key)) {
                  merged.push(m)
                  existing.add(key)
                }
              }
              return merged
            })
          }
        }
      }).catch(() => {})
    }
  })

  const addMsg = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const appendAssistant = useCallback((chunk: string) => {
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
      }
      return [...prev, { role: 'assistant', content: chunk, timestamp: Date.now() }]
    })
  }, [])

  // ---- SSE Stream Handler ----

  const handleStream = useCallback(async (body: any) => {
    loadingRef.current = true // 标记流式传输开始，阻止 setStorageSync
    return new Promise<void>((resolve, reject) => {
      const token = Taro.getStorageSync('token')
      const header: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) header['Authorization'] = `Bearer ${token}`

      let buffer = ''
      let currentEvent = ''
      let currentData = ''

      const emit = () => {
        if (currentEvent && currentData !== '') {
          try {
            const evt: SSEEvent = { event: currentEvent, data: currentData }
            switch (evt.event) {
              case 'status':
                setStatusText(evt.data)
                break
              case 'tool_call': {
                try {
                  const parsed = JSON.parse(evt.data)
                  setStatusText(TOOL_LABELS[parsed.tool_name] || '处理中...')
                } catch { /* */ }
                break
              }
              case 'confirm_required': {
                try {
                  const confirmData = JSON.parse(evt.data) as ConfirmData
                  setMessages(prev => [...prev, {
                    role: 'confirm_card',
                    content: '请确认记账',
                    confirmData,
                    timestamp: Date.now()
                  }])
                } catch { /* */ }
                break
              }
              case 'reply_chunk':
                setStatusText('')
                appendAssistant(evt.data)
                break
              case 'content_block': {
                setStatusText('')
                try {
                  const block = JSON.parse(evt.data)
                  setMessages(prev => {
                    let idx = prev.length - 1
                    while (idx >= 0 && prev[idx].role !== 'assistant') idx--
                    if (idx >= 0) {
                      const target = prev[idx]
                      return [...prev.slice(0, idx), {
                        ...target,
                        blocks: [...(target.blocks || []), block],
                      }, ...prev.slice(idx + 1)]
                    }
                    return [...prev, { role: 'assistant', content: '', blocks: [block], timestamp: Date.now() }]
                  })
                } catch { /* */ }
                break
              }
              case 'done': {
                try {
                  const d = JSON.parse(evt.data)
                  if (d.session_id) setSessionId(d.session_id)
                } catch { /* */ }
                loadingRef.current = false
                break
              }
              case 'error':
                loadingRef.current = false
                appendAssistant(`\n\n❌ ${evt.data}`)
                break
            }
          } catch { /* */ }
        }
        currentEvent = ''
        currentData = ''
      }

      // Use Taro.request for SSE stream
      const requestTask = Taro.request({
        url: body.action ? 'http://localhost:8000/api/v1/chat/confirm' : 'http://localhost:8000/api/v1/chat/stream',
        method: 'POST',
        header,
        data: body,
        responseType: 'text',
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const text = res.data as string
            // Parse SSE from response text
            const lines = text.split('\n')
            for (const line of lines) {
              if (line === '') {
                emit()
              } else if (line.startsWith('event: ')) {
                emit()
                currentEvent = line.slice(7).trim()
              } else if (line.startsWith('data: ')) {
                const chunk = line.slice(6)
                currentData = currentData ? currentData + '\n' + chunk : chunk
              }
            }
            emit()
            resolve()
          } else {
            // 422 等错误响应是 JSON 字符串，需要解析
            let errMsg = `HTTP ${res.statusCode}`
            try {
              const errObj = JSON.parse(res.data as string)
              errMsg = errObj.detail || errObj.message || errMsg
            } catch { /* res.data 可能不是 JSON */ }
            reject(new Error(errMsg))
          }
        },
        fail: (err) => {
          loadingRef.current = false
          reject(new Error(err.errMsg || 'Request failed'))
        }
      })

      streamAbortRef.current = {
        abort: () => {
          try {
            requestTask.abort()
          } catch { /* */ }
          loadingRef.current = false
        }
      }
    })
  }, [appendAssistant])

  // ---- Confirm / Reject ----

  const handleConfirm = useCallback(async (cd: ConfirmData, modifiedArgs?: Record<string, unknown>[], rejectIds?: string[]) => {
    if (!sessionId) return
    const keepCount = cd.bills.length - (rejectIds?.length || 0)
    setLoading(true)
    setStatusText(`确认 ${keepCount} 笔记账...`)
    setMessages(prev => prev.map(m => m.role === 'confirm_card' ? { ...m, confirmed: true, rejected: false } : m))
    addMsg({ role: 'assistant', content: '', timestamp: Date.now() })

    try {
      await handleStream({
        session_id: sessionId,
        action: 'confirm',
        modified_arguments: modifiedArgs,
        reject_ids: rejectIds
      })
      // 记账成功后触发全局刷新
      if (keepCount > 0) {
        bumpBillsVersion()
      }
    } catch (err: any) {
      appendAssistant(`\n\n❌ ${err.message}`)
    } finally {
      setStatusText('')
      setLoading(false)
    }
  }, [sessionId, addMsg, appendAssistant, handleStream, bumpBillsVersion])

  const handleReject = useCallback(async (cd: ConfirmData) => {
    if (!sessionId) return
    setLoading(true)
    setStatusText('取消中...')
    setMessages(prev => prev.map(m => m.role === 'confirm_card' ? { ...m, confirmed: false, rejected: true } : m))
    addMsg({ role: 'assistant', content: '', timestamp: Date.now() })

    try {
      await handleStream({
        session_id: sessionId,
        action: 'reject'
      })
    } catch (err: any) {
      appendAssistant(`\n\n❌ ${err.message}`)
    } finally {
      setStatusText('')
      setLoading(false)
    }
  }, [sessionId, addMsg, appendAssistant, handleStream])

  // ---- Send Message ----

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)
    setStatusText('分析中...')
    addMsg({ role: 'user', content: text, timestamp: Date.now() })
    addMsg({ role: 'assistant', content: '', timestamp: Date.now() })

    try {
      await handleStream({
        message: text,
        session_id: sessionId,
        persona: persona || undefined,
        confirm_mode: confirmMode,
        image_base64: undefined,
        image_content_type: undefined
      })
    } catch (err: any) {
      appendAssistant(`\n\n❌ ${err.message}`)
    } finally {
      setStatusText('')
      setLoading(false)
    }
  }, [input, loading, sessionId, persona, confirmMode, addMsg, appendAssistant, handleStream])

  // ---- Enter Key Submit ----
  // 使用 Textarea 的 onConfirm 事件处理回车发送

  // ---- OCR Upload ----

  const handleImageUpload = useCallback(async () => {
    if (ocrLoading || loading) return
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      const filePath = res.tempFilePaths[0]

      setOcrLoading(true)
      setStatusText('识别图片中...')

      // 读取文件并转为 base64
      const fs = Taro.getFileSystemManager()
      const fileData = fs.readFileSync(filePath, 'base64')
      const base64 = `data:image/jpeg;base64,${fileData}`

      // 调用 OCR 识别（通过 chat 接口发送图片）
      const ocrMsg = '请识别这张账单截图并帮我创建账单'
      const userMsg: ChatMessage = {
        role: 'user',
        content: '📸 [账单截图]',
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, userMsg])
      addMsg({ role: 'assistant', content: '', timestamp: Date.now() })

      await handleStream({
        message: ocrMsg,
        session_id: sessionId,
        persona: persona || undefined,
        confirm_mode: confirmMode,
        image_base64: base64,
        image_content_type: 'image/jpeg'
      })
    } catch (err: any) {
      appendAssistant(`\n\n❌ 图片识别失败: ${err?.message || '未知错误'}`)
    } finally {
      setOcrLoading(false)
      setStatusText('')
    }
  }, [ocrLoading, loading, sessionId, persona, confirmMode, addMsg, appendAssistant, handleStream])

  // ---- New Conversation ----

  const handleNewChat = useCallback(() => {
    setMessages([])
    setSessionId(null)
    setStatusText('')
    Taro.removeStorageSync('billagent_messages')
    Taro.removeStorageSync('billagent_session_id')
  }, [])

  // ---- Render ----

  return (
    <View className='chat-page'>
      {/* Header */}
      <View className='chat-header'>
        <View className='chat-header-left'>
          <View className='chat-header-avatar'>
            <Text className='chat-header-avatar-text'>💬</Text>
          </View>
          <Text className='chat-header-title'>你说我记</Text>
        </View>
        <View className='chat-header-actions'>
          <Text
            className={`chat-confirm-toggle ${confirmMode ? 'active' : ''}`}
            onClick={() => setConfirmMode(!confirmMode)}
          >
            {confirmMode ? '✅ 确认模式' : '确认模式'}
          </Text>
          <Text
            className='chat-persona-selector'
            onClick={() => setShowPersonaPicker(!showPersonaPicker)}
          >
            {PERSONAS.find(p => p.value === persona)?.label || '默认风格'} ▾
          </Text>
          <Text className='chat-new-btn' onClick={handleNewChat}>
            新对话
          </Text>
        </View>
      </View>

      {/* Persona Picker Dropdown */}
      {showPersonaPicker && (
        <View className='chat-persona-dropdown'>
          {PERSONAS.map(p => (
            <Text
              key={p.value}
              className={`chat-persona-option ${persona === p.value ? 'selected' : ''}`}
              onClick={() => {
                setPersona(p.value)
                setShowPersonaPicker(false)
              }}
            >
              {p.label}
            </Text>
          ))}
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        className='chat-messages'
        scrollY
        scrollWithAnimation
        enhanced
        showScrollbar={false}
      >
        <View style={{ padding: '24rpx 20rpx' }}>
        {messages.length === 0 && (
          <View className='chat-empty'>
            <View className='chat-empty-icon-wrap'>
              <Text className='chat-empty-icon'>💬</Text>
            </View>
            <Text className='chat-empty-title'>开始对话记账</Text>
            <Text className='chat-empty-hint'>
              试试说 <Text className='chat-empty-code'>今天午餐麦当劳35元</Text>
            </Text>
            <Text className='chat-empty-subhint'>或输入任意账单描述</Text>
          </View>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'confirm_card') {
            return (
              <View key={i} className='chat-confirm-wrapper'>
                <ConfirmCard
                  msg={msg}
                  categories={categories}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                />
              </View>
            )
          }

          const isUser = msg.role === 'user'
          if (!isUser && !msg.content && (!msg.blocks || msg.blocks.length === 0)) return null

          return (
            <View
              key={i}
              className={`chat-msg-wrapper ${isUser ? 'chat-msg-user' : 'chat-msg-ai'}`}
            >
              {!isUser && (
                <View className='chat-avatar chat-avatar-ai'>
                  <Text className='chat-avatar-text'>💬</Text>
                </View>
              )}
              <View className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                {isUser ? (
                  <Text className='chat-bubble-text'>{msg.content}</Text>
                ) : (
                  <>
                    {/* 优先渲染结构化内容块，否则渲染纯文本 */}
                    {msg.blocks && msg.blocks.length > 0 ? (
                      <ContentBlockRenderer blocks={msg.blocks} />
                    ) : (
                      <Text className='chat-bubble-text'>{msg.content || '…'}</Text>
                    )}
                  </>
                )}
              </View>
              {isUser && (
                <View className='chat-avatar chat-avatar-user'>
                  <Text className='chat-avatar-text'>我</Text>
                </View>
              )}
            </View>
          )
        })}

        {/* Status Indicator */}
        {statusText && (
          <View className='chat-status-wrapper'>
            <View className='chat-status-pill'>
              <View className='chat-status-dots'>
                <View className='chat-status-dot' />
                <View className='chat-status-dot delay-1' />
                <View className='chat-status-dot delay-2' />
              </View>
              <Text className='chat-status-text'>{statusText}</Text>
            </View>
          </View>
        )}

        {/* Loading without status */}
        {loading && !statusText && (
          <View className='chat-status-wrapper'>
            <View className='chat-status-dots'>
              <View className='chat-status-dot gray' />
              <View className='chat-status-dot gray delay-1' />
              <View className='chat-status-dot gray delay-2' />
            </View>
          </View>
        )}

        <View className='chat-scroll-anchor' />
        </View>
      </ScrollView>

      {/* Input Area */}
      <View className='chat-input-area'>
        <View className='chat-input-wrapper'>
          <View className='chat-input-actions'>
            <Text
              className={`chat-ocr-btn ${ocrLoading ? 'loading' : ''}`}
              onClick={handleImageUpload}
            >
              {ocrLoading ? '🔄' : '📷'}
            </Text>
          </View>
          <Textarea
            className='chat-textarea'
            value={input}
            onInput={e => setInput(e.detail.value)}
            onConfirm={handleSend}
            placeholder='说说你的账单…'
            placeholderClass='chat-textarea-placeholder'
            autoHeight
            maxlength={500}
            disabled={loading}
            showConfirmBar={false}
            adjustPosition={true}
            confirmType='send'
          />
          <Button
            className={`chat-send-btn ${loading || !input.trim() ? 'disabled' : ''}`}
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            <Text className='chat-send-icon'>➤</Text>
          </Button>
        </View>
      </View>
    </View>
  )
}

export default ChatPage
