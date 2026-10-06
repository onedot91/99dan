import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createVerticalSession, difficultyOf, parseVerticalQuestions, reduceVertical, verticalScore, verticalSteps } from '../src/game/vertical.ts';
import { VERTICAL_SETS } from '../src/game/verticalSets.ts';

if(process.env.PGHOST!=='127.0.0.1'||!process.env.PGDATABASE?.startsWith('99dan_vertical_score_'))throw Error('Use an isolated local score test database');
function sql(query){
  const result=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:4*1024*1024});
  if(result.status!==0)throw Error(result.stderr);
  return result.stdout.trim().split('\n').filter(line=>line.startsWith('{')||line.startsWith('[')||/^\d+$/.test(line));
}
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const facts=[];
for(let a=10;a<=99;a++)for(let b=10;b<=99;b++)facts.push({a,b,kind:difficultyOf({a,b}),digits:verticalSteps({a,b}).map(step=>step.expected)});
assert.equal(sql(`select count(*) from jsonb_array_elements(${literal(facts)}) f where to_jsonb(public.gugudan_vertical_digits((f->>'a')::integer,(f->>'b')::integer))<>f->'digits' or public.gugudan_vertical_kind((f->>'a')::integer,(f->>'b')::integer)<>(f->>'kind')::integer;`).at(-1),'0');
for(const set of VERTICAL_SETS){
 const draws=JSON.parse(sql(`select jsonb_agg(public.gugudan_vertical_questions(${set.id})) from generate_series(1,20);`).at(-1));
 assert.ok(new Set(draws.map(JSON.stringify)).size>1);
 for(const questions of draws)assert.deepEqual(parseVerticalQuestions(questions,set.id),questions);
}

function completed(start,wrong=0){
  let session=createVerticalSession(start.difficulty,start.id,start.questions);
  for(let i=0;i<5;i++){
    const steps=verticalSteps(session.questions[i]);
    if(i===0)for(let j=0;j<wrong;j++)session=reduceVertical(reduceVertical(session,{type:'input',key:String((steps[0].expected+1)%10)}),{type:'input',key:'Enter'});
    for(const step of steps)session=reduceVertical(reduceVertical(session,{type:'input',key:String(step.expected)}),{type:'input',key:'Enter'});
    session=reduceVertical(session,{type:'next'});
  }
  return session;
}
const starts=sql(`begin;set local role service_role;
 select public.gugudan_teacher_set_vertical(20,1);
 select public.gugudan_vertical_begin(20,'${crypto.randomUUID()}');
 select public.gugudan_teacher_set_vertical(21,2);
 select public.gugudan_vertical_begin(21,'${crypto.randomUUID()}');
 select public.gugudan_teacher_set_vertical(22,3);
 select public.gugudan_vertical_begin(22,'${crypto.randomUUID()}');
 select public.gugudan_teacher_set_vertical(20,3);
 select public.gugudan_vertical_begin(20,'${crypto.randomUUID()}');commit;`).map(JSON.parse).filter(value=>value.id);
const clean=completed(starts[0]),wrong=completed(starts[1],2),floor=completed(starts[2],40),other=completed(starts[3],1);
const begin=(student,session)=>`select public.gugudan_vertical_begin(${student},'${session.id}');`;
const finish=(student,session)=>`select public.gugudan_vertical_finish(${student},'${session.id}',${literal(session.events)});`;
const reject=(statement,error)=>`begin ${statement} raise exception 'Expected ${error}'; exception when raise_exception then if sqlerrm<>'${error}' then raise; end if; end;`;
const result=sql(`begin; set local role service_role;
select public.gugudan_teacher_set_vertical(20,1);
${begin(20,clean)}
select public.gugudan_teacher_set_vertical(20,3);
${begin(20,clean)}
do $$ begin
 ${reject(`perform public.gugudan_vertical_begin(21,'${clean.id}');`,'RUN_CONFLICT')}
 ${reject(`perform public.gugudan_vertical_finish(21,'${clean.id}',${literal(clean.events)});`,'RUN_NOT_FOUND')}
 ${reject(`perform public.gugudan_vertical_finish(20,'${clean.id}',${literal(clean.events.slice(0,-1))});`,'INCOMPLETE_RUN')}
 ${reject(`perform public.gugudan_vertical_finish(20,'${clean.id}',${literal([{question:1,step:0,answer:0},...clean.events])});`,'INVALID_SEQUENCE')}
end $$;
${finish(20,clean)}
${finish(20,clean)}
do $$ begin
 ${reject(`perform public.gugudan_vertical_finish(20,'${clean.id}',${literal(clean.events.slice(1))});`,'RUN_ALREADY_FINISHED')}
end $$;
select public.gugudan_teacher_set_vertical(21,2);
${begin(21,wrong)} ${finish(21,wrong)}
select public.gugudan_teacher_set_vertical(22,3);
${begin(22,floor)} ${finish(22,floor)}
${begin(20,other)} ${finish(20,other)}
select public.gugudan_vertical_leaders();
do $$ begin
 if (select difficulty from public.gugudan_vertical_runs where id='${clean.id}')<>1 then raise exception 'Assignment snapshot changed'; end if;
 if (select questions from public.gugudan_vertical_runs where id='${clean.id}')<>${literal(clean.questions)} then raise exception 'Retry changed random questions'; end if;
 if (select count(*) from public.gugudan_vertical_runs where id='${clean.id}')<>1 then raise exception 'Retry duplicated run'; end if;
 if jsonb_array_length(public.gugudan_vertical_leaders())<>3 then raise exception 'Wrong combined ranking size'; end if;
 if public.gugudan_vertical_leaders()->0->>'score'<>'1000' then raise exception 'Lower score in another set replaced best'; end if;
end $$;
update public.gugudan_vertical_runs set finished_at=now()-interval '8 days' where id='${clean.id}';
select public.gugudan_vertical_leaders();
do $$ begin if public.gugudan_vertical_leaders()->0->>'score'<>'970' then raise exception 'Expired score ranked instead of current score in another set'; end if; end $$;
insert into public.gugudan_vertical_runs(id,student_number,difficulty,questions,finished_at,score,mistakes)
select gen_random_uuid(),n,1,public.gugudan_vertical_questions(1),clock_timestamp(),600,0 from generate_series(1,6) n;
do $$ begin
 if jsonb_array_length(public.gugudan_vertical_leaders())<>5 then raise exception 'Combined ranking exceeded five students'; end if;
 if public.gugudan_vertical_leaders()->0->>'studentNumber'<>'20' then raise exception 'Combined ranking order changed'; end if;
end $$;
select public.gugudan_vertical_begin(21,'11111111-1111-4111-8111-111111111111');
select public.gugudan_teacher_reset(21);
do $$ begin
 if exists(select from public.gugudan_vertical_runs where student_number=21 and finished_at is not null) then raise exception 'Reset retained score'; end if;
 if not exists(select from public.gugudan_vertical_runs where id='11111111-1111-4111-8111-111111111111' and finished_at is null) then raise exception 'Reset broke unfinished practice'; end if;
 if public.gugudan_vertical_assignment(21)->>'difficulty'<>'2' then raise exception 'Reset removed assignment'; end if;
 if not exists(select from public.gugudan_vertical_runs where student_number=22) then raise exception 'Reset changed another student'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.gugudan_vertical_runs; raise exception 'Public score access'; exception when insufficient_privilege then null; end;
 begin perform public.gugudan_vertical_begin(1,gen_random_uuid()); raise exception 'Public begin access'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
do $$ begin
 begin perform public.gugudan_vertical_finish(1,gen_random_uuid(),'[]'); raise exception 'Direct scoring access'; exception when insufficient_privilege then null; end;
 begin perform public.gugudan_vertical_leaders(); raise exception 'Direct ranking access'; exception when insufficient_privilege then null; end;
end $$;
rollback;`);
for(const session of [clean,wrong,floor,other]){
  const receipts=result.map(JSON.parse).filter(value=>value.id===session.id&&typeof value.score==='number');
  assert.ok(receipts.length);assert.ok(receipts.every(value=>value.score===verticalScore(session)));
}
const ranks=result.map(JSON.parse).filter(Array.isArray);
assert.deepEqual(ranks.map(rows=>rows.map(row=>[row.studentNumber,row.score,row.correct])),[[[20,1000,5],[21,940,5],[22,0,5]],[[20,970,5],[21,940,5],[22,0,5]]]);
console.log('PostgreSQL parity: 8,100 products and carry kinds; random sets and mixes, combined ranking, top five, scoring, retry, question snapshot, expiry, reset and role restrictions passed');
