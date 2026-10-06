import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createVerticalSession, reduceVertical, verticalScore, verticalSteps } from '../src/game/vertical.ts';

if(process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='99dan_vertical_score_zero_20261003')throw Error('Use the isolated local zero test database');
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
function sql(query){
  const result=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:6*1024*1024});
  if(result.status!==0)throw Error(result.stderr);
  return result.stdout.trim().split('\n').filter(line=>line.startsWith('{')||line.startsWith('[')||/^\d+$/.test(line));
}
const skills=fact=>{
  const steps=verticalSteps(fact,true);
  return steps.map(step=>step.id==='tens:0'?1:step.stage!=='sum'?fact.a%10*(step.stage==='ones'?fact.b%10:Math.floor(fact.b/10))>=10?2:1:step.row==='carry-sum'||steps.some(c=>c.row==='carry-sum'&&(c.place===step.place||c.place===step.place+1))?3:1);
};
const facts=[];
for(let a=10;a<=99;a++)for(let b=10;b<=99;b++)facts.push({a,b,digits:verticalSteps({a,b},true).map(s=>s.expected),skills:skills({a,b})});
assert.equal(sql(`select count(*) from jsonb_array_elements(${literal(facts)}) f where to_jsonb(public.gugudan_vertical_cells((f->>'a')::integer,(f->>'b')::integer,true,false))<>f->'digits' or to_jsonb(public.gugudan_vertical_cells((f->>'a')::integer,(f->>'b')::integer,true,true))<>f->'skills';`).at(-1),'0');
const cases=[];
for(const manual of [false,true])for(const count of [5,10])for(const difficulty of [1,2,3])for(const timed of [false,true])cases.push({manual,count,difficulty,timed,id:crypto.randomUUID()});
const starts=sql(`begin;set local role service_role;${cases.map(c=>`select public.gugudan_teacher_set_vertical(23,${c.difficulty});select public.gugudan_vertical_begin_${c.manual?'manual':'count'}(23,'${c.id}',${c.count},${c.timed});`).join('\n')}commit;`).map(JSON.parse).filter(r=>r.id);
const sessions=starts.map((start,i)=>{
  const c=cases[i];assert.equal(start.manualZero===true,c.manual);assert.equal(start.timeScoring,c.timed);
  let session=createVerticalSession(start.difficulty,start.id,start.questions,c.timed,c.manual);
  for(const fact of session.questions){
    for(const step of verticalSteps(fact,c.manual)){
      if(step.id==='tens:0')session=reduceVertical(reduceVertical(session,{type:'input',key:'1'}),{type:'input',key:'Enter',ms:1000});
      session=reduceVertical(reduceVertical(session,{type:'input',key:String(step.expected)}),{type:'input',key:'Enter',ms:20000});
    }
    session=reduceVertical(session,{type:'next'});
  }
  return session;
});
const manual=sessions.find(s=>s.manualZero),legacy=sessions.find(s=>!s.manualZero);
const reject=(query,error)=>`begin ${query};raise exception 'Expected ${error}';exception when raise_exception then if sqlerrm<>'${error}' then raise;end if;end;`;
const skipped=manual.events.filter(e=>verticalSteps(manual.questions[e.question],true)[e.step].id!=='tens:0').map(e=>({...e,step:e.step-Number(e.step>verticalSteps(manual.questions[e.question],true).findIndex(s=>s.id==='tens:0'))}));
const output=sql(`begin;set local role service_role;
do $$ begin
 ${reject(`perform public.gugudan_vertical_begin_manual(23,'${legacy.id}',5,false)`,'RUN_MODE_CONFLICT')}
 ${reject(`perform public.gugudan_vertical_begin_manual(22,'${manual.id}',5,false)`,'RUN_CONFLICT')}
 ${reject(`perform public.gugudan_vertical_begin_manual(23,'${manual.id}',10,false)`,'RUN_COUNT_CONFLICT')}
 ${reject(`perform public.gugudan_vertical_finish(23,'${manual.id}',${literal(skipped)})`,'INVALID_SEQUENCE')}
 ${reject(`perform public.gugudan_vertical_finish(23,'${manual.id}',${literal(manual.events.slice(0,-1))})`,'INCOMPLETE_RUN')}
end $$;
${sessions.map(s=>`select public.gugudan_vertical_finish(23,'${s.id}',${literal(s.events)});select public.gugudan_vertical_finish(23,'${s.id}',${literal(s.events)});`).join('\n')}
select public.gugudan_vertical_begin_manual(23,'${manual.id}',5,true);
select skill_stats from public.gugudan_vertical_runs where id='${manual.id}';
select count(*) from (values ('anon'),('authenticated')) roles(role) where has_function_privilege(role,'public.gugudan_vertical_cells(integer,integer,boolean,boolean)','execute') or has_function_privilege(role,'public.gugudan_vertical_metrics_manual(jsonb,jsonb)','execute') or has_function_privilege(role,'public.gugudan_vertical_begin_manual(integer,uuid,integer,boolean)','execute');
rollback;`);
const parsed=output.filter(line=>line.startsWith('{')).map(JSON.parse);
for(const s of sessions){const receipts=parsed.filter(r=>r.id===s.id&&typeof r.score==='number');assert.equal(receipts.length,2);assert.ok(receipts.every(r=>r.score===verticalScore(s)));}
assert.deepEqual(parsed.find(r=>r.questions).questions,manual.questions);
const stats=parsed.find(r=>r.first);
assert.equal(stats.first.attempts,manual.events.filter(e=>e.answer!==1||verticalSteps(manual.questions[e.question],true)[e.step].id!=='tens:0').length);
assert.equal(stats.first.correct,stats.first.attempts-5);
assert.equal(output.at(-1),'0');
console.log('Manual zero PostgreSQL parity: 8,100 digit/skill sequences; 24 legacy/manual 5/10 difficulty/timing runs; wrong-zero penalties, skip rejection, persisted first-attempt metrics, idempotency and restricted grants passed');
