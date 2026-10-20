import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export function verifyAssetRefresh(report,keys,nowMs=Date.now()){
  if(!keys.length)throw new Error('No target assets supplied');
  const expectedCrypto=new Date(Math.floor(nowMs/86400000)*86400000-1).toISOString().slice(0,10);
  const failures=[];
  for(const key of keys){
    const matches=(report?.markets||[]).filter(m=>m.key===key),m=matches[0],f=m?.freshness;
    const expected=m?.group==='Crypto'?expectedCrypto:f?.expectedCompletedSession;
    if(matches.length!==1||f?.status!=='fresh'||!/^\d{4}-\d{2}-\d{2}$/.test(expected||'')||m.asOf!==expected||f.latestCompletedSession!==expected||f.expectedCompletedSession!==expected){
      failures.push(key+': '+(f?.status||'missing')+'; completed '+(m?.asOf||'missing')+'; expected '+(expected||'unknown'));
    }
  }
  if(failures.length)throw new Error('Targeted refresh is incomplete: '+failures.join(' | '));
  return keys;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const report=JSON.parse(fs.readFileSync('data/market-pulse-latest.json','utf8'));
  const keys=String(process.env.MARKET_PULSE_KEYS||'').split(',').map(x=>x.trim()).filter(Boolean);
  try{verifyAssetRefresh(report,keys);console.log('Verified completed sessions: '+keys.join(', '));}
  catch(e){console.error(e.message);process.exitCode=1;}
}
