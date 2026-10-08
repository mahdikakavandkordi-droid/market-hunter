"""Post-test diagnostics, not new model selection or another holdout claim."""
import json
import numpy as np
import pandas as pd
import gold_research as g

def main():
    result=json.loads((g.OUT/'test.json').read_text())
    pred=pd.DataFrame(json.loads((g.OUT/'test-predictions.json').read_text())).set_index('date')
    pred.index=pd.to_datetime(pred.index)
    b=g.load_bars(2025); x,y,r,end=g.dataset(b)
    detail=result['detail']; mask=np.ones(len(pred),dtype=bool)
    for d in detail['conditions']:
        value=x.loc[pred.index,d['feature']]
        mask &= value.le(d['threshold']) if d['side']=='le' else value.gt(d['threshold'])
    expected=np.where(mask,detail['posterior'],detail['base'])
    np.testing.assert_allclose(expected,pred.probability,atol=1e-9)
    np.testing.assert_array_equal(y.loc[pred.index],pred.y)
    np.testing.assert_allclose(r.loc[pred.index],pred['return'],atol=1e-9)
    hits=pred.loc[mask]
    # These probabilities use only targets that have finished before each date.
    # Added after viewing test results: diagnostic comparator, not confirmatory.
    recent=[]; expanding=[]
    for date in pred.index:
        available=y.loc[(y.index<date)&(end<date)]
        assert len(available)>=250
        recent.append(float(available.iloc[-250:].mean()))
        expanding.append(float(available.mean()))
    gain=(pred.y.to_numpy()-pred.fit_frequency.to_numpy())**2-(pred.y.to_numpy()-pred.probability.to_numpy())**2
    block_checks=[]
    for block in [40,60]:
        rng=np.random.default_rng(g.SEED); n=len(gain); means=[]
        for _ in range(2000):
            starts=rng.integers(0,n,size=int(np.ceil(n/block)))
            idx=((starts[:,None]+np.arange(block))%n).ravel()[:n]
            means.append(float(gain[idx].mean()))
        block_checks.append({'observations_per_block':block,'ci95':np.quantile(means,[.025,.975]).tolist()})
    model={'version':'gold-v1-rule-research-only','decision':'not approved for live use','trained_through_target_exit':result['fit_last_exit'],'target':'positive five-session bid-price return, next weekday open to fifth weekday close','feature_implementation_sha256':g.sha(g.Path(__file__).parent/'gold_research.py'),'conditions':detail['conditions'],'probability_when_all_conditions_true':detail['posterior'],'probability_otherwise':detail['base'],'calibration_warning':'Historical conditional frequencies were not calibrated on a separate calibration set; both outputs are above 0.5 and imply the same binary direction.','feature_warmup':200,'protocol_sha256':result['protocol_sha256']}
    g.save('model.json',model)
    summary={'diagnostic_only_post_test':True,'new_model_fits':0,'unchanged_test_result_sha256':g.sha(g.OUT/'test.json'),'independent_recomputed_predictions':'passed','rule_hits':len(hits),'rule_coverage':len(hits)/len(pred),'rule_up_count':int(hits.y.sum()),'rule_up_rate':None if hits.empty else float(hits.y.mean()),'rule_hit_dates':hits.index.strftime('%Y-%m-%d').tolist(),'all_predictions_above_half':bool((pred.probability>.5).all()),'extra_block_bootstraps':block_checks,'adaptive_baselines_added_after_test':{'rolling_250_matured_labels':g.metrics(pred.y,recent),'expanding_matured_labels':g.metrics(pred.y,expanding)},'interpretation':'Small improvement over a static full-history baseline passed the narrow prespecified criterion. Development loss was worse than baseline, directional accuracy equals always-up, and the signal applies to few overlapping observations. This is a hypothesis, not a validated trading edge.'}
    g.save('audit.json',summary)
    print(json.dumps(summary,indent=2))

if __name__=='__main__':main()
