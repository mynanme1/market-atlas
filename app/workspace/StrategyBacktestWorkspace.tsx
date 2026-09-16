"use client";
import { useState } from "react";
import CycleBacktestPanel from "../CycleBacktestPanel";
type BacktestComplete = {
  status:"complete";mode:"strict"|"reconstructed";generatedAt:string; period:{start:string;end:string;calendarDays:number};
  metrics:{initialCash:number;finalValue:number;totalReturn:number;annualizedReturn:number;benchmarkReturn:number;excessReturn:number;cashAdjustedBenchmarkReturn:number;cashAdjustedExcessReturn:number;maxDrawdown:number;annualizedVolatility:number;sharpe:number;trades:number;closedTrades:number;winRate:number;turnover:number;shortEntries?:number;borrowCosts?:number};
  parameters:{requestedDays:number;rebalanceDays:number;entryRule?:"strict"|"balanced";entryRuleLabel?:string;enableShorts?:boolean;targetInvested:number;maxPositions:number;maxPosition:number;maxChain:number;maxGrossShort?:number;maxShortPosition?:number;annualBorrowRate?:number;commissionBps:number;slippageBps:number;execution:string;exitRules?:string[]};
  universe:{requested:number;tested:number;names:string[]};
  reconstructionAudit?:{
    currentProbabilitiesUsed:boolean;staticImpactMapUsed:boolean;method:string;firstPublication:string;
    companies:Array<{name:string;ticker:string;checkpoints:number;facts:number;first:string;last:string}>;
  };
  curve:Array<{date:string;strategy:number;benchmark:number;cashBenchmark:number}>;
  trades:Array<{date:string;name:string;side:string;price:number;value:number;reason:string}>;
  limitations:string[];
};
type BacktestInsufficient = {
  status:"insufficient_point_in_time_history";mode:"strict";generatedAt:string;message:string;
  dataAudit:{pointInTimeStart:string;availableTradingDays:number;requiredTradingDays:number;firstFactVerifiedAt:string;firstModelSnapshotAt:string};
  limitations:string[];
};
type BacktestResult=BacktestComplete|BacktestInsufficient;


const money = new Intl.NumberFormat("zh-CN", {style:"currency",currency:"CNY",maximumFractionDigits:0});
const number = new Intl.NumberFormat("zh-CN", {maximumFractionDigits:2});
function BacktestChart({ result }: { result:BacktestComplete }) {
  const points=result.curve;
  if(points.length<2) return <p className="paperEmpty">回测曲线数据不足。</p>;
  const values=points.flatMap(point=>[point.strategy,point.cashBenchmark]);
  const min=Math.min(...values),max=Math.max(...values),range=Math.max(1,max-min);
  const path=(key:"strategy"|"cashBenchmark")=>points.map((point,index)=>{
    const x=24+index/(points.length-1)*752;
    const y=18+(max-point[key])/range*184;
    return `${index?"L":"M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return <div className="backtestChart">
    <div><span><i className="strategyLine" />v2.2策略</span><span><i className="benchmarkLine" />50%候选池＋50%现金</span></div>
    <svg viewBox="0 0 800 230" role="img" aria-label="回测策略与等权候选池收益曲线">
      {[0,1,2,3,4].map(index=><line key={index} x1="24" x2="776" y1={18+index*46} y2={18+index*46} />)}
      <path className="benchmarkPath" d={path("cashBenchmark")} /><path className="strategyPath" d={path("strategy")} />
      <text x="24" y="222">{result.period.start}</text><text x="776" y="222" textAnchor="end">{result.period.end}</text>
    </svg>
  </div>;
}


export function StrategyBacktestWorkspace() {
  const [backtest,setBacktest]=useState<BacktestResult|null>(null);
  const [backtestDays,setBacktestDays]=useState(300);
  const [backtestMode,setBacktestMode]=useState<"strict"|"reconstructed">("strict");
  const [backtestRebalance,setBacktestRebalance]=useState(20);
  const [backtestEntryRule,setBacktestEntryRule]=useState<"strict"|"balanced">("strict");
  const [backtestShorts,setBacktestShorts]=useState(false);
  const [backtestRunning,setBacktestRunning]=useState(false);
  const [backtestError,setBacktestError]=useState("");
  const [comparisonRunning,setComparisonRunning]=useState(false);
  const [backtestComparisons,setBacktestComparisons]=useState<Array<BacktestComplete&{variantLabel:string}>>([]);

  async function runHistoricalTest() {
    setBacktestRunning(true);setBacktestError("");
    try {
      const response=await fetch(`/api/paper?action=backtest&days=${backtestDays}&mode=${backtestMode}&rebalanceDays=${backtestRebalance}&entryRule=${backtestEntryRule}&shorts=${backtestShorts?1:0}`);
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error??"回测失败");
      setBacktest(payload);
    } catch(error) { setBacktestError(error instanceof Error?error.message:"回测失败"); }
    finally { setBacktestRunning(false); }
  }

  async function runParameterComparison() {
    setComparisonRunning(true);setBacktestError("");setBacktestComparisons([]);
    try {
      const variants=[
        {variantLabel:"20日·严格入场",rebalanceDays:20,entryRule:"strict"},
        {variantLabel:"10日·严格入场",rebalanceDays:10,entryRule:"strict"},
        {variantLabel:"5日·严格入场",rebalanceDays:5,entryRule:"strict"},
        {variantLabel:"10日·平衡入场",rebalanceDays:10,entryRule:"balanced"},
      ];
      const results=await Promise.all(variants.map(async variant=>{
        const response=await fetch(`/api/paper?action=backtest&days=${backtestDays}&mode=reconstructed&rebalanceDays=${variant.rebalanceDays}&entryRule=${variant.entryRule}&shorts=${backtestShorts?1:0}`);
        const payload=await response.json();
        if(!response.ok||payload.status!=="complete") throw new Error(payload.error??payload.message??"参数对照失败");
        return {...payload,variantLabel:variant.variantLabel} as BacktestComplete&{variantLabel:string};
      }));
      setBacktestComparisons(results);
    } catch(error) { setBacktestError(error instanceof Error?error.message:"参数对照失败"); }
    finally { setComparisonRunning(false); }
  }


return <div className="paperDashboard">
    <section className="backtestPanel">
      <header>
        <div><p className="eyebrow">POINT-IN-TIME TEST</p><h3>策略参数对照</h3><p>探索调仓频率与入场门槛的影响。事后重建使用四家公司；严格模式使用可用公司池。历史估值与预期差尚未计分。</p></div>
        <div className="backtestActions"><select value={backtestMode} onChange={event=>{setBacktestMode(event.target.value as "strict"|"reconstructed");setBacktest(null)}} aria-label="回测模式"><option value="strict">严格时点</option><option value="reconstructed">事后重建·非严格</option></select><select value={backtestDays} onChange={event=>setBacktestDays(Number(event.target.value))} aria-label="回测窗口"><option value={180}>180日</option><option value={300}>300日</option><option value={500}>500日</option></select><select value={backtestRebalance} onChange={event=>{setBacktestRebalance(Number(event.target.value));setBacktest(null)}} aria-label="调仓频率"><option value={20}>20日调仓</option><option value={10}>10日调仓</option><option value={5}>5日调仓</option></select><select value={backtestEntryRule} onChange={event=>{setBacktestEntryRule(event.target.value as "strict"|"balanced");setBacktest(null)}} aria-label="入场规则"><option value="strict">严格入场</option><option value="balanced">平衡入场</option></select><label className="shortToggle"><input type="checkbox" checked={backtestShorts} onChange={event=>{setBacktestShorts(event.target.checked);setBacktest(null);setBacktestComparisons([])}}/><span>模拟做空</span></label><button onClick={runHistoricalTest} disabled={backtestRunning}>{backtestRunning?"正在核对时点数据…":"运行单组"}</button><button className="secondaryBacktest" onClick={runParameterComparison} disabled={comparisonRunning}>{comparisonRunning?"正在运行四组…":"四组对照"}</button></div>
      </header>
      {backtestError&&<div className="paperNotice">{backtestError}</div>}
      {backtestComparisons.length>0&&<section className="parameterComparison"><header><div><span>CONTROLLED COMPARISON</span><h4>调仓与入场参数探索</h4></div><small>各组独立读取行情；周期对照使用共享快照</small></header><div>{[...backtestComparisons].sort((a,b)=>b.metrics.cashAdjustedExcessReturn-a.metrics.cashAdjustedExcessReturn).map((result,index)=><article key={result.variantLabel} className={index===0?"bestObserved":""}><span>{index===0?"样本内相对较优":"对照组"}</span><b>{result.variantLabel}</b><strong className={result.metrics.totalReturn>=0?"positive":"negative"}>{result.metrics.totalReturn>=0?"+":""}{(result.metrics.totalReturn*100).toFixed(2)}%</strong><small>参考收益差 {((result.metrics.totalReturn-result.metrics.cashAdjustedBenchmarkReturn)*100).toFixed(2)}个百分点 · 回撤 {(result.metrics.maxDrawdown*100).toFixed(2)}% · {result.metrics.trades}笔</small></article>)}</div><footer>50%候选池＋50%现金是固定参考，并未匹配实际仓位。参数差异不能独立证明亏损原因；样本内表现较好也不代表已通过样本外验证。</footer></section>}
      {!backtest&&!backtestRunning&&!backtestError&&<div className="backtestEmpty"><b>先测策略，再等实盘验证</b><p>回测能提前暴露收益捕获、回撤和换手问题，但不能消除前视偏差。</p></div>}
      {backtest?.status==="insufficient_point_in_time_history"&&<div className="pointInTimeAudit"><strong>严格回测暂不成立</strong><p>{backtest.message}</p><div><article><span>时点数据起点</span><b>{backtest.dataAudit.pointInTimeStart}</b></article><article><span>已有交易日</span><b>{backtest.dataAudit.availableTradingDays}</b></article><article><span>最低要求</span><b>{backtest.dataAudit.requiredTradingDays}</b></article></div><small>首个事实核验：{backtest.dataAudit.firstFactVerifiedAt||"无"} · 首个模型快照：{backtest.dataAudit.firstModelSnapshotAt||"无"}</small>{backtest.limitations.map(item=><p className="auditRule" key={item}>{item}</p>)}</div>}
      {backtest?.status==="complete"&&<>
        <div className="backtestMeta"><span>{backtest.mode==="strict"?"严格时点回测":"事后重建·非严格"}</span><span>{backtest.period.start} 至 {backtest.period.end}</span><span>{backtest.universe.tested} 家固定样本</span><span>{backtest.parameters.rebalanceDays}日再平衡</span><span>{backtest.parameters.entryRuleLabel??"严格入场"}</span><span>{backtest.parameters.enableShorts?"证据空头已启用":"仅多头"}</span><span>每日检查卖出信号</span><span>成本 {backtest.parameters.commissionBps+backtest.parameters.slippageBps}bp/单边</span></div>
        {backtest.parameters.enableShorts&&<div className="shortPolicy"><b>模拟空头边界</b><span>仅当驱动净分 ≤ -1、证据贡献 ≥ 55分、价格低于MA20且60日收益为负时建仓。</span><span>单股最多5%，总空头最多10%，年化借券成本按5%计入。</span><span>当前共触发 {backtest.metrics.shortEntries??0} 次模拟卖空，累计借券成本 {money.format(backtest.metrics.borrowCosts??0)}。</span></div>}
        <div className="factorDataGap"><b>本轮未使用的因子</b><span>历史估值分位</span><span>盈利预期修正</span><span>市场一致预期差</span><p>缺少对应日期的可追溯快照；补齐前不允许使用当前数据回填。</p></div>
        {backtest.reconstructionAudit&&<section className="reconstructionAudit">
          <header><div><span>HISTORICAL EVIDENCE AUDIT</span><h4>历史信息集审计</h4></div><strong>{backtest.reconstructionAudit.currentProbabilitiesUsed?"仍含当前概率":"未使用当前概率"}</strong></header>
          <p>{backtest.reconstructionAudit.method}</p>
          <div>{backtest.reconstructionAudit.companies.map(company=><article key={company.ticker}><b>{company.name}</b><span>{company.ticker}</span><strong>{company.checkpoints} 个披露时点 · {company.facts} 条事实</strong><small>{company.first||"无"} 至 {company.last||"无"}</small></article>)}</div>
          <footer><b>仍未历史化：</b><span>{backtest.reconstructionAudit.staticImpactMapUsed?"公司—驱动影响映射仍是当前静态版本，因此本结果只能称为事后重建，不能称为无前视偏差回测。":"影响映射也已按时点还原。"}</span></footer>
        </section>}
        <div className="backtestMetrics">
          <article><span>策略总收益</span><b className={backtest.metrics.totalReturn>=0?"positive":"negative"}>{backtest.metrics.totalReturn>=0?"+":""}{(backtest.metrics.totalReturn*100).toFixed(2)}%</b><small>年化 {(backtest.metrics.annualizedReturn*100).toFixed(2)}%</small></article>
          <article><span>50%股票＋现金参考</span><b>{backtest.metrics.cashAdjustedBenchmarkReturn>=0?"+":""}{(backtest.metrics.cashAdjustedBenchmarkReturn*100).toFixed(2)}%</b><small>非风险匹配；满仓候选池 {(backtest.metrics.benchmarkReturn*100).toFixed(2)}%</small></article>
          <article><span>最大回撤</span><b className="negative">{(backtest.metrics.maxDrawdown*100).toFixed(2)}%</b><small>年化波动 {(backtest.metrics.annualizedVolatility*100).toFixed(2)}%</small></article>
          <article><span>风险调整</span><b>{backtest.metrics.sharpe.toFixed(2)}</b><small>夏普比率</small></article>
          <article><span>交易质量</span><b>{(backtest.metrics.winRate*100).toFixed(1)}%</b><small>{backtest.metrics.trades} 笔调仓 · 换手 {backtest.metrics.turnover.toFixed(2)}倍</small></article>
        </div>
        <BacktestChart result={backtest} />
        <div className={`backtestVerdict ${backtest.metrics.cashAdjustedExcessReturn>=0?"passes":"fails"}`}><b>{backtest.metrics.cashAdjustedExcessReturn>=0?"样本内高于固定参考":"样本内低于固定参考"}</b><p>与50%候选池＋50%现金的收益差为 {((backtest.metrics.totalReturn-backtest.metrics.cashAdjustedBenchmarkReturn)*100).toFixed(2)} 个百分点。实际仓位不同，不能直接归因于选股、现金或退出规则；仍需更长窗口与样本外验证。</p></div>
        <div className="backtestLower"><section><h4>最近回测交易</h4>{backtest.trades.slice(0,8).map((trade,index)=><article key={`${trade.date}-${trade.name}-${index}`}><span>{trade.date}</span><b>{trade.side} · {trade.name}</b><em>{money.format(trade.value)}</em><small>{trade.reason}</small></article>)}</section><section><h4>必须保留的偏差</h4>{backtest.limitations.map(item=><p key={item}>{item}</p>)}</section></div>
      </>}
    </section>

<details className="ma-panel"><summary>周期与执行机制对照</summary><CycleBacktestPanel onInspect={(result)=>{setBacktest(result as BacktestComplete);setBacktestError("");}} /></details></div>;
}
