import {loadDashboard} from '../lib/engine-dashboard.js';
export default async function handler(req,res){
  if((req.method||'GET')!=='GET')return res.status(405).json({error:'method_not_allowed'});
  try{
    const data=await loadDashboard();
    const available=data.reports.some(r=>r.status==='available');
    res.setHeader('Cache-Control',available?'s-maxage=60, stale-while-revalidate=120':'no-store');
    return res.status(available?200:503).json(data);
  }catch{
    res.setHeader('Cache-Control','no-store');
    return res.status(503).json({error:'engine_evidence_unavailable'});
  }
}
