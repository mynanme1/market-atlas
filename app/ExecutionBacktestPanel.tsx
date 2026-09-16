"use client";
import {useEffect,useState} from "react";
import "./cycle.css";

type Trade={date:string;signalDate:string;name:string;side:string;quantity:number;value:number;fee:number;reason:string};
type Result={key:string;label:string;metrics:{totalReturn:number;maxDrawdown:number;averageExposure:number;trades:number;turnover:number;fees:number;closedPositions:number;losingShortHolds:number;reentriesWithin20CalendarDays:number;closedProfitGiveback:number};trades:Trade[];roundTrips:Array<{name:string;entry:string;exit:string;pnl:number;holdingDays:number}>};
type Report={status:string;generatedAt:string;period:{start:string;end:string};results:Result[];limitations:string[]};
const pct=(value:number)=>`${(value*100).toFixed(3)}%`;
const cash=(value:number)=>value.toLocaleString("zh-CN",{maximumFractionDigits:2});
export default function ExecutionBacktestPanel(){
  const [report,setReport]=useState<Report|null>(null),[running,setRunning]=useState(false),[error,setError]=useState(""),[selected,setSelected]=useState("local");
  useEffect(()=>{let active=true;fetch("/research/execution-backtest-latest.json").then(r=>r.ok?r.json():null).then(d=>{if(active&&d?.status==="complete")setReport(d);}).catch(()=>{});return()=>{active=false;};},[]);
  async function run(){setRunning(true);setError("");try{const r=await fetch("/api/execution-backtest"),d=await r.json();if(!r.ok)throw new Error(d.error??"回测失败");setReport(d);}catch(e){setError(e instanceof Error?e.message:"回测失败");}finally{setRunning(false);}}
  const chosen=report?.results.find(r=>r.key===selected);
  return <section className="cyclePanel" aria-labelledby="execution-title">
    <header><div><p className="eyebrow">ENTRY · HOLD · REDUCE · EXIT</p><h3 id="execution-title">每日检查与分级买卖回测</h3><p>沿用上次保存的四家公司历史数据，分别检验检查频率、买卖机制和交易日历。20日复核保留为组合仓位检查。</p></div><div className="cycleControls"><button disabled={running} onClick={run}>{running?"正在复核四组…":"重跑冻结数据"}</button></div></header>
    <div className="cycleLayers"><article><b>买入与补仓</b><p>连续2日站上MA20上方1%，60日收益为正，且未触发清仓条件，先进入目标仓位的一半。至少等待5个交易日、再次确认后补足。</p></article><article><b>持有与减仓</b><p>连续2日跌破MA20，持仓减半一次。恢复确认前不重复减半，也不会因未满足新买入条件就自动清仓。</p></article><article><b>清仓与再入场</b><p>论点失效、连续3日跌破MA60，或持仓后收盘高点回撤12%时退出。清仓后等待5个交易日，再满足买入确认才进入。</p></article></div>
    <p className="cycleScope">阈值是固定的实验假设；未按本轮结果调优。新规则使用原证据评分与风险上限，不额外叠加景气系数。本次只回测，不修改当前模拟账户。</p>
    {error&&<p role="alert" className="paperNotice">{error}</p>}
    {report&&<><div className="cycleReportMeta"><b>事后重建 · 非样本外验证</b><span>{report.period.start} — {report.period.end}</span><a href="/research/execution-backtest-latest.json" download>下载本轮报告</a></div>
      <div className="cycleTableScroll"><table><thead><tr><th>方案</th><th>收益</th><th>最大回撤</th><th>平均持仓</th><th>成交笔数</th><th>换手倍数</th><th>佣金（元）</th><th>短期再入场</th></tr></thead><tbody>{report.results.map(r=><tr key={r.key}><th>{r.label}</th><td className={r.metrics.totalReturn>=0?"positive":"negative"}>{pct(r.metrics.totalReturn)}</td><td>{pct(r.metrics.maxDrawdown)}</td><td>{pct(r.metrics.averageExposure)}</td><td>{r.metrics.trades}</td><td>{r.metrics.turnover.toFixed(2)}</td><td>{cash(r.metrics.fees)}</td><td>{r.metrics.reentriesWithin20CalendarDays}</td></tr>)}</tbody></table></div>
      <div className="cycleFinding"><b>是否改善，要看哪一组对照？</b><p>共同交易日下，新规则相对每日复核原规则的收益变化为 {((report.results[2].metrics.totalReturn-report.results[1].metrics.totalReturn)*100).toFixed(3)} 个百分点；相对20日原规则变化为 {((report.results[2].metrics.totalReturn-report.results[0].metrics.totalReturn)*100).toFixed(3)} 个百分点。交易更及时不等于收益更高。</p><p>前三组共用原回测日期；第四组额外按各市场自身交易日检查和执行。短期再入场指完整清仓后20个自然日内重新买入；佣金已扣除，滑点另计在成交价格中。</p></div>
      <label>选择交易明细 <select value={selected} onChange={e=>setSelected(e.target.value)}>{report.results.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
      {chosen&&<details><summary>{chosen.label}：查看全部{chosen.trades.length}笔成交与退出原因</summary><div className="cycleTableScroll"><table><thead><tr><th>信号 / 成交</th><th>公司</th><th>方向 / 股数</th><th>金额（元）</th><th>原因</th></tr></thead><tbody>{chosen.trades.map((t,i)=><tr key={i}><td>{t.signalDate}<small>{t.date}</small></td><td>{t.name}</td><td>{t.side} / {t.quantity}</td><td>{cash(t.value)}</td><td>{t.reason}</td></tr>)}</tbody></table></div><p>完整平仓 {chosen.metrics.closedPositions} 笔，其中持有不超过20个自然日且亏损 {chosen.metrics.losingShortHolds} 笔。已平仓交易合计回吐曾有浮盈 {cash(chosen.metrics.closedProfitGiveback)} 元；该数值随交易次数和仓位变化，并非独立风险指标。</p></details>}
      <details><summary>数据与结果的适用范围</summary><ul>{report.limitations.map(l=><li key={l}>{l}</li>)}</ul></details>
    </>}
  </section>;
}
