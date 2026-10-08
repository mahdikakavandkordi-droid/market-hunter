const DAY=86400000;
export function buildSplits(labels,contract) {
  const s=contract.split,seen=new Set(),groups=new Map();
  for(const row of labels){
    if(seen.has(row.id))throw Error('duplicate_label_id');seen.add(row.id);
    const t=Date.parse(row.availableAt);
    if(s.holdoutSymbols.includes(row.symbol)||t>=Date.parse(s.finalTestStart)||!['train','validation'].includes(row.partition))throw Error('sealed_label_in_split');
    if(![1,-1].includes(row.dir)||!['resolved','unresolved'].includes(row.status)||t<Date.parse(s.trainDecisionStart)||!Number.isFinite(t)||!Number.isFinite(Date.parse(row.informationEnd))||Date.parse(row.informationEnd)<t)throw Error('invalid_information_interval');
    const key=Math.floor(t/DAY)*DAY;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }
  const validation1=Date.parse('2026-01-01T00:00:00Z'),validation2=Date.parse('2026-03-01T00:00:00Z'),final=Date.parse(s.finalTestStart);
  if(validation1!==Date.parse(s.validationStart))throw Error('contract_validation_window_changed');
  const windows=[{name:'validation_1',start:validation1,end:validation2},{name:'validation_2',start:validation2,end:final},{name:'final_fit_only',start:final,end:final}];
  const records=[];
  for(const window of windows) {
    const embargoStart=window.start-s.embargoDays*DAY;
    for(const [day,rows] of groups) {
      const maxEnd=Math.max(...rows.filter(r=>r.status==='resolved').map(r=>Date.parse(r.informationEnd))),before=day+DAY<=embargoStart;
      const validation=day>=window.start&&day+DAY<=window.end&&maxEnd<window.end;
      let groupRole=before&&maxEnd<window.start?'fit':validation?'evaluate':'excluded';
      const pairs=new Map();for(const r of rows){const k=r.symbol+'|'+r.availableAt;if(!pairs.has(k))pairs.set(k,[]);pairs.get(k).push(r);}
      for(const pair of pairs.values()) {
        const validPair=pair.length===2&&new Set(pair.map(r=>r.dir)).size===2&&pair.every(r=>r.status==='resolved');
        for(const row of pair)records.push({id:row.id,fold:window.name,utcDecisionDay:new Date(day).toISOString().slice(0,10),role:validPair?groupRole:'excluded',reason:!validPair?'unresolved_or_incomplete_pair':groupRole==='excluded'?(before?'information_interval_purge':'outside_window_or_75_day_embargo'):null});
      }
    }
  }
  return {version:'wave-ml-development-splits-v1',finalLabelsOpened:false,embargoDays:s.embargoDays,windows:windows.map(w=>({...w,start:new Date(w.start).toISOString(),end:new Date(w.end).toISOString(),fitDecisionEndExclusive:new Date(w.start-s.embargoDays*DAY).toISOString()})),records};
}
