"""Isolated prospective paper portfolio. Standard library only; no broker or private portfolio access."""
import argparse, copy, datetime as dt, hashlib, json, math, os, sys, time
from pathlib import Path
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
from urllib.parse import quote

TZ=ZoneInfo('America/Toronto')
SYMBOLS=['ATD.TO','CNR.TO','CNQ.TO','ENB.TO','FTS.TO','RY.TO','SHOP.TO','TD.TO']
VERSION='fvg-ema20-canada-paper-v1'
def canon(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)
def digest(x):return hashlib.sha256(canon(x).encode()).hexdigest()
def save(path,obj):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2,allow_nan=False)+'\n');tmp.replace(path)
def utcnow():return dt.datetime.now(dt.timezone.utc)
def fetch(symbol,now):
    url='https://query1.finance.yahoo.com/v8/finance/chart/'+quote(symbol,safe='')+'?period1=1577836800&period2='+str(int(now.timestamp())+1)+'&interval=1d&events=div%2Csplits'
    error=None
    for attempt in range(3):
        try:
            req=Request(url,headers={'User-Agent':'Mozilla/5.0'})
            raw=urlopen(req,timeout=35).read();j=json.loads(raw)['chart']['result'][0]
            break
        except Exception as ex:
            error=ex
            if attempt==2:raise RuntimeError(f'{symbol}: fetch failed: {error}')
            time.sleep(1+attempt)
    meta=j['meta'];assert meta['symbol'].upper()==symbol.upper(), 'wrong instrument'
    assert meta['currency']=='CAD', 'non-CAD feed'
    zone=ZoneInfo(meta['exchangeTimezoneName']);q=j['indicators']['quote'][0];bars=[]
    local=now.astimezone(TZ);today=local.date().isoformat()
    for i,stamp in enumerate(j['timestamp']):
        day=dt.datetime.fromtimestamp(stamp,zone).date().isoformat()
        if day>today or (day==today and (local.hour<18)):continue
        values=[q[k][i] for k in ('open','high','low','close')]
        if any(v is None or not math.isfinite(v) for v in values):
            if day>=today:raise RuntimeError(f'{symbol}: missing completed OHLC')
            continue
        o,h,l,c=map(float,values)
        assert 0<min(values) and h>=max(o,l,c)-1e-7 and l<=min(o,h,c)+1e-7, 'invalid OHLC'
        bars.append(dict(date=day,open=o,high=h,low=l,close=c))
    assert len(bars)>100 and len({b['date'] for b in bars})==len(bars)
    assert [b['date'] for b in bars]==sorted(b['date'] for b in bars)
    return dict(symbol=symbol,url=url,response_sha256=hashlib.sha256(raw).hexdigest(),currency='CAD',timezone=meta['exchangeTimezoneName'],bars=bars,events=j.get('events',{}))

def initial_instrument(bars):
    ema=None;atr=None;prev=None;tr_seed=[];tail=[];zones=[]
    for idx,b in enumerate(bars):
        ema=b['close'] if ema is None else ema+(2/21)*(b['close']-ema)
        tr=max(b['high']-b['low'],abs(b['high']-(prev if prev is not None else b['close'])),abs(b['low']-(prev if prev is not None else b['close'])))
        if atr is None:
            tr_seed.append(tr)
            if len(tr_seed)==14:atr=sum(tr_seed)/14
        else:atr=(13*atr+tr)/14
        zones=[z for z in zones if b['low']>z['bottom'] and b['close']>=z['bottom']]
        if len(tail)>=2 and atr is not None and b['low']>tail[-2]['high'] and tail[-1]['close']>tail[-2]['high']:
            zones.append(dict(id=b['date'],top=b['low'],bottom=tail[-2]['high']))
            zones=zones[-12:]
        tail=(tail+[b])[-2:];prev=b['close']
    return dict(ema=ema,atr=atr,tail=tail,zones=zones,setup=None,session_index=0)

def load(root):
    config=json.loads((root/'config.json').read_text());wrapper=json.loads((root/'state.json').read_text())
    previous=None;last=None
    for line in (root/'journal.jsonl').read_text().splitlines():
        rec=json.loads(line);sha=rec.pop('hash');assert rec['previous_hash']==previous and digest(rec)==sha,'journal hash chain changed'
        previous=sha;last=rec
    assert last is not None and wrapper['checkpoint']==previous and wrapper['state']==last['state'],'state is not the journal checkpoint'
    assert wrapper['state']['config_hash']==digest(config),'frozen rules changed'
    assert config['collector_sha256']==hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'collector code differs from frozen version'
    return config,wrapper['state'],previous

def append(root,record,previous):
    record=dict(record,previous_hash=previous);sha=digest(record);record['hash']=sha
    with (root/'journal.jsonl').open('a') as f:f.write(canon(record)+'\n')
    save(root/'state.json',dict(checkpoint=sha,state=record['state']))

def mark(state,prices):
    return state['cash']+sum(p['qty']*prices[s]*(1-state['cost']) for s,p in state['positions'].items())

def advance(state,day,pack):
    """All orders originated at an earlier close. Open events precede intraday outcomes."""
    st=copy.deepcopy(state);events=[]
    def sell(symbol,price,reason):
        p=st['positions'].pop(symbol);proceeds=p['qty']*price*(1-st['cost']);profit=proceeds-p['outlay'];st['cash']+=proceeds
        t=dict(symbol=symbol,entry_date=p['entry_date'],exit_date=day,entry=p['entry'],exit=price,qty=p['qty'],stop=p['stop'],target=p['target'],net_profit=profit,net_r=profit/(p['qty']*p['distance']),reason=reason,signal_date=p['signal_date'],zone_id=p['zone_id'])
        st['closed'].append(t);events.append(dict(type='exit',**t))
    bars={s:pack[s] for s in SYMBOLS}
    # Existing planned timeouts and opening gaps release cash before opening orders.
    for s in sorted(list(st['positions'])):
        p=st['positions'][s];o=bars[s]['open']
        if p['timeout']:sell(s,o,'time_exit')
        elif o<=p['stop']:sell(s,o,'stop_gap')
        elif o>=p['target']:sell(s,o,'target_gap')
    orders=st['pending'];st['pending']={}
    for s in sorted(orders):
        order=orders[s];assert order['signal_date']<day, 'same-session order'
        if s in st['positions'] or len(st['positions'])>=4:
            events.append(dict(type='entry_skipped_capacity',symbol=s,signal_date=order['signal_date']));continue
        o=bars[s]['open'];distance=2*order['atr'];stop=o-distance
        if distance<=0 or stop<=0:
            events.append(dict(type='entry_skipped_invalid_risk',symbol=s));continue
        qty=min(100/distance,2500/(o*(1+st['cost'])),st['cash']/(o*(1+st['cost'])))
        if qty<=0:events.append(dict(type='entry_skipped_cash',symbol=s));continue
        outlay=qty*o*(1+st['cost']);st['cash']-=outlay
        st['positions'][s]=dict(entry=o,entry_date=day,signal_date=order['signal_date'],qty=qty,stop=stop,target=o+2*distance,distance=distance,outlay=outlay,zone_id=order['zone_id'],age=0,timeout=False)
        events.append(dict(type='entry',symbol=s,**st['positions'][s]))
    # Do not finance open orders using proceeds from later intraday stops/targets.
    for s in sorted(list(st['positions'])):
        p=st['positions'][s];b=bars[s]
        if b['low']<=p['stop']:sell(s,p['stop'],'stop')
        elif b['high']>=p['target']:sell(s,p['target'],'target_2R')
    if st['benchmark'] is None:
        st['benchmark']=dict(start_date=day,start_open=pack['^GSPTSE']['open'],units=10000/pack['^GSPTSE']['open'])
    decisions=[]
    for s in SYMBOLS:
        ins=st['instruments'][s];b=bars[s];prev=ins['tail'][-1]['close'];tail=ins['tail']
        ins['ema']+=(2/21)*(b['close']-ins['ema'])
        tr=max(b['high']-b['low'],abs(b['high']-prev),abs(b['low']-prev));ins['atr']=(13*ins['atr']+tr)/14
        ins['session_index']+=1;i=ins['session_index']
        ins['zones']=[z for z in ins['zones'] if b['low']>z['bottom'] and b['close']>=z['bottom']]
        if b['low']>tail[-2]['high'] and tail[-1]['close']>tail[-2]['high']:
            ins['zones'].append(dict(id=day,top=b['low'],bottom=tail[-2]['high']));ins['zones']=ins['zones'][-12:]
        setup=ins['setup']
        if setup is not None:
            z=next((z for z in ins['zones'] if z['id']==setup['zone']['id']),None)
            reason='ema_invalid' if b['close']<=ins['ema'] else 'zone_removed' if z is None else 'wait_expired' if i-setup['i']>20 else None
            if reason:decisions.append(dict(symbol=s,type='setup_cancelled',reason=reason,zone_id=setup['zone']['id']));ins['setup']=None
            elif i>setup['i'] and b['low']<=z['top'] and b['high']>=z['bottom'] and b['close']>z['top'] and b['close']>ins['ema']:
                ins['setup']=None
                if s not in st['positions']:
                    st['pending'][s]=dict(signal_date=day,atr=ins['atr'],zone_id=z['id']);decisions.append(dict(symbol=s,type='entry_order',zone_id=z['id'],atr=ins['atr']))
                else:decisions.append(dict(symbol=s,type='signal_ignored_position',zone_id=z['id']))
        born=next((z for z in ins['zones'] if z['id']==day),None)
        if born is not None and b['close']>ins['ema']:
            ins['setup']=dict(i=i,zone=copy.deepcopy(born));decisions.append(dict(symbol=s,type='setup_started',zone_id=day,top=born['top'],bottom=born['bottom']))
        ins['tail']=(tail+[b])[-2:]
        if s in st['positions']:
            st['positions'][s]['age']+=1;st['positions'][s]['timeout']=st['positions'][s]['age']>=60
    prices={s:bars[s]['close'] for s in SYMBOLS};equity=mark(st,prices);bench=st['benchmark']['units']*pack['^GSPTSE']['close']
    st['peak']=max(st['peak'],equity);st['max_drawdown']=max(st['max_drawdown'],100*(1-equity/st['peak']))
    st['last_session']=day;st['sessions']+=1
    st['metrics']=dict(equity_cad=equity,return_percent=100*(equity/10000-1),tsx_equity=bench,tsx_price_return_percent=100*(bench/10000-1),excess_percentage_points=100*(equity-bench)/10000,cash_cad=st['cash'],open_positions=len(st['positions']),closed_trades=len(st['closed']),max_daily_drawdown_percent=st['max_drawdown'],exposure_percent=100*sum(p['qty']*prices[s] for s,p in st['positions'].items())/equity)
    assert st['cash']>=-1e-7 and len(st['positions'])<=4
    return st,events,decisions

def report(root,state,status):
    m=state['metrics'];lines=['# آزمایش کاغذی کانادا: FVG + EMA20','',f"وضعیت: {status}",f"آخرین جلسهٔ ثبت‌شده: {state['last_session']}",f"جلسات آینده‌نگر ثبت‌شده: {state['sessions']}",'',f"ارزش حساب: {m['equity_cad']:.2f} CAD؛ بازده: {m['return_percent']:+.2f}%",f"بازده شاخص قیمت TSX از شروع مشترک: {m['tsx_price_return_percent']:+.2f}%",f"اختلاف بازده: {m['excess_percentage_points']:+.2f} واحد درصد",f"نقد: {m['cash_cad']:.2f} CAD؛ پوزیشن باز: {m['open_positions']}؛ معاملات بسته: {m['closed_trades']}",f"بیشترین افت close روزانه: {m['max_daily_drawdown_percent']:.2f}%؛ مواجههٔ جاری: {m['exposure_percent']:.2f}%",'', '## پوزیشن‌های باز','', '| سهم | تاریخ ورود | قیمت ورود | حد ضرر | هدف |','| --- | --- | --- | --- | --- |']
    for s,p in sorted(state['positions'].items()):lines.append(f"| {s} | {p['entry_date']} | {p['entry']:.2f} | {p['stop']:.2f} | {p['target']:.2f} |")
    if not state['positions']:lines+=['', 'هنوز پوزیشن باز ندارد.']
    lines+=['','## سفارش‌های کاغذی جلسهٔ بعد','']
    for s,p in sorted(state['pending'].items()):lines.append(f"- {s}: تأیید در {p['signal_date']}؛ اجرای فرضی open جلسهٔ بعد، مشروط به ظرفیت و نقد.")
    if not state['pending']:lines.append('سفارشی ثبت نشده است.')
    lines+=['','این حساب مستقل و فرضی است. بازده شامل نقد و ارزش پوزیشن‌های باز با هزینهٔ فرضی فروش است. benchmark شاخص قیمت است، نه ETF قابل خرید و نه بازده کل با سود نقدی. سود نقدی هر دو سمت، بهرهٔ نقد، مالیات و تبدیل ارز در این نسخه مدل نشده‌اند. کم‌بودن مواجههٔ حساب با مواجههٔ کامل TSX باید همراه سود و افت خوانده شود. هیچ سابقهٔ تاریخی به‌عنوان سود آینده‌نگر وارد نشده است.']
    (root/'latest.md').write_text('\n'.join(lines)+'\n');save(root/'latest.json',dict(version=VERSION,status=status,last_session=state['last_session'],sessions=state['sessions'],metrics=m,positions=state['positions'],pending=state['pending']))

def initialize(root,now):
    assert not (root/'config.json').exists(),'experiment already initialized'
    feeds=list(ThreadPoolExecutor(max_workers=3).map(lambda s:fetch(s,now),SYMBOLS+['^GSPTSE']))
    last={f['bars'][-1]['date'] for f in feeds};assert len(last)==1,'bootstrap feeds have mismatched sessions';last=next(iter(last))
    assert last<now.astimezone(TZ).date().isoformat(),'bootstrap must be an already completed previous session'
    config=dict(version=VERSION,created_utc=now.isoformat(),activation_date=now.astimezone(TZ).date().isoformat(),baseline_session=last,earliest_session='2026-10-13',symbols=SYMBOLS,benchmark='^GSPTSE',timeframe='1d',strategy='new bullish FVG aboveEMA20, later1..20 bar rejection above top andEMA20; next-open entry',ema20_alpha=2/21,atr_length=14,max_zones=12,max_positions=4,initial_capital_cad=10000,risk_budget_cad=100,max_entry_outlay_cad=2500,cost_per_leg=.0005,stop_atr=2,target_r=2,max_hold_bars=60,capacity_tie='alphabetical ticker, opening exits before entries; no intraday exit cash used for opening orders',dividends='excluded both sides; TSX price index only',collector_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),missed_sessions='fail closed; no automatic retroactive decisions',corporate_actions='split or prior canonical-bar revision pauses collection for review')
    state=dict(version=VERSION,config_hash=digest(config),last_session=last,sessions=0,cash=10000.,cost=.0005,positions={},pending={},closed=[],peak=10000.,max_drawdown=0.,benchmark=None,instruments={},metrics=dict(equity_cad=10000.,return_percent=0.,tsx_equity=10000.,tsx_price_return_percent=0.,excess_percentage_points=0.,cash_cad=10000.,open_positions=0,closed_trades=0,max_daily_drawdown_percent=0.,exposure_percent=0.))
    root.mkdir(parents=True,exist_ok=True)
    for f in feeds:
        key='TSX' if f['symbol']=='^GSPTSE' else f['symbol'][:-3]
        save(root/'seed'/f'{key}.json',f)
        if f['symbol']!='^GSPTSE':state['instruments'][f['symbol']]=initial_instrument(f['bars'])
    save(root/'config.json',config)
    append(root,dict(kind='activation',observed_utc=now.isoformat(),state=state,sources=[dict(symbol=f['symbol'],response_sha256=f['response_sha256'],last=f['bars'][-1]['date']) for f in feeds]),None)
    save(root/'status.json',dict(status='armed_waiting_future_session',observed_utc=now.isoformat()));report(root,state,'armed_waiting_future_session')
    print(json.dumps(dict(status='initialized',baseline=last,earliest_session=config['earliest_session'],symbols=SYMBOLS),ensure_ascii=False))

def update(root,now):
    config,state,previous=load(root);today=now.astimezone(TZ).date().isoformat()
    if now.astimezone(TZ).hour<18:
        save(root/'status.json',dict(status='before_capture_window',observed_utc=now.isoformat()));print('No post-close capture yet.');return
    feeds=list(ThreadPoolExecutor(max_workers=3).map(lambda s:fetch(s,now),SYMBOLS+['^GSPTSE']))
    by={f['symbol']:f for f in feeds};bench=by['^GSPTSE'];latest=bench['bars'][-1]['date']
    if latest==state['last_session']:
        save(root/'status.json',dict(status='no_new_session',observed_utc=now.isoformat()));report(root,state,'no_new_session');print('No new session; ledger unchanged.');return
    assert latest==today and latest>=config['earliest_session'],'late historical data cannot create prospective decisions'
    new=[b['date'] for b in bench['bars'] if b['date']>state['last_session']]
    assert new==[today],'missed sessions: stop; do not backfill decisions'
    pack={}
    for s,f in by.items():
        assert f['bars'][-1]['date']==today,f'{s}: stale daily bar'
        split_days=[dt.datetime.fromtimestamp(v['date'],TZ).date().isoformat() for v in f['events'].get('splits',{}).values()]
        assert not any(d>config['baseline_session'] for d in split_days),f'{s}: split needs reviewed accounting'
        if s in state['instruments']:
            indexed={b['date']:b for b in f['bars']}
            for old in state['instruments'][s]['tail']:
                assert indexed.get(old['date'])==old,f'{s}: previous captured OHLC changed; review required'
        pack[s]=f['bars'][-1]
    st,events,decisions=advance(state,today,pack)
    append(root,dict(kind='session',date=today,observed_utc=now.isoformat(),state=st,events=events,decisions=decisions,inputs=pack,sources=[dict(symbol=f['symbol'],response_sha256=f['response_sha256'],url=f['url']) for f in feeds]),previous)
    save(root/'status.json',dict(status='captured',observed_utc=now.isoformat(),session=today));report(root,st,'captured')
    print(json.dumps(dict(status='captured',session=today,metrics=st['metrics'],events=events,decisions=decisions),ensure_ascii=False))

def main():
    p=argparse.ArgumentParser();p.add_argument('action',choices=['init','update','audit']);p.add_argument('--root',default='data/research/fvg-ema20-canada-paper');a=p.parse_args();root=Path(a.root);now=utcnow()
    try:
        if a.action=='init':initialize(root,now)
        elif a.action=='audit':config,state,previous=load(root);print(json.dumps(dict(status='audit_pass',last_session=state['last_session'],sessions=state['sessions'],checkpoint=previous)))
        else:update(root,now)
    except Exception as ex:
        if root.exists():save(root/'status.json',dict(status='blocked',observed_utc=now.isoformat(),reason=str(ex)))
        raise
if __name__=='__main__':main()
