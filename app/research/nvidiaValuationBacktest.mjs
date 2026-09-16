import {simulate} from './executionBacktest.mjs';
import {entryAssessment} from './matchedFilterBacktest.mjs';
import {earningsAt} from './nvidiaValuation.mjs';
export const valuationTrialRules=Object.freeze({version:'nvda-valuation-trial-v1',mainThreshold:50,sensitivity:[40,60],shortStart:'2025-09-11',longStart:'2025-03-10',end:'2025-12-31',enabled:false});
export function peAtClose(input,data,ticker,date){
  if(ticker!=='NVDA')return null;
  const h=input.histories.find(h=>h.company.ticker===ticker),bar=h?.bars.filter(b=>b.date<=date).at(-1),e=earningsAt(data,date);
  if(!bar||!e.ttmEps||(Date.parse(date)-Date.parse(bar.date))/86400000>7)return null;
  return {pe:bar.close/e.ttmEps,close:bar.close,priceDate:bar.date,ttmEps:e.ttmEps,epsIds:e.quarters.map(q=>q.id),publishedOn:e.quarters.map(q=>q.publishedOn)};
}
export function valuationMultiplier(pe,threshold=50){return pe===null||!Number.isFinite(pe)||pe<=0?1:Math.min(1,threshold/pe);}
export function runNvidiaValuationTrial(input,evidence,valuation,inputId){
  const dates=[...new Set(input.histories.flatMap(h=>h.bars.map(b=>b.date)))].sort();
  const variants=[{key:'baseline',label:'原v3策略'},{key:'gate50',label:'PE≤50才新开仓',kind:'gate',threshold:50},{key:'soft50',label:'PE50软仓位',kind:'soft',threshold:50},{key:'soft40',label:'PE40软仓位（敏感性）',kind:'soft',threshold:40},{key:'soft60',label:'PE60软仓位（敏感性）',kind:'soft',threshold:60}];
  const results=[];
  for(const [window,start]of [['captured',valuationTrialRules.shortStart],['archive',valuationTrialRules.longStart]])for(const cost of [1,2]){
    const runs=variants.map(v=>{
      const decisions=[],allocations=[];
      const variant={key:v.key,label:v.label,family:'slow',calendar:'local',daily:false,signalNavOnly:true,costMultiplier:cost,reviewOffset:0,
        researchAt:()=>({known:true,raw:1,score:50,evidence:0,counter:false}),
        entryFilter:(c,signalDate,date)=>{
          const a=entryAssessment(evidence,c.ticker,signalDate),p=peAtClose(input,valuation,c.ticker,signalDate);
          const rejected=v.kind==='gate'&&c.ticker==='NVDA'&&p&&p.pe>v.threshold;
          const accepted=a.accepted&&!rejected;
          decisions.push({ticker:c.ticker,signalDate,executionDate:date,accepted,financialAccepted:a.accepted,valuationRejected:!!rejected,pe:p,reason:!a.accepted?a.reason:rejected?'条件PE超过50，暂停新开仓':p?'财报及本组规则通过':'未增加估值限制',financialFactIds:a.financial.factIds});return accepted;
        },
        positionCap:(_r,t,c)=>{
          const p=peAtClose(input,valuation,c.company.ticker,c.signalDate),multiplier=v.kind==='soft'?valuationMultiplier(p?.pe??null,v.threshold):1;
          const base=.12*t.volatilityScale;
          if(c.company.ticker==='NVDA')allocations.push({signalDate:c.signalDate,executionDate:c.executionDate,baseCap:base,targetCap:base*multiplier,multiplier,pe:p});
          return base*multiplier;
        }};
      const run=simulate(input,inputId,variant,start,valuationTrialRules.end,dates);
      const contributions=input.histories.map(h=>{
        let cash=0,q=0;for(const t of run.trades.filter(t=>t.ticker===h.company.ticker)){const sign=t.side==='买入'?1:-1;cash-=sign*t.value+t.fee;q+=sign*t.quantity;}
        return {ticker:h.company.ticker,pnl:cash+q*h.bars.filter(b=>b.date<=valuationTrialRules.end).at(-1).close*h.fxScale};
      });
      return {...run,decisions,allocations,contributions,valuationRejections:decisions.filter(d=>d.financialAccepted&&d.valuationRejected).length,missingPe:decisions.filter(d=>d.ticker==='NVDA'&&!d.pe).length};
    });
    results.push({window,start,end:valuationTrialRules.end,costMultiplier:cost,runs});
  }
  return {version:valuationTrialRules.version,generatedAt:new Date().toISOString(),inputId,rules:valuationTrialRules,results,limitations:['仅NVDA加入估值，其他三家公司仍按原规则；不代表全市场估值策略。','PE只用于新开仓过滤或目标仓位，沿用原卖出机制；高PE不强制卖空。','78日新数据只核对了NVDA，趋势预热及其余公司仍用旧档案。','固定汇率、分红和复权定义等旧引擎缺口仍存在；这是条件回测。','短区间和长区间重叠，四家公司事后选定，均不构成样本外。','收益含期末浮盈亏；更低回撤可能仅由更低仓位造成。','不得据此挑选收益最高阈值或自动启用交易。']};
}
