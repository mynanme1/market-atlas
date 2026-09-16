import {financialScoreAt,historicalFactorRules} from './historicalFactorBacktest.mjs';
import {validateHistoricalEvidence} from './historicalEvidence.mjs';
import {simulate,executionRules} from './executionBacktest.mjs';

export const matchedRules=Object.freeze({version:'matched-entry-filter-v1-20260909',start:'2025-03-10',end:'2025-12-31',restart:'2025-07-01',entryScore:50,stockTarget:.12});
export function entryAssessment(dataset,ticker,date){
  const financial=financialScoreAt(dataset,ticker,date);
  const accepted=financial.known&&!financial.counter&&financial.score>=matchedRules.entryScore;
  return {accepted,financial,reason:!financial.known?'本档案无可用财报':financial.stale?'资料过期':financial.counter?financial.reason:financial.score<50?'评分低于50，不新开仓':'达到入场过滤门槛；不据此提高仓位'};
}

// Attribution of the scoring arithmetic, NOT causal attribution of business performance.
export function scoreChange(before,after,mode='temporal'){
  const rows=Object.entries(historicalFactorRules.weights).map(([key,weight])=>{
    const a=before.components.find(c=>c.key===key)??{score:50,observed:false,factIds:[],value:null};
    const b=after.components.find(c=>c.key===key)??{score:50,observed:false,factIds:[],value:null};
    const cause=mode==='dataset'?'资料版本变化':a.observed&&b.observed?'可比指标变化（含可能的口径调整）':a.observed!==b.observed?'资料可用性变化':'均缺失，未形成经营判断';
    return {key,label:b.label??a.label??key,weight,before:a,after:b,delta:(b.score-a.score)*weight,cause};
  });
  return {beforeScore:before.score,afterScore:after.score,delta:after.score-before.score,rows,
    availabilityDelta:rows.filter(r=>r.cause==='资料可用性变化').reduce((s,r)=>s+r.delta,0),
    comparableDelta:rows.filter(r=>r.cause.startsWith('可比')).reduce((s,r)=>s+r.delta,0)};
}

export function firstEntries(run){
  const quantities=new Map(),entries=[];
  for(const t of run.trades){const q=quantities.get(t.ticker)??0;if(t.side==='买入'&&q===0)entries.push(t);quantities.set(t.ticker,q+(t.side==='买入'?1:-1)*t.quantity);}
  return entries;
}

export function shadowOpportunities(input,pure,dataset,costMultiplier=1){
  return firstEntries(pure).flatMap(t=>{
    const assessment=entryAssessment(dataset,t.ticker,t.signalDate);if(assessment.accepted)return [];
    const h=input.histories.find(h=>h.company.ticker===t.ticker);
    const exit=pure.roundTrips.find(r=>r.ticker===t.ticker&&r.entry===t.date)?.exit;
    const markDate=exit??pure.period.end;
    const mark=h.bars.filter(b=>b.date<=markDate).at(-1);
    const markPrice=mark.close*h.fxScale*(exit?1-executionRules.slippage*costMultiplier:1);
    const proceeds=t.quantity*markPrice*(exit?1-executionRules.commission*costMultiplier:1);
    const cost=t.value+t.fee,pnl=proceeds-cost;
    return [{ticker:t.ticker,name:t.name,signalDate:t.signalDate,entryDate:t.date,quantity:t.quantity,entryCost:cost,markDate:mark.date,closed:Boolean(exit),pnl,return:pnl/cost,assessment,
      interpretation:pnl>=0?'过滤可能错过的上涨参考':'过滤可能避开的亏损参考'}];
  });
}

export function runMatchedSuite(input,oldData,newData,inputId){
  for(const data of [oldData,newData]){const errors=validateHistoricalEvidence(data);if(errors.length)throw Error(errors.join('; '));}
  const dates=[...new Set(input.histories.flatMap(h=>h.bars.map(b=>b.date)))].sort();
  if(input.histories.some(h=>h.bars.filter(b=>b.date<=matchedRules.start).length<125||h.bars.at(-1).date<matchedRules.end))throw Error('固定区间行情或预热不足');
  const scenarios=[{key:'base',label:'原成本',costMultiplier:1,reviewOffset:0,start:matchedRules.start},{key:'cost2',label:'成本翻倍',costMultiplier:2,reviewOffset:0,start:matchedRules.start},{key:'phase5',label:'复核错开5日',costMultiplier:1,reviewOffset:5,start:matchedRules.start},{key:'restart',label:'7月现金起步',costMultiplier:1,reviewOffset:0,start:matchedRules.restart}];
  const runs=[];
  for(const scenario of scenarios){
    for(const [key,label,dataset] of [['pure','纯低频趋势',null],['filter-v1','趋势＋补齐前财报过滤',oldData],['filter-v2','趋势＋补齐后财报过滤',newData]]){
      const decisions=[];
      const variant={key,label,family:'slow',calendar:'local',daily:false,costMultiplier:scenario.costMultiplier,reviewOffset:scenario.reviewOffset,
        researchAt:()=>({known:true,raw:1,score:50,evidence:0,counter:false}),positionCap:(_r,t)=>matchedRules.stockTarget*t.volatilityScale,
        entryFilter:(company,signalDate,date)=>{const a=dataset?entryAssessment(dataset,company.ticker,signalDate):{accepted:true,reason:'仅价格条件',financial:null};decisions.push({ticker:company.ticker,name:company.name,signalDate,date,...a});return a.accepted;}};
      const result=simulate(input,inputId,variant,scenario.start,matchedRules.end,dates);
      runs.push({...result,scenario:scenario.key,scenarioLabel:scenario.label,decisions,rejected:decisions.filter(d=>!d.accepted).length,firstEntries:firstEntries(result).length});
    }
  }
  const comparisons=scenarios.map(s=>{
    const group=runs.filter(r=>r.scenario===s.key),pure=group.find(r=>r.key==='pure');
    return {scenario:s.key,label:s.label,start:s.start,end:matchedRules.end,rows:group.map(r=>({key:r.key,label:r.label,...r.metrics,firstEntries:r.firstEntries,rejected:r.rejected,excessReturn:r.metrics.totalReturn-pure.metrics.totalReturn})),
      opportunities:[['filter-v1',oldData],['filter-v2',newData]].map(([key,data])=>({key,items:shadowOpportunities(input,pure,data,s.costMultiplier)}))};
  });
  const audits=input.histories.map(h=>{
    const ticker=h.company.ticker,date=matchedRules.end;
    const old=financialScoreAt(oldData,ticker,date),now=financialScoreAt(newData,ticker,date);
    const previous=financialScoreAt(newData,ticker,'2025-09-30');
    return {ticker,name:h.company.name,date,old,current:now,previous,versionChange:scoreChange(old,now,'dataset'),temporalChange:scoreChange(previous,now),oldTemporalChange:scoreChange(financialScoreAt(oldData,ticker,'2025-09-30'),old),previousDate:'2025-09-30'};
  });
  return {version:matchedRules.version,inputId,generatedAt:new Date().toISOString(),rules:matchedRules,runs,comparisons,audits,
    evidence:{oldId:oldData.id,newId:newData.id,documents:newData.documents.length,versions:newData.documents.reduce((n,d)=>n+d.facts.length,0)},
    limitations:['只检验财报新开仓过滤，不代表所有基本面选股或财报卖出机制。','仓位规则相同，但过滤会使实际仓位不同；没有人为事后补足风险暴露。','评分缺失项的50分仍是占位值，不是已证实中性；本轮未优化该规则。','四家公司为事后选定、窗口曾被分析，不是独立样本外检验。','沿用固定汇率和旧行情口径，未完整还原分红、税费、停牌和涨跌停；收益包含期末浮盈亏。','影子机会按纯趋势首次建仓固定股数计价，事后观察，不可加总为组合归因或反过来选股。','历史估值、宏观周期和连续季度仍未补全；无模拟或真实下单。']};
}
