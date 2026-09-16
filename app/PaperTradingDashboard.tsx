"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Company = { id: number; name: string; ticker: string; market: string; sector: string; chain: string; position?:string; color: string };
type Driver = { id: number; name: string; probability: number; category: string };
type Impact = { id: number; driverId: number; targetType: string; targetKey: string; direction: string; strength: number };
type Fact = { id: number; companyId: number; documentId?:number; factType?:string; confidence?:number; label?:string; valueText?:string; evidenceSummary?:string; reportingPeriod?:string };
type DriverFactLink = { id: number; driverId: number; factId: number; relevance?:number; stance?:string };
type SourceDocument = { id:number; companyId:number; title:string; documentType:string; publicationDate:string; url?:string; sourceTier:string };
type ResearchData = {
  companies: Company[]; drivers?: Driver[]; driverImpacts?: Impact[];
  facts?: Fact[]; driverFactLinks?: DriverFactLink[]; documents?:SourceDocument[];
};
type PaperAccount = { id: number; name: string; baseCurrency: string; initialCash: number; cash: number; commissionBps: number; slippageBps: number };
type Quote = { id: number; companyId: number; symbol: string; price: number; currency: string; fxToCny: number; priceCny: number; priceDate: string; source: string; capturedAt: string };
type Position = { id: number; companyId: number; quantity: number; avgCostCny: number; lastPriceCny: number; priceDate: string; name: string; ticker: string; market: string; color: string };
type Order = { id: number; companyId: number; side: string; quantity: number; signalDate: string; signalPriceCny: number; status: string; submittedAt: string; filledAt: string; filledPriceCny: number; fees: number; rationale: string; driverName: string; name: string; ticker: string };
type Nav = { id: number; snapshotDate: string; cash: number; marketValue: number; totalValue: number };
type ResearchSnapshot = { id:number; orderId:number; companyId:number; snapshotDate:string; researchScore:number; evidenceCoverage:number; benchmarkSymbol:string; horizon:string; invalidation:string; thesis:string };
type PaperData = { account?: PaperAccount; positions: Position[]; orders: Order[]; quotes: Quote[]; nav: Nav[]; snapshots?:ResearchSnapshot[]; refresh?: { updated: number; failed: number } };
type MarketIndex = { symbol: string; name: string; market: string; price: number; previousClose: number; change: number; changePercent: number; high: number; low: number; quoteTime: string; currency: string };
type KlineBar = { date: string; open: number; close: number; high: number; low: number; volume: number };
type TimingSnapshot = { latest:number; ma20:number; return60:number; date:string };
import { strategyRules } from "./workspace/strategyRules";

const emptyPaper: PaperData = { positions: [], orders: [], quotes: [], nav: [] };
const money = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

function sourceWeight(document?: SourceDocument) {
  const tier=document?.sourceTier??"";
  if(tier.startsWith("A")||tier.includes("一级")||tier.includes("法定披露")||tier.includes("交易所")) return 1;
  if(tier.includes("二级")||tier.includes("公司官方")) return .85;
  return .65;
}

function CandlestickChart({ bars }: { bars: KlineBar[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bars.length) return;
    const draw = () => {
      const width = canvas.clientWidth;
      const height = 380;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width*dpr; canvas.height = height*dpr;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(dpr,dpr); context.clearRect(0,0,width,height);
      const pad = { left:12,right:70,top:18,bottom:27 };
      const priceHeight = 255, volumeTop = 295, volumeHeight = 55;
      const plotWidth = width-pad.left-pad.right;
      const highest = Math.max(...bars.map(bar => bar.high));
      const lowest = Math.min(...bars.map(bar => bar.low));
      const range = Math.max(.0001,highest-lowest);
      const maxVolume = Math.max(...bars.map(bar => bar.volume),1);
      const xStep = plotWidth/bars.length;
      const y = (price:number) => pad.top+(highest-price)/range*priceHeight;
      context.font = "11px sans-serif"; context.textAlign = "left";
      for (let index=0; index<=5; index++) {
        const lineY = pad.top+priceHeight/5*index;
        context.strokeStyle="#e8ede9"; context.lineWidth=1; context.beginPath(); context.moveTo(pad.left,lineY); context.lineTo(width-pad.right,lineY); context.stroke();
        context.fillStyle="#75847c"; context.fillText((highest-range/5*index).toFixed(2),width-pad.right+8,lineY+4);
      }
      bars.forEach((bar,index) => {
        const center = pad.left+xStep*(index+.5);
        const up = bar.close>=bar.open;
        const color = up ? "#c85d4b" : "#3e8a62";
        context.strokeStyle=color; context.fillStyle=color; context.lineWidth=1;
        context.beginPath(); context.moveTo(center,y(bar.high)); context.lineTo(center,y(bar.low)); context.stroke();
        const bodyTop=Math.min(y(bar.open),y(bar.close)); const bodyHeight=Math.max(1.2,Math.abs(y(bar.open)-y(bar.close)));
        const candleWidth=Math.max(1,Math.min(8,xStep*.62));
        if(up){context.strokeRect(center-candleWidth/2,bodyTop,candleWidth,bodyHeight)}else{context.fillRect(center-candleWidth/2,bodyTop,candleWidth,bodyHeight)}
        const volumeHeightPx=bar.volume/maxVolume*volumeHeight;
        context.globalAlpha=.52; context.fillRect(center-candleWidth/2,volumeTop+volumeHeight-volumeHeightPx,candleWidth,volumeHeightPx); context.globalAlpha=1;
      });
      const drawMa = (period:number,color:string) => {
        context.strokeStyle=color; context.lineWidth=1.4; context.beginPath(); let started=false;
        bars.forEach((bar,index) => { if(index<period-1)return; const average=bars.slice(index-period+1,index+1).reduce((sum,item)=>sum+item.close,0)/period; const px=pad.left+xStep*(index+.5); const py=y(average); if(!started){context.moveTo(px,py);started=true}else context.lineTo(px,py) }); context.stroke();
      };
      drawMa(5,"#c48b36"); drawMa(20,"#547ea0");
      context.fillStyle="#c48b36"; context.fillText("MA5",pad.left+4,12); context.fillStyle="#547ea0"; context.fillText("MA20",pad.left+40,12);
      context.fillStyle="#75847c"; context.textAlign="center";
      const labelCount=Math.min(5,bars.length); for(let i=0;i<labelCount;i++){const index=Math.round(i*(bars.length-1)/Math.max(1,labelCount-1));context.fillText(bars[index].date.slice(5),pad.left+xStep*(index+.5),height-7)}
    };
    draw(); const observer=new ResizeObserver(draw); observer.observe(canvas); return ()=>observer.disconnect();
  },[bars]);
  return <canvas ref={canvasRef} className="candlestickCanvas" aria-label="个股日K线图" />;
}

function GucdrEvidenceChain({order,snapshot,company,data}:{order:Order;snapshot?:ResearchSnapshot;company?:Company;data:ResearchData}) {
  const driver=data.drivers?.find(item=>item.name===order.driverName);
  const driverLinks=(data.driverFactLinks??[]).filter(link=>link.driverId===driver?.id);
  const linkedFacts=driverLinks.flatMap(link=>{const fact=data.facts?.find(item=>item.id===link.factId&&item.companyId===order.companyId);return fact?[{fact,link}]:[]});
  const evidence=Number(snapshot?.evidenceCoverage??0);
  const supporting=linkedFacts.filter(({link})=>link.stance==="支持"||link.stance==="相关背景");
  const limitations=linkedFacts.filter(({link})=>link.stance==="限制"||link.stance==="反证");
  const hasFact=(...types:string[])=>linkedFacts.some(({fact})=>types.includes(fact.factType??""));
  const policyConfirmed=hasFact("政策事实");
  const capabilityConfirmed=hasFact("竞争地位","履约能力");
  const orderPartial=linkedFacts.some(({fact})=>fact.label?.includes("订单"));
  const profitPartial=hasFact("财务指标","经营指标");
  const tier=evidence>=.6?"验证仓":evidence>=.25?"观察仓":"试探仓";
  const benchmark=snapshot?.benchmarkSymbol||"对应市场指数";
  const horizon=snapshot?.horizon||"中期";
  const path=[
    {label:order.driverName||"外部驱动",detail:`发生概率 ${driver?.probability??"待评估"}%；已绑定政策原文`,state:policyConfirmed?"已证实":"待补充"},
    {label:`${company?.chain||"产业链"}需求变化`,detail:"连续批量核准确认需求基础，但项目招标仍需逐项跟踪",state:policyConfirmed?"部分证实":"待验证"},
    {label:`${company?.name||order.name}获得订单`,detail:`市场地位与履约能力已有证明；新核准项目对应订单尚未单列`,state:capabilityConfirmed&&orderPartial?"部分证实":"待验证"},
    {label:"业绩兑现",detail:"核能收入和利润已有历史贡献；新增核准项目的增量贡献尚未拆分",state:profitPartial?"部分证实":"待验证"},
    {label:"形成超额收益",detail:`盈利预期与估值变化最终需跑赢 ${benchmark}`,state:order.status==="已成交"?"验证中":"尚未开始"},
  ];
  return <details className="gucdrChain">
    <summary><span>GUCDR 完整推理链</span><small>从研究目的到结果验证，而不只是证据百分比</small></summary>
    <div className="gucdrFrame">
      <article><em>G</em><div><small>Goal · 投资目标</small><b>验证驱动能否产生超额收益</b><p>检验“{order.driverName||"当前驱动"}”能否在{horizon}使 {company?.name||order.name} 相对 {benchmark} 获得超额收益。</p></div></article>
      <article><em>U</em><div><small>Unit · 研究对象</small><b>{company?.name||order.name} · {company?.ticker||order.ticker}</b><p>{company?.sector||"行业待标注"} / {company?.chain||"产业链待标注"} / {company?.position||"产业位置待补充"}。</p></div></article>
      <article><em>C</em><div><small>Conditions · 成立条件</small><b>驱动、暴露、兑现与价格必须同时成立</b><p>信号时证据 {Math.round(evidence*100)}%；当前新增支持事实 {supporting.length} 条、限制或反证 {limitations.length} 条；历史快照不回写。</p></div></article>
      <article><em>D</em><div><small>Deduction · 因果推导</small><b>逐环节验证，不允许从政策直接跳到股价</b><p>下面每一箭头都是独立假设，必须分别寻找支持证据与反证。</p></div></article>
      <article><em>R</em><div><small>Result · 决策与验证</small><b>{tier} · {order.side}{number.format(order.quantity)}股</b><p>{snapshot?.invalidation?`失效条件：${snapshot.invalidation}`:"尚未填写失效条件"}</p></div></article>
    </div>
    <div className="causalPath">{path.map((item,index)=><div key={item.label}><span>{String(index+1).padStart(2,"0")}</span><b>{item.label}</b><p>{item.detail}</p><em className={["已建模","已证实","部分证实"].includes(item.state)?"confirmed":"unverified"}>{item.state}</em>{index<path.length-1&&<i>→</i>}</div>)}</div>
    <div className="evidenceLedger">
      <section><b>已经绑定的事实 · {linkedFacts.length} 条</b>{linkedFacts.length?linkedFacts.map(({fact,link})=>{const document=data.documents?.find(item=>item.id===fact.documentId);return <p key={fact.id}><span className={link.stance==="限制"||link.stance==="反证"?"constraint":""}>{link.stance||"支持"}</span>{fact.label||fact.evidenceSummary||`事实 #${fact.id}`} · 置信度 {fact.confidence??0}/5{document&&(document.url?<a href={document.url} target="_blank" rel="noreferrer">来源：{document.title}</a>:<small>来源：{document.title}</small>)}</p>}):<p className="emptyEvidence">尚无原始事实直接绑定到这条推理链，当前判断属于可参与但低置信的研究假设。</p>}</section>
      <section><b>核验结论与剩余缺口</b><p><span>已证实</span>政策核准保持高位；公司具备核电主设备资质、市场地位和历史履约能力。</p><p><span>部分证实</span>核能业务已有收入与利润贡献，整体订单延续增长。</p><p><span className="constraint">仍待验证</span>新核准项目对应东方电气的具体中标金额、设备份额和交付排期。</p><p><span className="constraint">仍待验证</span>当前核电产能利用率、瓶颈环节和新增订单的现金流兑现周期。</p><p><span>结果验证</span>订单成交后才能检验相对 {benchmark} 的超额收益。</p></section>
    </div>
  </details>;
}

export function PaperTradingDashboard({ data, initialCompanyId }: { data: ResearchData; initialCompanyId?: number }) {
  const [portfolioTab,setPortfolioTab]=useState(initialCompanyId ? "market" : "holdings");
  const [paper, setPaper] = useState<PaperData>(emptyPaper);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [ticket, setTicket] = useState({ companyId: String(data.companies[0]?.id ?? ""), side: "买入", quantity: "100", driverName: "", rationale: "", horizon:"中期", invalidation:"" });
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [bars, setBars] = useState<KlineBar[]>([]);
  const [barDays, setBarDays] = useState(120);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const [strategyRunning,setStrategyRunning]=useState(false);
  const [timingByCompany,setTimingByCompany]=useState<Record<number,TimingSnapshot>>({});
  useEffect(() => {
    fetch("/api/paper").then(async response => {
      if (!response.ok) throw new Error((await response.json()).error);
      return response.json();
    }).then(setPaper).catch(error => setMessage(error.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/paper?action=market").then(response => response.json()).then(payload => setIndices(payload.indices ?? [])).catch(() => setIndices([]));
  }, []);

  useEffect(() => {
    if (!ticket.companyId) return;
    setChartLoading(true); setChartError("");
    fetch(`/api/paper?action=history&companyId=${ticket.companyId}&days=${barDays}`).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "K线读取失败");
      return payload;
    }).then(payload => setBars(payload.bars ?? [])).catch(error => { setBars([]); setChartError(error.message); }).finally(() => setChartLoading(false));
  }, [ticket.companyId,barDays]);

  useEffect(() => {
    if (initialCompanyId && data.companies.some(company=>company.id===initialCompanyId)) setTicket(current=>({...current,companyId:String(initialCompanyId)}));
  },[initialCompanyId]);

  const quotesByCompany = useMemo(() => new Map(paper.quotes.map(quote => [quote.companyId, quote])), [paper.quotes]);
  const ranking = useMemo(() => {
    const drivers = data.drivers ?? [];
    const impacts = data.driverImpacts ?? [];
    const links = data.driverFactLinks ?? [];
    const facts = data.facts ?? [];
    return data.companies.map(company => {
      const rows = impacts.filter(impact => impact.targetType === "公司" && impact.targetKey === company.ticker);
      const driverIds = new Set(rows.map(row => row.driverId));
      const relevantLinks = links.filter(link => {
        const fact = facts.find(item => item.id === link.factId);
        return fact?.companyId === company.id && driverIds.has(link.driverId);
      });
      const raw = rows.reduce((sum, impact) => {
        const driver = drivers.find(item => item.id === impact.driverId);
        const direction = impact.direction === "利好" ? 1 : impact.direction === "利空" ? -1 : 0;
        return sum + direction * impact.strength * Number(driver?.probability ?? 0) / 100;
      }, 0);
      const coveredDrivers=[...driverIds].filter(driverId=>relevantLinks.some(link=>link.driverId===driverId)).length;
      const coverage=driverIds.size?coveredDrivers/driverIds.size:0;
      const evidenceWeights=relevantLinks.map(link=>{
        const fact=facts.find(item=>item.id===link.factId);
        const document=data.documents?.find(item=>item.id===fact?.documentId);
        return Number(fact?.confidence??0)/5*Number(link.relevance??0)/5*sourceWeight(document);
      });
      const evidenceQuality=evidenceWeights.length?evidenceWeights.reduce((sum,value)=>sum+value,0)/evidenceWeights.length:0;
      let supportingWeight=0, limitingWeight=0;
      relevantLinks.forEach((link,index)=>{
        const weight=evidenceWeights[index]??0;
        if(link.stance==="限制"||link.stance==="反证") limitingWeight+=weight;
        else supportingWeight+=weight*(link.stance==="支持"?1:.35);
      });
      const stanceTotal=supportingWeight+limitingWeight;
      const thesisSupport=stanceTotal?Math.max(0,Math.min(1,(supportingWeight-limitingWeight+stanceTotal)/(2*stanceTotal))):0;
      // 覆盖度只表示“有没有材料”。证据质量与支持/反证平衡同时进入证据贡献分。
      const evidenceScore=.3*coverage+.4*evidenceQuality+.3*thesisSupport;
      const score=raw*(.55+.45*evidenceScore);
      const strongCounterEvidence = relevantLinks.some(link => {
        const fact = facts.find(item => item.id === link.factId);
        return link.stance === "反证" && Number(fact?.confidence ?? 0) >= 4 && Number(link.relevance ?? 0) >= 4;
      });
      const evidenceTier=evidenceScore>=.7?"验证仓":evidenceScore>=.4?"观察仓":"试探仓";
      const evidenceScale=evidenceScore>=.7?1:evidenceScore>=.4?.5:.25;
      const topDriver = rows.map(impact => ({
        impact,
        driver: drivers.find(item => item.id === impact.driverId),
        weight: impact.strength * Number(drivers.find(item => item.id === impact.driverId)?.probability ?? 0),
      })).sort((a,b) => b.weight-a.weight)[0]?.driver?.name ?? "";
      return { company, rawScore:raw, score, coverage, evidenceQuality, thesisSupport, evidenceScore, evidenceTier, evidenceScale, strongCounterEvidence, topDriver, quote: quotesByCompany.get(company.id) };
    }).filter(item => item.rawScore > 0).sort((a,b) => b.score-a.score);
  }, [data, quotesByCompany]);

  const timingCompanyIds=useMemo(()=>ranking.slice(0,8).map(item=>item.company.id),[ranking]);
  useEffect(()=>{
    let cancelled=false;
    Promise.all(timingCompanyIds.map(async companyId=>{
      try{
        const response=await fetch(`/api/paper?action=history&companyId=${companyId}&days=120`);
        const payload=await response.json();
        const history=(payload.bars??[]) as KlineBar[];
        if(!response.ok||history.length<60) return null;
        const closes=history.map(item=>Number(item.close));
        const latest=closes.at(-1)??0;
        const ma20=closes.slice(-20).reduce((sum,value)=>sum+value,0)/20;
        const return60=latest/(closes.at(-60)??latest)-1;
        return [companyId,{latest,ma20,return60,date:history.at(-1)?.date??""}] as const;
      }catch{return null;}
    })).then(results=>{
      if(cancelled) return;
      setTimingByCompany(Object.fromEntries(results.filter((item):item is readonly [number,TimingSnapshot]=>Boolean(item))));
    });
    return()=>{cancelled=true;};
  },[timingCompanyIds]);

  const longTermLabel=(score:number,evidenceScore:number)=>score>=5&&evidenceScore>=.7?"强烈关注":score>=3.5?"重点关注":score>=2?"持续跟踪":"观察";
  const timingLabel=(timing?:TimingSnapshot)=>!timing?"数据更新中":timing.latest<timing.ma20?"等待站回MA20":timing.return60<=0?"等待60日趋势转正":"入场条件确认";

  const account = paper.account;
  const marketValue = paper.positions.reduce((sum, position) => sum + Number(position.quantity) * Number(position.lastPriceCny ?? 0), 0);
  const totalValue = Number(account?.cash ?? 0) + marketValue;
  const pnl = totalValue - Number(account?.initialCash ?? 0);
  const returnRate = account?.initialCash ? pnl / account.initialCash * 100 : 0;
  const pendingOrders = paper.orders.filter(order => order.status === "待成交").length;
  const staleQuotes = paper.quotes.filter(quote => {
    const quoteDate=new Date(`${quote.priceDate}T00:00:00`);
    return Number.isFinite(quoteDate.getTime()) && (Date.now()-quoteDate.getTime())/86400000>4;
  }).length;
  const selectedCompany = data.companies.find(company => company.id === Number(ticket.companyId));
  const selectedQuote = quotesByCompany.get(Number(ticket.companyId));
  const selectedPosition = paper.positions.find(position => position.companyId === Number(ticket.companyId));
  const estimatedValue = Number(ticket.quantity || 0) * Number(selectedQuote?.priceCny ?? 0);
  const latestBar = bars.at(-1);
  const previousBar = bars.at(-2);
  const ma = (period:number) => bars.length>=period ? bars.slice(-period).reduce((sum,item)=>sum+item.close,0)/period : 0;
  const ma5=ma(5), ma20=ma(20);
  const return20 = bars.length>=20 ? (Number(latestBar?.close)/bars.at(-20)!.close-1)*100 : 0;
  const dailyChange = latestBar&&previousBar ? (latestBar.close/previousBar.close-1)*100 : 0;
  const volumeAverage = bars.length>=20 ? bars.slice(-20).reduce((sum,item)=>sum+item.volume,0)/20 : 0;
  const volumeRatio = latestBar&&volumeAverage ? latestBar.volume/volumeAverage : 0;
  const benchmark = selectedCompany?.market.includes("A股") ? indices.find(item=>item.symbol==="sh000300") : selectedCompany?.market.includes("港股") ? indices.find(item=>item.symbol==="hkHSI") : indices.find(item=>item.symbol==="usINX");
  const relativeDaily = dailyChange-Number(benchmark?.changePercent ?? 0);
  const strategyCandidates = useMemo(() => ranking.map(item => {
    const quote=item.quote;
    const quoteAge=quote?Math.floor((Date.now()-new Date(`${quote.priceDate}T00:00:00`).getTime())/86400000):999;
    const alreadyHeld=paper.positions.some(position=>position.companyId===item.company.id);
    const alreadyPending=paper.orders.some(order=>order.companyId===item.company.id&&order.status==="待成交");
    const sameChainValue=paper.positions.filter(position=>data.companies.find(company=>company.id===position.companyId)?.chain===item.company.chain)
      .reduce((sum,position)=>sum+Number(position.quantity)*Number(position.lastPriceCny??0),0);
    const reasons:string[]=[];
    const warnings:string[]=[];
    if(item.rawScore<strategyRules.minimumScore) reasons.push("驱动评分不足");
    if(item.strongCounterEvidence) reasons.push("核心事实存在高置信反证");
    if(item.coverage<.5) warnings.push("证据链覆盖不足");
    if(item.evidenceQuality<.55) warnings.push("证据质量偏低");
    if(item.evidenceScore<.4) warnings.push("证据贡献分较低，仅允许试探仓");
    if(!quote) reasons.push("无行情"); else if(quoteAge>strategyRules.maxQuoteAgeDays) reasons.push(`行情陈旧 ${quoteAge} 天`);
    if(alreadyHeld) reasons.push("已持仓");
    if(alreadyPending) reasons.push("已有待成交订单");
    if(paper.positions.length>=strategyRules.maxHoldings) reasons.push("持仓数已达上限");
    if(totalValue&&sameChainValue/totalValue>=strategyRules.maxChain) reasons.push("产业链集中度已达上限");
    return {...item,quoteAge,reasons,warnings,eligible:reasons.length===0};
  }),[ranking,paper.positions,paper.orders,data.companies,totalValue]);

  async function act(body: Record<string,string|number>) {
    const response = await fetch("/api/paper", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const next = await response.json();
    if (!response.ok) throw new Error(next.error ?? "操作失败");
    setPaper(next);
    return next as PaperData;
  }

  async function refresh() {
    setRefreshing(true); setMessage("");
    try {
      const next = await act({ kind: "refresh" });
      setMessage(`已更新 ${next.refresh?.updated ?? 0} 个标的，${next.refresh?.failed ?? 0} 个暂未取得行情`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "行情更新失败");
    } finally {
      setRefreshing(false);
    }
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault(); setMessage("");
    try {
      const candidate=ranking.find(item=>item.company.id===Number(ticket.companyId));
      await act({ kind: "order", ...ticket, companyId: Number(ticket.companyId), quantity: Number(ticket.quantity), researchScore:candidate?.score??0, evidenceCoverage:candidate?.coverage??0 });
      setMessage("模拟订单已记录，将使用下一交易日行情成交");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "订单提交失败");
    }
  }

  async function runStrategy() {
    setStrategyRunning(true); setMessage("");
    try {
      let nextPaper=paper;
      let placed=0,exitOrders=0;
      for(const position of paper.positions) {
        if(paper.orders.some(order=>order.companyId===position.companyId&&order.side==="卖出"&&order.status==="待成交")) continue;
        const item=ranking.find(candidate=>candidate.company.id===position.companyId);
        if(!item) continue;
        const historyResponse=await fetch(`/api/paper?action=history&companyId=${position.companyId}&days=120`);
        const historyPayload=await historyResponse.json();
        const history=(historyPayload.bars??[]) as KlineBar[];
        if(!historyResponse.ok||history.length<60) continue;
        const closes=history.map(bar=>Number(bar.close));
        const latest=closes.at(-1)??0;
        const average20=closes.slice(-20).reduce((sum,value)=>sum+value,0)/20;
        const return60=latest/(closes.at(-60)??latest)-1;
        const exitReason=item.strongCounterEvidence?"高置信反证触发论点退出":item.rawScore<=0?"驱动净影响转负":latest<average20&&return60<=0?"MA20与60日趋势同时转弱":"";
        if(!exitReason) continue;
        nextPaper=await act({kind:"order",companyId:position.companyId,side:"卖出",quantity:position.quantity,
          driverName:item.topDriver,researchScore:item.score,evidenceCoverage:item.coverage,horizon:"中期",
          invalidation:exitReason,
          rationale:`${strategyRules.name} 卖出信号：${exitReason}。当前驱动净影响 ${item.rawScore.toFixed(2)}，基本面研究分 ${item.score.toFixed(2)}，证据贡献 ${Math.round(item.evidenceScore*100)}分；最新价相对MA20为 ${average20?((latest/average20-1)*100).toFixed(1):"0.0"}%，60日收益 ${(return60*100).toFixed(1)}%。信号后下一交易日模拟成交。`});
        exitOrders++;
      }
      const slots=Math.max(0,strategyRules.maxHoldings-paper.positions.length-pendingOrders);
      const pendingValue=paper.orders.filter(order=>order.status==="待成交"&&order.side==="买入")
        .reduce((sum,order)=>sum+Number(order.quantity)*Number(order.signalPriceCny),0);
      let remainingBudget=Math.max(0,totalValue*strategyRules.targetInvested-marketValue-pendingValue);
      const chainCommitted=new Map<string,number>();
      paper.positions.forEach(position=>{const chain=data.companies.find(company=>company.id===position.companyId)?.chain??"";chainCommitted.set(chain,(chainCommitted.get(chain)??0)+Number(position.quantity)*Number(position.lastPriceCny??0));});
      for(const item of strategyCandidates.filter(item=>item.eligible).slice(0,slots*2)){
        if(placed>=slots) break;
        const historyResponse=await fetch(`/api/paper?action=history&companyId=${item.company.id}&days=120`);
        const historyPayload=await historyResponse.json();
        const history=(historyPayload.bars??[]) as KlineBar[];
        if(!historyResponse.ok||history.length<60) continue;
        const closes=history.map(bar=>Number(bar.close));
        const latest=closes.at(-1)??0;
        const average20=closes.slice(-20).reduce((sum,value)=>sum+value,0)/20;
        const return60=latest/(closes.at(-60)??latest)-1;
        const dailyReturns=closes.slice(-60).slice(1).map((value,index)=>value/closes.slice(-60)[index]-1);
        const mean=dailyReturns.reduce((sum,value)=>sum+value,0)/Math.max(1,dailyReturns.length);
        const volatility=Math.sqrt(dailyReturns.reduce((sum,value)=>sum+(value-mean)**2,0)/Math.max(1,dailyReturns.length-1))*Math.sqrt(252);
        // A股传统个股动量证据较弱，因此各市场都只把趋势用于入场确认，而不加入预期收益分数。
        if(latest<average20||return60<=0) continue;
        const availableCash=Number(nextPaper.account?.cash??0);
        const chainRoom=Math.max(0,totalValue*strategyRules.maxChain-(chainCommitted.get(item.company.chain)??0));
        const volatilityScale=Math.max(.5,Math.min(1,.3/Math.max(.15,volatility)));
        const targetValue=Math.min(totalValue*strategyRules.maxPosition*volatilityScale*item.evidenceScale,remainingBudget,chainRoom,availableCash);
        if(targetValue<=0||!item.quote) continue;
        const lot=item.company.market.includes("A股")?100:1;
        const quantity=Math.floor(targetValue/item.quote.priceCny/lot)*lot;
        if(quantity<=0) continue;
        nextPaper=await act({kind:"order",companyId:item.company.id,side:"买入",quantity,
          driverName:item.topDriver,researchScore:item.score,evidenceCoverage:item.coverage,horizon:"中期",
          invalidation:"评分降至零以下、核心事实被证伪、价格跌破中期趋势且基本面同步恶化，或产业链权重突破25%",
          rationale:`${strategyRules.name} 自动入选：驱动净影响 ${item.rawScore.toFixed(2)}，基本面研究分 ${item.score.toFixed(2)}，证据贡献 ${Math.round(item.evidenceScore*100)}分（覆盖 ${Math.round(item.coverage*100)}%、质量 ${Math.round(item.evidenceQuality*100)}分），按“${item.evidenceTier}”参与；60日趋势 ${(return60*100).toFixed(1)}%，年化波动率 ${(volatility*100).toFixed(1)}%。`});
        const committed=quantity*item.quote.priceCny;
        remainingBudget-=committed;
        chainCommitted.set(item.company.chain,(chainCommitted.get(item.company.chain)??0)+committed);
        placed++;
      }
      setMessage(exitOrders||placed?`v2.2 策略已生成 ${exitOrders} 笔卖出、${placed} 笔买入订单，将按下一交易日价格成交`:`本轮没有触发卖出信号，也没有新标的满足驱动、趋势与风险规则`);
    } catch(error){setMessage(error instanceof Error?error.message:"策略运行失败");}
    finally{setStrategyRunning(false);}
  }

  function chooseCandidate(item: typeof ranking[number]) {
    setTicket({
      companyId: String(item.company.id), side: "买入",
      quantity: item.company.market.includes("A股") ? "100" : "10",
      driverName: item.topDriver,
      rationale: `公司利好排名候选：驱动净影响 ${item.rawScore.toFixed(2)}，基本面研究分 ${item.score.toFixed(2)}，证据贡献 ${Math.round(item.evidenceScore*100)}分，其中覆盖 ${Math.round(item.coverage*100)}%、质量 ${Math.round(item.evidenceQuality*100)}分。建议按“${item.evidenceTier}”参与。`,
      horizon:"中期",
      invalidation:"核心驱动未兑现、原始证据被证伪，或公司暴露度发生实质变化",
    });
    document.getElementById("paper-ticket")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (loading) return <section className="paperLoading">正在载入模拟盘…</section>;

  return <section className="paperDashboard">
    <section className="paperHero">
      <div><p className="eyebrow">FORWARD RESEARCH TEST</p><h2>基本面研究模拟盘</h2><p>用真实延迟日线验证公司排名，不追求高频成交。研究信号与订单完整留痕，下一交易日才模拟成交。</p></div>
      <div className="paperHeroActions">
        <span><i />{paper.quotes.length ? `行情覆盖 ${paper.quotes.length}/${data.companies.length}${staleQuotes?` · ${staleQuotes} 个报价可能陈旧`:""}` : "尚未同步行情"}</span>
        <button onClick={refresh} disabled={refreshing}>{refreshing ? "正在同步…" : "↻ 更新市场行情"}</button>
      </div>
    </section>

    {message && <div className="paperNotice">{message}</div>}

    <section className="paperMetrics">
      <article><span>账户总资产</span><b>{money.format(totalValue)}</b><small>{account?.name ?? "研究模拟盘"}</small></article>
      <article><span>累计收益</span><b className={pnl >= 0 ? "positive" : "negative"}>{pnl >= 0 ? "+" : ""}{money.format(pnl)}</b><small>{returnRate >= 0 ? "+" : ""}{returnRate.toFixed(2)}%</small></article>
      <article><span>可用现金</span><b>{money.format(account?.cash ?? 0)}</b><small>现金占比 {totalValue ? (Number(account?.cash ?? 0)/totalValue*100).toFixed(1) : "0"}%</small></article>
      <article><span>当前持仓</span><b>{paper.positions.length}</b><small>{pendingOrders} 笔订单等待下一交易日</small></article>
      <article><span>成交假设</span><b>{account?.slippageBps ?? 5}<em>bp</em></b><small>佣金 {account?.commissionBps ?? 3}bp · 人民币计价</small></article>
    </section>

    <div className="ma-tabs" aria-label="模拟组合内容">{[["holdings","持仓概览"],["market","行情与候选"],["orders","下单与记录"]].map(([id,label])=><button key={id} aria-pressed={portfolioTab===id} onClick={()=>setPortfolioTab(id)}>{label}</button>)}</div>
    {portfolioTab==="holdings"&&<>
    <section className="paperHoldings">
      <header><div><p className="eyebrow">PORTFOLIO</p><h3>当前持仓</h3></div><span>市值及盈亏使用最近一次行情快照</span></header>
      <div className="holdingTable">
        <div className="holdingHead"><span>公司</span><span>数量</span><span>平均成本</span><span>最新价格</span><span>市值</span><span>浮动盈亏</span><span>权重</span></div>
        {paper.positions.map(position => {
          const value = position.quantity * Number(position.lastPriceCny ?? 0);
          const positionPnl = value - position.quantity * position.avgCostCny;
          return <div className="holdingRow" key={position.id}>
            <div><i style={{background:position.color}} /> <span><b>{position.name}</b><small>{position.ticker} · {position.priceDate}</small></span></div>
            <span>{number.format(position.quantity)}</span><span>{money.format(position.avgCostCny)}</span><span>{money.format(position.lastPriceCny ?? 0)}</span><span>{money.format(value)}</span><strong className={positionPnl>=0?"positive":"negative"}>{positionPnl>=0?"+":""}{money.format(positionPnl)}</strong><span>{totalValue?(value/totalValue*100).toFixed(1):0}%</span>
          </div>;
        })}
        {!paper.positions.length && <p className="paperEmpty">当前没有持仓。更新行情并提交订单后，订单会在取得下一交易日价格时成交。</p>}
      </div>
    </section>

    <div className="ma-actions"><button onClick={()=>setPortfolioTab("market")}>检查行情与入场条件 →</button><button onClick={()=>setPortfolioTab("orders")}>查看订单与净值记录 →</button></div></>}
    {portfolioTab==="market"&&<>
    <details className="ma-panel"><summary>查看候选排名与既有策略规则 · 手动触发模拟决策</summary>
    <section className="strategyPanel">
      <header><div><p className="eyebrow">AUTONOMOUS RESEARCH STRATEGY</p><h3>{strategyRules.name}</h3><p>驱动净影响是起点；证据覆盖、来源质量和支持/反证共同构成证据贡献分，它只是基本面评分的一部分。趋势只负责确认入场时点。</p></div><button onClick={runStrategy} disabled={strategyRunning}>{strategyRunning?"正在核验趋势与风险…":"运行本轮策略"}</button></header>
      <div className="strategyRules">
        <span>买入：驱动评分 ≥ {strategyRules.minimumScore}</span><span>弱证据也可试探</span><span>试探仓 ≤ 3%</span><span>观察仓 ≤ 6%</span><span>验证仓 ≤ 12%</span><span>买入：收盘价 ≥ MA20</span><span>买入：60日收益 ＞ 0</span><span>卖出：高置信反证</span><span>卖出：驱动净分 ≤ 0</span><span>卖出：MA20与60日同时转弱</span><span>波动率缩放仓位</span><span>报价 ≤ {strategyRules.maxQuoteAgeDays}日</span><span>最多 {strategyRules.maxHoldings} 股</span><span>同链 ≤ {strategyRules.maxChain*100}%</span><span>目标仓位 {strategyRules.targetInvested*100}%</span>
      </div>
      <div className="dualDecisionRanking">
        <header><span>公司与核心驱动</span><span>长期基本面吸引力</span><span>短期入场条件</span></header>
        {strategyCandidates.slice(0,8).map(item=>{const timing=timingByCompany[item.company.id];const timingReady=Boolean(timing&&timing.latest>=timing.ma20&&timing.return60>0);return <article key={item.company.id}>
          <div className="decisionCompany"><b>{item.company.name}</b><small>{item.company.ticker} · {item.topDriver||item.company.chain}</small></div>
          <div className="longTermDecision"><strong>{longTermLabel(item.score,item.evidenceScore)}</strong><span>基本面 {item.score.toFixed(2)} · 证据贡献 {Math.round(item.evidenceScore*100)}分 · {item.evidenceTier}</span><small>覆盖 {Math.round(item.coverage*100)}% · 质量 {Math.round(item.evidenceQuality*100)} · 支持度 {Math.round(item.thesisSupport*100)}</small></div>
          <div className={`shortTermDecision ${timingReady?"confirmed":"waiting"}`}><strong>{timingLabel(timing)}</strong>{timing?<span>现价 {number.format(timing.latest)} · MA20 {number.format(timing.ma20)} · 60日 {timing.return60>=0?"+":""}{(timing.return60*100).toFixed(1)}%</span>:<span>正在读取120日行情</span>}</div>
        </article>})}
      </div>
      <footer><b>分数边界</b><p>证据覆盖率不再直接代表高分：覆盖高但来源弱、相关性低或反证多，证据贡献分仍会下降。当前“基本面研究分”尚未包含标准化估值与预期差，因此不得当作完整投资分或上涨概率。</p></footer>
    </section>

    </details>
    <section className="marketOverviewPanel">
      <header><div><p className="eyebrow">GLOBAL MARKET</p><h3>主要市场</h3></div><span>延迟行情 · 用于识别系统性涨跌与市场风格</span></header>
      <div className="marketIndexGrid">{indices.map(index => <article key={index.symbol}>
        <div><span>{index.market}</span><b>{index.name}</b></div>
        <strong>{number.format(index.price)}</strong>
        <em className={index.changePercent>=0?"positive":"negative"}>{index.changePercent>=0?"+":""}{number.format(index.change)} · {index.changePercent>=0?"+":""}{index.changePercent.toFixed(2)}%</em>
        <small>高 {number.format(index.high)} · 低 {number.format(index.low)}</small>
      </article>)}</div>
      {!indices.length&&<p className="paperEmpty">大盘行情正在连接，稍后刷新页面即可重试。</p>}
    </section>

    <section className="technicalWorkspace">
      <header>
        <div><p className="eyebrow">PRICE STRUCTURE</p><h3>个股K线与市场比较</h3></div>
        <div className="chartControls"><label><span>标的</span><select value={ticket.companyId} onChange={event=>setTicket({...ticket,companyId:event.target.value})}>{data.companies.map(company=><option value={company.id} key={company.id}>{company.name} · {company.ticker}</option>)}</select></label><div>{[30,60,120,250].map(days=><button key={days} className={barDays===days?"active":""} onClick={()=>setBarDays(days)}>{days}日</button>)}</div></div>
      </header>
      <div className="technicalGrid">
        <div className="klinePanel">
          <div className="klineLegend"><b>{selectedCompany?.name}</b>{latestBar&&<><span>{latestBar.date}</span><span>开 {number.format(latestBar.open)}</span><span>高 {number.format(latestBar.high)}</span><span>低 {number.format(latestBar.low)}</span><span>收 {number.format(latestBar.close)}</span></>}</div>
          {chartLoading?<div className="chartState">正在读取历史行情…</div>:chartError?<div className="chartState warning">{chartError}</div>:bars.length?<CandlestickChart bars={bars}/>:<div className="chartState">暂无K线数据</div>}
        </div>
        <aside className="priceAnalysisPanel">
          <header><span>量价判断</span><b>{latestBar&&ma20 ? latestBar.close>=ma20?"趋势偏强":"趋势偏弱":"数据不足"}</b></header>
          <article><span>当日涨跌</span><strong className={dailyChange>=0?"positive":"negative"}>{dailyChange>=0?"+":""}{dailyChange.toFixed(2)}%</strong><small>相对{benchmark?.name??"基准"} {relativeDaily>=0?"+":""}{relativeDaily.toFixed(2)}%</small></article>
          <article><span>20日表现</span><strong className={return20>=0?"positive":"negative"}>{return20>=0?"+":""}{return20.toFixed(2)}%</strong><small>用于观察中短期价格确认</small></article>
          <article><span>均线结构</span><strong>{ma5?number.format(ma5):"—"} / {ma20?number.format(ma20):"—"}</strong><small>MA5 / MA20</small></article>
          <article><span>量能比例</span><strong>{volumeRatio?volumeRatio.toFixed(2):"—"}×</strong><small>最近成交量 / 20日均量</small></article>
          <div className="priceDecision"><b>研究使用方式</b><p>基本面排名决定“研究谁”，K线与大盘决定“何时建立观察仓位”。价格走弱不会推翻事实，但会降低短期仓位。</p></div>
        </aside>
      </div>
    </section>

    <div className="ma-actions"><button onClick={()=>setPortfolioTab("orders")}>进入模拟下单 →</button></div></>}
    {portfolioTab==="orders"&&<>
    <section className="paperTopGrid">
      <section className="candidatePanel">
        <header><div><p className="eyebrow">RESEARCH CANDIDATES</p><h3>长期基本面候选池</h3></div><span>右侧同步显示短期入场状态</span></header>
        <div className="candidateList">
          {ranking.slice(0,8).map((item,index) => <button key={item.company.id} onClick={() => chooseCandidate(item)}>
            <em>{String(index+1).padStart(2,"0")}</em>
            <i style={{ background: item.company.color }}>{item.company.name.slice(0,1)}</i>
            <div><b>{item.company.name}</b><small>{item.company.ticker} · {item.topDriver || "驱动待补充"}</small></div>
            <span><strong>{longTermLabel(item.score,item.evidenceScore)}</strong><small>基本面 {item.score.toFixed(2)} · 证据贡献 {Math.round(item.evidenceScore*100)}分</small></span>
            <div className="candidateQuote">{item.quote ? <><b>{item.quote.currency} {number.format(item.quote.price)}</b><small>{item.quote.priceDate}</small></> : <small>待同步行情</small>}</div>
            <small className={`candidateTiming ${timingLabel(timingByCompany[item.company.id])==="入场条件确认"?"confirmed":""}`}>{timingLabel(timingByCompany[item.company.id])}</small>
          </button>)}
        </div>
      </section>

      <form className="paperTicket" id="paper-ticket" onSubmit={submitOrder}>
        <header><p className="eyebrow">ORDER TICKET</p><h3>模拟订单</h3><span>人工确认 · 下一交易日成交</span></header>
        <label><span>公司</span><select value={ticket.companyId} onChange={event => setTicket({...ticket,companyId:event.target.value})}>{data.companies.map(company => <option value={company.id} key={company.id}>{company.name} · {company.ticker}</option>)}</select></label>
        <div className="ticketPair">
          <label><span>方向</span><select value={ticket.side} onChange={event => setTicket({...ticket,side:event.target.value})}><option>买入</option><option>卖出</option></select></label>
          <label><span>数量</span><input type="number" min="1" step="1" value={ticket.quantity} onChange={event => setTicket({...ticket,quantity:event.target.value})} /></label>
        </div>
        <label><span>关联驱动</span><input value={ticket.driverName} onChange={event => setTicket({...ticket,driverName:event.target.value})} placeholder="例如：核电项目核准提速" /></label>
        <div className="ticketPair">
          <label><span>验证周期</span><select value={ticket.horizon} onChange={event=>setTicket({...ticket,horizon:event.target.value})}><option>短期</option><option>中期</option><option>长期</option></select></label>
          <label><span>失效条件</span><input value={ticket.invalidation} onChange={event=>setTicket({...ticket,invalidation:event.target.value})} placeholder="什么情况说明判断错误" /></label>
        </div>
        <label><span>研究理由</span><textarea value={ticket.rationale} onChange={event => setTicket({...ticket,rationale:event.target.value})} placeholder="记录为何在此时建立模拟仓位…" /></label>
        <div className="ticketEstimate">
          <span>最近行情</span><b>{selectedQuote ? `${selectedQuote.currency} ${number.format(selectedQuote.price)}` : "请先更新行情"}</b>
          <span>人民币估算</span><b>{money.format(estimatedValue)}</b>
          {ticket.side === "卖出" && <small>当前可卖：{number.format(selectedPosition?.quantity ?? 0)}股</small>}
          <small>{selectedCompany?.market.includes("A股") ? "A股买入须为100股整数倍" : "最终价格包含模拟滑点和佣金"}</small>
        </div>
        <button className="primary" disabled={!selectedQuote}>确认记录模拟订单</button>
      </form>
    </section>

    <section className="paperBottomGrid">
      <section className="orderHistory">
        <header><div><p className="eyebrow">ORDER LOG</p><h3>订单与研究留痕</h3></div><span>共 {paper.orders.length} 笔</span></header>
        {paper.orders.slice(0,10).map(order => <article key={order.id}>
          <span className={order.side==="买入"?"buy":"sell"}>{order.side}</span>
          <div><b>{order.name} · {number.format(order.quantity)}股</b><small>{order.driverName || "未标记驱动"} · 信号日 {order.signalDate}</small><p>{order.rationale || "未填写研究理由"}</p>{paper.snapshots?.find(snapshot=>snapshot.orderId===order.id)&&<div className="snapshotMeta">{(()=>{const snapshot=paper.snapshots?.find(item=>item.orderId===order.id)!;return <><span>历史研究分 {Number(snapshot.researchScore).toFixed(2)}</span><span>当时覆盖率 {Math.round(Number(snapshot.evidenceCoverage)*100)}%</span><span>基准 {snapshot.benchmarkSymbol}</span><span>{snapshot.horizon}</span>{snapshot.invalidation&&<small>失效：{snapshot.invalidation}</small>}</>})()}</div>}</div>
          <div><b className={`status ${order.status}`}>{order.status}</b><small>{order.status==="已成交"?`${money.format(order.filledPriceCny)} · 费用 ${money.format(order.fees)}`:`信号价 ${money.format(order.signalPriceCny)}`}</small>{order.status==="待成交"&&<button onClick={async()=>{try{await act({kind:"cancel",orderId:order.id})}catch(error){setMessage(error instanceof Error?error.message:"撤销失败")}}}>撤销</button>}</div>
          <GucdrEvidenceChain order={order} snapshot={paper.snapshots?.find(item=>item.orderId===order.id)} company={data.companies.find(item=>item.id===order.companyId)} data={data} />
        </article>)}
        {!paper.orders.length && <p className="paperEmpty">尚无模拟订单。</p>}
      </section>

      <section className="navPanel">
        <header><div><p className="eyebrow">NET ASSET VALUE</p><h3>净值记录</h3></div><span>{paper.nav.length} 个交易日快照</span></header>
        <div className="navChart">
          {(paper.nav.length ? paper.nav : [{id:0,snapshotDate:"初始",cash:account?.initialCash??1000000,marketValue:0,totalValue:account?.initialCash??1000000}]).slice(-20).map(item => {
            const base = Number(account?.initialCash ?? 1000000);
            const change = base ? (item.totalValue/base-1)*100 : 0;
            return <div key={item.id || item.snapshotDate}><span>{item.snapshotDate}</span><i><b className={change>=0?"up":"down"} style={{width:`${Math.min(100,Math.max(2,50+change*5))}%`}} /></i><strong>{change>=0?"+":""}{change.toFixed(2)}%</strong></div>;
          })}
        </div>
        <footer><b>测试规则</b><span>不使用杠杆</span><span>下一交易日成交</span><span>延迟日线</span><span>计入滑点与佣金</span></footer>
      </section>
    </section>

    </>}
    <section className="paperMethod">
      <b>研究价值检验</b>
      <p>模拟盘只检验“证据与驱动排名能否产生持续超额表现”。行情来自第三方延迟日线，不能替代券商成交记录；高频、盘口深度和真实市场冲击不在本阶段测试范围内。</p>
    </section>
  </section>;
}
