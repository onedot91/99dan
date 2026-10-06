import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createVerticalSession, parseVerticalSession, reduceVertical, verticalQuestionSteps, verticalScore } from '../src/game/vertical.ts';
if(process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='55435'||process.env.PGDATABASE!=='99dan_tight_time_20261005')throw Error('Use the isolated tight-time test database');
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
function sql(query){
 const r=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:16*1024*1024});
 if(r.status!==0)throw Error(r.stderr);
 return r.stdout.trim().split('\n').filter(line=>line.startsWith('{')||line.startsWith('[')).map(JSON.parse);
}
const cases=[];
for(const mode of ['cells','tight','legacy','untimed'])for(const count of [5,10])for(const difficulty of [1,2,3])for(const ms of [...Array.from({length:20},(_,i)=>(i+1)*1000),2001,3001,19999,1000000000])cases.push({mode,count,difficulty,ms,id:crypto.randomUUID()});
const starts=sql(`begin;set local role service_role;${cases.map(c=>`select public.gugudan_teacher_set_vertical(23,${c.difficulty});select public.${c.mode==='cells'?'gugudan_vertical_begin_cells':c.mode==='tight'?'gugudan_vertical_begin_tight':'gugudan_vertical_begin_direct_zero'}(23,'${c.id}',${c.count}${c.mode==='cells'||c.mode==='tight'?'':`,${c.mode==='legacy'}`});`).join('\n')}commit;`).filter(r=>r.id);
assert.equal(starts.length,cases.length);
const sessions=starts.map((start,i)=>{
 const c=cases[i];assert.equal(start.tightTime===true,c.mode==='cells'||c.mode==='tight');assert.equal(start.cellScoring===true,c.mode==='cells');
 let s=createVerticalSession(c.difficulty,start.id,start.questions,start.timeScoring,start.manualZero,start.tightTime,start.cellScoring);
 for(const fact of s.questions){
  const steps=verticalQuestionSteps(fact,true),order=steps.map((_,i)=>i);if(fact.holes)order.reverse();
  for(const index of order){
   if(fact.holes)s=reduceVertical(s,{type:'select',step:index});
   if(index===0)s=reduceVertical(reduceVertical(s,{type:'input',key:String((steps[index].expected+1)%10)}),{type:'input',key:'Enter',ms:1000});
   s=reduceVertical(reduceVertical(s,{type:'input',key:String(steps[index].expected)}),{type:'input',key:'Enter',ms:c.ms});
  }
  s=reduceVertical(s,{type:'next'});
 }
 assert.deepEqual(parseVerticalSession(s),s);return s;
});
const first=sessions[0],other=sessions.find(s=>!s.cellScoring);
const reject=(statement,error)=>`begin ${statement};raise exception 'ACCEPTED_INVALID';exception when others then if sqlerrm<>'${error}' then raise;end if;end;`;
const snapshot=()=>sql(`select jsonb_build_object('runs',md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,''))) from public.gugudan_vertical_runs r;`)[0];
const before=snapshot();
const result=sql(`begin;set local role service_role;
do $$ begin
 ${reject(`perform public.gugudan_vertical_begin_cells(23,'${other.id}',5)`,'RUN_MODE_CONFLICT')}
 ${reject(`perform public.gugudan_vertical_begin_tight(23,'${first.id}',5)`,'RUN_MODE_CONFLICT')}
 ${reject(`perform public.gugudan_vertical_begin_cells(22,'${first.id}',5)`,'RUN_CONFLICT')}
 ${reject(`perform public.gugudan_vertical_begin_cells(23,'${first.id}',10)`,'RUN_COUNT_CONFLICT')}
 ${reject(`perform public.gugudan_vertical_finish(22,'${first.id}',${literal(first.events)})`,'RUN_NOT_FOUND')}
 ${reject(`perform public.gugudan_vertical_finish(23,'${first.id}',${literal(first.events.map(({ms,...e})=>e))})`,'INVALID_TIME')}
 ${reject(`perform public.gugudan_vertical_finish(23,'${first.id}',${literal(first.events.map((e,i)=>i===1?{...e,ms:0}:e))})`,'INVALID_TIME')}
 ${reject(`perform public.gugudan_vertical_finish(23,'${first.id}',${literal(first.events.slice(0,-1))})`,'INCOMPLETE_RUN')}
end $$;
${sessions.map(s=>`select public.gugudan_vertical_finish(23,'${s.id}',${literal(s.events)});select public.gugudan_vertical_finish(23,'${s.id}',${literal(s.events)});`).join('\n')}
select public.gugudan_vertical_begin_cells(23,'${first.id}',5);
select public.gugudan_vertical_leaders_cells(5);select public.gugudan_vertical_leaders_cells(10);
select jsonb_build_object('publicCanExecute',exists(select 1 from (values('anon'),('authenticated')) roles(role) where has_function_privilege(role,'public.gugudan_vertical_begin_cells(integer,uuid,integer)','execute') or has_function_privilege(role,'public.gugudan_vertical_leaders_cells(integer)','execute')));
rollback;`);
for(const s of sessions){const receipts=result.filter(r=>r.id===s.id&&typeof r.score==='number');assert.equal(receipts.length,2);assert.ok(receipts.every(r=>r.score===verticalScore(s)),`${s.id}: SQL/JS mismatch`);}
assert.deepEqual(result.find(r=>r.questions).questions,first.questions);
assert.equal(result.find(r=>r.questions).tightTime,true);assert.equal(result.find(r=>r.questions).cellScoring,true);
for(const [i,count] of [5,10].entries()){
 const leaders=result.filter(Array.isArray)[i];
 const highest=Math.max(...sessions.filter(s=>s.cellScoring&&s.questions.length===count).map(verticalScore));
 assert.equal(leaders.length,1);assert.equal(leaders[0].score,highest);
}
assert.equal(result.find(r=>Object.hasOwn(r,'publicCanExecute')).publicCanExecute,false);
assert.deepEqual(snapshot(),before);
console.log(`${cases.length} SQL/JS cases: cell bands, ten-point penalties and all legacy scores, five/ten questions, three difficulties, reverse puzzle selection, retries, invalid times, auth, ranking isolation and rollback passed`);
