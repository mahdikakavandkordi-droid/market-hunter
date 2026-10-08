"""Deterministic leakage and target alignment checks, independent of scores."""
import unittest
import numpy as np
import pandas as pd
import gold_research as g

class GoldTests(unittest.TestCase):
    def setUp(self):
        index=pd.bdate_range('2010-01-01',periods=1000)
        rng=np.random.default_rng(4)
        close=100*np.exp(np.cumsum(rng.normal(0,.01,1000)))
        op=close*(1+rng.normal(0,.003,1000))
        self.b=pd.DataFrame({'open':op,'close':close,'high':np.maximum(op,close)*1.01,'low':np.minimum(op,close)*.99,'quality':True},index=index)
        self.b.index.name='date'

    def test_prefix_future_and_target(self):
        self.assertEqual(g.checks(self.b)['status'],'passed')

    def test_incomplete_future_days_not_skipped(self):
        b=self.b.copy(); b.loc[b.index[700],'quality']=False
        x,*_=g.dataset(b)
        self.assertTrue(all(b.index[i] not in x.index for i in range(695,705)))
        self.assertIn(b.index[705],x.index)

    def test_volume_unused(self):
        pd.testing.assert_frame_equal(g.features(self.b),g.features(self.b.assign(volume=999)))

    def test_purge_uses_exit(self):
        x,y,r,end=g.dataset(self.b); start=x.index[400]
        train=(x.index<start)&(end<start)
        self.assertTrue((end.loc[train]<start).all())
        self.assertEqual(int(((x.index<start)&~train).sum()),5)

    def test_bootstrap_identity(self):
        y=np.array([0,1]*100); p=np.full(200,.5)
        self.assertEqual(g.bootstrap_gain(y,p,p)['ci95'],[0.0,0.0])

if __name__=='__main__': unittest.main()
