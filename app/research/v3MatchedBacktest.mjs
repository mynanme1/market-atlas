import {runMatchedSuite,entryAssessment} from './matchedFilterBacktest.mjs';

// Reuse the frozen engine verbatim. Only presentation keys and diagnostics differ.
export function runV3MatchedSuite(input,v2,v3,inputId){
  const full=runMatchedSuite(input,v2,v3,inputId);
  const key=k=>({'filter-v1':'filter-v2','filter-v2':'filter-v3'}[k]??k);
  const label=k=>({'pure':'纯低频趋势','filter-v1':'趋势＋资料v2过滤','filter-v2':'趋势＋资料v3过滤'}[k]??k);
  full.version='matched-data-v3-20260909';
  for(const r of full.runs){r.label=label(r.key);r.key=key(r.key);}
  for(const c of full.comparisons){
    for(const r of c.rows){r.label=label(r.key);r.key=key(r.key);}
    for(const o of c.opportunities)o.key=key(o.key);
  }
  const dates=[...new Set(input.histories.flatMap(h=>h.bars.map(b=>b.date)))].filter(d=>d>=full.rules.start&&d<=full.rules.end).sort();
  full.dailyAudits=input.histories.map(h=>{
    const rows=dates.map(date=>({date,before:entryAssessment(v2,h.company.ticker,date),after:entryAssessment(v3,h.company.ticker,date)}));
    const changed=rows.filter(r=>Math.abs(r.after.financial.score-r.before.financial.score)>1e-10||r.after.financial.observedWeight!==r.before.financial.observedWeight||r.after.accepted!==r.before.accepted);
    return {ticker:h.company.ticker,name:h.company.name,observations:rows.length,scoreChangedDates:rows.filter(r=>Math.abs(r.after.financial.score-r.before.financial.score)>1e-10).length,eligibilityChangedDates:rows.filter(r=>r.after.accepted!==r.before.accepted).length,changed};
  });
  full.entryAudits=full.runs.filter(r=>r.key==='pure').flatMap(r=>{
    const quantities=new Map();
    return r.trades.flatMap(t=>{
      const q=quantities.get(t.ticker)??0;quantities.set(t.ticker,q+(t.side==='买入'?1:-1)*t.quantity);
      return t.side==='买入'&&q===0?[{scenario:r.scenario,ticker:t.ticker,name:t.name,signalDate:t.signalDate,fillDate:t.date,before:entryAssessment(v2,t.ticker,t.signalDate),after:entryAssessment(v3,t.ticker,t.signalDate)}]:[];
    });
  });
  full.limitations=full.limitations.filter(l=>!l.startsWith('历史估值、宏观周期'));
  full.limitations.push('v3已覆盖对应28个报告期的收入和利润，但并非全部同比、现金流齐全；历史估值与宏观周期仍未计入。','每日资格比较不是每日订单，只有实际价格条件触发的新开仓才调用过滤。','全部为按当时公开日期回溯重建，不是系统当年实时执行记录。');
  return full;
}
