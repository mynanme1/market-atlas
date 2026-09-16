"use client";
import {useEffect,useState} from "react";
import "./cycle.css";

type Metrics={totalReturn:number;maxDrawdown:number;averageExposure:number;trades:number;closedPositions:number};
type Result={key:string;label:string;group:string;rule:string;metrics:Metrics;openPositions:Array<{ticker:string;quantity:number}>;robustness:Array<{key:string;label:string;metrics:Metrics}>;robustnessSummary:{minimumReturn:number;maximumReturn:number;positiveRuns:number};segments:{splitDate:string;firstHalf:number;secondHalf:number;months:Array<{month:string;return:number;averageExposure:number}>};contributions:Array<{ticker:string;name:string;pnl:number;trades:number}>};
type Report={status:string;inputId:string;period:{start:string;end:string};results:Result[];assumptions:string[];limitations:string[];sources:Array<{title:string;url:string;note:string}>};
const pct=(n:number)=>Number.isFinite(n)?`${n>0?"+":""}${(n*100).toFixed(2)}%`:"—";
const money=(n:number)=>n.toLocaleString("zh-CN",{maximumFractionDigits:0});
export default function StrategySuitePanel(){
  const [report,setReport]=useState<Report|null>(null),[selected,setSelected]=useState("slow"),[running,setRunning]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let active=true;fetch("/research/strategy-suite-latest.json").then(async r=>{if(!r.ok)throw new Error("回测报告暂未加载，请点击重跑。");return r.json();}).then(d=>{if(active&&d?.status==="complete")setReport(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  async function run(){setRunning(true);setError("");try{const response=await fetch("/api/execution-backtest?suite=families"),d=await response.json();if(!response.ok||d.status!=="complete")throw new Error(d.error??"回测失败");setReport(d);}catch(e){setError(e instanceof Error?e.message:"回测失败");}finally{setRunning(false);}}
  function download(){if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="strategy-suite-current.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const chosen=report?.results.find(r=>r.key===selected);
  const slow=report?.results.find(r=>r.key==="slow"),equal=report?.results.find(r=>r.key==="equal");
  return <section className="cyclePanel" aria-labelledby="strategy-suite-title">
    <header><div><p className="eyebrow">STRATEGY LAB · FROZEN INPUTS</p><h3 id="strategy-suite-title">多策略实验：收益从哪里来？</h3><p>8类固定策略 × 4种成本与复核安排。区分公司研究、价格信号与等权参考，同时检查仓位、回撤和收益集中度。</p></div><div className="cycleControls"><button disabled={running} onClick={run}>{running?"正在计算32组…":"重跑多策略对照"}</button></div></header>
    <p className="cycleScope">这是冻结样本回测，不是今日行情，也不会修改账户、自动启用策略或下单。所有方案统一按各市场交易日计算；下方旧实验包含不同日历口径，请勿直接混比。</p>
    {error&&<p role="alert">{error}</p>}
    {!report&&!error&&<p role="status">正在读取已保存的回测结果…</p>}
    {report&&<>
      <div className="cycleReportMeta"><b>事后重建 · 尚非样本外验证</b><span>{report.period.start} — {report.period.end}</span><span>英伟达 / 台积电 / 紫金矿业 / 中国广核</span><button onClick={download}>下载当前结果</button></div>
      <div className="cycleTableScroll"><table><caption>同一100万元起点；收益含未平仓浮盈亏，佣金与滑点已计入</caption><thead><tr><th>策略 / 类型</th><th>累计收益</th><th>最大回撤</th><th>平均持仓</th><th>成交 / 完整平仓</th><th>4场景收益范围</th></tr></thead><tbody>{report.results.map(r=><tr key={r.key}><th>{r.label}<small>{r.group}</small></th><td className={r.metrics.totalReturn>=0?"positive":"negative"}>{pct(r.metrics.totalReturn)}</td><td>{pct(r.metrics.maxDrawdown)}</td><td>{(r.metrics.averageExposure*100).toFixed(1)}%</td><td>{r.metrics.trades} / {r.metrics.closedPositions}</td><td>{pct(r.robustnessSummary.minimumReturn)} ～ {pct(r.robustnessSummary.maximumReturn)}</td></tr>)}</tbody></table></div>
      {slow&&equal&&<div className="cycleFinding"><b>上一轮提出的候选：论点＋低频趋势；最新判断见上方候选复核</b><p>本轮收益 {pct(slow.metrics.totalReturn)}，最大回撤 {pct(slow.metrics.maxDrawdown)}；4种安排中有 {slow.robustnessSummary.positiveRuns} 种盈利。但完整平仓仅 {slow.metrics.closedPositions} 笔，不能据此证明退出规则有效。请结合下方公司贡献检查是否依赖单一股票。</p><p>等权参考收益 {pct(equal.metrics.totalReturn)} 更高，但平均持仓 {(equal.metrics.averageExposure*100).toFixed(1)}%，回撤 {pct(equal.metrics.maxDrawdown)}。不同策略实际风险暴露不同，尚未验证同等风险下谁更优。</p></div>}
      <label htmlFor="strategy-detail">查看策略与收益拆解 </label><select id="strategy-detail" value={selected} onChange={e=>setSelected(e.target.value)}>{report.results.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</select>
      {chosen&&<>
        <p><b>固定规则：</b>{chosen.rule}</p>
        <div className="cycleLayers"><article><b>前半段 / 后半段</b><p>{pct(chosen.segments.firstHalf)} / {pct(chosen.segments.secondHalf)}</p><p>分界日 {chosen.segments.splitDate}，连续账户拆分，不是两次独立验证。</p></article><article><b>期末仍有 {chosen.openPositions.length} 家持仓</b><p>{chosen.openPositions.length?chosen.openPositions.map(p=>`${p.ticker}：${p.quantity}股`).join("；"):"期末空仓"}</p><p>浮盈不是已经落袋的收益；缺少完整退出样本时，不展示误导性的胜率。</p></article><article><b>敏感性，而非胜率</b><p>4场景中 {chosen.robustnessSummary.positiveRuns} 个正收益。</p><p>场景共用同一段行情，且部分每日策略不受复核日影响，不能把它当作成功概率。</p></article></div>
        <div className="cycleTableScroll"><table><caption>收益归因：已实现＋未实现，扣除成本</caption><thead><tr><th>公司</th><th>贡献金额（元）</th><th>贡献收益（百分点）</th><th>成交笔数</th></tr></thead><tbody>{chosen.contributions.map(c=><tr key={c.ticker}><th>{c.name}<small>{c.ticker}</small></th><td className={c.pnl>=0?"positive":"negative"}>{money(c.pnl)}</td><td>{(c.pnl/10000).toFixed(3)}</td><td>{c.trades}</td></tr>)}</tbody></table></div>
        <details><summary>成本与复核日期敏感性</summary><div className="cycleTableScroll"><table><thead><tr><th>场景</th><th>收益</th><th>最大回撤</th><th>成交笔数</th></tr></thead><tbody>{chosen.robustness.map(r=><tr key={r.key}><th>{r.label}</th><td>{pct(r.metrics.totalReturn)}</td><td>{pct(r.metrics.maxDrawdown)}</td><td>{r.metrics.trades}</td></tr>)}</tbody></table></div></details>
        <details><summary>月度表现：是否只赢在某一段行情？</summary><div className="cycleTableScroll"><table><thead><tr><th>月份</th><th>当月收益</th><th>平均持仓</th></tr></thead><tbody>{chosen.segments.months.map(m=><tr key={m.month}><th>{m.month}</th><td>{pct(m.return)}</td><td>{(m.averageExposure*100).toFixed(1)}%</td></tr>)}</tbody></table></div><p>首尾月份为不完整月份；使用月末连续净值计算，没有强制清仓。</p></details>
      </>}
      <details><summary>实验边界、缺失信息与研究来源</summary><ul>{[...report.assumptions,...report.limitations].map(s=><li key={s}>{s}</li>)}</ul><p>经济周期需要当时已公布的宏观与行业数据。120日价格趋势仍不是经济周期模型；本轮没有验证完整的宏观择时能力。</p>{report.sources.map(s=><p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a><br/>{s.note}</p>)}<p>冻结输入指纹：{report.inputId.slice(0,16)}…</p></details>
    </>}
  </section>;
}
