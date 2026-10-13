import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { blockScore, replayBlockRun } from '../src/game/blockRun.ts';
import { playBlockRun } from './block-player.mjs';
// 격리된 DB에서만 실행한다: psql -f tests/block-bootstrap.sql로 만든 DB.
if(process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='55436'||process.env.PGDATABASE!=='99dan_block_20261012')throw Error('Use the isolated block test database');
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
function sql(query){
 const r=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:16*1024*1024});
 if(r.status!==0)throw Error(r.stderr);
 return r.stdout.trim().split('\n').filter(line=>line.startsWith('{')||line.startsWith('[')).map(JSON.parse);
}
const snapshot=()=>sql(`select jsonb_build_object('players',md5(coalesce((select jsonb_agg(to_jsonb(p) order by student_number)::text from public.gugudan_players p),'')),'vertical',md5(coalesce((select jsonb_agg(to_jsonb(v) order by id)::text from public.gugudan_vertical_runs v),'')),'blocks',(select count(*) from public.gugudan_block_runs));`)[0];
const before=snapshot();
assert.equal(before.blocks,0,'start from an empty block table');

// 1) 시작: 학생 21·22·23이 여러 판을 시작한다(커밋). 같은 ID 재시도는 같은 시드다.
const plan=[{student:23,stopAfter:Infinity},{student:23,stopAfter:4},{student:23,stopAfter:0},{student:22,stopAfter:Infinity},{student:22,stopAfter:7},{student:21,stopAfter:3},{student:21,stopAfter:Infinity}].map(p=>({...p,id:crypto.randomUUID()}));
const starts=sql(`begin;set local role service_role;${plan.map(p=>`select public.gugudan_block_begin(${p.student},'${p.id}');select public.gugudan_block_begin(${p.student},'${p.id}');`).join('\n')}commit;`);
// 검사가 실패해도 커밋한 시작 기록을 지운다.
process.on('exit',code=>{if(code)sql(`delete from public.gugudan_block_runs where id in (${plan.map(p=>`'${p.id}'`).join(',')});`);});
assert.equal(starts.length,plan.length*2);
plan.forEach((p,i)=>{assert.equal(starts[i*2].id,p.id);assert.equal(starts[i*2+1].seed,starts[i*2].seed,'retried start keeps the seed');assert.ok(Number.isInteger(starts[i*2].seed)&&starts[i*2].seed>=0&&starts[i*2].seed<2**32);p.seed=starts[i*2].seed;});
assert.ok(new Set(plan.map(p=>p.seed)).size>1,'seeds are random per run');
// Edge Function과 같은 방식: 시드를 읽어 재생하고 점수·해시를 만든다.
for(const p of plan){
 const played=playBlockRun(p.seed,{stopAfter:p.stopAfter});
 const run=replayBlockRun(p.seed,played.answers,played.moves,played.ended);
 assert.ok(run);
 p.run=run;p.hash=createHash('sha256').update(JSON.stringify({ended:run.ended,answers:played.answers,moves:played.moves})).digest('hex');
 p.call=(hash=p.hash,seed=p.seed,student=p.student)=>`public.gugudan_block_finish(${student},'${p.id}',${seed},'${hash}','${run.ended}',${blockScore(run)},${run.solved},${run.mistakes},${run.lines},${literal(played.answers)},${literal(played.moves)})`;
}
const [first]=plan,open=plan.find(p=>p.stopAfter===0);
const reject=(statement,error)=>`begin ${statement};raise exception 'ACCEPTED_INVALID';exception when others then if sqlerrm<>'${error}' then raise;end if;end;`;

// 2) 끝·재시도·거부·순위·경험치·교사 기록·초기화를 한 트랜잭션에서 검사하고 되돌린다.
const finished=plan.filter(p=>p!==open);
const result=sql(`begin;set local role service_role;
do $$ begin
 ${reject(`perform public.gugudan_block_begin(22,'${first.id}')`,'RUN_CONFLICT')}
 ${reject(`perform public.gugudan_block_begin(0,'${crypto.randomUUID()}')`,'INVALID_RUN')}
 ${reject(`perform public.gugudan_block_seed(22,'${first.id}')`,'RUN_NOT_FOUND')}
 ${reject(`perform ${first.call(first.hash,first.seed,22)}`,'RUN_NOT_FOUND')}
 ${reject(`perform ${first.call(first.hash,first.seed+1)}`,'RUN_SEED_MISMATCH')}
 ${reject(`perform ${first.call('not-a-hash')}`,'INVALID_RUN')}
 ${reject(`perform public.gugudan_block_finish(23,'${first.id}',${first.seed},'${first.hash}','won',1,0,0,0,'[]','[]')`,'INVALID_RUN')}
 ${reject(`perform public.gugudan_block_finish(23,'${first.id}',${first.seed},'${first.hash}','stuck',-1,0,0,0,'[]','[]')`,'INVALID_RUN')}
end $$;
select public.gugudan_block_seed(23,'${first.id}');
${finished.map(p=>`select ${p.call()};select ${p.call()};`).join('\n')}
do $$ begin ${reject(`perform ${first.call('0'.repeat(64))}`,'RUN_ALREADY_FINISHED')} end $$;
select jsonb_build_object('leaders',public.gugudan_block_leaders());
select jsonb_build_object('records23',public.gugudan_block_records(23),'records20',public.gugudan_block_records(20));
select jsonb_build_object('profile',public.gugudan_profile(23));
select jsonb_build_object('teacher',public.gugudan_teacher_block_records());
-- 학생 21의 판을 8일 전으로 옮기면 순위에서 빠지지만 경험치는 남는다.
update public.gugudan_block_runs set finished_at=now()-interval '8 days' where student_number=21;
select jsonb_build_object('weekly',public.gugudan_block_leaders(),'exp21',public.gugudan_block_exp(21));
-- 마이그레이션 전에 시작한 판은 저장된 문제당 20을 그대로 쓴다.
update public.gugudan_block_runs set exp_per_question=20 where id='${plan.find(p=>p.student===22&&p.stopAfter===Infinity).id}';
select jsonb_build_object('exp22',public.gugudan_block_exp(22));
-- 경험치가 펫 한도에 들어간다: 21번은 구구단 기록이 없어도 블록 경험치만큼 레벨이 오른다.
select jsonb_build_object('friendsSaved',(select count(*) from (select public.gugudan_save_friends(21,'["cat"]'::jsonb,'cat')) saved));
do $$ begin ${reject(`perform public.gugudan_teacher_reset_scoped(23,'["block","blocks"]')`,'INVALID_RESET_SCOPES')} ${reject(`perform public.gugudan_teacher_reset_scoped(23,'["block","block"]')`,'INVALID_RESET_SCOPES')} end $$;
select public.gugudan_teacher_reset_scoped(23,'["block"]');select public.gugudan_teacher_reset_scoped(23,'["block"]');
select jsonb_build_object('afterScoped',(select jsonb_object_agg(student_number,n) from (select student_number,count(*) n from public.gugudan_block_runs group by student_number) c),'open23',(select finished_at is null from public.gugudan_block_runs where id='${open.id}'));
select public.gugudan_teacher_reset(22);
select jsonb_build_object('afterOne',(select jsonb_object_agg(student_number,n) from (select student_number,count(*) n from public.gugudan_block_runs group by student_number) c));
select public.gugudan_teacher_reset_all();
select jsonb_build_object('afterAll',(select count(*) from public.gugudan_block_runs where finished_at is not null),'leftOpen',(select count(*) from public.gugudan_block_runs));
select jsonb_build_object('publicCanExecute',exists(select 1 from (values('anon'),('authenticated')) roles(role),(values
 ('public.gugudan_block_begin(integer,uuid)'),('public.gugudan_block_seed(integer,uuid)'),('public.gugudan_block_finish(integer,uuid,bigint,text,text,integer,integer,integer,integer,jsonb,jsonb)'),
 ('public.gugudan_block_leaders()'),('public.gugudan_block_exp(integer)'),('public.gugudan_block_records(integer)'),('public.gugudan_teacher_block_records()')) fns(fn) where has_function_privilege(role,fn,'execute')),
 'publicCanRead',exists(select 1 from (values('anon'),('authenticated')) roles(role) where has_table_privilege(role,'public.gugudan_block_runs','select')),
 'rls',(select relrowsecurity from pg_class where oid='public.gugudan_block_runs'::regclass));
rollback;`);
const pick=key=>result.find(r=>r&&!Array.isArray(r)&&Object.hasOwn(r,key))?.[key];
assert.deepEqual(result.find(r=>r.seed!==undefined&&r.score===undefined),{id:first.id,seed:first.seed});
for(const p of finished){
 const receipts=result.filter(r=>r.id===p.id&&r.score!==undefined);
 assert.equal(receipts.length,2,`${p.id} finish and retry`);
 assert.deepEqual(receipts[1],receipts[0]);
 assert.deepEqual(receipts[0],{id:p.id,score:blockScore(p.run),solved:p.run.solved,lines:p.run.lines,ended:p.run.ended});
}
const best=student=>Math.max(...finished.filter(p=>p.student===student).map(p=>blockScore(p.run)));
const solvedOf=student=>finished.filter(p=>p.student===student).reduce((sum,p)=>sum+p.run.solved,0);
const expected=[21,22,23].map(n=>({n,score:best(n)})).sort((a,b)=>b.score-a.score);
assert.deepEqual(pick('leaders').map(r=>[r.studentNumber,r.score]),expected.map(e=>[e.n,e.score]));
assert.deepEqual(pick('records23'),{best:best(23),runs:finished.filter(p=>p.student===23).length});
assert.deepEqual(pick('records20'),{best:null,runs:0});
assert.equal(pick('profile').blockExp,solvedOf(23)*10);
const teacher=pick('teacher');
assert.equal(teacher.length,23);
assert.equal(teacher[22].blockExp,solvedOf(23)*10);
assert.equal(teacher[22].blockSessions.length,finished.filter(p=>p.student===23).length,'only finished runs are listed');
assert.deepEqual(teacher[19],{studentNumber:20,blockExp:0,verticalExp:0,blockSessions:[]});
assert.deepEqual(pick('weekly').map(r=>r.studentNumber),expected.filter(e=>e.n!==21).map(e=>e.n));
assert.equal(pick('exp21'),solvedOf(21)*10);
assert.equal(pick('exp22'),solvedOf(22)*10+plan.find(p=>p.student===22&&p.stopAfter===Infinity).run.solved*10,'an old run keeps 20 per question');
assert.equal(pick('friendsSaved'),1);
assert.deepEqual(pick('afterScoped'),{21:2,22:2,23:1});
assert.equal(pick('open23'),true,'scoped reset keeps the unfinished run');
assert.deepEqual(pick('afterOne'),{21:2,23:1});
assert.equal(pick('afterAll'),0);assert.equal(pick('leftOpen'),1);
assert.equal(pick('publicCanExecute'),false);assert.equal(pick('publicCanRead'),false);assert.equal(pick('rls'),true);
// 시작한 판(커밋된 시드)만 남아 있다. 지우고 나면 처음과 같다.
sql(`delete from public.gugudan_block_runs where id in (${plan.map(p=>`'${p.id}'`).join(',')});`);
assert.deepEqual(snapshot(),before);
console.log(`${plan.length} block runs: seed issue/retry, server-replayed finish/retry, conflicts, hall of fame and 7-day window, exp and friend limit, teacher records, scoped/one/all resets and roles passed; fixture changes removed`);
