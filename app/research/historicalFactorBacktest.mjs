import {selectHistoricalEvidence, validateHistoricalEvidence} from "./historicalEvidence.mjs";
import {simulate} from "./executionBacktest.mjs";

export const historicalFactorRules = Object.freeze({
  version:"historical-factors-v1-20260909", frozenOn:"2026-09-09",
  notBefore:"2025-03-10", end:"2025-12-31", restart:"2025-07-01",
  weights:{revenueGrowth:.3, profitGrowth:.3, marginChange:.2, cashSign:.2},
  missingScore:50, entryScore:50, fullScore:65, exitScore:40,
  trialWeight:.03, fullWeight:.12, quarterlyMaxAge:150, cumulativeMaxAge:240,
});
const clip = n => Math.max(0, Math.min(100, n));
const days = (a,b) => (Date.parse(a)-Date.parse(b))/86400000;
const total = values => values.reduce((a,b)=>a+b,0);

export function financialScoreAt(dataset, ticker, date) {
  const {currentFacts} = selectHistoricalEvidence(dataset,{asOf:date,ticker});
  const revenues = currentFacts.filter(f=>f.metric==="revenue").sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd));
  const revenue = revenues[0];
  const empty = {known:false,raw:0,score:50,evidence:0,counter:false,stale:false,observedWeight:0,components:[],factIds:[],reason:"尚无可用收入与利润记录"};
  if(!revenue)return empty;
  const profitMetric = ["NVDA","TSM"].includes(ticker)?"net_income":"parent_net_income";
  const get = (metric,period) => currentFacts.find(f=>f.metric===metric&&f.period===period&&f.unit===revenue.unit);
  const profit = get(profitMetric,revenue.period);
  if(!profit || revenue.value<=0)return empty;
  const priorPeriod = revenue.period.replace(/\d{4}/, year=>String(Number(year)-1));
  const priorRevenue=get("revenue",priorPeriod), priorProfit=get(profitMetric,priorPeriod), cash=get("operating_cash_flow",revenue.period);
  const growth = (now,prior) => prior?.value>0?(now.value-prior.value)/prior.value:null;
  const revenueGrowth=growth(revenue,priorRevenue), profitGrowth=growth(profit,priorProfit);
  const marginChange=priorRevenue?.value>0&&priorProfit?profit.value/revenue.value-priorProfit.value/priorRevenue.value:null;
  const component=(key,label,value,score,facts)=>({key,label,value,score:value===null?50:clip(score),weight:historicalFactorRules.weights[key],observed:value!==null,factIds:facts.filter(Boolean).map(f=>f.id)});
  const components=[
    component("revenueGrowth","收入同比",revenueGrowth,50+100*revenueGrowth,[revenue,priorRevenue]),
    component("profitGrowth","净利润同比",profitGrowth,50+100*profitGrowth,[profit,priorProfit]),
    component("marginChange","净利率同比变化",marginChange,50+1000*marginChange,[revenue,profit,priorRevenue,priorProfit]),
    component("cashSign","经营现金流方向",cash?.value??null,cash?cash.value>0?75:cash.value<0?0:50:50,[cash]),
  ];
  const score=total(components.map(c=>c.score*c.weight));
  const anchorPublishedOn=[revenue.publishedOn,profit.publishedOn].sort()[0];
  const maxAge=/-Q\d$/.test(revenue.period)?historicalFactorRules.quarterlyMaxAge:historicalFactorRules.cumulativeMaxAge;
  const ageDays=days(date,anchorPublishedOn),stale=ageDays>maxAge;
  const counter=stale||profit.value<=0||score<historicalFactorRules.exitScore;
  return {known:true,score,raw:score>=historicalFactorRules.entryScore?1:score<historicalFactorRules.exitScore?-1:.5,
    // Kept solely for the legacy engine's shape; the new sizing callback ignores it.
    evidence:0,counter,stale,period:revenue.period,anchorPublishedOn,ageDays,maxAge,
    observedWeight:total(components.filter(c=>c.observed).map(c=>c.weight)),components,
    factIds:[...new Set([revenue.id,profit.id,...components.flatMap(c=>c.factIds)])],
    reason:stale?"财报资料过期":profit.value<=0?"最新报告净利润非正":score<40?"财报评分低于40":score>=65?"经营指标达到常规仓位门槛":score>=50?"中性或偏正评分，只允许试探仓位":"评分偏弱，不新建仓"};
}

export function runHistoricalFactorSuite(input, dataset, inputId) {
  const errors=validateHistoricalEvidence(dataset);if(errors.length)throw new Error(errors.join("; "));
  const dates=[...new Set(input.histories.flatMap(h=>h.bars.map(b=>b.date)))].sort();
  const start=dates.find(d=>d>=historicalFactorRules.notBefore&&input.histories.every(h=>h.bars.filter(b=>b.date<=d).length>=125));
  const end=historicalFactorRules.end;
  if(!start||start>=end||input.histories.some(h=>h.bars.at(-1).date<end))throw new Error("行情不足，不能执行固定区间");
  const cache=new Map();
  const scoreAt=(company,date)=>{const key=`${company.ticker}|${date}`;if(!cache.has(key))cache.set(key,financialScoreAt(dataset,company.ticker,date));return cache.get(key);};
  const cap=(r,t)=>(r.score>=historicalFactorRules.fullScore?.12:.03)*t.volatilityScale;
  const pure=()=>({known:true,raw:1,score:50,evidence:0,counter:false});
  const variants=[
    {key:"legacy",label:"旧论点＋趋势（旧资料）",family:"slow",daily:false},
    {key:"financial",label:"财报评分持有",family:"thesis",daily:false,researchAt:scoreAt,positionCap:cap},
    {key:"financial-slow",label:"财报评分＋低频趋势",family:"slow",daily:false,researchAt:scoreAt,positionCap:cap},
    {key:"price-slow",label:"纯低频趋势",family:"slow",daily:false,researchAt:pure,positionCap:(_r,t)=>.12*t.volatilityScale},
    ...[.03,.06,.12].map(w=>({key:`equal-${Math.round(w*400)}`,label:`等权参考（目标${Math.round(w*400)}%）`,family:"equal",daily:false,equalWeight:w,researchAt:pure})),
  ];
  const scenarios=[{key:"base",label:"原成本",costMultiplier:1,reviewOffset:0},{key:"cost2",label:"成本翻倍",costMultiplier:2,reviewOffset:0},{key:"phase5",label:"复核错开5日",costMultiplier:1,reviewOffset:5}];
  const run=(variant,scenario,from=start)=>{
    const result=simulate(input,inputId,{...variant,...scenario,key:variant.key,label:variant.label,calendar:"local"},from,end,dates);
    const financial=["financial","financial-slow"].includes(variant.key);
    for(const trade of result.trades)if(financial){trade.research=scoreAt(input.histories.find(h=>h.company.ticker===trade.ticker).company,trade.signalDate);if(trade.reason==="公司论点失效")trade.reason=trade.research.reason;}
    const contributions=input.histories.map(h=>{
      let cash=0,quantity=0;const trades=result.trades.filter(t=>t.ticker===h.company.ticker);
      for(const t of trades){const sign=t.side==="买入"?1:-1;cash-=sign*t.value+t.fee;quantity+=sign*t.quantity;}
      const pnl=cash+quantity*h.bars.filter(b=>b.date<=end).at(-1).close*h.fxScale;
      return {ticker:h.company.ticker,name:h.company.name,pnl,contribution:pnl/1e6,trades:trades.length};
    });
    const monthly=[];let previous=1e6;
    for(const month of [...new Set(result.curve.map(p=>p.date.slice(0,7)))]){const value=result.curve.filter(p=>p.date.startsWith(month)).at(-1).value;monthly.push({month,return:value/previous-1});previous=value;}
    return {...result,id:`${variant.key}-${scenario.key}-${from}`,scenario:scenario.key,scenarioLabel:scenario.label,contributions,monthly,
      metrics:{...result.metrics,winningClosed:result.roundTrips.filter(t=>t.pnl>0).length,losingClosed:result.roundTrips.filter(t=>t.pnl<0).length}};
  };
  const runs=variants.flatMap(v=>scenarios.map(s=>run(v,s)));
  for(const v of variants.filter(v=>["financial","financial-slow","price-slow"].includes(v.key)))runs.push(run(v,{key:"restart",label:"7月现金起步",costMultiplier:1,reviewOffset:0},historicalFactorRules.restart));
  const scoreDates=[start,...["2025-06-30","2025-09-30",end]];
  const scores=scoreDates.flatMap(date=>input.histories.map(h=>({date,ticker:h.company.ticker,name:h.company.name,...scoreAt(h.company,date)})));
  return {status:"complete",version:historicalFactorRules.version,inputId,generatedAt:new Date().toISOString(),rules:historicalFactorRules,period:{start,end},runs,scores,
    evidence:{datasetId:dataset.id,documents:dataset.documents.length,versions:dataset.documents.reduce((n,d)=>n+d.facts.length,0)},
    limitations:[
      "本轮固定2025年窗口，不能将收益差直接归因于补资料；旧报告是2026年区间，不能直接横比。",
      "旧资料策略在2025年没有可用事实，空仓不是风险控制成功；主要比较同窗口纯趋势和等权参考。",
      "评分缺失项为50分，不代表已证实中性。完整度单独显示，不参与加分或直接放大仓位。",
      "不根据结果调参；24组实验共享历史、窗口重叠，且四公司为事后选定，不构成样本外验证。",
      "财报仅按公开日期回溯重建；不是系统当时真实运行。修订从其公开后可用，不覆盖此前交易。",
      "固定汇率换算、复权/分红口径、税费、涨跌停、停牌与市场冲击尚未完整还原；目标仓位不是跳空成交后的保证上限。",
      "未包含历史估值、盈利预期或完整宏观周期因子，不能称为完整基本面或经济周期策略。",
      "信号后下一可交易收盘价模拟成交，持仓期末按市值计价，收益含浮盈亏；未操作模拟账户。",
    ]};
}

export function summarizeHistoricalSuite(report) {
  return {...report,runs:report.runs.map(({curve,signalLog,...r})=>({...r,curvePoints:curve.length}))};
}
