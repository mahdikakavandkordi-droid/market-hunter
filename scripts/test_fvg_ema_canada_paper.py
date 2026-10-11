import copy, hashlib, json, tempfile, unittest
from pathlib import Path
import fvg_ema_canada_paper as paper

def fixture():
    tail=[dict(date='2026-10-08',open=100.,high=101.,low=99.,close=100.),dict(date='2026-10-09',open=100.,high=101.,low=99.,close=100.)]
    instruments={s:dict(ema=100.,atr=1.,tail=copy.deepcopy(tail),zones=[],setup=None,session_index=0) for s in paper.SYMBOLS}
    state=dict(cash=10000.,cost=.0005,positions={},pending={},closed=[],benchmark=None,instruments=instruments,peak=10000.,max_drawdown=0.,last_session='2026-10-09',sessions=0)
    pack={s:dict(date='2026-10-13',open=100.,high=102.,low=99.,close=101.) for s in paper.SYMBOLS+['^GSPTSE']}
    return state,pack

class Accounting(unittest.TestCase):
    def test_stop_precedes_target_and_account_reconciles(self):
        s,b=fixture();s['pending']['RY.TO']=dict(signal_date='2026-10-09',atr=1.,zone_id='2026-10-08')
        b['RY.TO'].update(high=105.,low=97.)
        out,events,_=paper.advance(s,'2026-10-13',b)
        self.assertEqual(out['closed'][0]['reason'],'stop')
        self.assertAlmostEqual(out['cash'],10000.+out['closed'][0]['net_profit'])
        self.assertAlmostEqual(out['metrics']['tsx_price_return_percent'],1.)
        self.assertEqual(s['cash'],10000.)
    def test_gap_is_not_capped_at_stop(self):
        s,b=fixture();s['cash']=7498.75
        s['positions']['RY.TO']=dict(entry=100.,entry_date='2026-10-08',signal_date='2026-10-07',qty=25.,stop=98.,target=104.,distance=2.,outlay=2501.25,zone_id='2026-10-06',age=1,timeout=False)
        b['RY.TO'].update(open=95.,high=97.,low=94.,close=96.)
        out,_,_=paper.advance(s,'2026-10-13',b)
        self.assertEqual(out['closed'][0]['exit'],95.)
        self.assertLess(out['closed'][0]['net_r'],-2.5)
    def test_open_capacity_is_deterministic(self):
        s,b=fixture()
        for ticker in paper.SYMBOLS[:5]:s['pending'][ticker]=dict(signal_date='2026-10-09',atr=1.,zone_id='2026-10-08')
        out,events,_=paper.advance(s,'2026-10-13',b)
        self.assertEqual(sorted(out['positions']),sorted(paper.SYMBOLS[:5])[:4])
        self.assertGreaterEqual(out['cash'],-1e-8)
        self.assertEqual(sum(e['type']=='entry_skipped_capacity' for e in events),1)
    def test_rejection_queues_next_session_not_same_close(self):
        s,b=fixture();z=dict(id='2026-10-09',top=101.5,bottom=100.5)
        s['instruments']['RY.TO']['zones']=[z];s['instruments']['RY.TO']['setup']=dict(i=0,zone=z)
        b['RY.TO'].update(high=104.,low=101.,close=103.)
        out,events,_=paper.advance(s,'2026-10-13',b)
        self.assertIn('RY.TO',out['pending']);self.assertNotIn('RY.TO',out['positions'])
        self.assertFalse(any(e['type']=='entry' for e in events))
        for v in b.values():v.update(date='2026-10-14',open=104.,high=105.,low=103.,close=104.5)
        out2,events,_=paper.advance(out,'2026-10-14',b)
        self.assertEqual(out2['positions']['RY.TO']['entry_date'],'2026-10-14')
    def test_full_fill_is_not_a_rejection_entry(self):
        s,b=fixture();z=dict(id='2026-10-09',top=101.5,bottom=100.5)
        s['instruments']['RY.TO']['zones']=[z];s['instruments']['RY.TO']['setup']=dict(i=0,zone=z)
        b['RY.TO'].update(high=104.,low=100.,close=103.)
        out,_,d=paper.advance(s,'2026-10-13',b)
        self.assertNotIn('RY.TO',out['pending'])
        self.assertTrue(any(x.get('reason')=='zone_removed' for x in d))
    def test_timeout_is_next_open(self):
        s,b=fixture();s['cash']=7498.75
        s['positions']['RY.TO']=dict(entry=100.,entry_date='2026-07-01',signal_date='2026-06-30',qty=25.,stop=98.,target=104.,distance=2.,outlay=2501.25,zone_id='2026-06-29',age=59,timeout=False)
        out,_,_=paper.advance(s,'2026-10-13',b)
        self.assertTrue(out['positions']['RY.TO']['timeout'])
        b['RY.TO'].update(open=103.,high=103.5,low=102.,close=103.)
        out,_,_=paper.advance(out,'2026-10-14',b)
        self.assertEqual(out['closed'][0]['reason'],'time_exit')
        self.assertEqual(out['closed'][0]['exit'],103.)
    def test_tampered_checkpoint_is_rejected(self):
        s,_=fixture();config=dict(collector_sha256=hashlib.sha256(Path(paper.__file__).read_bytes()).hexdigest());s['config_hash']=paper.digest(config)
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);paper.save(root/'config.json',config);paper.append(root,dict(kind='activation',state=s),None)
            paper.load(root)
            wrapper=json.loads((root/'state.json').read_text());wrapper['state']['cash']+=1;paper.save(root/'state.json',wrapper)
            with self.assertRaises(AssertionError):paper.load(root)

if __name__=='__main__':unittest.main()
