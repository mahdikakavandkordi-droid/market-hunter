import fs from 'node:fs';
import assert from 'node:assert/strict';
import {INDEX_QUOTES} from '../lib/intraday.js';

const app=fs.readFileSync('app.js','utf8');
const pulse=JSON.parse(fs.readFileSync('data/market-pulse-report.json','utf8'));
const nasdaq=pulse.markets.find(x=>x.key==='NASDAQ100');
assert.equal(nasdaq?.name,'Nasdaq-100');
assert.equal(nasdaq?.symbol,'^NDX');
assert.match(app,/NASDAQ100:'\^NDX'/,'Nasdaq-100 overlay must use ^NDX');
assert.doesNotMatch(app,/NASDAQ100:'\^IXIC'/,'Nasdaq Composite quote must never sit under Nasdaq-100');
assert.ok(INDEX_QUOTES.some(([symbol,name])=>symbol==='^NDX'&&/Nasdaq-100/i.test(name)),'presentation feed should request ^NDX');
assert.equal(INDEX_QUOTES.some(([symbol,name])=>symbol==='^IXIC'&&/Nasdaq-100/i.test(name)),false);
console.log('PASS: Market Pulse and hourly presentation use identical Nasdaq-100 instrument identity');
