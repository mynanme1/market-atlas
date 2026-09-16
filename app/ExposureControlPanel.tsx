"use client";
import {ResearchArchiveBoundary,type ArchiveBundle} from "./ResearchArchiveBoundary";
import type {ArchiveTypes} from "./research/archive-types";
type PanelProps=Record<string, never>;
import {useState} from 'react';
import './cycle.css';
import './matched-filter.css';
const pct=(v:number)=>`${(v*100).toFixed(2)}%`;
const pp=(v:number)=>`${(v*100).toFixed(2)} 个百分点`;
function ExposureControlPanelContent({archives,props}:{archives:ArchiveBundle;props:PanelProps}){
const report=archives["exposure-control-v1.json"] as ArchiveTypes["exposure-control-v1.json"];

  const [scenario,setScenario]=useState('base');
  const result=report.results.find(r=>r.scenario===scenario)!;
  const budget=result.runs.find(r=>r.key==='budget')!,filtered=result.runs.find(r=>r.key==='filter-v3')!;
  const [matchedPure,matchedFilter]=result.diagnostic.rows;
  return <section className="cyclePanel matchedFilter" aria-labelledby="exposure-title">
    <header><div><p className="eyebrow">最新对照 · 资金预算与公司过滤</p><h3 id="exposure-title">是选股的作用，还是少持仓的作用？</h3><p>同股票仓位不等于同风险。先比较按原成交假设运行的预算对照，再看不产生订单的同仓位诊断。未修改默认策略、未下单。</p></div></header>
    <div className="matchedControls"><label>对照案例<select value={scenario} onChange={e=>setScenario(e.target.value)}>{report.results.map(r=><option key={r.scenario} value={r.scenario}>{r.label}</option>)}</select></label><p>{result.start} — {result.end} · 初始100万元 · 含期末浮盈亏，非年化</p><a href="/research/exposure-control-v1.json" download>下载仓位对照与预算记录</a></div>
    <div className="cycleFinding"><strong>过滤公司与统一缩减预算，并不是同一种取舍</strong><p>v3过滤相对预算组的收益差为 {pp(filtered.metrics.totalReturn-budget.metrics.totalReturn)}，日波动 {pct(budget.metrics.dailyVolatility)} → {pct(filtered.metrics.dailyVolatility)}。日波动按联合行情日收益标准差计算，未年化；不能只看收益判断策略优劣。</p></div>
    <h4>一、含交易成本与手数约束的回测</h4><p>预算组仍保留纯趋势选股，只用信号日及此前最近20个行情日的参考仓位缩放单股目标。它也使用财报信息，但仅用于预算，不能称作“完全不含财报”的对照。</p>
    <div className="cycleTableScroll" role="region" aria-label="预算控制与公司过滤回测" tabIndex={0}><table><thead><tr><th>方案</th><th>总收益</th><th>最大回撤幅度</th><th>平均股票仓位</th><th>日波动</th><th>建仓公司 / 成交笔数</th></tr></thead><tbody>{result.runs.map(r=><tr key={r.key}><th>{r.label}</th><td>{pct(r.metrics.totalReturn)}</td><td>{pct(Math.abs(r.metrics.maxDrawdown))}</td><td>{pct(r.metrics.averageExposure)}</td><td>{pct(r.metrics.dailyVolatility)}</td><td>{r.metrics.firstEntries} / {r.metrics.trades}</td></tr>)}</tbody></table></div>
    <p>仓位并未完全匹配：预算组与过滤组的逐日仓位差，平均绝对值为 {pp(result.budgetExposureGap.meanAbsolute)}，最大为 {pp(result.budgetExposureGap.maximumAbsolute)}。保留原低频调仓会产生滞后，不能隐藏这部分误差。</p>
    <details><summary>查看预算如何确定（不是订单表）</summary><p>k = 最近20日v3参考仓位之和 ÷ 同期纯趋势参考仓位之和，限制在0—1；分母为零取1。单股目标 = 12% × 原波动缩放 × k。没有用全期平均仓位倒推历史；持仓仍按原20日复核和10%偏离规则调整。</p><div className="cycleTableScroll" tabIndex={0}><table><thead><tr><th>信号日</th><th>来源截止日</th><th>观察日期数</th><th>预算缩放</th></tr></thead><tbody>{[...new Map(result.budgetLog.map(r=>[r.signalDate,r])).values()].map(r=><tr key={r.signalDate}><th>{r.signalDate}</th><td>{r.sourceThrough??'无，使用默认值'}</td><td>{r.observations}</td><td>{pct(r.scale)}</td></tr>)}</tbody></table></div></details>
    <hr/><h4>二、前一日仓位拉齐：仅作理想化诊断</h4><p>每一期公共股票仓位取两组前一日仓位的较小值，各自按比例缩小，不加杠杆。以下不是重新成交的股票组合，不能当成可交易策略收益。</p>
    <div className="cycleTableScroll" role="region" aria-label="理想化同股票仓位诊断" tabIndex={0}><table><thead><tr><th>诊断组合</th><th>总收益</th><th>最大回撤幅度</th><th>平均期初股票仓位</th><th>日波动</th></tr></thead><tbody>{result.diagnostic.rows.map(r=><tr key={r.label}><th>{r.label}</th><td>{pct(r.totalReturn)}</td><td>{pct(Math.abs(r.maxDrawdown))}</td><td>{pct(r.averageOpeningExposure)}</td><td>{pct(r.dailyVolatility)}</td></tr>)}</tbody></table></div>
    <p>拉齐期初仓位后，过滤组合的收益差为 {pp(result.diagnostic.returnGap)}，但回撤幅度为 {pct(Math.abs(matchedFilter.maxDrawdown))}，对照为 {pct(Math.abs(matchedPure.maxDrawdown))}。差额仍包含持仓组成、权重、时点与成本缩放，不是已经证实的“选股超额收益”。</p>
    <p className="cycleFinding">诊断缩放了原净值内的佣金和滑点，未另计虚拟组合再平衡成本。{result.diagnostic.observations} 个收益区间中，有 {result.diagnostic.zeroTargetDates} 个公共仓位为零，两组都持现金；因此也没有复制原首笔建仓费用。不能与上表交易回测混算。</p>
    <details><summary>结论边界及审计</summary><ul>{report.limitations.map(l=><li key={l}>{l}</li>)}</ul><p>原纯趋势与v3过滤的交易和逐日曲线均与上轮报告复现一致。此窗口反复研究过，四个案例相互重叠，不是四次独立验证。下一步应固定方案，修复行情口径后在未用于调参的时段验证，不据本表直接增加仓位。</p><p>输入校验码：<code>{report.inputId}</code></p></details>
  </section>;
}

export default function ExposureControlPanel(props:PanelProps){return <ResearchArchiveBoundary files={["exposure-control-v1.json"]}>{archives=><ExposureControlPanelContent archives={archives} props={props}/>}</ResearchArchiveBoundary>;}
