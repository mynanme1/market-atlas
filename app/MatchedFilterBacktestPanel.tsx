"use client";
import {ResearchArchiveBoundary,type ArchiveBundle} from "./ResearchArchiveBoundary";
import type {ArchiveTypes} from "./research/archive-types";
type PanelProps=Record<string, never>;
import {useState} from 'react';
import './cycle.css';
import './matched-filter.css';
const pct=(n:number)=>`${(n*100).toFixed(2)}%`;
const points=(n:number)=>`${n>0?'+':''}${n.toFixed(2)}`;
type Opportunity={name:string;entryDate:string;markDate:string;interpretation:string;return:number;closed:boolean};
function isOpportunity(value:unknown):value is Opportunity{
  if(!value||typeof value!=='object')return false;
  const v=value as Record<string,unknown>;
  return ['name','entryDate','markDate','interpretation'].every(key=>typeof v[key]==='string')&&typeof v.return==='number'&&Number.isFinite(v.return)&&typeof v.closed==='boolean';
}
type Comparison=Omit<(ArchiveTypes["matched-filter-suite-v1.json"]["comparisons"])[number],'opportunities'>&{opportunities:{key:string;items:Opportunity[]}[]};

function MatchedFilterBacktestPanelContent({archives,props}:{archives:ArchiveBundle;props:PanelProps}){
const rawReport=archives["matched-filter-suite-v1.json"] as ArchiveTypes["matched-filter-suite-v1.json"];
const evidence=archives["historical-evidence-2024-2025-v2.json"] as ArchiveTypes["historical-evidence-2024-2025-v2.json"];
const documents=(ids:string[])=>evidence.documents.filter(d=>d.facts.some(f=>ids.includes(f.id)));
const report:Omit<ArchiveTypes["matched-filter-suite-v1.json"],'comparisons'>&{comparisons:Comparison[]}={...rawReport,comparisons:rawReport.comparisons.map(c=>({...c,opportunities:c.opportunities.map(group=>({key:group.key,items:group.items.map(item=>{if(!isOpportunity(item))throw new Error('机会记录格式不匹配');return item;})}))}))};

  const [scenario,setScenario]=useState('base'),[ticker,setTicker]=useState('003816');
  const comparison=report.comparisons.find(c=>c.scenario===scenario)!;
  const audit=report.audits.find(a=>a.ticker===ticker)!;
  const runs=report.runs.filter(r=>r.scenario===scenario);
  const none=comparison.rows.every(r=>r.rejected===0);
  return <section className="cyclePanel matchedFilter" aria-labelledby="matched-title">
    <header><div><p className="eyebrow">隔离变量实验 · 同仓位规则 · 12 组</p><h3 id="matched-title">财报过滤，是否真的改善了选股？</h3><p>只改变新开仓的财报过滤，保持趋势、排序、仓位、出场和成本规则一致。旧版财报分档仓位回测保留在下方，不与本实验混用。</p></div></header>
    <div className="cycleFinding"><strong>{none?'当前案例：财报过滤没有产生增量收益':'当前案例：出现了被财报过滤的入场机会'}</strong><p>{none?'三组入场及资金曲线相同，没有被拒绝的新开仓。这不能证明财报无价值，只说明当前样本与50分门槛尚未体现筛选价值。':'请同时比较回撤、实际仓位和被过滤机会，不能只看收益。'}</p></div>
    <div className="matchedControls"><label>对照案例<select value={scenario} onChange={e=>setScenario(e.target.value)}>{report.comparisons.map(c=><option key={c.scenario} value={c.scenario}>{c.label}</option>)}</select></label><p>{comparison.start} — {comparison.end} · 初始 100 万元 · 收益含期末浮盈亏</p><a href="/research/matched-filter-suite-v1.json" download>下载结果与判断留痕</a></div>
    <div className="cycleTableScroll" tabIndex={0} role="region" aria-label="同仓位规则回测结果"><table><thead><tr><th>规则</th><th>总收益</th><th>最大回撤</th><th>平均仓位</th><th>新开仓 / 拒绝</th><th>完整清仓</th></tr></thead><tbody>{comparison.rows.map(r=><tr key={r.key}><th>{r.label}</th><td>{pct(r.totalReturn)}</td><td>{pct(r.maxDrawdown)}</td><td>{pct(r.averageExposure)}</td><td>{r.firstEntries} / {r.rejected}</td><td>{r.closedPositions}</td></tr>)}</tbody></table></div>
    <p>单股目标 12% × 历史波动缩放；评分不再决定 3% / 12% 分档。此实验仅评估<strong>入场过滤</strong>，不以财报触发卖出。相同仓位规则不保证过滤后实际仓位相同。</p>
    <details><summary>检查每一次入场资格判断（含当时使用的财报）</summary>{runs.filter(r=>r.key!=='pure').map(r=><div key={r.key}><h4>{r.label}</h4><div className="cycleTableScroll" tabIndex={0}><table><thead><tr><th>公司 / 信号日期</th><th>分数 / 指标覆盖</th><th>判断</th><th>公开原文</th></tr></thead><tbody>{r.decisions.map((d,i)=><tr key={i}><th>{d.name}<small>{d.signalDate}</small></th><td>{d.financial?d.financial.score.toFixed(2):'—'}<small>覆盖 {pct(d.financial?.observedWeight??0)}，不加分</small></td><td>{d.accepted?'通过':'拒绝'}<small>{d.reason}</small></td><td>{documents(d.financial?.factIds??[]).map(doc=><a className="matchedSource" key={doc.id} href={doc.sourceUrl} target="_blank" rel="noreferrer">{doc.period} · 公开 {doc.publishedOn}</a>)}</td></tr>)}</tbody></table></div></div>)}</details>
    <details><summary>避开的亏损与错过的上涨</summary>{comparison.opportunities.map(group=><div key={group.key}><h4>{group.key==='filter-v2'?'补齐后过滤':'补齐前过滤'}</h4>{!group.items.length?<p>没有纯趋势首次入场被拒绝，因此本案例没有可列示的“避损 / 错涨”事件；不能虚构过滤贡献。</p>:group.items.map((item,i)=><p key={i}>{item.name} · {item.entryDate} 至 {item.markDate} · {item.interpretation}：{pct(item.return)}（{item.closed?'参考完整退出':'期末未平仓'}）</p>)}</div>)}<p>固定首次建仓股数的事后参考，不可加总为组合收益，也不用于反向挑选股票。</p></details>
    <hr/><h3>评分变化：经营指标，还是资料缺口？</h3>
    <div className="matchedControls"><label>公司<select value={ticker} onChange={e=>setTicker(e.target.value)}>{report.audits.map(a=><option key={a.ticker} value={a.ticker}>{a.name}</option>)}</select></label><p>固定观察日 {audit.date}，用相同公式比较补齐前后</p></div>
    <div className="matchedScores"><article><span>补齐前 v1</span><strong>{audit.old.score.toFixed(2)}</strong><span>指标覆盖 {pct(audit.old.observedWeight)}</span></article><article><span>补齐后 v2</span><strong>{audit.current.score.toFixed(2)}</strong><span>指标覆盖 {pct(audit.current.observedWeight)}</span></article><article><span>资料版本造成的分差</span><strong>{points(audit.versionChange.delta)}</strong><span>不是观察日经营变化</span></article></div>
    <div className="cycleTableScroll" role="region" aria-label="评分逐项分解" tabIndex={0}><table><thead><tr><th>指标 / 权重</th><th>补齐前</th><th>补齐后</th><th>加权分差</th><th>来源</th></tr></thead><tbody>{audit.versionChange.rows.map(r=><tr key={r.key}><th>{r.label}<small>{pct(r.weight)}</small></th><td>{r.before.observed?r.before.score.toFixed(2):'缺失，50分占位'}</td><td>{r.after.observed?r.after.score.toFixed(2):'缺失，50分占位'}</td><td>{points(r.delta)}</td><td>{documents(r.after.factIds).map(doc=><a className="matchedSource" key={doc.id} href={doc.sourceUrl} target="_blank" rel="noreferrer">{doc.period} · {doc.publishedOn}</a>)}</td></tr>)}</tbody></table></div>
    <p className="cycleFinding">跨期比较 {audit.previousDate} → {audit.date}：旧资料显示 {points(audit.oldTemporalChange.delta)} 分，其中 {points(audit.oldTemporalChange.availabilityDelta)} 分来自缺失状态变化。补齐后总变化为 {points(audit.temporalChange.delta)} 分，可比指标贡献 {points(audit.temporalChange.comparableDelta)} 分、资料可用性贡献 {points(audit.temporalChange.availabilityDelta)} 分。可比指标也可能含重述口径调整，不能自动解读为经营改善。</p>
    <details><summary>实验边界与剩余资料缺口</summary><ul>{report.limitations.map(l=><li key={l}>{l}</li>)}</ul><p>本轮档案 {report.evidence.documents} 份文件、{report.evidence.versions} 条版本记录。紫金、中国广核的 2024Q1、2025Q1 及更早同比资料仍待补齐。</p><p>输入校验码：<code>{report.inputId}</code></p></details>
  </section>;
}

export default function MatchedFilterBacktestPanel(props:PanelProps){return <ResearchArchiveBoundary files={["matched-filter-suite-v1.json","historical-evidence-2024-2025-v2.json"]}>{archives=><MatchedFilterBacktestPanelContent archives={archives} props={props}/>}</ResearchArchiveBoundary>;}
