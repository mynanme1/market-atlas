export const executionRules = {
  version: "daily-staged-v1-20260908",
  entryConfirmDays: 2, entryBuffer: .01, addWaitBars: 5, trimConfirmDays: 2,
  exitConfirmDays: 3, trailingDrawdown: .12, cooldownBars: 5,
  initialFraction: .5, commission: .0003, slippage: .0005,
  maxStock: .12, maxChain: .25, maxGross: .5, maxNames: 6,
};
const sum = values => values.reduce((a,b)=>a+b,0);
const tierWeight = tier => /^(A)/.test(tier)||/一级|法定披露|交易所/.test(tier)?1:/二级|公司官方/.test(tier)?.85:.65;

// Preserve the archived research model in all controls; only execution is varied.
export function researchAt(input, company, date) {
  const companyIds=new Set(input.histories.map(h=>h.company.id));
  const available=new Map(input.facts.filter(f=>companyIds.has(f.companyId)&&f.publicationDate&&f.publicationDate<=date).map(f=>[f.id,f]));
  const probabilities=new Map();
  for(const driver of input.drivers){
    const links=input.links.filter(l=>l.driverId===driver.id&&available.has(l.factId));
    let weight=0,signed=0;
    for(const link of links){const fact=available.get(link.factId);const w=fact.confidence/5*link.relevance/5*tierWeight(fact.sourceTier);weight+=w;signed+=w*(link.stance==="支持"?1:link.stance==="相关背景"?.25:link.stance==="限制"?-.65:-1);}
    if(weight)probabilities.set(driver.id,Math.max(20,Math.min(80,50+30*Math.max(-1,Math.min(1,signed/weight))*(1-Math.exp(-weight/2)))));
  }
  const impacts=input.impacts.filter(i=>i.targetKey===company.ticker&&probabilities.has(i.driverId));
  const ids=[...new Set(impacts.map(i=>i.driverId))];
  const raw=sum(impacts.map(i=>(i.direction==="利好"?1:i.direction==="利空"?-1:0)*i.strength*probabilities.get(i.driverId)/100));
  const links=input.links.filter(l=>ids.includes(l.driverId)&&available.get(l.factId)?.companyId===company.id);
  const weights=links.map(l=>{const f=available.get(l.factId);return f.confidence/5*l.relevance/5*tierWeight(f.sourceTier);});
  const coverage=ids.length?ids.filter(id=>links.some(l=>l.driverId===id)).length/ids.length:0;
  const quality=weights.length?sum(weights)/weights.length:0;
  let support=0,limit=0;
  links.forEach((l,i)=>{if(l.stance==="限制"||l.stance==="反证")limit+=weights[i];else support+=weights[i]*(l.stance==="支持"?1:.35);});
  const total=support+limit,thesisSupport=total?Math.max(0,Math.min(1,(support-limit+total)/(2*total))):0;
  const evidence=.3*coverage+.4*quality+.3*thesisSupport;
  const counter=links.some(l=>l.stance==="反证"&&available.get(l.factId).confidence>=4&&l.relevance>=4);
  return {raw,score:raw*(.55+.45*evidence),evidence,counter,known:ids.length>0};
}

export function technicalAt(bars,date){
  const rows=bars.filter(b=>b.date<=date),n=rows.length;
  if(n<61)return null;
  const meanAt=(end,period)=>sum(rows.slice(end-period+1,end+1).map(b=>b.close))/period;
  const close=rows.at(-1).close,ma20=meanAt(n-1,20),ma60=meanAt(n-1,60),return60=close/rows[n-61].close-1;
  const consecutive=(count,period,buffer=0,above=false)=>n>=period+count-1&&rows.slice(-count).every((b,i)=>above?b.close>=meanAt(n-count+i,period)*(1+buffer):b.close<meanAt(n-count+i,period));
  const changes=rows.slice(-60).slice(1).map((b,i)=>b.close/rows.slice(-60)[i].close-1);
  const mean=sum(changes)/changes.length,vol=Math.sqrt(sum(changes.map(v=>(v-mean)**2))/(changes.length-1))*Math.sqrt(252);
  return {close,ma20,ma60,return60,barIndex:n-1,date:rows.at(-1).date,
    basicEntry:close>=ma20&&return60>0,
    confirmed:consecutive(executionRules.entryConfirmDays,20,executionRules.entryBuffer,true)&&return60>0,
    trim:consecutive(executionRules.trimConfirmDays,20),exit:consecutive(executionRules.exitConfirmDays,60),
    volatilityScale:Math.max(.5,Math.min(1,.3/Math.max(.15,vol)))};
}

export function familyTechnical(bars,date){
  const rows=bars.filter(b=>b.date<=date),n=rows.length;if(n<125)return null;
  const mean=(end,count)=>sum(rows.slice(end-count+1,end+1).map(b=>b.close))/count;
  const close=rows.at(-1).close,ma60=mean(n-1,60),ma120=mean(n-1,120);
  const changes=rows.slice(-15).slice(1).map((b,i)=>b.close-rows.slice(-15)[i].close);
  const gains=sum(changes.map(x=>Math.max(0,x))),losses=sum(changes.map(x=>Math.max(0,-x)));
  return {close,ma60,ma120,return120:close/rows[n-121].close-1,
    high60:Math.max(...rows.slice(-61,-1).map(b=>b.close)),low20:Math.min(...rows.slice(-21,-1).map(b=>b.close)),
    rsi:gains+losses?100*gains/(gains+losses):50,
    below60Five:rows.slice(-5).every((b,i)=>b.close<mean(n-5+i,60)),below120Five:rows.slice(-5).every((b,i)=>b.close<mean(n-5+i,120))};
}

export function adaptiveAction(position,technical,research){
  if(research.counter||research.known&&research.raw<=0)return {action:"exit",reason:"论点失效：反证或净驱动转为非正"};
  if(!technical)return {action:"hold",reason:"趋势数据不足"};
  if(technical.close/position.peakClose-1<=-executionRules.trailingDrawdown)return {action:"exit",reason:"持仓后收盘高点回撤达到12%"};
  if(technical.exit)return {action:"exit",reason:"连续3个交易日跌破MA60"};
  if(technical.trim&&!position.reduced)return {action:"trim",reason:"连续2个交易日跌破MA20，减半一次"};
  if(technical.confirmed&&technical.barIndex-position.lastActionIndex>=executionRules.addWaitBars&&(position.reduced||position.stage<1))return {action:"add",reason:"趋势重新确认且等待5个交易日，恢复目标仓位"};
  return {action:"hold",reason:"维持持仓"};
}

export function runExecutionComparison(input,inputId){
  const frequency=new Map();
  input.histories.forEach(h=>h.bars.forEach(b=>frequency.set(b.date,(frequency.get(b.date)??0)+1)));
  const common=[...frequency].filter(([,n])=>n>=Math.ceil(input.histories.length*.6)).map(([d])=>d).sort();
  const ids=new Set(input.histories.map(h=>h.company.id));
  const firstFact=input.facts.filter(f=>ids.has(f.companyId)&&f.publicationDate).map(f=>f.publicationDate).sort()[0];
  const start=common.find(d=>d>=firstFact&&input.histories.every(h=>h.bars.filter(b=>b.date<=d).length>=121));
  const end=common.at(-1);
  if(!start||!end)throw new Error("冻结数据不足以完成预热");
  const variants=[
    {key:"baseline",label:"原规则 · 20日复核",adaptive:false,daily:false,calendar:"common"},
    {key:"daily",label:"原规则 · 每日复核",adaptive:false,daily:true,calendar:"common"},
    {key:"staged",label:"分级买卖 · 每日复核",adaptive:true,daily:true,calendar:"common"},
    {key:"local",label:"分级买卖 · 各市场交易日",adaptive:true,daily:true,calendar:"local"},
  ];
  return {status:"complete",generatedAt:new Date().toISOString(),inputId,engineVersion:executionRules.version,rules:executionRules,
    period:{start,end},results:variants.map(variant=>simulate(input,inputId,variant,start,end,common)),
    limitations:["沿用2026-09-08保存的四家公司数据；未刷新当前行情或下单。","前三组共用原共同交易日；第四组增加各市场自身交易日，单独展示日历影响。","事实按公开日进入，但事实解读、公司—驱动映射仍为事后重建；未补入历史估值或一致预期。","发布日期仅精确到日，历史汇率及分红、涨跌停成交约束尚未完整还原。","新规则阈值为事前固定的实验假设；同一历史窗口的反复开发仍有过拟合风险，未构成样本外验证。"]};
}

export function simulate(input,inputId,variant,start,end,common){
  const equalWeight=variant.equalWeight??.12;
  if(!Number.isFinite(equalWeight)||equalWeight<=0||equalWeight>.12)throw new Error("等权单股目标必须在0至12%之间");
  const histories=input.histories.map(h=>({...h,map:new Map(h.bars.map(b=>[b.date,b]))}));
  const allDates=[...new Set(histories.flatMap(h=>h.bars.map(b=>b.date)))].sort();
  const dates=(variant.calendar==="local"?allDates:common).filter(d=>d>=start&&d<=end);
  const commission=executionRules.commission*(variant.costMultiplier??1),slippage=executionRules.slippage*(variant.costMultiplier??1);
  const positions=new Map(),lastExit=new Map(),trades=[],curve=[],roundTrips=[],signalLog=[];
  let cash=1e6,fees=0,turnover=0,peak=1e6,maxDrawdown=0,reentries=0;
  const lastBar=(h,d)=>h.bars.filter(b=>b.date<=d).at(-1);
  const price=(h,d)=>lastBar(h,d).close*h.fxScale;
  const value=d=>cash+sum([...positions].map(([id,p])=>p.quantity*price(histories.find(h=>h.company.id===id),d)));
  const exposure=d=>sum([...positions].map(([id,p])=>p.quantity*price(histories.find(h=>h.company.id===id),d)));
  const chainValue=(chain,d)=>sum([...positions].map(([id,p])=>{const h=histories.find(h=>h.company.id===id);return h.company.chain===chain?p.quantity*price(h,d):0;}));
  function sell(h,quantity,date,signalDate,reason,partial=false){
    const p=positions.get(h.company.id);if(!p||quantity<=0)return;
    quantity=Math.min(quantity,p.quantity);
    const fill=h.map.get(date).close*h.fxScale*(1-slippage),gross=quantity*fill,fee=gross*commission;
    cash+=gross-fee;fees+=fee;turnover+=gross;p.quantity-=quantity;p.proceeds+=gross-fee;
    trades.push({date,signalDate,ticker:h.company.ticker,name:h.company.name,side:"卖出",quantity,price:fill,value:gross,fee,reason});
    if(p.quantity===0){roundTrips.push({ticker:h.company.ticker,name:h.company.name,entry:p.entryDate,exit:date,pnl:p.proceeds-p.cost,holdingDays:(Date.parse(date)-Date.parse(p.entryDate))/86400000,profitGiveback:Math.max(0,p.peakPnl-Math.max(0,p.proceeds-p.cost))});positions.delete(h.company.id);lastExit.set(h.company.id,{date,barIndex:h.bars.findIndex(b=>b.date===date)});}
    else if(partial){p.reduced=true;p.stage=.5;p.lastActionIndex=h.bars.findIndex(b=>b.date===date);}
  }
  function buy(h,quantity,date,signalDate,reason,stage){
    if(quantity<=0)return;
    const fill=h.map.get(date).close*h.fxScale*(1+slippage),lot=h.company.market.includes("A股")?100:1;
    quantity=Math.min(quantity,Math.floor(cash/(1+commission)/fill/lot)*lot);if(quantity<=0)return;
    const gross=quantity*fill,fee=gross*commission;cash-=gross+fee;fees+=fee;turnover+=gross;
    let p=positions.get(h.company.id);
    if(!p){const prior=lastExit.get(h.company.id);if(prior&&(Date.parse(date)-Date.parse(prior.date))/86400000<=20)reentries++;
      p={quantity:0,cost:0,proceeds:0,entryDate:date,peakClose:h.map.get(date).close,peakPnl:0,reduced:false,stage,lastActionIndex:0};positions.set(h.company.id,p);}
    p.quantity+=quantity;p.cost+=gross+fee;p.stage=stage;p.reduced=false;p.lastActionIndex=h.bars.findIndex(b=>b.date===date);
    trades.push({date,signalDate,ticker:h.company.ticker,name:h.company.name,side:"买入",quantity,price:fill,value:gross,fee,reason});
  }
  for(let i=0;i<dates.length;i++){
    const date=dates[i],signalDate=dates[i-1],acted=new Set();
    const frozenSignalNav=i>0&&variant.signalNavOnly?value(signalDate):null;
    const offset=variant.reviewOffset??0;
    const review=i>offset&&(i-1-offset)%20===0;
    const weekly=i>offset&&(i-1-offset)%5===0;
    const signals=new Map();
    if(i>0)for(const h of histories){const r=variant.researchAt?variant.researchAt(h.company,signalDate):researchAt(input,h.company,signalDate),t=technicalAt(h.bars,signalDate);signals.set(h.company.id,{r,t});}
    if(i>0)for(const [id,p] of [...positions]){
      const h=histories.find(h=>h.company.id===id),{r,t}=signals.get(id);if(!h.map.has(date))continue;
      if(t)p.peakClose=Math.max(p.peakClose,t.close);
      let action;
      if(variant.family){
        const f=familyTechnical(h.bars,signalDate);
        const thesis=["thesis","slow"].includes(variant.family)&&(r.counter||r.known&&r.raw<=0);
        const technicalExit=f&&(variant.family==="slow"?f.below60Five&&f.return120<=0:variant.family==="breakout"?f.close<f.low20:variant.family==="pullback"?f.rsi>=55||f.below120Five:false);
        action={action:thesis||technicalExit?"exit":"hold",reason:thesis?"公司论点失效":variant.family==="slow"?"连续5日低于MA60且120日收益非正":variant.family==="breakout"?"跌破前20日最低收盘价":"回撤修复或长期趋势破坏"};
      }
      else if(variant.adaptive)action=adaptiveAction(p,t,r);
      else action={action:r.counter||r.known&&r.raw<=0||t&&t.close<t.ma20&&t.return60<=0?"exit":"hold",reason:r.counter?"高置信反证":r.known&&r.raw<=0?"驱动净影响转负":"MA20与60日趋势同时转弱"};
      if(variant.positionAction){const extra=variant.positionAction({...p},t,r,{company:h.company,signalDate,executionDate:date});if(extra?.action==="exit")action=extra;}
      if(action.action==="exit"){sell(h,p.quantity,date,signalDate,action.reason);acted.add(id);}
      if(action.action==="trim"){
        const lot=h.company.market.includes("A股")?100:1;
        const quantity=Math.floor(p.quantity/2/lot)*lot;
        // Too small to halve: retain the position until a full-exit condition.
        if(quantity>0){sell(h,quantity,date,signalDate,action.reason,true);acted.add(id);}
      }
    }
    if(i>0&&(variant.daily||review||variant.family==="slow"&&weekly)){
      const nav=frozenSignalNav??value(signalDate);
      const candidates=histories.flatMap(h=>{
        // Keep the research universe and market calendar fixed in exclusion tests.
        if(variant.excludedTickers?.includes(h.company.ticker))return [];
        const {r,t}=signals.get(h.company.id),p=positions.get(h.company.id);
        // A market holiday prevents execution, not membership in a momentum ranking.
        if(!t||!variant.family&&!h.map.has(date))return [];
        if(variant.family){
          const f=familyTechnical(h.bars,signalDate);if(!f)return [];
          if(["thesis","slow"].includes(variant.family)&&(!r.known||r.raw<1&&(!p||!variant.researchAt)||r.counter))return [];
          if(!p&&variant.family==="slow"&&!(f.close>=f.ma60*1.02&&f.return120>0))return [];
          if(!p&&variant.family==="breakout"&&!(f.close>f.high60*1.005))return [];
          if(!p&&variant.family==="pullback"&&!(f.close>f.ma120&&f.rsi<35))return [];
          if(variant.family==="momentum"&&f.return120<=0)return [];
          // Optional matched-control entry gate; never changes held-position sizing or exits.
          if(!p&&h.map.has(date)&&variant.entryFilter&&!variant.entryFilter(h.company,signalDate,date,{lastExit:lastExit.get(h.company.id),barIndex:t.barIndex}))return [];
          return [{h,r:{...r,score:variant.family==="momentum"?f.return120:["thesis","slow"].includes(variant.family)?r.score:0},t,cap:variant.positionCap?variant.positionCap(r,t,{company:h.company,signalDate,executionDate:date}):variant.family==="equal"?equalWeight:.12*(["thesis","slow"].includes(variant.family)?r.evidence>=.7?1:r.evidence>=.4?.5:.25:1)*t.volatilityScale}];
        }
        if(!r.known||r.raw<1||r.counter)return [];
        if(!variant.adaptive&&!t.basicEntry)return [];
        if(variant.adaptive&&!p&&(!t.confirmed||t.exit))return [];
        const evidenceScale=r.evidence>=.7?1:r.evidence>=.4?.5:.25;
        return [{h,r,t,cap:.12*evidenceScale*t.volatilityScale}];
      }).sort((a,b)=>b.r.score-a.r.score);
      if(variant.family){
        const selected=variant.family==="momentum"?candidates.slice(0,2):candidates;
        if(review)for(const[id,p]of [...positions]){
          const h=histories.find(h=>h.company.id===id);if(!h.map.has(date)||acted.has(id))continue;
          const c=selected.find(c=>c.h.company.id===id);
          if(variant.family==="momentum"&&!c){sell(h,p.quantity,date,signalDate,"月度动量排名退出");acted.add(id);continue;}
          const current=p.quantity*price(h,signalDate),target=nav*(c?.cap??.12);
          const excess=Math.max(current-target,chainValue(h.company.chain,signalDate)-nav*.25,exposure(signalDate)-nav*.5,0),lot=h.company.market.includes("A股")?100:1;
          if(excess>current*.1){sell(h,Math.min(p.quantity,Math.ceil(excess/price(h,signalDate)/lot)*lot),date,signalDate,"低频仓位复核：超出目标10%后减仓");acted.add(id);}
        }
        for(const c of selected){
          const id=c.h.company.id,p=positions.get(id);if(!c.h.map.has(date)||acted.has(id)||!p&&positions.size>=6)continue;
          // Existing holdings are topped up only at portfolio review, never on every price tick.
          if(p&&!review)continue;
          const current=(p?.quantity??0)*price(c.h,signalDate),target=nav*c.cap;
          if(p&&target<=current*1.1)continue;
          const budget=Math.max(0,Math.min(target-current,nav*.25-chainValue(c.h.company.chain,signalDate),nav*.5-exposure(signalDate))),lot=c.h.company.market.includes("A股")?100:1;
          buy(c.h,Math.floor(budget/price(c.h,signalDate)/lot)*lot,date,signalDate,p?"低频补足目标仓位":`${variant.label}条件确认`,1);
        }
      }
      else if(!variant.adaptive){
        const weights=new Map(),chains=new Map();let remaining=.5;
        for(const c of candidates.slice(0,6)){const weight=Math.max(0,Math.min(c.cap,remaining,.25-(chains.get(c.h.company.chain)??0)));weights.set(c.h.company.id,weight);chains.set(c.h.company.chain,(chains.get(c.h.company.chain)??0)+weight);remaining-=weight;}
        for(const [id,p]of [...positions]){
          const h=histories.find(h=>h.company.id===id);if(!h.map.has(date))continue;
          const target=nav*(weights.get(id)??0),current=p.quantity*price(h,signalDate),lot=h.company.market.includes("A股")?100:1;
          if(current>target*1.03)sell(h,target<=0?p.quantity:Math.min(p.quantity,Math.floor((current-target)/price(h,signalDate)/lot)*lot),date,signalDate,target?"定期再平衡":"趋势或排名退出");
        }
        for(const c of candidates.slice(0,6)){const current=(positions.get(c.h.company.id)?.quantity??0)*price(c.h,signalDate),target=nav*(weights.get(c.h.company.id)??0),lot=c.h.company.market.includes("A股")?100:1;if(target>current*1.03)buy(c.h,Math.floor((target-current)/price(c.h,signalDate)/lot)*lot,date,signalDate,"原规则入场或再平衡",1);}
      }else{
        // Holding decisions do not reuse the entry filter; review only restores risk caps.
        if(review)for(const[id,p]of [...positions]){
          if(acted.has(id))continue;const h=histories.find(h=>h.company.id===id);if(!h.map.has(date))continue;
          const c=candidates.find(c=>c.h.company.id===id),current=p.quantity*price(h,signalDate);
          const stockCap=nav*(c?.cap??.12)*(p.reduced?.5:p.stage);
          const excess=Math.max(current-stockCap,chainValue(h.company.chain,signalDate)-nav*.25,exposure(signalDate)-nav*.5,0);
          const lot=h.company.market.includes("A股")?100:1;
          if(excess>current*.03){const quantity=Math.min(p.quantity,Math.ceil(excess/price(h,signalDate)/lot)*lot);sell(h,quantity,date,signalDate,"20日组合复核：降低超出上限的仓位");acted.add(id);}
        }
        for(const c of candidates){
          const id=c.h.company.id,p=positions.get(id);if(acted.has(id))continue;
          if(!p&&positions.size>=6)continue;
          const exit=lastExit.get(id);if(!p&&exit&&c.t.barIndex-exit.barIndex<executionRules.cooldownBars)continue;
          const action=p?adaptiveAction(p,c.t,c.r):{action:"enter"};
          if(p&&action.action!=="add")continue;
          const stage=p?1:.5,current=(p?.quantity??0)*price(c.h,signalDate);
          const budget=Math.max(0,Math.min(nav*c.cap*stage-current,nav*.25-chainValue(c.h.company.chain,signalDate),nav*.5-exposure(signalDate)));
          const lot=c.h.company.market.includes("A股")?100:1;
          buy(c.h,Math.floor(budget/price(c.h,signalDate)/lot)*lot,date,signalDate,p?"确认恢复/补足仓位":"连续2日站上MA20上方1%，半仓进入",stage);
        }
      }
      signalLog.push({signalDate,executionDate:date,eligible:candidates.map(c=>c.h.company.ticker),review});
    }
    for(const[id,p]of positions){const h=histories.find(h=>h.company.id===id);p.peakClose=Math.max(p.peakClose,lastBar(h,date).close);p.peakPnl=Math.max(p.peakPnl,p.proceeds+p.quantity*price(h,date)-p.cost);}
    const nav=value(date);peak=Math.max(peak,nav);maxDrawdown=Math.min(maxDrawdown,nav/peak-1);
    curve.push({date,value:nav,exposure:exposure(date)/nav});
  }
  const finalValue=curve.at(-1).value;
  return {key:variant.key,label:variant.label,inputId,period:{start,end},calendar:variant.calendar,
    metrics:{initialCash:1e6,finalValue,totalReturn:finalValue/1e6-1,maxDrawdown,averageExposure:sum(curve.map(r=>r.exposure))/curve.length,trades:trades.length,fees,turnover:turnover/1e6,closedPositions:roundTrips.length,losingShortHolds:roundTrips.filter(r=>r.pnl<0&&r.holdingDays<=20).length,reentriesWithin20CalendarDays:reentries,closedProfitGiveback:sum(roundTrips.map(r=>r.profitGiveback))},
    trades,roundTrips,curve,signalLog,openPositions:[...positions].map(([id,p])=>({ticker:histories.find(h=>h.company.id===id).company.ticker,quantity:p.quantity,entryDate:p.entryDate,stage:p.stage,reduced:p.reduced})),
  };
}
