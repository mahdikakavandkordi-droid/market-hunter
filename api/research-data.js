import {readFile} from 'node:fs/promises';
import {choosePublishedResearch} from '../lib/published-research.js';
const FILES=Object.freeze({
  daily:'daily-market-report.json',
  pulse:'market-pulse-report.json',
  v2:'v2-latest-scan.json'
});
export default async function handler(req,res){
  if((req.method||'GET')!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const kind=String(req.query?.kind||'');
  const file=FILES[kind];
  if(!file)return res.status(400).json({error:'invalid_research_data_kind'});
  try{
    const minute=Math.floor(Date.now()/60000);
    const url='https://raw.githubusercontent.com/mahdikakavandkordi-droid/market-hunter/main/data/'+file+'?v='+minute;
    const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error('upstream_'+r.status);
    const remote=await r.json();
    let deployed=null;
    try{deployed=JSON.parse(await readFile(new URL('../data/'+file,import.meta.url),'utf8'));}catch{}
    const chosen=choosePublishedResearch(kind,remote,deployed);
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Market-Hunter-Source',chosen.source);
    res.setHeader('X-Market-Hunter-Generated-At',chosen.data.generatedAt);
    return res.status(200).json(chosen.data);
  }catch(e){
    res.setHeader('Cache-Control','no-store');
    return res.status(503).json({error:'research_data_unavailable',message:e.message});
  }
}
