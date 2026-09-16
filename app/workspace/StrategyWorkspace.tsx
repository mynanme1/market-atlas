import { lazy, Suspense } from 'react';
import { strategyRules } from './strategyRules';
import type { Payload } from './model';
const Backtest = lazy(()=>import('./StrategyBacktestWorkspace').then(m=>({default:m.StrategyBacktestWorkspace})));
const Factors = lazy(()=>import('../FactorLabDashboard').then(m=>({default:m.FactorLabDashboard})));
const archives = {
  improvement: { label:'策略改进对照', component:lazy(()=>import('../StrategyImprovementPanel')) },
  exposure: { label:'仓位暴露控制', component:lazy(()=>import('../ExposureControlPanel')) },
  v3: { label:'V3 配对对照', component:lazy(()=>import('../V3MatchedBacktestPanel')) },
  matched: { label:'过滤器配对实验', component:lazy(()=>import('../MatchedFilterBacktestPanel')) },
  historical: { label:'历史因子实验', component:lazy(()=>import('../HistoricalFactorBacktestPanel')) },
  validation: { label:'样本验证', component:lazy(()=>import('../ValidationBacktestPanel')) },
  suite: { label:'多策略对照', component:lazy(()=>import('../StrategySuitePanel')) },
  execution: { label:'执行机制实验', component:lazy(()=>import('../ExecutionBacktestPanel')) },
};
export function StrategyWorkspace({data,tab,archive,onTab,onArchive,onDataChange,onPortfolio}:{data:Payload;tab:string;archive:string;onTab:(tab:string)=>void;onArchive:(archive:string)=>void;onDataChange:(data:Payload)=>void;onPortfolio:()=>void}) {
  const selected=archives[archive as keyof typeof archives]??archives.improvement; const Experiment=selected.component;
  return <div className="ma-stack"><div className="ma-tabs" aria-label="策略实验室内容">{[['rules','当前规则'],['backtest','历史回测'],['factors','因子研究'],['archive','实验归档']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>onTab(id)}>{label}</button>)}</div>
    {tab==='rules'&&<section className="ma-panel"><p className="ma-kicker">CURRENT STRATEGY · UNCHANGED</p><h2>{strategyRules.name}</h2><p>本轮只调整工作区结构，未修改评分公式、选股门槛或交易参数。下列规则读取自模拟组合使用的同一份配置。</p><div className="ma-stats"><article><span>目标投入</span><strong>{strategyRules.targetInvested*100}%</strong></article><article><span>最大持仓数</span><strong>{strategyRules.maxHoldings}</strong></article><article><span>单公司上限</span><strong>{strategyRules.maxPosition*100}%</strong></article><article><span>单产业链上限</span><strong>{strategyRules.maxChain*100}%</strong></article></div><div className="ma-two"><section className="ma-inset"><h3>决策与约束</h3><p>最低研究评分：{strategyRules.minimumScore}；行情有效期上限：{strategyRules.maxQuoteAgeDays} 天。</p><p>长期吸引力与短期入场条件保留分列；完整候选排名及现有执行入口在模拟组合中。</p></section><section className="ma-inset"><h3>验证与执行分开</h3><p>回测检验历史假设，不等同于当前可交易信号。实验结果不会自动覆盖当前策略，也不会自动产生模拟订单。</p><p>严格时点回测使用当时可用信息；重建模式及其局限沿用原报告提示。</p></section></div><div className="ma-actions"><button className="primary" onClick={()=>onTab('backtest')}>运行历史回测 →</button><button onClick={onPortfolio}>查看模拟执行 →</button></div></section>}
    <Suspense fallback={<p className="ma-empty" role="status">正在载入研究工具…</p>}>
      {tab==='backtest'&&<Backtest />}
      {tab==='factors'&&<Factors data={data} onDataChange={next=>onDataChange(next as Payload)} />}
      {tab==='archive'&&<><section className="ma-panel"><h2>实验归档</h2><p className="ma-muted">按需打开一个实验；保留原报告与测试方法，不将历史实验直接视为当前投资结论。</p><label className="ma-field">选择实验<select value={archive} onChange={e=>onArchive(e.target.value)}>{Object.entries(archives).map(([id,entry])=><option key={id} value={id}>{entry.label}</option>)}</select></label></section><Experiment /></>}
    </Suspense>
  </div>;
}
