import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { registerHooks } from 'node:module';
import { stairsScore } from '../src/game/stairsRun.ts';
import { STAIRS_GATE } from '../src/game/stairsRun.ts';
import { playStairsRun } from './stairs-player.mjs';

// gugudan-api의 계단 액션을 가짜 데이터베이스로 검사한다. 시드는 시작 RPC가 정하고, 끝 RPC는 Edge가 재생한 값만 받는다.
const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno;
let handler;
globalThis.Deno={env:{get:name=>({SUPABASE_URL:'https://unit-test.invalid',SUPABASE_SERVICE_ROLE_KEY:'unit-test-signing-key',GUGUDAN_TEACHER_CODE:'1234'})[name]},serve:callback=>{handler=callback;}};
const runs=new Map(),calls=[];
let stairsRpcMissing=false;
const rejected=message=>Response.json({code:'P0001',message},{status:400});
globalThis.fetch=async(url,options)=>{
  if(!options?.body)return Response.json([]);
  const name=new URL(url).pathname.split('/').at(-1),args=JSON.parse(options.body);
  calls.push({name,args});
  if(name==='gugudan_stairs_begin'){
    const found=runs.get(args.p_id)??{student:args.p_student,seed:runs.size*977+54321};
    if(found.student!==args.p_student)return rejected('RUN_CONFLICT');
    runs.set(args.p_id,found);return Response.json({id:args.p_id,seed:found.seed});
  }
  if(name==='gugudan_stairs_seed'){const found=runs.get(args.p_id);return found&&found.student===args.p_student?Response.json({id:args.p_id,seed:found.seed}):rejected('RUN_NOT_FOUND');}
  if(name==='gugudan_stairs_finish'){
    const found=runs.get(args.p_id);
    if(found.finished)return found.finished.hash===args.p_hash?Response.json(found.finished.receipt):rejected('RUN_ALREADY_FINISHED');
    const receipt={id:args.p_id,score:args.p_score,height:args.p_height,solved:args.p_solved,ended:args.p_ended};
    found.finished={hash:args.p_hash,receipt};return Response.json(receipt);
  }
  if(name==='gugudan_stairs_leaders')return Response.json([{studentNumber:4,score:1500,correct:5,avatar:null}]);
  if(name==='gugudan_stairs_records')return Response.json({best:1500,runs:3});
  if(name==='gugudan_teacher_records')return Response.json(Array.from({length:23},(_,i)=>({studentNumber:i+1,records:{},sessions:[],best:[]})));
  if(name==='gugudan_teacher_vertical_assignments')return Response.json(Array.from({length:23},(_,i)=>({studentNumber:i+1,difficulty:1})));
  if(name==='gugudan_teacher_vertical_metrics'||name==='gugudan_teacher_block_records')return Response.json([]);
  if(name==='gugudan_teacher_stairs_records'){
    if(stairsRpcMissing)return Response.json({code:'PGRST202',message:'missing'},{status:404});
    return Response.json(Array.from({length:23},(_,i)=>({studentNumber:i+1,stairsExp:i===5?40:0,stairsBest:i===5?1500:null})));
  }
  if(name==='gugudan_teacher_reset_scoped')return Response.json(null);
  throw new Error(`Unexpected RPC ${name}`);
};
await import('../supabase/functions/gugudan-api/index.ts');
registerHooks({resolve(specifier,context,next){
 try{return next(specifier,context);}
 catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/.test(specifier))return next(specifier+'.ts',context);throw error;}
}});
const { profile } = await import('../src/cloud/parse.ts');
after(()=>{globalThis.fetch=originalFetch;if(originalDeno===undefined)delete globalThis.Deno;else globalThis.Deno=originalDeno;});
const call=async(action,payload={},token)=>{const response=await handler(new Request('https://unit-test.invalid/api',{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Gugudan-Session':token}:{})},body:JSON.stringify({action,...payload})}));return {status:response.status,data:await response.json()};};
const register=async n=>(await call('register',{studentNumber:n})).data.token;
const finishPayload=(id,run)=>({id,ended:run.ended,log:run.log});

test('stairs need a signed student session and a valid id',async()=>{
  for(const action of ['stairsBegin','stairsFinish','stairsLeaders','stairsRecords'])assert.equal((await call(action,{id:crypto.randomUUID()})).status,401);
  const token=await register(7);
  assert.equal((await call('stairsBegin',{id:'bad'},token)).status,400);
  assert.equal((await call('capabilities',{},token)).data.stairs,true);
});

test('the server replays the issued seed, stores its own score and accepts identical retries only',async()=>{
  const token=await register(7),id=crypto.randomUUID();
  const begun=await call('stairsBegin',{id},token);
  assert.equal(begun.status,200);
  assert.equal((await call('stairsBegin',{id},token)).data.seed,begun.data.seed,'retried start keeps the seed');
  assert.equal((await call('stairsBegin',{id},await register(8))).status,409);
  const run=playStairsRun(begun.data.seed,{slipEvery:11,mashEvery:9});
  // 답 기록의 키 순서·여분 필드·가짜 점수는 같은 해시로 정규화한다.
  const reordered={...finishPayload(id,run),score:999999,coins:999999,log:run.log.map(e=>typeof e==='object'?{ms:e.ms,answer:e.answer,extra:1}:e)};
  calls.length=0;
  const finished=await call('stairsFinish',reordered,token);
  assert.equal(finished.status,200);
  assert.equal(finished.data.score,stairsScore(run));
  const stored=calls.find(c=>c.name==='gugudan_stairs_finish').args;
  assert.deepEqual([stored.p_seed,stored.p_height,stored.p_solved,stored.p_mistakes,stored.p_slips,stored.p_ended],[begun.data.seed,run.height,run.solved,run.mistakes,run.slips,'fallen']);
  assert.match(stored.p_hash,/^[0-9a-f]{64}$/);
  assert.deepEqual(stored.p_log,run.log);
  assert.deepEqual(await call('stairsFinish',finishPayload(id,run),token),{status:200,data:finished.data});
  const other=playStairsRun(begun.data.seed,{stopAfter:STAIRS_GATE});
  assert.equal((await call('stairsFinish',finishPayload(id,other),token)).data.error,'RUN_ALREADY_FINISHED');
  assert.equal((await call('stairsFinish',finishPayload(id,run),await register(8))).status,409);
});

test('logs that do not replay or have the wrong shape are rejected before saving',async()=>{
  const token=await register(9),id=crypto.randomUUID();
  const {data:{seed}}=await call('stairsBegin',{id},token);
  const run=playStairsRun(seed,{stopAfter:STAIRS_GATE*2});
  calls.length=0;
  for(const payload of [
    {...finishPayload(id,run),ended:'fallen'},
    {...finishPayload(id,run),ended:'won'},
    {...finishPayload(id,run),log:[...run.log,'jump']},
    {...finishPayload(id,run),log:run.log.map(e=>typeof e==='object'?{answer:'1'}:e)},
    {...finishPayload(id,run),log:run.log.map(e=>typeof e==='object'?{...e,ms:-1}:e)},
    {...finishPayload(id,run),log:run.log.map(e=>typeof e==='object'?{answer:10}:e)},
    {...finishPayload(id,run),log:Array.from({length:5001},()=>'climb')},
  ])assert.equal((await call('stairsFinish',payload,token)).status,400);
  assert.equal(calls.some(c=>c.name==='gugudan_stairs_finish'),false);
  assert.equal((await call('stairsFinish',finishPayload(crypto.randomUUID(),run),token)).data.error,'RUN_NOT_FOUND');
});

test('hall of fame, own records, teacher records and the stairs reset scope',async()=>{
  const token=await register(4);
  assert.deepEqual((await call('stairsLeaders',{},token)).data,[{studentNumber:4,score:1500,correct:5,avatar:null}]);
  assert.deepEqual((await call('stairsRecords',{},token)).data,{best:1500,runs:3});
  const teacher=(await call('teacherLogin',{code:'1234'})).data.token;
  const sixth=profile((await call('teacherRecords',{},teacher)).data[5],6);
  assert.deepEqual([sixth.stairsExp,sixth.stairsBest,sixth.canResetStairs],[40,1500,true]);
  stairsRpcMissing=true;
  const legacy=profile((await call('teacherRecords',{},teacher)).data[5],6);
  assert.deepEqual([legacy.stairsExp,legacy.stairsBest,legacy.canResetStairs],[0,null,false]);
  stairsRpcMissing=false;
  assert.equal((await call('teacherResetScoped',{studentNumber:6,scopes:['stairs','rush-1']},teacher)).status,200);
  assert.equal((await call('teacherResetScoped',{studentNumber:6,scopes:['rush-1','rush-2','rush-3','vertical-5','vertical-10','block','stairs']},teacher)).status,200);
  assert.equal((await call('teacherResetScoped',{studentNumber:6,scopes:['stairs','stairs']},teacher)).status,400);
  assert.equal((await call('stairsLeaders',{},teacher)).status,401);
});
