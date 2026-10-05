import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';

function arg(name){
  const i=process.argv.indexOf(name);
  return i>=0?process.argv[i+1]:null;
}
function argsAfter(name){
  const i=process.argv.indexOf(name);
  return i>=0?process.argv.slice(i+1):[];
}
const branch=arg('--branch');
const message=arg('--message');
const files=argsAfter('--files');
if(!branch||!message||!files.length)throw new Error('usage: --branch <branch> --message <message> --files <paths...>');

function git(parts,{allowFail=false,capture=false}={}){
  const r=spawnSync('git',parts,{encoding:'utf8',stdio:capture?'pipe':'inherit'});
  if(r.status!==0&&!allowFail)throw new Error('git '+parts.join(' ')+' failed'+(r.stderr?': '+r.stderr.trim():''));
  return r;
}
function tradeKey(x){return x?.decisionId||[x?.symbol,x?.signalT,x?.dir].join('|')}
const CORE=['symbol','signalT','dir','signalSnapshot'];
const ENTRY=['entryT','entry','stop','target','risk'];
const SNAPSHOTS=['momentumShadow','kijunExitDecision'];
const PROVENANCE=['decisionId','firstObservedAt','firstObservedProvenance','decisionAvailableAt','entryWaitHours','historicalDiagnostic'];
function present(x){return x!==undefined&&x!==null}

function parseLedger(text,label){
  let x;
  try{x=JSON.parse(text)}catch(e){throw new Error(label+': corrupt ledger JSON: '+e.message)}
  if(!x||!Array.isArray(x.trades))throw new Error(label+': invalid ledger schema; trades[] required');
  return x;
}
function validateLedger(path,remote){
  const current=parseLedger(fs.readFileSync(path,'utf8'),path);
  if(remote&&(!isDeepStrictEqual(remote.configHash,current.configHash)||!isDeepStrictEqual(remote.forwardStart,current.forwardStart)))throw new Error(path+': frozen configuration changed');
  const prior=remote&&Array.isArray(remote?.trades)?remote.trades:[];
  const nowBy=new Map();
  for(const tr of current.trades){
    const key=tradeKey(tr);
    if(nowBy.has(key))throw new Error(path+': duplicate trade identity '+key);
    nowBy.set(key,tr);
  }
  for(const old of prior){
    const key=tradeKey(old),next=nowBy.get(key);
    if(!next)throw new Error(path+': prior evidence disappeared: '+key);

    for(const field of [...CORE,...SNAPSHOTS]){
      if(present(old?.[field])&&!isDeepStrictEqual(old?.[field],next?.[field])){
        throw new Error(path+': immutable field changed for '+key+': '+field);
      }
    }
    for(const field of PROVENANCE){
      if(present(old?.[field])&&!isDeepStrictEqual(old?.[field],next?.[field])){
        throw new Error(path+': provenance changed for '+key+': '+field);
      }
      if(!present(old?.[field])&&present(next?.[field])&&old?.status!=='pending_entry'){
        throw new Error(path+': refusing retroactive provenance/identity backfill for legacy '+key+': '+field);
      }
    }
    for(const field of ENTRY){
      if(present(old?.[field])&&!isDeepStrictEqual(old?.[field],next?.[field])){
        throw new Error(path+': immutable entry field changed for '+key+': '+field);
      }
      if(!present(old?.[field])&&present(next?.[field])&&old?.status!=='pending_entry'){
        throw new Error(path+': entry field appeared outside pending-entry lifecycle for '+key+': '+field);
      }
    }

    if(old?.status==='cancelled'&&!isDeepStrictEqual(old,next))throw new Error(path+': cancelled decision changed for '+key);
    if(old?.status==='closed'){
      if(next?.status!=='closed'||!isDeepStrictEqual(old?.R,next?.R)||!isDeepStrictEqual(old?.exitT,next?.exitT)){
        throw new Error(path+': closed outcome changed for '+key);
      }
      for(const field of ['exitReason','exitPriceAssumed','exitTimeConvention','executionAudit']){
        if(present(old?.[field])&&!isDeepStrictEqual(old?.[field],next?.[field])){
          throw new Error(path+': closed execution evidence changed for '+key+': '+field);
        }
      }
    }
    if(old?.status==='open'&&!['open','closed'].includes(next?.status)){
      throw new Error(path+': invalid lifecycle transition for '+key+': '+old.status+' -> '+next?.status);
    }
    if(old?.status==='pending_entry'&&!['pending_entry','open','closed','cancelled'].includes(next?.status)){
      throw new Error(path+': invalid pending lifecycle transition for '+key+': '+next?.status);
    }
  }
}

git(['config','user.name','market-hunter-bot']);
git(['config','user.email','market-hunter-bot@users.noreply.github.com']);
git(['fetch','origin',branch]);

for(const path of files.filter(x=>x.endsWith('-ledger.json'))){
  const show=git(['show',`origin/${branch}:${path}`],{allowFail:true,capture:true});
  let remote=null;
  if(show.status===0&&show.stdout.trim())remote=parseLedger(show.stdout,'origin/'+branch+':'+path);
  validateLedger(path,remote);
}

git(['add',...files]);
const diff=git(['diff','--cached','--quiet'],{allowFail:true});
if(diff.status===0){
  console.log('No evidence changes to persist.');
  process.exit(0);
}
git(['commit','-m',message]);

for(let attempt=1;attempt<=5;attempt++){
  git(['fetch','origin',branch]);
  const rebase=git(['rebase',`origin/${branch}`],{allowFail:true});
  if(rebase.status!==0){
    git(['rebase','--abort'],{allowFail:true});
    throw new Error('Evidence branch rebase conflict; refusing silent ledger rewrite.');
  }
  const push=git(['push','origin',`HEAD:${branch}`],{allowFail:true});
  if(push.status===0){
    console.log(`Persisted evidence on attempt ${attempt}.`);
    process.exit(0);
  }
  await new Promise(r=>setTimeout(r,attempt*2000));
}
throw new Error('Failed to persist evidence after 5 fetch/rebase/push attempts.');
