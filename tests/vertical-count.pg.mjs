import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createVerticalSession, difficultyOf, reduceVertical, verticalScore, verticalSteps } from '../src/game/vertical.ts';
import { verticalCounts } from '../src/game/verticalSets.ts';

if(process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='99dan_vertical_score_count_20261003')throw Error('Use the isolated local count test database');
function sql(query){
  const result=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:4*1024*1024});
  if(result.status!==0)throw Error(result.stderr);
  return result.stdout.trim().split('\n').filter(line=>line.startsWith('{')||line.startsWith('['));
}
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const cases=[];
for(const count of [5,10])for(const difficulty of [1,2,3])for(const ms of [0,7000,20000])cases.push({count,difficulty,ms,id:crypto.randomUUID()});
const starts=sql(`begin;set local role service_role;${cases.map(c=>`select public.gugudan_teacher_set_vertical(23,${c.difficulty});select public.gugudan_vertical_begin_count(23,'${c.id}',${c.count},true);`).join('\n')}commit;`).map(JSON.parse).filter(r=>r.id);
const sessions=starts.map((start,index)=>{
  const c=cases[index];
  assert.equal(start.questions.length,c.count);assert.equal(start.difficulty,c.difficulty);assert.equal(start.timeScoring,true);
  assert.equal(new Set(start.questions.map(f=>`${f.a}:${f.b}`)).size,c.count);
  assert.deepEqual([1,2,3].map(kind=>start.questions.filter(f=>difficultyOf(f)===kind).length),verticalCounts(c.difficulty,c.count));
  let session=createVerticalSession(start.difficulty,start.id,start.questions,true);
  for(let q=0;q<c.count;q++){
    const steps=verticalSteps(session.questions[q]);
    if(q===c.count-1)session=reduceVertical(reduceVertical(session,{type:'input',key:String((steps[0].expected+1)%10)}),{type:'input',key:'Enter',ms:0});
    for(const step of steps)session=reduceVertical(reduceVertical(session,{type:'input',key:String(step.expected)}),{type:'input',key:'Enter',ms:c.ms});
    session=reduceVertical(session,{type:'next'});
  }
  return session;
});
const validation=sessions.find(s=>s.questions.length===10),five=sessions[0];
const reject=(query,error)=>`begin ${query};raise exception 'Expected ${error}';exception when raise_exception then if sqlerrm<>'${error}' then raise;end if;end;`;
const output=sql(`begin;set local role service_role;
do $$ begin
 ${reject(`perform public.gugudan_vertical_begin_count(23,'${validation.id}',5,true)`,'RUN_COUNT_CONFLICT')}
 ${reject(`perform public.gugudan_vertical_begin_count(22,'${validation.id}',10,true)`,'RUN_CONFLICT')}
 ${reject(`perform public.gugudan_vertical_begin_count(23,gen_random_uuid(),6,true)`,'INVALID_RUN')}
 ${reject(`perform public.gugudan_vertical_leaders_count(6)`,'INVALID_COUNT')}
 ${reject(`perform public.gugudan_vertical_finish(22,'${validation.id}',${literal(validation.events)})`,'RUN_NOT_FOUND')}
 ${reject(`perform public.gugudan_vertical_finish(23,'${validation.id}',${literal(validation.events.filter(e=>e.question<5))})`,'INCOMPLETE_RUN')}
 ${reject(`perform public.gugudan_vertical_finish(23,'${validation.id}',${literal(validation.events.slice(0,-1))})`,'INCOMPLETE_RUN')}
 ${reject(`perform public.gugudan_vertical_finish(23,'${five.id}',${literal(five.events.map((e,i)=>i===0?{...e,question:5}:e))})`,'INVALID_SEQUENCE')}
end $$;
${sessions.map(s=>`select public.gugudan_vertical_finish(23,'${s.id}',${literal(s.events)});select public.gugudan_vertical_finish(23,'${s.id}',${literal(s.events)});`).join('\n')}
select public.gugudan_vertical_begin_count(23,'${validation.id}',10,false);
update public.gugudan_vertical_runs set finished_at=now()-interval '8 days' where finished_at is not null;
update public.gugudan_vertical_runs set finished_at=now() where id in ('${validation.id}','${five.id}');
select public.gugudan_vertical_leaders_count(5);
select public.gugudan_vertical_leaders_count(10);
select public.gugudan_vertical_leaders();
set local role anon;
do $$ begin
 begin perform public.gugudan_vertical_begin_count(1,gen_random_uuid(),10,true);raise exception 'Anonymous start';exception when insufficient_privilege then null;end;
 begin perform public.gugudan_vertical_leaders_count(10);raise exception 'Anonymous ranking';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
do $$ begin
 begin perform public.gugudan_vertical_begin_count(1,gen_random_uuid(),10,true);raise exception 'Public start';exception when insufficient_privilege then null;end;
 begin perform public.gugudan_vertical_leaders_count(10);raise exception 'Public ranking';exception when insufficient_privilege then null;end;
end $$;
rollback;`).map(JSON.parse);
for(const session of sessions){
  const receipts=output.filter(r=>r.id===session.id&&typeof r.score==='number');
  assert.equal(receipts.length,2);assert.ok(receipts.every(r=>r.score===verticalScore(session)));
}
const snapshot=output.find(r=>r.id===validation.id&&r.questions);
assert.deepEqual(snapshot.questions,validation.questions);assert.equal(snapshot.timeScoring,true);
const ranks=output.filter(Array.isArray);
assert.deepEqual(ranks.map(rows=>rows.map(r=>[r.studentNumber,r.score,r.correct])),[[[23,verticalScore(five),5]],[[23,verticalScore(validation),10]],[[23,verticalScore(five),5]]]);
console.log('Question-count PostgreSQL parity: 18 sets, all carry mixes, ten-question completion, timing, retries, independent rankings, legacy five-question ranking and role restrictions passed');
