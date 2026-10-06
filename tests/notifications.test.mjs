import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {notifyEnquiries} from '../scripts/notify-enquiries.mjs';
const reference='11111111-1111-4111-8111-111111111111';
const now=Date.parse('2026-10-06T01:00:00Z');
const enquiry={reference,submittedAt:'2026-10-06T00:30:00Z',name:'Test only',email:'visitor@example.org',phone:'',role:'Someone else',topic:'Something else',message:'Plain text <script> is not interpreted.'};
async function fixture(fn){const directory=await mkdtemp(path.join(tmpdir(),'sda-notify-'));try{
 await writeFile(path.join(directory,'enquiry.json'),JSON.stringify(enquiry));
 const config={directory,apiKey:'test-key',to:'owner@example.org',since:'2026-10-06T00:00:00Z',now};
 await fn(config,path.join(directory,'.notifications',reference+'.json'));
}finally{await rm(directory,{recursive:true,force:true})}}
test('notification sends readable plain text, JSON attachment and visitor Reply-To once',()=>fixture(async(config,statePath)=>{
 let calls=0;
 const fetchImpl=async(url,options)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers['Idempotency-Key'],`sda-enquiry/${reference}`);const body=JSON.parse(options.body);
 assert.deepEqual(body.to,['owner@example.org']);assert.equal(body.reply_to,enquiry.email);assert.equal(body.html,undefined);assert.match(body.text,/Plain text <script>/);
 assert.deepEqual(JSON.parse(Buffer.from(body.attachments[0].content,'base64').toString()),enquiry);return {ok:true,json:async()=>({id:'provider-receipt'})}};
 assert.equal((await notifyEnquiries({...config,fetchImpl})).accepted,1);
 assert.equal(JSON.parse(await readFile(statePath,'utf8')).status,'accepted');
 await notifyEnquiries({...config,fetchImpl});assert.equal(calls,1);
 assert.deepEqual(JSON.parse(await readFile(path.join(config.directory,'enquiry.json'),'utf8')),enquiry);
}));
test('outage retries with the same key; backoff prevents immediate repeat requests',()=>fixture(async(config,statePath)=>{
 let calls=0;const keys=[];
 const fetchImpl=async(url,options)=>{calls++;keys.push(options.headers['Idempotency-Key']);if(calls===1)throw Error('offline');return {ok:true,json:async()=>({id:'receipt'})}};
 assert.equal((await notifyEnquiries({...config,fetchImpl})).failed,1);
 await notifyEnquiries({...config,fetchImpl});assert.equal(calls,1);
 assert.equal((await notifyEnquiries({...config,now:now+3600001,fetchImpl})).accepted,1);assert.equal(keys[0],keys[1]);
}));
test('uncertain old attempts and changed destinations require review rather than duplicate mail',()=>fixture(async(config,statePath)=>{
 const fetchImpl=async()=>{throw Error('offline')};await notifyEnquiries({...config,fetchImpl});
 let calls=0;const doNotSend=async()=>{calls++;throw Error('must not send')};
 assert.equal((await notifyEnquiries({...config,now:now+24*3600000,fetchImpl:doNotSend})).review,1);assert.equal(calls,0);
 assert.equal(JSON.parse(await readFile(statePath,'utf8')).status,'review');
 await rm(statePath);await notifyEnquiries({...config,fetchImpl});
 assert.equal((await notifyEnquiries({...config,now:now+3600001,to:'another@example.org',fetchImpl:doNotSend})).review,1);assert.equal(calls,0);
}));
test('old enquiries and missing configuration do not send; provider rejection is not success',()=>fixture(async(config,statePath)=>{
 let calls=0;const fetchImpl=async()=>{calls++;return {ok:false,status:403}};
 await assert.rejects(notifyEnquiries({...config,apiKey:'',fetchImpl}));assert.equal(calls,0);
 await notifyEnquiries({...config,since:'2026-10-07T00:00:00Z',fetchImpl});assert.equal(calls,0);
 const result=await notifyEnquiries({...config,fetchImpl});assert.equal(result.accepted,0);assert.equal(result.failed,1);assert.equal(JSON.parse(await readFile(statePath,'utf8')).status,'review');
}));
