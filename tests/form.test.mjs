import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const formCode=source.slice(source.indexOf("const form=$('#enquiry-form');"));
function harness(fetch){
 const values={name:'Visitor',email:'visitor@example.org',message:'Please arrange an inspection.'};
 let resets=0,listener,focused=false;
 const form={reportValidity:()=>true,addEventListener:(event,fn)=>listener=fn,reset:()=>{resets++;for(const key of Object.keys(values))values[key]=''}};
 const fields={disabled:true},submit={textContent:'Send enquiry'},result={textContent:'',append:()=>{},focus:()=>focused=true};
 const elements={'#enquiry-form':form,'#enquiry-fields':fields,'button[type=submit]':submit,'#form-result':result};
 const context={$:s=>elements[s],fetch,FormData:class{constructor(){return Object.entries(values)}},document:{createElement:()=>({})},TypeError,SyntaxError};
 vm.runInNewContext(formCode,context);
 return {send:()=>listener({preventDefault(){}}),values,fields,submit,result,get resets(){return resets},get focused(){return focused}};
}
test('form keeps values after a failed save and shows success only after a saved response',async()=>{
 let succeed=false;
 const h=harness(async()=>({ok:succeed,json:async()=>succeed?{accepted:true,reference:'example-reference'}:{error:'Your enquiry could not be saved. Please try again.'}}));
 assert.equal(h.fields.disabled,false);await h.send();assert.equal(h.resets,0);assert.equal(h.values.name,'Visitor');assert.match(h.result.textContent,/could not be saved/);assert.equal(h.submit.textContent,'Send enquiry');assert.equal(h.fields.disabled,false);
 succeed=true;await h.send();assert.equal(h.resets,1);assert.equal(h.result.textContent,'Thank you. Your enquiry has been received. We’ll be in touch using the details you provided.');assert.equal(h.focused,true);
});
test('network errors, non-JSON responses and unconfirmed success preserve entered details',async()=>{
 for(const fetch of [async()=>{throw new TypeError('offline')},async()=>({ok:true,json:async()=>{throw new SyntaxError('not JSON')}}),async()=>({ok:true,json:async()=>({})})]){
  const h=harness(fetch);await h.send();assert.equal(h.resets,0);assert.equal(h.values.name,'Visitor');assert.match(h.result.textContent,/could not confirm/);assert.equal(h.fields.disabled,false);
 }
});
test('repeated submit events cannot send duplicate requests while a save is pending',async()=>{
 let release,calls=0;
 const h=harness(()=>{calls++;return new Promise(resolve=>release=resolve)});
 const pending=h.send();await h.send();assert.equal(calls,1);assert.equal(h.fields.disabled,true);
 release({ok:true,json:async()=>({accepted:true,reference:'saved'})});await pending;assert.equal(h.fields.disabled,false);
});
