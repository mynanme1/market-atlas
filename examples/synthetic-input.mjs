// SYNTHETIC ONLY: fictional companies and generated prices, not market history.
export function syntheticInput(){
  const dates=[];let day=new Date('2024-01-01T00:00:00Z');
  while(dates.length<300){if(![0,6].includes(day.getUTCDay()))dates.push(day.toISOString().slice(0,10));day.setUTCDate(day.getUTCDate()+1);}
  const histories=[1,2].map(id=>({
    company:{id,ticker:`DEMO_${id}`,name:`合成公司${id}`,market:'A股',chain:`虚构产业链${id}`},fxScale:1,
    bars:dates.map((date,i)=>{const close=50+id*8+i*.15+Math.sin(i/8)*2-(i>210?(i-210)*.3:0);return {date,open:close*.999,high:close*1.01,low:close*.99,close,volume:100000};}),
  }));
  return {histories,facts:histories.map(h=>({id:h.company.id,companyId:h.company.id,publicationDate:dates[100],confidence:4,sourceTier:'A',synthetic:true})),
    drivers:histories.map(h=>({id:h.company.id})),
    links:histories.map(h=>({driverId:h.company.id,factId:h.company.id,relevance:4,stance:'支持'})),
    impacts:histories.map(h=>({driverId:h.company.id,targetKey:h.company.ticker,direction:'利好',strength:4})),
  };
}
