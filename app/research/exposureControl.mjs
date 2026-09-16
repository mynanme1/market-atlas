import {simulate} from './executionBacktest.mjs';
import {entryAssessment,firstEntries,matchedRules} from './matchedFilterBacktest.mjs';
import {validateHistoricalEvidence} from './historicalEvidence.mjs';
const sum=a=>a.reduce((s,x)=>s+x,0);
const mean=a=>a.length?sum(a)/a.length:0;
const sd=a=>a.length<2?0:Math.sqrt(sum(a.map(x=>(x-mean(a))**2))/(a.length-1));
export const exposureRules=Object.freeze({version:'exposure-control-v1-20260909',lookback:20,minScale:0,maxScale:1,cashReturn:0,diagnosticOnly:true});
function aligned(pure,filtered){
  if(pure.length!==filtered.length||pure.some((p,i)=>p.date!==filtered[i].date))throw Error('Reference dates differ');
  if(pure.some((p,i)=>!Number.isFinite(p.value)||p.value<=0||!Number.isFinite(filtered[i].value)||filtered[i].value<=0||!Number.isFinite(p.exposure)||!Number.isFinite(filtered[i].exposure)||p.exposure<0||filtered[i].exposure<0))throw Error('Invalid reference values');
}
export function budgetAt(pure,filtered,asOf){
  aligned(pure,filtered);
  const rows=pure.map((p,i)=>({date:p.date,pure:p.exposure,filtered:filtered[i].exposure})).filter(p=>p.date<=asOf).slice(-exposureRules.lookback);
  const denominator=sum(rows.map(r=>r.pure)),numerator=sum(rows.map(r=>r.filtered));
  return {signalDate:asOf,sourceThrough:rows.at(-1)?.date??null,observations:rows.length,scale:denominator>1e-12?Math.max(0,Math.min(1,numerator/denominator)):1,pureMean:mean(rows.map(r=>r.pure)),filteredMean:mean(rows.map(r=>r.filtered))};
}
export function equalOpeningExposure(pure,filtered){
  aligned(pure,filtered);if(!pure.length)throw Error('Empty curves');
  const curves=[[],[]],nav=[1e6,1e6],peak=[1e6,1e6],drawdown=[0,0],returns=[[],[]],logs=[];
  const first=pure[0].date;
  for(const c of curves)c.push({date:first,value:1e6,openingExposure:0});
  for(let i=1;i<pure.length;i++){
    const prev=[pure[i-1],filtered[i-1]],now=[pure[i],filtered[i]],g=Math.min(prev[0].exposure,prev[1].exposure);
    const scales=prev.map(p=>p.exposure>1e-12?g/p.exposure:0);
    const raw=now.map((p,j)=>p.value/prev[j].value-1),scaled=raw.map((r,j)=>r*scales[j]);
    for(let j=0;j<2;j++){nav[j]*=1+scaled[j];peak[j]=Math.max(peak[j],nav[j]);drawdown[j]=Math.min(drawdown[j],nav[j]/peak[j]-1);returns[j].push(scaled[j]);curves[j].push({date:now[j].date,value:nav[j],openingExposure:g});}
    logs.push({date:now[0].date,sourceDate:prev[0].date,openingExposure:g,pureScale:scales[0],filteredScale:scales[1],pureReturn:scaled[0],filteredReturn:scaled[1]});
  }
  const rows=['同仓位纯趋势（理想化）','同仓位v3过滤（理想化）'].map((label,j)=>({label,finalValue:nav[j],totalReturn:nav[j]/1e6-1,maxDrawdown:drawdown[j],dailyVolatility:sd(returns[j]),averageOpeningExposure:mean(logs.map(r=>r.openingExposure)),curve:curves[j]}));
  return {kind:'diagnostic-not-executable',rows,logs,zeroTargetDates:logs.filter(r=>r.openingExposure<=1e-12).length,observations:logs.length,returnGap:rows[1].totalReturn-rows[0].totalReturn,extraOverlayCostIncluded:false};
}
export function runExposureSuite(input,data,inputId){
  const errors=validateHistoricalEvidence(data);if(errors.length)throw Error(errors.join(';'));
  const dates=[...new Set(input.histories.flatMap(h=>h.bars.map(b=>b.date)))].sort();
  if(input.histories.some(h=>h.bars.filter(b=>b.date<=matchedRules.start).length<125||h.bars.at(-1).date<matchedRules.end))throw Error('Insufficient fixed-window prices');
  const scenarios=[{key:'base',label:'原成本',costMultiplier:1,reviewOffset:0,start:matchedRules.start},{key:'cost2',label:'成本翻倍',costMultiplier:2,reviewOffset:0,start:matchedRules.start},{key:'phase5',label:'复核错开5日',costMultiplier:1,reviewOffset:5,start:matchedRules.start},{key:'restart',label:'7月现金起步',costMultiplier:1,reviewOffset:0,start:matchedRules.restart}];
  const results=scenarios.map(s=>{
    const base={family:'slow',calendar:'local',daily:false,costMultiplier:s.costMultiplier,reviewOffset:s.reviewOffset,researchAt:()=>({known:true,raw:1,score:50,evidence:0,counter:false}),positionCap:(_r,t)=>.12*t.volatilityScale};
    const pure=simulate(input,inputId,{...base,key:'pure',label:'原纯趋势'},s.start,matchedRules.end,dates);
    const filtered=simulate(input,inputId,{...base,key:'filter-v3',label:'v3财报过滤',entryFilter:(c,date)=>entryAssessment(data,c.ticker,date).accepted},s.start,matchedRules.end,dates);
    const budgetLog=[],budgetCache=new Map();
    const budget=simulate(input,inputId,{...base,key:'budget',label:'财报仅控制预算',positionCap:(_r,t,{company,signalDate,executionDate})=>{
      if(!budgetCache.has(signalDate))budgetCache.set(signalDate,budgetAt(pure.curve,filtered.curve,signalDate));
      const b=budgetCache.get(signalDate);budgetLog.push({...b,ticker:company.ticker,executionDate});return .12*t.volatilityScale*b.scale;
    }},s.start,matchedRules.end,dates);
    const differences=budget.curve.map((p,i)=>p.exposure-filtered.curve[i].exposure);
    const runs=[pure,budget,filtered].map(r=>({...r,metrics:{...r.metrics,firstEntries:firstEntries(r).length,dailyVolatility:sd(r.curve.slice(1).map((p,i)=>p.value/r.curve[i].value-1))}}));
    return {scenario:s.key,label:s.label,start:s.start,end:matchedRules.end,runs,budgetLog,budgetExposureGap:{mean:mean(differences),meanAbsolute:mean(differences.map(Math.abs)),maximumAbsolute:Math.max(...differences.map(Math.abs))},diagnostic:equalOpeningExposure(pure.curve,filtered.curve)};
  });
  return {version:exposureRules.version,generatedAt:new Date().toISOString(),inputId,rules:exposureRules,results,limitations:['同股票仓位不等于同波动、同beta或同行业风险。','预算对照使用当时已知v3参考组合的总仓位，属于财报只影响预算，不是完全不含财报的盲对照。','20日期间均值和原调仓频率使预算组实际仓位不完全相同，差距另列。','理想化诊断只拉齐前一日仓位，不生成可成交订单；额外再平衡成本未计入。零公共仓位时双方持现金，不复制原始建仓费用。','诊断差额包含持仓组成、权重、时点及原成本缩放，不能命名为纯选股alpha。','四案例窗口重叠、四家公司事后选定且窗口多次使用，结果不是独立样本外证据。','旧行情复权/分红口径和历史汇率未完善；无模拟或真实下单，不改变默认策略。']};
}
