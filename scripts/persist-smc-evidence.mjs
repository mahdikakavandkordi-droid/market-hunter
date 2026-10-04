import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

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
function tradeKey(x){return [x?.symbol,x?.entryT,x?.dir].join('|')}
const IMMUTABLE=['symbol','signalT','entryT','dir','entry','stop','target','risk'];
function same(a,b){return Object.is(a,b)}
function validateLedger(path,remote){
  const current=JSON.parse(fs.readFileSync(path,'utf8'));
  if(!Array.isArray(current?.trades))return;
  const prior=remote&&Array.isArray(remote?.trades)?remote.trades:[];
  const nowBy=new Map();
  for(const tr of current.trades){
    const key=tradeKey(tr);
    if(nowBy.has(key))throw new Error(path+': duplicate trade identity '+key);
    nowBy.set(key,tr);
  }
  for(const old of prior){
    const key=tradeKey(old),next=nowBy.get(key);
    if(!next)throw new Error(path+': immutable prior record disappeared: '+key);
    for(const field of IMMUTABLE){
      if(!same(old?.[field],next?.[field]))throw new Error(path+': immutable field changed for '+key+': '+field);
    }
    if(old?.status==='closed'){
      if(next?.status!=='closed'||!same(old?.R,next?.R)||!same(old?.exitT,next?.exitT)){
        throw new Error(path+': closed outcome changed for '+key);
      }
    }
  }
}

git(['config','user.name','market-hunter-bot']);
git(['config','user.email','market-hunter-bot@users.noreply.github.com']);
git(['fetch','origin',branch]);

for(const path of files.filter(x=>x.endsWith('-ledger.json'))){
  const show=git(['show',`origin/${branch}:${path}`],{allowFail:true,capture:true});
  let remote=null;
  if(show.status===0&&show.stdout.trim())remote=JSON.parse(show.stdout);
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
