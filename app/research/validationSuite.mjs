import {simulate,executionRules} from "./executionBacktest.mjs";
import {strategyFamilies} from "./strategySuite.mjs";

export const validationProtocol={
  version:"candidate-validation-v1-20260909",frozenOn:"2026-09-09",
  start:"2026-02-25",end:"2026-09-04",candidates:["thesis","slow","equal"],
  restartDates:["2026-04-01","2026-06-01","2026-07-01"],equalWeights:[.015,.03,.12],
  interpretation:"开发样本压力检查，不是样本外验证；不改变实盘或模拟账户。",
};

export function runValidationSuite(input,inputId){
  const protocol=validationProtocol;
  const dates=[...new Set(input.histories.flatMap(h=>h.bars.map(b=>b.date)))].sort();
  const start=dates.find(d=>d>=protocol.start),end=protocol.end;
  if(!start||start>=end||input.histories.some(h=>h.bars.filter(b=>b.date<=start).length<125||!h.bars.some(b=>b.date===end)))throw new Error("冻结窗口行情或预热数据不足");
  const families=protocol.candidates.map(key=>strategyFamilies.find(s=>s.key===key));
  const runs=[];
  function run(family,category,caseLabel,options={},from=start){
    const r=simulate(input,inputId,{...family,...options,calendar:"local"},from,end,dates);
    const row={...r,id:`${category}-${family.key}-${runs.length}`,category,caseLabel,options};runs.push(row);return row;
  }
  for(const family of families){
    run(family,"base","完整四公司池");
    for(const h of input.histories)run(family,"exclude",`不交易${h.company.name}`,{excludedTickers:[h.company.ticker]});
    for(const date of protocol.restartDates){const from=dates.find(d=>d>=date);run(family,"restart",`${from} 空仓起步`,{},from);}
  }
  const equal=families.find(f=>f.key==="equal");
  for(const weight of protocol.equalWeights.filter(w=>w!==.12))run(equal,"budget",`每股${weight*100}% / 合计${weight*400}%目标`,{equalWeight:weight});
  const warmStart=dates.find(d=>input.histories.every(h=>h.bars.filter(b=>b.date<=d).length>=125));
  for(const weight of protocol.equalWeights)run(equal,"long-price",`长期价格参考 · 每股${weight*100}%`,{equalWeight:weight},warmStart);
  const coverage=input.histories.map(h=>{
    const facts=input.facts.filter(f=>f.companyId===h.company.id&&f.publicationDate).sort((a,b)=>a.publicationDate.localeCompare(b.publicationDate));
    return {name:h.company.name,ticker:h.company.ticker,priceStart:h.bars[0].date,priceEnd:h.bars.at(-1).date,bars:h.bars.length,facts:facts.length,publicationDates:[...new Set(facts.map(f=>f.publicationDate))],firstFact:facts[0]?.publicationDate??null,canResearchAtLongStart:facts.some(f=>f.publicationDate<=warmStart)};
  });
  return {status:"complete",generatedAt:new Date().toISOString(),inputId,protocol:{...protocol,rules:executionRules,families},period:{start,end},longPeriod:{start:warmStart,end},coverage,runs,
    limitations:[
      "不交易单家公司时，保留其事实及原组合日历，只移除交易资格、不重新分配其目标仓位。该检查衡量交易收益集中度，不是删除该公司全部信息的重新选股实验。",
      "6%、12%、48%为预先列出的总目标仓位；整数股、价格漂移和成交日期使实际平均仓位不同。这是低仓位参考，不是严格等风险匹配。",
      "改变起始日的账户各从100万元现金开始、持仓清零，允许使用起始日前已公开事实与价格预热。窗口彼此重叠，不能视为独立样本或拼接成连续收益。",
      "长期价格参考不使用任何公司证据；较早行情不能代替缺失的历史研究事实，不对缺证期间的基本面策略输出虚构收益。",
      "四家公司为事后选定的固定池；未完整模拟历史汇率、分红、税费、涨跌停、市场冲击及真实成交约束。",
      "三组候选的规则保持不变；全部结果仍是开发数据上的诊断，没有新增样本外结论。",
    ],
    source:{title:"SEC投资者教育：如何理解投资业绩声明",url:"https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-47"},
  };
}
