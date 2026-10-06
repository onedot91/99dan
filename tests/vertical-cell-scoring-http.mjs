import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const env=await readFile(new URL('../.env.local',import.meta.url),'utf8');
const config=Object.fromEntries(env.split('\n').flatMap(line=>{const match=line.match(/^([A-Z_]+)=(.*)$/);return match?[[match[1],match[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
const url=config.VITE_GUGUDAN_API_URL;
if(new URL(url).hostname!=='dxibhawclfhoabfgwria.supabase.co'||new URL(url).pathname!=='/functions/v1/gugudan-api')throw Error('Unexpected deployment target');
let checks=0;
async function call(body,token){
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Gugudan-Session':token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 return {status:response.status,data:await response.json()};
}
const registered=await call({action:'register',studentNumber:1});
assert.equal(registered.status,200);assert.equal(typeof registered.data.token,'string');checks++;
const token=registered.data.token,id=crypto.randomUUID(),flags={cellScoring:true,tightTime:true,directZero:true,puzzleOperands:true,puzzles:true,manualZero:true,timeScoring:true};
for(const action of ['verticalAssignment','verticalLeaders','verticalBegin','verticalFinish']){
 assert.equal((await call({action,id,...flags,events:[]})).status,401);checks++;
}
for(const payload of [{cellScoring:'true'},{tightTime:false},{tightTime:'true'},{timeScoring:false},{directZero:false},{puzzles:false},{manualZero:false},{puzzleOperands:false},{count:6},{id:'bad'}]){
 assert.equal((await call({action:'verticalBegin',id,count:5,...flags,...payload},token)).status,400);checks++;
}
assert.equal((await call({action:'verticalLeaders',tightTime:'true'},token)).status,400);checks++;
assert.equal((await call({action:'verticalLeaders',cellScoring:'true'},token)).status,400);checks++;
for(const n of [5,10])for(const mode of [{},{tightTime:true},{tightTime:true,cellScoring:true}]){
 const response=await call({action:'verticalLeaders',count:n,...mode},token);
 assert.equal(response.status,200);assert.ok(Array.isArray(response.data));checks++;
}
console.log(`Production HTTP: ${checks} authentication, mode validation and new/legacy ranking checks passed; no runs or scores saved`);


