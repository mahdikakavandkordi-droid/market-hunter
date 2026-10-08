"""Causal daily gold experiment. Run `develop`, then `test` once after selection.

No production imports. No broker connection. Output probabilities, not trade advice.
"""
from pathlib import Path
import hashlib, json, sys, platform
import numpy as np
import pandas as pd
import sklearn
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score, accuracy_score
from threadpoolctl import threadpool_limits

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/research/gold-v1'
PROTOCOL = json.loads((OUT/'protocol.json').read_text())
SEED = PROTOCOL['search']['random_seed']

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def save(name, value):
    p = OUT/name
    if p.exists():
        raise FileExistsError(f'Immutable result exists: {p}')
    p.write_text(json.dumps(value, indent=2, allow_nan=False)+'\n')

def load_bars(end):
    rows=[]
    for year in range(2009,end+1):
        rows.extend(json.loads((OUT/f'daily-{year}.json').read_text())['daily'])
    bars=pd.DataFrame(rows).set_index('date')
    bars.index=pd.to_datetime(bars.index)
    assert bars.index.is_monotonic_increasing and bars.index.is_unique
    return bars

def features(b):
    c,o,h,l = [b[x] for x in ['close','open','high','low']]
    r = np.log(c).diff()
    tr=pd.concat([h-l,(h-c.shift()).abs(),(l-c.shift()).abs()],axis=1).max(axis=1)
    atr=tr.rolling(14).mean()
    f={}
    for n in PROTOCOL['features']['lookbacks']:
        f[f'ret_{n}']=np.log(c/c.shift(n))
        f[f'dist_ma_{n}']=(c/c.rolling(n).mean()-1)
        f[f'vol_{n}']=r.rolling(n).std()
        f[f'range_{n}']=tr.rolling(n).mean()/c
        f[f'efficiency_{n}']=(c-c.shift(n))/(c.diff().abs().rolling(n).sum()+1e-12)
        lo,hi=l.rolling(n).min(),h.rolling(n).max()
        f[f'stoch_{n}']=(c-lo)/(hi-lo+1e-12)
        gain=c.diff().clip(lower=0).rolling(n).mean()
        loss=(-c.diff()).clip(lower=0).rolling(n).mean()
        f[f'rsi_{n}']=gain/(gain+loss+1e-12)
        f[f'breakout_{n}']=(c-h.shift().rolling(n).max())/atr
    f['body']=(c-o)/atr
    f['upper_wick']=(h-pd.concat([c,o],axis=1).max(axis=1))/atr
    f['lower_wick']=(pd.concat([c,o],axis=1).min(axis=1)-l)/atr
    f['gap']=(o-c.shift())/atr
    f['atr_percent']=atr/c
    f['vol_ratio']=r.rolling(5).std()/r.rolling(60).std()
    f['quality_fraction_20']=b.quality.rolling(20).mean()
    f['weekday']=pd.Series(b.index.dayofweek,index=b.index)/4
    f['month_sin']=pd.Series(np.sin(2*np.pi*b.index.month/12),index=b.index)
    f['month_cos']=pd.Series(np.cos(2*np.pi*b.index.month/12),index=b.index)
    # A pivot at t-2 is first visible at t: never center/shift backwards.
    ph=h.shift(2).where((h.shift(2)>h.shift(4)) & (h.shift(2)>h.shift(3)) & (h.shift(2)>h.shift(1)) & (h.shift(2)>h))
    pl=l.shift(2).where((l.shift(2)<l.shift(4)) & (l.shift(2)<l.shift(3)) & (l.shift(2)<l.shift(1)) & (l.shift(2)<l))
    last_h,last_l=ph.ffill(),pl.ffill()
    f['pivot_high_distance']=(c-last_h)/atr
    f['pivot_low_distance']=(c-last_l)/atr
    f['swing_size']=(last_h-last_l)/atr
    counter=pd.Series(np.arange(len(b)),index=b.index)
    f['pivot_high_age']=counter-counter.where(ph.notna()).ffill()
    f['pivot_low_age']=counter-counter.where(pl.notna()).ffill()
    return pd.DataFrame(f).replace([np.inf,-np.inf],np.nan)

def dataset(b):
    x=features(b)
    dates=pd.Series(b.index,index=b.index)
    entry,exit=b.open.shift(-1),b.close.shift(-5)
    target_exit=dates.shift(-5)
    # Incomplete days remain explicit; never shorten the target by deleting them.
    valid=b.quality & (b.quality.rolling(5).sum()==5)
    for k in range(1,6):
        valid &= b.quality.shift(-k,fill_value=False)
    valid &= (target_exit-dates).dt.days.le(10) & x.ret_200.notna()
    valid &= dates.ge('2010-01-01') & target_exit.notna()
    return x.loc[valid], (exit>entry).astype(int).loc[valid], np.log(exit/entry).loc[valid], target_exit.loc[valid]

def cols(x,group):
    if group=='price':
        return [c for c in x if c.startswith(('ret_','vol_','range_','dist_ma_','efficiency_')) or c in ['body','upper_wick','lower_wick','gap','atr_percent']]
    if group=='price_and_indicators':
        return [c for c in x if not c.startswith(('pivot_','swing_'))]
    return list(x.columns)

def candidates():
    result=[]
    for group in PROTOCOL['search']['feature_sets']:
        for c in PROTOCOL['search']['logistic_C']:
            result.append({'id':f'logit_{group}_{c}','kind':'logit','group':group,'C':c})
    for leaves in PROTOCOL['search']['tree_leaf_nodes']:
        for l2 in PROTOCOL['search']['tree_l2']:
            result.append({'id':f'tree_{leaves}_{l2}','kind':'tree','group':'all','leaves':leaves,'l2':l2})
    result.append({'id':'train_selected_rules','kind':'rules','group':'all'})
    return result

def rule_predict(x,y,v):
    base=float(y.mean())
    med=x.median().fillna(0)
    a=x.fillna(med).to_numpy(); av=v.fillna(med).to_numpy()
    desc=[]; masks=[]
    for j,name in enumerate(x.columns):
        for q in PROTOCOL['search']['rule_quantiles']:
            t=float(np.quantile(a[:,j],q))
            for side in ['le','gt']:
                desc.append({'feature':name,'column':j,'quantile':q,'threshold':t,'side':side})
                masks.append(a[:,j]<=t if side=='le' else a[:,j]>t)
    atoms=np.asarray(masks)
    rng=np.random.default_rng(SEED)
    pairs=set()
    while len(pairs)<PROTOCOL['search']['max_pair_rules']:
        i,j=sorted(rng.choice(len(atoms),size=2,replace=False).tolist())
        if desc[i]['column'] != desc[j]['column']:
            pairs.add((i,j))
    specs=[(i,) for i in range(len(atoms))]+sorted(pairs)
    best=None
    eligible=0
    yy=np.asarray(y)
    for spec in specs:
        mask=atoms[spec[0]].copy()
        if len(spec)==2: mask &= atoms[spec[1]]
        n=int(mask.sum())
        if min(n,len(y)-n)<PROTOCOL['search']['min_rule_train_support']:
            continue
        eligible+=1
        p=float((yy[mask].sum()+100*base)/(n+100))
        gain=float(np.sum((yy[mask]-base)**2-(yy[mask]-p)**2))
        if best is None or gain>best[0]: best=(gain,spec,p,n)
    pred=np.full(len(v),base)
    if best is None: return pred,{'searched':len(specs),'eligible':0}
    _,spec,p,n=best
    mask=np.ones(len(v),dtype=bool)
    for i in spec:
        d=desc[i]; z=av[:,d['column']]
        mask &= z<=d['threshold'] if d['side']=='le' else z>d['threshold']
    pred[mask]=p
    return pred,{'searched':len(specs),'eligible':eligible,'conditions':[desc[i] for i in spec],'support':n,'posterior':p,'base':base}

def predict(spec,x,y,v):
    selected=cols(x,spec['group']); x=x[selected]; v=v[selected]
    if spec['kind']=='rules': return rule_predict(x,y,v)
    if spec['kind']=='logit':
        model=make_pipeline(SimpleImputer(strategy='median'),StandardScaler(),LogisticRegression(C=spec['C'],max_iter=2000,random_state=SEED))
    else:
        model=HistGradientBoostingClassifier(max_leaf_nodes=spec['leaves'],l2_regularization=spec['l2'],max_iter=100,learning_rate=.05,min_samples_leaf=100,early_stopping=False,random_state=SEED)
    with threadpool_limits(limits=1):
        model.fit(x,y)
        p=model.predict_proba(v)[:,1]
    return p,{'features':len(selected)}

def metrics(y,p):
    p=np.clip(np.asarray(p),1e-6,1-1e-6)
    return {'n':len(y),'up_rate':float(np.mean(y)),'brier':float(brier_score_loss(y,p)),'log_loss':float(log_loss(y,p,labels=[0,1])),'accuracy':float(accuracy_score(y,p>=.5)),'auc':None if len(set(y))<2 else float(roc_auc_score(y,p))}

def checks(b):
    f=features(b); tested=[]
    for n in [250,500,1000,1500,len(b)-50]:
        if n>=len(b) or n<201: continue
        pd.testing.assert_frame_equal(features(b.iloc[:n]),f.iloc[:n])
        alt=b.copy(); alt.loc[alt.index[n:],['open','high','low','close']]*=1.71
        pd.testing.assert_frame_equal(features(alt).iloc[:n],f.iloc[:n])
        tested.append(n)
    # Entry is the next day's open and exit is exactly the fifth future close.
    x,y,r,end=dataset(b)
    for date in x.index[::max(1,len(x)//30)]:
        i=b.index.get_loc(date)
        assert end.loc[date]==b.index[i+5]
        assert abs(r.loc[date]-np.log(b.close.iloc[i+5]/b.open.iloc[i+1]))<1e-12
        assert b.quality.iloc[i+1:i+6].all()
    return {'prefix_and_future_perturbation_points':tested,'target_alignment_checks':len(x.index[::max(1,len(x)//30)]),'status':'passed'}

def develop():
    assert not any((OUT/f'daily-{y}.json').exists() for y in [2024,2025]), 'test history already present: cannot claim sealed run'
    b=load_bars(2023); x,y,r,end=dataset(b)
    tests=checks(b); all_results=[]; ledger=[]
    specs=candidates()
    for year in PROTOCOL['history']['development_years']:
        val=x.index.year==year
        start=x.index[val][0]
        train=(x.index<start) & (end<start)
        assert train.sum()>=500 and val.sum()>=50
        yy=y.loc[val]; base=float(y.loc[train].mean())
        outputs={'fit_frequency':np.full(val.sum(),base),'constant_half':np.full(val.sum(),.5),'momentum20':np.where(x.loc[val,'ret_20']>0,.6,.4)}
        fold={'year':year,'fit_n':int(train.sum()),'validation_n':int(val.sum()),'fit_last_exit':str(end.loc[train].max()),'validation_start':str(start),'candidates':[]}
        for spec in specs:
            p,detail=predict(spec,x.loc[train],y.loc[train],x.loc[val])
            outputs[spec['id']]=p
            fold['candidates'].append({'id':spec['id'],'metrics':metrics(yy,p),'detail':detail})
        frame=pd.DataFrame(outputs,index=x.index[val]); frame['y']=yy; frame['return']=r.loc[val]
        all_results.append(frame)
        ledger.append(fold)
        print(json.dumps({'fold':year,'fit':int(train.sum()),'validation':int(val.sum())}),flush=True)
    oos=pd.concat(all_results)
    scores=[{'id':c,'metrics':metrics(oos.y,oos[c])} for c in oos if c not in ['y','return']]
    scores.sort(key=lambda a:(a['metrics']['brier'],a['id']))
    # Select a learner, then judge it against the predeclared baseline.
    selectable={s['id'] for s in specs}
    winner=next(a['id'] for a in scores if a['id'] in selectable)
    spec=next((s for s in specs if s['id']==winner),{'id':'fit_frequency','kind':'baseline','group':'all'})
    selection={'protocol_sha256':sha(OUT/'protocol.json'),'code_sha256':sha(Path(__file__)),'winner':spec,'scores':scores,'checks':tests,'folds':ledger,'features':list(x.columns),'versions':{'python':platform.python_version(),'numpy':np.__version__,'pandas':pd.__version__,'sklearn':sklearn.__version__},'inputs':{f'daily-{year}.json':sha(OUT/f'daily-{year}.json') for year in range(2009,2024)},'test_opened':False}
    save('development.json',selection)
    save('development-predictions.json',json.loads(oos.reset_index().assign(date=lambda d:d.date.astype(str)).to_json(orient='records')))
    print(json.dumps({'winner':winner,'top':scores[:4]}),flush=True)

def bootstrap_gain(y,p,base):
    gain=(y-base)**2-(y-p)**2
    rng=np.random.default_rng(SEED); n=len(gain); sampled=[]
    for _ in range(2000):
        starts=rng.integers(0,n,size=int(np.ceil(n/20)))
        idx=((starts[:,None]+np.arange(20))%n).ravel()[:n]
        sampled.append(float(np.mean(gain[idx])))
    return {'mean':float(np.mean(gain)),'ci95':np.quantile(sampled,[.025,.975]).tolist(),'block_observations':20,'draws':2000}

def final_test():
    frozen=json.loads((OUT/'development.json').read_text())
    assert frozen['protocol_sha256']==sha(OUT/'protocol.json')
    assert frozen['code_sha256']==sha(Path(__file__)), 'code changed after development lock'
    for file,digest in frozen['inputs'].items(): assert sha(OUT/file)==digest
    b=load_bars(2025); x,y,r,end=dataset(b)
    test=x.index.year.isin([2024,2025]); start=x.index[test][0]
    train=(x.index<start) & (end<start)
    base=np.full(test.sum(),float(y.loc[train].mean()))
    spec=frozen['winner']
    if spec['kind']=='baseline': p,detail=base.copy(),{'reason':'no learner beat frequency baseline in development'}
    else: p,detail=predict(spec,x.loc[train],y.loc[train],x.loc[test])
    yy=y.loc[test]; frame=pd.DataFrame({'y':yy,'probability':p,'fit_frequency':base,'return':r.loc[test]})
    gain=bootstrap_gain(yy.to_numpy(),p,base)
    years={}
    for year in [2024,2025]:
        f=frame.loc[frame.index.year==year]
        years[str(year)]={'winner':metrics(f.y,f.probability),'baseline':metrics(f.y,f.fit_frequency)}
    passed=bool(gain['ci95'][0]>0 and all(v['winner']['brier']<v['baseline']['brier'] for v in years.values()))
    bins=[]
    for lo,hi in [(0,.4),(.4,.5),(.5,.6),(.6,1.000001)]:
        f=frame.loc[(frame.probability>=lo)&(frame.probability<hi)]
        bins.append({'from':lo,'to':min(hi,1),'n':len(f),'mean_prediction':None if f.empty else float(f.probability.mean()),'actual_up_rate':None if f.empty else float(f.y.mean())})
    result={'winner':spec,'selection_sha256':sha(OUT/'development.json'),'protocol_sha256':frozen['protocol_sha256'],'fit_n':int(train.sum()),'fit_last_exit':str(end.loc[train].max()),'test_start':str(start),'test_end':str(frame.index[-1]),'winner_metrics':metrics(yy,p),'baseline_metrics':metrics(yy,base),'constant_half_metrics':metrics(yy,np.full(len(yy),.5)),'momentum20_metrics':metrics(yy,np.where(x.loc[test,'ret_20']>0,.6,.4)),'paired_brier_improvement':gain,'years':years,'probability_bins':bins,'detail':detail,'passed_frozen_success_criterion':passed,'status':'predictive_evidence_requires_replication' if passed else 'no_confirmed_predictive_edge','test_inputs':{f'daily-{year}.json':sha(OUT/f'daily-{year}.json') for year in [2024,2025]},'checks':checks(b),'live_model_deployed':False}
    save('test.json',result)
    save('test-predictions.json',json.loads(frame.reset_index().assign(date=lambda d:d.date.astype(str)).to_json(orient='records')))
    print(json.dumps(result,indent=2),flush=True)

if __name__=='__main__':
    if sys.argv[1]=='develop': develop()
    elif sys.argv[1]=='test': final_test()
    else: raise ValueError('Expected develop or test')
