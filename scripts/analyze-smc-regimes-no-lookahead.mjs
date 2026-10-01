import fs from 'node:fs';

const SYMBOLS = [
  'RY.TO','TD.TO','BMO.TO','BNS.TO','CM.TO',
  'AEM.TO','WPM.TO','ABX.TO','LUN.TO',
  'CNQ.TO','SU.TO','TRP.TO',
  'CNR.TO','CP.TO','SHOP.TO','NTR.TO','MFC.TO','BCE.TO'
];
const BENCH='XIU.TO';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function yahoo(symbol,range,interval){
  let last;
  for(let attempt=0;attempt<6;attempt++){
    for(const host of ['query1','query2']){
      try{
        const u=`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
        const r=await fetch(u,{headers:{'User-Agent':'MarketHunter-SMC-Regime/1.0'},signal:AbortSignal.timeout(20000)});
        if(!r.ok)throw Error('http_'+r.status);
        const p=await r.json(),x=p?.chart?.result?.[0],q=x?.indicators?.quote?.[0]||{};
        if(!x?.timestamp?.length)throw Error(p?.chart?.error?.description||'empty');
        return x.timestamp.map((t,i)=>({t:t*1000,o:q.open?.[i],h:q.high?.[i],l:q.low?.[i],c:q.close?.[i],v:q.volume?.[i]}))
          .filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
      }catch(e){last=e}
    }
    await sleep(1200*(attempt+1));
  }
  throw last;
}

const torFmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function toronto(ms){
  const z=Object.fromEntries(torFmt.formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
  return {date:`${z.year}-${z.month}-${z.day}`,hour:+z.hour,minute:+z.minute};
}
function weekKey(ms){
  const z=toronto(ms),d=new Date(z.date+'T12:00:00Z'),dow=d.getUTCDay();
  return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-((dow+6)%7))).toISOString().slice(0,10);
}
function fourHour(rows){
  const by=new Map();
  for(const r of rows){
    const z=toronto(r.t); if(z.hour<9||z.hour>16)continue;
    if(!by.has(z.date))by.set(z.date,[]);by.get(z.date).push(r);
  }
  const out=[];
  for(const [date,a0] of [...by.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
    const a=a0.sort((x,y)=>x.t-y.t);
    for(let i=0;i<a.length;i+=4){
      const g=a.slice(i,i+4);if(g.length<2)continue;
      out.push({t:g[0].t,o:g[0].o,h:Math.max(...g.map(x=>x.h)),l:Math.min(...g.map(x=>x.l)),c:g.at(-1).c,v:g.reduce((s,x)=>s+(Number.isFinite(x.v)?x.v:0),0),date});
    }
  }
  return out;
}
function dailyWithDate(d){return d.map(x=>({...x,date:toronto(x.t).date}));}
function weekly(d0){
  const d=dailyWithDate(d0),out=[];let key='',x=null;
  for(const r of d){
    const k=weekKey(r.t);
    if(k!==key){if(x)out.push(x);key=k;x={t:r.t,o:r.o,h:r.h,l:r.l,c:r.c,v:r.v,key:k,lastDate:r.date};}
    else{x.h=Math.max(x.h,r.h);x.l=Math.min(x.l,r.l);x.c=r.c;x.v=(x.v||0)+(r.v||0);x.lastDate=r.date;}
  }
  if(x)out.push(x);return out;
}
function prevCompletedDailyIndex(d0,signalT){
  const d=dailyWithDate(d0),sigDate=toronto(signalT).date;let z=-1;
  for(let i=0;i<d.length;i++){if(d[i].date<sigDate)z=i;else break}
  return z;
}
function prevCompletedWeeklyIndex(w,signalT){
  const sigWeek=weekKey(signalT);let z=-1;
  for(let i=0;i<w.length;i++){if(w[i].key<sigWeek)z=i;else break}
  return z;
}
function structure(a,L){
  let leg=0,ph=null,pl=null,hx=false,lx=false,bias=0;const ev=[],b=Array(a.length).fill(0);
  for(let i=1;i<a.length;i++){
    if(i>=L){
      const j=i-L;let mx=-Infinity,mn=Infinity;
      for(let k=j+1;k<=i;k++){mx=Math.max(mx,a[k].h);mn=Math.min(mn,a[k].l)}
      const nh=a[j].h>mx,nl=a[j].l<mn,old=leg;if(nh)leg=0;else if(nl)leg=1;
      if(leg!==old){if(leg===1){pl={level:a[j].l,index:j};lx=false}else{ph={level:a[j].h,index:j};hx=false}}
    }
    if(ph&&!hx&&a[i].c>ph.level&&a[i-1].c<=ph.level){ev.push({i,dir:1,tag:bias===-1?'CHOCH':'BOS',opp:pl?.level??null});hx=true;bias=1}
    if(pl&&!lx&&a[i].c<pl.level&&a[i-1].c>=pl.level){ev.push({i,dir:-1,tag:bias===1?'CHOCH':'BOS',opp:ph?.level??null});lx=true;bias=-1}
    b[i]=bias;
  }
  return {ev,b};
}
function atr(a,n=14){
  const out=Array(a.length).fill(null),tr=[];
  for(let i=0;i<a.length;i++){
    tr[i]=i?Math.max(a[i].h-a[i].l,Math.abs(a[i].h-a[i-1].c),Math.abs(a[i].l-a[i-1].c)):a[i].h-a[i].l;
    if(i>=n-1){let s=0;for(let k=i-n+1;k<=i;k++)s+=tr[k];out[i]=s/n}
  }
  return out;
}
function sma(vals,i,n){if(i<n-1)return null;let s=0;for(let k=i-n+1;k<=i;k++)s+=vals[k];return s/n}
function stats(T){
  const n=T.length,w=T.filter(x=>x.R>0).length,g=T.filter(x=>x.R>0).reduce((s,x)=>s+x.R,0),l=-T.filter(x=>x.R<0).reduce((s,x)=>s+x.R,0),sum=T.reduce((s,x)=>s+x.R,0);
  let eq=0,pk=0,dd=0;for(const x of [...T].sort((a,b)=>a.t-b.t)){eq+=x.R;pk=Math.max(pk,eq);dd=Math.min(dd,eq-pk)}
  return {n,wr:n?w/n:null,pf:l?g/l:null,avgR:n?sum/n:null,sumR:sum,maxDD:dd};
}
function runClean(d0,h,rr=2,buf=.1,hold=16){
  const d=dailyWithDate(d0),f=fourHour(h),w=weekly(d0),A=atr(f),W=structure(w,3),D=structure(d,5),F=structure(f,3);
  const T=[];let blocked=-1;
  for(const e of F.ev){
    if(e.tag!=='CHOCH'||e.i<=blocked||e.i+1>=f.length||e.opp==null)continue;
    const di=prevCompletedDailyIndex(d,f[e.i].t),wi=prevCompletedWeeklyIndex(w,f[e.i].t);
    if(di<0||wi<0||D.b[di]!==e.dir||W.b[wi]!==e.dir)continue;
    const dir=e.dir,en=f[e.i+1].o;let stop=e.opp;stop=dir===1?stop-buf*(A[e.i]||0):stop+buf*(A[e.i]||0);
    const risk=dir===1?en-stop:stop-en;if(!(risk>0))continue;
    const tp=en+dir*rr*risk;let R=null,exitI=null;
    for(let j=e.i+1;j<=Math.min(f.length-1,e.i+hold);j++){
      const hs=dir===1?f[j].l<=stop:f[j].h>=stop,ht=dir===1?f[j].h>=tp:f[j].l<=tp;
      if(hs){R=-1;exitI=j;break}if(ht){R=rr;exitI=j;break}
    }
    if(R==null){exitI=Math.min(f.length-1,e.i+hold);R=dir*(f[exitI].c-en)/risk}
    T.push({t:f[e.i+1].t,signalT:f[e.i].t,R,dir});blocked=exitI;
  }
  return T;
}
function percentileRank(arr,x){if(!arr.length)return null;let n=0;for(const v of arr)if(v<=x)n++;return n/arr.length}
function enrichRegime(T,data,bench){
  const benchD=dailyWithDate(bench),benchAtr=atr(benchD,20),benchCl=benchD.map(x=>x.c);
  const dailyStruct=Object.fromEntries(Object.entries(data).map(([s,x])=>[s,{d:dailyWithDate(x.d),S:structure(dailyWithDate(x.d),5)}]));
  return T.map(tr=>{
    const bi=prevCompletedDailyIndex(benchD,tr.signalT);
    let marketTrend='neutral',volPct=null;
    if(bi>=199){
      const s50=sma(benchCl,bi,50),s200=sma(benchCl,bi,200),c=benchD[bi].c;
      if(c>s200&&s50>s200)marketTrend='bull';
      else if(c<s200&&s50<s200)marketTrend='bear';
    }
    if(bi>=20&&Number.isFinite(benchAtr[bi])){
      const cur=benchAtr[bi]/benchD[bi].c, hist=[];
      for(let j=Math.max(19,bi-251);j<=bi;j++)if(Number.isFinite(benchAtr[j]))hist.push(benchAtr[j]/benchD[j].c);
      volPct=percentileRank(hist,cur);
    }
    let aligned=0,total=0;
    for(const x of Object.values(dailyStruct)){
      const di=prevCompletedDailyIndex(x.d,tr.signalT);if(di<0)continue;
      const b=x.S.b[di];if(!b)continue;total++;if(b===tr.dir)aligned++;
    }
    const breadth=total?aligned/total:null;
    const trendSupport=(tr.dir===1&&marketTrend==='bull')||(tr.dir===-1&&marketTrend==='bear');
    const trendOpposed=(tr.dir===1&&marketTrend==='bear')||(tr.dir===-1&&marketTrend==='bull');
    const breadthStrong=Number.isFinite(breadth)&&breadth>=.60;
    const breadthWeak=Number.isFinite(breadth)&&breadth<.40;
    const highVol=Number.isFinite(volPct)&&volPct>=.80;
    return {...tr,marketTrend,trendSupport,trendOpposed,breadth,breadthStrong,breadthWeak,volPct,highVol};
  });
}
function splitStats(T){
  const ts=[...T].map(x=>x.t).sort((a,b)=>a-b),split=ts.length?ts[Math.floor(ts.length/2)]:0;
  return {all:stats(T),first:stats(T.filter(x=>x.t<split)),second:stats(T.filter(x=>x.t>=split))};
}
function quarterly(T){
  const g={};for(const x of T){const d=new Date(x.t),q=Math.floor(d.getUTCMonth()/3)+1,k=`${d.getUTCFullYear()}-Q${q}`;(g[k]??=[]).push(x)}
  return Object.fromEntries(Object.entries(g).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,{...stats(v),trendSupportPct:v.filter(x=>x.trendSupport).length/v.length,breadthStrongPct:v.filter(x=>x.breadthStrong).length/v.length,highVolPct:v.filter(x=>x.highVol).length/v.length,avgBreadth:v.reduce((s,x)=>s+(x.breadth??0),0)/v.length}]));
}

const data={},failures=[];
for(const symbol of SYMBOLS){
  try{
    console.log('fetch',symbol);
    const [d,h]=await Promise.all([yahoo(symbol,'5y','1d'),yahoo(symbol,'2y','1h')]);
    data[symbol]={d,h};await sleep(500);
  }catch(e){failures.push({symbol,error:String(e?.message||e)})}
}
const bench=await yahoo(BENCH,'5y','1d');

let raw=[];
for(const [symbol,x] of Object.entries(data))raw.push(...runClean(x.d,x.h).map(t=>({...t,symbol})));
const T=enrichRegime(raw,data,bench);

const filters={
  baseline:x=>true,
  trendSupported:x=>x.trendSupport,
  notTrendOpposed:x=>!x.trendOpposed,
  breadthStrong:x=>x.breadthStrong,
  avoidHighVol:x=>!x.highVol,
  trendAndBreadth:x=>x.trendSupport&&x.breadthStrong,
  green:x=>x.trendSupport&&x.breadthStrong&&!x.highVol
};
const filterResults=Object.fromEntries(Object.entries(filters).map(([k,fn])=>[k,splitStats(T.filter(fn))]));

const grid=[];
for(const rr of [1.75,2,2.25])for(const buf of [0,.1,.2])for(const hold of [12,16,20]){
  let a=[];for(const [symbol,x] of Object.entries(data))a.push(...runClean(x.d,x.h,rr,buf,hold).map(t=>({...t,symbol})));
  grid.push({rr,buf,hold,...stats(a)});
}

const out={
  version:'smc-wd4h-no-lookahead-regime-v1',
  generatedAt:new Date().toISOString(),
  methodology:{noLookahead:true,dailyBias:'previous completed trading day only',weeklyBias:'previous completed week only',benchmark:BENCH,trend:'XIU close vs SMA200 with SMA50/SMA200 confirmation',breadth:'fraction of 18-symbol universe whose completed Daily(5) structure matches trade direction; strong >=60%',highVol:'XIU ATR20/close >= 80th percentile of trailing up-to-252 completed daily observations'},
  failures,
  cleanCore:splitStats(T),
  filterResults,
  quarterly:quarterly(T),
  robustness:{variants:grid.length,positiveExpectancy:grid.filter(x=>x.avgR>0).length,pfAbove1:grid.filter(x=>(x.pf??0)>1).length,worst:[...grid].sort((a,b)=>(a.avgR??-99)-(b.avgR??-99))[0],best:[...grid].sort((a,b)=>(b.avgR??-99)-(a.avgR??-99))[0],grid},
  tradeLedger:T.map(x=>({symbol:x.symbol,t:new Date(x.t).toISOString(),R:x.R,dir:x.dir,marketTrend:x.marketTrend,trendSupport:x.trendSupport,breadth:x.breadth,breadthStrong:x.breadthStrong,volPct:x.volPct,highVol:x.highVol}))
};
fs.mkdirSync('data/research',{recursive:true});
fs.writeFileSync('data/research/smc-wd4h-no-lookahead-regime-20261001.json',JSON.stringify(out,null,2)+'\n');

const num=x=>Number.isFinite(x)?x.toFixed(3):'n/a',pct=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'n/a';
const rows=Object.entries(filterResults).map(([k,v])=>`| ${k} | ${v.all.n} | ${pct(v.all.wr)} | ${num(v.all.pf)} | ${num(v.all.avgR)} | ${num(v.first.avgR)} | ${num(v.second.avgR)} |`);
const md=[
 '# SMC W-D-4H No-Lookahead + Regime Analysis — 2026-10-01','',
 '**Important:** Daily bias uses only the previous completed trading day. Weekly bias uses only the previous completed week.','',
 '| Filter | Trades | Win rate | PF | Avg R | First-half Avg R | Second-half Avg R |',
 '|---|---:|---:|---:|---:|---:|---:|',...rows,'',
 `Robustness after look-ahead fix: ${out.robustness.positiveExpectancy}/${grid.length} positive expectancy; ${out.robustness.pfAbove1}/${grid.length} PF > 1.`,'',
 '## Quarterly','',
 '| Quarter | Trades | PF | Avg R | Trend-support | Breadth-strong | High-vol |',
 '|---|---:|---:|---:|---:|---:|---:|',
 ...Object.entries(out.quarterly).map(([k,v])=>`| ${k} | ${v.n} | ${num(v.pf)} | ${num(v.avgR)} | ${pct(v.trendSupportPct)} | ${pct(v.breadthStrongPct)} | ${pct(v.highVolPct)} |`),
 '', 'Regime filters are exploratory diagnostics; none is promoted to the core unless it improves both chronological halves with adequate sample size.'
].join('\n');
fs.writeFileSync('data/research/smc-wd4h-no-lookahead-regime-20261001.md',md+'\n');
console.log(md);
