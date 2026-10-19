import {riskFeatures,fitProbability,probability,CONFIG} from '../engine.mjs';
import {hash} from '../../v3/data.mjs';
export const HORIZON=10;
const firstFit=CONFIG.firstOrigin+CONFIG.minTrain-1+HORIZON;
export function forecastAt(bars,t=bars.length-1){
 if(t<firstFit)throw Error('Insufficient matured training');
 const prefix=bars.slice(0,t+1),{rows,returns:r}=riskFeatures(prefix),row=rows.at(-1);
 const fitT=firstFit+Math.floor((t-firstFit)/21)*21;
 const known=rows.filter(v=>v.t+HORIZON<=fitT);
 const labels=known.map(v=>({x:v.x,y:+(Math.sqrt(r.slice(v.t+1,v.t+HORIZON+1).reduce((s,x)=>s+x*x,0)/HORIZON)>v.threshold)}));
 const full=fitProbability(labels),level=fitProbability(labels.map(v=>({x:[v.x[0]],y:v.y})));
 return {t,date:row.date,threshold:row.threshold,currentHigh:row.currentHigh,currentVol:row.currentVol,features:row.x,fitDate:bars[fitT].date,lastTrainingOrigin:known.at(-1).date,lastTrainingLabelEnd:bars[fitT].date,n:labels.length,fit:{full,level},probabilities:{full:probability(full,row.x),level:probability(level,[row.x[0]])}};
}
export function chainEvent(state,event){
 const previousHash=state.events.at(-1)?.eventHash??state.genesisHash;
 const item={...event,previousHash};item.eventHash=hash(JSON.stringify(item));state.events.push(item);return item;
}
export function verifyState(state){
 if(state.schema!=='risk-forward-v1'||state.genesisHash!==hash(JSON.stringify(state.genesis)))throw Error('Invalid genesis');
 let previous=state.genesisHash;
 for(const event of state.events){const {eventHash,...payload}=event;if(payload.previousHash!==previous||hash(JSON.stringify(payload))!==eventHash)throw Error('Broken event chain');previous=eventHash;}
 for(const [id,seed] of Object.entries(state.genesis.seedBars)){
  let canonical=seed.map(r=>({...r}));
  for(const e of state.events.filter(e=>e.market===id&&e.kind==='observations'))canonical.push(...e.bars);
  if(JSON.stringify(canonical)!==JSON.stringify(state.markets[id].bars))throw Error('Canonical bars do not match immutable chain');
 }
 return state;
}
export function advance(state,id,snapshot,{recordedAt,rawSha256}){
 verifyState(state);
 const now=Date.parse(recordedAt),market=state.markets[id],last=market.bars.at(-1),at=snapshot.findIndex(b=>b.date===last.date);
 if(!Number.isFinite(now)||at<1)throw Error('Missing canonical anchor or timestamp');
 const newBars=[];
 for(let i=at+1;i<snapshot.length;i++){
  if(Date.parse(snapshot[i].availableAt)>now)throw Error('Incomplete observation');
  const previous=newBars.at(-1)??last,logReturn=Math.log(snapshot[i].close/snapshot[i-1].close);
  if(!Number.isFinite(logReturn))throw Error('Invalid new return');
  newBars.push({...snapshot[i],close:previous.close*Math.exp(logReturn),asOfReturn:logReturn});
 }
 const oldReturn=Math.log(last.close/market.bars.at(-2).close),vendorReturn=Math.log(snapshot[at].close/snapshot[at-1].close);
 if(newBars.length){
  chainEvent(state,{kind:'observations',market:id,recordedAt,rawSha256,anchorDate:last.date,anchorReturnRevision:vendorReturn-oldReturn,bars:newBars});market.bars.push(...newBars);
 }
 // Outcomes reference earlier immutable forecasts; no edits to forecast events.
 for(const f of state.events.filter(e=>e.kind==='forecast'&&e.market===id)){
  if(state.events.some(e=>e.kind==='outcome'&&e.forecastHash===f.eventHash))continue;
  const end=f.t+HORIZON;if(end>=market.bars.length)continue;
  const future=market.bars.slice(f.t+1,end+1),prices=[market.bars[f.t],...future];
  const rms=Math.sqrt(future.reduce((s,b,i)=>s+Math.log(b.close/prices[i].close)**2,0)/HORIZON);
  chainEvent(state,{kind:'outcome',market:id,recordedAt,forecastHash:f.eventHash,targetEndDate:market.bars[end].date,futureVol:rms,actual:+(rms>f.threshold)});
 }
 const latest=market.bars.at(-1),deadline=Date.parse(latest.availableAt)+14*3600000;
 if(latest.date<state.genesis.startOrigin||state.events.some(e=>e.kind==='forecast'&&e.market===id&&e.date===latest.date))return {status:'no-new-eligible-origin',addedBars:newBars.length};
 if(now<Date.parse(latest.availableAt)||now>deadline){
  if(!state.events.some(e=>e.kind==='missed'&&e.market===id&&e.date===latest.date))chainEvent(state,{kind:'missed',market:id,date:latest.date,recordedAt,reason:'outside-predeclared-decision-window'});
  return {status:'missed-decision-window',addedBars:newBars.length};
 }
 for(const bar of newBars.slice(0,-1))if(bar.date>=state.genesis.startOrigin)chainEvent(state,{kind:'missed',market:id,date:bar.date,recordedAt,reason:'observation-catchup-without-forecast-backfill'});
 const prediction=forecastAt(market.bars);
 const event=chainEvent(state,{kind:'forecast',market:id,recordedAt,availableAt:latest.availableAt,rawSha256,...prediction});
 verifyState(state);return {status:'forecast-recorded',date:latest.date,probabilities:event.probabilities,addedBars:newBars.length};
}
