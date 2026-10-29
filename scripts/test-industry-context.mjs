import assert from 'node:assert/strict';
import {industryContext} from '../lib/industry-context.js';
const meta=['A','B','C','D'].map(symbol=>({symbol,sector:'Technology'}));
const rows=[{symbol:'A',sector:'Technology',date:'2026-10-28',ret20:2,rs20:1,dist50:0,momentumShift:2},{symbol:'B',sector:'Technology',date:'2026-10-28',ret20:-4,rs20:-3,dist50:-1,momentumShift:null},{symbol:'C',sector:'Technology',date:'2026-10-28',ret20:6,rs20:null,dist50:2,momentumShift:0},{symbol:'CDR',sector:'CDR',date:'2026-10-28',rs20:100}];
const saved=JSON.stringify(rows),d=industryContext(rows,meta,'2026-10-28');
assert.equal(d.industries[0].status,'partial');assert.equal(d.industries[0].medianRS20,-1);assert.equal(d.industries[0].medianMomentumShift,1);assert.deepEqual(d.industries[0].outperforming,{count:1,measured:2});assert.equal(d.industries[0].coverage,.75);assert.deepEqual(d.unmappedSymbols,['CDR']);assert.equal(JSON.stringify(rows),saved);
assert.equal(industryContext([],meta,'2026-10-28').industries[0].status,'insufficient_members');assert.throws(()=>industryContext([...rows,rows[0]],meta,'2026-10-28'));assert.throws(()=>industryContext(rows,meta,'2026-10-29'));
console.log('Industry context: missing denominators, unmapped wrappers, partial coverage, session identity and immutability passed');
