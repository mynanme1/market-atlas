import test from 'node:test';
import assert from 'node:assert/strict';
import {selectHistoricalEvidence,isIsoDate} from '../app/research/historicalEvidence.mjs';
import {technicalAt,simulate,adaptiveAction} from '../app/research/executionBacktest.mjs';
import {earningsAt} from '../app/research/nvidiaValuation.mjs';
import {syntheticInput} from '../examples/synthetic-input.mjs';
test('publication and recording clocks are separate; release day is excluded',()=>{
  const data={documents:[{id:'synthetic-doc',ticker:'DEMO',name:'合成公司',publishedOn:'2024-02-01',recordedOn:'2024-03-01',facts:[{id:'f1',metric:'revenue',period:'2023',unit:'synthetic-unit',value:100}]}]};
  assert.equal(selectHistoricalEvidence(data,{asOf:'2024-02-01'}).currentFacts.length,0);
  assert.equal(selectHistoricalEvidence(data,{asOf:'2024-02-02'}).currentFacts.length,1);
  assert.equal(selectHistoricalEvidence(data,{asOf:'2024-02-02',mode:'recorded'}).currentFacts.length,0);
  assert.equal(isIsoDate('2024-02-30'),false);
});
test('future prices cannot alter earlier technical signals',()=>{
  const input=syntheticInput(),bars=input.histories[0].bars,date=bars[170].date;
  assert.deepEqual(technicalAt(bars,date),technicalAt(bars.map(b=>b.date>date?{...b,close:99999}:b),date));
});
test('synthetic simulation reconciles cash, holdings, fees and next-day execution',()=>{
  const input=syntheticInput(),dates=input.histories[0].bars.map(b=>b.date);
  const result=simulate(input,'synthetic',{key:'equal',label:'synthetic',family:'equal',daily:false},dates[130],dates.at(-1),dates);
  assert.ok(result.trades.length>0);
  let cash=1e6;const holdings=new Map();
  for(const trade of result.trades){
    assert.ok(trade.signalDate<trade.date);
    assert.equal(trade.quantity%100,0);
    const buy=trade.side==='买入';cash-=(buy?1:-1)*trade.value+trade.fee;
    holdings.set(trade.ticker,(holdings.get(trade.ticker)??0)+(buy?1:-1)*trade.quantity);
    assert.ok(cash>=-1e-6);assert.ok(holdings.get(trade.ticker)>=0);
  }
  const nav=cash+[...holdings].reduce((sum,[ticker,q])=>sum+q*input.histories.find(h=>h.company.ticker===ticker).bars.at(-1).close,0);
  assert.ok(Math.abs(nav-result.metrics.finalValue)<1e-6);
});
test('future observations cannot change earlier NAV or orders',()=>{
  const input=syntheticInput(),dates=input.histories[0].bars.map(b=>b.date),cutoff=dates[220];
  const variant={key:'staged',label:'synthetic',daily:true,adaptive:true};
  const run=data=>simulate(data,'synthetic',variant,dates[130],dates.at(-1),dates);
  const prior=run(input),modified=structuredClone(input);
  for(const h of modified.histories)for(const bar of h.bars)if(bar.date>cutoff)bar.close*=3;
  const next=run(modified);
  assert.deepEqual(prior.curve.filter(p=>p.date<=cutoff),next.curve.filter(p=>p.date<=cutoff));
  assert.deepEqual(prior.trades.filter(p=>p.date<=cutoff),next.trades.filter(p=>p.date<=cutoff));
});
test('high-confidence counterevidence forces exit even with missing prices',()=>{
  assert.equal(adaptiveAction({peakClose:100},null,{counter:true,known:true,raw:2}).action,'exit');
});
test('EPS needs four consecutive disclosed quarters; synthetic values only',()=>{
  const data={currency:'USD',earnings:[1,2,3,4].map(q=>({period:`FY2024-Q${q}`,periodEnd:'2024-12-31',publishedOn:'2025-02-01',recordedOn:'2025-03-01',currency:'USD',reportedEps:q,splitDivisor:2}))};
  assert.equal(earningsAt(data,'2025-02-01').ttmEps,null);
  assert.equal(earningsAt(data,'2025-02-02').ttmEps,5);
  assert.equal(earningsAt(data,'2025-02-02','recorded').ttmEps,null);
  assert.equal(earningsAt({...data,earnings:data.earnings.slice(1)},'2025-02-02').ttmEps,null);
});
