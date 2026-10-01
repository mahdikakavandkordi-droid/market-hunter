import fs from 'node:fs';

const SYMBOLS=[
  'RY.TO','TD.TO','BMO.TO','BNS.TO','CM.TO','AEM.TO','WPM.TO','ABX.TO','LUN.TO',
  'CNQ.TO','SU.TO','TRP.TO','CNR.TO','CP.TO','SHOP.TO','NTR.TO','MFC.TO','BCE.TO',
  'NA.TO','SLF.TO','POW.TO','ENB.TO','IMO.TO','TOU.TO','FNV.TO','K.TO','FTS.TO',
  'EMA.TO','WCN.TO','CSU.TO','ATD.TO','MRU.TO','L.TO'
];
const FORWARD_START='2026-10-01';
const LEDGER_PATH='data/research/smc-wd4h-forward-paper-ledger.json';
const PORTFOLIO={
  startingCapital:1000,
  targetRiskPct:.01,
  maxPositionPct:.25,
  maxOpenRiskPct:.04,
  maxPositions:4,
  costR:.05,
  fractionalShares:true
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function yahoo(symbol,range,interval){
  let last;
  for(let attempt=0;attempt<5;attempt++){
    for(const host of ['query1','query2']){
      try{
        const u=`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
        const r=await fetch(u,{headers:{'User-Agent':'MarketHunter-SMC-Forward/1.0'},signal:AbortSignal.timeout(20000)});
        if(!r.ok)throw Error('http_'+r.status);
        const p=await r.json(),x=p?.chart?.result?.[0],q=x?.indicators?.quote?.[0]||{};
        if(!x?.timestamp?.length)throw Error(p?.chart?.error?.description||'empty');
        return x.timestamp.map((t,i)=>({t:t*1000,o:q.open?.[i],h:q.high?.[i],l:q.low?.[i],c:q.close?.[i],v:q.volume?.[i]}))
          .filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
      }catch(e){last=e}
    }
    await sleep(900*(attempt+1));
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
function stats(T,cost=0){const rs=T.map(x=>x.R-cost),n=rs.length,w=rs.filter(x=>x>0).length,g=rs.filter(x=>x>0).reduce((s,x)=>s+x,0),l=-rs.filter(x=>x<0).reduce((s,x)=>s+x,0),sum=rs.reduce((s,x)=>s+x,0);let eq=0,pk=0,dd=0;for(const r of rs){eq+=r;pk=Math.max(pk,eq);dd=Math.min(dd,eq-pk)}return{n,wr:n?w/n:null,pf:l?g/l:null,avgR:n?sum/n:null,sumR:sum,maxDD:dd}}

const tradeKey=x=>`${x.symbol}|${x.entryT}|${x.dir}`;

function simulatePortfolio(trades){
  let cash=PORTFOLIO.startingCapital,peak=PORTFOLIO.startingCapital,maxDD=0;
  const open=[],entered=[],skipped=[],equityCurve=[{t:FORWARD_START,equity:PORTFOLIO.startingCapital}];

  const equity=()=>cash+open.reduce((s,p)=>s+p.notional,0);
  const updateCurve=t=>{
    const e=equity();peak=Math.max(peak,e);maxDD=Math.min(maxDD,(e/peak)-1);
    equityCurve.push({t,equity:e});
  };
  const settleUntil=t=>{
    const due=open.filter(p=>p.exitT&&Date.parse(p.exitT)<=t).sort((a,b)=>a.exitT.localeCompare(b.exitT));
    for(const p of due){
      const i=open.indexOf(p);if(i>=0)open.splice(i,1);
      const pnl=p.riskAmount*(p.R-PORTFOLIO.costR);
      cash+=p.notional+pnl;
      p.pnl=pnl;p.accountEquityAfter=equity();p.portfolioStatus='closed';
      updateCurve(p.exitT);
    }
  };

  for(const tr of [...trades].sort((a,b)=>a.entryT.localeCompare(b.entryT)||a.symbol.localeCompare(b.symbol))){
    const t=Date.parse(tr.entryT);settleUntil(t);
    const eq=equity(),openRisk=open.reduce((s,p)=>s+p.riskAmount,0);
    const stopPct=tr.risk/tr.entry;
    const riskCapacity=Math.max(0,PORTFOLIO.maxOpenRiskPct*eq-openRisk);
    const targetRisk=Math.min(PORTFOLIO.targetRiskPct*eq,riskCapacity);
    if(open.length>=PORTFOLIO.maxPositions){skipped.push({...tr,reason:'max_positions'});continue}
    if(!(targetRisk>0)&&Number.isFinite(targetRisk)){skipped.push({...tr,reason:'max_open_risk'});continue}
    if(!(stopPct>0)){skipped.push({...tr,reason:'invalid_stop_distance'});continue}
    const notional=Math.min(targetRisk/stopPct,PORTFOLIO.maxPositionPct*eq,cash);
    if(!(notional>0)){skipped.push({...tr,reason:'no_cash'});continue}
    const riskAmount=notional*stopPct,qty=notional/tr.entry;
    const p={...tr,accountEquityBefore:eq,notional,allocationPct:notional/eq,quantity:qty,stopPct,riskAmount,riskPctEquity:riskAmount/eq,pnl:null,portfolioStatus:tr.status};
    cash-=notional;open.push(p);entered.push(p);
    updateCurve(tr.entryT);
  }
  settleUntil(Infinity);
  const currentEquity=equity();
  return {
    rules:PORTFOLIO,
    startingCapital:PORTFOLIO.startingCapital,
    currentEquity,
    realizedReturnPct:currentEquity/PORTFOLIO.startingCapital-1,
    cash,
    reservedNotional:open.reduce((s,p)=>s+p.notional,0),
    openRiskAmount:open.reduce((s,p)=>s+p.riskAmount,0),
    maxDrawdownPct:maxDD,
    enteredCount:entered.length,
    closedCount:entered.filter(x=>x.portfolioStatus==='closed').length,
    openCount:open.length,
    skippedCount:skipped.length,
    entered,open,skipped,equityCurve
  };
}

function forwardTrades(d0,h,symbol){
  const d=dailyDate(d0),f=fourHour(h),w=weekly(d0),A=atr(f),W=structure(w,3),D=structure(d,5),F=structure(f,3),T=[];let blocked=-1;
  for(const e of F.ev){
    if(e.tag!=='CHOCH'||e.i<=blocked||e.i+1>=f.length||e.opp==null)continue;
    const di=prevD(d,f[e.i].t),wi=prevW(w,f[e.i].t);if(di<0||wi<0||D.b[di]!==e.dir||W.b[wi]!==e.dir)continue;
    const dir=e.dir,en=f[e.i+1].o,entryT=f[e.i+1].t;
    if(tor(entryT).date<FORWARD_START)continue;
    let stop=e.opp;stop=dir===1?stop-.1*(A[e.i]||0):stop+.1*(A[e.i]||0);const risk=dir===1?en-stop:stop-en;if(!(risk>0))continue;
    const tp=en+dir*2*risk;let R=null,exitI=null,status='open';
    for(let j=e.i+1;j<=Math.min(f.length-1,e.i+16);j++){
      const hs=dir===1?f[j].l<=stop:f[j].h>=stop,ht=dir===1?f[j].h>=tp:f[j].l<=tp;
      if(hs){R=-1;exitI=j;status='closed';break}
      if(ht){R=2;exitI=j;status='closed';break}
    }
    const maxI=Math.min(f.length-1,e.i+16);
    if(R==null&&maxI>=e.i+16){exitI=maxI;R=dir*(f[exitI].c-en)/risk;status='closed'}
    T.push({symbol,signalT:new Date(f[e.i].t).toISOString(),entryT:new Date(entryT).toISOString(),dir,entry:en,stop,target:tp,risk,status,R,exitT:exitI!=null?new Date(f[exitI].t).toISOString():null});
    if(exitI!=null)blocked=exitI;
  }
  return T;
}

const failures=[],all=[];
for(const s of SYMBOLS){
  try{
    const [d,h]=await Promise.all([yahoo(s,'2y','1d'),yahoo(s,'60d','1h')]);
    all.push(...forwardTrades(d,h,s));await sleep(250);
  }catch(e){failures.push({symbol:s,error:String(e?.message||e)})}
}
all.sort((a,b)=>a.entryT.localeCompare(b.entryT));
let prior={trades:[]};
if(fs.existsSync(LEDGER_PATH)){try{prior=JSON.parse(fs.readFileSync(LEDGER_PATH,'utf8'))}catch{}}
const merged=new Map((prior.trades||[]).map(x=>[tradeKey(x),x]));
for(const x of all)merged.set(tradeKey(x),x);
const ledgerTrades=[...merged.values()].sort((a,b)=>a.entryT.localeCompare(b.entryT)||a.symbol.localeCompare(b.symbol));
const closed=ledgerTrades.filter(x=>x.status==='closed'&&Number.isFinite(x.R)),open=ledgerTrades.filter(x=>x.status==='open');
const portfolio=simulatePortfolio(ledgerTrades);
const out={
  version:'smc-wd4h-forward-paper-v1',
  generatedAt:new Date().toISOString(),
  forwardStart:FORWARD_START,
  frozenRules:{universe:SYMBOLS.length,weekly:3,daily:5,fourHour:3,trigger:'CHOCH',dailyWeekly:'previous completed only',entry:'next 4H open',stop:'opposing swing + 0.1 ATR14',target:'2R',maxHold:16,regimeFilter:'none',vp:'none',sweep:'none'},
  failures,
  summary:{closed:stats(closed),cost03R:stats(closed,.03),cost05R:stats(closed,.05),long:stats(closed.filter(x=>x.dir===1)),short:stats(closed.filter(x=>x.dir===-1)),openCount:open.length},
  portfolio,
  trades:ledgerTrades
};
fs.mkdirSync('data/research',{recursive:true});
fs.writeFileSync(LEDGER_PATH,JSON.stringify({version:'smc-wd4h-forward-ledger-v1',updatedAt:out.generatedAt,forwardStart:FORWARD_START,trades:ledgerTrades},null,2)+'\n');
fs.writeFileSync('data/research/smc-wd4h-forward-paper-latest.json',JSON.stringify(out,null,2)+'\n');
const n=x=>Number.isFinite(x)?x.toFixed(3):'n/a',p=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'n/a';
const md=[
 '# SMC W-D-4H Forward Paper Track','',
 `Generated: ${out.generatedAt}`,'',
 `Forward start: ${FORWARD_START}; universe: ${SYMBOLS.length} TSX symbols; regime filters: none.`,'',
 '| Metric | Raw | +0.03R cost | +0.05R cost |',
 '|---|---:|---:|---:|',
 `| Closed trades | ${out.summary.closed.n} | ${out.summary.cost03R.n} | ${out.summary.cost05R.n} |`,
 `| Win rate | ${p(out.summary.closed.wr)} | ${p(out.summary.cost03R.wr)} | ${p(out.summary.cost05R.wr)} |`,
 `| PF | ${n(out.summary.closed.pf)} | ${n(out.summary.cost03R.pf)} | ${n(out.summary.cost05R.pf)} |`,
 `| Avg R | ${n(out.summary.closed.avgR)} | ${n(out.summary.cost03R.avgR)} | ${n(out.summary.cost05R.avgR)} |`,
 `| Sum R | ${n(out.summary.closed.sumR)} | ${n(out.summary.cost03R.sumR)} | ${n(out.summary.cost05R.sumR)} |`,
 '',
 '## $1,000 paper portfolio','',
 `Starting capital: ${PORTFOLIO.startingCapital.toFixed(2)}`,
 `Current realized-equity: ${portfolio.currentEquity.toFixed(2)}`,
 `Return: ${p(portfolio.realizedReturnPct)}`,
 `Max drawdown: ${p(portfolio.maxDrawdownPct)}`,
 `Entered / skipped / open: ${portfolio.enteredCount} / ${portfolio.skippedCount} / ${portfolio.openCount}`,
 `Sizing: target 1% account risk per trade; max 25% notional per position; max 4 positions; max 4% aggregate open risk; 0.05R cost per closed trade.`,'',
 '### Portfolio allocations','',
 '| Symbol | Entry | Dir | Allocation | Risk $ | Risk % | Status | P/L $ |',
 '|---|---|---:|---:|---:|---:|---|---:|',
 ...portfolio.entered.map(x=>`| ${x.symbol} | ${x.entryT.slice(0,10)} | ${x.dir===1?'Long':'Short'} | ${x.notional.toFixed(2)} | ${x.riskAmount.toFixed(2)} | ${p(x.riskPctEquity)} | ${x.portfolioStatus} | ${Number.isFinite(x.pnl)?'
 '| Symbol | Entry | Dir | R | Exit |','|---|---|---:|---:|---|',
 ...closed.map(x=>`| ${x.symbol} | ${x.entryT.slice(0,10)} | ${x.dir===1?'Long':'Short'} | ${n(x.R)} | ${x.exitT?.slice(0,10)||''} |`),
 '', '## Open trades','',
 ...(open.length?open.map(x=>`- ${x.symbol} ${x.dir===1?'Long':'Short'}; entry ${n(x.entry)}, stop ${n(x.stop)}, target ${n(x.target)}`):['- None']),
 '', 'This is a forward paper/shadow record only. The rules are frozen; no signal may be removed after seeing its outcome.'
].join('\n');
fs.writeFileSync('data/research/smc-wd4h-forward-paper-latest.md',md+'\n');
console.log(md);
+x.pnl.toFixed(2):''} |`),
 '',`Open paper trades: ${open.length}`,'',
 '## Closed trades','',
 '| Symbol | Entry | Dir | R | Exit |','|---|---|---:|---:|---|',
 ...closed.map(x=>`| ${x.symbol} | ${x.entryT.slice(0,10)} | ${x.dir===1?'Long':'Short'} | ${n(x.R)} | ${x.exitT?.slice(0,10)||''} |`),
 '', '## Open trades','',
 ...(open.length?open.map(x=>`- ${x.symbol} ${x.dir===1?'Long':'Short'}; entry ${n(x.entry)}, stop ${n(x.stop)}, target ${n(x.target)}`):['- None']),
 '', 'This is a forward paper/shadow record only. The rules are frozen; no signal may be removed after seeing its outcome.'
].join('\n');
fs.writeFileSync('data/research/smc-wd4h-forward-paper-latest.md',md+'\n');
console.log(md);
