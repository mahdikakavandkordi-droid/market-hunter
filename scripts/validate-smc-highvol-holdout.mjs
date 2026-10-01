import fs from 'node:fs';

const SYMBOLS=[
  'NA.TO','SLF.TO','POW.TO',
  'ENB.TO','IMO.TO','TOU.TO',
  'FNV.TO','K.TO',
  'FTS.TO','EMA.TO',
  'WCN.TO','CSU.TO','ATD.TO','MRU.TO','L.TO'
];
const BENCH='XIU.TO';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function yahoo(symbol,range,interval){
  let last;
  for(let attempt=0;attempt<6;attempt++){
    for(const host of ['query1','query2']){
      try{
        const u=`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
        const r=await fetch(u,{headers:{'User-Agent':'MarketHunter-SMC-Holdout/1.0'},signal:AbortSignal.timeout(20000)});
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

const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function tor(ms){const z=Object.fromEntries(fmt.formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return{date:`${z.year}-${z.month}-${z.day}`,hour:+z.hour}}
function weekKey(ms){const z=tor(ms),d=new Date(z.date+'T12:00:00Z'),dw=d.getUTCDay();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-((dw+6)%7))).toISOString().slice(0,10)}
function dailyDate(d){return d.map(x=>({...x,date:tor(x.t).date}))}
function fourHour(h){const by=new Map();for(const r of h){const z=tor(r.t);if(z.hour<9||z.hour>16)continue;if(!by.has(z.date))by.set(z.date,[]);by.get(z.date).push(r)}const o=[];for(const [date,a0] of [...by.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){const a=a0.sort((x,y)=>x.t-y.t);for(let i=0;i<a.length;i+=4){const g=a.slice(i,i+4);if(g.length<2)continue;o.push({t:g[0].t,o:g[0].o,h:Math.max(...g.map(x=>x.h)),l:Math.min(...g.map(x=>x.l)),c:g.at(-1).c,v:g.reduce((s,x)=>s+(x.v||0),0),date})}}return o}
function weekly(d0){const d=dailyDate(d0),o=[];let key='',x=null;for(const r of d){const k=weekKey(r.t);if(k!==key){if(x)o.push(x);key=k;x={t:r.t,o:r.o,h:r.h,l:r.l,c:r.c,v:r.v,key:k}}else{x.h=Math.max(x.h,r.h);x.l=Math.min(x.l,r.l);x.c=r.c;x.v=(x.v||0)+(r.v||0)}}if(x)o.push(x);return o}
function prevD(d,signalT){const sd=tor(signalT).date;let z=-1;for(let i=0;i<d.length;i++){if(d[i].date<sd)z=i;else break}return z}
function prevW(w,signalT){const sw=weekKey(signalT);let z=-1;for(let i=0;i<w.length;i++){if(w[i].key<sw)z=i;else break}return z}
function structure(a,L){let leg=0,ph=null,pl=null,hx=false,lx=false,bias=0;const ev=[],b=Array(a.length).fill(0);for(let i=1;i<a.length;i++){if(i>=L){const j=i-L;let mx=-Infinity,mn=Infinity;for(let k=j+1;k<=i;k++){mx=Math.max(mx,a[k].h);mn=Math.min(mn,a[k].l)}const nh=a[j].h>mx,nl=a[j].l<mn,old=leg;if(nh)leg=0;else if(nl)leg=1;if(leg!==old){if(leg===1){pl={level:a[j].l};lx=false}else{ph={level:a[j].h};hx=false}}}if(ph&&!hx&&a[i].c>ph.level&&a[i-1].c<=ph.level){ev.push({i,dir:1,tag:bias===-1?'CHOCH':'BOS',opp:pl?.level??null});hx=true;bias=1}if(pl&&!lx&&a[i].c<pl.level&&a[i-1].c>=pl.level){ev.push({i,dir:-1,tag:bias===1?'CHOCH':'BOS',opp:ph?.level??null});lx=true;bias=-1}b[i]=bias}return{ev,b}}
function atr(a,n=14){const o=Array(a.length).fill(null),tr=[];for(let i=0;i<a.length;i++){tr[i]=i?Math.max(a[i].h-a[i].l,Math.abs(a[i].h-a[i-1].c),Math.abs(a[i].l-a[i-1].c)):a[i].h-a[i].l;if(i>=n-1){let s=0;for(let k=i-n+1;k<=i;k++)s+=tr[k];o[i]=s/n}}return o}
function run(d0,h){const d=dailyDate(d0),f=fourHour(h),w=weekly(d0),A=atr(f),W=structure(w,3),D=structure(d,5),F=structure(f,3),T=[];let blocked=-1;for(const e of F.ev){if(e.tag!=='CHOCH'||e.i<=blocked||e.i+1>=f.length||e.opp==null)continue;const di=prevD(d,f[e.i].t),wi=prevW(w,f[e.i].t);if(di<0||wi<0||D.b[di]!==e.dir||W.b[wi]!==e.dir)continue;const dir=e.dir,en=f[e.i+1].o;let stop=e.opp;stop=dir===1?stop-.1*(A[e.i]||0):stop+.1*(A[e.i]||0);const risk=dir===1?en-stop:stop-en;if(!(risk>0))continue;const tp=en+dir*2*risk;let R=null,exitI=null;for(let j=e.i+1;j<=Math.min(f.length-1,e.i+16);j++){const hs=dir===1?f[j].l<=stop:f[j].h>=stop,ht=dir===1?f[j].h>=tp:f[j].l<=tp;if(hs){R=-1;exitI=j;break}if(ht){R=2;exitI=j;break}}if(R==null){exitI=Math.min(f.length-1,e.i+16);R=dir*(f[exitI].c-en)/risk}T.push({t:f[e.i+1].t,signalT:f[e.i].t,R,dir});blocked=exitI}return T}
function sma(v,i,n){if(i<n-1)return null;let s=0;for(let k=i-n+1;k<=i;k++)s+=v[k];return s/n}
function percentileRank(a,x){let n=0;for(const v of a)if(v<=x)n++;return a.length?n/a.length:null}
function stats(T){const n=T.length,w=T.filter(x=>x.R>0).length,g=T.filter(x=>x.R>0).reduce((s,x)=>s+x.R,0),l=-T.filter(x=>x.R<0).reduce((s,x)=>s+x.R,0),sum=T.reduce((s,x)=>s+x.R,0);let eq=0,pk=0,dd=0;for(const x of [...T].sort((a,b)=>a.t-b.t)){eq+=x.R;pk=Math.max(pk,eq);dd=Math.min(dd,eq-pk)}return{n,wr:n?w/n:null,pf:l?g/l:null,avgR:n?sum/n:null,sumR:sum,maxDD:dd}}
function split(T){const ts=T.map(x=>x.t).sort((a,b)=>a-b),m=ts.length?ts[Math.floor(ts.length/2)]:0;return{all:stats(T),first:stats(T.filter(x=>x.t<m)),second:stats(T.filter(x=>x.t>=m))}}

const data={},failures=[];
for(const s of SYMBOLS){
  try{
    console.log('fetch',s);
    const [d,h]=await Promise.all([yahoo(s,'5y','1d'),yahoo(s,'2y','1h')]);
    data[s]={d,h};await sleep(500);
  }catch(e){failures.push({symbol:s,error:String(e?.message||e)})}
}
const bench0=await yahoo(BENCH,'5y','1d'),bench=dailyDate(bench0),bAtr=atr(bench,20),bClose=bench.map(x=>x.c);

let T=[];
for(const [symbol,x] of Object.entries(data))T.push(...run(x.d,x.h).map(t=>({...t,symbol})));
T=T.map(tr=>{
  const bi=prevD(bench,tr.signalT);
  let volPct=null;
  if(bi>=20&&Number.isFinite(bAtr[bi])){
    const cur=bAtr[bi]/bench[bi].c,hist=[];
    for(let j=Math.max(19,bi-251);j<=bi;j++)if(Number.isFinite(bAtr[j]))hist.push(bAtr[j]/bench[j].c);
    volPct=percentileRank(hist,cur);
  }
  return {...tr,volPct,highVol:Number.isFinite(volPct)&&volPct>=.80};
});

const base=split(T),avoid=split(T.filter(x=>!x.highVol)),high=split(T.filter(x=>x.highVol));

function quarterly(T){const g={};for(const x of T){const d=new Date(x.t),q=Math.floor(d.getUTCMonth()/3)+1,k=`${d.getUTCFullYear()}-Q${q}`;(g[k]??=[]).push(x)}return Object.fromEntries(Object.entries(g).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,{...stats(v),highVolPct:v.filter(x=>x.highVol).length/v.length}]))}

const perSymbol={};
for(const s of Object.keys(data)){
  const a=T.filter(x=>x.symbol===s);
  perSymbol[s]={base:stats(a),avoidHighVol:stats(a.filter(x=>!x.highVol)),highVol:stats(a.filter(x=>x.highVol))};
}

const out={
  version:'smc-wd4h-highvol-holdout-v1',
  generatedAt:new Date().toISOString(),
  methodology:{holdoutSymbols:SYMBOLS,discoveryUniverseExcluded:true,noLookahead:true,filter:'avoid trades when XIU ATR20/close >= 80th percentile of trailing up-to-252 completed daily observations',core:'Weekly(3)+Daily(5) aligned, 4H(3) CHoCH, next 4H open, swing+0.1ATR stop, 2R, 16 bars'},
  failures,base,avoidHighVol:avoid,highVol:high,quarterly:quarterly(T),perSymbol,
  tradeLedger:T.map(x=>({symbol:x.symbol,t:new Date(x.t).toISOString(),R:x.R,dir:x.dir,volPct:x.volPct,highVol:x.highVol}))
};
fs.mkdirSync('data/research',{recursive:true});
fs.writeFileSync('data/research/smc-wd4h-highvol-holdout-20261001.json',JSON.stringify(out,null,2)+'\n');

const num=x=>Number.isFinite(x)?x.toFixed(3):'n/a',pct=x=>Number.isFinite(x)?(x*100).toFixed(1)+'%':'n/a';
const md=[
 '# SMC W-D-4H High-Volatility Filter Holdout — 2026-10-01','',
 'This universe was not used to discover the high-volatility rule. Core and the 80th-percentile threshold were frozen before this test.','',
 '| Cohort | Trades | Win rate | PF | Avg R | Sum R | Max DD | First-half Avg R | Second-half Avg R |',
 '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
 `| Core | ${base.all.n} | ${pct(base.all.wr)} | ${num(base.all.pf)} | ${num(base.all.avgR)} | ${num(base.all.sumR)} | ${num(base.all.maxDD)} | ${num(base.first.avgR)} | ${num(base.second.avgR)} |`,
 `| Avoid high vol | ${avoid.all.n} | ${pct(avoid.all.wr)} | ${num(avoid.all.pf)} | ${num(avoid.all.avgR)} | ${num(avoid.all.sumR)} | ${num(avoid.all.maxDD)} | ${num(avoid.first.avgR)} | ${num(avoid.second.avgR)} |`,
 `| High vol only | ${high.all.n} | ${pct(high.all.wr)} | ${num(high.all.pf)} | ${num(high.all.avgR)} | ${num(high.all.sumR)} | ${num(high.all.maxDD)} | ${num(high.first.avgR)} | ${num(high.second.avgR)} |`,'',
 '## Per symbol','',
 '| Symbol | Core N | Core PF | Avoid-high-vol N | Avoid PF |',
 '|---|---:|---:|---:|---:|',
 ...Object.entries(perSymbol).map(([s,r])=>`| ${s} | ${r.base.n} | ${num(r.base.pf)} | ${r.avoidHighVol.n} | ${num(r.avoidHighVol.pf)} |`),'',
 'Promotion rule: only promote the filter if it improves expectancy/PF without a material drawdown penalty and remains positive in both chronological halves with adequate sample size.'
].join('\n');
fs.writeFileSync('data/research/smc-wd4h-highvol-holdout-20261001.md',md+'\n');
console.log(md);
