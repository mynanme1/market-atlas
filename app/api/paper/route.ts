import { env } from "cloudflare:workers";
import { companyCycleAtDate, companyCycleExposures, cycleAssumptions, macroObservations, regionCycleAtDate, trendAtDate } from "../../research/cycleModel";

type CompanyRow = { id: number; ticker: string; market: string; name?: string; chain?: string };
type QuoteResult = {
  companyId: number; symbol: string; price: number; currency: string;
  fxToCny: number; priceCny: number; priceDate: string;
};

const schema = [
  `CREATE TABLE IF NOT EXISTS paper_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    base_currency TEXT NOT NULL DEFAULT 'CNY', initial_cash REAL NOT NULL,
    cash REAL NOT NULL, commission_bps REAL NOT NULL DEFAULT 3,
    slippage_bps REAL NOT NULL DEFAULT 5, created_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS price_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL,
    symbol TEXT NOT NULL, price REAL NOT NULL, currency TEXT NOT NULL,
    fx_to_cny REAL NOT NULL DEFAULT 1, price_cny REAL NOT NULL,
    price_date TEXT NOT NULL, source TEXT NOT NULL DEFAULT '',
    captured_at TEXT NOT NULL DEFAULT '', UNIQUE(company_id,price_date)
  )`,
  `CREATE TABLE IF NOT EXISTS paper_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL, side TEXT NOT NULL, quantity REAL NOT NULL,
    signal_date TEXT NOT NULL, signal_price_cny REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT '待成交', submitted_at TEXT NOT NULL DEFAULT '',
    filled_at TEXT NOT NULL DEFAULT '', filled_price_cny REAL NOT NULL DEFAULT 0,
    fees REAL NOT NULL DEFAULT 0, rationale TEXT NOT NULL DEFAULT '',
    driver_name TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS paper_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL, quantity REAL NOT NULL,
    avg_cost_cny REAL NOT NULL, updated_at TEXT NOT NULL DEFAULT '',
    UNIQUE(account_id,company_id)
  )`,
  `CREATE TABLE IF NOT EXISTS paper_nav_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL,
    snapshot_date TEXT NOT NULL, cash REAL NOT NULL, market_value REAL NOT NULL,
    total_value REAL NOT NULL, UNIQUE(account_id,snapshot_date)
  )`,
  `CREATE TABLE IF NOT EXISTS research_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL UNIQUE,
    company_id INTEGER NOT NULL, snapshot_date TEXT NOT NULL,
    research_score REAL NOT NULL DEFAULT 0, evidence_coverage REAL NOT NULL DEFAULT 0,
    benchmark_symbol TEXT NOT NULL DEFAULT '', horizon TEXT NOT NULL DEFAULT '中期',
    invalidation TEXT NOT NULL DEFAULT '', thesis TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS strategy_model_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_date TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT ''
  )`,
];

function shanghaiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function tencentCode(company: CompanyRow) {
  if (/^\d{6}$/.test(company.ticker)) {
    return `${/^[569]/.test(company.ticker) ? "sh" : "sz"}${company.ticker}`;
  }
  if (/^\d{1,5}$/.test(company.ticker) && company.market.includes("港股")) {
    return `hk${company.ticker.padStart(5,"0")}`;
  }
  if (company.market.includes("美股")) return `us${company.ticker}`;
  return "";
}

async function init() {
  const db = env.DB;
  await db.batch(schema.map(statement => db.prepare(statement)));
  const account = await db.prepare("SELECT id FROM paper_accounts LIMIT 1").first<{id:number}>();
  if (!account) {
    await db.prepare(`INSERT INTO paper_accounts
      (name,base_currency,initial_cash,cash,commission_bps,slippage_bps,created_at)
      VALUES ('基本面研究模拟盘','CNY',1000000,1000000,3,5,datetime('now'))`).run();
  }
}

async function latestQuotes() {
  return env.DB.prepare(`SELECT id,company_id AS companyId,symbol,price,currency,
    fx_to_cny AS fxToCny,price_cny AS priceCny,price_date AS priceDate,
    source,captured_at AS capturedAt FROM (
      SELECT q.*,ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY price_date DESC,id DESC) AS rn
      FROM price_snapshots q
    ) WHERE rn=1 ORDER BY company_id`).all();
}

async function fetchMarketOverview() {
  const indices = [
    ["sh000001","上证指数","A股"],["sh000300","沪深300","A股"],["sz399006","创业板指","A股"],
    ["hkHSI","恒生指数","港股"],["usINX","标普500","美股"],["usIXIC","纳斯达克","美股"],["usDJI","道琼斯","美股"],
  ];
  const response = await fetch(`https://qt.gtimg.cn/q=${indices.map(item => item[0]).join(",")}`);
  if (!response.ok) throw new Error("大盘行情暂时不可用");
  const text = await response.text();
  const rows = new Map<string,string[]>();
  text.split(";").forEach(line => {
    const match = line.match(/v_([^=]+)="([^"]*)"/);
    if (match) rows.set(match[1],match[2].split("~"));
  });
  return indices.flatMap(([symbol,fallbackName,market]) => {
    const row = rows.get(symbol);
    if (!row) return [];
    return [{
      // qt.gtimg.cn may return legacy-encoded Chinese bytes. Index names are
      // stable identifiers, so use our UTF-8 labels instead of decoded text.
      symbol,name:fallbackName,market,price:Number(row[3]),previousClose:Number(row[4]),
      change:Number(row[31]),changePercent:Number(row[32]),high:Number(row[33]),low:Number(row[34]),
      quoteTime:String(row[30] ?? ""),currency:market === "A股" ? "CNY" : market === "港股" ? "HKD" : "USD",
    }];
  });
}

function cleanNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[$,]/g,""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchHistory(company: CompanyRow, days: number) {
  const safeDays = Math.min(500,Math.max(20,days));
  if (company.market.includes("A股") || company.market.includes("港股")) {
    const symbol = tencentCode(company);
    const response = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${symbol},day,,,${safeDays},qfq`);
    if (!response.ok) throw new Error("历史K线暂时不可用");
    const payload = await response.json() as { data?: Record<string,{ qfqday?: Array<Array<string|number>>; day?: Array<Array<string|number>> }> };
    const item = payload.data?.[symbol];
    const rows = item?.qfqday?.length ? item.qfqday : item?.day ?? [];
    return rows.map(row => ({ date:String(row[0]),open:cleanNumber(row[1]),close:cleanNumber(row[2]),high:cleanNumber(row[3]),low:cleanNumber(row[4]),volume:cleanNumber(row[5]) }));
  }
  if (company.market.includes("美股")) {
    const from = new Date();
    from.setDate(from.getDate()-Math.max(365,safeDays*2));
    const fromDate = from.toISOString().slice(0,10);
    const response = await fetch(`https://api.nasdaq.com/api/quote/${encodeURIComponent(company.ticker)}/historical?assetclass=stocks&fromdate=${fromDate}&limit=${safeDays}`, {
      headers: { "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36",accept:"application/json, text/plain, */*",referer:`https://www.nasdaq.com/market-activity/stocks/${company.ticker.toLowerCase()}/historical` },
    });
    if (!response.ok) throw new Error("美股历史K线暂时不可用");
    const payload = await response.json() as { data?: { tradesTable?: { rows?: Array<{ date:string;open:string;close:string;high:string;low:string;volume:string }> } } };
    return (payload.data?.tradesTable?.rows ?? []).map(row => {
      const [month,day,year] = row.date.split("/");
      return { date:`${year}-${month}-${day}`,open:cleanNumber(row.open),close:cleanNumber(row.close),high:cleanNumber(row.high),low:cleanNumber(row.low),volume:cleanNumber(row.volume) };
    }).reverse();
  }
  throw new Error("该市场暂未接入历史K线");
}

type BacktestBar = { date:string; open:number; close:number; high:number; low:number; volume:number };
type BacktestFact = { id:number; companyId:number; confidence:number; publicationDate:string; verifiedAt:string; sourceTier:string };
type BacktestLink = { driverId:number; factId:number; stance:string; relevance:number };
type BacktestImpact = { driverId:number; targetKey:string; direction:string; strength:number };
type ReconstructedDriver = { probability:number; factCount:number; balance:number; evidenceWeight:number };

const reconstructedTickers = new Set(["NVDA","TSM","601899","003816"]);

function backtestSourceWeight(tier:string) {
  if(tier.startsWith("A")||tier.includes("一级")||tier.includes("法定披露")||tier.includes("交易所")) return 1;
  if(tier.includes("二级")||tier.includes("公司官方")) return .85;
  return .65;
}

function evidenceAtDate(companyId:number,driverIds:number[],date:string,facts:BacktestFact[],links:BacktestLink[],strict:boolean) {
  const availableFactIds=new Set(facts.filter(fact=>fact.companyId===companyId&&fact.publicationDate&&fact.publicationDate<=date&&(!strict||Boolean(fact.verifiedAt&&fact.verifiedAt<=date))).map(fact=>fact.id));
  const relevant=links.filter(link=>driverIds.includes(link.driverId)&&availableFactIds.has(link.factId));
  const covered=driverIds.filter(driverId=>relevant.some(link=>link.driverId===driverId)).length;
  const coverage=driverIds.length?covered/driverIds.length:0;
  const weights=relevant.map(link=>{
    const fact=facts.find(item=>item.id===link.factId);
    return Number(fact?.confidence??0)/5*Number(link.relevance??0)/5*backtestSourceWeight(fact?.sourceTier??"");
  });
  const quality=weights.length?weights.reduce((sum,value)=>sum+value,0)/weights.length:0;
  let support=0,limit=0;
  relevant.forEach((link,index)=>{
    const weight=weights[index]??0;
    if(link.stance==="限制"||link.stance==="反证") limit+=weight;
    else support+=weight*(link.stance==="支持"?1:.35);
  });
  const total=support+limit;
  const thesisSupport=total?Math.max(0,Math.min(1,(support-limit+total)/(2*total))):0;
  const evidenceScore=.3*coverage+.4*quality+.3*thesisSupport;
  const strongCounter=relevant.some(link=>{
    const fact=facts.find(item=>item.id===link.factId);
    return link.stance==="反证"&&Number(fact?.confidence??0)>=4&&Number(link.relevance)>=4;
  });
  return { coverage,quality,thesisSupport,evidenceScore,strongCounter };
}

function reconstructedDriverAtDate(driverId:number,date:string,facts:BacktestFact[],links:BacktestLink[]):ReconstructedDriver|null {
  const factsById=new Map(facts.filter(fact=>fact.publicationDate&&fact.publicationDate<=date).map(fact=>[fact.id,fact]));
  const relevant=links.filter(link=>link.driverId===driverId&&factsById.has(link.factId));
  if(!relevant.length) return null;
  let signedWeight=0,evidenceWeight=0;
  relevant.forEach(link=>{
    const fact=factsById.get(link.factId);
    const weight=Number(fact?.confidence??0)/5*Number(link.relevance??0)/5*backtestSourceWeight(fact?.sourceTier??"");
    const stance=link.stance==="支持" ? 1 : link.stance==="相关背景" ? .25 : link.stance==="限制" ? -.65 : -1;
    signedWeight+=weight*stance;
    evidenceWeight+=weight;
  });
  if(!evidenceWeight) return null;
  const balance=Math.max(-1,Math.min(1,signedWeight/evidenceWeight));
  const depth=1-Math.exp(-evidenceWeight/2);
  const probability=Math.max(20,Math.min(80,50+30*balance*depth));
  return {probability,factCount:relevant.length,balance,evidenceWeight};
}

async function recordStrategyModelSnapshot(snapshotDate=shanghaiDate()) {
  const [drivers,impacts]=await Promise.all([
    env.DB.prepare("SELECT id,probability,status,updated_at AS updatedAt FROM drivers ORDER BY id").all(),
    env.DB.prepare("SELECT id,driver_id AS driverId,target_type AS targetType,target_key AS targetKey,direction,strength FROM driver_impacts ORDER BY id").all(),
  ]);
  const payload=JSON.stringify({drivers:drivers.results,impacts:impacts.results});
  await env.DB.prepare(`INSERT INTO strategy_model_snapshots(snapshot_date,payload,created_at)
    VALUES(?,?,datetime('now')) ON CONFLICT(snapshot_date) DO UPDATE SET payload=excluded.payload,created_at=datetime('now')`)
    .bind(snapshotDate,payload).run();
}

type BacktestOptions={rebalanceDays?:number;entryRule?:"strict"|"balanced";enableShorts?:boolean;cycle?:boolean;horizon?:"tactical"|"patient";comparison?:boolean};
async function runBacktest(days:number,mode:"strict"|"reconstructed"="strict",options:BacktestOptions={}) {
  const safeDays=Math.min(500,Math.max(180,days));
  const [companiesResult,driversResult,impactsResult,factsResult,linksResult,quotesResult,modelSnapshotsResult]=await Promise.all([
    env.DB.prepare("SELECT id,name,ticker,market,chain FROM companies ORDER BY id").all<CompanyRow>(),
    env.DB.prepare("SELECT id,probability FROM drivers").all<{id:number;probability:number}>(),
    env.DB.prepare("SELECT driver_id AS driverId,target_key AS targetKey,direction,strength FROM driver_impacts WHERE target_type='公司'").all<BacktestImpact>(),
    env.DB.prepare(`SELECT f.id,f.company_id AS companyId,f.confidence,f.verified_at AS verifiedAt,
      d.publication_date AS publicationDate,d.source_tier AS sourceTier
      FROM extracted_facts f JOIN source_documents d ON d.id=f.document_id`).all<BacktestFact>(),
    env.DB.prepare("SELECT driver_id AS driverId,fact_id AS factId,stance,relevance FROM driver_fact_links").all<BacktestLink>(),
    env.DB.prepare(`SELECT company_id AS companyId,price,price_cny AS priceCny FROM (
      SELECT company_id,price,price_cny,ROW_NUMBER() OVER(PARTITION BY company_id ORDER BY price_date DESC,id DESC) rn
      FROM price_snapshots) WHERE rn=1`).all<{companyId:number;price:number;priceCny:number}>(),
    env.DB.prepare("SELECT snapshot_date AS snapshotDate,payload FROM strategy_model_snapshots ORDER BY snapshot_date").all<{snapshotDate:string;payload:string}>(),
  ]);
  const impacts=impactsResult.results;
  const investable=companiesResult.results.filter(company=>impacts.some(impact=>impact.targetKey===company.ticker)&&(mode!=="reconstructed"||reconstructedTickers.has(company.ticker)));
  const reconstructionCompanyIds=new Set(investable.map(company=>company.id));
  const reconstructionFacts=factsResult.results.filter(fact=>reconstructionCompanyIds.has(fact.companyId));
  const histories=(await Promise.all(investable.map(async company=>{
    try {
      const bars=(await fetchHistory(company,safeDays) as BacktestBar[]).filter(bar=>bar.close>0).sort((a,b)=>a.date.localeCompare(b.date));
      if(bars.length<100) return null;
      const quote=quotesResult.results.find(item=>item.companyId===company.id);
      const fxScale=quote?.price&&quote?.priceCny?Number(quote.priceCny)/Number(quote.price):1;
      return { company,bars,fxScale,map:new Map(bars.map(bar=>[bar.date,bar])) };
    } catch { return null; }
  }))).filter((item):item is NonNullable<typeof item>=>Boolean(item));
  if(histories.length<3) throw new Error("可用历史行情的公司不足，暂时无法回测");
  if(options.comparison&&histories.length!==4) throw new Error("周期对照需要四家公司行情齐全；本次不缩减样本输出结果，请重试。");
  const inputSnapshot={companies:investable,facts:factsResult.results,links:linksResult.results,impacts,drivers:driversResult.results,modelSnapshots:modelSnapshotsResult.results,histories:histories.map(({company,bars,fxScale})=>({company,bars,fxScale})),macroObservations,cycleAssumptions,companyCycleExposures};
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(inputSnapshot)));
  const inputId=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,"0")).join("");
  function simulate(config:BacktestOptions) {
  const rebalanceDays=[5,10,20,60].includes(Number(config.rebalanceDays))?Number(config.rebalanceDays):20;
  const entryRule=config.entryRule==="balanced"?"balanced":"strict";
  const enableShorts=Boolean(config.enableShorts);
  const cycleEnabled=Boolean(config.cycle);
  const horizon=config.horizon==="patient"?"patient":"tactical";
  const maDays=horizon==="patient"?60:20,trendDays=horizon==="patient"?120:60;
  const dateFrequency=new Map<string,number>();
  histories.forEach(item=>item.bars.forEach(bar=>dateFrequency.set(bar.date,(dateFrequency.get(bar.date)??0)+1)));
  const dates=[...dateFrequency.entries()].filter(([,count])=>count>=Math.ceil(histories.length*.6)).map(([date])=>date).sort();
  if(dates.length<90) throw new Error("跨市场共同交易日不足，暂时无法回测");
  const modelSnapshots=modelSnapshotsResult.results.map(snapshot=>{
    try{return {...snapshot,model:JSON.parse(snapshot.payload) as {drivers:Array<{id:number;probability:number}>;impacts:Array<BacktestImpact&{targetType?:string}>}};}catch{return null;}
  }).filter((item):item is NonNullable<typeof item>=>Boolean(item));
  const verifiedDates=factsResult.results.map(fact=>fact.verifiedAt).filter(Boolean).sort();
  const pointInTimeStart=[modelSnapshots[0]?.snapshotDate,verifiedDates[0]].filter(Boolean).sort().at(-1)??"";
  const availablePointInTimeDays=pointInTimeStart?dates.filter(date=>date>=pointInTimeStart).length:0;
  if(mode==="strict"&&availablePointInTimeDays<120) {
    return {
      status:"insufficient_point_in_time_history",mode,generatedAt:new Date().toISOString(),
      dataAudit:{pointInTimeStart:pointInTimeStart||"尚未开始",availableTradingDays:availablePointInTimeDays,requiredTradingDays:120,firstFactVerifiedAt:verifiedDates[0]??"",firstModelSnapshotAt:modelSnapshots[0]?.snapshotDate??""},
      message:"严格时点数据不足，不应输出具有误导性的策略收益率。",
      limitations:["事实必须在原始文件已公开且研究系统已完成核验后才能使用。","驱动概率、方向和公司影响必须使用信号日前最后一个已保存模型快照。","当前历史长度不足时，只能继续累积快照或人工重建当时研究状态。"],
    };
  }
  const firstReconstructedPublication=reconstructionFacts.map(fact=>fact.publicationDate).filter(Boolean).sort()[0]??"";
  const firstEligibleDateIndex=mode==="reconstructed"&&firstReconstructedPublication?dates.findIndex(date=>date>=firstReconstructedPublication):60;
  // Both comparison horizons use the same warmup and initial signal date.
  const warmup=options.comparison||horizon==="patient"?121:61;
  const warmupIndex=dates.findIndex(date=>histories.every(item=>item.bars.filter(bar=>bar.date<=date).length>=warmup));
  if(warmupIndex<0) throw new Error("历史数据不足以完成趋势预热");
  const startIndex=Math.max(warmupIndex,firstEligibleDateIndex<0?60:firstEligibleDateIndex,mode==="strict"?Math.max(0,dates.findIndex(date=>date>=pointInTimeStart)):0);
  const initialCash=1_000_000;
  const commission=.0003,slippage=.0005;
  let cash=initialCash,turnover=0,closedTrades=0,winningTrades=0,borrowCosts=0,shortEntries=0;
  const positions=new Map<number,{quantity:number;avgCost:number}>();
  const trades:Array<{date:string;name:string;side:string;price:number;value:number;reason:string}>=[];
  const curve:Array<{date:string;strategy:number;benchmark:number;cashBenchmark:number;grossExposure:number}>=[];
  const cycleAudit:Array<{signalDate:string;ticker:string;name:string;scale:number;known:boolean;regions:ReturnType<typeof companyCycleAtDate>["regions"]}>=[];
  const entryDates=new Map<number,string>();
  const holdingDays:number[]=[];
  const latestBar=(item:typeof histories[number],date:string)=>{
    for(let index=item.bars.length-1;index>=0;index--) if(item.bars[index].date<=date) return item.bars[index];
    return undefined;
  };
  const priceCny=(item:typeof histories[number],date:string)=>Number(latestBar(item,date)?.close??0)*item.fxScale;
  const portfolioValue=(date:string)=>cash+[...positions.entries()].reduce((sum,[id,position])=>{
    const item=histories.find(history=>history.company.id===id);
    return sum+(item?position.quantity*priceCny(item,date):0);
  },0);
  const benchmarkMembers=histories.map(item=>{
    const start=latestBar(item,dates[startIndex]);
    return {item,start:Number(start?.close??0)};
  }).filter(item=>item.start>0);
  const activeModelAtDate=(signalDate:string)=>{
    const strictSnapshot=mode==="strict"?[...modelSnapshots].reverse().find(snapshot=>snapshot.snapshotDate<=signalDate):undefined;
    const activeImpacts=(strictSnapshot?.model.impacts??impacts).filter(impact=>!impact.targetType||impact.targetType==="公司");
    const activeProbabilities=mode==="strict"
      ? new Map((strictSnapshot?.model.drivers??[]).map(driver=>[driver.id,Number(driver.probability)]))
      : new Map(driversResult.results.flatMap(driver=>{
          const reconstructed=reconstructedDriverAtDate(driver.id,signalDate,reconstructionFacts,linksResult.results);
          return reconstructed?[[driver.id,reconstructed.probability] as [number,number]]:[];
        }));
    return {activeImpacts,activeProbabilities};
  };
  let peak=initialCash,maxDrawdown=0;
  for(let dateIndex=startIndex;dateIndex<dates.length;dateIndex++) {
    const date=dates[dateIndex];
    if(enableShorts) {
      const dailyBorrow=[...positions.entries()].reduce((sum,[id,position])=>{
        if(position.quantity>=0) return sum;
        const item=histories.find(history=>history.company.id===id);
        return sum+(item?Math.abs(position.quantity)*priceCny(item,date)*.05/252:0);
      },0);
      cash-=dailyBorrow;borrowCosts+=dailyBorrow;
    }
    if(dateIndex>startIndex&&positions.size) {
      const signalDate=dates[dateIndex-1];
      const {activeImpacts,activeProbabilities}=activeModelAtDate(signalDate);
      for(const [id,position] of [...positions.entries()]) {
        const item=histories.find(history=>history.company.id===id);
        const fill=item?.map.get(date);
        if(!item||!fill) continue;
        const companyImpacts=activeImpacts.filter(impact=>impact.targetKey===item.company.ticker);
        const datedImpacts=companyImpacts.filter(impact=>activeProbabilities.has(impact.driverId));
        const driverIds=[...new Set(datedImpacts.map(impact=>impact.driverId))];
        const raw=datedImpacts.reduce((sum,impact)=>sum+(impact.direction==="利好"?1:impact.direction==="利空"?-1:0)*Number(impact.strength)*Number(activeProbabilities.get(impact.driverId))/100,0);
        const evidence=evidenceAtDate(item.company.id,driverIds,signalDate,factsResult.results,linksResult.results,mode==="strict");
        const history=item.bars.filter(bar=>bar.date<=signalDate);
        const trend=trendAtDate(history,signalDate,horizon);
        const weak=Boolean(trend&&trend.latest<trend.average&&trend.returnValue<=0);
        const strong=Boolean(trend&&trend.latest>trend.average&&trend.returnValue>=0);
        const isShort=position.quantity<0;
        const exitReason=isShort
          ? evidence.strongCounter?"空头证据出现高置信反证":driverIds.length&&raw>=0?"空头驱动净影响转为非负":strong?"空头趋势反转":""
          : evidence.strongCounter?"高置信反证触发论点退出":driverIds.length&&raw<=0?"驱动净影响转负":weak?`MA${maDays}与${trendDays}日趋势同时转弱`:"";
        if(!exitReason) continue;
        const fillPrice=fill.close*item.fxScale*(isShort?1+slippage:1-slippage);
        const quantity=Math.abs(position.quantity),gross=quantity*fillPrice,fee=gross*commission;
        cash+=isShort?-(gross+fee):gross-fee;turnover+=gross;closedTrades++;
        if(isShort?fillPrice<position.avgCost:fillPrice>position.avgCost) winningTrades++;
        trades.push({date,name:item.company.name??item.company.ticker,side:isShort?"买入平仓":"卖出",price:fillPrice,value:gross,reason:exitReason});
        positions.delete(id);
        if(entryDates.has(id)){holdingDays.push((Date.parse(date)-Date.parse(entryDates.get(id)!))/86400000);entryDates.delete(id);}
      }
    }
    if(dateIndex>startIndex&&(dateIndex-startIndex-1)%rebalanceDays===0) {
      const signalDate=dates[dateIndex-1];
      const {activeImpacts,activeProbabilities}=activeModelAtDate(signalDate);
      const candidates=histories.flatMap(item=>{
        const companyImpacts=activeImpacts.filter(impact=>impact.targetKey===item.company.ticker);
        const datedImpacts=companyImpacts.filter(impact=>activeProbabilities.has(impact.driverId));
        const raw=datedImpacts.reduce((sum,impact)=>sum+(impact.direction==="利好"?1:impact.direction==="利空"?-1:0)*Number(impact.strength)*Number(activeProbabilities.get(impact.driverId))/100,0);
        const driverIds=[...new Set(datedImpacts.map(impact=>impact.driverId))];
        const evidence=evidenceAtDate(item.company.id,driverIds,signalDate,factsResult.results,linksResult.results,mode==="strict");
        const history=item.bars.filter(bar=>bar.date<=signalDate);
        const execution=item.map.get(date);
        if(!driverIds.length||raw<1||!execution||evidence.strongCounter) return [];
        const closes=history.map(bar=>bar.close),latest=closes.at(-1)??0;
        const trend=trendAtDate(history,signalDate,horizon);
        if(!trend) return [];
        const entryConfirmed=entryRule==="strict"?latest>=trend.average&&trend.returnValue>0:latest>=trend.average||trend.returnValue>0;
        if(!entryConfirmed) return [];
        const returns=closes.slice(-60).slice(1).map((value,index)=>value/closes.slice(-60)[index]-1);
        const mean=returns.reduce((sum,value)=>sum+value,0)/Math.max(1,returns.length);
        const volatility=Math.sqrt(returns.reduce((sum,value)=>sum+(value-mean)**2,0)/Math.max(1,returns.length-1))*Math.sqrt(252);
        const evidenceScale=evidence.evidenceScore>=.7?1:evidence.evidenceScore>=.4?.5:.25;
        const volatilityScale=Math.max(.5,Math.min(1,.3/Math.max(.15,volatility)));
        const cycle=companyCycleAtDate(item.company.ticker,signalDate);
        cycleAudit.push({signalDate,ticker:item.company.ticker,name:item.company.name??item.company.ticker,scale:cycleEnabled?cycle.scale:1,known:cycle.known,regions:cycle.regions});
        return [{item,score:raw*(.55+.45*evidence.evidenceScore),weightCap:.12*evidenceScale*volatilityScale*(cycleEnabled?cycle.scale:1),evidence,cycleScale:cycleEnabled?cycle.scale:1}];
      }).sort((a,b)=>b.score-a.score).slice(0,6);
      const shortCandidates=enableShorts?histories.flatMap(item=>{
        const companyImpacts=activeImpacts.filter(impact=>impact.targetKey===item.company.ticker);
        const datedImpacts=companyImpacts.filter(impact=>activeProbabilities.has(impact.driverId));
        const raw=datedImpacts.reduce((sum,impact)=>sum+(impact.direction==="利好"?1:impact.direction==="利空"?-1:0)*Number(impact.strength)*Number(activeProbabilities.get(impact.driverId))/100,0);
        const driverIds=[...new Set(datedImpacts.map(impact=>impact.driverId))];
        const evidence=evidenceAtDate(item.company.id,driverIds,signalDate,factsResult.results,linksResult.results,mode==="strict");
        const history=item.bars.filter(bar=>bar.date<=signalDate),execution=item.map.get(date);
        if(!driverIds.length||raw>-1||history.length<60||!execution||evidence.strongCounter||evidence.evidenceScore<.55) return [];
        const closes=history.map(bar=>bar.close),latest=closes.at(-1)??0;
        const ma20=closes.slice(-20).reduce((sum,value)=>sum+value,0)/20;
        const return60=latest/(closes.at(-60)??latest)-1;
        if(latest>=ma20||return60>=0) return [];
        const returns=closes.slice(-60).slice(1).map((value,index)=>value/closes.slice(-60)[index]-1);
        const mean=returns.reduce((sum,value)=>sum+value,0)/Math.max(1,returns.length);
        const volatility=Math.sqrt(returns.reduce((sum,value)=>sum+(value-mean)**2,0)/Math.max(1,returns.length-1))*Math.sqrt(252);
        const volatilityScale=Math.max(.5,Math.min(1,.3/Math.max(.15,volatility)));
        return [{item,score:-raw*(.55+.45*evidence.evidenceScore),weightCap:.05*volatilityScale,evidence}];
      }).sort((a,b)=>b.score-a.score).slice(0,2):[];
      const targetWeights=new Map<number,number>();
      const chainWeights=new Map<string,number>();
      let remaining=.5;
      candidates.forEach(candidate=>{
        const chain=candidate.item.company.chain??"";
        const weight=Math.max(0,Math.min(candidate.weightCap,remaining,.25-(chainWeights.get(chain)??0)));
        targetWeights.set(candidate.item.company.id,weight);
        chainWeights.set(chain,(chainWeights.get(chain)??0)+weight);
        remaining-=weight;
      });
      const nav=portfolioValue(signalDate);
      for(const [id,position] of [...positions.entries()]) {
        if(position.quantity<0) continue;
        const item=histories.find(history=>history.company.id===id);
        const fill=item?.map.get(date);
        if(!item||!fill) continue;
        const targetValue=nav*(targetWeights.get(id)??0);
        const fillPrice=fill.close*item.fxScale*(1-slippage);
        const signalPrice=priceCny(item,signalDate);
        const currentValue=position.quantity*signalPrice;
        if(currentValue>targetValue*1.03) {
          const lot=item.company.market.includes("A股")?100:1;
          const quantity=targetValue<=0?position.quantity:Math.min(position.quantity,Math.floor((currentValue-targetValue)/signalPrice/lot)*lot);
          if(quantity>0) {
            const gross=quantity*fillPrice,fee=gross*commission;
            cash+=gross-fee;turnover+=gross;closedTrades++;if(fillPrice>position.avgCost) winningTrades++;
            position.quantity-=quantity;
            trades.push({date,name:item.company.name??item.company.ticker,side:"卖出",price:fillPrice,value:gross,reason:targetValue?"定期再平衡":"趋势或排名退出"});
            if(position.quantity<=0){positions.delete(id);if(entryDates.has(id)){holdingDays.push((Date.parse(date)-Date.parse(entryDates.get(id)!))/86400000);entryDates.delete(id);}}
          }
        }
      }
      for(const candidate of candidates) {
        const id=candidate.item.company.id,fill=candidate.item.map.get(date);
        if(!fill) continue;
        const position=positions.get(id);
        if(position&&position.quantity<0) continue;
        const fillPrice=fill.close*candidate.item.fxScale*(1+slippage);
        const signalPrice=priceCny(candidate.item,signalDate);
        const currentValue=Number(position?.quantity??0)*signalPrice;
        const targetValue=nav*Number(targetWeights.get(id)??0);
        if(targetValue>currentValue*1.03) {
          const lot=candidate.item.company.market.includes("A股")?100:1;
          const plannedQuantity=Math.floor((targetValue-currentValue)/signalPrice/lot)*lot;
          const quantity=Math.min(plannedQuantity,Math.floor(cash/(1+commission)/fillPrice/lot)*lot);
          if(quantity>0) {
            const gross=quantity*fillPrice,fee=gross*commission,total=gross+fee;
            cash-=total;turnover+=gross;
            const oldQty=Number(position?.quantity??0),nextQty=oldQty+quantity;
            positions.set(id,{quantity:nextQty,avgCost:(oldQty*Number(position?.avgCost??0)+total)/nextQty});
            if(!oldQty)entryDates.set(id,date);
            trades.push({date,name:candidate.item.company.name??candidate.item.company.ticker,side:"买入",price:fillPrice,value:gross,reason:`基本面 ${candidate.score.toFixed(2)}·证据 ${Math.round(candidate.evidence.evidenceScore*100)}分${cycleEnabled?`·景气仓位系数 ${candidate.cycleScale.toFixed(2)}`:""}`});
          }
        }
      }
      const existingShorts=[...positions.entries()].filter(([,position])=>position.quantity<0);
      let shortSlots=Math.max(0,2-existingShorts.length);
      let shortRemaining=Math.max(0,.1-existingShorts.reduce((sum,[id,position])=>sum+Math.abs(position.quantity)*priceCny(histories.find(item=>item.company.id===id)!,signalDate)/nav,0));
      for(const candidate of shortCandidates) {
        const id=candidate.item.company.id,fill=candidate.item.map.get(date);
        if(!fill||positions.has(id)||shortRemaining<=0||shortSlots<=0) continue;
        const fillPrice=fill.close*candidate.item.fxScale*(1-slippage);
        const targetValue=Math.min(nav*candidate.weightCap,nav*shortRemaining);
        const lot=candidate.item.company.market.includes("A股")?100:1;
        const quantity=Math.floor(targetValue/fillPrice/lot)*lot;
        if(quantity<=0) continue;
        const gross=quantity*fillPrice,fee=gross*commission;
        cash+=gross-fee;turnover+=gross;shortEntries++;
        positions.set(id,{quantity:-quantity,avgCost:fillPrice});
        entryDates.set(id,date);shortSlots--;
        shortRemaining-=gross/nav;
        trades.push({date,name:candidate.item.company.name??candidate.item.company.ticker,side:"模拟卖空",price:fillPrice,value:gross,reason:`负向驱动 ${candidate.score.toFixed(2)}·证据 ${Math.round(candidate.evidence.evidenceScore*100)}分·趋势确认`});
      }
    }
    const strategy=portfolioValue(date);
    const benchmark=initialCash*(benchmarkMembers.reduce((sum,member)=>{
      const close=Number(latestBar(member.item,date)?.close??member.start);
      return sum+close/member.start;
    },0)/Math.max(1,benchmarkMembers.length));
    peak=Math.max(peak,strategy);maxDrawdown=Math.min(maxDrawdown,strategy/peak-1);
    const grossExposure=[...positions.entries()].reduce((sum,[id,position])=>sum+Math.abs(position.quantity)*priceCny(histories.find(item=>item.company.id===id)!,date),0)/Math.max(1,strategy);
    curve.push({date,strategy,benchmark,cashBenchmark:initialCash+(benchmark-initialCash)*.5,grossExposure});
  }
  const finalValue=curve.at(-1)?.strategy??initialCash;
  const benchmarkValue=curve.at(-1)?.benchmark??initialCash;
  const cashBenchmarkValue=curve.at(-1)?.cashBenchmark??initialCash;
  const elapsedDays=Math.max(1,(new Date(curve.at(-1)?.date??"").getTime()-new Date(curve[0]?.date??"").getTime())/86400000);
  const dailyReturns=curve.slice(1).map((point,index)=>point.strategy/curve[index].strategy-1);
  const mean=dailyReturns.reduce((sum,value)=>sum+value,0)/Math.max(1,dailyReturns.length);
  const sd=Math.sqrt(dailyReturns.reduce((sum,value)=>sum+(value-mean)**2,0)/Math.max(1,dailyReturns.length-1));
  return {
    status:"complete",mode,inputId,generatedAt:new Date().toISOString(),period:{start:curve[0]?.date,end:curve.at(-1)?.date,calendarDays:Math.round(elapsedDays)},
    cycleAudit:{enabled:cycleEnabled,horizon,maDays,trendDays,observations:macroObservations.length,decisions:cycleAudit,coveredDecisions:cycleAudit.filter(row=>row.known).length,adjustedDecisions:cycleAudit.filter(row=>row.scale<1).length,averageGrossExposure:curve.reduce((sum,row)=>sum+row.grossExposure,0)/curve.length,averageClosedHoldingDays:holdingDays.length?holdingDays.reduce((sum,value)=>sum+value,0)/holdingDays.length:null,closedPositions:holdingDays.length,latest:[regionCycleAtDate("CN",dates.at(-1)!),regionCycleAtDate("US",dates.at(-1)!)],assumptions:cycleAssumptions},
    metrics:{initialCash,finalValue,totalReturn:finalValue/initialCash-1,annualizedReturn:(finalValue/initialCash)**(365/elapsedDays)-1,benchmarkReturn:benchmarkValue/initialCash-1,excessReturn:finalValue/benchmarkValue-1,cashAdjustedBenchmarkReturn:cashBenchmarkValue/initialCash-1,cashAdjustedExcessReturn:finalValue/cashBenchmarkValue-1,maxDrawdown,annualizedVolatility:sd*Math.sqrt(252),sharpe:sd?mean/sd*Math.sqrt(252):0,trades:trades.length,closedTrades,winRate:closedTrades?winningTrades/closedTrades:0,turnover:turnover/initialCash,shortEntries,borrowCosts},
    parameters:{requestedDays:safeDays,rebalanceDays,entryRule,entryRuleLabel:entryRule==="strict"?`MA${maDays}与${trendDays}日趋势同时通过`:`MA${maDays}或${trendDays}日趋势至少一项通过`,enableShorts,targetInvested:.5,maxPositions:6,maxPosition:.12,maxChain:.25,maxGrossShort:.1,maxShortPosition:.05,annualBorrowRate:.05,commissionBps:3,slippageBps:5,execution:"信号后一个共同交易日收盘价；数量以信号日价格计划，成交日限制可用现金",exitRules:["高置信反证","驱动净影响≤0",`收盘价低于MA${maDays}且${trendDays}日收益≤0`,"定期复核时退出不再符合入场条件的标的"]},
    universe:{requested:investable.length,tested:histories.length,names:histories.map(item=>item.company.name??item.company.ticker)},
    reconstructionAudit:mode==="reconstructed"?{
      currentProbabilitiesUsed:false,staticImpactMapUsed:true,
      method:"每个信号日仅纳入当日及以前公开的官方材料；按来源等级、事实置信度、驱动相关性与支持/限制方向，从50%的中性先验重新推导驱动概率。没有历史证据的驱动不参与当日评分。",
      firstPublication:firstReconstructedPublication,
      companies:histories.map(item=>{
        const companyFacts=reconstructionFacts.filter(fact=>fact.companyId===item.company.id);
        const publicationDates=[...new Set(companyFacts.map(fact=>fact.publicationDate).filter(Boolean))].sort();
        return {name:item.company.name??item.company.ticker,ticker:item.company.ticker,checkpoints:publicationDates.length,facts:companyFacts.length,first:publicationDates[0]??"",last:publicationDates.at(-1)??""};
      }),
    }:undefined,
    curve:curve.filter((_,index)=>index%5===0||index===curve.length-1),trades:trades.slice().reverse(),
    limitations:mode==="strict"?["严格模式使用信号日前最后模型快照，且事实同时满足文件公开日与核验日限制。","公司池仍为当前公司池，未完全消除幸存者偏差。","跨市场历史汇率尚未完整还原。"]:["驱动概率已按历史公开日逐日重算，没有使用今天的概率；但公司—驱动影响映射仍采用当前静态版本。","事实在原始文件公开日后才可使用，但无法证明当时研究者已经做出完全相同的提取与解读。","样本预先限定为英伟达、台积电、紫金矿业和中国广核，仍存在样本选择与幸存者偏差。","跨市场使用当前汇率折算历史价格。"],
  };
  }
  if(options.comparison){
    const variants=[{variantLabel:"短期趋势",horizon:"tactical" as const,cycle:false},{variantLabel:"短期趋势＋景气",horizon:"tactical" as const,cycle:true},{variantLabel:"中期趋势",horizon:"patient" as const,cycle:false},{variantLabel:"中期趋势＋景气",horizon:"patient" as const,cycle:true}];
    return {status:"comparison",generatedAt:new Date().toISOString(),inputId,inputSnapshot,results:variants.map(variant=>({...simulate({rebalanceDays:20,entryRule:"strict",enableShorts:false,...variant}),variantLabel:variant.variantLabel}))};
  }
  return simulate(options);
}

async function recordNav(accountId: number, snapshotDate = shanghaiDate()) {
  const account = await env.DB.prepare("SELECT cash FROM paper_accounts WHERE id=?").bind(accountId).first<{cash:number}>();
  const market = await env.DB.prepare(`SELECT COALESCE(SUM(p.quantity*q.price_cny),0) AS value
    FROM paper_positions p
    LEFT JOIN (
      SELECT company_id,price_cny FROM (
        SELECT company_id,price_cny,ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY price_date DESC,id DESC) AS rn
        FROM price_snapshots
      ) WHERE rn=1
    ) q ON q.company_id=p.company_id
    WHERE p.account_id=?`).bind(accountId).first<{value:number}>();
  const cash = Number(account?.cash ?? 0);
  const marketValue = Number(market?.value ?? 0);
  const existing = await env.DB.prepare("SELECT id FROM paper_nav_snapshots WHERE account_id=? AND snapshot_date=?")
    .bind(accountId,snapshotDate).first<{id:number}>();
  if (existing) {
    await env.DB.prepare("UPDATE paper_nav_snapshots SET cash=?,market_value=?,total_value=? WHERE id=?")
      .bind(cash,marketValue,cash+marketValue,existing.id).run();
  } else {
    await env.DB.prepare("INSERT INTO paper_nav_snapshots (account_id,snapshot_date,cash,market_value,total_value) VALUES (?,?,?,?,?)")
      .bind(accountId,snapshotDate,cash,marketValue,cash+marketValue).run();
  }
}

async function fillPendingOrders() {
  const orders = await env.DB.prepare(`SELECT o.*,a.cash,a.commission_bps AS commissionBps,
    a.slippage_bps AS slippageBps,q.price_cny AS priceCny,q.price_date AS priceDate
    FROM paper_orders o JOIN paper_accounts a ON a.id=o.account_id
    JOIN (
      SELECT company_id,price_cny,price_date FROM (
        SELECT company_id,price_cny,price_date,ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY price_date DESC,id DESC) AS rn
        FROM price_snapshots
      ) WHERE rn=1
    ) q ON q.company_id=o.company_id
    WHERE o.status='待成交' AND q.price_date>o.signal_date ORDER BY o.id`).all<Record<string,number|string>>();
  for (const order of orders.results) {
    const accountId = Number(order.account_id);
    const companyId = Number(order.company_id);
    const quantity = Number(order.quantity);
    const side = String(order.side);
    const rawPrice = Number(order.priceCny);
    const slippage = Number(order.slippageBps) / 10000;
    const fillPrice = rawPrice * (side === "买入" ? 1 + slippage : 1 - slippage);
    const gross = fillPrice * quantity;
    const fees = gross * Number(order.commissionBps) / 10000;
    const position = await env.DB.prepare("SELECT id,quantity,avg_cost_cny AS avgCost FROM paper_positions WHERE account_id=? AND company_id=?")
      .bind(accountId,companyId).first<{id:number;quantity:number;avgCost:number}>();
    if (side === "买入") {
      if (Number(order.cash) < gross + fees) {
        await env.DB.prepare("UPDATE paper_orders SET status='已拒绝',filled_at=?,rationale=rationale||'；现金不足' WHERE id=?")
          .bind(String(order.priceDate),Number(order.id)).run();
        continue;
      }
      const oldQty = Number(position?.quantity ?? 0);
      const nextQty = oldQty + quantity;
      const nextCost = (oldQty * Number(position?.avgCost ?? 0) + gross + fees) / nextQty;
      if (position) {
        await env.DB.prepare("UPDATE paper_positions SET quantity=?,avg_cost_cny=?,updated_at=datetime('now') WHERE id=?")
          .bind(nextQty,nextCost,position.id).run();
      } else {
        await env.DB.prepare("INSERT INTO paper_positions (account_id,company_id,quantity,avg_cost_cny,updated_at) VALUES (?,?,?,?,datetime('now'))")
          .bind(accountId,companyId,quantity,nextCost).run();
      }
      await env.DB.prepare("UPDATE paper_accounts SET cash=cash-? WHERE id=?").bind(gross+fees,accountId).run();
    } else {
      if (!position || Number(position.quantity) < quantity) {
        await env.DB.prepare("UPDATE paper_orders SET status='已拒绝',filled_at=?,rationale=rationale||'；可卖数量不足' WHERE id=?")
          .bind(String(order.priceDate),Number(order.id)).run();
        continue;
      }
      const nextQty = Number(position.quantity) - quantity;
      if (nextQty <= 0) {
        await env.DB.prepare("DELETE FROM paper_positions WHERE id=?").bind(position.id).run();
      } else {
        await env.DB.prepare("UPDATE paper_positions SET quantity=?,updated_at=datetime('now') WHERE id=?")
          .bind(nextQty,position.id).run();
      }
      await env.DB.prepare("UPDATE paper_accounts SET cash=cash+? WHERE id=?").bind(gross-fees,accountId).run();
    }
    await env.DB.prepare(`UPDATE paper_orders SET status='已成交',filled_at=?,
      filled_price_cny=?,fees=? WHERE id=?`).bind(String(order.priceDate),fillPrice,fees,Number(order.id)).run();
    await recordNav(accountId,String(order.priceDate));
  }
}

async function refreshQuotes() {
  const companies = await env.DB.prepare("SELECT id,ticker,market FROM companies ORDER BY id").all<CompanyRow>();
  const fxResponse = await fetch("https://api.frankfurter.dev/v1/latest?from=USD&to=CNY,HKD,EUR");
  if (!fxResponse.ok) throw new Error("跨市场汇率暂时不可用");
  const fxPayload = await fxResponse.json() as { rates?: { CNY?: number; HKD?: number; EUR?: number } };
  const usdCny = Number(fxPayload.rates?.CNY);
  const usdHkd = Number(fxPayload.rates?.HKD);
  const usdEur = Number(fxPayload.rates?.EUR);
  if (!Number.isFinite(usdCny) || !Number.isFinite(usdHkd) || !Number.isFinite(usdEur)) throw new Error("跨市场汇率字段不完整");
  const fx: Record<string,number> = { CNY: 1, USD: usdCny, HKD: usdCny / usdHkd, EUR: usdCny / usdEur };
  const symbols = companies.results.map(tencentCode);
  const requestedSymbols = symbols.filter(Boolean);
  const quoteResponse = await fetch(`https://qt.gtimg.cn/q=${requestedSymbols.join(",")}`);
  if (!quoteResponse.ok) throw new Error("延迟行情服务暂时不可用");
  const quoteText = await quoteResponse.text();
  const rowBySymbol = new Map<string,string[]>();
  quoteText.split(";").forEach(line => {
    const match = line.match(/v_([^=]+)="([^"]*)"/);
    if (match) rowBySymbol.set(match[1],match[2].split("~"));
  });
  const quotes = companies.results.flatMap((company,index) => {
    const symbol = symbols[index];
    const row = rowBySymbol.get(symbol);
    const price = Number(row?.[3]);
    const currency = company.market.includes("A股") ? "CNY" : company.market.includes("港股") ? "HKD" : company.market.includes("美股") ? "USD" : "EUR";
    if (!row || !Number.isFinite(price) || !fx[currency]) return [];
    const fxToCny = fx[currency];
    const rawDate = String(row[30] ?? "").replaceAll("/","-");
    const priceDate = /^\d{8}/.test(rawDate) ? `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}` : /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0,10) : shanghaiDate();
    return [{ companyId: company.id, symbol, price, currency, fxToCny, priceCny: price*fxToCny, priceDate } satisfies QuoteResult];
  });
  if (quotes.length) {
    await env.DB.batch(quotes.flatMap(quote => [
      env.DB.prepare("DELETE FROM price_snapshots WHERE company_id=? AND price_date=?").bind(quote.companyId,quote.priceDate),
      env.DB.prepare(`INSERT INTO price_snapshots
        (company_id,symbol,price,currency,fx_to_cny,price_cny,price_date,source,captured_at)
        VALUES (?,?,?,?,?,?,?,?,datetime('now'))`)
        .bind(quote.companyId,quote.symbol,quote.price,quote.currency,quote.fxToCny,quote.priceCny,quote.priceDate,"腾讯证券延迟行情"),
    ]));
  }
  await recordStrategyModelSnapshot();
  await fillPendingOrders();
  const account = await env.DB.prepare("SELECT id FROM paper_accounts LIMIT 1").first<{id:number}>();
  if (account) await recordNav(account.id);
  return {
    updated: quotes.length,
    failed: companies.results.length-quotes.length,
    failures: companies.results.filter((_,index) => !symbols[index] || !rowBySymbol.has(symbols[index]))
      .slice(0,5).map(company => ({ ticker: company.ticker, reason: "行情源未返回该标的" })),
  };
}

async function all() {
  const [account,positions,orders,quotes,nav,snapshots] = await Promise.all([
    env.DB.prepare("SELECT id,name,base_currency AS baseCurrency,initial_cash AS initialCash,cash,commission_bps AS commissionBps,slippage_bps AS slippageBps,created_at AS createdAt FROM paper_accounts LIMIT 1").first(),
    env.DB.prepare(`SELECT p.id,p.account_id AS accountId,p.company_id AS companyId,p.quantity,
      p.avg_cost_cny AS avgCostCny,p.updated_at AS updatedAt,
      c.name,c.ticker,c.market,c.color,q.price_cny AS lastPriceCny,q.price_date AS priceDate
      FROM paper_positions p JOIN companies c ON c.id=p.company_id
      LEFT JOIN (
        SELECT company_id,price_cny,price_date FROM (
          SELECT company_id,price_cny,price_date,ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY price_date DESC,id DESC) AS rn
          FROM price_snapshots
        ) WHERE rn=1
      ) q ON q.company_id=p.company_id ORDER BY p.id`).all(),
    env.DB.prepare(`SELECT o.id,o.account_id AS accountId,o.company_id AS companyId,o.side,o.quantity,
      o.signal_date AS signalDate,o.signal_price_cny AS signalPriceCny,o.status,
      o.submitted_at AS submittedAt,o.filled_at AS filledAt,o.filled_price_cny AS filledPriceCny,
      o.fees,o.rationale,o.driver_name AS driverName,c.name,c.ticker
      FROM paper_orders o JOIN companies c ON c.id=o.company_id ORDER BY o.id DESC LIMIT 100`).all(),
    latestQuotes(),
    env.DB.prepare("SELECT id,account_id AS accountId,snapshot_date AS snapshotDate,cash,market_value AS marketValue,total_value AS totalValue FROM paper_nav_snapshots ORDER BY snapshot_date,id").all(),
    env.DB.prepare(`SELECT id,order_id AS orderId,company_id AS companyId,snapshot_date AS snapshotDate,
      research_score AS researchScore,evidence_coverage AS evidenceCoverage,
      benchmark_symbol AS benchmarkSymbol,horizon,invalidation,thesis,created_at AS createdAt
      FROM research_snapshots ORDER BY id DESC LIMIT 100`).all(),
  ]);
  return { account,positions:positions.results,orders:orders.results,quotes:quotes.results,nav:nav.results,snapshots:snapshots.results };
}

export async function GET(request: Request) {
  try {
    await init();
    const url = new URL(request.url);
    if (url.searchParams.get("action") === "market") return Response.json({ indices: await fetchMarketOverview() });
    if (url.searchParams.get("action") === "backtest") {
      const mode=url.searchParams.get("mode")==="reconstructed"?"reconstructed":"strict";
      await recordStrategyModelSnapshot();
      const rebalanceDays=Number(url.searchParams.get("rebalanceDays")??20);
      const entryRule=url.searchParams.get("entryRule")==="balanced"?"balanced":"strict";
      const enableShorts=url.searchParams.get("shorts")==="1";
      const comparison=url.searchParams.get("comparison")==="cycle";
      const horizon=url.searchParams.get("horizon")==="patient"?"patient":"tactical";
      const cycle=url.searchParams.get("cycle")==="1";
      return Response.json(await runBacktest(Number(url.searchParams.get("days") ?? 300),mode,{rebalanceDays,entryRule,enableShorts,comparison,horizon,cycle}));
    }
    if (url.searchParams.get("action") === "history") {
      const companyId = Number(url.searchParams.get("companyId"));
      const company = await env.DB.prepare("SELECT id,ticker,market FROM companies WHERE id=?").bind(companyId).first<CompanyRow>();
      if (!company) return Response.json({ error:"公司不存在" },{ status:404 });
      return Response.json({ companyId,bars:await fetchHistory(company,Number(url.searchParams.get("days") ?? 120)) });
    }
    return Response.json(await all());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "模拟盘读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await init();
    const payload = await request.json() as Record<string,string|number>;
    if (payload.kind === "refresh") {
      const refresh = await refreshQuotes();
      return Response.json({ ...await all(), refresh });
    }
    if (payload.kind === "cancel") {
      await env.DB.prepare("UPDATE paper_orders SET status='已取消' WHERE id=? AND status='待成交'")
        .bind(Number(payload.orderId)).run();
      return Response.json(await all());
    }
    if (payload.kind === "order") {
      const account = await env.DB.prepare("SELECT id FROM paper_accounts LIMIT 1").first<{id:number}>();
      const companyId = Number(payload.companyId);
      const quantity = Number(payload.quantity);
      const side = String(payload.side);
      if (!account || !companyId || !Number.isFinite(quantity) || quantity <= 0 || !["买入","卖出"].includes(side)) {
        return Response.json({ error: "订单参数不完整" }, { status: 400 });
      }
      const company = await env.DB.prepare("SELECT id,ticker,market FROM companies WHERE id=?").bind(companyId).first<CompanyRow>();
      if (side === "买入" && company?.market.includes("A股") && quantity % 100 !== 0) {
        return Response.json({ error: "A股买入数量需为100股的整数倍" }, { status: 400 });
      }
      const quote = await env.DB.prepare(`SELECT price_cny AS priceCny,price_date AS priceDate
        FROM price_snapshots WHERE company_id=? ORDER BY price_date DESC,id DESC LIMIT 1`)
        .bind(companyId).first<{priceCny:number;priceDate:string}>();
      if (!quote) return Response.json({ error: "请先刷新行情，再提交模拟订单" }, { status: 400 });
      const orderResult = await env.DB.prepare(`INSERT INTO paper_orders
        (account_id,company_id,side,quantity,signal_date,signal_price_cny,status,submitted_at,rationale,driver_name)
        VALUES (?,?,?,?,?,?,'待成交',datetime('now'),?,?)`)
        .bind(account.id,companyId,side,quantity,shanghaiDate(),quote.priceCny,String(payload.rationale ?? ""),String(payload.driverName ?? "")).run();
      const orderId=Number(orderResult.meta.last_row_id);
      const benchmark=company?.market.includes("A股")?"沪深300":company?.market.includes("港股")?"恒生指数":"标普500";
      await env.DB.prepare(`INSERT INTO research_snapshots
        (order_id,company_id,snapshot_date,research_score,evidence_coverage,benchmark_symbol,horizon,invalidation,thesis,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))`)
        .bind(orderId,companyId,shanghaiDate(),Number(payload.researchScore??0),Number(payload.evidenceCoverage??0),benchmark,String(payload.horizon??"中期"),String(payload.invalidation??""),String(payload.rationale??"")).run();
      return Response.json(await all(), { status: 201 });
    }
    return Response.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "模拟盘操作失败" }, { status: 500 });
  }
}
