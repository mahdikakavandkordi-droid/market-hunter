const DAY=86400000,START=Date.UTC(2025,0,1);
export function cryptoFixture() {
  const anchors=[[0,119],[8,100],[14,120],[20,110],[26,145],[32,125],[38,155],[44,132],[50,143],[56,122],[64,150]];
  const rows=[];
  for(let i=0;i<=64;i++) {
    let n=anchors.findIndex(p=>p[0]>=i);if(n===0)n=1;
    const [a,x]=anchors[n-1],[b,y]=anchors[n],c=x+(y-x)*(i-a)/(b-a);
    rows.push({t:START+i*DAY,endT:START+(i+1)*DAY,o:c,h:c+.4,l:c-.4,c,v:1000});
  }
  return rows;
}
export function chartFrom(rows,{symbol='BTC-USD',mode='crypto',meta={},events={}}={}) {
  return {meta:{symbol,currency:'USD',shortName:'Synthetic fixture',instrumentType:mode==='crypto'?'CRYPTOCURRENCY':'EQUITY',...meta},
    timestamp:rows.map(b=>b.t/1000),indicators:{quote:[Object.fromEntries([['open','o'],['high','h'],['low','l'],['close','c'],['volume','v']].map(([name,key])=>[name,rows.map(b=>b[key])]))]},events};
}
export function fakeFetcher(charts) {
  return async url=>{
    const u=new URL(url),symbol=decodeURIComponent(u.pathname.split('/').at(-1));
    if(!['query1.finance.yahoo.com','query2.finance.yahoo.com'].includes(u.hostname))throw new Error('unexpected_host');
    const chart=charts[symbol];
    return {ok:Boolean(chart),status:chart?200:404,json:async()=>({chart:{result:chart?[chart]:[],error:null}})};
  };
}
export function stockRows(n=40) {
  const rows=[];let t=Date.UTC(2025,0,2,14,30);
  while(rows.length<n) {
    const d=new Date(t).getUTCDay();
    if(d!==0&&d!==6)rows.push({t,o:100,h:101,l:99,c:100,v:1000});
    t+=DAY;
  }
  return rows;
}
