"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { RelationGraph } from "./RelationGraph";
import { NetworkWorkspace } from "./NetworkWorkspace";
import { AnalysisDashboard } from "./AnalysisDashboard";
import { DriverDashboard } from "./DriverDashboard";
import { EvidenceTemplateDashboard } from "./EvidenceTemplateDashboard";
import { PaperTradingDashboard } from "./PaperTradingDashboard";
import { ResearchWorkflowDashboard } from "./ResearchWorkflowDashboard";
import { FactorLabDashboard } from "./FactorLabDashboard";

type Company = {
  id: number; name: string; ticker: string; market: string; sector: string;
  chain: string; position: string; summary: string; moat: string;
  catalyst: string; risk: string; color: string;
};
type Relation = { id: number; sourceId: number; targetId: number; type: string; note: string };
type ChainMembership = { id: number; companyId: number; chainName: string; stage: string; stageOrder: number; role: string; strength: number; evidence: string; verifiedAt: string };
type CompanyTag = { id: number; companyId: number; tagType: string; tagName: string; strength: number; evidence: string; verifiedAt: string };
type MacroExposure = { id: number; companyId: number; factor: string; direction: string; sensitivity: string; evidence: string; verifiedAt: string };
type ChainStage = { id: number; chainName: string; stageOrder: number; stageName: string; description: string };
type RelationMeta = { relationId: number; relationClass: string; confidence: number; strength: number; status: string; asOfDate: string; analystNote: string };
type EvidenceSource = { id: number; title: string; url: string; sourceType: string; publisher: string; publishedAt: string; accessedAt: string; excerpt: string };
type RelationEvidence = { id: number; relationId: number; evidenceId: number; supportLevel: string };
type Driver = { id: number; name: string; category: string; description: string; status: string; probability: number; horizon: string; leadingIndicator: string; evidenceStatus: string; updatedAt: string };
type DriverImpact = { id: number; driverId: number; targetType: string; targetKey: string; direction: string; strength: number; transmission: string };
type Scenario = { id: number; name: string; probability: number; description: string; impactMultiplier: number };
type SourceDocument = { id: number; companyId: number; documentType: string; title: string; reportingPeriod: string; publicationDate: string; url: string; sourceTier: string; extractionStatus: string };
type ExtractedFact = { id: number; companyId: number; documentId: number; factType: string; label: string; valueText: string; unit: string; reportingPeriod: string; location: string; evidenceSummary: string; confidence: number; verifiedAt: string };
type DriverFactLink = { id: number; driverId: number; factId: number; stance: string; relevance: number; rationale: string };
type FactorMetric = { id:number; companyId:number; metric:string; value:number; unit:string; reportingPeriod:string; publishedAt:string; observedAt:string; sourceDocumentId:number; confidence:number; createdAt:string };
type Payload = {
  companies: Company[]; relations: Relation[]; memberships?: ChainMembership[]; tags?: CompanyTag[];
  exposures?: MacroExposure[]; stages?: ChainStage[]; relationMeta?: RelationMeta[];
  evidence?: EvidenceSource[]; relationEvidence?: RelationEvidence[]; drivers?: Driver[];
  driverImpacts?: DriverImpact[]; scenarios?: Scenario[];
  documents?: SourceDocument[]; facts?: ExtractedFact[];
  driverFactLinks?: DriverFactLink[];
  factorMetrics?: FactorMetric[];
};

const chainRelationWords = ["供应", "原料", "需求传导", "产业传导", "客户", "销售", "代工"];

function analyzeNetwork(data: Payload) {
  const isChain = (relation: Relation) => chainRelationWords.some(word => relation.type.includes(word));
  const chainRelations = data.relations.filter(isChain);
  const companyById = new Map(data.companies.map(company => [company.id, company]));
  const outgoing = new Map<number, Relation[]>();
  const incoming = new Map<number, Relation[]>();
  data.companies.forEach(company => { outgoing.set(company.id, []); incoming.set(company.id, []); });
  chainRelations.forEach(relation => {
    outgoing.get(relation.sourceId)?.push(relation);
    incoming.get(relation.targetId)?.push(relation);
  });

  const paths: number[][] = [];
  const sources = data.companies.filter(company => !(incoming.get(company.id)?.length));
  function walk(id: number, path: number[], visited: Set<number>) {
    const next = (outgoing.get(id) ?? []).filter(relation => !visited.has(relation.targetId));
    if (!next.length) {
      if (path.length > 1) paths.push(path);
      return;
    }
    next.forEach(relation => walk(
      relation.targetId,
      [...path, relation.targetId],
      new Set([...visited, relation.targetId]),
    ));
  }
  sources.forEach(company => walk(company.id, [company.id], new Set([company.id])));

  const ranked = data.companies
    .map(company => ({
      company,
      score: (incoming.get(company.id)?.length ?? 0) + (outgoing.get(company.id)?.length ?? 0),
    }))
    .sort((a, b) => b.score - a.score || a.company.id - b.company.id);
  const critical = ranked.filter(item => item.score === ranked[0]?.score).map(item => item.company);
  const bottlenecks = ranked.filter(item =>
    item.score > 1 || /认证|牌照|先进|技术|良率|资源|生态/.test(item.company.moat)
  ).slice(0, 3).map(item => item.company);
  const nonChain = data.relations.filter(relation => !isChain(relation));

  return {
    paths: paths.map(path => path.map(id => companyById.get(id)?.name).filter(Boolean).join(" → ")),
    critical,
    bottlenecks,
    nonChain,
  };
}

const seed: Payload = {
  companies: [
    { id: 1, name: "英伟达", ticker: "NVDA", market: "美股", sector: "信息技术", chain: "AI算力", position: "芯片设计", summary: "数据中心GPU与AI加速平台龙头", moat: "软硬件生态、CUDA与规模优势", catalyst: "云厂商资本开支、推理需求增长", risk: "出口限制、竞争与客户自研芯片", color: "#b9f36b" },
    { id: 2, name: "台积电", ticker: "TSM", market: "美股/台股", sector: "信息技术", chain: "半导体", position: "晶圆代工", summary: "全球先进制程晶圆代工核心厂商", moat: "先进制程、良率与客户认证", catalyst: "AI芯片需求与先进封装扩产", risk: "地缘政治、资本开支周期", color: "#6ee7d8" },
    { id: 3, name: "中际旭创", ticker: "300308", market: "A股", sector: "通信", chain: "AI算力", position: "光模块", summary: "高速光通信模块供应商", moat: "客户认证、量产能力与技术迭代", catalyst: "800G/1.6T升级与数据中心互联", risk: "产品降价、客户集中与技术路线变化", color: "#68a5ff" },
    { id: 4, name: "中国核电", ticker: "601985", market: "A股", sector: "公用事业", chain: "能源电力", position: "核电运营", summary: "核电项目开发、投资、建设与运营", moat: "牌照、资源禀赋和长期运营能力", catalyst: "新机组投产、电价与核准提速", risk: "建设延期、利用小时与政策变化", color: "#ffcb66" },
    { id: 5, name: "东方电气", ticker: "600875", market: "A股/H股", sector: "工业", chain: "核电设备", position: "主设备", summary: "能源装备制造与电站工程服务", moat: "大型装备技术与交付体系", catalyst: "核电核准、燃机与抽蓄订单", risk: "项目执行、原材料和回款周期", color: "#ff8f70" },
    { id: 6, name: "紫金矿业", ticker: "601899", market: "A股/H股", sector: "原材料", chain: "能源资源", position: "铜金资源", summary: "全球化铜金资源开发企业", moat: "资源储备、低成本开发与并购能力", catalyst: "铜金价格、项目放量", risk: "商品周期、海外运营与汇率", color: "#d993ff" },
  ],
  relations: [
    { id: 1, sourceId: 2, targetId: 1, type: "供应", note: "先进制程晶圆代工" },
    { id: 2, sourceId: 1, targetId: 3, type: "需求传导", note: "AI集群推动高速互联" },
    { id: 3, sourceId: 5, targetId: 4, type: "供应", note: "核电主设备与服务" },
    { id: 4, sourceId: 6, targetId: 5, type: "原料传导", note: "铜等工业金属成本影响" },
    { id: 5, sourceId: 4, targetId: 1, type: "主题关联", note: "AI数据中心长期电力需求" },
  ],
};

const blank = { name: "", ticker: "", market: "A股", sector: "信息技术", chain: "AI算力", position: "", summary: "", moat: "", catalyst: "", risk: "", color: "#b9f36b" };

export default function Home() {
  const [data, setData] = useState<Payload>(seed);
  const [view, setView] = useState<"overview" | "workflow" | "cards" | "network" | "analysis" | "factors" | "drivers" | "evidence" | "paper" | "chain">("workflow");
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("全部市场");
  const [selected, setSelected] = useState<Company | null>(seed.companies[0]);
  const [editing, setEditing] = useState<Partial<Company> | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/market").then(r => r.ok ? r.json() : Promise.reject()).then(setData).catch(() => setData(seed));
  }, []);

  const filtered = useMemo(() => data.companies.filter(c =>
    (market === "全部市场" || c.market.includes(market)) &&
    [c.name, c.ticker, c.sector, c.chain, c.position].join(" ").toLowerCase().includes(query.toLowerCase())
  ), [data, market, query]);
  const chains = [...new Set(data.companies.map(c => c.chain))];
  const markets = ["全部市场", "A股", "H股", "美股", "台股"];
  const networkAnalysis = useMemo(() => analyzeNetwork(data), [data]);

  async function saveCard(e: FormEvent) {
    e.preventDefault();
    if (!editing?.name || !editing?.ticker) return;
    const response = await fetch("/api/market", {
      method: editing.id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "company", ...editing })
    });
    if (response.ok) {
      const next = await response.json();
      setData(next); setEditing(null); setNotice("卡片已保存");
      setTimeout(() => setNotice(""), 1800);
    }
  }

  return (
    <main>
      <aside className="sidebar">
        <div className="brand"><span className="brandmark">M</span><div><b>市场图谱</b><small>MARKET ATLAS</small></div></div>
        <nav>
          {[
            ["workflow", "研究闭环", "◉"], ["overview", "数据总览", "⌁"], ["cards", "公司卡片", "▤"],
            ["network", "关系网络", "⌘"], ["analysis", "专业分析", "⌗"], ["factors", "因子实验室", "◇"], ["drivers", "驱动情景", "◒"], ["evidence", "证据模板", "▣"], ["paper", "研究模拟盘", "◎"]
          ].map(([key, label, icon]) => <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key as typeof view)}><i>{icon}</i>{label}</button>)}
        </nav>
        <div className="sidebarFoot">
          <div className="pulse"><span />数据工作区</div>
          <p>研究框架 v1.0</p>
        </div>
      </aside>

      <section className="workspace">
        <header>
          <div><p className="eyebrow">金融市场分析框架</p><h1>{view === "workflow" ? "研究闭环工作台" : view === "overview" ? "全局数据总览" : view === "cards" ? "公司研究卡片" : view === "network" ? "公司关系网络" : view === "analysis" ? "专业数据分析" : view === "factors" ? "财务与估值因子实验室" : view === "drivers" ? "驱动因素与情景分析" : view === "evidence" ? "公司证据与分析模板" : view === "paper" ? "基本面研究模拟盘" : "产业链地图"}</h1></div>
          <div className="headerActions">
            <label className="search"><span>⌕</span><input aria-label="搜索公司" placeholder="搜索公司、代码、行业…" value={query} onChange={e => setQuery(e.target.value)} /></label>
            <button className="primary" onClick={() => setEditing(blank)}>＋ 新建卡片</button>
          </div>
        </header>

        {view === "workflow" && <ResearchWorkflowDashboard data={data} onOpen={setView} />}

        {view === "overview" && <>
          <section className="hero">
            <div>
              <p className="eyebrow lime">MARKET INTELLIGENCE</p>
              <h2>从宏观变量，<br />追踪到每一家公司的利润。</h2>
              <p>用统一的卡片与关系网络，连接全球资产、行业分类、产业链和股权控制。</p>
            </div>
            <div className="heroOrbit">
              <div className="orbit o1" /><div className="orbit o2" />
              <div className="core">市场<br /><b>图谱</b></div>
              {["宏观", "产业链", "公司", "股权"].map((x, i) => <span key={x} className={`sat s${i + 1}`}>{x}</span>)}
            </div>
          </section>
          <section className="metrics">
            <article><span>覆盖公司</span><strong>{data.companies.length}</strong><em>家研究标的</em></article>
            <article><span>产业链</span><strong>{chains.length}</strong><em>条核心链路</em></article>
            <article><span>关系记录</span><strong>{data.relations.length}</strong><em>条业务与资本关联</em></article>
            <article><span>覆盖市场</span><strong>{new Set(data.companies.flatMap(c => c.market.split("/"))).size}</strong><em>个全球市场</em></article>
          </section>
          <div className="grid2">
            <section className="panel">
              <div className="panelHead"><div><p className="eyebrow">CHAIN SIGNALS</p><h3>核心产业链分布</h3></div><button onClick={() => setView("network")}>查看网络 →</button></div>
              <div className="bars">{chains.map((x, i) => { const count = data.companies.filter(c => c.chain === x).length; return <div className="barRow" key={x}><label>{x}</label><div><span style={{ width: `${Math.max(18, count / data.companies.length * 100)}%`, background: ["#b9f36b", "#6ee7d8", "#68a5ff", "#ffcb66", "#d993ff"][i % 5] }} /></div><b>{count}</b></div> })}</div>
            </section>
            <section className="panel">
              <div className="panelHead"><div><p className="eyebrow">RECENT CARDS</p><h3>重点观察</h3></div><button onClick={() => setView("cards")}>全部卡片 →</button></div>
              <div className="watchlist">{data.companies.slice(0, 4).map(c => <button key={c.id} onClick={() => { setSelected(c); setView("cards"); }}><span className="dot" style={{ background: c.color }} /><div><b>{c.name}</b><small>{c.ticker} · {c.market}</small></div><em>{c.position}</em></button>)}</div>
            </section>
          </div>
        </>}

        {view === "cards" && <section>
          <div className="toolbar"><div className="chips">{markets.map(x => <button key={x} className={market === x ? "selected" : ""} onClick={() => setMarket(x)}>{x}</button>)}</div><span>{filtered.length} 张卡片</span></div>
          <div className="cardsLayout">
            <div className="cardGrid">{filtered.map(c => <button className={`companyCard ${selected?.id === c.id ? "chosen" : ""}`} key={c.id} onClick={() => setSelected(c)}>
              <div className="cardTop"><span className="ticker" style={{ borderColor: c.color, color: c.color }}>{c.ticker}</span><em>{c.market}</em></div>
              <h3>{c.name}</h3><p>{c.summary}</p>
              <div className="tags"><span>{c.chain}</span><span>{c.position}</span></div>
              <footer><small>{c.sector}</small><b>查看详情 ↗</b></footer>
            </button>)}</div>
            {selected && <aside className="detail">
              <button className="closeDetail" onClick={() => setSelected(null)}>×</button>
              <p className="eyebrow">COMPANY PROFILE</p><h2>{selected.name}</h2><div className="identity"><b>{selected.ticker}</b><span>{selected.market}</span><span>{selected.sector}</span></div>
              <p className="summary">{selected.summary}</p>
              {[["产业位置", `${selected.chain} · ${selected.position}`], ["核心护城河", selected.moat], ["潜在催化剂", selected.catalyst], ["主要风险", selected.risk]].map(([a,b], i) => <div className={`fact f${i}`} key={a}><span>{a}</span><p>{b}</p></div>)}
              {(data.memberships?.some(item => item.companyId === selected.id) || data.tags?.some(item => item.companyId === selected.id) || data.exposures?.some(item => item.companyId === selected.id)) && <div className="dimensionPanel">
                <h3>多维市场归属</h3>
                {!!data.memberships?.filter(item => item.companyId === selected.id).length && <div><span>产业链</span><section>{data.memberships.filter(item => item.companyId === selected.id).map(item => <em key={item.id}>{item.chainName} · {item.stage}</em>)}</section></div>}
                {!!data.tags?.filter(item => item.companyId === selected.id).length && <div><span>概念与风格</span><section>{data.tags.filter(item => item.companyId === selected.id).map(item => <em key={item.id}>{item.tagName}</em>)}</section></div>}
                {!!data.exposures?.filter(item => item.companyId === selected.id).length && <div><span>宏观暴露</span><section>{data.exposures.filter(item => item.companyId === selected.id).map(item => <em key={item.id}>{item.factor} · {item.direction}</em>)}</section></div>}
              </div>}
              <button className="editBtn" onClick={() => setEditing(selected)}>编辑这张卡片</button>
            </aside>}
          </div>
        </section>}

        {view === "network" && <NetworkWorkspace data={data} onDataChange={setData} onSelect={company => { setSelected(company); setView("cards"); }} />}

        {view === "analysis" && <AnalysisDashboard data={data} />}

        {view === "factors" && <FactorLabDashboard data={data} onDataChange={next=>setData(next as Payload)} />}

        {view === "drivers" && <DriverDashboard data={data} onDataChange={next => setData(next as unknown as Payload)} />}

        {view === "evidence" && <EvidenceTemplateDashboard data={data} />}

        {view === "paper" && <PaperTradingDashboard data={data} />}

        {view === "network" && false && <section className="networkPanel">
          <div className="panelHead"><div><p className="eyebrow">RELATION GRAPH</p><h3>业务与资本关系</h3></div><div className="legend"><span><i className="lg supply" />供应</span><span><i className="lg theme" />主题关联</span></div></div>
          <RelationGraph
            companies={data.companies}
            relations={data.relations}
            onSelect={company => { setSelected(company as Company); setView("cards"); }}
          />
          <div className="relationList">{data.relations.map(r => { const s = data.companies.find(c => c.id === r.sourceId); const t = data.companies.find(c => c.id === r.targetId); return <article key={r.id}><b>{s?.name}</b><span>→ <em>{r.type}</em> →</span><b>{t?.name}</b><small>{r.note}</small></article> })}</div>
          <section className="analysisBlock">
            <div className="analysisTitle">
              <div><p className="eyebrow">GRAPH INTERPRETATION</p><h3>图谱分析与研究判断</h3></div>
              <span>基于当前 {data.companies.length} 家公司与 {data.relations.length} 条关系</span>
            </div>
            <div className="analysisGrid">
              <article className="analysisCard chainInsight">
                <header><span>01</span><div><small>主干识别</small><h4>当前存在 {networkAnalysis.paths.length} 条产业链路径</h4></div></header>
                <div className="pathList">
                  {networkAnalysis.paths.map(path => <p key={path}>{path}</p>)}
                </div>
                <footer>判断：主干关系应优先用业务订单、供应商披露和收入来源验证。</footer>
              </article>
              <article className="analysisCard">
                <header><span>02</span><div><small>关键节点</small><h4>{networkAnalysis.critical.map(company => company.name).join("、") || "尚未识别"}</h4></div></header>
                <p>这些公司连接的上下游关系最多，是当前图谱中的传导枢纽。其订单、产能或资本开支变化更容易影响相邻环节。</p>
                <footer>指标：上下游连接度，而非股价涨跌相关性。</footer>
              </article>
              <article className="analysisCard">
                <header><span>03</span><div><small>利润与瓶颈</small><h4>{networkAnalysis.bottlenecks.map(company => company.name).join("、")}</h4></div></header>
                <p>上述节点同时具备较高连接度或牌照、认证、先进制程、资源禀赋等壁垒，更可能在需求扩张时保留议价权。</p>
                <footer>继续验证：产能利用率、客户集中度、价格与毛利率变化。</footer>
              </article>
              <article className="analysisCard warningInsight">
                <header><span>04</span><div><small>关系辨析</small><h4>{networkAnalysis.nonChain.length} 条非业务主干关系</h4></div></header>
                <p>{networkAnalysis.nonChain.length ? networkAnalysis.nonChain.map(relation => {
                  const source = data.companies.find(company => company.id === relation.sourceId)?.name;
                  const target = data.companies.find(company => company.id === relation.targetId)?.name;
                  return `${source}与${target}的“${relation.type}”`;
                }).join("；") : "暂无主题、股权或竞争关系"}。</p>
                <footer>注意：主题联动只说明共同驱动，不代表存在订单、持股或利润转移。</footer>
              </article>
            </div>
            <div className="researchQuestions">
              <b>下一步应回答</b>
              <span>需求增长最先落在哪个环节？</span>
              <span>谁拥有定价权，谁只能被动承受成本？</span>
              <span>关键关系是否有公告或财报证据？</span>
              <span>若核心节点受限，是否存在替代供应商？</span>
            </div>
          </section>
        </section>}

        {view === "chain" && <section>
          <div className="chainIntro"><p className="eyebrow">VALUE CHAIN</p><h2>利润沿产业链如何传递？</h2><p>从资源与设备出发，穿过制造和基础设施，最终抵达运营与应用端。</p></div>
          <div className="chainFlow">
            {[
              ["上游资源与设备", ["紫金矿业", "东方电气"], "供给、产能与成本"],
              ["核心制造环节", ["台积电", "英伟达"], "技术、良率与议价权"],
              ["基础设施", ["中际旭创"], "网络、数据中心与电网"],
              ["运营与应用", ["中国核电"], "需求、利用率与商业化"],
            ].map((stage, i) => <article key={stage[0]}><header><span>0{i+1}</span><h3>{stage[0]}</h3></header><p>{stage[2]}</p><div>{(stage[1] as string[]).map(name => { const c = data.companies.find(x => x.name === name); return <button key={name} onClick={() => { if(c) setSelected(c); setView("cards"); }}><i style={{ background: c?.color }} />{name}<small>{c?.position}</small></button> })}</div></article>)}
          </div>
          <div className="chainNote"><b>分析提示</b><p>需求增长不等于所有环节同时受益。优先寻找技术壁垒高、产能紧张、客户认证周期长且议价权强的节点。</p></div>
        </section>}
      </section>

      {editing && <div className="modalBackdrop" onMouseDown={() => setEditing(null)}><form className="modal" onSubmit={saveCard} onMouseDown={e => e.stopPropagation()}>
        <div className="modalHead"><div><p className="eyebrow">RESEARCH CARD</p><h2>{editing.id ? "编辑公司卡片" : "新建公司卡片"}</h2></div><button type="button" onClick={() => setEditing(null)}>×</button></div>
        <div className="formGrid">
          {[["name","公司名称"],["ticker","股票代码"],["market","交易市场"],["sector","所属行业"],["chain","产业链"],["position","产业位置"]].map(([key,label]) => <label key={key}><span>{label}</span><input required={key === "name" || key === "ticker"} value={(editing as Record<string,string>)[key] ?? ""} onChange={e => setEditing({...editing,[key]:e.target.value})} /></label>)}
        </div>
        {[["summary","主营业务 / 一句话结论"],["moat","核心护城河"],["catalyst","潜在催化剂"],["risk","主要风险"]].map(([key,label]) => <label className="wide" key={key}><span>{label}</span><textarea value={(editing as Record<string,string>)[key] ?? ""} onChange={e => setEditing({...editing,[key]:e.target.value})} /></label>)}
        <footer><button type="button" onClick={() => setEditing(null)}>取消</button><button className="primary" type="submit">保存卡片</button></footer>
      </form></div>}
      {notice && <div className="toast">✓ {notice}</div>}
    </main>
  );
}
