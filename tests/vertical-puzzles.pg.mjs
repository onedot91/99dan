import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createVerticalSession, difficultyOf, parseVerticalQuestions, parseVerticalSession, reduceVertical, verticalQuestionSteps, verticalScore, verticalSteps, withVerticalPuzzles } from '../src/game/vertical.ts';
import { verticalCounts } from '../src/game/verticalSets.ts';

if(process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='99dan_vertical_score_puzzles_20261003')throw Error('Use the isolated local puzzle test database');
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
function sql(query){
  const result=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:12*1024*1024});
  if(result.status!==0)throw Error(result.stderr);
  return result.stdout.trim().split('\n').filter(line=>line.startsWith('{')||line.startsWith('[')||/^\d+$/.test(line));
}
const facts=[];
for(let a=10;a<=99;a++)for(let b=10;b<=99;b++){
  for(const manual of [false,true])facts.push({a,b,manual,ids:verticalSteps({a,b},manual).map(s=>s.id)});
}
assert.equal(sql(`select count(*) from jsonb_array_elements(${literal(facts)}) f where to_jsonb(public.gugudan_vertical_cell_ids((f->>'a')::integer,(f->>'b')::integer,(f->>'manual')::boolean))<>f->'ids';`).at(-1),'0');
const holeFacts=[];
for(let a=10;a<=99;a++)for(let b=10;b<=99;b++)for(const difficulty of [2,3]){
  const fact=withVerticalPuzzles(Array(10).fill({a,b}),difficulty,()=>.9).find(f=>f.holes);
  holeFacts.push({fact,digits:verticalQuestionSteps(fact,true).map(s=>s.expected)});
}
assert.equal(sql(`select count(*) from jsonb_array_elements(${literal(holeFacts)}) f where to_jsonb(public.gugudan_vertical_question_cells(f->'fact',true,false))<>f->'digits';`).at(-1),'0');
const cases=[];
for(const mode of ['count','manual','puzzles'])for(const count of [5,10])for(const difficulty of [1,2,3])for(const timed of [false,true])cases.push({mode,puzzles:mode==='puzzles',manual:mode!=='count',count,difficulty,timed,id:crypto.randomUUID()});
const starts=sql(`begin;set local role service_role;${cases.map(c=>`select public.gugudan_teacher_set_vertical(23,${c.difficulty});select public.gugudan_vertical_begin_${c.mode}(23,'${c.id}',${c.count},${c.timed});`).join('\n')}commit;`).map(JSON.parse).filter(r=>r.id);
const sessions=starts.map((start,i)=>{
  const c=cases[i];assert.deepEqual(parseVerticalQuestions(start.questions,c.difficulty,c.count,c.puzzles),start.questions);
  assert.deepEqual([1,2,3].map(kind=>start.questions.filter(f=>difficultyOf(f)===kind).length),verticalCounts(c.difficulty,c.count));
  let session=createVerticalSession(start.difficulty,start.id,start.questions,c.timed,c.manual);
  for(const fact of session.questions){
    const steps=verticalQuestionSteps(fact,c.manual),order=steps.map((_,i)=>i);if(fact.holes)order.reverse();
    for(const index of order){
      if(fact.holes)session=reduceVertical(session,{type:'select',step:index});
      const submit=(digit,ms)=>{session=reduceVertical(reduceVertical(session,{type:'input',key:String(digit)}),{type:'input',key:'Enter',ms});};
      if(fact.holes&&index===0)submit((steps[index].expected+1)%10,1000);
      submit(steps[index].expected,20000);
    }
    session=reduceVertical(session,{type:'next'});
  }
  assert.deepEqual(parseVerticalSession(session),session);return session;
});
const manual=sessions.find(s=>s.difficulty===3&&s.questions.some(f=>f.holes)&&s.timeScoring),old=sessions.find(s=>s.difficulty===3&&s.questions.length===10&&!s.manualZero);
const q=manual.questions.findIndex(f=>f.holes),firstHole=manual.events.find(e=>e.question===q);
const reject=(query,error)=>`begin ${query};raise exception 'Expected ${error}';exception when raise_exception then if sqlerrm<>'${error}' then raise;end if;end;`;
const duplicate=[...manual.events.slice(0,manual.events.indexOf(firstHole)+1),firstHole,...manual.events.slice(manual.events.indexOf(firstHole)+1)];
const decreasing=manual.events.map(event=>event.question===q&&event.step===0&&event.answer===verticalQuestionSteps(manual.questions[q],true)[0].expected?{...event,ms:999}:event);
const stats={first:{attempts:0,correct:0},multiply:{attempts:0,correct:0},sum:{attempts:0,correct:0}};
const seen=new Set();
for(const event of manual.events){
  const key=`${event.question}:${event.step}`;if(seen.has(key))continue;seen.add(key);
  const fact=manual.questions[event.question],steps=verticalSteps(fact,true),step=verticalQuestionSteps(fact,true)[event.step];
  const skill=step.id==='tens:0'?1:step.stage!=='sum'?fact.a%10*(step.stage==='ones'?fact.b%10:Math.floor(fact.b/10))>=10?2:1:step.row==='carry-sum'||steps.some(c=>c.row==='carry-sum'&&(c.place===step.place||c.place===step.place+1))?3:1;
  const correct=event.answer===step.expected;stats.first.attempts++;stats.first.correct+=Number(correct);
  if(skill>1){const target=skill===2?stats.multiply:stats.sum;target.attempts++;target.correct+=Number(correct);}
}
const results=sql(`begin;set local role service_role;
do $$ begin
 ${reject(`perform public.gugudan_vertical_finish(23,'${manual.id}',${literal(duplicate)})`,'INVALID_SEQUENCE')}
 ${reject(`perform public.gugudan_vertical_finish(23,'${manual.id}',${literal(decreasing)})`,'INVALID_TIME')}
 ${reject(`perform public.gugudan_vertical_finish(23,'${manual.id}',${literal(manual.events.slice(0,-1))})`,'INCOMPLETE_RUN')}
 ${reject(`perform public.gugudan_vertical_begin_puzzles(23,'${old.id}',10,false)`,'RUN_MODE_CONFLICT')}
 ${reject(`perform public.gugudan_vertical_begin_puzzles(22,'${manual.id}',10,true)`,'RUN_CONFLICT')}
 ${reject(`perform public.gugudan_vertical_begin_puzzles(23,'${manual.id}',5,true)`,'RUN_COUNT_CONFLICT')}
end $$;
${sessions.map(s=>`select public.gugudan_vertical_finish(23,'${s.id}',${literal(s.events)});select public.gugudan_vertical_finish(23,'${s.id}',${literal(s.events)});`).join('\n')}
select public.gugudan_vertical_begin_puzzles(23,'${manual.id}',10,false);
select skill_stats from public.gugudan_vertical_runs where id='${manual.id}';
select count(*) from (values ('anon'),('authenticated')) roles(role) where has_function_privilege(role,'public.gugudan_vertical_begin_puzzles(integer,uuid,integer,boolean)','execute') or has_function_privilege(role,'public.gugudan_vertical_question_cells(jsonb,boolean,boolean)','execute');
rollback;`);
const parsed=results.filter(line=>line.startsWith('{')).map(JSON.parse);
for(const s of sessions){const receipts=parsed.filter(r=>r.id===s.id&&typeof r.score==='number');assert.equal(receipts.length,2);assert.ok(receipts.every(r=>r.score===verticalScore(s)));}
assert.deepEqual(parsed.find(r=>r.questions).questions,manual.questions);assert.deepEqual(parsed.find(r=>r.first),stats);assert.equal(results.at(-1),'0');
console.log('Puzzle PostgreSQL parity: 8,100 legacy/manual IDs; 16,200 two/three-hole descriptors; 36 mixed/legacy/manual 5/10 difficulty/timing runs; reverse-order answers, penalties, duplicate/incomplete/decreasing-time rejection, idempotency, persisted metrics and role restrictions passed');
