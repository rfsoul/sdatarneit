import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createReadStream} from 'node:fs';
import {stat,readFile} from 'node:fs/promises';
import {createGzip} from 'node:zlib';

const here=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.pdf':'application/pdf','.mp4':'video/mp4'};
const security={
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'X-Frame-Options':'DENY',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
};

export function createApp(options={}){
 const root=path.resolve(options.root??path.join(here,'dist'));
 const webhook=options.webhook??process.env.ENQUIRY_WEBHOOK_URL??'';
 const token=options.token??process.env.ENQUIRY_WEBHOOK_TOKEN??'';
 const allowed=new Set(options.origins??(process.env.ALLOWED_ORIGINS??'https://sdatarneit.au,http://127.0.0.1:8085,http://localhost:8085').split(',').map(s=>s.trim()));
 const trustedProxy=options.trustProxy??process.env.TRUST_PROXY==='true';
 const deliver=options.deliver??((payload)=>fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000),redirect:'error'}));
 const enabled=!!webhook&&/^https:\/\//.test(webhook);
 const limits=new Map();
 function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...security});res.end(JSON.stringify(value))}
 return http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/healthz'){json(res,200,{ok:true});return}
   if(url.pathname==='/api/enquiry-status'&&req.method==='GET'){json(res,200,{enabled});return}
   if(url.pathname==='/api/enquiries'){
    if(req.method!=='POST'){res.setHeader('Allow','POST');json(res,405,{error:'Use POST for enquiries.'});return}
    if(!enabled){json(res,503,{error:'Online delivery is not connected. Please email or call the owner directly.'});return}
    if(!allowed.has(req.headers.origin)){json(res,403,{error:'This enquiry must be sent from the website.'});return}
    if(!req.headers['content-type']?.startsWith('application/json')){json(res,415,{error:'Unsupported request format.'});return}
    const now=Date.now();for(const [key,value] of limits)if(value.until<=now)limits.delete(key);
    // Only trust CF-Connecting-IP when this server is reachable exclusively through the tunnel.
    const ip=trustedProxy?(req.headers['cf-connecting-ip']??req.socket.remoteAddress):req.socket.remoteAddress;
    const count=limits.get(ip)??{n:0,until:now+15*60*1000};
    if(count.n>=5){res.setHeader('Retry-After',Math.ceil((count.until-now)/1000));json(res,429,{error:'Too many attempts. Please wait or contact the owner directly.'});return}
    count.n++;limits.set(ip,count);
    if(Number(req.headers['content-length']??0)>16000){json(res,413,{error:'The enquiry is too long.'});req.resume();return}
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000){json(res,413,{error:'The enquiry is too long.'});return}}
    let v;try{v=JSON.parse(raw)}catch{json(res,400,{error:'Please check the enquiry details.'});return}
    if(!v||typeof v!=='object'){json(res,400,{error:'Please check the enquiry details.'});return}
    const clean=(key,max)=>typeof v[key]==='string'?v[key].trim().slice(0,max):'';
    if(clean('website',100)){json(res,400,{error:'Unable to accept this enquiry.'});return}
    const payload={name:clean('name',100),email:clean('email',254),phone:clean('phone',40),role:clean('role',80),topic:clean('topic',100),message:clean('message',4000),consent:v.consent==='on',property:'Social Street, Tarneit',submittedAt:new Date().toISOString()};
    if(!payload.name||!/^\S+@[^\s@]+\.[^\s@]+$/.test(payload.email)||payload.message.length<10||!payload.consent){json(res,400,{error:'Please supply a name, valid email, message and consent.'});return}
    try{const upstream=await deliver(payload);if(!upstream.ok)throw new Error('Delivery rejected');json(res,202,{accepted:true})}
    catch{json(res,502,{error:'The enquiry service could not confirm receipt. Please email or call the owner directly.'})}
    return;
   }
   if(url.pathname.startsWith('/api/')){json(res,404,{error:'Not found.'});return}
   if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');json(res,405,{error:'Method not allowed.'});return}
   let decoded;try{decoded=decodeURIComponent(url.pathname)}catch{json(res,400,{error:'Invalid path.'});return}
   if(decoded.includes('\\')||decoded.includes('\0')||decoded.split('/').some(s=>s.startsWith('.'))){json(res,404,{error:'Not found.'});return}
   let file=path.resolve(root,'.'+decoded);
   if(file!==root&&!file.startsWith(root+path.sep)){json(res,404,{error:'Not found.'});return}
   let info;try{info=await stat(file)}catch{}
   if(info?.isDirectory()){
    if(!url.pathname.endsWith('/')){res.writeHead(308,{Location:url.pathname+'/'+url.search,...security});res.end();return}
    file=path.join(file,'index.html');try{info=await stat(file)}catch{info=null}
   }
   if(!info?.isFile()){
    const notFound=await readFile(path.join(root,'404.html'));res.writeHead(404,{'Content-Type':'text/html; charset=utf-8',...security});res.end(req.method==='HEAD'?undefined:notFound);return;
   }
   const ext=path.extname(file),etag=`"${info.size}-${Math.trunc(info.mtimeMs)}"`;
   const headers={'Content-Type':types[ext]??'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600','ETag':etag,'Accept-Ranges':'bytes',...security};
   if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return}
   let start=0,end=info.size-1,status=200;
   if(req.headers.range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`,...security});res.end();return}
    if(!match[1])start=Math.max(0,info.size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]))}
    if(start>=info.size||start>end){res.writeHead(416,{'Content-Range':`bytes */${info.size}`,...security});res.end();return}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
   }
   const gzip=status===200&&/\bgzip\b/.test(req.headers['accept-encoding']??'')&&['.html','.css','.js','.json','.svg','.xml'].includes(ext);
   if(gzip){headers['Content-Encoding']='gzip';headers.Vary='Accept-Encoding'}else headers['Content-Length']=end-start+1;
   res.writeHead(status,headers);if(req.method==='HEAD'){res.end();return}
   const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());if(gzip)stream.pipe(createGzip()).pipe(res);else stream.pipe(res);
  }catch{if(!res.headersSent)json(res,500,{error:'Something went wrong. Please contact the owner directly.'});else res.destroy()}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const host=process.env.HOST??'127.0.0.1',port=Number(process.env.PORT??8085);
 createApp().listen(port,host,()=>console.log(`SDA Tarneit preview: http://${host}:${port}`));
}
