const DAY=86400000;

export function utcDate(value){
  const d=value instanceof Date?value:new Date(value);
  return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):null;
}

export function torontoDateFromSeconds(sec){
  const d=new Date(Number(sec)*1000);
  if(!Number.isFinite(d.getTime()))return null;
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(d).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function marketKind(item){
  if(item?.group==='Crypto')return 'crypto';
  if(item?.group==='Commodity')return 'metals';
  return 'equity';
}

function rowDate(row){
  return Number.isFinite(Number(row?.t))?utcDate(Number(row.t)*1000):null;
}

export function expectedCompletedSession({kind,nowMs=Date.now(),meta={},rawRows=[],completedRows=[]}={}){
  const now=Number(nowMs),regular=meta?.currentTradingPeriod?.regular||{};
  const start=Number(regular.start),end=Number(regular.end);
  const lastCompleted=rowDate(completedRows.at(-1));

  if(kind==='crypto'){
    const dayStart=Math.floor(now/DAY)*DAY;
    return utcDate(dayStart-1);
  }

  if(Number.isFinite(start)&&Number.isFinite(end)&&end>start){
    const nowSec=now/1000;
    if(kind==='equity'){
      if(nowSec>=end+300)return torontoDateFromSeconds(start);
      return lastCompleted;
    }

    if(kind==='metals'){
      if(nowSec>=end+300)return utcDate(start*1000);
      if(nowSec>=start&&nowSec<end){
        const activeDate=utcDate(start*1000);
        const dates=rawRows.map(rowDate).filter(Boolean);
        if(dates.at(-1)===activeDate&&dates.length>=2)return dates.at(-2);
      }
      return lastCompleted;
    }
  }

  return lastCompleted;
}

export function assessFreshness({kind,nowMs=Date.now(),meta={},rawRows=[],completedRows=[]}={}){
  const latestCompleted=rowDate(completedRows.at(-1));
  const expected=expectedCompletedSession({kind,nowMs,meta,rawRows,completedRows});
  let status='unknown';
  if(latestCompleted&&expected)status=latestCompleted<expected?'stale':latestCompleted>expected?'ahead':'fresh';
  else if(latestCompleted)status='fresh';
  else status='missing';

  const rawLatest=rowDate(rawRows.at(-1));
  return {
    status,
    latestCompletedSession:latestCompleted,
    expectedCompletedSession:expected,
    partialBarExcluded:Boolean(rawLatest&&latestCompleted&&rawLatest>latestCompleted),
    assessedAt:new Date(nowMs).toISOString()
  };
}

export function mergeAssetRefresh(existingMarkets,updates,failures,targetKeys,attemptedAt=new Date().toISOString()){
  const byKey=new Map((existingMarkets||[]).map(x=>[x.key,x]));
  const updateBy=new Map((updates||[]).map(x=>[x.key,x]));
  const failureBy=new Map((failures||[]).map(x=>[x.key,x]));

  for(const key of targetKeys||[]){
    const old=byKey.get(key)||null,update=updateBy.get(key)||null,failure=failureBy.get(key)||null;
    if(update){
      if(!old||String(update.asOf||'')>=String(old.asOf||'')){
        byKey.set(key,update);
      }else if(old){
        byKey.set(key,{...old,freshness:{...(old.freshness||{}),status:'stale',attemptedAt,message:'Provider returned an older completed session; prior valid report retained.'}});
      }
    }else if(old&&failure){
      byKey.set(key,{...old,freshness:{...(old.freshness||{}),status:'provider_failure',attemptedAt,message:failure.reason||'provider_failure'}});
    }
  }
  return [...byKey.values()];
}
