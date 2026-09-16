"use client";
import {ResearchArchiveBoundary,type ArchiveBundle} from "./ResearchArchiveBoundary";
import type {ArchiveTypes} from "./research/archive-types";
type PanelProps=Record<string, never>;
import {useState} from 'react';
import './cycle.css';
import './matched-filter.css';
const pct=(v:number)=>`${(v*100).toFixed(2)}%`,money=(v:number)=>v.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
function StrategyImprovementPanelContent({archives,props}:{archives:ArchiveBundle;props:PanelProps}){
const report=archives["strategy-improvement-v1.json"] as ArchiveTypes["strategy-improvement-v1.json"];

  const [scenario,setScenario]=useState('base'),[strategy,setStrategy]=useState('combined');
  const result=report.results.find(r=>r.scenario===scenario)!,run=result.runs.find(r=>r.key===strategy)!;
  return <section className="cyclePanel matchedFilter" aria-labelledby="improvement-title">
    <header><div><p className="eyebrow">策略改进实验 · 2026-09-10 · 20组完整对照</p><h3 id="improvement-title">加上风控和退出，是否真的更合适？</h3><p>原v3、组合风险、退出改进、防追涨及三项组合分别测试。所有参数先固定，展示全部结果，不自动启用。</p></div></header>
    <div className="matchedControls"><label>回测案例<select value={scenario} onChange={e=>setScenario(e.target.value)}>{report.results.map(r=><option key={r.scenario} value={r.scenario}>{r.label}</option>)}</select></label><p>{result.start} — {result.end} · 初始100万元 · 含期末浮盈亏，非年化</p><a href="/research/strategy-improvement-v1.json" download>下载20组结果与交易记录</a></div>
    <div className="cycleFinding"><strong>当前状态：实验保留，默认策略未改变</strong><p>预设门槛是在至少3个案例中，同时保留原v3至少80%的收益、将回撤幅度降到原来的80%以内。{report.promotion.filter(r=>r.passedCases>=r.required).length} 个新方案达到该探索门槛；即使达到，仍需行情口径和独立验证通过。</p></div>
    <div className="cycleTableScroll" role="region" aria-label="五方案策略改进回测" tabIndex={0}><table><thead><tr><th>方案</th><th>总收益</th><th>回撤幅度</th><th>平均仓位</th><th>日波动</th><th>成交 / 完整清仓</th><th>本案例门槛</th></tr></thead><tbody>{result.runs.map(r=><tr key={r.key}><th>{r.label}</th><td>{pct(r.metrics.totalReturn)}</td><td>{pct(Math.abs(r.metrics.maxDrawdown))}</td><td>{pct(r.metrics.averageExposure)}</td><td>{pct(r.metrics.dailyVolatility)}</td><td>{r.metrics.trades} / {r.metrics.closedPositions}</td><td>{r.key==='baseline'?'对照基准':result.screen.find(s=>s.key===r.key)?.passed?'达到':'未达到'}</td></tr>)}</tbody></table></div>
    <details><summary>具体改了哪些规则？哪些仍未完成？</summary><ul><li>组合风险：相关性≥0.70的连通组目标合计≤18%，四股目标篮子按近60个共同收益样本估计波动缩小至6%预算，不加杠杆；低频调仓下实际风险不保证达到目标。</li><li>退出：连续5日低于MA60，或持仓收盘高点回撤12%，或有效财务反证，发出下一可交易日收盘退出信号；退出后10个自身交易日冷静期。不是保证12%成交止损。</li><li>防追涨：新开仓价格不得高于MA60的115%，不据此强卖持仓。它不是PE或估值判断。</li><li>财务退出：最新净利润非正，或观测指标权重≥60%且评分&lt;40。单纯资料缺失不等于必须清仓。</li></ul><p>未完成：历史估值、市场一致预期、完整经济周期与真正未用于调参区间的验证。2026年虽然有价格，但缺连续财报；不能硬跑后称为完整样本外验证。</p></details>
    <div className="matchedControls"><label>检查交易与风险计划<select value={strategy} onChange={e=>setStrategy(e.target.value)}>{result.runs.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</select></label><p>{run.label} · 期末资产 ¥{money(run.metrics.finalValue)} · 完整持仓周期盈利 {run.metrics.winningClosed} 次 / 非盈利 {run.metrics.losingClosed} 次</p></div>
    <h4>完整清仓记录：不只看触发信号</h4>{run.roundTrips.length?<div className="cycleTableScroll" role="region" aria-label="完整持仓周期" tabIndex={0}><table><thead><tr><th>公司</th><th>入场 / 清仓</th><th>周期盈亏</th><th>退出原因</th></tr></thead><tbody>{run.roundTrips.map((r,i)=><tr key={i}><th>{r.name}</th><td>{r.entry}<small>{r.exit}</small></td><td>¥{money(r.pnl)}</td><td>{run.trades.find(t=>t.ticker===r.ticker&&t.date===r.exit&&t.side==='卖出')?.reason??'见交易记录'}</td></tr>)}</tbody></table></div>:<p>本组没有完整清仓，不能从中推算清仓胜率。已卖出的部分仓位与期末未平仓部分不算完整持仓周期。</p>}
    <p>完整周期盈亏包含该周期全部买入、部分卖出及最终清仓成本，不等于全部账户已实现盈亏。全部公司贡献（含期末持仓）如下。</p>
    <div className="cycleTableScroll" tabIndex={0}><table><thead><tr><th>公司</th><th>账户盈亏贡献</th></tr></thead><tbody>{run.metrics.contributions.map(c=><tr key={c.ticker}><th>{c.name}</th><td>¥{money(c.pnl)}</td></tr>)}</tbody></table></div>
    <details><summary>时间分段、仓位计划与剩余限制</summary><p>以下按连续账户曲线分段，不重选参数，也不是独立样本外。</p>{run.segments.map(s=><p key={s.start}>{s.label} · {s.start} — {s.end}：收益 {pct(s.totalReturn)}，段内回撤幅度 {pct(Math.abs(s.maxDrawdown))}</p>)}<p>本组记录 {run.riskPlans.length} 个风险计划日期；相关性采用共同日期，跨市场间隔不同，年化252仅为模型近似。四股目标篮子不等于当时实际持仓。</p><ul>{report.limitations.map(l=><li key={l}>{l}</li>)}</ul><p>输入校验码：<code>{report.inputId}</code></p></details>
  </section>;
}

export default function StrategyImprovementPanel(props:PanelProps){return <ResearchArchiveBoundary files={["strategy-improvement-v1.json"]}>{archives=><StrategyImprovementPanelContent archives={archives} props={props}/>}</ResearchArchiveBoundary>;}
