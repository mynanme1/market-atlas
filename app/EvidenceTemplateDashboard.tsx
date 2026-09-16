"use client";

import { useMemo, useState } from "react";
import HistoricalEvidencePanel from "./HistoricalEvidencePanel";

type Company = {
  id: number; name: string; ticker: string; market: string; sector: string;
  chain: string; position: string; summary: string; color: string;
};
type SourceDocument = {
  id: number; companyId: number; documentType: string; title: string;
  reportingPeriod: string; publicationDate: string; url: string;
  sourceTier: string; extractionStatus: string;
};
type ExtractedFact = {
  id: number; companyId: number; documentId: number; factType: string;
  label: string; valueText: string; unit: string; reportingPeriod: string;
  location: string; evidenceSummary: string; confidence: number; verifiedAt: string;
};
type Driver = { id: number; name: string; probability: number; evidenceStatus: string };
type DriverFactLink = { id: number; driverId: number; factId: number; stance: string; relevance: number; rationale: string };

type Props = {
  data: {
    companies: Company[];
    documents?: SourceDocument[];
    facts?: ExtractedFact[];
    drivers?: Driver[];
    driverFactLinks?: DriverFactLink[];
  };
};

const sampleTickers = ["NVDA", "VRT", "601985", "600875"];
const requiredDimensions = [
  ["业务", ["业务事实"]],
  ["财务", ["财务指标"]],
  ["经营", ["经营指标", "运营指标"]],
  ["风险", ["风险因素"]],
  ["市场", ["市场覆盖"]],
] as const;

const researchPrompts: Record<string, { thesis: string; verify: string[]; warning: string }> = {
  NVDA: {
    thesis: "收入增长已被官方业绩披露确认；下一层需要验证增长是否能转化为持续自由现金流与定价权。",
    verify: ["数据中心收入增速与总收入增速的差异", "先进制程、封装与存储供给约束", "客户集中度与自研芯片替代速度"],
    warning: "季度高增长是事实，不等于估值具备安全边际。",
  },
  VRT: {
    thesis: "高积压订单和高订单出货比支持需求景气，但投资结论取决于交付能力、利润率和现金回款。",
    verify: ["积压订单转收入的季度节奏", "液冷收入占比及毛利率", "产能扩张、营运资本和供应链瓶颈"],
    warning: "订单不是收入，积压订单也可能延期或取消。",
  },
  "601985": {
    thesis: "在运机组和装机容量提供长期运营基础；估值判断还需连接利用小时、电价、在建转固与资本成本。",
    verify: ["核电利用小时及非计划停机", "新机组核准、投产时间与资本开支", "上网电价、折旧和融资成本敏感度"],
    warning: "装机增长并不自动等于短期利润同比增长。",
  },
  "600875": {
    thesis: "现有资料证明集团具备完整发电装备能力和全球覆盖，但上市公司口径的订单、收入与盈利数据仍待提取。",
    verify: ["2025年半年度新增订单及在手订单", "核电设备收入与毛利率", "合同负债、应收账款和经营现金流"],
    warning: "集团简介只能证明能力边界，不能替代上市公司财务证据。",
  },
};

export function EvidenceTemplateDashboard({ data }: Props) {
  const sampleCompanies = useMemo(
    () => sampleTickers.map(ticker => data.companies.find(company => company.ticker === ticker)).filter(Boolean) as Company[],
    [data.companies],
  );
  const [selectedTicker, setSelectedTicker] = useState(sampleTickers[0]);
  const selected = sampleCompanies.find(company => company.ticker === selectedTicker) ?? sampleCompanies[0];
  const documents = (data.documents ?? []).filter(document => document.companyId === selected?.id);
  const facts = (data.facts ?? []).filter(fact => fact.companyId === selected?.id);
  const driverFactLinks = data.driverFactLinks ?? [];
  const verifiedDocuments = documents.filter(document => document.extractionStatus === "已核验").length;
  const pendingDocuments = documents.length - verifiedDocuments;
  const presentTypes = new Set(facts.map(fact => fact.factType));
  const dimensionStatus = requiredDimensions.map(([name, types]) => ({
    name,
    complete: types.some(type => presentTypes.has(type)),
  }));
  const completeness = Math.round(dimensionStatus.filter(item => item.complete).length / requiredDimensions.length * 100);
  const averageConfidence = facts.length
    ? (facts.reduce((sum, fact) => sum + fact.confidence, 0) / facts.length).toFixed(1)
    : "—";
  const prompt = researchPrompts[selected?.ticker] ?? { thesis: "等待建立研究判断。", verify: [], warning: "资料不足。" };

  return <section className="evidenceWorkspace">
    <section className="evidenceHero">
      <div>
        <p className="eyebrow">SOURCE-TO-THESIS TEMPLATE</p>
        <h2>公司证据与分析工作台</h2>
        <p>以少量公司验证模板：原始披露可追溯、事实逐条定位、判断与证据严格分离。</p>
      </div>
      <div className="evidenceFlow" aria-label="研究流程">
        <span>01 原始文件</span><i>→</i><span>02 可核验事实</span><i>→</i><span>03 分析判断</span><i>→</i><span>04 持续跟踪</span>
      </div>
    </section>

    <HistoricalEvidencePanel />

    <nav className="sampleTabs" aria-label="样本公司">
      {sampleCompanies.map(company => {
        const companyDocuments = (data.documents ?? []).filter(document => document.companyId === company.id);
        const companyFacts = (data.facts ?? []).filter(fact => fact.companyId === company.id);
        return <button
          key={company.id}
          className={company.ticker === selected?.ticker ? "active" : ""}
          onClick={() => setSelectedTicker(company.ticker)}
        >
          <i style={{ background: company.color }}>{company.name.slice(0, 1)}</i>
          <span><b>{company.name}</b><small>{company.ticker} · {companyDocuments.length}份文件 · {companyFacts.length}条事实</small></span>
        </button>;
      })}
    </nav>

    {selected && <>
      <section className="evidenceSummary">
        <div className="companyEvidenceIdentity">
          <span className="evidenceAvatar" style={{ background: selected.color }}>{selected.name.slice(0, 1)}</span>
          <div><p>{selected.market} · {selected.sector} · {selected.chain}</p><h3>{selected.name}</h3><span>{selected.summary}</span></div>
        </div>
        <article><span>文件覆盖</span><b>{documents.length}</b><small>{verifiedDocuments} 已核验 / {pendingDocuments} 待提取</small></article>
        <article><span>结构化事实</span><b>{facts.length}</b><small>每条保留出处与期间</small></article>
        <article><span>平均置信度</span><b>{averageConfidence}<em>/5</em></b><small>仅评价证据可靠性</small></article>
        <article><span>维度完整度</span><b>{completeness}<em>%</em></b><small>{dimensionStatus.filter(x => !x.complete).map(x => x.name).join("、") || "核心维度齐备"}</small></article>
      </section>

      <section className="evidenceMainGrid">
        <section className="sourcePanel">
          <header><div><p className="eyebrow">PRIMARY SOURCES</p><h3>原始文件清单</h3></div><span>优先法定披露与公司官方资料</span></header>
          <div className="sourceList">
            {documents.map(document => <article key={document.id}>
              <div className="sourceType">{document.documentType}</div>
              <div>
                <a href={document.url} target="_blank" rel="noreferrer">{document.title}<span>↗</span></a>
                <p>{document.reportingPeriod} · 发布于 {document.publicationDate || "日期待核"}</p>
              </div>
              <div className="sourceMeta">
                <span className={document.sourceTier.startsWith("一级") ? "tierOne" : "tierTwo"}>{document.sourceTier}</span>
                <b className={document.extractionStatus === "已核验" ? "verified" : "pending"}>{document.extractionStatus}</b>
              </div>
            </article>)}
            {!documents.length && <p className="templateEmpty">尚未录入原始文件。</p>}
          </div>
        </section>

        <aside className="qualityPanel">
          <header><p className="eyebrow">TEMPLATE QA</p><h3>模板质量检查</h3></header>
          <div className="dimensionChecks">
            {dimensionStatus.map(item => <div key={item.name} className={item.complete ? "complete" : "missing"}>
              <span>{item.complete ? "✓" : "!"}</span><b>{item.name}</b><small>{item.complete ? "已有可核验事实" : "需要继续提取"}</small>
            </div>)}
          </div>
          <div className="qualityRule">
            <b>入库规则</b>
            <p>每条事实必须同时具备：来源文件、报告期间、页码或章节、证据摘要、核验日期。</p>
          </div>
        </aside>
      </section>

      <section className="factPanel">
        <header><div><p className="eyebrow">VERIFIED FACTS</p><h3>可核验事实账本</h3></div><span>数值与叙述事实统一记录；不在此处混入投资结论</span></header>
        <div className="factTable" role="table">
          <div className="factTableHead" role="row">
            <span>类别 / 指标</span><span>事实值</span><span>报告期间</span><span>原文位置</span><span>证据说明</span><span>置信度</span>
          </div>
          {facts.map(fact => <div className="factTableRow" role="row" key={fact.id}>
            <div><small>{fact.factType}</small><b>{fact.label}</b></div>
            <strong>{fact.valueText || "定性事实"} {fact.unit}</strong>
            <span>{fact.reportingPeriod}</span>
            <span>{fact.location}</span>
            <p>{fact.evidenceSummary}{driverFactLinks.filter(link => link.factId === fact.id).map(link => {
              const driver = (data.drivers ?? []).find(item => item.id === link.driverId);
              return <span className="factDriverLink" key={link.id}>{link.stance}驱动：{driver?.name ?? "未知驱动"} · 相关度 {link.relevance}/5</span>;
            })}</p>
            <em>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < fact.confidence ? "filled" : ""} />)}<small>{fact.confidence}/5</small></em>
          </div>)}
          {!facts.length && <p className="templateEmpty">尚未提取结构化事实。</p>}
        </div>
      </section>

      <section className="thesisPanel">
        <div className="thesisStatement">
          <p className="eyebrow">ANALYST INTERPRETATION</p>
          <h3>当前可形成的分析判断</h3>
          <p>{prompt.thesis}</p>
          <div><b>边界提醒</b><span>{prompt.warning}</span></div>
        </div>
        <div className="verificationQueue">
          <header><span>下一轮验证</span><b>{prompt.verify.length} 项</b></header>
          {prompt.verify.map((item, index) => <article key={item}><i>0{index + 1}</i><span>{item}</span></article>)}
        </div>
      </section>

      <section className="methodologyStrip">
        <b>事实 ≠ 判断 ≠ 预测</b>
        <span>事实回答“公司披露了什么”</span>
        <span>判断回答“这些事实如何传导至收入、利润和现金流”</span>
        <span>预测必须写明假设、概率、时间范围与失效条件</span>
      </section>
    </>}
  </section>;
}
