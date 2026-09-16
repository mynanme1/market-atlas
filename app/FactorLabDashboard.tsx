"use client";

import { FormEvent, useMemo, useState } from "react";

type Company = { id:number; name:string; ticker:string; market:string };
type Metric = { id:number; companyId:number; metric:string; value:number; unit:string; reportingPeriod:string; publishedAt:string; observedAt:string; sourceDocumentId:number; confidence:number };
type Document = { id:number; companyId:number; title:string; publicationDate:string; sourceTier:string };
type Data = { companies:Company[]; factorMetrics?:Metric[]; documents?:Document[] };

const required = [
  ["roe", "ROE", "质量"], ["roic", "ROIC", "质量"], ["debt_to_equity", "资产负债率", "质量"], ["earnings_variability", "盈利波动率", "质量"],
  ["pe", "市盈率 PE", "价值"], ["pb", "市净率 PB", "价值"], ["ev_ebitda", "EV/EBITDA", "价值"], ["fcf_yield", "自由现金流收益率", "价值"],
] as const;

export function FactorLabDashboard({ data, onDataChange }:{ data:Data; onDataChange:(data:Data)=>void }) {
  const metrics = data.factorMetrics ?? [];
  const documents = data.documents ?? [];
  const [editor, setEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(data.companies[0]?.id ?? 0);

  const analysis = useMemo(() => {
    const today = new Date();
    const usable = metrics.filter(metric => metric.publishedAt && metric.observedAt && metric.sourceDocumentId && metric.confidence >= 4 && new Date(metric.publishedAt) <= new Date(metric.observedAt));
    const coverage = required.map(([key, label, family]) => {
      const count = new Set(usable.filter(metric => metric.metric === key).map(metric => metric.companyId)).size;
      return { key, label, family, count, rate:data.companies.length ? count / data.companies.length : 0 };
    });
    const eligible = data.companies.map(company => {
      const rows = usable.filter(metric => metric.companyId === company.id);
      const fields = new Set(rows.map(metric => metric.metric));
      const quality = ["roe", "roic", "debt_to_equity"].filter(key => fields.has(key)).length;
      const value = ["pe", "pb", "fcf_yield"].filter(key => fields.has(key)).length;
      const latest = rows.map(row => row.observedAt).sort().at(-1) ?? "";
      const age = latest ? Math.floor((today.getTime() - new Date(latest).getTime()) / 86400000) : 9999;
      return { company, quality, value, latest, age, ready:quality >= 2 && value >= 2 && age <= 120 };
    });
    return { usable, coverage, eligible, ready:eligible.filter(item => item.ready).length };
  }, [metrics, data.companies]);

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/market", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ ...values, kind:"factorMetric" }) });
      const result = await response.json() as Data & { error?:string };
      if (!response.ok) throw new Error(result.error ?? "保存失败，请检查输入内容");
      onDataChange(result);
      setEditor(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  const qualityCoverage = analysis.coverage.filter(item => item.family === "质量").reduce((sum, item) => sum + item.rate, 0) / 4;
  const valueCoverage = analysis.coverage.filter(item => item.family === "价值").reduce((sum, item) => sum + item.rate, 0) / 4;

  return <section className="factorLab">
    <section className="factorHero"><div><p className="eyebrow">POINT-IN-TIME FACTOR LAB</p><h2>财务与估值因子实验室</h2><p>只允许在公开日期之后使用财务指标，防止用今天知道的数据回测过去。所有因子必须能追溯到原始文件。</p></div><button onClick={() => { setError(""); setEditor(true); }}>＋ 录入时点指标</button></section>
    <div className="factorStats">
      <article><span>有效时点记录</span><b>{analysis.usable.length}</b><p>有来源、公开日期且置信度不低于 4</p></article>
      <article><span>可进入因子回测</span><b>{analysis.ready}</b><p>{data.companies.length} 家公司中的合格数量</p></article>
      <article><span>质量因子覆盖</span><b>{Math.round(qualityCoverage * 100)}%</b><p>ROE、ROIC、杠杆与盈利稳定性</p></article>
      <article><span>价值因子覆盖</span><b>{Math.round(valueCoverage * 100)}%</b><p>PE、PB、EV/EBITDA 与 FCF 收益率</p></article>
    </div>
    <div className="factorGrid">
      <section className="factorCoverage"><header><div><p className="eyebrow">COVERAGE</p><h3>指标覆盖矩阵</h3></div><span>达到 80% 后再做横向排序</span></header>{analysis.coverage.map(item => <article key={item.key}><div><b>{item.label}</b><small>{item.family}</small></div><i><em style={{ width:`${item.rate * 100}%` }} /></i><strong>{item.count}/{data.companies.length}</strong></article>)}</section>
      <section className="backtestGate"><header><div><p className="eyebrow">BACKTEST GATE</p><h3>回测准入</h3></div><span>{analysis.ready ? "部分可用" : "尚未通过"}</span></header>{analysis.eligible.slice(0, 12).map(item => <article key={item.company.id}><div><b>{item.company.name}</b><small>{item.company.ticker} · 最近观察 {item.latest || "—"}</small></div><span>质量 {item.quality}/3</span><span>价值 {item.value}/3</span><strong className={item.ready ? "positive" : "negative"}>{item.ready ? "可回测" : "缺数据"}</strong></article>)}</section>
    </div>
    <section className="factorRules"><b>仅限制因子回测，不限制驱动策略参与</b><span>发布日期 ≤ 观察日</span><span>至少 2 项质量指标</span><span>至少 2 项价值指标</span><span>数据不超过 120 日</span><span>置信度 ≥ 4/5</span><span>缺少因子数据时仍可建立试探仓</span></section>
    {editor && <div className="modalBackdrop" onMouseDown={() => setEditor(false)}><form className="researchModal" onSubmit={save} onMouseDown={event => event.stopPropagation()}><header><div><p className="eyebrow">POINT-IN-TIME RECORD</p><h2>录入财务或估值指标</h2></div><button type="button" onClick={() => setEditor(false)}>×</button></header><div className="researchFormGrid">
      <label><span>公司</span><select name="companyId" value={selectedCompany} onChange={event => setSelectedCompany(Number(event.target.value))}>{data.companies.map(company => <option key={company.id} value={company.id}>{company.name} · {company.ticker}</option>)}</select></label>
      <label><span>指标</span><select name="metric">{required.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label><span>数值</span><input name="value" type="number" step="any" required /></label><label><span>单位</span><input name="unit" placeholder="%、倍或小数" /></label>
      <label><span>报告期</span><input name="reportingPeriod" placeholder="2026Q2" required /></label><label><span>公开日期</span><input name="publishedAt" type="date" required /></label>
      <label><span>观察日期</span><input name="observedAt" type="date" required /></label><label><span>置信度</span><select name="confidence"><option>5</option><option>4</option><option>3</option></select></label>
      <label><span>原始文件</span><select name="sourceDocumentId" required><option value="">请选择</option>{documents.filter(document => document.companyId === selectedCompany).map(document => <option value={document.id} key={document.id}>{document.title}</option>)}</select></label>
    </div>{error && <p className="formError">{error}</p>}<footer><button type="button" onClick={() => setEditor(false)}>取消</button><button className="primary" disabled={saving}>{saving ? "保存中…" : "保存时点指标"}</button></footer></form></div>}
  </section>;
}
