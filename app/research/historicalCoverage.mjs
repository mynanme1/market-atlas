import {selectHistoricalEvidence} from './historicalEvidence.mjs';

export function historicalCoverageAt(data,asOf,mode='public'){
  const current=selectHistoricalEvidence(data,{asOf,mode}).currentFacts;
  const names=['2024Q1','2024Q2','2024Q3','2024Q4','2025Q1','2025Q2','2025Q3'];
  const companies=data.companies.map(company=>{
    const periods=company.ticker==='NVDA'?['FY2025-Q1','FY2025-Q2','FY2025-Q3','FY2025-Q4','FY2026-Q1','FY2026-Q2','FY2026-Q3']:company.ticker==='TSM'?['2024-Q1','2024-Q2','2024-Q3','2024-Q4','2025-Q1','2025-Q2','2025-Q3']:['2024-Q1','2024-H1','2024-9M','2024-FY','2025-Q1','2025-H1','2025-9M'];
    const profitMetric=['NVDA','TSM'].includes(company.ticker)?'net_income':'parent_net_income';
    const cells=periods.map((period,i)=>{
      const get=metric=>current.find(f=>f.ticker===company.ticker&&f.period===period&&f.metric===metric);
      const revenue=get('revenue'),profit=get(profitMetric),cash=get('operating_cash_flow');
      const prior=period.replace(/\d{4}/,x=>String(Number(x)-1));
      const priorFacts=current.filter(f=>f.ticker===company.ticker&&f.period===prior&&f.unit===revenue?.unit);
      return {column:names[i],period,ready:Boolean(revenue&&profit&&revenue.unit===profit.unit),cashReady:Boolean(cash),comparableReady:priorFacts.some(f=>f.metric==='revenue')&&priorFacts.some(f=>f.metric===profitMetric),publishedOn:[revenue?.publishedOn,profit?.publishedOn].filter(Boolean).sort().at(-1)??null,sourceUrl:revenue?.sourceUrl??null};
    });
    return {...company,cells,ready:cells.filter(c=>c.ready).length};
  });
  return {asOf,columns:names,companies,ready:companies.reduce((s,c)=>s+c.ready,0),expected:companies.length*7};
}
