import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const env=await readFile(new URL('../.env.local',import.meta.url),'utf8');
const config=Object.fromEntries(env.split('\n').flatMap(line=>{const match=line.match(/^([A-Z_]+)=(.*)$/);return match?[[match[1],match[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
const url=config.VITE_GUGUDAN_API_URL;
if(new URL(url).hostname!=='dxibhawclfhoabfgwria.supabase.co')throw Error('Unexpected deployment target');
let count=0;
async function call(body,token){
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Gugudan-Session':token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 return {status:response.status,data:await response.json()};
}
const registered=await call({action:'register',studentNumber:1});
assert.equal(registered.status,200);assert.equal(typeof registered.data.token,'string');count++;
const token=registered.data.token,id=crypto.randomUUID(),flags={directZero:true,puzzleOperands:true,puzzles:true,manualZero:true,timeScoring:true};
for(const action of ['verticalAssignment','verticalLeaders','verticalBegin','verticalFinish']){
 assert.equal((await call({action,id,...flags,events:[]})).status,401);count++;
}
assert.equal((await call({action:'teacherRecords'},token)).status,401);count++;
for(const payload of [{...flags,id:'bad'},{...flags,count:6},{...flags,directZero:'true'},{...flags,puzzleOperands:false},{...flags,puzzles:false},{...flags,manualZero:false}]){
 assert.equal((await call({action:'verticalBegin',id,...payload},token)).status,400);count++;
}
assert.equal((await call({action:'verticalFinish',id,events:[{question:0,step:0,answer:0,ms:-1}]},token)).status,400);count++;
const assignment=await call({action:'verticalAssignment'},token);
assert.equal(assignment.status,200);assert.ok([1,2,3].includes(assignment.data.difficulty));count++;
for(const n of [5,10]){
 const leaders=await call({action:'verticalLeaders',count:n},token);assert.equal(leaders.status,200);assert.ok(Array.isArray(leaders.data));count++;
}
console.log(`Production HTTP: ${count} authentication/read/invalid-payload checks passed; no runs or scores saved`);
