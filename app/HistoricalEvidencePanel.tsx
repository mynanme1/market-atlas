"use client";
import {ResearchArchiveBoundary,type ArchiveBundle} from "./ResearchArchiveBoundary";
import type {ArchiveTypes} from "./research/archive-types";
type PanelProps=Record<string, never>;

import {useMemo, useState} from "react";
import HistoricalCoveragePanel from './HistoricalCoveragePanel';
import NvidiaValuationPanel from './NvidiaValuationPanel';
import {isIsoDate, selectHistoricalEvidence} from "./research/historicalEvidence.mjs";
import "./cycle.css";
import "./historical-evidence.css";

type HistoricalDocument = (ArchiveTypes["historical-evidence-2024-2025-v3.json"]["documents"])[number];

function HistoricalEvidencePanelContent({archives,props}:{archives:ArchiveBundle;props:PanelProps}){
const archive=archives["historical-evidence-2024-2025-v3.json"] as ArchiveTypes["historical-evidence-2024-2025-v3.json"];

  const [ticker, setTicker] = useState("NVDA");
  const [asOf, setAsOf] = useState("2025-12-31");
  const [mode, setMode] = useState("public");
  const valid = isIsoDate(asOf);
  const selected = useMemo(() => valid ? selectHistoricalEvidence(archive, {asOf, ticker, mode}) : null, [asOf, ticker, mode, valid]);
  const currentIds = new Set(selected?.currentFacts.map(f => f.id));
  const totalFacts = archive.documents.reduce((sum, doc) => sum + doc.facts.length, 0);
  return <section className="cyclePanel historicalEvidence" aria-labelledby="historical-evidence-title">
    <header><div><p className="eyebrow">历史财报 · 按当时公开信息重建</p><h3 id="historical-evidence-title">先确认，当时能知道什么</h3><p>已补 {archive.companies.length} 家公司、{archive.documents.length} 份官方文件、{totalFacts} 条指标记录（含重述版本）。这是财报事实档案，不代表证据完整或投资评分提高。</p></div></header>
    <div className="historyFilters">
      <label>公司<select value={ticker} onChange={e => setTicker(e.target.value)}><option value="all">全部四家公司</option>{archive.companies.map(c => <option key={c.ticker} value={c.ticker}>{c.name} · {c.ticker}</option>)}</select></label>
      <label>观察日期<input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} aria-describedby="history-date-help" /></label>
      <label>时间口径<select value={mode} onChange={e => setMode(e.target.value)}><option value="public">重建当时市场可知的资料</option><option value="recorded">当时本系统已录入的资料</option></select></label>
      <a href="/research/historical-evidence-2024-2025-v3.json" download>下载结构化资料 v3</a>
    </div>
    <p id="history-date-help" className="historyNote">公开日当天暂不纳入，次日以后才可作为研究输入；成交仍须另按交易日、时区和执行规则处理。财报v3于 {archive.recordedOn} 补录，新增英伟达估值模板于2026-09-14录入，不能声称系统当年已经使用它们。</p>
    {!valid && <p role="alert">请选择有效的观察日期。</p>}
    {selected && <>
      {(ticker === 'NVDA' || ticker === 'all') && <NvidiaValuationPanel asOf={asOf} mode={mode} />}
      <HistoricalCoveragePanel asOf={asOf} mode={mode} />
      <p role="status" aria-live="polite">当前范围：{selected.documents.length} 份可用文件 · {selected.currentFacts.length} 个当时可用指标版本 · {selected.versions.length - selected.currentFacts.length} 条已被更新的旧记录仍保留。</p>
      {selected.documents.length === 0 && <div className="cycleFinding">{mode === "recorded" ? "这些资料在所选日期之前尚未录入本系统。切换到“重建当时市场可知的资料”，可查看当时已经公开、今天补录的原始事实。" : "本批资料在所选日期之前没有符合条件的文件。这表示当前档案缺口，不代表公司当时没有披露。"}</div>}
      <div className="historyDocuments">{selected.documents.map((doc: HistoricalDocument) => <details key={`${doc.id}-${ticker}-${mode}`}>
        <summary><span>{doc.name} · {doc.period}</span><span className="historyRelease">公开日 {doc.publishedOn}</span></summary>
        <p><a href={doc.sourceUrl} target="_blank" rel="noreferrer">{doc.title} · 打开官方原文</a></p>
        <p className="historyNote">报告期末 {doc.periodEnd}；录入日 {doc.recordedOn}。{doc.basis}</p>
        <p className="historyNote">日期依据：{doc.publicationBasis}</p>
        {"notes" in doc && doc.notes && <p className="historyNote">{doc.notes}</p>}
        <div className="cycleTableScroll" role="region" aria-label={`${doc.title}指标`} tabIndex={0}><table><thead><tr><th>指标 / 所属期间</th><th>披露数值</th><th>版本</th><th>原文位置</th></tr></thead><tbody>{doc.facts.map((fact: HistoricalDocument["facts"][number]) => <tr key={fact.id}>
          <th>{fact.label}<small>{fact.period}</small></th><td>{fact.value.toLocaleString("zh-CN", {maximumFractionDigits: 2})}<small>{fact.unit}</small></td><td>{fact.revision === "restated" ? "后续重述" : "disclosureRole" in fact && fact.disclosureRole === "comparative" ? "本次披露的同期对照" : "原始披露"}<small>{currentIds.has(fact.id) ? "此观察日采用" : "保留旧值，后续已更新"}</small></td><td>{fact.location}</td>
        </tr>)}</tbody></table></div>
      </details>)}</div>
    </>}
    <details><summary>资料覆盖与尚未补齐的部分</summary><div className="historyGaps">{archive.gaps.map(gap => <article key={gap.area}><h4>{gap.area} <span>{gap.area === "因子与策略" ? "已接入独立实验" : gap.status}</span></h4><p>{gap.detail}</p></article>)}</div></details>
    <p className="historyNote">{archive.interpretationPolicy}</p>
  </section>;
}

export default function HistoricalEvidencePanel(props:PanelProps){return <ResearchArchiveBoundary files={["historical-evidence-2024-2025-v3.json"]}>{archives=><HistoricalEvidencePanelContent archives={archives} props={props}/>}</ResearchArchiveBoundary>;}
