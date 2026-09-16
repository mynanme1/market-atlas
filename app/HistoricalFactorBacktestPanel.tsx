"use client";
import {ResearchArchiveBoundary,type ArchiveBundle} from "./ResearchArchiveBoundary";
import type {ArchiveTypes} from "./research/archive-types";
type PanelProps=Record<string, never>;
import {useEffect,useState} from "react";
import "./cycle.css";

type Score={score:number;observedWeight:number;reason:string;period?:string;factIds:string[];components:Array<{label:string;value:number|null;score:number;observed:boolean;weight:number}>};
type Trade={date:string;signalDate:string;name:string;ticker:string;side:string;quantity:number;reason:string;research?:Score};
type Run={id:string;key:string;label:string;scenario:string;period:{start:string;end:string};metrics:{totalReturn:number;maxDrawdown:number;averageExposure:number;trades:number;closedPositions:number};contributions:Array<{name:string;pnl:number}>;trades:Trade[]};
type Report={version:string;inputId:string;period:{start:string;end:string};runs:Run[];scores:Array<Score&{date:string;ticker:string;name:string}>;limitations:string[]};
const pct=(n:number)=>Number.isFinite(n)?`${n>0?"+":""}${(n*100).toFixed(2)}%`:"—";
function HistoricalFactorBacktestPanelContent({archives,props}:{archives:ArchiveBundle;props:PanelProps}){
const evidence=archives["historical-evidence-2024-2025.json"] as ArchiveTypes["historical-evidence-2024-2025.json"];

  const [report,setReport]=useState<Report|null>(null),[error,setError]=useState("");
  const [scenario,setScenario]=useState("base"),[strategy,setStrategy]=useState("financial"),[scoreDate,setScoreDate]=useState("2025-09-30");
  useEffect(()=>{let active=true;fetch("/research/historical-factor-suite-latest.json").then(async r=>{if(!r.ok)throw new Error("历史财报回测报告未能读取。");return r.json();}).then(r=>{if(active)setReport(r);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  const rows=report?.runs.filter(r=>r.scenario===scenario)??[];
  const detail=rows.find(r=>r.key===strategy);
  return <section className="cyclePanel" aria-labelledby="historical-backtest-title">
    <header><div><p className="eyebrow">历史财报已接入 · 独立实验 v1</p><h3 id="historical-backtest-title">新增资料，是否改善了决策？</h3><p>财报事实按公开日进入评分；资料数量不加分，缺失项保持中性。以下不是旧回测，也不是模拟账户盈亏。</p></div></header>
    {error&&<p role="alert">{error}</p>}{!report&&!error&&<p role="status">正在读取固定实验结果…</p>}
    {report&&<>
      <div className="cycleReportMeta"><b>{report.period.start} 至 {report.period.end}</b><span>初始现金100万元 · 24组实验</span><a href="/research/historical-factor-suite-latest.json" download>下载结果与交易记录</a></div>
      <div className="cycleFinding"><b>本轮盈利，但尚未证明财报评分提供稳定超额收益</b><p>两种财报策略的收益和仓位都低于纯趋势；不能只按收益排名，也不能用“收益÷平均仓位”冒充风险调整收益。所有策略均没有完整平仓样本，仍需检验完整亏损退出。</p><p>这批资料不包含完整历史估值与宏观周期，且与旧报告的2026年区间不同。旧资料在2025年空仓，不代表新策略已经战胜旧策略。</p></div>
      <label>比较条件 <select value={scenario} onChange={e=>setScenario(e.target.value)}><option value="base">原成本与起点</option><option value="cost2">佣金与滑点翻倍</option><option value="phase5">复核错开5日</option><option value="restart">7月现金重新开始</option></select></label>
      <div className="cycleTableScroll" tabIndex={0} role="region" aria-label="历史财报策略对照"><table><thead><tr><th>策略</th><th>起点</th><th>累计收益</th><th>最大回撤</th><th>平均仓位</th><th>交易 / 完整退出</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><th>{r.label}</th><td>{r.period.start}</td><td className={r.metrics.totalReturn>=0?"positive":"negative"}>{pct(r.metrics.totalReturn)}</td><td>{pct(r.metrics.maxDrawdown)}</td><td>{(r.metrics.averageExposure*100).toFixed(2)}%</td><td>{r.metrics.trades} / {r.metrics.closedPositions}</td></tr>)}</tbody></table></div>
      <details><summary>评分如何形成，而不是资料越多分越高？</summary><p>收入同比30%＋净利润同比30%＋净利率同比变化20%＋经营现金流方向20%。每项0—100分；缺失固定50分，不重新分配权重。评分≥65时目标12%，50—65分以下只试探3%；低于50不新建仓，低于40、亏损或资料过期退出。目标仓位另受波动率与组合限额影响。</p><p>只比较同口径的上一年期间。最新报告缺少上年可比资料时，相关成分回到中性；这可能使分数回升或下降，并不表示经营改善或恶化，需要继续补比较期资料。</p>
        <label>评分观察日 <select value={scoreDate} onChange={e=>setScoreDate(e.target.value)}>{[...new Set(report.scores.map(s=>s.date))].map(d=><option key={d}>{d}</option>)}</select></label>
        <div className="cycleTableScroll"><table><thead><tr><th>公司 / 报告期</th><th>财务评分</th><th>有数据的指标权重</th><th>各项分数（收入 / 利润 / 利润率 / 现金流）</th></tr></thead><tbody>{report.scores.filter(s=>s.date===scoreDate).map(s=><tr key={s.ticker}><th>{s.name}<small>{s.period??"缺失"}</small></th><td>{s.score.toFixed(1)}</td><td>{Math.round(s.observedWeight*100)}%<small>仅显示缺口，不加分</small></td><td>{s.components.map(c=>`${c.score.toFixed(1)}${c.observed?"":"（缺失）"}`).join(" / ")}</td></tr>)}</tbody></table></div>
      </details>
      <details><summary>单家公司贡献与交易依据</summary><label>查看策略 <select value={strategy} onChange={e=>setStrategy(e.target.value)}><option value="financial">财报评分持有</option><option value="financial-slow">财报评分＋低频趋势</option><option value="price-slow">纯低频趋势</option></select></label>
        {detail&&<><p>{detail.contributions.map(c=>`${c.name}：${c.pnl>=0?"+":""}${c.pnl.toLocaleString("zh-CN",{maximumFractionDigits:0})}元`).join("；")}。包含期末未实现盈亏。</p>
          {detail.trades.map((t,i)=><details key={`${detail.id}-${i}`}><summary>{t.date} · {t.side} {t.name} {t.quantity.toLocaleString()}股</summary><p>信号日 {t.signalDate}；{t.reason}。</p>{t.research&&<><p>当时财务评分 {t.research.score.toFixed(1)}；有数据的指标权重 {Math.round(t.research.observedWeight*100)}%；{t.research.reason}。</p><ul>{evidence.documents.filter(d=>d.facts.some(f=>t.research!.factIds.includes(f.id))).map(d=><li key={d.id}><a href={d.sourceUrl} target="_blank" rel="noreferrer">{d.title}</a> · 公开日 {d.publishedOn}</li>)}</ul></>}</details>)}
        </>}
      </details>
      <details><summary>固定规则与结果边界</summary><ul>{report.limitations.map(l=><li key={l}>{l}</li>)}</ul><p>财报＋趋势每5日检查买入：高于MA60至少2%、120日收益为正；连续5日低于MA60且120日收益非正退出。信号后下一可交易收盘成交，佣金3bp、滑点5bp；并非保证可成交价格。</p><small>版本 {report.version} · 输入校验 {report.inputId.slice(0,16)}</small></details>
    </>}
  </section>;
}

export default function HistoricalFactorBacktestPanel(props:PanelProps){return <ResearchArchiveBoundary files={["historical-evidence-2024-2025.json"]}>{archives=><HistoricalFactorBacktestPanelContent archives={archives} props={props}/>}</ResearchArchiveBoundary>;}
