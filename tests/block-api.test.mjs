import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { registerHooks } from 'node:module';
import { blockScore } from '../src/game/blockRun.ts';
import { playBlockRun } from './block-player.mjs';

// gugudan-api의 블록 액션을 가짜 데이터베이스로 검사한다. 시드는 시작 RPC가 정하고, 끝 RPC는 Edge가 재생한 값만 받는다.
const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno;
let handler;
globalThis.Deno={env:{get:name=>({SUPABASE_URL:'https://unit-test.invalid',SUPABASE_SERVICE_ROLE_KEY:'unit-test-signing-key',GUGUDAN_TEACHER_CODE:'1234'})[name]},serve:callback=>{handler=callback;}};
const runs=new Map(),calls=[];
let blockRpcMissing=false;
const rejected=message=>Response.json({code:'P0001',message},{status:400});
globalThis.fetch=async(url,options)=>{
  if(!options?.body)return Response.json([]);
  const name=new URL(url).pathname.split('/').at(-1),args=JSON.parse(options.body);
  calls.push({name,args});
  if(name==='gugudan_block_begin'){
    const found=runs.get(args.p_id)??{student:args.p_student,seed:runs.size*977+12345};
    if(found.student!==args.p_student)return rejected('RUN_CONFLICT');
    runs.set(args.p_id,found);return Response.json({id:args.p_id,seed:found.seed});
  }
  if(name==='gugudan_block_seed'){const found=runs.get(args.p_id);return found&&found.student===args.p_student?Response.json({id:args.p_id,seed:found.seed}):rejected('RUN_NOT_FOUND');}
  if(name==='gugudan_block_finish'){
    const found=runs.get(args.p_id);
    if(found.finished)return found.finished.hash===args.p_hash?Response.json(found.finished.receipt):rejected('RUN_ALREADY_FINISHED');
    const receipt={id:args.p_id,score:args.p_score,solved:args.p_solved,lines:args.p_lines,ended:args.p_ended};
    found.finished={hash:args.p_hash,receipt};return Response.json(receipt);
  }
  if(name==='gugudan_block_leaders')return Response.json([{studentNumber:3,score:900,correct:4,avatar:null}]);
  if(name==='gugudan_block_records')return Response.json({best:900,runs:2});
  if(name==='gugudan_teacher_records')return Response.json(Array.from({length:23},(_,i)=>({studentNumber:i+1,records:{},sessions:[],best:[]})));
  if(name==='gugudan_teacher_vertical_assignments')return Response.json(Array.from({length:23},(_,i)=>({studentNumber:i+1,difficulty:1})));
  if(name==='gugudan_teacher_vertical_metrics')return Response.json([]);
  if(name==='gugudan_teacher_block_records'){
    if(blockRpcMissing)return Response.json({code:'PGRST202',message:'missing'},{status:404});
    return Response.json(Array.from({length:23},(_,i)=>({studentNumber:i+1,blockExp:i===4?60:0,verticalExp:i===4?100:0,blockSessions:i===4?[{id:'00000000-0000-4000-8000-000000000005',finishedAt:'2026-10-12T01:00:00Z',score:900,solved:3,lines:2,mistakes:1,ended:'stuck'}]:[]})));
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
const finishPayload=(id,run)=>({id,ended:run.ended,answers:run.answers,moves:run.moves});

test('blocks need a signed student session and a valid id',async()=>{
  for(const action of ['blockBegin','blockFinish','blockLeaders','blockRecords'])assert.equal((await call(action,{id:crypto.randomUUID()})).status,401);
  const token=await register(7);
  assert.equal((await call('blockBegin',{id:'bad'},token)).status,400);
  assert.equal((await call('capabilities',{},token)).data.blocks,true);
});

test('the server replays the issued seed, stores its own score and accepts identical retries only',async()=>{
  const token=await register(7),id=crypto.randomUUID();
  const begun=await call('blockBegin',{id},token);
  assert.equal(begun.status,200);
  const again=await call('blockBegin',{id},token);
  assert.equal(again.data.seed,begun.data.seed,'retried start keeps the seed');
  assert.equal((await call('blockBegin',{id},await register(8))).status,409);
  const run=playBlockRun(begun.data.seed,{stopAfter:8});
  // 기록 순서가 다른 키(가짜 점수 포함)도 같은 해시로 정규화한다.
  const reordered={...finishPayload(id,run),score:999999,answers:run.answers.map(({answer,ms})=>({ms,answer,extra:1}))};
  calls.length=0;
  const finished=await call('blockFinish',reordered,token);
  assert.equal(finished.status,200);
  assert.equal(finished.data.score,blockScore(run));
  const stored=calls.find(c=>c.name==='gugudan_block_finish').args;
  assert.deepEqual([stored.p_seed,stored.p_solved,stored.p_mistakes,stored.p_lines,stored.p_ended],[begun.data.seed,run.solved,run.mistakes,run.lines,'stopped']);
  assert.match(stored.p_hash,/^[0-9a-f]{64}$/);
  assert.deepEqual(stored.p_answers,run.answers);
  const retried=await call('blockFinish',finishPayload(id,run),token);
  assert.deepEqual(retried,{status:200,data:finished.data});
  // 같은 ID에 다른 기록을 보내면 거부한다.
  const longer=playBlockRun(begun.data.seed,{stopAfter:9});
  assert.equal((await call('blockFinish',finishPayload(id,longer),token)).data.error,'RUN_ALREADY_FINISHED');
  // 다른 학생은 이 ID로 끝낼 수 없다.
  assert.equal((await call('blockFinish',finishPayload(id,run),await register(8))).status,409);
});

test('logs that do not replay or have the wrong shape are rejected before saving',async()=>{
  const token=await register(9),id=crypto.randomUUID();
  const {data:{seed}}=await call('blockBegin',{id},token);
  const run=playBlockRun(seed,{stopAfter:5});
  calls.length=0;
  for(const payload of [
    {...finishPayload(id,run),ended:'stuck'},
    {...finishPayload(id,run),moves:[...run.moves,{piece:0,row:0,col:0}]},
    {...finishPayload(id,run),moves:run.moves.map((m,i)=>i?m:{...m,piece:3})},
    {...finishPayload(id,run),answers:run.answers.map((a,i)=>i?a:{answer:'1'})},
    {...finishPayload(id,run),answers:run.answers.map((a,i)=>i?a:{...a,ms:-1})},
    {...finishPayload(id,run),ended:'won'},
    {...finishPayload(id,run),answers:Array.from({length:6001},()=>({answer:1}))},
  ])assert.equal((await call('blockFinish',payload,token)).status,400);
  assert.equal(calls.some(c=>c.name==='gugudan_block_finish'),false);
  assert.equal((await call('blockFinish',finishPayload(crypto.randomUUID(),run),token)).data.error,'RUN_NOT_FOUND');
});

test('hall of fame, own records, teacher records and the block reset scope',async()=>{
  const token=await register(3);
  assert.deepEqual((await call('blockLeaders',{},token)).data,[{studentNumber:3,score:900,correct:4,avatar:null}]);
  assert.deepEqual((await call('blockRecords',{},token)).data,{best:900,runs:2});
  const login=await call('teacherLogin',{code:'1234'}),teacher=login.data.token;
  const records=await call('teacherRecords',{},teacher);
  assert.equal(records.status,200);
  const fifth=profile(records.data[4],5);
  assert.equal(fifth.blockExp,60);assert.equal(fifth.verticalExp,100);assert.equal(fifth.canResetBlock,true);
  assert.deepEqual(fifth.blockSessions.map(s=>[s.score,s.solved,s.lines]),[[900,3,2]]);
  blockRpcMissing=true;
  const legacy=profile((await call('teacherRecords',{},teacher)).data[4],5);
  assert.deepEqual([legacy.blockExp,legacy.blockSessions.length,legacy.canResetBlock],[0,0,false]);
  blockRpcMissing=false;
  assert.equal((await call('teacherResetScoped',{studentNumber:5,scopes:['block','rush-1']},teacher)).status,200);
  assert.equal((await call('teacherResetScoped',{studentNumber:5,scopes:['rush-1','rush-2','rush-3','vertical-5','vertical-10','block']},teacher)).status,200);
  assert.equal((await call('teacherResetScoped',{studentNumber:5,scopes:['blocks']},teacher)).status,400);
  assert.equal((await call('teacherResetScoped',{studentNumber:5,scopes:['block','block']},teacher)).status,400);
  assert.equal((await call('blockLeaders',{},teacher)).status,401);
});
