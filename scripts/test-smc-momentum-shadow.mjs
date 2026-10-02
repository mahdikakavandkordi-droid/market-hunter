import assert from 'node:assert/strict';
import { momentumShadow } from '../lib/smc-momentum-shadow.mjs';

function bars({n=100,start=100,step=.6,volumeBase=1_000_000,volumeStep=2500}={}){
  const out=[];
  const d=new Date('2026-01-01T12:00:00Z');
  for(let i=0;i<n;i++){
    const c=start+i*step;
    out.push({date:new Date(d.getTime()+i*86400000).toISOString().slice(0,10),c,v:volumeBase+i*volumeStep});
  }
  return out;
}

const market=bars({step:.15,volumeStep:500});
const up=bars({step:.8});
const down=bars({start:180,step:-.7});

const longUp=momentumShadow(up,80,1,market,'TEST-MKT');
const shortUp=momentumShadow(up,80,-1,market,'TEST-MKT');
const shortDown=momentumShadow(down,80,-1,market,'TEST-MKT');

assert.equal(longUp.available,true);
assert.ok(longUp.score>=70,'expected strong long momentum, got '+longUp.score);
assert.ok(shortUp.score<50,'expected weak short momentum in uptrend, got '+shortUp.score);
assert.ok(shortDown.score>=70,'expected strong short momentum, got '+shortDown.score);

const before=momentumShadow(up,80,1,market,'TEST-MKT');
const mutated=structuredClone(up);
for(let i=81;i<mutated.length;i++){ mutated[i].c*=10; mutated[i].v*=20; }
const after=momentumShadow(mutated,80,1,market,'TEST-MKT');
assert.deepEqual(after,before,'future bars changed the momentum score: look-ahead leak');

assert.equal(longUp.asOfDate,up[80].date);
assert.equal(longUp.benchmarkSymbol,'TEST-MKT');
assert.ok(Number.isFinite(longUp.ret20));
assert.ok(Number.isFinite(longUp.ret60));
assert.ok(Number.isFinite(longUp.rsi14));

console.log('SMC momentum shadow tests passed', {longUp:longUp.score,shortUp:shortUp.score,shortDown:shortDown.score});
