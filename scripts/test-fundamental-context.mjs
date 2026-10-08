import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{},URL,Date};vm.createContext(context);vm.runInContext(fs.readFileSync('fundamental-context.js','utf8'),context);
const read=context.window.MHFundamentals.reading;
const data=JSON.parse(fs.readFileSync('data/fundamental-context.json'));
const now=new Date(Date.parse(data.reviewedAt)+60000);
assert.equal(read(data,'BHC.TO','en',now).status,'available');
assert.equal(read(data,'MSFT.TO','fa',now).period.basis,'fiscal-year');
assert.equal(read(data,'SIA.TO','en',now).status,'unavailable');
assert.equal(read(null,'BHC.TO','en',now).status,'unavailable');
assert.equal(read(data,'BHC.TO','en',new Date('2027-03-01')).status,'older-period');
for(const change of [d=>d.items[0].cik='0001326801',d=>d.items[0].sourceUrl='https://example.com/filing',d=>d.items[0].reading.en.monitoring=[],d=>d.items[0].status='partial',d=>d.items[0].acceptedAt='2027-01-01T00:00:00Z',d=>d.items.push(d.items[0]),d=>d.reviewedAt='2027-01-01T00:00:00Z',d=>d.items[0].period.end='2026-02-31']){
 const invalid=structuredClone(data);change(invalid);assert.equal(read(invalid,'BHC.TO','en',now).status,'unavailable');
}
console.log('Fundamental presentation: mapping, dates, source, coverage, duplicates, missing data and older periods passed');
