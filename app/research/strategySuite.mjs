import {simulate} from "./executionBacktest.mjs";

export const strategyFamilies=[
  {key:"baseline",label:"原20日规则",group:"证据策略",daily:false,adaptive:false,rule:"每20个组合交易日按原MA20/60日收益条件复核；保留原每日论点与趋势退出。"},
  {key:"staged",label:"每日分级买卖",group:"证据策略",daily:true,adaptive:true,rule:"沿用两日确认、半仓、减半、MA60清仓与12%回撤退出机制。"},
  {key:"thesis",label:"论点持有",group:"证据策略",family:"thesis",daily:false,rule:"每20日按正向研究分入场，不用均线择时；每日仅在高置信反证或净驱动≤0时清仓。"},
  {key:"slow",label:"论点＋低频趋势",group:"证据策略",family:"slow",daily:false,rule:"每5日检查入场：价格高于MA60至少2%、120日收益为正。持有后仅论点失效，或连续5日低于MA60且120日收益非正时清仓。"},
  {key:"breakout",label:"60日通道突破",group:"价格对照",family:"breakout",daily:true,rule:"突破此前60日最高收盘价0.5%买入；跌破此前20日最低收盘价清仓。"},
  {key:"pullback",label:"长期趋势内回撤",group:"价格对照",family:"pullback",daily:true,rule:"价格高于MA120且简易14日RSI<35买入；RSI≥55或连续5日低于MA120清仓。RSI按窗口涨跌额计算，非Wilder平滑。"},
  {key:"momentum",label:"120日动量前二",group:"价格对照",family:"momentum",daily:false,rule:"每20日持有120日收益为正且排名前二的公司，掉出前二或收益非正时退出。"},
  {key:"equal",label:"四公司等权参考",group:"固定池参考",family:"equal",daily:false,rule:"每股目标12%、合计48%，剩余现金；每20日复核，偏离目标10%后调整。没有公司评分或价格择时。"},
];
export const strategySources=[
  {title:"AQR：A Century of Evidence on Trend-Following Investing",url:"https://www.aqr.com/insights/research/journal-article/a-century-of-evidence-on-trend-following-investing",note:"借鉴趋势对照与长期、多环境验证的思路；本文跨资产期货研究不能证明本次四公司日线策略有效。"},
  {title:"DeMiguel等：Optimal Versus Naive Diversification",url:"https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1376199",note:"将简单等权作为比较参照；本轮每股12%＋现金并非复制论文的完整投资组合。"},
];

function summarizeSegments(result){
  const curve=result.curve,mid=Math.floor(curve.length/2),a=curve[mid].value;
  const months=[];let base=1e6;
  for(const month of [...new Set(curve.map(p=>p.date.slice(0,7)))]){
    const rows=curve.filter(p=>p.date.startsWith(month)),end=rows.at(-1).value;
    months.push({month,return:end/base-1,averageExposure:rows.reduce((s,p)=>s+p.exposure,0)/rows.length});base=end;
  }
  return {splitDate:curve[mid].date,firstHalf:a/1e6-1,secondHalf:curve.at(-1).value/a-1,months};
}
function contributions(result,input){
  return input.histories.map(h=>{
    const trades=result.trades.filter(t=>t.ticker===h.company.ticker);let flows=0,quantity=0;
    for(const t of trades){const sign=t.side==="买入"?1:-1;flows-=sign*t.value+t.fee;quantity+=sign*t.quantity;}
    const last=h.bars.filter(b=>b.date<=result.period.end).at(-1),pnl=flows+quantity*last.close*h.fxScale;
    return {ticker:h.company.ticker,name:h.company.name,pnl,contribution:pnl/1e6,trades:trades.length};
  });
}
export function runStrategySuite(input,inputId){
  const dates=[...new Set(input.histories.flatMap(h=>h.bars.map(b=>b.date)))].sort();
  const ids=new Set(input.histories.map(h=>h.company.id));
  const first=input.facts.filter(f=>ids.has(f.companyId)&&f.publicationDate).map(f=>f.publicationDate).sort()[0];
  const start=dates.find(d=>d>=first&&input.histories.every(h=>h.bars.filter(b=>b.date<=d).length>=125));
  // Stop at the prior verified end date, not at a later single-market session.
  const end="2026-09-04";
  if(!start||start>=end)throw new Error("固定样本无法完成125日预热");
  const scenarios=[{key:"base",label:"原成本与复核日",costMultiplier:1,reviewOffset:0},{key:"cost2",label:"佣金与滑点翻倍",costMultiplier:2,reviewOffset:0},{key:"phase5",label:"组合复核错开5日",costMultiplier:1,reviewOffset:5},{key:"phase10",label:"组合复核错开10日",costMultiplier:1,reviewOffset:10}];
  const results=strategyFamilies.map(family=>{
    const runs=scenarios.map(s=>({...simulate(input,inputId,{...family,...s,key:family.key,label:family.label,calendar:"local"},start,end,dates),scenario:s.key}));
    const main=runs[0];
    return {...main,...family,segments:summarizeSegments(main),contributions:contributions(main,input),
      robustness:runs.map((r,i)=>({key:scenarios[i].key,label:scenarios[i].label,metrics:r.metrics})),
      auditScenarios:runs.slice(1).map(r=>({scenario:r.scenario,trades:r.trades,curve:r.curve,openPositions:r.openPositions})),
      robustnessSummary:{minimumReturn:Math.min(...runs.map(r=>r.metrics.totalReturn)),maximumReturn:Math.max(...runs.map(r=>r.metrics.totalReturn)),positiveRuns:runs.filter(r=>r.metrics.totalReturn>0).length},
    };
  });
  return {status:"complete",version:"families-v1-20260908",generatedAt:new Date().toISOString(),inputId,period:{start,end},scenarios,results,sources:strategySources,
    assumptions:["8类规则与4个场景在本轮运行前固定，共32次模拟；不搜索最优阈值。","全部使用同一四公司池、各市场交易日、人民币口径、次日可交易收盘成交及原风险上限。","除等权参考外，沿用60日波动率缩放；证据策略继续采用原证据仓位缩放，故实际仓位不完全相同。","新增策略的持仓不复用买入门槛作自动退出；20日仓位复核采用10%相对偏离带。原规则与分级策略保留原设计。","价格对照与等权参考不使用证据择时，但固定公司池本身仍有事后选择偏差。","日期错开只改变定期复核安排，不延迟每日风险检查；低频趋势每5日入场检查随之平移。"],
    limitations:["仅覆盖约半年，且同一窗口已多次用于开发；前后半段与月度拆分不是新的样本外验证。","历史估值、盈利预期、行业资本开支尚未进入评分，未补齐的因子不能被均线替代。","原始事实虽按公开日过滤，但解读及公司—驱动映射仍为事后重建。","四公司且仓位偏低；高收益可能来自单个公司的走势或更高仓位，不能直接归因为选股有效。","分红、历史汇率、涨跌停、市场冲击与盘中订单成交未完整模拟。"],
  };
}
