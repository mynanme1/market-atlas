import {simulate,technicalAt,familyTechnical} from './executionBacktest.mjs';
import {entryAssessment,matchedRules,firstEntries} from './matchedFilterBacktest.mjs';
import {financialScoreAt} from './historicalFactorBacktest.mjs';
import {validateHistoricalEvidence} from './historicalEvidence.mjs';
const sum=a=>a.reduce((s,v)=>s+v,0),mean=a=>a.length?sum(a)/a.length:0;
const covariance=(a,b)=>a.length>1?sum(a.map((v,i)=>(v-mean(a))*(b[i]-mean(b))))/(a.length-1):0;
export const improvementRules=Object.freeze({version:'strategy-improvement-v1-20260910',correlation:.7,clusterCap:.18,targetVolatility:.06,observations:60,trailingDrawdown:.12,cooldownBars:10,maxMA60Ratio:1.15,financialExit:40,minObservedWeight:.6,returnRetention:.8,drawdownRetention:.8,requiredCases:3});
export function riskPlanAt(input,date){
  const histories=input.histories,priceMaps=histories.map(h=>new Map(h.bars.filter(b=>b.date<=date).map(b=>[b.date,b.close])));
  const dates=[...priceMaps[0].keys()].filter(d=>priceMaps.every(m=>m.has(d))).sort().slice(-61);
  const weights=histories.map(h=>.12*(technicalAt(h.bars,date)?.volatilityScale??.5));
  const tickers=histories.map(h=>h.company.ticker);
  if(dates.length<61)return {asOf:date,tickers,sourceThrough:dates.at(-1)??null,observations:Math.max(0,dates.length-1),caps:Object.fromEntries(tickers.map((t,i)=>[t,weights[i]*.5])),clusters:[],covariance:[],estimatedVolatility:null,riskScale:.5,reason:'共同样本不足，基础仓位减半'};
  const returns=priceMaps.map(m=>dates.slice(1).map((d,i)=>m.get(d)/m.get(dates[i])-1));
  const cov=returns.map(a=>returns.map(b=>covariance(a,b)));
  const parents=tickers.map((_,i)=>i),find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));
  for(let i=0;i<tickers.length;i++)for(let j=i+1;j<tickers.length;j++){const den=Math.sqrt(cov[i][i]*cov[j][j]);if(den>0&&cov[i][j]/den>=improvementRules.correlation)parents[find(j)]=find(i);}
  const groups=new Map();tickers.forEach((_,i)=>{const g=find(i);groups.set(g,[...(groups.get(g)??[]),i]);});
  const clusters=[...groups.values()].map(indices=>{const total=sum(indices.map(i=>weights[i])),scale=Math.min(1,improvementRules.clusterCap/Math.max(total,1e-12));indices.forEach(i=>weights[i]*=scale);return {tickers:indices.map(i=>tickers[i]),scale};});
  const volatility=Math.sqrt(Math.max(0,sum(weights.map((w,i)=>sum(weights.map((v,j)=>w*v*cov[i][j])))))*252);
  const scale=volatility>0?Math.min(1,improvementRules.targetVolatility/volatility):1;
  return {asOf:date,tickers,sourceThrough:dates.at(-1),observations:60,caps:Object.fromEntries(tickers.map((t,i)=>[t,weights[i]*scale])),clusters,covariance:cov,estimatedVolatility:volatility,riskScale:scale,reason:'相关组限额后按目标篮子估计波动缩小'};
}
export function exitDecision(position,technical,family,financial){
  if(financial.known&&(financial.reason==='最新报告净利润非正'||financial.observedWeight>=improvementRules.minObservedWeight&&financial.score<improvementRules.financialExit))return {action:'exit',reason:'财报失效：净利润非正或充分观测下评分低于40',factIds:financial.factIds};
  if(technical&&technical.close/position.peakClose-1<=-improvementRules.trailingDrawdown)return {action:'exit',reason:'持仓收盘高点回撤达到12%（次日成交非保证价）',factIds:[]};
  if(family?.below60Five)return {action:'exit',reason:'连续5个交易日低于MA60，不再等待120日收益转负',factIds:[]};
  return null;
}
export function entryGuard(assessment,family,context,{exits=false,entry=false}={}){
  if(!assessment.accepted)return assessment.reason;
  if(exits&&context?.lastExit&&context.barIndex-context.lastExit.barIndex<improvementRules.cooldownBars)return '退出后10个自身交易日冷静期';
  if(entry&&family&&family.close/family.ma60>improvementRules.maxMA60Ratio)return '价格高于MA60的115%，等待而不追涨（不是估值判断）';
  return null;
}
function extraMetrics(run,input){
  const changes=run.curve.slice(1).map((p,i)=>p.value/run.curve[i].value-1);
  return {...run.metrics,firstEntries:firstEntries(run).length,dailyVolatility:Math.sqrt(Math.max(0,covariance(changes,changes))),winningClosed:run.roundTrips.filter(r=>r.pnl>0).length,losingClosed:run.roundTrips.filter(r=>r.pnl<=0).length,closedPnl:sum(run.roundTrips.map(r=>r.pnl)),contributions:input.histories.map(h=>{let cash=0,q=0;for(const t of run.trades.filter(t=>t.ticker===h.company.ticker)){const s=t.side==='买入'?1:-1;cash-=s*t.value+t.fee;q+=s*t.quantity;}return {ticker:h.company.ticker,name:h.company.name,pnl:cash+q*h.bars.filter(b=>b.date<=run.period.end).at(-1).close*h.fxScale};})};
}
export function runImprovementSuite(input,data,inputId){
  const errors=validateHistoricalEvidence(data);if(errors.length)throw Error(errors.join(';'));
  const dates=[...new Set(input.histories.flatMap(h=>h.bars.map(b=>b.date)))].sort();
  if(input.histories.some(h=>h.bars.filter(b=>b.date<=matchedRules.start).length<125||h.bars.at(-1).date<matchedRules.end))throw Error('Fixed window lacks prices');
  const scoreCache=new Map(),riskCache=new Map(),familyCache=new Map();
  const financial=(ticker,date)=>{const k=ticker+'|'+date;if(!scoreCache.has(k))scoreCache.set(k,financialScoreAt(data,ticker,date));return scoreCache.get(k);};
  const family=(ticker,date)=>{const k=ticker+'|'+date;if(!familyCache.has(k))familyCache.set(k,familyTechnical(input.histories.find(h=>h.company.ticker===ticker).bars,date));return familyCache.get(k);};
  const risk=date=>{if(!riskCache.has(date))riskCache.set(date,riskPlanAt(input,date));return riskCache.get(date);};
  const scenarios=[{key:'base',label:'原成本',costMultiplier:1,reviewOffset:0,start:matchedRules.start},{key:'cost2',label:'成本翻倍',costMultiplier:2,reviewOffset:0,start:matchedRules.start},{key:'phase5',label:'复核错开5日',costMultiplier:1,reviewOffset:5,start:matchedRules.start},{key:'restart',label:'7月现金重启',costMultiplier:1,reviewOffset:0,start:matchedRules.restart}];
  const variants=[{key:'baseline',label:'原v3过滤'},{key:'risk',label:'仅组合风险',risk:true},{key:'exits',label:'仅退出改进',exits:true},{key:'entry',label:'仅防追涨',entry:true},{key:'combined',label:'三项组合',risk:true,exits:true,entry:true}];
  const results=scenarios.map(s=>{
    const runs=variants.map(v=>{
      const decisions=[],exits=[],riskDates=new Set();
      const variant={key:v.key,label:v.label,family:'slow',calendar:'local',daily:false,costMultiplier:s.costMultiplier,reviewOffset:s.reviewOffset,signalNavOnly:v.key!=='baseline',researchAt:()=>({known:true,raw:1,score:50,evidence:0,counter:false}),positionCap:(_r,t,context)=>{if(!v.risk)return .12*t.volatilityScale;riskDates.add(context.signalDate);return risk(context.signalDate).caps[context.company.ticker];},entryFilter:(c,signalDate,date,context)=>{
        const assessment=entryAssessment(data,c.ticker,signalDate),reason=entryGuard(assessment,family(c.ticker,signalDate),context,v);decisions.push({ticker:c.ticker,name:c.name,signalDate,date,accepted:!reason,reason:reason??'财报与本组入场条件通过',score:assessment.financial.score,factIds:assessment.financial.factIds});return !reason;
      }};
      if(v.exits)variant.positionAction=(p,t,_r,c)=>{const action=exitDecision(p,t,family(c.company.ticker,c.signalDate),financial(c.company.ticker,c.signalDate));if(action)exits.push({ticker:c.company.ticker,name:c.company.name,signalDate:c.signalDate,date:c.executionDate,...action});return action;};
      const run=simulate(input,inputId,variant,s.start,matchedRules.end,dates);
      const segments=[{label:'前半段（非样本外）',start:s.start,end:'2025-06-30'},{label:'后半段（连续持仓，非样本外）',start:'2025-07-01',end:matchedRules.end}].filter(p=>p.start<=p.end).map(p=>{const rows=run.curve.filter(c=>c.date>=p.start&&c.date<=p.end),previous=run.curve.filter(c=>c.date<p.start).at(-1)?.value??1e6;let peak=previous,dd=0;for(const r of rows){peak=Math.max(peak,r.value);dd=Math.min(dd,r.value/peak-1);}return {label:p.label,start:rows[0]?.date??p.start,end:rows.at(-1)?.date??p.end,totalReturn:rows.length?rows.at(-1).value/previous-1:0,maxDrawdown:dd};});
      return {...run,metrics:extraMetrics(run,input),decisions,exitSignals:exits,riskPlans:[...riskDates].sort().map(risk),segments};
    });
    const base=runs[0];
    return {scenario:s.key,label:s.label,start:s.start,end:matchedRules.end,runs,screen:runs.slice(1).map(r=>({key:r.key,applicable:base.metrics.totalReturn>0,returnRetained:base.metrics.totalReturn>0?r.metrics.totalReturn/base.metrics.totalReturn:null,drawdownRetained:base.metrics.maxDrawdown<0?r.metrics.maxDrawdown/base.metrics.maxDrawdown:null,passed:base.metrics.totalReturn>0&&r.metrics.totalReturn>=base.metrics.totalReturn*.8&&Math.abs(r.metrics.maxDrawdown)<=Math.abs(base.metrics.maxDrawdown)*.8}))};
  });
  return {version:improvementRules.version,generatedAt:new Date().toISOString(),inputId,rules:improvementRules,results,promotion:variants.slice(1).map(v=>({key:v.key,label:v.label,passedCases:results.filter(r=>r.screen.find(x=>x.key===v.key).passed).length,required:3,enabled:false,reason:'探索门槛不等于可投资；行情口径与独立验证尚未通过'})),limitations:['历史估值、预期差和完整经济周期未纳入；防追涨不是估值替代。','四家公司事后选择、2025窗口反复研究；20组和时间分段都不构成独立样本外。','相关性与协方差采用共同日期收益，252近似有跨市场间隔误差；目标篮子不是实际组合风险保证。','12%高点回撤是收盘退出信号，不是保证成交或最大亏损；次日可能跳空。','固定汇率、价格复权/分红/税费/停牌与涨跌停口径仍不完整。','只改离线实验；默认策略、模拟账户和旧报告未更新。']};
}
