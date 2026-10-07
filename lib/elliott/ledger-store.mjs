import fs from 'node:fs';
import path from 'node:path';
import {hash,verifyLedger,assertPreserved} from './paper-account.mjs';

export function readLedger(file,config) {
  if(!fs.existsSync(file))return null;
  let data;try{data=JSON.parse(fs.readFileSync(file,'utf8'))}catch{throw Error('unreadable_ledger')}
  if(!data.ledger||data.checksum!==hash(data.ledger))throw Error('ledger_checksum_mismatch');
  return verifyLedger(data.ledger,config);
}
export function writeLedger(file,next,config,{expectedRevision}={}) {
  verifyLedger(next,config);
  if(!Number.isInteger(expectedRevision)||expectedRevision<0)throw Error('explicit_revision_required');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const lock=file+'.lock';let fd;
  try{fd=fs.openSync(lock,'wx')}catch(e){if(e.code==='EEXIST')throw Error('ledger_write_locked');throw e}
  const tmp=file+'.tmp-'+process.pid;
  try {
    const old=readLedger(file,config);
    if((old?.revision??0)!==expectedRevision)throw Error('ledger_revision_conflict');
    if(old)assertPreserved(old,next,config);
    else if(next.revision!==1)throw Error('initial_ledger_revision_invalid');
    const body=JSON.stringify({checksum:hash(next),ledger:next},null,2)+'\n';
    const out=fs.openSync(tmp,'wx');try{fs.writeFileSync(out,body);fs.fsyncSync(out)}finally{fs.closeSync(out)}
    fs.renameSync(tmp,file);
    const dir=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(dir)}finally{fs.closeSync(dir)}
  }finally {
    if(fs.existsSync(tmp))fs.unlinkSync(tmp);
    fs.closeSync(fd);fs.unlinkSync(lock);
  }
  return next;
}
