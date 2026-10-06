import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createVerticalSession, difficultyOf, parseVerticalQuestions, parseVerticalSession, reduceVertical, verticalQuestionSteps, verticalScore, withVerticalPuzzles } from '../src/game/vertical.ts';
import { verticalCounts } from '../src/game/verticalSets.ts';
if(process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='99dan_vertical_variety_20261003')throw Error('Use the isolated local variety database');
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
function sql(query){const r=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim().split('\n').filter(l=>l.startsWith('{')||l.startsWith('[')||/^\d+$/.test(l));}
const holeFacts=[];
for(let a=10;a<=99;a++)for(let b=10;b<=99;b++){
 for(const fact of withVerticalPuzzles(Array(10).fill({a,b}),3,()=>.9,true).filter(f=>f.holes?.[0].startsWith('operand-'))){
   holeFacts.push({fact,digits:verticalQuestionSteps(fact,true).map(s=>s.expected)});
 }
}
assert.equal(sql(`select count(*) from jsonb_array_elements(${literal(holeFacts)}) f where to_jsonb(public.gugudan_vertical_question_cells(f->'fact',true,false))<>f->'digits';`).at(-1),'0');
const cases=[];
for(const mode of ['variety','puzzles','manual'])for(const count of [5,10])for(const difficulty of [1,2,3])for(const timed of [false,true])cases.push({mode,count,difficulty,timed,id:crypto.randomUUID()});
const starts=sql(`begin;set local role service_role;${cases.map(c=>`select public.gugudan_teacher_set_vertical(23,${c.difficulty});select public.gugudan_vertical_begin_${c.mode}(23,'${c.id}',${c.count},${c.timed});`).join('\n')}commit;`).map(JSON.parse).filter(r=>r.id);
assert.equal(starts.length,cases.length);
const sessions=starts.map((start,i)=>{
 const c=cases[i];assert.deepEqual(parseVerticalQuestions(start.questions,c.difficulty,c.count,c.mode!=='manual',c.mode==='variety'),start.questions);
 assert.deepEqual([1,2,3].map(kind=>start.questions.filter(f=>difficultyOf(f)===kind).length),verticalCounts(c.difficulty,c.count));
 if(c.mode==='variety'){assert.equal(start.puzzleOperands,true);assert.ok(start.questions.filter(f=>f.b%10===0).length<=1);}
 let s=createVerticalSession(c.difficulty,start.id,start.questions,c.timed,true);
 for(const fact of start.questions){
   const steps=verticalQuestionSteps(fact,true),order=steps.map((_,i)=>i);if(fact.holes)order.reverse();
   for(const index of order){
     if(fact.holes)s=reduceVertical(s,{type:'select',step:index});
     if(steps[index].row.startsWith('operand-'))s=reduceVertical(reduceVertical(s,{type:'input',key:String((steps[index].expected+1)%10)}),{type:'input',key:'Enter',ms:1000});
     s=reduceVertical(reduceVertical(s,{type:'input',key:String(steps[index].expected)}),{type:'input',key:'Enter',ms:10000});
   }
   s=reduceVertical(s,{type:'next'});
 }
 assert.deepEqual(parseVerticalSession(s),s);return s;
});
const newest=sessions.find(s=>s.difficulty===3&&s.timeScoring&&s.questions.some(f=>f.holes?.[0].startsWith('operand-')));
const firstCorrect=newest.events.findIndex(e=>e.answer===verticalQuestionSteps(newest.questions[e.question],true)[e.step].expected);
const duplicate=[...newest.events.slice(0,firstCorrect+1),newest.events[firstCorrect],...newest.events.slice(firstCorrect+1)];
const results=sql(`begin;set local role service_role;
do $$ begin
 begin perform public.gugudan_vertical_finish(23,'${newest.id}',${literal(duplicate)});raise exception 'DUPLICATE_ACCEPTED';exception when others then if sqlerrm<>'INVALID_SEQUENCE' then raise;end if;end;
 begin perform public.gugudan_vertical_finish(23,'${newest.id}',${literal(newest.events.slice(0,-1))});raise exception 'INCOMPLETE_ACCEPTED';exception when others then if sqlerrm<>'INCOMPLETE_RUN' then raise;end if;end;
end $$;
${sessions.map(s=>`select public.gugudan_vertical_finish(23,'${s.id}',${literal(s.events)});select public.gugudan_vertical_finish(23,'${s.id}',${literal(s.events)});`).join('\n')}
select public.gugudan_vertical_begin_variety(23,'${newest.id}',10,true);
select skill_stats from public.gugudan_vertical_runs where id='${newest.id}';
select count(*) from (values ('anon'),('authenticated')) roles(role) where has_function_privilege(role,'public.gugudan_vertical_begin_variety(integer,uuid,integer,boolean)','execute');
rollback;`).filter(l=>l.startsWith('{')).map(JSON.parse);
for(const s of sessions){const receipts=results.filter(r=>r.id===s.id&&typeof r.score==='number');assert.equal(receipts.length,2);assert.ok(receipts.every(r=>r.score===verticalScore(s)));}
assert.deepEqual(results.find(r=>r.questions).questions,newest.questions);
assert.equal(results.find(r=>r.first).first.attempts,newest.questions.reduce((n,f)=>n+verticalQuestionSteps(f,true).length,0));
const sampling=sql(`select setseed(.1234);select jsonb_build_object('difficulty',d,'count',c,'zeros',(select count(*) from jsonb_array_elements(public.gugudan_vertical_questions_variety(d,c)) f where (f->>'b')::integer%10=0)) from generate_series(1,3) d cross join (values(5),(10)) counts(c) cross join generate_series(1,40) sample;`).map(JSON.parse);
for(const difficulty of [1,2,3])for(const count of [5,10]){const sampled=sampling.filter(r=>r.difficulty===difficulty&&r.count===count);assert.ok(sampled.every(r=>r.zeros<=1));const n=sampled.filter(r=>r.zeros===1).length;assert.ok(n>0&&n<28,`${difficulty}/${count}: ${n}/40 zero sets`);}
console.log(`Variety SQL parity: ${holeFacts.length} operand-hole descriptors, 36 new/previous puzzle/manual scoring cases, wrong penalties, replay, retries, duplicate/incomplete rejection and 240 zero-cap samples passed`);
