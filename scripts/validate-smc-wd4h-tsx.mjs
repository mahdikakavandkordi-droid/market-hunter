import fs from 'node:fs';

const SYMBOLS = [
  'RY.TO','TD.TO','BMO.TO','BNS.TO','CM.TO',
  'AEM.TO','WPM.TO','ABX.TO','LUN.TO',
  'CNQ.TO','SU.TO','TRP.TO',
  'CNR.TO','CP.TO','SHOP.TO','NTR.TO','MFC.TO','BCE.TO'
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function yahoo(symbol, range, interval) {
  let last;
  for (let attempt=0; attempt<6; attempt++) {
    for (const host of ['query1','query2']) {
      try {
        const u = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
        const r = await fetch(u, {headers:{'User-Agent':'MarketHunter-SMC-Validation/1.0'}, signal:AbortSignal.timeout(20000)});
        if (!r.ok) throw Error('http_'+r.status);
        const p = await r.json();
        const x = p?.chart?.result?.[0];
        if (!x?.timestamp?.length) throw Error(p?.chart?.error?.description || 'empty');
        const q=x.indicators?.quote?.[0]||{};
        return x.timestamp.map((t,i)=>({t:t*1000,o:q.open?.[i],h:q.high?.[i],l:q.low?.[i],c:q.close?.[i],v:q.volume?.[i]}))
          .filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
      } catch(e) { last=e; }
    }
    await sleep(1200*(attempt+1));
  }
  throw last;
}

function toronto(ms) {
  const z=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
  return {date:`${z.year}-${z.month}-${z.day}`,hour:+z.hour,minute:+z.minute};
}

function fourHour(rows) {
  const by=new Map();
  for(const r of rows){
    const z=toronto(r.t);
    if(z.hour<9 || z.hour>16) continue;
    if(!by.has(z.date)) by.set(z.date,[]);
    by.get(z.date).push(r);
  }
  const out=[];
  for(const [date,a0] of [...by.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
    const a=a0.sort((x,y)=>x.t-y.t);
    for(let i=0;i<a.length;i+=4){
      const g=a.slice(i,i+4);
      if(g.length<2) continue;
      out.push({t:g[0].t,o:g[0].o,h:Math.max(...g.map(x=>x.h)),l:Math.min(...g.map(x=>x.l)),c:g.at(-1).c,v:g.reduce((s,x)=>s+(Number.isFinite(x.v)?x.v:0),0),date});
    }
  }
  return out;
}

function weekly(d) {
  const out=[]; let key='',x=null;
  for(const r of d){
    const dt=new Date(r.t), dow=dt.getUTCDay();
    const k=new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth(),dt.getUTCDate()-((dow+6)%7))).toISOString().slice(0,10);
    if(k!==key){ if(x) out.push(x); key=k; x={...r}; }
    else { x.h=Math.max(x.h,r.h); x.l=Math.min(x.l,r.l); x.c=r.c; x.v=(x.v||0)+(r.v||0); }
  }
  if(x) out.push(x);
  return out;
}

function idxBefore(a,t){let l=0,r=a.length-1,z=-1;while(l<=r){const m=(l+r)>>1;if(a[m].t<=t){z=m;l=m+1}else r=m-1}return z;}

function structure(a,L){
  let leg=0,ph=null,pl=null,hx=false,lx=false,bias=0;
  const ev=[],b=Array(a.length).fill(0);
  for(let i=1;i<a.length;i++){
    if(i>=L){
      const j=i-L; let mx=-Infinity,mn=Infinity;
      for(let k=j+1;k<=i;k++){mx=Math.max(mx,a[k].h);mn=Math.min(mn,a[k].l)}
      const nh=a[j].h>mx,nl=a[j].l<mn,old=leg;
      if(nh)leg=0; else if(nl)leg=1;
      if(leg!==old){
        if(leg===1){pl={level:a[j].l,index:j};lx=false}
        else{ph={level:a[j].h,index:j};hx=false}
      }
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

function vpAcceptance(h,t,bar,dir){
  const rows=h.filter(x=>x.t>=t-20*86400000&&x.t<t);
  if(rows.length<40)return false;
  let lo=Infinity,hi=-Infinity; for(const x of rows){lo=Math.min(lo,x.l);hi=Math.max(hi,x.h)}
  if(!(hi>lo))return false;
  const bins=24,step=(hi-lo)/bins,V=Array(bins).fill(0);
  for(const x of rows){
    let q=Math.floor((((x.h+x.l+x.c)/3)-lo)/step);q=Math.max(0,Math.min(bins-1,q));
    V[q]+=Number.isFinite(x.v)?x.v:0;
  }
  let p=0;for(let q=1;q<bins;q++)if(V[q]>V[p])p=q;
  let L=p,R=p,sum=V[p],tot=V.reduce((a,x)=>a+x,0);
  if(!(tot>0)) return false;
  while(sum<.7*tot&&(L>0||R<bins-1)){
    const lv=L>0?V[L-1]:-1,rv=R<bins-1?V[R+1]:-1;
    if(rv>=lv){R++;sum+=V[R]}else{L--;sum+=V[L]}
  }
  const poc=lo+(p+.5)*step,val=lo+L*step,vah=lo+(R+1)*step,px=bar.c;
  return dir===1?((px>=val&&px<=poc)||(bar.l<=poc&&bar.c>poc))
                :((px<=vah&&px>=poc)||(bar.h>=poc&&bar.c<poc));
}

function run(d,h,rr=2,buf=.1,hold=16){
  const f=fourHour(h),w=weekly(d),A=atr(f),W=structure(w,3),D=structure(d,5),F=structure(f,3);
  const T=[];let blocked=-1;
  for(const e of F.ev){
    if(e.tag!=='CHOCH'||e.i<=blocked||e.i+1>=f.length||e.opp==null)continue;
    const di=idxBefore(d,f[e.i].t),wi=idxBefore(w,f[e.i].t);
    if(di<0||wi<0||D.b[di]!==e.dir||W.b[wi]!==e.dir)continue;
    const dir=e.dir,en=f[e.i+1].o;let stop=e.opp;
    stop=dir===1?stop-buf*(A[e.i]||0):stop+buf*(A[e.i]||0);
    const risk=dir===1?en-stop:stop-en;if(!(risk>0))continue;
    const tp=en+dir*rr*risk;let R=null,exitI=null;
    for(let j=e.i+1;j<=Math.min(f.length-1,e.i+hold);j++){
      const hs=dir===1?f[j].l<=stop:f[j].h>=stop,ht=dir===1?f[j].h>=tp:f[j].l<=tp;
      if(hs){R=-1;exitI=j;break}
      if(ht){R=rr;exitI=j;break}
    }
    if(R==null){exitI=Math.min(f.length-1,e.i+hold);R=dir*(f[exitI].c-en)/risk}
    T.push({t:f[e.i+1].t,R,dir,vp:vpAcceptance(h,f[e.i].t,f[e.i],dir)});
    blocked=exitI;
  }
  return T;
}

function stats(T){
  const n=T.length,w=T.filter(x=>x.R>0).length,g=T.filter(x=>x.R>0).reduce((s,x)=>s+x.R,0),l=-T.filter(x=>x.R<0).reduce((s,x)=>s+x.R,0),sum=T.reduce((s,x)=>s+x.R,0);
  let eq=0,pk=0,dd=0;for(const x of [...T].sort((a,b)=>a.t-b.t)){eq+=x.R;pk=Math.max(pk,eq);dd=Math.min(dd,eq-pk)}
  return {n,wr:n?w/n:null,pf:l?g/l:null,avgR:n?sum/n:null,sumR:sum,maxDD:dd};
}

function stressStats(T,costR){
  return stats(T.map(x=>({...x,R:x.R-costR})));
}

function bootstrapMean(T,iters=10000){
  if(!T.length)return null;
  let seed=20261001;
  const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
  const means=[];
  for(let b=0;b<iters;b++){
    let s=0;for(let i=0;i<T.length;i++)s+=T[Math.floor(rnd()*T.length)].R;
    means.push(s/T.length);
  }
  means.sort((a,b)=>a-b);
  const q=p=>means[Math.min(means.length-1,Math.floor(p*(means.length-1)))];
  return {iterations:iters,meanPositiveRate:means.filter(x=>x>0).length/means.length,ci95:[q(.025),q(.975)],median:q(.5)};
}

function quarterly(T){
  const g={};
  for(const x of T){
    const d=new Date(x.t),q=Math.floor(d.getUTCMonth()/3)+1,k=`${d.getUTCFullYear()}-Q${q}`;
    (g[k]??=[]).push(x);
  }
  return Object.fromEntries(Object.entries(g).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stats(v)]));
}

const results={},failures=[],all=[],data={};
for(const symbol of SYMBOLS){
  try{
    console.log('fetch',symbol);
    const [d,h]=await Promise.all([yahoo(symbol,'5y','1d'),yahoo(symbol,'2y','1h')]);
    data[symbol]={d,h};
    const T=run(d,h);
    results[symbol]={dailyBars:d.length,hourlyBars:h.length,trades:stats(T),outsideVP:stats(T.filter(x=>!x.vp)),vpAcceptance:stats(T.filter(x=>x.vp))};
    all.push(...T.map(x=>({...x,symbol})));
    await sleep(700);
  }catch(e){failures.push({symbol,error:String(e?.message||e)})}
}

const baseline=stats(all),outsideVP=stats(all.filter(x=>!x.vp)),insideVP=stats(all.filter(x=>x.vp));
const times=[...all].map(x=>x.t).sort((a,b)=>a-b);
const split=times.length?times[Math.floor(times.length/2)]:0;

const grid=[];
for(const rr of [1.75,2,2.25])for(const buf of [0,.1,.2])for(const hold of [12,16,20]){
  let T=[];
  for(const [symbol,x] of Object.entries(data)) T.push(...run(x.d,x.h,rr,buf,hold).map(t=>({...t,symbol})));
  grid.push({rr,buf,hold,...stats(T)});
}

const dailyRegime={};
for(const [symbol,x] of Object.entries(data)){
  const W=structure(weekly(x.d),3),D=structure(x.d,5);
  let aligned=0,observed=0;
  for(let i=0;i<x.d.length;i++){
    const wi=idxBefore(weekly(x.d),x.d[i].t);
    if(wi<0)continue;observed++;if(W.b[wi]!==0&&W.b[wi]===D.b[i])aligned++;
  }
  dailyRegime[symbol]={fiveYearDailyBars:x.d.length,weeklyDailyAlignedPct:observed?aligned/observed*100:null};
}

const output={
  version:'smc-wd4h-tsx-validation-v1',
  generatedAt:new Date().toISOString(),
  frozenRules:{weeklyStructure:3,dailyStructure:5,fourHourStructure:3,trigger:'CHOCH',entry:'next 4H open',stop:'opposing 4H swing + 0.1 ATR14',target:'2R',maxHold4HBars:16,onePositionPerSymbol:true,sameBarStopBeforeTarget:true},
  symbols:SYMBOLS,failures,results,
  aggregate:{
    baseline,outsideVP,vpAcceptance:insideVP,
    firstHalf:stats(all.filter(x=>x.t<split)),secondHalf:stats(all.filter(x=>x.t>=split)),
    stress:{cost03R:stressStats(all,.03),cost05R:stressStats(all,.05),cost10R:stressStats(all,.10)},
    bootstrapMean:bootstrapMean(all),
    quarterly:quarterly(all)
  },
  robustness:{variants:grid.length,positiveExpectancy:grid.filter(x=>x.avgR>0).length,pfAbove1:grid.filter(x=>(x.pf??0)>1).length,worst:[...grid].sort((a,b)=>(a.avgR??-99)-(b.avgR??-99))[0],best:[...grid].sort((a,b)=>(b.avgR??-99)-(a.avgR??-99))[0],grid},
  fiveYearDailyRegime:dailyRegime,
  tradeLedger:all.map(x=>({symbol:x.symbol,t:new Date(x.t).toISOString(),R:x.R,dir:x.dir,vp:x.vp})),
  limitations:['Yahoo 1h intraday history is limited to roughly the recent couple of years; full 5-8 year 4H validation is not claimed.','Volume Profile is a diagnostic filter, not part of the frozen core entry rule.']
};

fs.mkdirSync('data/research',{recursive:true});
fs.writeFileSync('data/research/smc-wd4h-tsx-validation-20261001.json',JSON.stringify(output,null,2)+'\n');

const pct=x=>Number.isFinite(x)?(x*100).toFixed(1)+'%':'n/a';
const num=x=>Number.isFinite(x)?x.toFixed(3):'n/a';
const md=[
  '# SMC W-D-4H TSX Validation — 2026-10-01','',
  'Frozen core: Weekly(3) + Daily(5) aligned, 4H(3) CHoCH, next-4H-open entry, opposing swing + 0.1 ATR stop, 2R target, 16-bar time exit.','',
  `Symbols requested: ${SYMBOLS.length}; successful: ${Object.keys(results).length}; failures: ${failures.length}`,'',
  '| Cohort | Trades | Win rate | PF | Avg R | Sum R | Max DD |',
  '|---|---:|---:|---:|---:|---:|---:|',
  `| Core | ${baseline.n} | ${pct(baseline.wr)} | ${num(baseline.pf)} | ${num(baseline.avgR)} | ${num(baseline.sumR)} | ${num(baseline.maxDD)} |`,
  `| Outside VP acceptance | ${outsideVP.n} | ${pct(outsideVP.wr)} | ${num(outsideVP.pf)} | ${num(outsideVP.avgR)} | ${num(outsideVP.sumR)} | ${num(outsideVP.maxDD)} |`,
  `| VP acceptance | ${insideVP.n} | ${pct(insideVP.wr)} | ${num(insideVP.pf)} | ${num(insideVP.avgR)} | ${num(insideVP.sumR)} | ${num(insideVP.maxDD)} |`,
  `| First chronological half | ${output.aggregate.firstHalf.n} | ${pct(output.aggregate.firstHalf.wr)} | ${num(output.aggregate.firstHalf.pf)} | ${num(output.aggregate.firstHalf.avgR)} | ${num(output.aggregate.firstHalf.sumR)} | ${num(output.aggregate.firstHalf.maxDD)} |`,
  `| Second chronological half | ${output.aggregate.secondHalf.n} | ${pct(output.aggregate.secondHalf.wr)} | ${num(output.aggregate.secondHalf.pf)} | ${num(output.aggregate.secondHalf.avgR)} | ${num(output.aggregate.secondHalf.sumR)} | ${num(output.aggregate.secondHalf.maxDD)} |`,'',
  `Robustness: ${output.robustness.positiveExpectancy}/${grid.length} variants positive expectancy; ${output.robustness.pfAbove1}/${grid.length} PF > 1.`,'',
  `Cost stress: +0.03R cost => Avg R ${num(output.aggregate.stress.cost03R.avgR)}; +0.05R => ${num(output.aggregate.stress.cost05R.avgR)}; +0.10R => ${num(output.aggregate.stress.cost10R.avgR)}.`,'',
  `Bootstrap mean-R 95% CI: [${num(output.aggregate.bootstrapMean?.ci95?.[0])}, ${num(output.aggregate.bootstrapMean?.ci95?.[1])}], P(mean>0)=${pct(output.aggregate.bootstrapMean?.meanPositiveRate)}.`,'',
  '## Per symbol','',
  '| Symbol | Trades | PF | Avg R | Outside-VP PF |',
  '|---|---:|---:|---:|---:|',
  ...Object.entries(results).map(([s,r])=>`| ${s} | ${r.trades.n} | ${num(r.trades.pf)} | ${num(r.trades.avgR)} | ${num(r.outsideVP.pf)} |`),
  '', '## Failures','',
  ...(failures.length?failures.map(x=>`- ${x.symbol}: ${x.error}`):['- None']),
  '', '## Limitation','',
  '- This is direct TSX/CAD validation for the recent ~2-year intraday window. It does **not** claim 5-8 years of 4H data.',
  '- Five-year daily data is included only as a longer-regime sanity check.'
].join('\n');
fs.writeFileSync('data/research/smc-wd4h-tsx-validation-20261001.md',md+'\n');
console.log(md);
