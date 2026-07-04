/**
 * 结构化内容块渲染器 — 对齐网页端 ContentBlockRenderer.tsx
 * 支持 7 种块类型：text, heading, summary, table, bill_list, callout, divider
 * 后端 LLM 返回的 JSON 内容块数组，前端解析后渲染为结构化 UI
 */
import React from 'react'
import { View, Text } from '@tarojs/components'
import './ContentBlockRenderer.css'

interface ContentBlockRendererProps {
  blocks: any[]
}

/**
 * 内容块渲染器
 * 根据 block.type 分发到对应的渲染组件
 */
const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({ blocks }) => {
  if (!blocks || blocks.length === 0) return null

  return (
    <View className='content-blocks'>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading':
            return <HeadingBlock key={idx} block={block} />
          case 'summary':
            return <SummaryBlock key={idx} block={block} />
          case 'table':
            return <TableBlock key={idx} block={block} />
          case 'bill_list':
            return <BillListBlock key={idx} block={block} />
          case 'callout':
            return <CalloutBlock key={idx} block={block} />
          case 'divider':
            return <DividerBlock key={idx} />
          case 'text':
          default:
            return <TextBlock key={idx} block={block} />
        }
      })}
    </View>
  )
}

/** 文本块 */
const TextBlock: React.FC<{ block: any }> = ({ block }) => (
  <View className='cb-text'>
    <Text className='cb-text-content'>{block.content}</Text>
  </View>
)

/** 标题块 */
const HeadingBlock: React.FC<{ block: any }> = ({ block }) => {
  const level = block.level || 2
  const className = `cb-heading cb-heading-${level}`
  return (
    <View className={className}>
      <Text className='cb-heading-text'>{block.content}</Text>
    </View>
  )
}

/** 汇总卡片块 */
const SummaryBlock: React.FC<{ block: any }> = ({ block }) => {
  const cards = block.cards || []
  return (
    <View className='cb-summary'>
      {cards.map((card: any, i: number) => (
        <View key={i} className='cb-summary-card'>
          <Text className='cb-summary-value'>{card.value}</Text>
          <Text className='cb-summary-label'>{card.label}</Text>
        </View>
      ))}
    </View>
  )
}

/** 表格块 */
const TableBlock: React.FC<{ block: any }> = ({ block }) => {
  const headers = block.headers || []
  const rows = block.rows || []
  return (
    <View className='cb-table'>
      <View className='cb-table-header'>
        {headers.map((h: string, i: number) => (
          <Text key={i} className='cb-table-header-cell'>{h}</Text>
        ))}
      </View>
      {rows.map((row: string[], i: number) => (
        <View key={i} className={`cb-table-row ${i % 2 === 0 ? 'even' : 'odd'}`}>
          {row.map((cell: string, j: number) => (
            <Text key={j} className='cb-table-cell' numberOfLines={2}>{cell}</Text>
          ))}
        </View>
      ))}
    </View>
  )
}

/** 账单列表块 */
const BillListBlock: React.FC<{ block: any }> = ({ block }) => {
  const bills = block.bills || []
  return (
    <View className='cb-bill-list'>
      {bills.map((bill: any, i: number) => {
        const amount = parseFloat(bill.amount)
        const isExpense = amount < 0
        return (
          <View key={i} className='cb-bill-item'>
            <View className='cb-bill-left'>
              <Text className='cb-bill-date'>{bill.date}</Text>
              <Text className='cb-bill-category'>{bill.category}</Text>
              {bill.payee && <Text className='cb-bill-payee'>{bill.payee}</Text>}
            </View>
            <Text className={`cb-bill-amount ${isExpense ? 'expense' : 'income'}`}>
              {isExpense ? '−' : '+'}¥{Math.abs(amount).toFixed(2)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

/** 提示块 */
const CalloutBlock: React.FC<{ block: any }> = ({ block }) => {
  const level = block.level || 'info'
  const icon = level === 'warning' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️'
  return (
    <View className={`cb-callout cb-callout-${level}`}>
      <Text className='cb-callout-icon'>{icon}</Text>
      <Text className='cb-callout-content'>{block.content}</Text>
    </View>
  )
}

/** 分割线块 */
const DividerBlock: React.FC = () => (
  <View className='cb-divider' />
)

export default ContentBlockRenderer
