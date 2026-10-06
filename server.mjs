import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createReadStream} from 'node:fs';
import {stat,readFile,realpath,mkdir,open,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
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

// Enquiries are data files, never executable HTML and never part of dist.
const inside=(directory,file)=>file===directory||file.startsWith(directory+path.sep);
async function saveEnquiry(directory,root,payload){
 await mkdir(directory,{recursive:true,mode:0o700});
 const resolved=await realpath(directory);
 if(inside(await realpath(root),resolved))throw new Error('Enquiry storage must be outside the public directory');
 const filename=`${payload.submittedAt.replace(/[:.]/g,'-')}-${payload.reference}.json`;
 const destination=path.join(resolved,filename),temporary=destination+'.tmp';
 let output;
 try{
  output=await open(temporary,'wx',0o600);
  await output.writeFile(JSON.stringify(payload,null,2)+'\n','utf8');
  await output.sync();await output.close();output=null;
  await rename(temporary,destination);
  const folder=await open(resolved,'r');
  try{await folder.sync()}finally{await folder.close()}
 }catch(error){
  if(output)await output.close().catch(()=>{});
  await unlink(temporary).catch(()=>{});
  throw error;
 }
}

export function createApp(options={}){
 const root=path.resolve(options.root??path.join(here,'dist'));
 const enquiriesDir=path.resolve(options.enquiriesDir??process.env.ENQUIRIES_DIR??path.join(here,'enquiries'));
 if(inside(root,enquiriesDir))throw new Error('ENQUIRIES_DIR must be outside the public directory');
 const allowed=new Set(options.origins??(process.env.ALLOWED_ORIGINS??'https://sdatarneit.au,http://127.0.0.1:8085,http://localhost:8085').split(',').map(s=>s.trim()));
 const trustedProxy=options.trustProxy??process.env.TRUST_PROXY==='true';
 const limits=new Map();
 function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...security});res.end(JSON.stringify(value))}
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   // The trusted Cloudflare proxy supplies the visitor's original scheme.
   if(trustedProxy&&req.headers['x-forwarded-proto']==='http'){
    res.writeHead(308,{Location:'https://sdatarneit.au'+url.pathname+url.search,...security});res.end();return;
   }
   if(url.pathname==='/healthz'){json(res,200,{ok:true});return}
   if(url.pathname==='/api/enquiries'){
    if(req.method!=='POST'){res.setHeader('Allow','POST');json(res,405,{error:'Use POST for enquiries.'});return}
    if(!allowed.has(req.headers.origin)){json(res,403,{error:'Please send your enquiry using the form on this website.'});return}
    if(req.headers['content-type']?.split(';')[0].trim()!=='application/json'){json(res,415,{error:'Unsupported request format.'});return}
    const now=Date.now();for(const [key,value] of limits)if(value.until<=now)limits.delete(key);
    // Production binds to loopback; cloudflared overwrites this visitor header.
    const cfIP=req.headers['cf-connecting-ip'];
    const ip=trustedProxy&&typeof cfIP==='string'&&isIP(cfIP)?cfIP:req.socket.remoteAddress;
    const count=limits.get(ip)??{n:0,until:now+15*60*1000};
    if(count.n>=5||(!limits.has(ip)&&limits.size>=10000)){res.setHeader('Retry-After',Math.ceil((count.until-now)/1000));json(res,429,{error:'Please wait 15 minutes before trying again. Your details are still in the form.'});return}
    count.n++;limits.set(ip,count);
    if(Number(req.headers['content-length']??0)>24000){json(res,413,{error:'Please shorten your enquiry and try again.'});req.resume();return}
    const chunks=[];let length=0;
    for await(const chunk of req){length+=chunk.length;if(length>24000){json(res,413,{error:'Please shorten your enquiry and try again.'});return}chunks.push(chunk)}
    let v;try{v=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{json(res,400,{error:'Please check your enquiry and try again.'});return}
    if(!v||typeof v!=='object'||Array.isArray(v)){json(res,400,{error:'Please check your enquiry and try again.'});return}
    const bounds={name:100,email:254,phone:40,role:80,topic:100,message:4000,website:100};
    const fields={};
    for(const [key,max] of Object.entries(bounds)){
     const value=v[key]??'';
     if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)){
      json(res,400,{error:'Please check the length and format of your enquiry details.'});return;
     }
     fields[key]=value.trim();
    }
    if(fields.website){json(res,400,{error:'Unable to accept this enquiry. Please try again.'});return}
    const roles=['A participant','A family member','A support coordinator','A SIL provider','Someone else'];
    const topics=['The home and suitability','Current availability','Arranging an inspection','Something else'];
    if(!fields.name||!/^\S+@[^\s@]+\.[^\s@]+$/.test(fields.email)||fields.message.length<10||v.consent!=='on'||!roles.includes(fields.role)||!topics.includes(fields.topic)){
     json(res,400,{error:'Please include your name, a valid email, your enquiry role and purpose, a message of at least 10 characters, and consent to be contacted.'});return;
    }
    const {website,...details}=fields;
    const payload={reference:randomUUID(),submittedAt:new Date().toISOString(),...details,consent:true,property:'Social Street, Tarneit'};
    try{
     await saveEnquiry(enquiriesDir,root,payload);
     json(res,201,{accepted:true,reference:payload.reference});
    }catch(error){
     // Log only an error code: never submitted details or filesystem paths.
     console.error('Enquiry save failed:',error.code??'STORAGE_ERROR');
     json(res,503,{error:'Your enquiry could not be saved. Your details are still in the form. Please try again shortly.'});
    }
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
   if(!inside(await realpath(root),await realpath(file))){json(res,404,{error:'Not found.'});return}
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
  }catch{if(!res.headersSent)json(res,500,{error:'Something went wrong. Please try again shortly.'});else res.destroy()}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const host=process.env.HOST??'127.0.0.1',port=Number(process.env.PORT??8085);
 createApp().listen(port,host,()=>console.log(`SDA Tarneit preview: http://${host}:${port}`));
}
