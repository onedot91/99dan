import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createVerticalSession, reduceVertical, verticalScore, verticalSteps } from '../src/game/vertical.ts';

if(process.env.PGHOST!=='127.0.0.1'||!process.env.PGDATABASE?.startsWith('99dan_vertical_score_'))throw Error('Use an isolated local score test database');
function sql(query){
  const result=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:4*1024*1024});
  if(result.status!==0)throw Error(result.stderr);
  return result.stdout.trim().split('\n').filter(line=>line.startsWith('{')||/^\d+$/.test(line));
}
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const reject=(events,error)=>`begin perform public.gugudan_vertical_finish(23,'${validation.id}',${literal(events)}); raise exception 'Expected ${error}'; exception when raise_exception then if sqlerrm<>'${error}' then raise; end if; end;`;
function complete(start,ms,wrong=false){
  let session=createVerticalSession(start.difficulty,start.id,start.questions,start.timeScoring===true);
  for(let q=0;q<5;q++){
    const steps=verticalSteps(session.questions[q]);
    if(wrong&&q===0)session=reduceVertical(reduceVertical(session,{type:'input',key:String((steps[0].expected+1)%10)}),{type:'input',key:'Enter',ms:1000});
    for(const [index,step] of steps.entries())session=reduceVertical(reduceVertical(session,{type:'input',key:String(step.expected)}),{type:'input',key:'Enter',ms:typeof ms==='function'?ms(q,index):ms});
    session=reduceVertical(session,{type:'next'});
  }
  return session;
}
const cases=[];
for(const difficulty of [1,2,3])for(const ms of [0,4999,5000,10000,20000,1000000000])cases.push({difficulty,ms});
cases.push({difficulty:1,ms:(_q,i)=>i%2?20000:0},{difficulty:2,ms:1500,wrong:true},{difficulty:3,ms:20000,wrong:true});
const starts=sql(`begin;set local role service_role;${cases.map(c=>`select public.gugudan_teacher_set_vertical(23,${c.difficulty});select public.gugudan_vertical_begin_timed(23,'${crypto.randomUUID()}');`).join('\n')}select public.gugudan_vertical_begin_timed(23,'${crypto.randomUUID()}');select public.gugudan_vertical_begin(23,'${crypto.randomUUID()}');commit;`).map(JSON.parse).filter(r=>r.id);
const validation=starts.at(-2),legacy=starts.at(-1);
assert.equal(legacy.timeScoring,false);
const sessions=cases.map((c,i)=>{assert.equal(starts[i].timeScoring,true);return complete(starts[i],c.ms,c.wrong);});
const valid=complete(validation,7000,true);
const decreasing=valid.events.map((e,i)=>i===1?{...e,ms:500}:e);
const invalid=[undefined,null,-1,1.5,'7000',1000000001].map(ms=>valid.events.map((e,i)=>i===0?{...e,ms}:e));
const results=sql(`begin;set local role service_role;
do $$ begin
 ${invalid.map(events=>reject(events,'INVALID_TIME')).join('\n')}
 ${reject(decreasing,'INVALID_TIME')}
 ${reject(valid.events.slice(0,-1),'INCOMPLETE_RUN')}
end $$;
${sessions.map(s=>`select public.gugudan_vertical_finish(23,'${s.id}',${literal(s.events)});select public.gugudan_vertical_finish(23,'${s.id}',${literal(s.events)});`).join('\n')}
select public.gugudan_vertical_finish(23,'${valid.id}',${literal(valid.events)});
select public.gugudan_vertical_finish(23,'${legacy.id}',${literal(complete(legacy,0).events)});
select public.gugudan_vertical_begin_timed(23,'${legacy.id}');
select public.gugudan_vertical_begin(23,'${valid.id}');
do $$ begin
 if (select score from public.gugudan_vertical_runs where id='${legacy.id}')<>1000 then raise exception 'Legacy score changed'; end if;
 if (select scoring_version from public.gugudan_vertical_runs where id='${legacy.id}')<>1 then raise exception 'Legacy upgraded'; end if;
 if (select questions from public.gugudan_vertical_runs where id='${valid.id}')<>${literal(valid.questions)} then raise exception 'Questions changed on retry'; end if;
end $$;
set local role anon;
do $$ begin begin perform public.gugudan_vertical_begin_timed(1,gen_random_uuid());raise exception 'Public timed access';exception when insufficient_privilege then null;end;end $$;
set local role authenticated;
do $$ begin begin perform public.gugudan_vertical_begin_timed(1,gen_random_uuid());raise exception 'Direct timed access';exception when insufficient_privilege then null;end;end $$;
rollback;`).map(JSON.parse);
for(const session of [...sessions,valid]){
  const receipts=results.filter(r=>r.id===session.id&&typeof r.score==='number');
  assert.ok(receipts.length);assert.ok(receipts.every(r=>r.score===verticalScore(session)));
}
assert.equal(results.find(r=>r.id===legacy.id&&r.timeScoring!==undefined).timeScoring,false);
assert.equal(results.find(r=>r.id===valid.id&&r.timeScoring!==undefined).timeScoring,true);
console.log('Cell-time PostgreSQL parity: 21 timed cases, retries, caps, carry normalization, invalid times, legacy compatibility, identity snapshot and role restrictions passed');
