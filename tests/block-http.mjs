import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 운영 gugudan-api의 블록 액션을 기록을 남기지 않는 요청으로만 확인한다(시작 요청은 보내지 않는다).
const env=await readFile(new URL('../.env.local',import.meta.url),'utf8');
const config=Object.fromEntries(env.split('\n').flatMap(line=>{const match=line.match(/^([A-Z_]+)=(.*)$/);return match?[[match[1],match[2].trim().replace(/^['"]|['"]$/g,'')]]:[];}));
const url=config.VITE_GUGUDAN_API_URL;
if(new URL(url).hostname!=='dxibhawclfhoabfgwria.supabase.co'||new URL(url).pathname!=='/functions/v1/gugudan-api')throw Error('Unexpected deployment target');
let checks=0;
async function call(body,token){
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Gugudan-Session':token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 return {status:response.status,data:await response.json()};
}
const id=crypto.randomUUID();
for(const action of ['blockBegin','blockFinish','blockLeaders','blockRecords']){assert.equal((await call({action,id,ended:'stopped',answers:[],moves:[]})).status,401);checks++;}
const registered=await call({action:'register',studentNumber:1});
assert.equal(registered.status,200);checks++;
const token=registered.data.token;
assert.equal((await call({action:'capabilities'},token)).data.blocks,true);checks++;
assert.equal((await call({action:'blockBegin',id:'bad'},token)).status,400);checks++;
for(const payload of [{ended:'won'},{answers:[{answer:10}]},{answers:[{answer:1,ms:-1}]},{moves:[{piece:3,row:0,col:0}]},{moves:[{piece:0,row:8,col:0}]},{answers:'[]'},{id:'bad'}]){
 assert.equal((await call({action:'blockFinish',id,ended:'stopped',answers:[],moves:[],...payload},token)).status,400);checks++;
}
// 서버가 발급하지 않은 ID는 재생 전에 거부된다(시드 조회 RPC 경로).
const unknown=await call({action:'blockFinish',id,ended:'stopped',answers:[],moves:[]},token);
assert.deepEqual(unknown,{status:409,data:{error:'RUN_NOT_FOUND'}});checks++;
const leaders=await call({action:'blockLeaders'},token);
assert.equal(leaders.status,200);assert.ok(Array.isArray(leaders.data)&&leaders.data.length<=5);checks++;
const records=await call({action:'blockRecords'},token);
assert.equal(records.status,200);assert.ok(typeof records.data.runs==='number'&&(records.data.best===null||typeof records.data.best==='number'));checks++;
const profile=await call({action:'profile'},token);
assert.equal(profile.status,200);assert.equal(typeof profile.data.blockExp,'number');checks++;
assert.equal((await call({action:'teacherRecords'},token)).status,401);checks++;
assert.equal((await call({action:'teacherResetScoped',studentNumber:1,scopes:['block']},token)).status,401);checks++;
console.log(`Production HTTP: ${checks} block authentication, validation, seed lookup, ranking, records and profile checks passed; no runs saved`);
