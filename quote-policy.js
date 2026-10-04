(function(root){
  'use strict';

  const MAX_LIVE_AGE_MINUTES=90;

  function numeric(value){
    return Number.isFinite(Number(value))&&Number(value)>0;
  }

  function isoDate(value){
    const raw=String(value||'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
    const t=Date.parse(raw);
    if(!Number.isFinite(t))return null;
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
      timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(new Date(t)).map(x=>[x.type,x.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function validIntraday(symbol,snapshot){
    const q=snapshot?.quotes?.[symbol];
    if(!q||String(q.symbol||'')!==String(symbol||'')||!numeric(q.price))return null;
    const quoteAt=q.quoteAt||snapshot?.capturedAt||null;
    if(!Number.isFinite(Date.parse(quoteAt||'')))return null;
    return {
      symbol,
      price:Number(q.price),
      changePct:Number.isFinite(Number(q.changePct))?Number(q.changePct):null,
      currency:q.currency||null,
      quoteAt,
      sessionDate:isoDate(q.sessionDate||quoteAt),
      sessionStart:Number.isFinite(Number(q.sessionStart))?Number(q.sessionStart):null,
      sessionEnd:Number.isFinite(Number(q.sessionEnd))?Number(q.sessionEnd):null,
      staleFlag:Boolean(q.stale)
    };
  }

  function validCompleted(symbol,completed){
    if(!completed||!numeric(completed.price))return null;
    if(completed.symbol&&String(completed.symbol)!==String(symbol||''))return null;
    const sessionDate=isoDate(completed.asOf||completed.sessionDate||completed.completedAt);
    if(!sessionDate)return null;
    return {
      symbol,
      price:Number(completed.price),
      changePct:Number.isFinite(Number(completed.dayChangePct))?Number(completed.dayChangePct):null,
      currency:completed.currency||null,
      quoteAt:sessionDate,
      sessionDate
    };
  }

  function activeIntraday(q,snapshot,now){
    if(!q)return false;
    const nowMs=now.getTime(),quoteMs=Date.parse(q.quoteAt),age=(nowMs-quoteMs)/60000,sec=nowMs/1000;
    const quoteFresh=!q.staleFlag&&Number.isFinite(age)&&age>=-1&&age<=MAX_LIVE_AGE_MINUTES;
    const current=snapshot?.currentState;
    if(current&&typeof current.marketOpen==='boolean'){
      return quoteFresh&&current.marketOpen===true&&current.snapshotFresh!==false&&current.sessionDate===q.sessionDate;
    }
    return quoteFresh&&Number.isFinite(q.sessionStart)&&Number.isFinite(q.sessionEnd)&&sec>=q.sessionStart&&sec<q.sessionEnd;
  }

  function result(source,quote,state,label,extra={}){
    return {
      symbol:quote?.symbol||extra.symbol||null,
      price:quote?.price??null,
      changePct:quote?.changePct??null,
      currency:quote?.currency??null,
      quoteAt:quote?.quoteAt??null,
      sessionDate:quote?.sessionDate??null,
      source,
      covered:source==='intraday',
      state,
      label,
      ...extra
    };
  }

  function selectQuote({symbol,intradaySnapshot=null,completed=null,now=new Date()}={}){
    const live=validIntraday(symbol,intradaySnapshot);
    const close=validCompleted(symbol,completed);
    const currencyMismatch=Boolean(live&&close&&live.currency&&close.currency&&live.currency!==close.currency);
    const active=activeIntraday(live,intradaySnapshot,now);

    if(active&&!currencyMismatch){
      return result('intraday',live,'provisional','Intraday quote · current session',{fresh:true});
    }

    if(close){
      if(!live){
        return result('completed',close,'completed',intradaySnapshot?'Completed session · hourly quote unavailable':'Completed session',{fresh:true});
      }
      if(currencyMismatch){
        return result('completed',close,'completed','Completed session · intraday currency mismatch ignored',{fresh:true,warning:'currency_mismatch'});
      }
      if(close.sessionDate>live.sessionDate){
        return result('completed',close,'completed','Completed session · newer than hourly snapshot',{fresh:true});
      }
      if(close.sessionDate===live.sessionDate&&!active){
        return result('completed',close,'completed','Completed session · session closed',{fresh:true});
      }
      if(close.sessionDate<live.sessionDate){
        return result('intraday',live,'stale','Intraday quote · stale · completed close pending',{fresh:false,warning:'stale_only_newer_session'});
      }
      return result('completed',close,'completed','Completed session',{fresh:true});
    }

    if(live){
      const age=(now.getTime()-Date.parse(live.quoteAt))/60000;
      const stale=!active||live.staleFlag||!Number.isFinite(age)||age>MAX_LIVE_AGE_MINUTES;
      return result('intraday',live,stale?'stale':'provisional',stale?'Intraday quote · stale':'Intraday quote · current session',{fresh:!stale});
    }

    return {
      symbol:symbol||null,price:null,changePct:null,currency:completed?.currency||null,quoteAt:null,
      sessionDate:null,source:'none',covered:false,state:'unavailable',label:intradaySnapshot?'Quote unavailable':'Hourly feed unavailable',fresh:false
    };
  }

  root.MarketHunterQuotePolicy={selectQuote,isoDate,MAX_LIVE_AGE_MINUTES};
})(typeof globalThis!=='undefined'?globalThis:this);
