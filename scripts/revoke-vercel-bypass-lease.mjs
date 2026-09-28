import {revokeLeaseFile} from '../lib/vercel-bypass-lease.js';
const token=process.env.VERCEL_TOKEN;
const file=process.env.VERCEL_BYPASS_LEASE_FILE||'.tmp/vercel-bypass-lease.json';
const timeoutMs=Math.max(1000,Number(process.env.VERCEL_HTTP_TIMEOUT_MS||15000));
if(!token)throw new Error('VERCEL_TOKEN is required for bypass cleanup');
const result=await revokeLeaseFile({file,token,timeoutMs});
console.log('Vercel bypass cleanup status: '+result.status);
