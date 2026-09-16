"use client";
import {ResearchArchiveBoundary,type ArchiveBundle} from "./ResearchArchiveBoundary";
import type {ArchiveTypes} from "./research/archive-types";
type PanelProps={asOf:string;mode:string};
import {historicalCoverageAt} from './research/historicalCoverage.mjs';
type Cell={period:string;ready:boolean;cashReady:boolean;comparableReady:boolean;sourceUrl:string|null};
type Coverage={ready:number;expected:number;columns:string[];companies:{ticker:string;name:string;ready:number;cells:Cell[]}[]};
function HistoricalCoveragePanelContent({archives,props}:{archives:ArchiveBundle;props:PanelProps}){
const {asOf,mode}=props;
const data=archives["historical-evidence-2024-2025-v3.json"] as ArchiveTypes["historical-evidence-2024-2025-v3.json"];
const valuation=archives["historical-valuation-readiness-v1.json"] as ArchiveTypes["historical-valuation-readiness-v1.json"];

  const coverage:Coverage=historicalCoverageAt(data,asOf,mode);
  return <div className="historyCoverage">
    <h4>报告期覆盖核验：{coverage.ready} / {coverage.expected}</h4>
    <p>新增英伟达价格—财报—估值模板可在上方选择“英伟达”查看；下方估值清单保留为旧版缺口档案，不代表新模板的进度。新模板仍未认证正式PE与多年分位。</p>
    <p>计数只表示收入与利润已有记录，不代表现金流、同比和估值完整。英伟达按对应财年季度列示；中国公司的H1、9M和FY为累计，不能当作单季度直接相加。</p>
    <div className="cycleTableScroll" tabIndex={0} role="region" aria-label="四家公司历史报告期覆盖"><table><thead><tr><th>公司</th>{coverage.columns.map(c=><th key={c}>{c}<small>对应报告期</small></th>)}</tr></thead><tbody>{coverage.companies.map(c=><tr key={c.ticker}><th>{c.name}<small>{c.ready} / 7</small></th>{c.cells.map(cell=><td key={cell.period}>{cell.sourceUrl?<a href={cell.sourceUrl} target="_blank" rel="noreferrer">{cell.period}</a>:cell.period}<small>{cell.ready?'收入 / 利润已录入':'本档案尚无可用数据'}</small><small>{cell.cashReady?'现金流已录入':'现金流待补'} · {cell.comparableReady?'同比基数已录入':'同比基数待补'}</small></td>)}</tr>)}</tbody></table></div>
    <p className="historyNote">资料v3已完成12组同规则入场过滤复核，详见研究模拟盘的“补齐资料后，交易真的改变了吗？”。旧v1/v2实验单独保留，不能与新版结果混用。<a href="/research/matched-filter-suite-v3.json" download>下载v3复核结果</a></p>
    <details><summary>历史估值底座：已核实什么，还缺什么？</summary><p>{valuation.policy}</p>{valuation.items.map(item=><article key={item.ticker}><h4>{item.name} · PE / 分位：未完成</h4>{[item.publishedOn,...('supportingPublishedOn' in item && item.supportingPublishedOn?[item.supportingPublishedOn]:[])].every(date=>date<asOf)&&(mode!=='recorded'||valuation.recordedOn<asOf)?<><p>{item.verified}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer">核验来源 · 公开 {item.publishedOn}</a>{'supportingSourceUrl'in item&&item.supportingSourceUrl&&<p><a href={item.supportingSourceUrl} target="_blank" rel="noreferrer">EPS核验来源 · 公开 {item.supportingPublishedOn}</a></p>}</>:<p>此观察日期或录入口径下，该项核验资料尚不可用。</p>}<p>仍需补齐：{item.missing}</p></article>)}<p>{valuation.priceAudit.decision}。{valuation.priceAudit.missing}。</p><p>{valuation.percentilePolicy}</p><a href="/research/historical-valuation-readiness-v1.json" download>下载估值资料核验清单</a></details>
  </div>;
}

export default function HistoricalCoveragePanel(props:PanelProps){return <ResearchArchiveBoundary files={["historical-evidence-2024-2025-v3.json","historical-valuation-readiness-v1.json"]}>{archives=><HistoricalCoveragePanelContent archives={archives} props={props}/>}</ResearchArchiveBoundary>;}
