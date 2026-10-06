import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { chooseMixedVerticalQuestions, withVerticalPuzzles, withDirectZeroQuestions } from '../src/game/vertical.ts';

const originalFetch=globalThis.fetch;
const originalDeno=globalThis.Deno;
const assignments=new Map();
const rpcCalls=[];
let handler;
let metricsResponse=[];
globalThis.Deno={env:{get:name=>({SUPABASE_URL:'https://unit-test.invalid',SUPABASE_SERVICE_ROLE_KEY:'unit-test-signing-key',GUGUDAN_TEACHER_CODE:'1234'})[name]},serve:callback=>{handler=callback;}};
globalThis.fetch=async(url,options)=>{
  const name=new URL(url).pathname.split('/').at(-1),args=JSON.parse(options.body);
  rpcCalls.push({name,args});
  const assignment=studentNumber=>({studentNumber,difficulty:assignments.get(studentNumber)??1});
  let result;
  if(name==='gugudan_teacher_set_vertical'){assignments.set(args.p_student,args.p_difficulty);result=assignment(args.p_student);}
  else if(name==='gugudan_vertical_assignment')result=assignment(args.p_student);
  else if(name==='gugudan_teacher_vertical_assignments')result=Array.from({length:23},(_,i)=>assignment(i+1));
  else if(name==='gugudan_teacher_records')result=Array.from({length:23},(_,i)=>({studentNumber:i+1,records:{},sessions:[],best:[]}));
  else if(name==='gugudan_teacher_vertical_metrics'){if(metricsResponse instanceof Response)return metricsResponse.clone();result=metricsResponse;}
  else if(name==='gugudan_vertical_begin_direct_zero'||name==='gugudan_vertical_begin_tight'||name==='gugudan_vertical_begin_cells'){const assigned=assignment(args.p_student),questions=withDirectZeroQuestions(withVerticalPuzzles(chooseMixedVerticalQuestions(assigned.difficulty,Math.random,args.p_count),assigned.difficulty,Math.random,true,true));result={...assigned,id:args.p_id,questions,timeScoring:name!=='gugudan_vertical_begin_direct_zero'||args.p_timed,manualZero:true,puzzles:true,puzzleOperands:true,directZero:true,...(name!=='gugudan_vertical_begin_direct_zero'?{tightTime:true}:{}),...(name==='gugudan_vertical_begin_cells'?{cellScoring:true}:{})};}
  else if(name==='gugudan_vertical_begin_variety'){const assigned=assignment(args.p_student),questions=withVerticalPuzzles(chooseMixedVerticalQuestions(assigned.difficulty,Math.random,args.p_count),assigned.difficulty,Math.random,true);result={...assigned,id:args.p_id,questions,timeScoring:args.p_timed,manualZero:true,puzzles:true,puzzleOperands:true};}
  else if(name==='gugudan_vertical_begin'||name==='gugudan_vertical_begin_timed'||name==='gugudan_vertical_begin_count'||name==='gugudan_vertical_begin_manual'||name==='gugudan_vertical_begin_puzzles'){const assigned=assignment(args.p_student),questions=chooseMixedVerticalQuestions(assigned.difficulty,Math.random,args.p_count??5);result={...assigned,id:args.p_id,questions:name.endsWith('_puzzles')?withVerticalPuzzles(questions,assigned.difficulty):questions,...(name.endsWith('_timed')||args.p_timed?{timeScoring:true}:{}),...(name.endsWith('_manual')||name.endsWith('_puzzles')?{manualZero:true}:{}),...(name.endsWith('_puzzles')?{puzzles:true}:{})};}
  else if(name==='gugudan_vertical_finish')result={id:args.p_id,score:970};
  else if(name==='gugudan_teacher_reset_scoped'||name==='gugudan_teacher_reset'||name==='gugudan_teacher_reset_all')result=null;
  else if(name==='gugudan_vertical_leaders'||name==='gugudan_vertical_leaders_count'||name==='gugudan_vertical_leaders_tight'||name==='gugudan_vertical_leaders_cells')result=[];
  else throw new Error('Unexpected RPC');
  return Response.json(result);
};
await import('../supabase/functions/gugudan-api/index.ts');
after(()=>{globalThis.fetch=originalFetch;if(originalDeno===undefined)delete globalThis.Deno;else globalThis.Deno=originalDeno;});
const call=(action,payload={},token)=>handler(new Request('https://unit-test.invalid/api',{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Gugudan-Session':token}:{})},body:JSON.stringify({action,...payload})}));

test('cell scoring requires timed flags, keeps signed identity and separates rankings',async()=>{
 const token=(await (await call('register',{studentNumber:7})).json()).token;
 const flags={cellScoring:true,tightTime:true,timeScoring:true,directZero:true,puzzleOperands:true,puzzles:true,manualZero:true};
 for(const count of [5,10]){
  const id=crypto.randomUUID();
  const start=await (await call('verticalBegin',{...flags,id,count,studentNumber:1},token)).json();
  assert.equal(start.cellScoring,true);assert.equal(start.studentNumber,7);
  assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_begin_cells',args:{p_student:7,p_id:id,p_count:count}});
  await call('verticalLeaders',{cellScoring:true,count},token);
  assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_leaders_cells',args:{p_count:count}});
 }
 for(const changed of [{cellScoring:'true'},{tightTime:false},{timeScoring:false},{directZero:false},{puzzleOperands:false},{puzzles:false},{manualZero:false}]){
  const before=rpcCalls.length;
  assert.equal((await call('verticalBegin',{...flags,id:crypto.randomUUID(),...changed},token)).status,400);
  assert.equal(rpcCalls.length,before);
 }
 assert.equal((await call('verticalLeaders',{cellScoring:'true'},token)).status,400);
 assert.equal((await call('verticalBegin',{...flags,id:crypto.randomUUID()})).status,401);
});

test('tight timing requires the complete timed mode and uses the signed student identity',async()=>{
 const token=(await (await call('register',{studentNumber:7})).json()).token;
 const flags={tightTime:true,timeScoring:true,directZero:true,puzzleOperands:true,puzzles:true,manualZero:true};
 for(const count of [5,10]){
  const id=crypto.randomUUID();
  const start=await (await call('verticalBegin',{...flags,id,count,studentNumber:1,difficulty:3},token)).json();
  assert.equal(start.tightTime,true);assert.equal(start.timeScoring,true);assert.equal(start.studentNumber,7);
  assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_begin_tight',args:{p_student:7,p_id:id,p_count:count}});
  await call('verticalLeaders',{tightTime:true,count},token);
  assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_leaders_tight',args:{p_count:count}});
 }
 for(const changed of [{tightTime:'true'},{timeScoring:false},{directZero:false},{manualZero:false},{puzzles:false},{puzzleOperands:false}]){
  const before=rpcCalls.length;
  assert.equal((await call('verticalBegin',{...flags,id:crypto.randomUUID(),...changed},token)).status,400);
  assert.equal(rpcCalls.length,before);
 }
 assert.equal((await call('verticalLeaders',{tightTime:'true'},token)).status,400);
 assert.equal((await call('verticalBegin',{...flags,id:crypto.randomUUID()})).status,401);
});

test('only a valid teacher session can change a student assignment',async()=>{
  const student=(await (await call('register',{studentNumber:3})).json()).token;
  for(const token of [undefined,student,'teacher.9999999999.'+'0'.repeat(64),'teacher.1.'+'0'.repeat(64)]){
    const previous=rpcCalls.length;
    assert.equal((await call('teacherSetVertical',{studentNumber:3,difficulty:3},token)).status,401);
    assert.equal(rpcCalls.length,previous);
  }
  const teacher=(await (await call('teacherLogin',{code:'1234'})).json()).token;
  for(const payload of [{studentNumber:0,difficulty:1},{studentNumber:24,difficulty:1},{studentNumber:3,difficulty:4},{studentNumber:3,difficulty:'2'}]){
    const previous=rpcCalls.length;
    assert.equal((await call('teacherSetVertical',payload,teacher)).status,400);
    assert.equal(rpcCalls.length,previous);
  }
  assert.deepEqual(await (await call('teacherSetVertical',{studentNumber:3,difficulty:3},teacher)).json(),{studentNumber:3,difficulty:3});
  assert.deepEqual(await (await call('verticalAssignment',{studentNumber:4},student)).json(),{studentNumber:3,difficulty:3});
  const other=(await (await call('register',{studentNumber:4})).json()).token;
  assert.deepEqual(await (await call('verticalAssignment',{},other)).json(),{studentNumber:4,difficulty:1});
  const records=await (await call('teacherRecords',{},teacher)).json();
  assert.equal(records.length,23);assert.equal(records[2].verticalDifficulty,3);assert.equal(records[3].verticalDifficulty,1);
  assert.equal(records.every(row=>row.canResetScopes===true),true);
  assert.equal((await call('verticalAssignment')).status,401);
});

test('scoped resets require teacher auth and validate categories before RPC',async()=>{
 const student=(await (await call('register',{studentNumber:3})).json()).token;
 for(const token of [undefined,student,'teacher.1.'+'0'.repeat(64)]){
   const before=rpcCalls.length;
   assert.equal((await call('teacherResetScoped',{studentNumber:3,scopes:['rush-1']},token)).status,401);
   assert.equal(rpcCalls.length,before);
 }
 const teacher=(await (await call('teacherLogin',{code:'1234'})).json()).token;
 for(const scopes of [undefined,null,[],['rush-4'],['rush-1','rush-1'],[1],{},'rush-1',Array(6).fill('rush-1')]){
   const before=rpcCalls.length;
   assert.equal((await call('teacherResetScoped',{studentNumber:3,scopes},teacher)).status,400);
   assert.equal(rpcCalls.length,before);
 }
 for(const studentNumber of [0,24,'3',3.5,null]){
   const before=rpcCalls.length;
   assert.equal((await call('teacherResetScoped',{studentNumber,scopes:['rush-1']},teacher)).status,400);
   assert.equal(rpcCalls.length,before);
 }
 const scopes=['rush-1','rush-2','rush-3','vertical-5','vertical-10'];
 assert.deepEqual(await (await call('teacherResetScoped',{studentNumber:3,scopes},teacher)).json(),{ok:true});
 assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_teacher_reset_scoped',args:{p_student:3,p_scopes:scopes}});
 await call('teacherReset',{studentNumber:3},teacher);
 assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_teacher_reset',args:{p_student:3}});
 await call('teacherResetAll',{},teacher);
 assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_teacher_reset_all',args:{}});
});

test('vertical scoring uses signed student identity and rejects invalid payloads before RPC',async()=>{
  const token=(await (await call('register',{studentNumber:5})).json()).token;
  const id='11111111-1111-4111-8111-111111111111';
  for(const action of ['verticalBegin','verticalFinish','verticalLeaders'])assert.equal((await call(action,{id,events:[],difficulty:1})).status,401);
  for(const payload of [{id:'bad',events:[]},{id,events:[{question:0,step:0,answer:'1'}]},{id,events:[{question:10,step:0,answer:1}]},{id,events:Array(2001).fill({question:0,step:0,answer:1})}]){
    const count=rpcCalls.length;assert.equal((await call('verticalFinish',payload,token)).status,400);assert.equal(rpcCalls.length,count);
  }
  const started=await (await call('verticalBegin',{id,studentNumber:6,difficulty:3,questions:Array(5).fill({a:99,b:99})},token)).json();
  assert.equal(started.id,id);assert.equal(started.studentNumber,5);assert.equal(started.difficulty,1);assert.equal(started.questions.length,5);
  assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_begin',args:{p_student:5,p_id:id}});
  assert.deepEqual(await (await call('verticalFinish',{id,score:1000,studentNumber:6,events:[{question:0,step:0,answer:1}]},token)).json(),{id,score:970});
  assert.equal(rpcCalls.at(-1).args.p_student,5);assert.equal('score' in rpcCalls.at(-1).args,false);
  assert.deepEqual(await (await call('verticalLeaders',{},token)).json(),[]);
  assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_leaders',args:{}});
  assert.deepEqual(await (await call('verticalLeaders',{difficulty:4},token)).json(),[]);
  assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_leaders',args:{}});
});

test('ten-question starts and separate rankings validate counts and keep the signed student identity',async()=>{
  const token=(await (await call('register',{studentNumber:23})).json()).token,id=crypto.randomUUID();
  for(const count of [0,6,20,'10',null])for(const action of ['verticalBegin','verticalLeaders']){
    const before=rpcCalls.length;
    assert.equal((await call(action,{id,count},token)).status,400);
    assert.equal(rpcCalls.length,before);
  }
  const start=await (await call('verticalBegin',{id,count:10,timeScoring:true,studentNumber:2,difficulty:3},token)).json();
  assert.equal(start.questions.length,10);assert.equal(start.studentNumber,23);assert.equal(start.difficulty,1);
  assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_begin_count',args:{p_student:23,p_id:id,p_count:10,p_timed:true}});
  await call('verticalBegin',{id,count:5,timeScoring:true},token);
  assert.equal(rpcCalls.at(-1).name,'gugudan_vertical_begin_timed');
  await call('verticalLeaders',{count:10,difficulty:3},token);
  assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_leaders_count',args:{p_count:10}});
  await call('verticalLeaders',{count:5},token);
  assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_leaders',args:{}});
  const events=[{question:9,step:0,answer:1,ms:0}];
  assert.equal((await call('verticalFinish',{id,events},token)).status,200);
  assert.deepEqual(rpcCalls.at(-1).args,{p_student:23,p_id:id,p_events:events});
});

test('teacher metrics are teacher-only, missing RPC is compatible, and other failures remain visible',async()=>{
  const teacher=(await (await call('teacherLogin',{code:'1234'})).json()).token;
  const stats={runs:3,first:{attempts:100,correct:90},multiply:{attempts:20,correct:18},sum:{attempts:10,correct:8}};
  metricsResponse=[{studentNumber:3,stats}];
  const rows=await (await call('teacherRecords',{},teacher)).json();
  assert.deepEqual(rows[2].verticalMetrics,stats);assert.equal(rows[0].verticalMetrics,null);
  const student=(await (await call('register',{studentNumber:3})).json()).token;
  const before=rpcCalls.length;
  assert.equal((await call('teacherRecords',{},student)).status,401);assert.equal(rpcCalls.length,before);
  metricsResponse=Response.json({code:'PGRST202'},{status:404});
  assert.equal((await (await call('teacherRecords',{},teacher)).json())[2].verticalMetrics,null);
  metricsResponse=Response.json({code:'XX000'},{status:503});
  assert.equal((await call('teacherRecords',{},teacher)).status,503);
  metricsResponse=[];
});

test('timed starts opt in without breaking old clients, and cell durations are validated and forwarded',async()=>{
  const token=(await (await call('register',{studentNumber:5})).json()).token,id=crypto.randomUUID();
  const timed=await (await call('verticalBegin',{id,timeScoring:true},token)).json();
  assert.equal(timed.timeScoring,true);assert.equal(rpcCalls.at(-1).name,'gugudan_vertical_begin_timed');
  await call('verticalBegin',{id,timeScoring:false},token);assert.equal(rpcCalls.at(-1).name,'gugudan_vertical_begin');
  assert.equal((await call('verticalBegin',{id,timeScoring:'true'},token)).status,400);
  for(const ms of [-1,1.5,1000000001,'1000',null]){
    const count=rpcCalls.length;
    assert.equal((await call('verticalFinish',{id,events:[{question:0,step:0,answer:1,ms}]},token)).status,400);
    assert.equal(rpcCalls.length,count);
  }
  const events=[{question:0,step:0,answer:1,ms:1234}];
  await call('verticalFinish',{id,events,score:1000},token);
  assert.deepEqual(rpcCalls.at(-1).args,{p_student:5,p_id:id,p_events:events});
});

test('manual zeros are opt-in and use authenticated identity for both question counts',async()=>{
  const token=(await (await call('register',{studentNumber:23})).json()).token,id=crypto.randomUUID();
  for(const count of [5,10]){
    const result=await (await call('verticalBegin',{id,count,manualZero:true,timeScoring:true,studentNumber:1},token)).json();
    assert.equal(result.manualZero,true);assert.equal(result.questions.length,count);
    assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_begin_manual',args:{p_student:23,p_id:id,p_count:count,p_timed:true}});
  }
  await call('verticalBegin',{id,manualZero:true},token);
  assert.deepEqual(rpcCalls.at(-1).args,{p_student:23,p_id:id,p_count:5,p_timed:false});
  await call('verticalBegin',{id,manualZero:false},token);
  assert.equal(rpcCalls.at(-1).name,'gugudan_vertical_begin');
  for(const manualZero of ['true',1,null]){
    const previous=rpcCalls.length;
    assert.equal((await call('verticalBegin',{id,manualZero},token)).status,400);
    assert.equal(rpcCalls.length,previous);
  }
});

test('puzzle starts use teacher assignment and server question descriptors without trusting student difficulty',async()=>{
  const teacher=(await (await call('teacherLogin',{code:'1234'})).json()).token;
  await call('teacherSetVertical',{studentNumber:22,difficulty:3},teacher);
  const token=(await (await call('register',{studentNumber:22})).json()).token,id=crypto.randomUUID();
  const result=await (await call('verticalBegin',{id,count:10,manualZero:true,puzzles:true,timeScoring:true,difficulty:1,studentNumber:1},token)).json();
  assert.equal(result.difficulty,3);assert.equal(result.puzzles,true);assert.equal(result.questions.filter(f=>f.holes).length,5);
  assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_begin_puzzles',args:{p_student:22,p_id:id,p_count:10,p_timed:true}});
  for(const payload of [{puzzles:'true',manualZero:true},{puzzles:true},{puzzles:true,manualZero:false}]){
    const before=rpcCalls.length;assert.equal((await call('verticalBegin',{id,...payload},token)).status,400);assert.equal(rpcCalls.length,before);
  }
});

test('varied starts opt in to operand holes and reject malformed flags before reaching the database',async()=>{
 const teacher=(await (await call('teacherLogin',{code:'1234'})).json()).token;
 await call('teacherSetVertical',{studentNumber:21,difficulty:3},teacher);
 const token=(await (await call('register',{studentNumber:21})).json()).token,id=crypto.randomUUID();
 const result=await (await call('verticalBegin',{id,count:10,puzzleOperands:true,puzzles:true,manualZero:true,timeScoring:true,studentNumber:2,difficulty:1},token)).json();
 assert.equal(result.puzzleOperands,true);assert.equal(result.difficulty,3);
 assert.ok(result.questions.some(f=>f.holes?.some(id=>id.startsWith('operand-a'))));
 assert.ok(result.questions.some(f=>f.holes?.some(id=>id.startsWith('operand-b'))));
 assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_begin_variety',args:{p_student:21,p_id:id,p_count:10,p_timed:true}});
 for(const payload of [{puzzleOperands:'true',puzzles:true,manualZero:true},{puzzleOperands:true,manualZero:true},{puzzleOperands:true,puzzles:true}]){
   const before=rpcCalls.length;assert.equal((await call('verticalBegin',{id,...payload},token)).status,400);assert.equal(rpcCalls.length,before);
 }
});

test('single-row zero products opt in, require manual/puzzle flags and preserve signed identity',async()=>{
 const token=(await (await call('register',{studentNumber:20})).json()).token,id=crypto.randomUUID();
 for(const count of [5,10]){
   const start=await (await call('verticalBegin',{id,count,directZero:true,puzzleOperands:true,puzzles:true,manualZero:true,timeScoring:true,studentNumber:1,difficulty:3},token)).json();
   assert.equal(start.directZero,true);assert.equal(start.studentNumber,20);assert.equal(start.difficulty,1);
   assert.deepEqual(rpcCalls.at(-1),{name:'gugudan_vertical_begin_direct_zero',args:{p_student:20,p_id:id,p_count:count,p_timed:true}});
 }
 for(const payload of [{directZero:'true',puzzleOperands:true,puzzles:true,manualZero:true},{directZero:true,puzzles:true,manualZero:true},{directZero:true,puzzleOperands:true,manualZero:true},{directZero:true,puzzleOperands:true,puzzles:true}]){
   const before=rpcCalls.length;assert.equal((await call('verticalBegin',{id,...payload},token)).status,400);assert.equal(rpcCalls.length,before);
 }
});
