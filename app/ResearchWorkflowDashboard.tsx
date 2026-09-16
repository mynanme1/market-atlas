"use client";

import { useMemo } from "react";

type Company = { id:number; name:string; ticker:string; market:string; sector:string; chain:string; position?:string };
type Driver = { id:number; name:string; probability:number; status:string; evidenceStatus:string };
type Impact = { id:number; driverId:number; targetType:string; targetKey:string; direction:string; strength:number; transmission?:string };
type Document = { id:number; companyId:number; title:string; url?:string; publicationDate?:string; sourceTier:string; extractionStatus:string };
type Fact = { id:number; companyId:number; documentId?:number; confidence:number; label?:string; valueText?:string; evidenceSummary?:string; reportingPeriod?:string };
type FactLink = { id:number; driverId:number; factId:number; relevance?:number; stance?:string; rationale?:string };
type ResearchData = {
  companies:Company[]; relations:{id:number}[]; drivers?:Driver[]; driverImpacts?:Impact[];
  documents?:Document[]; facts?:Fact[]; driverFactLinks?:FactLink[];
};

export function ResearchWorkflowDashboard({ data, onOpen }: { data:ResearchData; onOpen:(view:"network"|"evidence"|"drivers"|"paper")=>void }) {
  const model = useMemo(() => {
    const drivers=data.drivers??[], impacts=data.driverImpacts??[], documents=data.documents??[], facts=data.facts??[], links=data.driverFactLinks??[];
    const linkedDrivers=new Set(links.map(link=>link.driverId));
    const primaryDocuments=documents.filter(document=>["A","一手","一级"].some(word=>document.sourceTier.includes(word))).length;
    const verifiedFacts=facts.filter(fact=>Number(fact.confidence)>=4).length;
    const ranked=data.companies.map(company=>{
      const rows=impacts.filter(impact=>impact.targetType==="公司"&&impact.targetKey===company.ticker);
      const relevant=links.filter(link=>rows.some(row=>row.driverId===link.driverId)).flatMap(link=>{
        const fact=facts.find(item=>item.id===link.factId&&item.companyId===company.id);
        return fact?[{link,fact,document:documents.find(document=>document.id===fact.documentId)}]:[];
      });
      const uniqueRelevant=[...new Map(relevant.map(item=>[item.fact.id,item])).values()];
      const supportRows=uniqueRelevant.filter(({link})=>link.stance!=="限制"&&link.stance!=="反证");
      const limitRows=uniqueRelevant.filter(({link})=>link.stance==="限制"||link.stance==="反证");
      const supportScores=supportRows.map(({link,fact})=>Number(fact.confidence)/5*Number(link.relevance??0)/5*(link.stance==="支持"?1:.65));
      const average=supportScores.length?supportScores.reduce((total,value)=>total+value,0)/supportScores.length:0;
      const breadth=Math.min(1,supportScores.length/5);
      const evidenceQuality=average*(.45+.55*breadth)*(1-.15*Math.min(1,limitRows.length/2));
      const rawScore=rows.reduce((sum,row)=>{
        const driver=drivers.find(item=>item.id===row.driverId);
        return sum+(row.direction==="利好"?1:row.direction==="利空"?-1:0)*Number(row.strength||0)*Number(driver?.probability||0)/100;
      },0);
      const negativeWeight=rows.filter(row=>row.direction==="利空").reduce((sum,row)=>sum+row.strength,0);
      const score=rows.reduce((sum,row)=>{
        const driver=drivers.find(item=>item.id===row.driverId);
        const direction=row.direction==="利好"?1:row.direction==="利空"?-1:0;
        const relevant=links.filter(link=>link.driverId===row.driverId).flatMap(link=>{
          const fact=facts.find(item=>item.id===link.factId&&item.companyId===company.id);
          return fact?[{link,fact}]:[];
        });
        const support=relevant.filter(({link})=>link.stance!=="限制"&&link.stance!=="反证").map(({link,fact})=>Number(fact.confidence)/5*Number(link.relevance??0)/5*(link.stance==="支持"?1:.65));
        const average=support.length?support.reduce((total,value)=>total+value,0)/support.length:0;
        const breadth=Math.min(1,support.length/5);
        const constraints=relevant.filter(({link})=>link.stance==="限制"||link.stance==="反证").length;
        const quality=average*(.45+.55*breadth)*(1-.15*Math.min(1,constraints/2));
        const evidence=.65+.35*quality;
        return sum+direction*Number(row.strength||0)*Number(driver?.probability||0)/100*evidence;
      },0);
      const recommendation=rawScore<=0?"风险观察":evidenceQuality>=.68?(negativeWeight>=3?"分批关注":"重点关注"):evidenceQuality>=.42?"试探观察":"等待补证";
      return {company,score,rawScore,evidenceQuality,negativeWeight,recommendation,drivers:new Set(rows.map(row=>row.driverId)).size,rows,supportRows,limitRows};
    }).filter(item=>item.drivers).sort((a,b)=>b.score-a.score);
    const readiness=[
      {key:"evidence",label:"原始证据",value:documents.length?Math.round((primaryDocuments/documents.length*.55+verifiedFacts/Math.max(1,facts.length)*.45)*100):0,detail:`${primaryDocuments} 份一手来源 · ${verifiedFacts} 条高置信事实`},
      {key:"drivers",label:"驱动映射",value:drivers.length?Math.round(linkedDrivers.size/drivers.length*100):0,detail:`${linkedDrivers.size}/${drivers.length} 个驱动已连接事实`},
      {key:"ranking",label:"公司评分",value:data.companies.length?Math.round(ranked.length/data.companies.length*100):0,detail:`${ranked.length}/${data.companies.length} 家已有方向性评分`},
      {key:"paper",label:"前瞻验证",value:0,detail:"需由模拟订单和基准收益逐日积累"},
    ];
    const committeeTickers=["VRT","TSM","NVDA","601985","600875"];
    const committee=committeeTickers.flatMap(ticker=>ranked.filter(item=>item.company.ticker===ticker));
    return {drivers,documents,facts,links,ranked,readiness,committee};
  },[data]);

  const thesisMeta:Record<string,{thesis:string;verify:string;entry:string}>={
    VRT:{thesis:"AI机柜功率密度上升，资本开支正向供电与热管理收入、利润率和现金流传导。",verify:"跟踪订单增速、积压订单消化、液冷收入拆分及大型项目交付延迟。",entry:"仅在趋势确认且估值未透支全年指引时分批试仓；单一高波动标的不追涨。"},
    TSM:{thesis:"AI芯片需求通过先进制程与先进封装传导，收入、净利和毛利率均已兑现。",verify:"跟踪月度营收、N2良率、CoWoS供给以及海外晶圆厂对毛利率的稀释。",entry:"作为高质量核心观察标的；等待估值与价格趋势门通过后分批配置。"},
    NVDA:{thesis:"AI算力平台需求极强，数据中心收入、指引和毛利率构成最直接的利润验证。",verify:"重点核验云厂商资本开支、Blackwell/Rubin交付及中国市场受限后的增长斜率。",entry:"基本面强但政策和估值敏感，只允许较小初始仓位并设置财报失效条件。"},
    "601985":{thesis:"高位核准节奏已形成在建和待建项目储备，长期装机与发电量增长路径清晰。",verify:"跟踪投产节奏、利用小时、电价、燃料成本和融资成本，避免只看核准数量。",entry:"偏长期防守观察；以稳定现金流和合理估值为前提，不按主题弹性追涨。"},
    "600875":{thesis:"核电核准向主设备订单传导，公司具备制造地位且核电业务已有收入和毛利贡献。",verify:"必须补齐核电新增订单拆分、产能利用率、交付节奏及经营现金流验证。",entry:"等待订单转化和价格趋势共同确认；现阶段不因政策利好直接追入。"},
  };

  return <section className="workflowDashboard">
    <section className="workflowHero">
      <div><p className="eyebrow">RESEARCH OPERATING SYSTEM</p><h2>从证据到收益，形成可检验的研究闭环</h2><p>图谱负责发现传导路径，原始资料负责证明事实，驱动模型负责形成判断，模拟盘负责检验判断是否产生超额收益。</p></div>
      <aside><span>当前原则</span><b>先形成假设，再分层验证</b><small>弱证据也能参与决策，但只能获得较低置信度与较小仓位。</small></aside>
    </section>

    <section className="workflowSteps">
      {[
        ["01","发现","关系网络","识别产业链、供需瓶颈与跨行业传导","network"],
        ["02","验证","证据中心","用财报、公告、政策原文固化事实","evidence"],
        ["03","判断","驱动与情景","记录方向、概率、强度和失效条件","drivers"],
        ["04","排序","公司评分","驱动决定方向，证据调整置信度与仓位","drivers"],
        ["05","检验","研究模拟盘","冻结快照并比较基准与实际结果","paper"],
      ].map(([no,verb,title,description,target],index)=><button key={no} onClick={()=>onOpen(target as "network"|"evidence"|"drivers"|"paper")}>
        <span>{no}</span><small>{verb}</small><b>{title}</b><p>{description}</p>{index<4&&<i>→</i>}
      </button>)}
    </section>

    <div className="workflowGrid">
      <section className="readinessPanel">
        <header><div><p className="eyebrow">RESEARCH READINESS</p><h3>研究链路完整度</h3></div><span>不是数据量，而是可追溯程度</span></header>
        {model.readiness.map(item=><button key={item.key} onClick={()=>onOpen(item.key==="ranking"?"drivers":item.key as "evidence"|"drivers"|"paper")}>
          <div><b>{item.label}</b><small>{item.detail}</small></div><i><em style={{width:`${item.value}%`}} /></i><strong>{item.value}%</strong>
        </button>)}
      </section>
      <section className="researchQueue">
        <header><div><p className="eyebrow">DECISION QUEUE</p><h3>下一步研究优先级</h3></div><span>按缺口安排工作</span></header>
        {model.ranked.slice(0,5).map((item,index)=><article key={item.company.id}>
          <em>{String(index+1).padStart(2,"0")}</em><div><b>{item.company.name}</b><small>{item.company.ticker} · {item.company.chain}</small></div>
          <span className={item.score>=0?"positive":"negative"}>{item.score>=0?"利好候选":"风险观察"}</span><strong>{item.score>=0?"+":""}{item.score.toFixed(2)}</strong>
        </article>)}
        {!model.ranked.length&&<p className="workflowEmpty">尚无公司完成“驱动 → 影响”映射，请先建立驱动因素。</p>}
      </section>
    </div>

    <section className="committeePanel">
      <header><div><p className="eyebrow">INVESTMENT COMMITTEE</p><h3>多公司证据链与投资结论</h3></div><aside><b>结论口径</b><span>驱动决定方向 · 证据决定置信度 · 价格决定执行</span></aside></header>
      <div className="committeeLegend"><span>重点关注：基本面链路较完整</span><span>分批关注：链路完整但重大风险并存</span><span>试探观察：允许小仓验证</span><span>等待补证：不进入自动候选</span></div>
      <div className="committeeCards">
        {model.committee.map(item=>{
          const meta=thesisMeta[item.company.ticker];
          const mainDriver=item.rows.slice().sort((a,b)=>b.strength-a.strength)[0];
          const driver=model.drivers.find(driver=>driver.id===mainDriver?.driverId);
          const support=item.supportRows.slice(0,2);
          const limits=item.limitRows.slice(0,2);
          return <article key={item.company.id} className={`committeeCard ${item.recommendation==="重点关注"?"focus":item.recommendation==="分批关注"?"cautious":item.recommendation==="等待补证"?"waiting":"trial"}`}>
            <header><div><span>{item.company.market} · {item.company.position??item.company.chain}</span><h4>{item.company.name}<small>{item.company.ticker}</small></h4></div><strong>{item.recommendation}</strong></header>
            <div className="committeeScore"><div><span>方向评分</span><b>{item.rawScore>=0?"+":""}{item.rawScore.toFixed(2)}</b></div><div><span>证据质量</span><b>{Math.round(item.evidenceQuality*100)}%</b></div><div><span>支持 / 限制</span><b>{item.supportRows.length} / {item.limitRows.length}</b></div></div>
            <section className="thesisBlock"><span>核心驱动</span><b>{driver?.name??"待映射"}</b><p>{meta?.thesis}</p></section>
            <section className="miniLedger positiveEvidence"><span>已验证</span>{support.length?support.map(({fact,document})=><p key={fact.id}><b>{fact.label}</b><small>{fact.valueText||fact.evidenceSummary}</small>{document?.url&&<a href={document.url} target="_blank" rel="noreferrer">查看原始来源 ↗</a>}</p>):<p>尚无公司级支持证据</p>}</section>
            <section className="miniLedger riskEvidence"><span>反证 / 限制</span>{limits.length?limits.map(({fact,document})=><p key={fact.id}><b>{fact.label}</b><small>{fact.evidenceSummary}</small>{document?.url&&<a href={document.url} target="_blank" rel="noreferrer">查看原始来源 ↗</a>}</p>):<p>尚未录入明确反证，不能解释为没有风险。</p>}</section>
            <footer><div><b>待验证</b><p>{meta?.verify}</p></div><div><b>执行建议</b><p>{meta?.entry}</p></div></footer>
          </article>;
        })}
      </div>
      <section className="modelPortfolio">
        <header><div><p className="eyebrow">CONDITIONAL MODEL PORTFOLIO</p><h4>首轮模拟盘建议</h4></div><span>不是立即成交：刷新行情并通过价格门后，才允许逐笔建仓</span></header>
        <div>
          {[{name:"台积电",ticker:"TSM",weight:10,role:"核心质量仓"},{name:"中国核电",ticker:"601985",weight:10,role:"长期防守仓"},{name:"维谛技术",ticker:"VRT",weight:8,role:"高景气卫星仓"},{name:"英伟达",ticker:"NVDA",weight:6,role:"高风险卫星仓"},{name:"东方电气",ticker:"600875",weight:0,role:"等待订单与趋势"},{name:"现金",ticker:"CASH",weight:66,role:"等待估值与回撤机会"}].map(item=><article key={item.ticker}>
            <div><b>{item.name}</b><small>{item.ticker} · {item.role}</small></div><i><em style={{width:`${Math.max(2,item.weight)}%`}} /></i><strong>{item.weight}%</strong>
          </article>)}
        </div>
        <footer><b>执行顺序</b><p>先刷新延迟行情 → 检查MA20与60日趋势 → 补齐估值分位 → 每个标的分2—3次建仓。任一公司出现高置信反证、财报低于失效阈值或产业链逻辑断裂，取消未成交订单并重新评分。</p></footer>
      </section>
      <div className="committeeBoundary"><b>建议边界</b><p>上述结论是研究优先级，不是无条件买入指令。进入模拟盘前仍需通过实时价格趋势、估值分位、组合集中度和失效条件四道门；证据更新日期晚于信号日时，不得回填到历史决策。</p><button onClick={()=>onOpen("paper")}>进入模拟盘执行门 →</button></div>
    </section>

    <section className="researchRules">
      <article><span>数据层</span><b>区分事实与观点</b><p>财报、公告、政策原文是事实；新闻解读和分析师判断只能作为线索。</p></article>
      <article><span>模型层</span><b>避免伪精确</b><p>评分用于横向排序，不冒充目标价；概率必须随新证据更新。</p></article>
      <article><span>验证层</span><b>使用同期基准</b><p>A股、港股、美股分别比较对应指数，记录超额收益而不只看绝对盈亏。</p></article>
      <article><span>审计层</span><b>冻结研究快照</b><p>信号发出后保留当时证据、评分、价格、期限与失效条件，不能事后改写。</p></article>
    </section>
    <section className="optimizationQueue">
      <header><div><p className="eyebrow">NEXT IMPROVEMENTS</p><h3>当前框架的优化优先级</h3></div><span>按对研究结论可信度的影响排序</span></header>
      <div>
        <article><em>P0</em><b>建立基准净值与超额收益曲线</b><p>当前模拟盘只有账户净值，尚不能严谨回答是否跑赢同期市场。</p><span>模拟盘验证</span></article>
        <article><em>P0</em><b>把情景连接到驱动和公司</b><p>基准、乐观、压力情景目前是文字假设，尚未改变公司评分或组合结果。</p><span>情景建模</span></article>
        <article><em>P1</em><b>补齐核心公司的法定披露</b><p>当前研究库覆盖 25 家公司，但结构化原始文件只有 {model.documents.length} 份。</p><span>数据工程</span></article>
        <article><em>P1</em><b>加入组合风险与归因</b><p>需要行业集中度、单一标的上限、最大回撤及收益来源拆解。</p><span>风险管理</span></article>
      </div>
    </section>
    <section className="strategyResearchPanel">
      <header><div><p className="eyebrow">STRATEGY RESEARCH</p><h3>策略证据与采用决定</h3></div><span>只采用当前数据能够支持的规则</span></header>
      <div>
        <article className="adopted"><b>驱动与证据分层</b><span>核心信号</span><p>驱动决定是否参与，证据只调整排序置信度和仓位；证据较少时仍允许建立试探仓。</p></article>
        <article className="adopted"><b>质量与盈利</b><span>部分采用</span><p>未标准化的财务数据暂不直接计分，但不再构成禁止参与的门槛；完善后用于调整仓位。</p></article>
        <article className="adopted"><b>趋势与动量</b><span>仅作确认</span><p>采用MA20和60日正收益确认入场；A股不直接使用传统个股动量排名。</p></article>
        <article className="adopted"><b>低波动与分散</b><span>已采用</span><p>按60日波动率缩放仓位，并限制单股、产业链和总仓位。</p></article>
        <article className="pending"><b>价值因子</b><span>待接入</span><p>需要统一PE、PB、EV/EBITDA和自由现金流收益率，不能用叙述代替估值数据。</p></article>
        <article className="rejected"><b>高频择时与因子堆叠</b><span>不采用</span><p>换手成本、过拟合和因子挖掘风险较高，不符合本项目的中期研究目标。</p></article>
      </div>
    </section>
  </section>;
}
