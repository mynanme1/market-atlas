"use client";

import { FormEvent, useMemo, useState } from "react";

type Company = { id: number; name: string; ticker: string; sector?: string; color?: string };
type Driver = { id: number; name: string; category: string; description: string; status: string; probability: number; horizon: string; leadingIndicator: string; evidenceStatus: string; updatedAt: string };
type Impact = { id: number; driverId: number; targetType: string; targetKey: string; direction: string; strength: number; transmission: string };
type Scenario = { id: number; name: string; probability: number; description: string; impactMultiplier: number };
type Fact = { id: number; companyId: number; documentId: number; factType: string; label: string; valueText: string; unit: string; reportingPeriod: string; location: string; evidenceSummary: string; confidence: number };
type Document = { id: number; companyId: number; title: string; url: string; sourceTier: string; extractionStatus: string };
type DriverFactLink = { id: number; driverId: number; factId: number; stance: string; relevance: number; rationale: string };
type Data = { companies: Company[]; drivers?: Driver[]; driverImpacts?: Impact[]; scenarios?: Scenario[]; facts?: Fact[]; documents?: Document[]; driverFactLinks?: DriverFactLink[] };

function sign(direction: string) { return direction === "利好" ? 1 : direction === "利空" ? -1 : 0; }
function numberOrZero(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function sourceWeight(document?: Document) {
  const tier=document?.sourceTier??"";
  if(tier.startsWith("A")||tier.includes("一级")||tier.includes("法定披露")||tier.includes("交易所")) return 1;
  if(tier.includes("二级")||tier.includes("公司官方")) return .85;
  return .65;
}

export function DriverDashboard({ data, onDataChange }: { data: Data; onDataChange: (data: Data) => void }) {
  const drivers = data.drivers ?? [];
  const impacts = data.driverImpacts ?? [];
  const scenarios = data.scenarios ?? [];
  const facts = data.facts ?? [];
  const documents = data.documents ?? [];
  const driverFactLinks = data.driverFactLinks ?? [];
  const [category, setCategory] = useState("全部");
  const [editor, setEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const categories = ["全部", ...new Set(drivers.map(driver => driver.category))];
  const visibleDrivers = drivers.filter(driver => category === "全部" || driver.category === category);

  const analysis = useMemo(() => {
    const visibleIds = new Set(visibleDrivers.map(driver => driver.id));
    const filteredImpacts = impacts.filter(impact => visibleIds.has(impact.driverId));
    const rows = filteredImpacts.map(impact => {
      const driver = visibleDrivers.find(item => item.id === impact.driverId);
      return { impact, driver, weighted: sign(impact.direction) * impact.strength * ((driver?.probability ?? 0) / 100) };
    }).filter(row => row.driver);
    const companyRows = data.companies.map(company => {
      const related = rows.filter(row => row.impact.targetType === "公司" && row.impact.targetKey === company.ticker);
      const positive = related.filter(row => row.weighted > 0).reduce((sum, row) => sum + row.weighted, 0);
      const negative = Math.abs(related.filter(row => row.weighted < 0).reduce((sum, row) => sum + row.weighted, 0));
      const driverIds = new Set(related.map(row => row.driver?.id).filter(Boolean) as number[]);
      const evidenceLinks = driverFactLinks.filter(link => {
        const fact = facts.find(item => item.id === link.factId);
        return driverIds.has(link.driverId) && fact?.companyId === company.id;
      });
      const coveredDrivers=[...driverIds].filter(driverId=>evidenceLinks.some(link=>link.driverId===driverId)).length;
      const coverage=driverIds.size?coveredDrivers/driverIds.size:0;
      const evidenceWeights=evidenceLinks.map(link=>{
        const fact=facts.find(item=>item.id===link.factId);
        const document=documents.find(item=>item.id===fact?.documentId);
        return Number(fact?.confidence??0)/5*Number(link.relevance??0)/5*sourceWeight(document);
      });
      const evidenceQuality=evidenceWeights.length?evidenceWeights.reduce((sum,value)=>sum+value,0)/evidenceWeights.length:0;
      let supportingWeight=0,limitingWeight=0;
      evidenceLinks.forEach((link,index)=>{
        const weight=evidenceWeights[index]??0;
        if(link.stance==="限制"||link.stance==="反证") limitingWeight+=weight;
        else supportingWeight+=weight*(link.stance==="支持"?1:.35);
      });
      const stanceTotal=supportingWeight+limitingWeight;
      const thesisSupport=stanceTotal?Math.max(0,Math.min(1,(supportingWeight-limitingWeight+stanceTotal)/(2*stanceTotal))):0;
      const evidenceScore=.3*coverage+.4*evidenceQuality+.3*thesisSupport;
      const evidenceFactor=.55+.45*evidenceScore;
      const topPositive = related.filter(row => row.weighted > 0).sort((a,b) => b.weighted-a.weighted)[0]?.driver?.name ?? "—";
      const topRisk = related.filter(row => row.weighted < 0).sort((a,b) => a.weighted-b.weighted)[0]?.driver?.name ?? "—";
      return { key: company.ticker, name: company.name, positive, negative, net: positive-negative, adjusted: (positive-negative)*evidenceFactor, coverage, evidenceQuality, thesisSupport, evidenceScore, evidenceLinks: evidenceLinks.length, topPositive, topRisk };
    }).filter(row => row.positive > 0 || row.negative > 0);
    const ranked = [...companyRows].sort((a, b) => b.adjusted - a.adjusted);
    const benefitRanking = companyRows.filter(row => row.positive > 0).sort((a,b) => b.adjusted-a.adjusted);
    const riskRanking = companyRows.filter(row => row.negative > 0).sort((a,b) => b.negative-a.negative);
    const evidenceChains = visibleDrivers.map(driver => {
      const links = driverFactLinks.filter(link => link.driverId === driver.id).map(link => ({
        link,
        fact: facts.find(fact => fact.id === link.factId),
      })).filter(item => item.fact);
      const affected = filteredImpacts.filter(impact => impact.driverId === driver.id && impact.targetType === "公司")
        .map(impact => data.companies.find(company => company.ticker === impact.targetKey)?.name ?? impact.targetKey);
      return { driver, links, affected };
    });
    return {
      positive: rows.filter(row => row.impact.direction === "利好").sort((a, b) => b.weighted - a.weighted),
      negative: rows.filter(row => row.impact.direction === "利空").sort((a, b) => a.weighted - b.weighted),
      ranked,
      benefitRanking,
      riskRanking,
      evidenceChains,
      impactCount: filteredImpacts.length,
      highProbability: visibleDrivers.filter(driver => driver.probability >= 60).length,
      unverified: visibleDrivers.filter(driver => driver.evidenceStatus === "待核验").length,
      linkedEvidence: evidenceChains.reduce((sum, item) => sum + item.links.length, 0),
    };
  }, [visibleDrivers, impacts, data.companies, driverFactLinks, facts]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/market", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...values, kind: "driver" }) });
    if (response.ok) { onDataChange(await response.json()); setEditor(false); }
    setSaving(false);
  }

  return <section className="driverDashboard">
    <div className="driverHero">
      <div><p className="eyebrow">DRIVERS & SCENARIOS</p><h2>利好、利空与概率情景</h2><p>先计算“方向 × 强度 × 概率”的驱动净影响，再由证据覆盖、来源质量和支持/反证平衡构成证据贡献分。覆盖率本身不代表结论得分。</p></div>
      <button onClick={() => setEditor(true)}>＋ 新增驱动因素</button>
    </div>

    <div className="driverStats">
      <article><span>{category === "全部" ? "驱动因素" : `${category}因素`}</span><b>{visibleDrivers.length}</b><p>{category === "全部" ? "政策、供需、产能、价格、技术与宏观" : `当前仅统计“${category}”分类`}</p></article>
      <article><span>影响映射</span><b>{analysis.impactCount}</b><p>当前筛选因素对公司或产业链的方向性影响</p></article>
      <article><span>高概率因素</span><b>{analysis.highProbability}</b><p>主观发生概率不低于60%</p></article>
      <article><span>证据连接</span><b>{analysis.linkedEvidence}</b><p>{analysis.unverified} 个因素仍缺少充分证据，需要继续核验</p></article>
    </div>

    <div className="driverFilters">{categories.map(item => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>

    <div className="driverMatrix">
      <section className="positiveDrivers"><header><div><span>↑</span><h3>主要利好因素</h3></div><small>概率加权影响最高</small></header>{analysis.positive.slice(0,6).map(row => <article key={row.impact.id}><div><b>{row.driver?.name}</b><span>{row.driver?.category} · {row.driver?.horizon}</span></div><em>{row.impact.targetKey} · 强度 {row.impact.strength}/5</em><p>{row.impact.transmission}</p><footer><i style={{width:`${row.driver?.probability}%`}} /><span>{row.driver?.probability}%</span></footer></article>)}</section>
      <section className="negativeDrivers"><header><div><span>↓</span><h3>主要利空因素</h3></div><small>概率加权影响最低</small></header>{analysis.negative.slice(0,6).map(row => <article key={row.impact.id}><div><b>{row.driver?.name}</b><span>{row.driver?.category} · {row.driver?.horizon}</span></div><em>{row.impact.targetKey} · 强度 {row.impact.strength}/5</em><p>{row.impact.transmission}</p><footer><i style={{width:`${row.driver?.probability}%`}} /><span>{row.driver?.probability}%</span></footer></article>)}</section>
    </div>

    <section className="companyRankingSection">
      <header>
        <div><p className="eyebrow">COMPANY RANKING</p><h3>利好公司与风险公司排名</h3></div>
        <p>利好排名按方向、强度和概率计算，再由事实置信度、相关性及证据立场调整；风险排名按已录入利空暴露排序。分数只用于横向比较，不代表预期收益率。</p>
      </header>
      <div className="companyRankingGrid">
        <section className="benefitRanking">
          <header><div><span>↑</span><h4>潜在受益公司</h4></div><small>净影响 × 证据综合贡献</small></header>
          {analysis.benefitRanking.slice(0,8).map((item,index) => <article key={item.key}>
            <em>{String(index+1).padStart(2,"0")}</em>
            <div className="rankingCompany"><b>{item.name}</b><small>{item.key} · 首要驱动：{item.topPositive}</small></div>
            <div className="rankingEvidence"><span>证据贡献 {Math.round(item.evidenceScore*100)}分 · 覆盖 {Math.round(item.coverage*100)}%</span><i><b style={{width:`${item.evidenceScore*100}%`}} /></i></div>
            <strong>{numberOrZero(item.adjusted) >= 0 ? "+" : ""}{numberOrZero(item.adjusted).toFixed(2)}</strong>
          </article>)}
        </section>
        <section className="riskRanking">
          <header><div><span>↓</span><h4>重点风险公司</h4></div><small>概率加权利空暴露</small></header>
          {analysis.riskRanking.slice(0,8).map((item,index) => <article key={item.key}>
            <em>{String(index+1).padStart(2,"0")}</em>
            <div className="rankingCompany"><b>{item.name}</b><small>{item.key} · 首要风险：{item.topRisk}</small></div>
            <div className="rankingEvidence"><span>{item.evidenceLinks} 条关联证据</span><i><b style={{width:`${Math.min(100,item.negative/5*100)}%`}} /></i></div>
            <strong>−{numberOrZero(item.negative).toFixed(2)}</strong>
          </article>)}
        </section>
      </div>
    </section>

    <div className="driverLower">
      <section className="weightedRanking"><header><div><p className="eyebrow">WEIGHTED IMPACT</p><h3>基本面研究分排序</h3></div><span>驱动净影响 × 证据贡献系数</span></header>{analysis.ranked.slice(0,10).map((item,index) => { const score = numberOrZero(item.adjusted); return <article key={item.key}><em>{index+1}</em><b>{item.name}</b><div className={score >= 0 ? "up" : "down"}><i style={{width:`${Math.min(100,Math.abs(score)/5*100)}%`}} /></div><span>{score > 0 ? "+" : ""}{score.toFixed(2)}</span></article> })}<footer>证据覆盖、质量与结论支持度只构成证据部分；该分数仍不包含完整估值与入场时点，不是上涨概率。</footer></section>
      <section className="scenarioPanel"><header><div><p className="eyebrow">SCENARIOS</p><h3>情景假设</h3></div><span>概率合计 {scenarios.reduce((sum,item)=>sum+numberOrZero(item.probability),0)}%</span></header>{scenarios.map(scenario => <article key={scenario.id}><div><b>{scenario.name}</b><strong>{numberOrZero(scenario.probability)}%</strong></div><p>{scenario.description}</p><footer><span>影响系数</span><i>{numberOrZero(scenario.impactMultiplier).toFixed(2)}×</i></footer></article>)}</section>
    </div>

    <section className="indicatorPanel"><div><p className="eyebrow">LEADING INDICATORS</p><h3>领先指标与监测清单</h3></div><div>{visibleDrivers.map(driver => <article key={driver.id}><header><b>{driver.name}</b><span className={driver.status === "进行中" ? "live" : ""}>{driver.status}</span></header><p>{driver.leadingIndicator}</p><footer><span>{driver.horizon}</span><span>{driver.evidenceStatus}</span><span>概率 {driver.probability}%</span></footer></article>)}</div></section>

    <section className="driverEvidencePanel">
      <header>
        <div><p className="eyebrow">EVIDENCE → DRIVER → COMPANY</p><h3>驱动证据链</h3></div>
        <span>{analysis.linkedEvidence} 条事实连接 · {analysis.evidenceChains.filter(item => !item.links.length).length} 个驱动尚无直接事实</span>
      </header>
      <div className="driverEvidenceList">
        {analysis.evidenceChains.map(item => <article key={item.driver.id} className={item.links.length ? "hasEvidence" : "needsEvidence"}>
          <div className="driverEvidenceTitle">
            <span>{item.driver.category}</span>
            <div><b>{item.driver.name}</b><small>概率 {item.driver.probability}% · {item.driver.evidenceStatus}</small></div>
            <em>{item.affected.join("、") || "尚未映射公司"}</em>
          </div>
          {item.links.length ? <div className="linkedFacts">{item.links.map(({link,fact}) => {
            const company = data.companies.find(company => company.id === fact?.companyId);
            const document = documents.find(document => document.id === fact?.documentId);
            return <div key={link.id}>
              <span className={link.stance === "支持" ? "supports" : "context"}>{link.stance}</span>
              <div><b>{company?.name} · {fact?.label}{fact?.valueText ? `：${fact.valueText}${fact.unit}` : ""}</b><p>{link.rationale}</p><small>{fact?.reportingPeriod} · {fact?.location} · 置信度 {fact?.confidence}/5 {document && <>· <a href={document.url} target="_blank" rel="noreferrer">查看来源 ↗</a></>}</small></div>
            </div>;
          })}</div> : <p className="missingEvidenceMessage">当前只有研究假设和领先指标，尚未连接财报、公告或政策原文，排名结果应降低信任。</p>}
        </article>)}
      </div>
    </section>

    {editor && <div className="modalBackdrop" onMouseDown={() => setEditor(false)}><form className="researchModal" onSubmit={save} onMouseDown={event => event.stopPropagation()}><header><div><p className="eyebrow">NEW DRIVER</p><h2>新增驱动因素</h2></div><button type="button" onClick={() => setEditor(false)}>×</button></header><div className="researchFormGrid">
      <label><span>因素名称</span><input name="name" required /></label><label><span>类别</span><select name="category"><option>政策</option><option>需求</option><option>产能</option><option>价格</option><option>技术</option><option>竞争</option><option>宏观</option><option>公司事件</option></select></label>
      <label><span>当前状态</span><select name="status"><option>预期</option><option>进行中</option><option>已发生</option><option>待验证</option></select></label><label><span>发生概率</span><input name="probability" type="number" min="0" max="100" defaultValue="50" /></label>
      <label><span>时间范围</span><select name="horizon"><option>短期</option><option>中期</option><option>长期</option></select></label><label><span>证据状态</span><select name="evidenceStatus"><option>待核验</option><option>部分核验</option><option>已确认</option></select></label>
      <label><span>影响对象类型</span><select name="targetType"><option>公司</option><option>产业链</option></select></label><label><span>影响对象</span><input name="targetKey" placeholder="股票代码或产业链名称" /></label>
      <label><span>影响方向</span><select name="direction"><option>利好</option><option>利空</option><option>不确定</option></select></label><label><span>影响强度</span><select name="strength">{[1,2,3,4,5].map(value=><option key={value}>{value}</option>)}</select></label>
    </div><label className="researchWide"><span>因素描述</span><textarea name="description" /></label><label className="researchWide"><span>影响机制</span><textarea name="transmission" /></label><label className="researchWide"><span>领先指标</span><input name="leadingIndicator" /></label><footer><button type="button" onClick={() => setEditor(false)}>取消</button><button className="primary">{saving ? "保存中…" : "保存驱动因素"}</button></footer></form></div>}
  </section>;
}
