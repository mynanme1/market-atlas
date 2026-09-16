"use client";
import { useEffect, useState } from "react";
import "./cycle.css";
import { companyCycleExposures, cycleAssumptions, macroObservations } from "./research/cycleModel";

type CycleResult={
  status:string;variantLabel:string;inputId:string;period:{start:string;end:string};
  metrics:{totalReturn:number;maxDrawdown:number;trades:number;cashAdjustedBenchmarkReturn:number};
  cycleAudit:{enabled:boolean;maDays:number;trendDays:number;averageGrossExposure:number;averageClosedHoldingDays:number|null;closedPositions:number;adjustedDecisions:number;coveredDecisions:number;decisions:Array<{signalDate:string;ticker:string;name:string;scale:number;known:boolean}>};
};
type Comparison={status:string;generatedAt:string;inputId:string;results:CycleResult[]};
const pct=(value:number)=>`${(value*100).toFixed(2)}%`;

export default function CycleBacktestPanel({onInspect}:{onInspect:(result:unknown)=>void}){
  const [report,setReport]=useState<Comparison|null>(null);
  const [running,setRunning]=useState(false);
  const [error,setError]=useState("");
  const [days,setDays]=useState(500);
  useEffect(()=>{let active=true;fetch("/research/cycle-backtest-latest.json").then(response=>response.ok?response.json():null).then(value=>{if(active&&value?.status==="comparison")setReport(value);}).catch(()=>{});return()=>{active=false;};},[]);
  async function run(){
    setRunning(true);setError("");
    try{
      const response=await fetch(`/api/paper?action=backtest&days=${days}&mode=reconstructed&comparison=cycle`);
      const payload=await response.json();
      if(!response.ok||payload.status!=="comparison"||payload.results?.length!==4||payload.results.some((row:CycleResult)=>row.status!=="complete"))throw new Error(payload.error??"对照数据不足，请检查行情后重试。");
      setReport(payload);
    }catch(reason){setError(reason instanceof Error?reason.message:"周期回测失败");}finally{setRunning(false);}
  }
  const short=report?.results[0],shortCycle=report?.results[1],patient=report?.results[2],patientCycle=report?.results[3];
  return <section className="cyclePanel" aria-labelledby="cycle-title">
    <header><div><p className="eyebrow">CYCLE & HOLDING HORIZON</p><h3 id="cycle-title">景气环境与投资期限</h3><p>20个交易日是复核频率，持仓可以跨越多次复核。公司论点每日检查；价格趋势分别用 MA20＋60日收益、MA60＋120日收益作对照。</p></div><div className="cycleControls"><label>行情长度<select aria-label="周期回测行情长度" value={days} onChange={event=>setDays(Number(event.target.value))}><option value={300}>300日</option><option value={500}>500日</option></select></label><button onClick={run} disabled={running}>{running?"正在运行四组对照…":"运行周期对照"}</button></div></header>
    <div className="cycleLayers"><article><b>宏观景气 · 每月发布</b><p>已补入中美制造业 PMI，用发布日期控制历史可见性，调整目标仓位。</p></article><article><b>公司论点 · 财报与事件复核</b><p>原有证据链参与评分；高置信反证或净驱动转负触发退出。历史估值仍待补充。</p></article><article><b>交易执行 · 每20日复核</b><p>用较短与较长趋势窗口比较收益和回撤。没有设置“满20日必须卖出”。</p></article></div>
    <p className="cycleScope">本轮为制造业景气代理实验。通胀、利率、信用与库存尚未纳入；四组统一为仅多头、严格入场，并共享同一份行情与证据快照。</p>
    {error&&<p className="paperNotice" role="alert">{error}</p>}
    {report&&short&&shortCycle&&patient&&patientCycle&&<>
      <div className="cycleReportMeta"><b>事后重建 · 非严格回测</b><span>{short.period.start} — {short.period.end}</span><span>生成于 {report.generatedAt.slice(0,10)}</span><a href="/research/cycle-backtest-latest.json" download>下载已保存报告</a></div>
      <div className="cycleTableScroll"><table><caption>同样本对照：英伟达、台积电、紫金矿业、中国广核</caption><thead><tr><th>规则</th><th>总收益</th><th>最大回撤</th><th>平均持仓</th><th>成交笔数</th><th>完整平仓平均持有</th><th>明细</th></tr></thead><tbody>{report.results.map(result=><tr key={result.variantLabel}><th>{result.variantLabel}<small>MA{result.cycleAudit.maDays} / {result.cycleAudit.trendDays}日趋势</small></th><td className={result.metrics.totalReturn>=0?"positive":"negative"}>{pct(result.metrics.totalReturn)}</td><td>{pct(result.metrics.maxDrawdown)}</td><td>{pct(result.cycleAudit.averageGrossExposure)}</td><td>{result.metrics.trades}</td><td>{result.cycleAudit.averageClosedHoldingDays===null?"尚无完整平仓":`${result.cycleAudit.averageClosedHoldingDays.toFixed(0)}天（${result.cycleAudit.closedPositions}笔）`}</td><td><button onClick={()=>onInspect(result)}>查看</button></td></tr>)}</tbody></table></div>
      <div className="cycleFinding"><b>景气条件带来了多少变化？</b><p>短期组收益变化 {((shortCycle.metrics.totalReturn-short.metrics.totalReturn)*100).toFixed(3)} 个百分点；中期组变化 {((patientCycle.metrics.totalReturn-patient.metrics.totalReturn)*100).toFixed(3)} 个百分点。分别有 {shortCycle.cycleAudit.adjustedDecisions} / {patientCycle.cycleAudit.adjustedDecisions} 次候选仓位计算受到调整。</p><p>固定50%候选池＋50%现金参考收益为 {pct(short.metrics.cashAdjustedBenchmarkReturn)}。实际平均持仓见上表，两者风险暴露并不一致；本轮不能据此判断亏损原因，也不能证明周期策略有效。</p></div>
      <details><summary>查看景气影响记录与数据覆盖</summary><div className="cycleTableScroll"><table><thead><tr><th>规则 / 信号日</th><th>公司</th><th>原仓位乘数</th><th>地区数据齐全</th></tr></thead><tbody>{report.results.filter(row=>row.cycleAudit.enabled).flatMap(row=>row.cycleAudit.decisions.map((decision,index)=><tr key={`${row.variantLabel}-${index}`}><td>{row.variantLabel}<small>{decision.signalDate}</small></td><td>{decision.name}</td><td>{decision.scale.toFixed(3)}</td><td>{decision.known?"是":"否；缺失部分不调整"}</td></tr>))}</tbody></table></div><p>这些是通过选股条件后的仓位计算记录，并不等同于实际成交笔数。</p></details>
    </>}
    <details><summary>查看规则、公司敏感度假设及16条原始数据</summary><p>{cycleAssumptions.rule}</p><p>{cycleAssumptions.availability} {cycleAssumptions.missingPolicy}</p><ul>{Object.entries(companyCycleExposures).map(([ticker,item])=><li key={ticker}><b>{ticker}</b>：{item.reason} 敏感度 {item.sensitivity}。</li>)}</ul><div className="cycleTableScroll"><table><thead><tr><th>地区</th><th>统计月份</th><th>发布日期</th><th>PMI / 前值</th><th>出处</th></tr></thead><tbody>{macroObservations.map(row=><tr key={`${row.region}-${row.period}`}><td>{row.region==="CN"?"中国":"美国"}</td><td>{row.period}</td><td>{row.publishedOn}</td><td>{row.pmi.toFixed(1)} / {row.previousPmi.toFixed(1)}</td><td><a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.source}</a></td></tr>)}</tbody></table></div><p>{cycleAssumptions.limitations.join(" ")}</p></details>
  </section>;
}
