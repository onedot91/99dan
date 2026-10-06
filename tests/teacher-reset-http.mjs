import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const env=await readFile(new URL('../.env.local',import.meta.url),'utf8');
const config=Object.fromEntries(env.split('\n').flatMap(line=>{const match=line.match(/^([A-Z_]+)=(.*)$/);return match?[[match[1],match[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
const url=config.VITE_GUGUDAN_API_URL;
if(new URL(url).hostname!=='dxibhawclfhoabfgwria.supabase.co')throw Error('Unexpected deployment target');
async function call(body,token){
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Gugudan-Session':token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 return {status:response.status,data:await response.json()};
}
const registered=await call({action:'register',studentNumber:1});
assert.equal(registered.status,200);assert.equal(typeof registered.data.token,'string');
let checks=1;
for(const token of [undefined,registered.data.token,'teacher.1.'+'0'.repeat(64),'teacher.9999999999.'+'0'.repeat(64)]){
 for(const action of ['teacherResetScoped','teacherReset','teacherResetAll','teacherRecords']){
   assert.equal((await call({action,studentNumber:1,scopes:['rush-1','vertical-10']},token)).status,401);
   checks++;
 }
}
for(const duration of [1,2,3]){
 assert.equal((await call({action:'leaders',duration},registered.data.token)).status,200);checks++;
}
for(const count of [5,10]){
 assert.equal((await call({action:'verticalLeaders',count},registered.data.token)).status,200);checks++;
}
console.log(`Production HTTP: ${checks} stateless auth, teacher-only reset and ranking read checks passed; no reset, run or score saved`);
