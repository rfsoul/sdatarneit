// A separate job keeps mail-provider outages independent of form submissions.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,readdir,readFile,open,rename,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const email=/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
async function saveState(filename,value){
 const temporary=filename+'.tmp';const file=await open(temporary,'w',0o600);
 try{await file.writeFile(JSON.stringify(value,null,2)+'\n');await file.sync()}finally{await file.close()}
 await rename(temporary,filename);
 const directory=await open(path.dirname(filename),'r');try{await directory.sync()}finally{await directory.close()}
}
export async function notifyEnquiries({directory,apiKey,to,since,fetchImpl=fetch,now=Date.now()}={}){
 if(!apiKey||!email.test(to??'')||!since||!Number.isFinite(Date.parse(since)))throw new Error('Set RESEND_API_KEY, ENQUIRY_NOTIFY_TO and ENQUIRY_NOTIFY_SINCE before enabling notifications.');
 const stateDir=path.join(directory,'.notifications');
 await mkdir(stateDir,{recursive:true,mode:0o700});
 const summary={accepted:0,failed:0,skipped:0,review:0};
 let requests=0;
 for(const filename of (await readdir(directory)).filter(f=>f.endsWith('.json')).sort()){
  const fullpath=path.join(directory,filename);
  if(!(await lstat(fullpath)).isFile()){summary.skipped++;continue}
  const enquiry=JSON.parse(await readFile(fullpath,'utf8'));
  if(!uuid.test(enquiry.reference??'')||!Number.isFinite(Date.parse(enquiry.submittedAt))||Date.parse(enquiry.submittedAt)<Date.parse(since)){summary.skipped++;continue}
  const statePath=path.join(stateDir,enquiry.reference+'.json');
  let state;
  try{state=JSON.parse(await readFile(statePath,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error;state={}}
  if(state.status==='accepted'||state.status==='review'){summary.skipped++;continue}
  if(state.nextAttemptAt>now){summary.skipped++;continue}
  const body={from:'SDA Tarneit <enquiries@sdatarneit.au>',to:[to],subject:`SDA Tarneit enquiry — ${enquiry.reference}`,
   text:[`Enquiry reference: ${enquiry.reference}`,`Received: ${enquiry.submittedAt}`,'',`Name: ${enquiry.name}`,`Email: ${enquiry.email}`,`Phone: ${enquiry.phone||'Not provided'}`,`Enquiring as: ${enquiry.role}`,`Purpose: ${enquiry.topic}`,'',String(enquiry.message),'','The original enquiry is also saved privately on BTower.'].join('\n'),
   attachments:[{filename:`enquiry-${enquiry.reference}.json`,content:Buffer.from(JSON.stringify(enquiry,null,2)+'\n').toString('base64')}]};
  if(email.test(enquiry.email??''))body.reply_to=enquiry.email;
  const serialized=JSON.stringify(body),digest=createHash('sha256').update(serialized).digest('hex');
  // Resend keeps idempotency keys for 24 hours. Never blindly resend after that
  // window or after the destination/content changes: reconcile in its dashboard.
  if((state.firstAttemptAt!==undefined&&now-state.firstAttemptAt>=23*60*60*1000)||(state.digest&&state.digest!==digest)){
   await saveState(statePath,{...state,status:'review'});summary.review++;continue;
  }
  if(requests>=1)break;
  state={...state,status:'pending',firstAttemptAt:state.firstAttemptAt??now,attempts:(state.attempts??0)+1,digest};
  await saveState(statePath,state);requests++;
  try{
   const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`sda-enquiry/${enquiry.reference}`},body:serialized,signal:AbortSignal.timeout(15000),redirect:'error'});
   if(!response.ok){
    const retry=response.status===429||response.status>=500;
    await saveState(statePath,{...state,status:retry?'pending':'review',httpStatus:response.status,nextAttemptAt:now+60*60*1000});
    summary.failed++;break;
   }
   const result=await response.json();if(typeof result.id!=='string'||!result.id)throw new Error('Missing provider receipt');
   await saveState(statePath,{...state,status:'accepted',providerId:result.id,acceptedAt:new Date(now).toISOString()});summary.accepted++;
  }catch{
   await saveState(statePath,{...state,status:'pending',nextAttemptAt:now+60*60*1000});summary.failed++;break;
  }
 }
 return summary;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const summary=await notifyEnquiries({directory:process.env.ENQUIRIES_DIR??path.join(here,'../enquiries'),apiKey:process.env.RESEND_API_KEY,to:process.env.ENQUIRY_NOTIFY_TO,since:process.env.ENQUIRY_NOTIFY_SINCE});
  console.log('Enquiry notifications:',JSON.stringify(summary));
  if(summary.failed||summary.review)process.exitCode=1;
 }catch{console.error('Notification job failed. Check private configuration, storage permissions and notification receipts.');process.exitCode=1}
}
