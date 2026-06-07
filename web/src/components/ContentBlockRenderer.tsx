/** 结构化内容块渲染器 — LLM JSON → React 组件 */

import type { ContentBlock, TextBlock, HeadingBlock, SummaryBlock, TableBlock, BillListBlock, CalloutBlock } from '../types/chat';

interface Props { block: ContentBlock; }

export default function ContentBlockRenderer({ block }: Props) {
  switch (block.type) {
    case 'text': return <TextView block={block} />;
    case 'heading': return <HeadingView block={block} />;
    case 'table': return <TableView block={block} />;
    case 'summary': return <SummaryView block={block} />;
    case 'bill_list': return <BillListView block={block} />;
    case 'callout': return <CalloutView block={block} />;
    case 'divider': return <hr className="my-3 border-espresso-100" />;
    default: return <p className="text-espresso-500 text-sm italic">未知块类型</p>;
  }
}

function TextView({ block }: { block: TextBlock }) {
  return <p className="mb-1.5 last:mb-0 leading-relaxed text-sm text-espresso-700 whitespace-pre-wrap">{block.content}</p>;
}

function HeadingView({ block }: { block: HeadingBlock }) {
  const cls: Record<number, string> = {
    1: 'text-lg font-bold text-espresso-800 mt-3 mb-2',
    2: 'text-base font-bold text-espresso-800 mt-3 mb-2 border-b border-espresso-100 pb-1',
    3: 'text-sm font-semibold text-espresso-700 mt-2 mb-1.5',
  };
  const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
  return <Tag className={cls[block.level] || cls[2]}>{block.content}</Tag>;
}

function SummaryView({ block }: { block: SummaryBlock }) {
  const icon: Record<string, string> = { up: '📈', down: '📉', flat: '➡️' };
  return (
    <div className="grid grid-cols-2 gap-2 my-2">
      {block.cards.map((c, i) => (
        <div key={i} className="bg-white border border-espresso-100 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-espresso-400 mb-1">{c.label}</p>
          <p className="text-lg font-bold text-espresso-800">{c.value}{c.trend && <span className="ml-1 text-sm">{icon[c.trend] || ''}</span>}</p>
        </div>
      ))}
    </div>
  );
}

function TableView({ block }: { block: TableBlock }) {
  return (
    <div className="overflow-x-auto my-2 rounded-xl border border-espresso-100">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-espresso-50">
          <tr>{block.headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-semibold text-espresso-600 text-[11px] uppercase tracking-wider">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-espresso-50">
          {block.rows.map((row, ri) => <tr key={ri}>{row.map((c, ci) => <td key={ci} className="px-3 py-2 text-espresso-700 whitespace-nowrap">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function BillListView({ block }: { block: BillListBlock }) {
  return (
    <div className="my-2 space-y-1">
      {block.bills.map((b, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2 bg-white border border-espresso-100 rounded-lg text-sm">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-espresso-400 w-12 shrink-0">{b.date}</span>
            <span className="inline-block px-2 py-0.5 bg-espresso-50 rounded-full text-xs font-medium text-espresso-600">{b.category}</span>
            <span className="text-espresso-700 truncate">{b.payee}</span>
          </div>
          <span className={`font-semibold shrink-0 ml-3 ${b.amount.startsWith('-') ? 'text-rose-600' : 'text-emerald-600'}`}>{b.amount}元</span>
        </div>
      ))}
    </div>
  );
}

function CalloutView({ block }: { block: CalloutBlock }) {
  const s: Record<string, string> = { info: 'bg-blue-50 border-blue-200 text-blue-700', warning: 'bg-amber-50 border-amber-200 text-amber-700', success: 'bg-green-50 border-green-200 text-green-700' };
  const i: Record<string, string> = { info: '💡', warning: '⚠️', success: '✅' };
  return <div className={`my-2 px-4 py-3 border rounded-xl text-sm ${s[block.level] || s.info}`}><span className="mr-2">{i[block.level] || '💡'}</span>{block.content}</div>;
}
