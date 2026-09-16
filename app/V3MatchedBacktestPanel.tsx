"use client";
import {ResearchArchiveBoundary,type ArchiveBundle} from "./ResearchArchiveBoundary";
import type {ArchiveTypes} from "./research/archive-types";
type PanelProps=Record<string, never>;
import {useState} from 'react';
import './cycle.css';
import './matched-filter.css';
const pct=(n:number)=>`${(n*100).toFixed(2)}%`;
function V3MatchedBacktestPanelContent({archives,props}:{archives:ArchiveBundle;props:PanelProps}){
const report=archives["matched-filter-suite-v3.json"] as ArchiveTypes["matched-filter-suite-v3.json"];
const evidence=archives["historical-evidence-2024-2025-v3.json"] as ArchiveTypes["historical-evidence-2024-2025-v3.json"];
const docs=(ids:string[])=>evidence.documents.filter(d=>d.facts.some(f=>ids.includes(f.id)));

  const [scenario,setScenario]=useState('base');
  const comparison=report.comparisons.find(c=>c.scenario===scenario)!;
  const outcome=report.outcomes.find(c=>c.scenario===scenario)!;
  const before=comparison.rows.find(r=>r.key==='filter-v2')!,after=comparison.rows.find(r=>r.key==='filter-v3')!;
  const entries=report.entryAudits.filter(r=>r.scenario===scenario);
  const run=report.runs.find(r=>r.key==='filter-v3'&&r.scenario===scenario)!;
  return <section className="cyclePanel matchedFilter" aria-labelledby="matched-v3-title">
    <header><div><p className="eyebrow">最新资料复核 · v2 对 v3 · 12 组固定规则</p><h3 id="matched-v3-title">补齐资料后，交易真的改变了吗？</h3><p>只替换财报资料，沿用同一行情、50分入场门槛、仓位、出场及成本规则；未调参、未下单。旧实验保留在下方。</p></div></header>
    <div className="matchedControls"><label>对照案例<select value={scenario} onChange={e=>setScenario(e.target.value)}>{report.comparisons.map(c=><option value={c.scenario} key={c.scenario}>{c.label}</option>)}</select></label><p>{comparison.start} — {comparison.end} · 初始100万元 · 含期末浮盈亏，非年化收益</p><a href="/research/matched-filter-suite-v3.json" download>下载v3回测与判断记录</a></div>
    <div className="cycleFinding"><strong>{outcome.curveEqualV2?'本案例资金曲线未改变':'新版资料改变了入场与资金曲线'}</strong><p>相对v2，总收益变化 {(outcome.returnDelta*100).toFixed(2)} 个百分点；最大回撤幅度 {pct(Math.abs(before.maxDrawdown))} → {pct(Math.abs(after.maxDrawdown))}；平均仓位 {pct(before.averageExposure)} → {pct(after.averageExposure)}。实际仓位不同，不能把回撤降低直接解释为选股能力增强。</p></div>
    <div className="cycleTableScroll" role="region" aria-label="v3同规则回测结果" tabIndex={0}><table><thead><tr><th>方案</th><th>总收益</th><th>最大回撤</th><th>平均仓位</th><th>新开仓 / 拒绝检查次数</th><th>成交 / 完整清仓</th></tr></thead><tbody>{comparison.rows.map(r=><tr key={r.key}><th>{r.label}</th><td>{pct(r.totalReturn)}</td><td>{pct(r.maxDrawdown)}</td><td>{pct(r.averageExposure)}</td><td>{r.firstEntries} / {r.rejected}</td><td>{r.trades} / {r.closedPositions}</td></tr>)}</tbody></table></div>
    <p>拒绝次数可能是同一家公司多次触发检查，不代表拒绝了同样数量的公司。本案例v3实际拒绝 {new Set(run.decisions.filter(d=>!d.accepted).map(d=>d.ticker)).size} 家公司。出场规则仍有效，但本窗口完整清仓数为 {after.closedPositions}，尚不能充分评价卖出机制。</p>
    <h4>真正的入场日：旧资料与新资料如何判断？</h4><p>以下日期来自纯趋势首次入场机会；不代表v3全部成交。历史分数是当时公开资料的事后重建，不是今日买卖建议。</p>
    <div className="cycleTableScroll" role="region" aria-label="入场信号时点财报对照" tabIndex={0}><table><thead><tr><th>公司 / 信号日</th><th>v2分数 / 采用报告期</th><th>v3分数 / 采用报告期</th><th>v3资格</th><th>v3当时可用原文</th></tr></thead><tbody>{entries.map(r=><tr key={`${r.ticker}-${r.signalDate}`}><th>{r.name}<small>{r.signalDate}</small></th><td>{r.before.financial.score.toFixed(2)}<small>{r.before.financial.period} · 覆盖 {pct(r.before.financial.observedWeight)}</small></td><td>{r.after.financial.score.toFixed(2)}<small>{r.after.financial.period} · 覆盖 {pct(r.after.financial.observedWeight)}</small></td><td>{r.after.accepted?'通过':'不通过'}<small>{r.after.reason}</small></td><td>{docs(r.after.financial.factIds).map(d=><a className="matchedSource" key={d.id} href={d.sourceUrl} target="_blank" rel="noreferrer">{d.period} · 公开 {d.publishedOn}</a>)}</td></tr>)}</tbody></table></div>
    <details><summary>逐项查看被过滤机会的评分与事后表现</summary>{entries.filter(r=>!r.after.accepted).map(r=><article key={`${r.ticker}-${r.signalDate}`}><h4>{r.name} · 信号日 {r.signalDate}</h4><p>指标覆盖率不计入得分。旧资料可能缺少同比基数，新资料也可能切换到了当时已公开的更新报告期；分差不是这一天突然发生的经营变化。</p><div className="cycleTableScroll" tabIndex={0}><table><thead><tr><th>指标</th><th>权重</th><th>v2分数</th><th>v3分数</th></tr></thead><tbody>{r.after.financial.components.map(c=>{const old=r.before.financial.components.find(x=>x.key===c.key);return <tr key={c.key}><th>{c.label}</th><td>{pct(c.weight)}</td><td>{old?.observed?old.score.toFixed(2):'缺失，50分占位'}</td><td>{c.observed?c.score.toFixed(2):'缺失，50分占位'}</td></tr>;})}</tbody></table></div></article>)}{comparison.opportunities.filter(g=>g.key==='filter-v3').flatMap(g=>g.items).map((o,i)=><p key={i}>{o.name}：若仅固定纯趋势首次建仓股数，{o.entryDate} 至 {o.markDate} 的事后参考收益为 {pct(o.return)}（{o.closed?'已完整退出':'期末未平仓'}）。该参考不能相加成为组合收益归因，也不能据此反向挑选公司。</p>)}{!entries.some(r=>!r.after.accepted)&&<p>本案例没有纯趋势首次入场被v3拒绝。</p>}</details>
    <details><summary>整个窗口的评分变化与剩余限制</summary><p>按2025-03-10至2025-12-31的联合行情日期检查；这里的每日资格不是订单。即使评分或资格变化，也需要价格信号触发才影响新开仓。</p><div className="cycleTableScroll" tabIndex={0}><table><thead><tr><th>公司</th><th>检查日期数</th><th>评分变化日期数</th><th>资格变化日期数</th></tr></thead><tbody>{report.dailyAudits.map(a=><tr key={a.ticker}><th>{a.name}</th><td>{a.observations}</td><td>{a.scoreChangedDates}</td><td>{a.eligibilityChangedDates}</td></tr>)}</tbody></table></div><ul>{report.limitations.map(l=><li key={l}>{l}</li>)}</ul><p>已核对：旧纯趋势/v2控制组逐日曲线和交易复现一致；所用事实公开日期均早于信号日。</p><p>输入校验码：<code>{report.inputId}</code></p></details>
  </section>;
}

export default function V3MatchedBacktestPanel(props:PanelProps){return <ResearchArchiveBoundary files={["matched-filter-suite-v3.json","historical-evidence-2024-2025-v3.json"]}>{archives=><V3MatchedBacktestPanelContent archives={archives} props={props}/>}</ResearchArchiveBoundary>;}
