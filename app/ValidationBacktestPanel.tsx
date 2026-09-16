"use client";
import {useEffect,useState} from "react";
import "./cycle.css";
type Run={id:string;key:string;label:string;category:string;caseLabel:string;period:{start:string;end:string};metrics:{totalReturn:number;maxDrawdown:number;averageExposure:number;trades:number;closedPositions:number}};
type Report={status:string;protocol:{version:string;frozenOn:string};period:{start:string;end:string};longPeriod:{start:string;end:string};coverage:Array<{name:string;ticker:string;priceStart:string;firstFact:string|null;facts:number}>;runs:Run[];limitations:string[]};
const pct=(n:number)=>Number.isFinite(n)?`${n>0?"+":""}${(n*100).toFixed(3)}%`:"—";
const tabs=[{key:"budget",label:"仓位参考"},{key:"exclude",label:"不交易某家公司"},{key:"restart",label:"不同时间空仓起步"},{key:"long-price",label:"更长价格历史"}];
export default function ValidationBacktestPanel(){
  const [report,setReport]=useState<Report|null>(null),[view,setView]=useState("budget"),[running,setRunning]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let active=true;fetch("/research/validation-suite-latest.json").then(async r=>{if(!r.ok)throw new Error("验证报告未能加载，可尝试重跑。");return r.json();}).then(d=>{if(active)setReport(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  async function run(){setRunning(true);setError("");try{const r=await fetch("/api/execution-backtest?suite=validation"),d=await r.json();if(!r.ok)throw new Error(d.error??"验证失败");setReport(d);}catch(e){setError(e instanceof Error?e.message:"验证失败");}finally{setRunning(false);}}
  const rows=report?.runs.filter(r=>r.category===view||view==="budget"&&r.category==="base")??[];
  const slow=report?.runs.find(r=>r.key==="slow"&&r.category==="base");
  const restarts=report?.runs.filter(r=>r.key==="slow"&&r.category==="restart")??[];
  return <section className="cyclePanel" aria-labelledby="validation-title">
    <header><div><p className="eyebrow">CANDIDATE VALIDATION · 2026-09-09</p><h3 id="validation-title">候选复核：换个起点，还成立吗？</h3><p>固定三组候选，检查单家公司依赖、低仓位参考和新账户入场结果。不重新挑选参数，不改动模拟账户。</p></div><div className="cycleControls"><button onClick={run} disabled={running}>{running?"正在验证29组…":"重跑候选验证"}</button></div></header>
    {error&&<p role="alert">{error}</p>}
    {!report&&!error&&<p role="status">正在加载候选验证…</p>}
    {report&&<>
      <div className="cycleReportMeta"><b>开发样本诊断 · 不是样本外业绩</b><span>规则版本：{report.protocol.frozenOn}</span><a href="/research/validation-suite-latest.json" download>下载保存摘要</a></div>
      <div className="cycleFinding"><b>后续检查削弱了“低频趋势已经领先”的判断</b><p>它在原起点收益 {pct(slow?.metrics.totalReturn??NaN)}；{restarts.map(r=>`${r.period.start} 空仓起步 ${pct(r.metrics.totalReturn)}`).join("；")}。新建仓账户没有享受到旧持仓此前的浮盈，不能用原区间收益回答“现在开始是否有效”。</p><p>三组候选仍需继续验证；缺少真实退出样本和更早证据，目前没有足够依据自动切换策略或扩大仓位。</p></div>
      <label htmlFor="validation-view">检验问题 </label><select id="validation-view" value={view} onChange={e=>setView(e.target.value)}>{tabs.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}</select>
      <p>{view==="budget"?"给等权参考分别设置6%、12%、48%总目标仓位，观察收益与回撤。只是相近仓位参照，不是严格相同风险。":view==="exclude"?"仅禁止交易所选公司，保留它的研究事实和原日历，也不把空出的仓位强制分给其他公司。":view==="restart"?"每个起点重置为100万元现金；历史指标仍可预热，事实必须当时已公开。这些区间相互重叠，不是独立样本。":"只有价格参考可以从更早年份开始。此区间缺少公司证据，不展示基本面策略的伪历史结果。"}</p>
      <div className="cycleTableScroll"><table><thead><tr><th>策略 / 检验条件</th><th>起点</th><th>累计收益</th><th>最大回撤</th><th>平均仓位</th><th>成交 / 完整平仓</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><th>{r.label}<small>{r.caseLabel}</small></th><td>{r.period.start}</td><td className={r.metrics.totalReturn>=0?"positive":"negative"}>{pct(r.metrics.totalReturn)}</td><td>{pct(r.metrics.maxDrawdown)}</td><td>{(r.metrics.averageExposure*100).toFixed(2)}%</td><td>{r.metrics.trades} / {r.metrics.closedPositions}</td></tr>)}</tbody></table></div>
      <p>所有结果截至 {report.period.end}，起始现金均100万元；包含浮盈亏与佣金、滑点，不是今日账户收益。</p>
      <details><summary>为什么没有更早年份的基本面策略业绩？</summary><div className="cycleTableScroll"><table><thead><tr><th>公司</th><th>已有行情起点</th><th>旧回测输入的最早事实公开日</th><th>旧输入事实条数</th></tr></thead><tbody>{report.coverage.map(c=><tr key={c.ticker}><th>{c.name}</th><td>{c.priceStart}</td><td>{c.firstFact??"缺失"}</td><td>{c.facts}</td></tr>)}</tbody></table></div><p>上表来自这份报告的冻结输入，不是最新资料库。最早已录入事实不是公司首次披露日期。价格参考可从预热后的 {report.longPeriod.start} 开始，但不能将现在的证据评分复制到那时。</p><p>已在“证据模板”的历史财报区补入四家公司2024—2025年公开文件和重述版本。新资料尚未接入本报告的评分规则，因此旧结果保持不变；历史估值、宏观与行业数据仍待补齐。</p></details>
      <details><summary>解释边界与固定测试条件</summary><ul>{report.limitations.map(s=><li key={s}>{s}</li>)}</ul><p>29次实验＝3组原样复现＋12组禁止单公司交易＋9组新起点＋2组低仓位参考＋3组长期价格参考。没有把29次当作29个独立验证样本。</p></details>
    </>}
  </section>;
}
