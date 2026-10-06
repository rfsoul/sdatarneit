import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {readFile,readdir,mkdtemp,rm,stat,writeFile,symlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const root=path.resolve(process.env.SITE_OUTPUT_DIR??'dist');
async function withServer(options,fn){
 const temp=await mkdtemp(path.join(tmpdir(),'sda-test-'));
 const enquiriesDir=options.enquiriesDir??path.join(temp,'enquiries');
 const server=createApp({root,...options,enquiriesDir});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}`;
 try{await fn(url,enquiriesDir,temp)}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true})}
}
const valid={name:'Test enquiry',email:'test@example.org',phone:'',role:'A family member',topic:'Arranging an inspection',message:'An automated test only, not a real enquiry.',consent:'on',website:''};
const post=(url,body=valid,origin='https://sdatarneit.au',headers={})=>fetch(url+'/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify(body)});

test('successful enquiries persist as unique private files; submitted markup stays inert data',()=>withServer({},async(url,dir)=>{
 const body={...valid,name:'  Example visitor  ',message:'Please inspect <script>alert("untrusted")</script> as plain text.'};
 const first=await post(url,body);assert.equal(first.status,201);assert.equal(first.headers.get('cache-control'),'no-store');
 const receipt=await first.json();assert.equal(receipt.accepted,true);assert.match(receipt.reference,/^[0-9a-f-]{36}$/);
 const files=await readdir(dir);assert.equal(files.length,1);assert.ok(files[0].endsWith(`${receipt.reference}.json`));
 const saved=JSON.parse(await readFile(path.join(dir,files[0]),'utf8'));
 assert.equal(saved.name,'Example visitor');assert.equal(saved.message,body.message);assert.equal(saved.email,valid.email);
 assert.equal(saved.phone,'');assert.equal(saved.role,valid.role);assert.equal(saved.topic,valid.topic);assert.equal(saved.reference,receipt.reference);assert.ok(Number.isFinite(Date.parse(saved.submittedAt)));assert.equal(saved.consent,true);
 assert.equal(saved.ip,undefined);assert.equal(saved.website,undefined);
 assert.equal((await stat(dir)).mode&0o777,0o700);assert.equal((await stat(path.join(dir,files[0]))).mode&0o777,0o600);
 const second=await (await post(url)).json();assert.notEqual(second.reference,receipt.reference);assert.equal((await readdir(dir)).length,2);
 for(const route of [`/enquiries/${files[0]}`,`/data/enquiries/${files[0]}`,`/.local/share/sdatarneit/enquiries/${files[0]}`,`/api/enquiries/${receipt.reference}`, '/ref/orig/','/config/site.json','/.env','/server.mjs'])assert.equal((await fetch(url+route)).status,404,route);
 assert.equal((await fetch(url+'/api/enquiries')).status,405);
 // Attempted symlink exposure is blocked even if someone links a private directory into dist.
 const link=path.join(root,'test-private-link');await symlink(dir,link);
 try{assert.equal((await fetch(url+`/test-private-link/${files[0]}`)).status,404)}finally{await rm(link)}
}));

test('invalid, oversized and spam input never creates an enquiry',()=>withServer({trustProxy:true},async(url,dir)=>{
 const bad=[{...valid,name:''},{...valid,email:'bad'},{...valid,consent:''},{...valid,website:'spam'}, {...valid,role:'unknown'},{...valid,topic:''},{...valid,message:'short'},{...valid,name:'x'.repeat(101)},{...valid,email:'x'.repeat(255)},{...valid,phone:'x'.repeat(41)},{...valid,message:'x'.repeat(4001)},{...valid,name:{html:'x'}},{...valid,name:'bad\u0000value'},null,[]];
 for(let i=0;i<bad.length;i++)assert.equal((await post(url,bad[i],undefined,{'CF-Connecting-IP':`192.0.2.${i+1}`})).status,400);
 assert.equal((await post(url,valid,'https://untrusted.example')).status,403);
 assert.equal((await post(url,valid,'null')).status,403);
 assert.equal((await post(url,valid,undefined,{'Content-Type':'text/plain'})).status,415);
 assert.equal((await post(url,{...valid,message:'x'.repeat(25000)},undefined,{'CF-Connecting-IP':'192.0.2.200'})).status,413);
 const malformed=await fetch(url+'/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://sdatarneit.au','CF-Connecting-IP':'192.0.2.201'},body:'{'});assert.equal(malformed.status,400);
 await assert.rejects(stat(dir),{code:'ENOENT'});
}));

test('rate limit rejects a sixth attempt and ignores spoofed IPs unless explicitly trusted',()=>withServer({},async(url,dir)=>{
 for(let i=0;i<5;i++)assert.equal((await post(url,{...valid,website:'spam'},undefined,{'CF-Connecting-IP':`192.0.2.${i}`})).status,400);
 const limited=await post(url);assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
 await assert.rejects(stat(dir),{code:'ENOENT'});
}));

test('failed disk save returns an honest failure and a subsequent retry can succeed',()=>withServer({},async(url,dir)=>{
 await writeFile(dir,'not a directory');
 const response=await post(url);assert.equal(response.status,503);const error=await response.json();assert.match(error.error,/could not be saved/);assert.equal(error.accepted,undefined);assert.equal(error.reference,undefined);
 await rm(dir);assert.equal((await post(url)).status,201);assert.equal((await readdir(dir)).length,1);
}));

test('storage cannot be configured inside the public root, including through a symlink',async()=>{
 assert.throws(()=>createApp({root,enquiriesDir:path.join(root,'enquiries')}),/outside/);
 const temp=await mkdtemp(path.join(tmpdir(),'sda-link-test-'));const publicDir=path.join(root,'test-storage');
 await mkdir(publicDir);const link=path.join(temp,'linked');await symlink(publicDir,link);
 try{await withServer({enquiriesDir:link},async url=>{assert.equal((await post(url)).status,503);assert.deepEqual(await readdir(publicDir),[])})}finally{await rm(temp,{recursive:true,force:true});await rm(publicDir,{recursive:true,force:true})}
});

test('walkthrough still supports seeking with byte-range responses',()=>withServer({},async url=>{
 const res=await fetch(url+'/assets/tarneit-720p.mp4',{headers:{Range:'bytes=0-31'}});
 assert.equal(res.status,206);assert.match(res.headers.get('content-range'),/^bytes 0-31\//);assert.equal((await res.arrayBuffer()).byteLength,32);
 assert.equal((await fetch(url+'/assets/tarneit-720p.mp4',{headers:{Range:'bytes=999999999-'}})).status,416);
}));

test('trusted HTTP traffic redirects to the fixed HTTPS origin with its path preserved',async()=>{
 await withServer({trustProxy:true},async url=>{
  const response=await fetch(url+'/enquiries/?topic=inspection',{headers:{'X-Forwarded-Proto':'http',Host:'untrusted.example'},redirect:'manual'});
  assert.equal(response.status,308);assert.equal(response.headers.get('location'),'https://sdatarneit.au/enquiries/?topic=inspection');
 });
 await withServer({},async url=>assert.equal((await fetch(url+'/',{headers:{'X-Forwarded-Proto':'http'},redirect:'manual'})).status,200));
});

test('pages retain navigation, SEO, media and property details with only the public enquiries email',async()=>{
 const titles=new Set();for(const route of ['','the-home/','living-in-tarneit/','sda-and-support/','enquiries/','privacy/','walkthrough/']){
  const html=await readFile(path.join(root,route,'index.html'),'utf8');
  assert.equal((html.match(/<h1>/g)||[]).length,1);assert.match(html,/<nav.*Main navigation/);assert.match(html,/name="description"/);
  const title=html.match(/<title>(.*?)<\/title>/)[1];assert.ok(!titles.has(title));titles.add(title);
  assert.match(html,/<link rel="canonical" href="https:\/\/sdatarneit.au\//);
 }
 const home=await readFile(path.join(root,'index.html'),'utf8');const enquiries=await readFile(path.join(root,'enquiries/index.html'),'utf8');
 assert.match(home,/Available now/);assert.match(enquiries,/Available now/);assert.match(home,/around 50 metres/);
 assert.match(home,/second participant bedroom and the overnight assistance room are unfurnished/);
 assert.doesNotMatch(home,/<video/);assert.doesNotMatch(home,/<(?:script|img)[^>]+https?:\/\//);
 const features=await readFile(path.join(root,'the-home/index.html'),'utf8');assert.match(features,/All three bathrooms have showers; there are no baths/);
 assert.match(enquiries,/>Send enquiry<\/button>/);
 const gallery=JSON.parse(await readFile(path.join(root,'assets/gallery.json'),'utf8'));
 const selected=(await readdir(new URL('../ref/production/stills-1s - keep/',import.meta.url))).filter(x=>/\.(jpg|jpeg|png)$/i.test(x));
 assert.equal(gallery.length,selected.length);assert.equal(new Set(gallery.map(x=>x.id)).size,selected.length);assert.ok(gallery.every(p=>!p.source));
 async function checkFiles(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);if(entry.isDirectory()){await checkFiles(file);continue}
  const data=await readFile(file);
  assert.ok(!data.includes(Buffer.from('alistairmorgan@hotmail.com')),file);
  assert.ok(!data.includes(Buffer.from('alistairmorgan.rfsoul@gmail.com')),file);
  if(/\.(html|js|json|css|xml|txt|svg)$/.test(file)){
   const content=data.toString();assert.doesNotMatch(content,/mailto:(?!enquiries@sdatarneit\.au)|tel:|0422[\s-]*626[\s-]*577|\+61422626577|supplied photos|supplied drawings|owner’s corrections|Open email enquiry|email.app|email-draft/i,file);
   assert.doesNotMatch(content,/enquiries@sdatarneit\.au(?!["<])/i,file);
  }
 }}await checkFiles(root);
 assert.match(home,/mailto:enquiries@sdatarneit\.au/);assert.match(enquiries,/mailto:enquiries@sdatarneit\.au/);
 const privacy=await readFile(path.join(root,'privacy/index.html'),'utf8');assert.match(privacy,/Cloudflare Email Routing/);assert.match(privacy,/not saved as website enquiry files/);
});
