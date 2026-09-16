"use client";

import { FormEvent, lazy, Suspense, useEffect, useState } from "react";
import type { Company, Payload } from "./workspace/model";
import { sections, defaultRoute, parseRoute, formatRoute } from "./workspace/navigation.mjs";
import { TodayWorkspace, type PortfolioSnapshot } from "./workspace/TodayWorkspace";
import { ResearchCenter } from "./workspace/ResearchCenter";
import { StrategyWorkspace } from "./workspace/StrategyWorkspace";
import "./workspace/workspace.css";

const Network = lazy(()=>import("./NetworkWorkspace").then(m=>({default:m.NetworkWorkspace})));
const Analysis = lazy(()=>import("./AnalysisDashboard").then(m=>({default:m.AnalysisDashboard})));
const Drivers = lazy(()=>import("./DriverDashboard").then(m=>({default:m.DriverDashboard})));
const Evidence = lazy(()=>import("./EvidenceTemplateDashboard").then(m=>({default:m.EvidenceTemplateDashboard})));
const Portfolio = lazy(()=>import("./PaperTradingDashboard").then(m=>({default:m.PaperTradingDashboard})));
const blank: Partial<Company> = {name:"",ticker:"",market:"A股",sector:"",chain:"",position:"",summary:"",moat:"",catalyst:"",risk:"",color:"#5f9279"};

export default function Home() {
  const [data,setData]=useState<Payload|null>(null);
  const [error,setError]=useState("");
  const [route,setRoute]=useState(defaultRoute);
  const [editing,setEditing]=useState<Partial<Company>|null>(null);
  const [notice,setNotice]=useState("");
  const [saving,setSaving]=useState(false);
  const [paper,setPaper]=useState<PortfolioSnapshot|null>(null);
  const [paperError,setPaperError]=useState("");
  useEffect(()=>{
    const sync=()=>setRoute(parseRoute(window.location.hash)); sync();
    window.addEventListener("hashchange",sync); return ()=>window.removeEventListener("hashchange",sync);
  },[]);
  useEffect(()=>{ let active=true;
    fetch("/api/market").then(async response=>{if(!response.ok)throw new Error("研究数据读取失败（"+response.status+"）");return response.json();}).then(payload=>{if(!Array.isArray(payload.companies)||!Array.isArray(payload.relations))throw new Error("研究数据格式异常");if(active)setData(payload);}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{if(route.view!=="today"&&!(route.view==="research"&&route.detail==="activity"))return;let active=true;
    fetch("/api/paper").then(async response=>{if(!response.ok)throw new Error("模拟记录暂时无法读取");return response.json();}).then(payload=>{if(active){setPaper(payload);setPaperError("");}}).catch(e=>{if(active){setPaper(null);setPaperError(e.message);}});
    return ()=>{active=false;};
  },[route.view,route.detail]);
  function navigate(patch:Partial<typeof defaultRoute>) { const next={...route,...patch}; setRoute(next);window.location.hash=formatRoute(next); }
  function openResearch(company=route.company,detail="overview") {navigate({view:"research",research:"companies",company,detail});}
  async function saveCard(event:FormEvent) {
    event.preventDefault(); if(!editing?.name?.trim()||!editing?.ticker?.trim()||saving)return;
    setSaving(true);setNotice("");
    try {const response=await fetch("/api/market",{method:editing.id?"PUT":"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"company",...editing})});if(!response.ok)throw new Error("保存失败，原数据未替换，请重试");const next=await response.json();setData(next);setEditing(null);setNotice("卡片已保存");}
    catch(e){setNotice(e instanceof Error?e.message:"保存失败");}finally{setSaving(false);}
  }
  const current=sections.find(s=>s.id===route.view)??sections[0];
  return <main className="ma-shell">
    <aside className="ma-sidebar"><div className="ma-brand"><span>M</span><div><b>市场图谱</b><small>MARKET ATLAS</small></div></div><nav aria-label="主导航">{sections.map((s,i)=><button key={s.id} aria-current={route.view===s.id?"page":undefined} onClick={()=>navigate({view:s.id})}><span className="ma-nav-number">0{i+1}</span><span><b>{s.label}</b><small>{s.hint}</small></span></button>)}</nav><div className="ma-sidebar-footer"><b>本地研究工作区</b><p>研究 · 验证 · 复盘</p><small>模拟交易，不连接真实资金</small></div></aside>
    <section className="ma-workspace"><header className="ma-page-head"><div><p className="ma-kicker">MARKET ATLAS / {String(sections.indexOf(current)+1).padStart(2,"0")}</p><h1>{current.label}</h1><p>{current.hint}</p></div><button className="primary" disabled={!data} onClick={()=>setEditing({...blank})}>＋ 新建公司卡片</button></header>
    {!data&&<section className="ma-panel" role={error?"alert":"status"}><h2>{error?"无法读取本地数据":"正在载入研究工作区…"}</h2><p>{error||"正在连接本地数据库，不加载虚构示例数据。"}</p>{error&&<button onClick={()=>window.location.reload()}>重新连接</button>}</section>}
    {data&&<Suspense fallback={<p className="ma-empty" role="status">正在载入工作区…</p>}>
      {route.view==="today"&&<TodayWorkspace data={data} paper={paper} paperError={paperError} onResearch={openResearch} onPortfolio={()=>navigate({view:"portfolio"})} onStrategy={()=>navigate({view:"strategy"})} />}
      {route.view==="research"&&<div className="ma-stack"><div className="ma-tabs" aria-label="研究中心内容">{[["companies","公司研究"],["network","行业与产业链"],["drivers","驱动与情景"],["analysis","专业分析"],["evidence","证据模板工具"]].map(([id,label])=><button key={id} aria-pressed={route.research===id} onClick={()=>navigate({research:id})}>{label}</button>)}</div>
        {route.research==="companies"&&<ResearchCenter data={data} companyId={route.company} detail={route.detail} onSelect={company=>navigate({company})} onDetail={detail=>navigate({detail})} onEdit={setEditing} onPortfolio={()=>navigate({view:"portfolio",company:route.company||data.companies[0]?.id||0})} paper={paper} paperError={paperError} />}
        {route.research==="network"&&<Network data={data} onDataChange={setData} onSelect={company=>openResearch(company.id)} />}
        {route.research==="drivers"&&<Drivers data={data} onDataChange={next=>setData(next as unknown as Payload)} />}
        {route.research==="analysis"&&<Analysis data={data} />}
        {route.research==="evidence"&&<><div className="ma-note">这里保留专题证据模板与维护工具。查看任意公司的原始资料，请返回“公司研究 → 证据与资料”。</div><Evidence data={data} /></>}
      </div>}
      {route.view==="strategy"&&<StrategyWorkspace data={data} tab={route.lab} archive={route.archive} onTab={lab=>navigate({lab})} onArchive={archive=>navigate({archive})} onDataChange={setData} onPortfolio={()=>navigate({view:"portfolio"})} />}
      {route.view==="portfolio"&&<Portfolio data={data} initialCompanyId={route.company||undefined} />}
    </Suspense>}
    </section>
      {editing && <div className="modalBackdrop" onMouseDown={() => setEditing(null)}><form className="modal" aria-label="公司卡片编辑" onSubmit={saveCard} onMouseDown={e => e.stopPropagation()}>
        <div className="modalHead"><div><p className="eyebrow">RESEARCH CARD</p><h2>{editing.id ? "编辑公司卡片" : "新建公司卡片"}</h2></div><button type="button" onClick={() => setEditing(null)}>×</button></div>
        <div className="formGrid">
          {[["name","公司名称"],["ticker","股票代码"],["market","交易市场"],["sector","所属行业"],["chain","产业链"],["position","产业位置"]].map(([key,label]) => <label key={key}><span>{label}</span><input required={key === "name" || key === "ticker"} value={(editing as Record<string,string>)[key] ?? ""} onChange={e => setEditing({...editing,[key]:e.target.value})} /></label>)}
        </div>
        {[["summary","主营业务 / 一句话结论"],["moat","核心护城河"],["catalyst","潜在催化剂"],["risk","主要风险"]].map(([key,label]) => <label className="wide" key={key}><span>{label}</span><textarea value={(editing as Record<string,string>)[key] ?? ""} onChange={e => setEditing({...editing,[key]:e.target.value})} /></label>)}
        <footer><button type="button" onClick={() => setEditing(null)}>取消</button><button className="primary" type="submit" disabled={saving}>{saving?"保存中…":"保存卡片"}</button></footer>
      </form></div>}

    {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="关闭通知"> ×</button></div>}
  </main>;
}
