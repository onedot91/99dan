import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { TEACHER_RESET_SCOPES } from '../src/game/teacherReset.ts';

if(process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='99dan_teacher_reset_scopes_20261005')throw Error('Use the isolated local teacher reset database');
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
function sql(query){
 const result=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:16*1024*1024});
 if(result.status!==0)throw Error(result.stderr);
 return result.stdout.trim().split('\n').filter(line=>line.startsWith('{')||line.startsWith('[')).map(JSON.parse);
}
const sessions=[1,2,3,1,2,3].map((duration,index)=>({id:crypto.randomUUID(),mode:index===3?'practice':index===4?'weak':'rush',duration,score:100+index,correct:1,scoringVersion:5}));
const best=Object.fromEntries([1,2,3].map(duration=>[duration,{duration,score:500,correct:2,scoringVersion:5}]));
const seed=`
delete from public.gugudan_runs where student_number in (1,2);
delete from public.gugudan_weekly_leaders where student_number in (1,2);
delete from public.gugudan_vertical_runs where student_number in (1,2);
insert into public.gugudan_players(student_number,records,sessions,best,ordinal,friends,partner)
select student, '{"2×2":{"attempts":10,"correct":8,"wrong":2}}',${literal(sessions)},${literal(best)},77,'["penguin"]','penguin' from generate_series(1,2) student
on conflict(student_number) do update set records=excluded.records,sessions=excluded.sessions,best=excluded.best,ordinal=excluded.ordinal,friends=excluded.friends,partner=excluded.partner;
insert into public.gugudan_vertical_assignments(student_number,difficulty) values(1,2),(2,3)
on conflict(student_number) do update set difficulty=excluded.difficulty;
delete from public.gugudan_weekly_leaders where student_number in (1,2);
insert into public.gugudan_weekly_leaders(student_number,duration,score,correct,achieved_at)
select student,duration,500,2,now()-interval '10 days' from generate_series(1,2) student cross join generate_series(1,3) duration;
insert into public.gugudan_runs(id,student_number,mode,duration,finished_at)
select gen_random_uuid(),student,mode,duration,case when finished then now() else null end
from generate_series(1,2) student cross join (values('rush'),('practice'),('weak')) modes(mode) cross join generate_series(1,3) duration cross join (values(true),(false)) finished(finished);
insert into public.gugudan_vertical_runs(id,student_number,difficulty,questions,finished_at,score,skill_stats)
select gen_random_uuid(),student,2,(select jsonb_agg(jsonb_build_object('a',12,'b',13)) from generate_series(1,count)),case when finished then now() else null end,case when finished then 500 else null end,
case when finished then '{"first":{"attempts":10,"correct":9},"multiply":{"attempts":5,"correct":4},"sum":{"attempts":5,"correct":4}}'::jsonb else null end
from generate_series(1,2) student cross join (values(5),(10)) counts(count) cross join (values(true),(false)) finished(finished);`;
const snapshot=`select jsonb_object_agg(student,jsonb_build_object(
 'player',(select to_jsonb(p) from public.gugudan_players p where student_number=student),
 'runs',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.gugudan_runs r where student_number=student),
 'vertical',(select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.gugudan_vertical_runs v where student_number=student),
 'weekly',(select coalesce(jsonb_agg(to_jsonb(w) order by duration),'[]') from public.gugudan_weekly_leaders w where student_number=student),
 'assignment',(select to_jsonb(a) from public.gugudan_vertical_assignments a where student_number=student))) from generate_series(1,2) student;`;
const ids=TEACHER_RESET_SCOPES.map(scope=>scope.id);
for(let mask=1;mask<32;mask++){
 const scopes=ids.filter((_,index)=>mask&(1<<index));
 const [before,after,repeated]=sql(`begin;${seed}set local role service_role;${snapshot}select public.gugudan_teacher_reset_scoped(1,${literal(scopes)});${snapshot}select public.gugudan_teacher_reset_scoped(1,${literal(scopes)});${snapshot}rollback;`);
 const expected=structuredClone(before);
 const durations=scopes.filter(s=>s.startsWith('rush-')).map(s=>Number(s.slice(5)));
 const counts=scopes.filter(s=>s.startsWith('vertical-')).map(s=>Number(s.slice(9)));
 expected['1'].player.sessions=expected['1'].player.sessions.filter(s=>s.mode!=='rush'||!durations.includes(s.duration));
 for(const duration of durations)delete expected['1'].player.best[duration];
 expected['1'].runs=expected['1'].runs.filter(r=>!r.finished_at||r.mode!=='rush'||!durations.includes(r.duration));
 expected['1'].vertical=expected['1'].vertical.filter(r=>!r.finished_at||!counts.includes(r.questions.length));
 expected['1'].weekly=expected['1'].weekly.filter(w=>!durations.includes(w.duration));
 assert.deepEqual(after,expected,scopes.join(','));
 assert.deepEqual(repeated,after,'retry changes no additional records');
}
const invalid=[null,[],{},'rush-1',['rush-4'],['rush-1','rush-1'],[null],[1],Array(6).fill('rush-1')];
const checks=invalid.map(scopes=>`begin perform public.gugudan_teacher_reset_scoped(1,${literal(scopes)});raise exception 'INVALID_ACCEPTED';exception when others then if sqlerrm<>'INVALID_RESET_SCOPES' then raise;end if;end;`).join('\n');
const [before,after]=sql(`begin;${seed}set local role service_role;${snapshot}do $$ begin ${checks}
 ${[0,24,'null'].map(student=>`begin perform public.gugudan_teacher_reset_scoped(${student},'["rush-1"]');raise exception 'INVALID_ACCEPTED';exception when others then if sqlerrm<>'INVALID_STUDENT' then raise;end if;end;`).join('\n')}
 end;$$;${snapshot}rollback;`);
assert.deepEqual(after,before);
const [initial,shrunk,appended]=sql(`begin;${seed}set local role service_role;${snapshot}
update public.gugudan_players set sessions=sessions-5 where student_number=1;${snapshot}
update public.gugudan_players set sessions=sessions||${literal([{id:crypto.randomUUID(),mode:'rush',duration:1,score:9000,correct:9,scoringVersion:5}])} where student_number=1;${snapshot}rollback;`);
assert.deepEqual(shrunk['1'].weekly,initial['1'].weekly);
assert.equal(appended['1'].weekly.find(w=>w.duration===1).score,9000);
assert.deepEqual(appended['1'].weekly.filter(w=>w.duration!==1),initial['1'].weekly.filter(w=>w.duration!==1));
const [permissions]=sql(`select jsonb_build_object('anon',has_function_privilege('anon','public.gugudan_teacher_reset_scoped(integer,jsonb)','execute'),'authenticated',has_function_privilege('authenticated','public.gugudan_teacher_reset_scoped(integer,jsonb)','execute'),'service',has_function_privilege('service_role','public.gugudan_teacher_reset_scoped(integer,jsonb)','execute'));`);
assert.deepEqual(permissions,{anon:false,authenticated:false,service:true});
console.log('31 category combinations, idempotent retries, active-run/other-category/other-student preservation, invalid inputs, weekly history guard and roles passed; all fixture mutations rolled back');
