import {syntheticInput} from '../examples/synthetic-input.mjs';
import {simulate} from '../app/research/executionBacktest.mjs';
const input=syntheticInput(),dates=input.histories[0].bars.map(b=>b.date);
const runs=[{key:'equal',label:'合成样本等权参考',family:'equal',daily:false},{key:'staged',label:'合成样本分级买卖',adaptive:true,daily:true}].map(variant=>simulate(input,'synthetic-not-market-data',variant,dates[130],dates.at(-1),dates));
console.log(JSON.stringify({dataKind:'synthetic',warning:'仅验证程序规则，不是市场回测、投资建议或盈利证明。未产生模拟账户订单。',runs:runs.map(r=>({label:r.label,metrics:r.metrics,trades:r.trades.length}))},null,2));
