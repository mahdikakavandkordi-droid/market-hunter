import {loadHunterMonitor} from '../lib/hunter-monitor.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if((req.method||'GET')!=='GET')return res.status(405).json({error:'method_not_allowed'});
  try{return res.status(200).json(await loadHunterMonitor());}
  catch{return res.status(503).json({error:'hunter_monitor_unavailable'});}
}
