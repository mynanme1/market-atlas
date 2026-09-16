export type MacroRegion = "CN" | "US";
export type MacroObservation = {region:MacroRegion;period:string;publishedOn:string;pmi:number;previousPmi:number;source:string;sourceUrl:string};
// Supply licensed observations explicitly; no historical feed is bundled.
export const macroObservations:MacroObservation[]=[];
export const cycleAssumptions={
  version:"manufacturing-pmi-v1-20260908",
  description:"制造业景气代理；不等同于整体经济周期。只调整多头目标仓位，不改变公司证据评分。",
  availability:"仅使用信号日之前已发布的当期数值；发布日期当天不使用；超过65日视为缺失。",
  missingPolicy:"未知地区、缺失或过期数据不调整仓位，并单独报告覆盖不足。",
  rule:"PMI≥50且未下降：原仓位×1；PMI≥50但下降：×0.85；PMI<50但回升：×0.85；PMI<50且未回升：×0.65。权重为待检验假设，未按回测收益优化。",
  limitations:["开源版未附宏观历史数据，默认显示未知。","通胀、利率、信用、库存与公司行业周期尚未进入该模型。","地区权重与敏感度为研究假设，不是收入占比估计或历史拟合值。","原始来源可追溯，但本次整理发生在事后；整体回测仍属于事后重建。"],
};
export const companyCycleExposures:Record<string,{weights:Partial<Record<MacroRegion,number>>;sensitivity:number;reason:string}>={
  NVDA:{weights:{US:1},sensitivity:1,reason:"以美国制造业作为需求环境代理；不能替代AI资本开支数据。"},
  TSM:{weights:{US:1},sensitivity:1,reason:"以美国需求环境作为全球半导体需求的粗略代理；未还原地区收入结构。"},
  "601899":{weights:{CN:.5,US:.5},sensitivity:1,reason:"中美各半作为工业需求情景假设；未单列黄金与铜周期。"},
  "003816":{weights:{CN:1},sensitivity:.25,reason:"电力业务按低制造业敏感度假设处理；并非估计的统计系数。"},
};
export function regionCycleAtDate(region:MacroRegion,date:string,observations=macroObservations){
  const latest=observations.filter(row=>row.region===region&&row.publishedOn<date).sort((a,b)=>b.publishedOn.localeCompare(a.publishedOn))[0];
  if(!latest||(Date.parse(date)-Date.parse(latest.publishedOn))/86400000>65)return {region,known:false,label:"数据不足",scale:1,observation:null};
  const expanding=latest.pmi>=50,improving=latest.pmi>latest.previousPmi;
  const label=expanding?(latest.pmi<latest.previousPmi?"扩张放缓":"扩张持稳或加快"):(improving?"收缩改善":"收缩持稳或加深");
  const scale=expanding?(latest.pmi<latest.previousPmi?.85:1):(improving?.85:.65);
  return {region,known:true,label,scale,observation:latest};
}
export function companyCycleAtDate(ticker:string,date:string,observations=macroObservations){
  const exposure=companyCycleExposures[ticker];
  if(!exposure)return {scale:1,known:false,reason:"未配置地区暴露",regions:[]};
  const regions=Object.entries(exposure.weights).map(([region,weight])=>({...regionCycleAtDate(region as MacroRegion,date,observations),weight:weight!}));
  const weighted=regions.reduce((sum,region)=>sum+region.scale*region.weight,0);
  return {scale:1-exposure.sensitivity*(1-weighted),known:regions.every(region=>region.known),reason:exposure.reason,regions};
}
export function trendAtDate(bars:Array<{date:string;close:number}>,date:string,horizon:"tactical"|"patient"){
  const history=bars.filter(bar=>bar.date<=date);
  const maDays=horizon==="patient"?60:20,returnDays=horizon==="patient"?120:60;
  // N-day return requires N+1 observations.
  if(history.length<returnDays+1)return null;
  const latest=history.at(-1)!.close;
  const average=history.slice(-maDays).reduce((sum,bar)=>sum+bar.close,0)/maDays;
  return {latest,average,returnValue:latest/history.at(-(returnDays+1))!.close-1,maDays,returnDays};
}
