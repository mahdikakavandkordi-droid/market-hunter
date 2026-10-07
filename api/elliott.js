import {loadSymbolAnalysis} from '../lib/elliott/symbol-analysis.mjs';
export function createElliottHandler({loader=loadSymbolAnalysis}={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    if((req.method||'GET')!=='GET') {
      res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});
    }
    const {symbol,market='us'}=req.query||{};
    if(typeof symbol!=='string'||typeof market!=='string')return res.status(400).json({error:'invalid_symbol'});
    try{return res.status(200).json(await loader(symbol,market))}
    catch(e){
      const invalid=['invalid_symbol','invalid_market','market_symbol_mismatch'].includes(e.message);
      const error=invalid?e.message:['provider_symbol_mismatch','provider_market_mismatch','reference_calendar_unavailable'].includes(e.message)?e.message:'analysis_source_unavailable';
      return res.status(invalid?400:503).json({error});
    }
  };
}
export default createElliottHandler();
