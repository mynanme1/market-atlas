"use client";
import {ResearchArchiveBoundary,type ArchiveBundle} from "./ResearchArchiveBoundary";
import type {ArchiveTypes} from "./research/archive-types";
type PanelProps={asOf:string;mode:string};
import {useMemo} from 'react';
import {nvidiaValuationAt} from './research/nvidiaValuation.mjs';
import './nvidia-valuation.css';
type Point={date:string;researchDate:string;pe:number;close:number;ttmEps:number};
type ValuationState={quarters:ArchiveTypes["nvda-valuation-template-v1.json"]["earnings"];price:(ArchiveTypes["nvda-valuation-template-v1.json"]["bars"])[number]|null;ttmEps:number|null;conditionalPe:number|null;points:Point[];issues:string[];dividends:ArchiveTypes["nvda-valuation-template-v1.json"]["dividends"];interpretation:string};
function PeChart({points}:{points:Point[]}){
  if(points.length<2)return <p>至少需要两个可试算日期，才显示估值走势；缺少价格时不会补线。</p>;
  const low=Math.floor(Math.min(...points.map(p=>p.pe))-1),high=Math.ceil(Math.max(...points.map(p=>p.pe))+1);
  const start=Date.parse(points[0].date),end=Date.parse(points.at(-1)!.date);
  const x=(p:Point)=>72+(Date.parse(p.date)-start)/(end-start)*750,y=(p:Point)=>190-(p.pe-low)/(high-low)*140;
  const path=points.map((p,i)=>`${!i||Date.parse(p.date)-Date.parse(points[i-1].date)>7*86400000?'M':'L'}${x(p)},${y(p)}`).join(' ');
  return <div className="nvChartScroll"><svg viewBox="0 0 880 245" role="img" aria-label="条件PE历史走势，非正式估值分位；全部数值可在下方表格查看">
    <title>条件PE走势（倍）</title>
    {[low,(low+high)/2,high].map(v=><g key={v}><line x1="72" x2="822" y1={190-(v-low)/(high-low)*140} y2={190-(v-low)/(high-low)*140} stroke="#dae3dc"/><text x="60" y={195-(v-low)/(high-low)*140} textAnchor="end">{v.toFixed(1)}×</text></g>)}
    <path d={path} stroke="#356447" strokeWidth="3" fill="none"/>
    <text x="72" y="226">{points[0].date}</text><text x="822" y="226" textAnchor="end">{points.at(-1)!.date}</text>
  </svg></div>;
}
function NvidiaValuationPanelContent({archives,props}:{archives:ArchiveBundle;props:PanelProps}){
const {asOf,mode}=props;
const data=archives["nvda-valuation-template-v1.json"] as ArchiveTypes["nvda-valuation-template-v1.json"];

  const state:ValuationState=useMemo(()=>nvidiaValuationAt(data,asOf,mode),[asOf,mode]);
  const fmt=(n:number|null,d=2)=>n===null?'—':n.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d});
  const canReconstruct=mode!=='recorded'||data.recordedOn<asOf;
  const selectedIds=new Set(state.quarters.map(e=>e.id));
  return <section className="nvValuation" aria-labelledby="nv-valuation-title">
    <div className="nvHeading"><div><p className="eyebrow">NVDA · 价格 → 财报 → 历史估值</p><h4 id="nv-valuation-title">英伟达：让每个估值都有来路</h4></div><span className="nvCaution">口径核验中 · 不触发交易</span></div>
    <p>跟随上方观察日期 <strong>{asOf}</strong>，按美东交易日期、开盘前可知信息重建。财报公开日和收盘价格日期都必须早于观察日；不是今天的估值。</p>
    <div className="nvSteps">
      <article><span>01 · 历史价格</span><strong>{state.price?`$${fmt(state.price.close)}`:'尚无价格'}</strong><p>{state.price?`${state.price.date} · Nasdaq Close/Last`:'当前日期未匹配到采集记录'}</p><small>复权定义仍需确认，不把“收到数据”等同于“口径正确”。</small></article>
      <article><span>02 · 当时可知盈利</span><strong>{state.ttmEps===null?'暂无可用TTM':`$${fmt(state.ttmEps,3)} / 股`}</strong><p>{state.quarters.length} / 4 个财季已选取</p><small>原始GAAP稀释EPS统一拆股口径后相加；近似TTM。</small></article>
      <article><span>03 · 条件PE试算</span><strong>{state.conditionalPe===null?'暂不可算':`${fmt(state.conditionalPe)} 倍`}</strong><p>正式PE、历史分位：尚未认证</p><small>有条件试算不代表估值低，更不会提高策略评分。</small></article>
    </div>
    <div className="nvFormula" role="status" aria-live="polite">{state.conditionalPe!==null?`$${fmt(state.price!.close)} ÷ $${fmt(state.ttmEps,3)} = ${fmt(state.conditionalPe)} 倍（条件试算）`:'本观察日没有满足条件的试算值。'}<p>{state.interpretation}</p></div>
    <ul className="nvIssues">{state.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>
    {canReconstruct&&<p className="nvCoverage">实际价格覆盖：{data.priceAudit.actualStart} — {data.priceAudit.actualEnd}，共 {data.priceAudit.count} 日；请求区间为全年，但响应并不完整。<a href={data.priceAudit.sourceUrl} target="_blank" rel="noreferrer">查看行情来源</a></p>}
    {state.points.length>0&&<><h5>已采集区间的条件PE走势</h5><PeChart points={state.points}/><p>曲线变化同时受价格与新披露EPS影响。每个点按该收盘日的次日重建，不把今天的TTM用于整条历史曲线。</p></>}
    <details open><summary>展开算式：本次用到哪四份财报？</summary><div className="cycleTableScroll" tabIndex={0} role="region" aria-label="英伟达历史EPS计算明细"><table><thead><tr><th>财季 / 期末</th><th>公开日期</th><th>原始稀释EPS</th><th>拆股归一</th><th>原始证据</th></tr></thead><tbody>{data.earnings.filter(e=>selectedIds.has(e.id)).map(e=><tr key={e.id}><th>{e.period}<small>{e.periodEnd}</small></th><td>{e.publishedOn}</td><td>${fmt(e.reportedEps)}</td><td>÷ {e.splitDivisor}<small>${fmt(e.normalizedEps,3)} / 股</small></td><td><a href={e.sourceUrl} target="_blank" rel="noreferrer">GAAP摘要 · 稀释EPS</a></td></tr>)}</tbody></table></div>{!state.quarters.length&&<p>此日期与时间口径下，还没有可用财报。</p>}
    {canReconstruct&&data.split.publishedOn<asOf&&<p>2024年10拆1：6月7日收盘后分配，6月10日开始按拆股后价格交易。拆股前季度EPS除以10；保留原始精度，不混入后续四舍五入的比较数。<a href={data.split.sourceUrl} target="_blank" rel="noreferrer">公司拆股公告</a></p>}
    {canReconstruct&&data.annualCrosscheck.publishedOn<asOf&&<p>口径自检：FY2025四个季度合计2.938美元，全年披露2.94美元；季度加权股数与舍入差异使二者可能不完全一致。<a href={data.annualCrosscheck.sourceUrl} target="_blank" rel="noreferrer">全年报告</a></p>}</details>
    <details><summary>分红怎样处理？已公告 {state.dividends.length} 次</summary><p>分红与股价分开保存，不从收盘价中再扣一次分红。本模板没有计算含分红总回报；记录日、除息日和支付日不是同一概念。</p><div className="cycleTableScroll" tabIndex={0} role="region" aria-label="当时已公告分红"><table><thead><tr><th>公告日</th><th>除息日</th><th>支付日</th><th>美元 / 股</th><th>证据</th></tr></thead><tbody>{state.dividends.map(d=><tr key={d.exDate}><td>{d.declarationDate}</td><td>{d.exDate}{d.exDate>=asOf?'（尚未到期）':''}</td><td>{d.paymentDate}{d.paymentDate>=asOf?'（计划）':''}</td><td>${fmt(d.amount)}</td><td><a href={d.issuerSourceUrl} target="_blank" rel="noreferrer">公司声明</a> · <a href="https://api.nasdaq.com/api/quote/NVDA/dividends?assetclass=stocks" target="_blank" rel="noreferrer">除息记录</a></td></tr>)}</tbody></table></div></details>
    {state.points.length>0&&<details><summary>查看逐日试算数据（{state.points.length} 条）</summary><div className="cycleTableScroll nvDailyTable" tabIndex={0} role="region" aria-label="历史条件PE逐日数据"><table><thead><tr><th>收盘日期</th><th>研究可用日</th><th>收盘价 USD</th><th>近四季EPS USD</th><th>条件PE</th></tr></thead><tbody>{[...state.points].reverse().map(p=><tr key={p.date}><td>{p.date}</td><td>{p.researchDate}</td><td>{fmt(p.close)}</td><td>{fmt(p.ttmEps,3)}</td><td>{fmt(p.pe)}×</td></tr>)}</tbody></table></div></details>}
    <details><summary>验收边界与可复现资料</summary><ul>{data.gaps.map(g=><li key={g}>{g}</li>)}</ul><p>本模板用美元价格和美元每股收益，不引入固定人民币汇率。新资料独立存档，原回测与模拟盘订单保持原样。</p><p>原始响应已保存抓取时间和SHA-256，可按下载文件内的sourceId定位。今天补录的网页不等于历史时点已保存的原件；仍存在网站后来修订的风险。</p>{canReconstruct&&<p>与旧档案重叠 {data.oldArchiveAudit.matchedDates} 日；最大收盘价差 ${fmt(data.oldArchiveAudit.maxAbsDifference)}。即使一致，也不是独立行情源验证。</p>}<p><a href="/research/nvda-valuation-template-v1.json" download>下载模板、来源索引及行情数据</a></p></details>
  </section>;
}

export default function NvidiaValuationPanel(props:PanelProps){return <ResearchArchiveBoundary files={["nvda-valuation-template-v1.json"]}>{archives=><NvidiaValuationPanelContent archives={archives} props={props}/>}</ResearchArchiveBoundary>;}
