import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {readFile,readdir} from 'node:fs/promises';

async function withServer(options,fn){const server=createApp(options);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;try{await fn(url)}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}}
const valid={name:'Test enquiry',email:'test@example.org',phone:'',role:'A family member',topic:'Arranging an inspection',message:'An automated test only, not a real enquiry.',consent:'on',website:''};
const post=(url,body=valid,origin='https://sdatarneit.au')=>fetch(url+'/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});

test('unconnected enquiries fail honestly and public assets are isolated',()=>withServer({},async url=>{
 assert.equal((await post(url)).status,503);
 assert.deepEqual(await(await fetch(url+'/api/enquiry-status')).json(),{enabled:false});
 for(const path of ['/ref/orig/Al-Social%20St-Tarneit-DFH%20Full.mp4','/config/site.json','/.env','/server.mjs'])assert.equal((await fetch(url+path)).status,404);
 const res=await fetch(url+'/');assert.equal(res.status,200);assert.match(res.headers.get('content-security-policy'),/object-src 'none'/);
 const html=await res.text();assert.match(html,/SDA accommodation in Tarneit/);assert.match(html,/<link rel="canonical" href="https:\/\/sdatarneit.au\/">/);
}));
test('walkthrough supports seeking with byte-range responses',()=>withServer({},async url=>{
 const res=await fetch(url+'/assets/tarneit-720p.mp4',{headers:{Range:'bytes=0-31'}});
 assert.equal(res.status,206);assert.match(res.headers.get('content-range'),/^bytes 0-31\//);assert.equal((await res.arrayBuffer()).byteLength,32);
 assert.equal((await fetch(url+'/assets/tarneit-720p.mp4',{headers:{Range:'bytes=999999999-'}})).status,416);
}));
test('delivery validation, failure and success reflect real upstream result',async()=>{
 let delivered=0;
 await withServer({webhook:'https://example.invalid',deliver:async()=>{delivered++;return {ok:false}}},async url=>{
  assert.equal((await post(url,valid,'https://untrusted.example')).status,403);
  assert.equal((await post(url,{...valid,consent:''})).status,400);
  assert.equal((await post(url,{...valid,website:'spam'})).status,400);
  assert.equal((await post(url)).status,502);assert.equal(delivered,1);
 });
 await withServer({webhook:'https://example.invalid',deliver:async payload=>{assert.equal(payload.name,valid.name);return {ok:true}}},async url=>{assert.equal((await post(url)).status,202)});
});
test('all routes have distinct metadata, one H1 and HTML navigation',async()=>{
 const titles=new Set();for(const route of ['','the-home/','living-in-tarneit/','sda-and-support/','enquiries/','privacy/','walkthrough/']){
  const html=await readFile(new URL(`../dist/${route}index.html`,import.meta.url),'utf8');
  assert.equal((html.match(/<h1>/g)||[]).length,1);assert.match(html,/<nav.*Main navigation/);assert.match(html,/name="description"/);
  const title=html.match(/<title>(.*?)<\/title>/)[1];assert.ok(!titles.has(title));titles.add(title);
 }
 const home=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');assert.doesNotMatch(home,/<video/);assert.doesNotMatch(home,/<(?:script|img)[^>]+https?:\/\//);
 const gallery=JSON.parse(await readFile(new URL('../dist/assets/gallery.json',import.meta.url),'utf8'));
 const selected=(await readdir(new URL('../ref/production/stills-1s - keep/',import.meta.url))).filter(x=>/\.(jpg|jpeg|png)$/i.test(x));
 assert.equal(gallery.length,selected.length);assert.equal(new Set(gallery.map(x=>x.id)).size,selected.length);
});
