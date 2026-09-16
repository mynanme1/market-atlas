import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {sections,defaultRoute,parseRoute,formatRoute} from '../app/workspace/navigation.mjs';

async function component(file,name) {
  const built=await build({entryPoints:[fileURLToPath(new URL('../app/workspace/'+file,import.meta.url))],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],loader:{'.css':'empty'}});
  const module={exports:{}};
  new Function('require','module','exports',built.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  return module.exports[name];
}
const noop=()=>{};
const company={id:7,name:'测试公司',ticker:'TEST',market:'A股',sector:'设备',chain:'能源',position:'上游',summary:'业务说明',moat:'客户认证',catalyst:'新增订单',risk:'产能过剩',color:'#345'};
const data={companies:[company],relations:[],documents:[{id:2,companyId:7,title:'年度报告',documentType:'财报',reportingPeriod:'2025',publicationDate:'2026-03-01',sourceTier:'一级',url:'https://example.com/report',extractionStatus:'已提取'}],facts:[{id:9,companyId:7,documentId:2,label:'收入',valueText:'100',unit:'亿元',reportingPeriod:'2025',location:'第10页',evidenceSummary:'订单传导仍需检验',confidence:4,verifiedAt:'2026-03-02'}],drivers:[{id:1,name:'需求扩张'}],driverFactLinks:[{id:1,driverId:1,factId:9,stance:'反驳',rationale:'收入增长不代表利润增长'}]};

test('four top-level sections and round-trip URLs preserve company and subview',()=>{
  assert.equal(sections.length,4);
  const route={...defaultRoute,view:'research',company:7,detail:'evidence',lab:'archive',archive:'matched'};
  assert.deepEqual(parseRoute(formatRoute(route)),route);
  assert.deepEqual(parseRoute('#invalid?company=-1&detail=invalid'),defaultRoute);
  assert.equal(parseRoute('#research?company=Infinity').company,0);
});
test('company evidence keeps source dates, traceable facts and contrary reasoning',async()=>{
  const Component=await component('ResearchCenter.tsx','ResearchCenter');
  const html=renderToStaticMarkup(React.createElement(Component,{data,companyId:7,detail:'evidence',onSelect:noop,onDetail:noop,onEdit:noop,onPortfolio:noop,paper:null,paperError:''}));
  for(const value of ['年度报告','2026-03-01','第10页','反驳','收入增长不代表利润增长'])assert.ok(html.includes(value),value);
  assert.doesNotMatch(html,/NaN|undefined|�/);
});
test('missing metrics remain missing, with no fabricated zero or score',async()=>{
  const Component=await component('ResearchCenter.tsx','ResearchCenter');
  const html=renderToStaticMarkup(React.createElement(Component,{data,companyId:7,detail:'metrics',onSelect:noop,onDetail:noop,onEdit:noop,onPortfolio:noop,paper:null,paperError:''}));
  assert.match(html,/缺失数据不按零值处理/);
  assert.doesNotMatch(html,/NaN|undefined|�/);
});
test('today distinguishes source publication dates and quote dates from freshness',async()=>{
  const Component=await component('TodayWorkspace.tsx','TodayWorkspace');
  const html=renderToStaticMarkup(React.createElement(Component,{data,paper:{positions:[],orders:[{status:'待成交'}],quotes:[{priceDate:'2026-03-03'}]},paperError:'',onResearch:noop,onPortfolio:noop,onStrategy:noop}));
  for(const value of ['不表示今天已更新行情','2026-03-01','2026-03-03','不自动执行'])assert.ok(html.includes(value),value);
});
test('paper portfolio no longer imports or mounts historical experiment panels',async()=>{
  const paper=await readFile(new URL('../app/PaperTradingDashboard.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(paper,/BacktestPanel|StrategySuitePanel|StrategyImprovementPanel|backtestPanel/);
  assert.match(paper,/function runStrategy/);
  assert.match(paper,/function submitOrder/);
  assert.match(paper,/from "\.\/workspace\/strategyRules"/);
  const rules=await readFile(new URL('../app/workspace/strategyRules.ts',import.meta.url),'utf8');
  for(const value of ['minimumScore:1','maxHoldings:6','targetInvested:.5','maxPosition:.12','maxChain:.25','maxQuoteAgeDays:4'])assert.ok(rules.includes(value),value);
});
test('extracted backtest renders without automatically running an experiment',async()=>{
  const Component=await component('StrategyBacktestWorkspace.tsx','StrategyBacktestWorkspace');
  const html=renderToStaticMarkup(React.createElement(Component));
  assert.match(html,/严格/);
  assert.doesNotMatch(html,/NaN|undefined|�/);
});
