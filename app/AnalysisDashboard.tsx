"use client";

import { useMemo } from "react";

type Company = { id: number; name: string; market: string; sector: string; chain: string; risk: string };
type Relation = { id: number; sourceId: number; targetId: number; type: string };
type Membership = { companyId: number; chainName: string; stage: string; stageOrder: number };
type Tag = { companyId: number; tagType: string; tagName: string };
type Exposure = { companyId: number; factor: string; direction: string; sensitivity: string };
type Stage = { chainName: string; stageOrder: number; stageName: string };
type RelationMeta = { relationId: number; relationClass: string; confidence: number; strength: number; status: string };
type RelationEvidence = { relationId: number; evidenceId: number };
type Data = {
  companies: Company[]; relations: Relation[]; memberships?: Membership[]; tags?: Tag[];
  exposures?: Exposure[]; stages?: Stage[]; relationMeta?: RelationMeta[];
  relationEvidence?: RelationEvidence[];
};

function percent(value: number) { return `${Math.round(value * 100)}%`; }

function calculate(data: Data) {
  const n = data.companies.length;
  const memberships = data.memberships ?? [];
  const tags = data.tags ?? [];
  const exposures = data.exposures ?? [];
  const stages = data.stages ?? [];
  const metadata = data.relationMeta ?? [];
  const evidenceLinks = data.relationEvidence ?? [];
  const companyById = new Map(data.companies.map(company => [company.id, company]));

  const evidenceRelations = new Set(evidenceLinks.map(link => link.relationId));
  const evidenceCoverage = data.relations.length ? evidenceRelations.size / data.relations.length : 0;
  const averageConfidence = metadata.length ? metadata.reduce((sum, item) => sum + item.confidence, 0) / metadata.length : 0;
  const verifiedRate = metadata.length ? metadata.filter(item => item.status === "已确认" || item.status === "已附证据").length / metadata.length : 0;

  const degree = new Map(data.companies.map(company => [company.id, 0]));
  data.relations.forEach(relation => {
    degree.set(relation.sourceId, (degree.get(relation.sourceId) ?? 0) + 1);
    degree.set(relation.targetId, (degree.get(relation.targetId) ?? 0) + 1);
  });

  let pageRank = new Map(data.companies.map(company => [company.id, 1 / Math.max(n, 1)]));
  const outgoing = new Map(data.companies.map(company => [company.id, [] as number[]]));
  data.relations.forEach(relation => outgoing.get(relation.sourceId)?.push(relation.targetId));
  for (let iteration = 0; iteration < 40; iteration++) {
    const next = new Map(data.companies.map(company => [company.id, (1 - 0.85) / Math.max(n, 1)]));
    data.companies.forEach(company => {
      const targets = outgoing.get(company.id) ?? [];
      if (!targets.length) return;
      targets.forEach(target => next.set(target, (next.get(target) ?? 0) + 0.85 * (pageRank.get(company.id) ?? 0) / targets.length));
    });
    pageRank = next;
  }
  const centrality = data.companies.map(company => ({
    company,
    degree: degree.get(company.id) ?? 0,
    normalizedDegree: n > 1 ? (degree.get(company.id) ?? 0) / (n - 1) : 0,
    pageRank: pageRank.get(company.id) ?? 0,
  })).sort((a, b) => b.pageRank - a.pageRank || b.degree - a.degree).slice(0, 6);

  const chainCoverage = [...new Set(stages.map(stage => stage.chainName))].map(chain => {
    const chainStages = stages.filter(stage => stage.chainName === chain);
    const memberOrders = new Set(memberships.filter(item => item.chainName === chain).map(item => item.stageOrder));
    const covered = chainStages.filter(stage => memberOrders.has(stage.stageOrder)).length;
    const companies = new Set(memberships.filter(item => item.chainName === chain).map(item => item.companyId)).size;
    return { chain, covered, total: chainStages.length, rate: chainStages.length ? covered / chainStages.length : 0, companies };
  }).sort((a, b) => a.rate - b.rate || b.total - a.total);

  const sectorCounts = [...new Set(data.companies.map(company => company.sector))].map(sector => ({
    name: sector, count: data.companies.filter(company => company.sector === sector).length,
  })).sort((a, b) => b.count - a.count);
  const sectorHhi = sectorCounts.reduce((sum, item) => sum + Math.pow(item.count / Math.max(n, 1), 2), 0) * 10000;

  const dimensionScores = data.companies.map(company => {
    const hasChain = memberships.some(item => item.companyId === company.id);
    const hasTag = tags.some(item => item.companyId === company.id);
    const hasExposure = exposures.some(item => item.companyId === company.id);
    const related = data.relations.some(item => item.sourceId === company.id || item.targetId === company.id);
    return { company, score: [hasChain, hasTag, hasExposure, related].filter(Boolean).length / 4 };
  });
  const completeness = dimensionScores.length ? dimensionScores.reduce((sum, item) => sum + item.score, 0) / dimensionScores.length : 0;
  const incomplete = dimensionScores.sort((a, b) => a.score - b.score).slice(0, 6);

  const factorGroups = [...new Set(exposures.map(item => item.factor))].map(factor => {
    const items = exposures.filter(item => item.factor === factor);
    return { factor, count: items.length, companies: items.map(item => companyById.get(item.companyId)?.name).filter(Boolean).join("、") };
  }).sort((a, b) => b.count - a.count);

  return {
    evidenceCoverage, averageConfidence, verifiedRate, centrality, chainCoverage,
    sectorCounts, sectorHhi, completeness, incomplete, factorGroups,
    unverified: metadata.filter(item => item.status === "待核验").length,
  };
}

export function AnalysisDashboard({ data }: { data: Data }) {
  const result = useMemo(() => calculate(data), [data]);
  const hhiLabel = result.sectorHhi < 1500 ? "分散" : result.sectorHhi < 2500 ? "中等集中" : "高度集中";

  return (
    <section className="proAnalysis">
      <div className="analysisHero">
        <div><p className="eyebrow">PROFESSIONAL ANALYTICS</p><h2>市场图谱数据分析</h2><p>从覆盖质量、网络结构、行业集中度与宏观暴露四个维度评估当前研究库。</p></div>
        <div className="analysisMethod"><b>分析口径</b><span>当前本地数据库</span><span>{data.companies.length} 家公司</span><span>{data.relations.length} 条关系</span></div>
      </div>

      <div className="qualityCards">
        <article><span>关系证据覆盖率</span><strong>{percent(result.evidenceCoverage)}</strong><div><i style={{width:percent(result.evidenceCoverage)}} /></div><p>已有证据的关系数 ÷ 全部关系数</p></article>
        <article><span>平均关系置信度</span><strong>{result.averageConfidence.toFixed(1)}<small>/ 5</small></strong><div><i style={{width:percent(result.averageConfidence / 5)}} /></div><p>关系元数据置信度的算术平均</p></article>
        <article><span>已核验关系比例</span><strong>{percent(result.verifiedRate)}</strong><div><i style={{width:percent(result.verifiedRate)}} /></div><p>已确认或已附证据关系 ÷ 全部关系</p></article>
        <article><span>公司维度完整度</span><strong>{percent(result.completeness)}</strong><div><i style={{width:percent(result.completeness)}} /></div><p>产业链、标签、宏观暴露和关系四项覆盖</p></article>
      </div>

      <div className="analysisColumns">
        <section className="analyticPanel">
          <header><div><p className="eyebrow">NETWORK CENTRALITY</p><h3>关键节点识别</h3></div><span>PageRank + 连接度</span></header>
          <div className="centralityTable">
            {result.centrality.map((item, index) => <article key={item.company.id}><em>{index + 1}</em><div><b>{item.company.name}</b><small>{item.company.sector} · {item.company.market}</small></div><div className="rankBar"><i style={{width:percent(item.pageRank / Math.max(result.centrality[0]?.pageRank ?? 1, .001))}} /></div><span>{item.degree} 条关系</span></article>)}
          </div>
          <footer>PageRank衡量节点被其他重要节点指向的程度；连接度衡量直接关系数量。两者均不代表投资收益。</footer>
        </section>

        <section className="analyticPanel">
          <header><div><p className="eyebrow">CHAIN COVERAGE</p><h3>产业链覆盖与缺口</h3></div><span>标准环节覆盖率</span></header>
          <div className="coverageList">
            {result.chainCoverage.map(item => <article key={item.chain}><div><b>{item.chain}</b><span>{item.companies} 家公司</span></div><div className="coverageBar"><i style={{width:percent(item.rate)}} /></div><em>{item.covered}/{item.total} · {percent(item.rate)}</em></article>)}
          </div>
          <footer>覆盖率只衡量标准环节是否已有公司，不评价公司质量或关系真实性。</footer>
        </section>
      </div>

      <div className="analysisColumns lower">
        <section className="analyticPanel">
          <header><div><p className="eyebrow">CONCENTRATION</p><h3>行业样本集中度</h3></div><span>HHI {Math.round(result.sectorHhi)} · {hhiLabel}</span></header>
          <div className="sectorBars">{result.sectorCounts.map(item => <article key={item.name}><span>{item.name}</span><div><i style={{width:percent(item.count / Math.max(data.companies.length,1))}} /></div><b>{item.count}</b></article>)}</div>
          <footer>HHI为各行业样本占比平方和×10,000；反映研究库结构，不代表真实市场集中度。</footer>
        </section>

        <section className="analyticPanel">
          <header><div><p className="eyebrow">MACRO EXPOSURE</p><h3>宏观因子暴露</h3></div><span>{result.factorGroups.length} 个已记录因子</span></header>
          <div className="factorGrid">{result.factorGroups.length ? result.factorGroups.map(item => <article key={item.factor}><b>{item.factor}</b><span>{item.count} 家公司</span><p>{item.companies}</p></article>) : <p className="emptyState">尚未录入宏观因子暴露。</p>}</div>
          <footer>当前为定性暴露；下一阶段可用回归系数、价格弹性和盈利敏感性替代高中低标签。</footer>
        </section>
      </div>

      <section className="researchGapPanel">
        <div><p className="eyebrow">RESEARCH GAPS</p><h3>优先补全建议</h3></div>
        <div className="gapMetrics"><article><strong>{result.unverified}</strong><span>条关系仍待核验</span></article><article><strong>{result.incomplete.filter(item => item.score < 1).length}</strong><span>家优先补全公司</span></article></div>
        <div className="gapCompanies">{result.incomplete.map(item => <span key={item.company.id}>{item.company.name}<i>{percent(item.score)}</i></span>)}</div>
        <p>建议顺序：先补证据覆盖率，再补产业链空白环节，最后量化宏观敏感度。证据不足时，不应把网络中心性直接解释为投资价值。</p>
      </section>
    </section>
  );
}
