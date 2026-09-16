import {isIsoDate} from './historicalEvidence.mjs';
const age=(a,b)=>(Date.parse(a)-Date.parse(b))/86400000;
export const nextDate=d=>new Date(Date.parse(d)+86400000).toISOString().slice(0,10);
const quarterIndex=e=>{const m=/^FY(\d{4})-Q([1-4])$/.exec(e.period);return m?Number(m[1])*4+Number(m[2]):NaN;};
export function earningsAt(data,asOf,mode='public'){
  if(!isIsoDate(asOf))return {quarters:[],ttmEps:null,reason:'观察日期无效'};
  const quarters=data.earnings.filter(e=>e.publishedOn<asOf&&(mode!=='recorded'||e.recordedOn<asOf)).sort((a,b)=>quarterIndex(a)-quarterIndex(b)).slice(-4);
  if(quarters.length!==4)return {quarters,ttmEps:null,reason:'尚无四个连续财季的可用EPS'};
  if(quarters.some((e,i)=>!Number.isFinite(quarterIndex(e))||(i&&quarterIndex(e)!==quarterIndex(quarters[i-1])+1)))return {quarters,ttmEps:null,reason:'财季不连续，不能直接相加'};
  if(age(asOf,quarters.at(-1).periodEnd)>200)return {quarters,ttmEps:null,reason:'盈利资料已超出200日有效期'};
  if(quarters.some(e=>!Number.isFinite(e.reportedEps)||!Number.isFinite(e.splitDivisor)||e.splitDivisor<=0||e.currency!==data.currency))return {quarters,ttmEps:null,reason:'EPS数值、股本或币种口径异常'};
  const ttmEps=Number(quarters.reduce((s,e)=>s+e.reportedEps/e.splitDivisor,0).toFixed(6));
  return {quarters,ttmEps:ttmEps>0?ttmEps:null,reason:ttmEps>0?null:'近四季EPS非正，不适用PE'};
}
export function nvidiaValuationAt(data,asOf,mode='public'){
  const earnings=earningsAt(data,asOf,mode),valid=isIsoDate(asOf);
  const inScope=valid&&asOf>=data.scope.start&&asOf<=nextDate(data.scope.end);
  const recorded=mode!=='recorded'||data.recordedOn<asOf;
  const visiblePrices=valid&&recorded?data.bars.filter(b=>b.date<asOf).sort((a,b)=>a.date.localeCompare(b.date)):[];
  const price=visiblePrices.at(-1)||null;
  const fresh=price&&age(asOf,price.date)<=7;
  const conditionalPe=inScope&&fresh&&earnings.ttmEps&&Number.isFinite(price.close)&&price.close>0?price.close/earnings.ttmEps:null;
  const points=inScope&&recorded?visiblePrices.flatMap(b=>{
    // Reconstruct before the following calendar day's open, never with today's EPS.
    const researchDate=nextDate(b.date),e=earningsAt(data,researchDate,mode);
    return e.ttmEps?[{date:b.date,researchDate,close:b.close,ttmEps:e.ttmEps,pe:b.close/e.ttmEps}]:[];
  }):[];
  const issues=[];
  if(!valid)issues.push('观察日期无效');else if(!inScope)issues.push('模板仅覆盖2025年；不把档案尾部数值冒充当前估值');
  if(!recorded)issues.push('所选日期之前，本系统尚未录入这批材料');
  if(earnings.reason)issues.push(earnings.reason);
  if(!price)issues.push('观察日之前没有本批已采集价格');else if(!fresh)issues.push('价格距观察日超过7日，停止沿用');
  if(data.priceAudit.adjustmentStatus!=='confirmed')issues.push('Close/Last复权口径待核验，PE仅为条件试算');
  return {...earnings,asOf,inScope,price,conditionalPe,certifiedPe:null,percentile:null,points,issues,
    dividends:valid&&recorded?data.dividends.filter(d=>d.declarationDate<asOf):[],
    interpretation:conditionalPe===null?'当前日期无法试算；下方列出缺口。':'该倍数只回答“若价格口径一致，当前价格约为过去四季每股收益的多少倍”，不等于便宜、买入信号或预期收益。'};
}
