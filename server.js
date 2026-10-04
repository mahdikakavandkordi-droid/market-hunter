import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import scanHandler from './api/scan.js';
import portfolioHandler from './api/portfolio.js';
import intradayHandler from './api/intraday.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||3000);

const localResearchData=Object.freeze({
  daily:'data/daily-market-report.json',
  pulse:'data/market-pulse-report.json',
  v2:'data/v2-latest-scan.json'
});

const staticFiles=new Map([
  ['/','index.html'],
  ['/index.html','index.html'],
  ['/app.js','app.js'],
  ['/quote-policy.js','quote-policy.js'],
  ['/app.css','app.css'],
  ['/mobile-polish.css','mobile-polish.css'],
  ['/theme.css','theme.css'],
  ['/ui-polish.css','ui-polish.css'],
  ['/service-worker.js','service-worker.js'],
  ['/icons/icon-192.png','icons/icon-192.png'],
  ['/icons/icon-512.png','icons/icon-512.png'],
  ['/icons/apple-touch-icon.png','icons/apple-touch-icon.png'],

  ['/manifest.webmanifest','manifest.webmanifest'],
  ['/market-hunter-icon.svg','market-hunter-icon.svg']
]);

const mime={
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png'
};

function makeResponse(res){
  let statusCode=200;
  return {
    setHeader:(name,value)=>res.setHeader(name,value),
    status(code){statusCode=code;return this},
    json(payload){
      const body=JSON.stringify(payload);
      res.writeHead(statusCode,{'Content-Type':'application/json; charset=utf-8'});
      res.end(body);
    }
  };
}

async function serveFile(res,file){
  try{
    const full=path.join(root,file);
    const body=await readFile(full);
    const type=mime[path.extname(file)]||'application/octet-stream';
    res.writeHead(200,{
      'Content-Type':type,
      'Cache-Control':file.startsWith('data/')?'public, max-age=60':'public, max-age=300'
    });
    res.end(body);
  }catch{
    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('Not found');
  }
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    const query=Object.fromEntries(url.searchParams.entries());
    const wrappedReq={...req,method:req.method||'GET',query};

    if(url.pathname==='/health'){
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
      return res.end(JSON.stringify({ok:true,service:'market-hunter'}));
    }
    if(url.pathname==='/api/research-data'){
      const file=localResearchData[query.kind];
      if(!file){res.writeHead(400,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify({error:'invalid_research_data_kind'}))}
      return await serveFile(res,file);
    }
    if(url.pathname==='/api/scan') return await scanHandler(wrappedReq,makeResponse(res));
    if(url.pathname==='/api/portfolio') return await portfolioHandler(wrappedReq,makeResponse(res));
    if(url.pathname==='/api/intraday') return await intradayHandler(wrappedReq,makeResponse(res));
    if(url.pathname==='/api/portfolio-bridge'){
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      return res.end(JSON.stringify({ok:true,connected:false,localDev:true}));
    }

    if(url.pathname.startsWith('/data/')){
      const rel=url.pathname.replace(/^\//,'');
      if(rel.includes('..')){
        res.writeHead(400);return res.end('Bad request');
      }
      return await serveFile(res,rel);
    }

    const file=staticFiles.get(url.pathname);
    if(file) return await serveFile(res,file);

    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('Not found');
  }catch(error){
    console.error(error);
    if(!res.headersSent) res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'});
    res.end(JSON.stringify({error:'server_error'}));
  }
});

server.listen(port,'0.0.0.0',()=>console.log(`Market Hunter listening on ${port}`));

