import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { replayStairsRun, stairsScore } from '../src/game/stairsRun.ts';
import { playStairsRun } from './stairs-player.mjs';
// 격리된 DB에서만 실행한다: tests/block-bootstrap.sql 뒤에 teacher_bests·stairs_runs 마이그레이션을 적용한 DB(supabase/README.md 참고).
if(process.env.PGDATABASE!=='stairs_test')throw Error('Use the isolated stairs test database (PGDATABASE=stairs_test)');
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
function sql(query){
 const r=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:16*1024*1024});
 if(r.status!==0)throw Error(r.stderr);
 return r.stdout.trim().split('\n').filter(line=>line.startsWith('{')||line.startsWith('[')).map(JSON.parse);
}
const fails=query=>{const r=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8'});return r.status===0?null:r.stderr;};
assert.equal(sql(`select jsonb_build_object('n',(select count(*) from public.gugudan_stairs_runs));`)[0].n,0,'start from an empty stairs table');

const plan=[{student:20,options:{slipEvery:9}},{student:20,options:{stopAfter:12}},{student:19,options:{mashEvery:5}}].map(p=>({...p,id:crypto.randomUUID()}));
process.on('exit',()=>sql(`delete from public.gugudan_stairs_runs where id in (${plan.map(p=>`'${p.id}'`).join(',')});`));
const starts=sql(`begin;set local role service_role;${plan.map(p=>`select public.gugudan_stairs_begin(${p.student},'${p.id}');select public.gugudan_stairs_begin(${p.student},'${p.id}');`).join('\n')}commit;`);
plan.forEach((p,i)=>{assert.equal(starts[i*2+1].seed,starts[i*2].seed,'retried start keeps the seed');p.seed=starts[i*2].seed;});
assert.ok(fails(`set role service_role;select public.gugudan_stairs_begin(21,'${plan[0].id}');`)?.includes('RUN_CONFLICT'));
assert.ok(fails(`set role service_role;select public.gugudan_stairs_seed(21,'${plan[0].id}');`)?.includes('RUN_NOT_FOUND'));
// Edge Function과 같은 방식으로 재생해 저장한다.
const finish=(p,run,hash)=>`select public.gugudan_stairs_finish(${p.student},'${p.id}',${p.seed},'${hash}','${run.ended}',${stairsScore(run)},${run.height},${run.solved},${run.mistakes},${run.slips},${literal(run.log)});`;
for(const p of plan){
 const played=playStairsRun(p.seed,p.options),run=replayStairsRun(p.seed,played.log,played.ended);
 assert.ok(run);p.run=run;p.hash=createHash('sha256').update(JSON.stringify({ended:run.ended,log:run.log})).digest('hex');
 const [saved]=sql(`set role service_role;${finish(p,run,p.hash)}`);
 assert.deepEqual(saved,{id:p.id,score:stairsScore(run),height:run.height,solved:run.solved,ended:run.ended});
 assert.deepEqual(sql(`set role service_role;${finish(p,run,p.hash)}`)[0],saved,'identical retry returns the stored result');
}
assert.ok(fails(`set role service_role;${finish(plan[0],plan[0].run,'0'.repeat(64))}`)?.includes('RUN_ALREADY_FINISHED'));
assert.ok(fails(`set role service_role;${finish({...plan[0],seed:plan[0].seed+1},plan[0].run,plan[0].hash)}`)?.includes('RUN_SEED_MISMATCH'));
for(const role of ['anon','authenticated'])assert.ok(fails(`set role ${role};select public.gugudan_stairs_leaders();`)?.includes('permission denied'));

const best=student=>Math.max(...plan.filter(p=>p.student===student).map(p=>stairsScore(p.run)));
const exp=student=>plan.filter(p=>p.student===student).reduce((sum,p)=>sum+p.run.solved*10,0);
const [leaders]=sql(`set role service_role;select public.gugudan_stairs_leaders();`);
assert.deepEqual(leaders.map(r=>[r.studentNumber,r.score]),[[19,best(19)],[20,best(20)]].sort((a,b)=>b[1]-a[1]));
assert.deepEqual(sql(`set role service_role;select public.gugudan_stairs_records(20);`)[0],{best:best(20),runs:2});
assert.equal(sql(`set role service_role;select public.gugudan_profile(20);`)[0].stairsExp,exp(20));
const teacher=sql(`set role service_role;select public.gugudan_teacher_stairs_records();`)[0];
assert.deepEqual([teacher[19].stairsExp,teacher[19].stairsBest,teacher[0].stairsBest],[exp(20),best(20),null]);
// 친구 수 제한도 계단 경험치를 센다.
assert.equal(fails(`set role service_role;select public.gugudan_save_friends(20,'[]'::jsonb,null);`),null);
// 범위 초기화: 계단만 지우고, 다른 학생은 남는다.
sql(`set role service_role;select public.gugudan_teacher_reset_scoped(20,'["stairs"]'::jsonb);`);
assert.deepEqual(sql(`select jsonb_build_object('s20',(select count(*) from public.gugudan_stairs_runs where student_number=20),'s19',(select count(*) from public.gugudan_stairs_runs where student_number=19));`)[0],{s20:0,s19:1});
assert.ok(fails(`set role service_role;select public.gugudan_teacher_reset_scoped(20,'["stair"]'::jsonb);`)?.includes('INVALID_RESET_SCOPES'));
sql(`set role service_role;select public.gugudan_teacher_reset(19);`);
assert.equal(sql(`select jsonb_build_object('n',(select count(*) from public.gugudan_stairs_runs where finished_at is not null));`)[0].n,0);
console.log('stairs pg checks passed');
