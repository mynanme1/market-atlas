"use client";

import { FormEvent, useMemo, useState } from "react";
import { RelationGraph } from "./RelationGraph";

type Company = {
  id: number; name: string; ticker: string; market: string; sector: string;
  chain: string; position: string; summary: string; moat: string;
  catalyst: string; risk: string; color: string;
};
type Relation = { id: number; sourceId: number; targetId: number; type: string; note: string };
type Membership = { id: number; companyId: number; chainName: string; stage: string; stageOrder: number; role: string; strength: number; evidence: string; verifiedAt: string };
type Tag = { id: number; companyId: number; tagType: string; tagName: string; strength: number; evidence: string; verifiedAt: string };
type Exposure = { id: number; companyId: number; factor: string; direction: string; sensitivity: string; evidence: string; verifiedAt: string };
type ChainStage = { id: number; chainName: string; stageOrder: number; stageName: string; description: string };
type RelationMeta = { relationId: number; relationClass: string; confidence: number; strength: number; status: string; asOfDate: string; analystNote: string };
type EvidenceSource = { id: number; title: string; url: string; sourceType: string; publisher: string; publishedAt: string; accessedAt: string; excerpt: string };
type RelationEvidence = { id: number; relationId: number; evidenceId: number; supportLevel: string };
type Data = {
  companies: Company[]; relations: Relation[]; memberships?: Membership[]; tags?: Tag[]; exposures?: Exposure[];
  stages?: ChainStage[]; relationMeta?: RelationMeta[]; evidence?: EvidenceSource[]; relationEvidence?: RelationEvidence[];
};
type Mode = "industry" | "chain" | "cross" | "company";
type RelationCategory = "chain" | "competition" | "theme";

function category(relation: Relation): RelationCategory {
  if (/主题/.test(relation.type)) return "theme";
  if (/竞争|替代|对标/.test(relation.type)) return "competition";
  return "chain";
}

function summarize(data: Data) {
  const degree = new Map(data.companies.map(company => [company.id, 0]));
  data.relations.forEach(relation => {
    degree.set(relation.sourceId, (degree.get(relation.sourceId) ?? 0) + 1);
    degree.set(relation.targetId, (degree.get(relation.targetId) ?? 0) + 1);
  });
  const sorted = [...data.companies].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
  const topScore = degree.get(sorted[0]?.id) ?? 0;
  const critical = sorted.filter(company => (degree.get(company.id) ?? 0) === topScore).slice(0, 4);
  const chainCount = new Set(data.companies.map(company => company.chain)).size;
  const sectorCount = new Set(data.companies.map(company => company.sector)).size;
  return { critical, chainCount, sectorCount, topScore };
}

export function NetworkWorkspace({
  data,
  onSelect,
  onDataChange,
}: {
  data: Data;
  onSelect: (company: Company) => void;
  onDataChange: (data: Data) => void;
}) {
  const memberships = data.memberships ?? [];
  const chains = [...new Set(memberships.length ? memberships.map(item => item.chainName) : data.companies.map(company => company.chain))];
  const sectors = [...new Set(data.companies.map(company => company.sector))];
  const [mode, setMode] = useState<Mode>("industry");
  const [selectedChain, setSelectedChain] = useState(chains.includes("AI算力") ? "AI算力" : chains[0]);
  const [focusId, setFocusId] = useState(data.companies[0]?.id ?? 0);
  const [filters, setFilters] = useState({ chain: true, competition: false, theme: false });
  const [editor, setEditor] = useState<"relation" | "evidence" | null>(null);
  const [saving, setSaving] = useState(false);

  const enabledRelations = useMemo(() => data.relations.filter(relation => filters[category(relation)]), [data, filters]);

  const visible = useMemo<Data>(() => {
    if (mode === "chain") {
      const selectedMemberships = memberships.filter(item => item.chainName === selectedChain);
      const membershipByCompany = new Map(selectedMemberships.map(item => [item.companyId, item]));
      const companies = data.companies
        .filter(company => membershipByCompany.has(company.id))
        .map(company => ({ ...company, position: membershipByCompany.get(company.id)?.stage ?? company.position }));
      const ids = new Set(companies.map(company => company.id));
      return { companies, relations: enabledRelations.filter(relation => ids.has(relation.sourceId) && ids.has(relation.targetId)) };
    }
    if (mode === "company") {
      const neighborIds = new Set([focusId]);
      enabledRelations.forEach(relation => {
        if (relation.sourceId === focusId) neighborIds.add(relation.targetId);
        if (relation.targetId === focusId) neighborIds.add(relation.sourceId);
      });
      return {
        companies: data.companies.filter(company => neighborIds.has(company.id)),
        relations: enabledRelations.filter(relation => neighborIds.has(relation.sourceId) && neighborIds.has(relation.targetId)),
      };
    }
    if (mode === "cross") {
      const chainIndex = new Map(chains.map((chain, index) => [chain, index + 10001]));
      const sourceCompany = new Map(data.companies.map(company => [company.id, company]));
      const membershipsByCompany = new Map<number, string[]>();
      memberships.forEach(item => membershipsByCompany.set(item.companyId, [...(membershipsByCompany.get(item.companyId) ?? []), item.chainName]));
      const companies: Company[] = chains.map((chain, index) => ({
        id: index + 10001,
        name: chain,
        ticker: "",
        market: "",
        sector: "跨行业",
        chain,
        position: `${new Set(memberships.filter(item => item.chainName === chain).map(item => item.companyId)).size} 家公司`,
        summary: "",
        moat: "",
        catalyst: "",
        risk: "",
        color: ["#64b59f","#73a7d8","#d090e8","#efaa63","#91b66c","#8e91d8"][index % 6],
      }));
      const seen = new Set<string>();
      const relations: Relation[] = [];
      enabledRelations.forEach(relation => {
        const sourceChains = membershipsByCompany.get(relation.sourceId) ?? [sourceCompany.get(relation.sourceId)?.chain ?? ""];
        const targetChains = membershipsByCompany.get(relation.targetId) ?? [sourceCompany.get(relation.targetId)?.chain ?? ""];
        sourceChains.forEach(sourceChain => targetChains.forEach(targetChain => {
          if (!sourceChain || !targetChain || sourceChain === targetChain) return;
          const key = `${sourceChain}-${targetChain}-${category(relation)}`;
          if (seen.has(key)) return;
          seen.add(key);
          relations.push({
            id: relations.length + 50001,
            sourceId: chainIndex.get(sourceChain)!,
            targetId: chainIndex.get(targetChain)!,
            type: category(relation) === "chain" ? "跨链传导" : relation.type,
            note: `${sourceChain}与${targetChain}之间的代表性联系`,
          });
        }));
      });
      return { companies, relations };
    }
    return { companies: data.companies, relations: enabledRelations };
  }, [mode, data, enabledRelations, selectedChain, focusId, chains, memberships]);

  const insight = useMemo(() => summarize(visible), [visible]);
  const selectedStages = (data.stages ?? []).filter(stage => stage.chainName === selectedChain);

  async function saveResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/market", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, kind: editor }),
    });
    if (response.ok) {
      onDataChange(await response.json());
      setEditor(null);
    }
    setSaving(false);
  }

  return (
    <section className="networkPanel networkWorkspace">
      <div className="networkModes">
        {[
          ["industry","行业板块"],["chain","产业链地图"],["cross","跨链总图"],["company","公司中心图"],
        ].map(([key, label]) => <button key={key} className={mode === key ? "active" : ""} onClick={() => setMode(key as Mode)}>{label}</button>)}
      </div>

      <div className="networkControlBar">
        <div>
          <p className="eyebrow">RELATION LAYERS</p>
          <h3>{mode === "industry" ? "按行业板块浏览" : mode === "chain" ? `${selectedChain}产业链` : mode === "cross" ? "产业链之间的桥梁" : "单家公司关系展开"}</h3>
        </div>
        <div className="networkSelectors">
          <div className="researchActions"><button onClick={() => setEditor("relation")}>＋ 新增关系</button><button onClick={() => setEditor("evidence")}>＋ 添加证据</button></div>
          {mode === "chain" && <label><span>选择产业链</span><select value={selectedChain} onChange={event => setSelectedChain(event.target.value)}>{chains.map(chain => <option key={chain}>{chain}</option>)}</select></label>}
          {mode === "company" && <label><span>中心公司</span><select value={focusId} onChange={event => setFocusId(Number(event.target.value))}>{data.companies.map(company => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label>}
          {mode !== "industry" && <div className="relationToggles">
            {[["chain","上下游"],["competition","竞争/替代"],["theme","主题关联"]].map(([key, label]) => <label key={key}><input type="checkbox" checked={filters[key as keyof typeof filters]} onChange={() => setFilters(current => ({ ...current, [key]: !current[key as keyof typeof current] }))} />{label}</label>)}
          </div>}
        </div>
      </div>

      {mode === "chain" && <div className="stageTemplate">
        <div className="stageTemplateHead"><b>标准产业链模板</b><span>用于发现尚未覆盖的研究环节</span></div>
        <div className="stageTrack">{selectedStages.map(stage => {
          const members = memberships.filter(item => item.chainName === selectedChain && (
            item.stage.includes(stage.stageName) || stage.stageName.includes(item.stage) ||
            Math.abs(item.stageOrder - stage.stageOrder) === 0
          ));
          return <article className={members.length ? "covered" : "gap"} key={stage.id}><span>{String(stage.stageOrder).padStart(2,"0")}</span><b>{stage.stageName}</b><small>{members.length ? `${new Set(members.map(item => item.companyId)).size} 家公司` : "待补充"}</small><p>{stage.description}</p></article>;
        })}</div>
      </div>}

      {mode === "industry" ? (
        <div className="industryMap">
          {sectors.map(sector => {
            const companies = data.companies.filter(company => company.sector === sector);
            return <section key={sector}>
              <header><div><span>{String(companies.length).padStart(2,"0")}</span><h4>{sector}</h4></div><small>{new Set(companies.map(company => company.chain)).size} 条产业链</small></header>
              <div>{companies.map(company => <button key={company.id} onClick={() => onSelect(company)}><i style={{ background: company.color }} /><b>{company.name}</b><small>{company.position}</small></button>)}</div>
            </section>;
          })}
        </div>
      ) : (
        <>
          <RelationGraph companies={visible.companies} relations={visible.relations} onSelect={company => {
            const original = data.companies.find(item => item.id === company.id);
            if (original) onSelect(original);
          }} />
          <div className="relationList">{visible.relations.map(relation => {
            const source = visible.companies.find(company => company.id === relation.sourceId);
            const target = visible.companies.find(company => company.id === relation.targetId);
            const meta = data.relationMeta?.find(item => item.relationId === relation.id);
            const evidenceCount = data.relationEvidence?.filter(item => item.relationId === relation.id).length ?? 0;
            return <article key={relation.id}><b>{source?.name}</b><span>→ <em>{relation.type}</em> →</span><b>{target?.name}</b><small>{relation.note}</small>{meta && <div className="relationAudit"><i className={`confidence c${meta.confidence}`}>{meta.relationClass} · 置信度 {meta.confidence}/5</i><i>{meta.status}</i><i>{evidenceCount} 条证据</i></div>}</article>;
          })}</div>
        </>
      )}

      <section className="viewAnalysis">
        <div><p className="eyebrow">CURRENT VIEW</p><h3>当前视角的研究判断</h3></div>
        <div className="viewAnalysisGrid">
          <article><span>范围</span><b>{visible.companies.length}</b><p>家公司 · {mode === "industry" ? sectors.length : insight.sectorCount} 个行业</p></article>
          <article><span>结构</span><b>{mode === "industry" ? chains.length : insight.chainCount}</b><p>条产业链，当前仅分析可见范围</p></article>
          <article><span>关键节点</span><b className="names">{insight.critical.map(company => company.name).join("、") || "暂无"}</b><p>按当前视角的关系连接度识别</p></article>
          <article><span>解读边界</span><b className="names">{mode === "industry" ? "分类不代表业务往来" : filters.theme ? "已包含主题关系" : "仅看已开启关系"}</b><p>产业传导仍需公告、财报或订单证据验证</p></article>
        </div>
      </section>

      {editor && <div className="modalBackdrop" onMouseDown={() => setEditor(null)}><form className="researchModal" onSubmit={saveResearch} onMouseDown={event => event.stopPropagation()}>
        <header><div><p className="eyebrow">RESEARCH RECORD</p><h2>{editor === "relation" ? "新增公司关系" : "添加证据来源"}</h2></div><button type="button" onClick={() => setEditor(null)}>×</button></header>
        {editor === "relation" ? <>
          <div className="researchFormGrid">
            <label><span>源公司</span><select name="sourceId" required>{data.companies.map(company => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label>
            <label><span>目标公司</span><select name="targetId" required>{data.companies.map(company => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label>
            <label><span>关系类型</span><select name="type"><option>供应链</option><option>需求传导</option><option>产业传导</option><option>竞争关系</option><option>股权关系</option><option>主题关联</option></select></label>
            <label><span>关系性质</span><select name="relationClass"><option>业务关系</option><option>产业推断</option><option>竞争判断</option><option>主题假设</option></select></label>
            <label><span>置信度</span><select name="confidence">{[1,2,3,4,5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label>
            <label><span>关系强度</span><select name="strength">{[1,2,3,4,5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label>
            <label><span>核验状态</span><select name="status"><option>待核验</option><option>部分核验</option><option>已确认</option></select></label>
            <label><span>数据日期</span><input name="asOfDate" type="date" /></label>
          </div>
          <label className="researchWide"><span>关系说明</span><textarea name="note" /></label>
          <label className="researchWide"><span>分析备注</span><textarea name="analystNote" /></label>
        </> : <>
          <div className="researchFormGrid">
            <label><span>关联关系</span><select name="relationId" required>{data.relations.map(relation => {
              const source = data.companies.find(company => company.id === relation.sourceId)?.name;
              const target = data.companies.find(company => company.id === relation.targetId)?.name;
              return <option value={relation.id} key={relation.id}>{source} → {target}</option>;
            })}</select></label>
            <label><span>来源类型</span><select name="sourceType"><option>公司公告</option><option>年报/财报</option><option>官方网站</option><option>交易所披露</option><option>投资者交流</option><option>产业研究</option></select></label>
            <label><span>发布机构</span><input name="publisher" /></label>
            <label><span>发布日期</span><input name="publishedAt" type="date" /></label>
            <label><span>支持程度</span><select name="supportLevel"><option>直接支持</option><option>间接支持</option><option>存在冲突</option></select></label>
          </div>
          <label className="researchWide"><span>来源标题</span><input name="title" required /></label>
          <label className="researchWide"><span>来源链接</span><input name="url" type="url" /></label>
          <label className="researchWide"><span>证据摘要</span><textarea name="excerpt" /></label>
        </>}
        <footer><button type="button" onClick={() => setEditor(null)}>取消</button><button className="primary" disabled={saving}>{saving ? "保存中…" : "保存研究记录"}</button></footer>
      </form></div>}
    </section>
  );
}
