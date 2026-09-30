import {
  allowedTelegramIds,derivePortfolioBridgeToken,verifyPortfolioBridgeToken,pairPortfolioBridge
} from '../lib/portfolio-bridge.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});

  const userId=String(req.query?.user_id||'').trim();
  const sig=String(req.query?.sig||'').trim();
  if(!allowedTelegramIds().includes(userId)||!verifyPortfolioBridgeToken(userId,sig)){
    return res.status(401).json({ok:false,error:'unauthorized'});
  }

  try{
    const paired=await pairPortfolioBridge(userId);
    if(!paired)return res.status(409).json({ok:false,error:'pairing_conflict'});

    res.setHeader('Set-Cookie',[
      'mh_portfolio_bridge='+encodeURIComponent(sig)+'; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax'
    ]);
    return res.redirect(302,'/?portfolioBridge=1#portfolio');
  }catch(error){
    return res.status(500).json({ok:false,error:String(error?.message||'pair_failed')});
  }
}
