import type { Payload } from './model';

export type PortfolioSnapshot = {
  account?: { cash: number; initialCash: number };
  positions: Array<{ id: number; companyId: number; quantity: number; avgCostCny: number; lastPriceCny: number; name?: string }>;
  orders: Array<{ id: number; companyId: number; side: string; quantity: number; status: string; signalDate?: string; rationale?: string }>;
  quotes: Array<{ companyId: number; priceDate: string }>;
};
export function TodayWorkspace({ data, paper, paperError, onResearch, onPortfolio, onStrategy }: {
  data: Payload; paper: PortfolioSnapshot | null; paperError: string;
  onResearch: (id?: number, detail?: string) => void; onPortfolio: () => void; onStrategy: () => void;
}) {
  const docs = [...(data.documents ?? [])].sort((a,b)=>b.publicationDate.localeCompare(a.publicationDate));
  const missing = data.companies.filter(c=>!data.documents?.some(d=>d.companyId===c.id));
  const quoteDates = paper?.quotes.map(q=>q.priceDate).filter(Boolean).sort() ?? [];
  const pending = paper?.orders.filter(o=>o.status==='待成交').length ?? 0;
  return <div className="ma-stack">
    <section className="ma-intro"><p className="ma-kicker">RESEARCH → TEST → REVIEW</p><h2>先看变化，再做判断。</h2><p>从研究资料到策略验证，再到模拟组合。每一步保留依据，不把资料覆盖率当作收益保证。</p><div className="ma-actions"><button className="primary" onClick={()=>onResearch()}>开始公司研究 →</button><button onClick={onPortfolio}>查看模拟组合</button></div></section>
    <div className="ma-stats"><article><span>研究公司</span><strong>{data.companies.length}</strong><small>统一公司档案</small></article><article><span>原始资料</span><strong>{docs.length}</strong><small>财报、公告与政策等已收录文件</small></article><article><span>尚无来源资料</span><strong>{missing.length}</strong><small>待补资料，不等同于不看好</small></article><article><span>待成交模拟订单</span><strong>{paper ? pending : '—'}</strong><small>{paperError || (paper ? '仅显示本地记录，不自动执行' : '正在读取组合')}</small></article></div>
    <div className="ma-two"><section className="ma-panel"><div className="ma-section-head"><h2>近期收录资料 · 按公开日期</h2><span>{docs[0]?.publicationDate || '暂无日期'}</span></div><p className="ma-muted">显示资料本身的发布日期，不表示今天已更新行情或完成核验。</p>{docs.length ? docs.slice(0,5).map(d=><button className="ma-list-row" key={d.id} onClick={()=>onResearch(d.companyId,'evidence')}><span><b>{d.title}</b><small>{data.companies.find(c=>c.id===d.companyId)?.name || '未关联公司'} · {d.documentType}</small></span><span>{d.publicationDate || '日期待补'} →</span></button>) : <p className="ma-empty">尚未收录资料。请在研究中心补充来源。</p>}</section>
    <section className="ma-panel"><h2>本次研究从哪里开始？</h2><p className="ma-muted">优先补齐有判断、却没有原始资料支持的公司。</p>{missing.slice(0,4).map(c=><button key={c.id} className="ma-list-row" onClick={()=>onResearch(c.id,'evidence')}><b>{c.name}</b><span>补齐资料 →</span></button>)}{!missing.length && <p>所有公司均已关联资料；仍需检查有效日期、反证与关键假设。</p>}<div className="ma-note">行情记录日期：{quoteDates.length ? `${quoteDates[0]} 至 ${quoteDates[quoteDates.length-1]}` : '尚未读取'}。这不是实时行情刷新状态。</div><div className="ma-actions"><button onClick={onStrategy}>检验策略 →</button><button onClick={onPortfolio}>复盘持仓 →</button></div></section></div>
  </div>;
}
