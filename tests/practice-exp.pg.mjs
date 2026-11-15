import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { timesTableExp } from '../src/game/learning.ts';
// 격리된 DB에서만 실행한다: tests/block-bootstrap.sql 뒤에 teacher_bests·stairs_runs·practice_no_exp 마이그레이션을 적용한 DB.
if(process.env.PGDATABASE!=='practice_exp_test')throw Error('Use the isolated practice exp test database (PGDATABASE=practice_exp_test)');
function sql(query){
 const r=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8'});
 if(r.status!==0)throw Error(r.stderr);
 return r.stdout.trim().split('\n').filter(line=>line.startsWith('{')||line.startsWith('[')).map(JSON.parse);
}
const fails=query=>spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8'}).status!==0;
const student=7;
const events=[{a:2,b:3,answer:6,ms:900},{a:2,b:4,answer:9,ms:900},{a:2,b:4,answer:8,ms:900},{a:3,b:3,answer:9,ms:900}]; // 정답 3, 오답 1
const play=(mode,early=true,id=crypto.randomUUID())=>{sql(`set role service_role;select public.gugudan_begin(${student},'${id}','${mode}',1);select public.gugudan_finish(${student},'${id}',${early},'${JSON.stringify(events)}'::jsonb);`);return id;};
const profile=()=>sql(`set role service_role;select public.gugudan_profile(${student});`)[0];
const exp=p=>timesTableExp(p.records,p.practiceCorrect);
const correct=p=>Object.values(p.records).reduce((sum,r)=>sum+r.correct,0);
const reset=()=>sql(`set role service_role;select public.gugudan_teacher_reset(${student});`);

reset();
assert.equal(profile().practiceCorrect,0);
play('rush');
assert.equal(exp(profile()),3,'도전 정답은 경험치가 된다');
const practiceRun=play('practice');
let now=profile();
assert.equal(exp(now),3,'단별 연습은 경험치를 주지 않는다');
assert.equal(correct(now),6,'단별 연습도 학습 기록에는 남는다');
assert.equal(now.sessions.at(-1).mode,'practice','최근 도전에도 남는다');
play('weak');
now=profile();
assert.equal(exp(now),3,'약점 연습은 경험치를 주지 않는다');
assert.equal(now.practiceCorrect,6);
assert.equal(correct(now),9);
sql(`set role service_role;select public.gugudan_finish(${student},'${practiceRun}',true,'${JSON.stringify(events)}'::jsonb);`);
assert.equal(profile().practiceCorrect,6,'같은 판을 다시 저장해도 두 번 세지 않는다');
play('rush');
assert.equal(exp(profile()),6,'연습 뒤 도전 정답은 다시 경험치가 된다');

const teacher=sql(`set role service_role;select public.gugudan_teacher_records();`)[0].find(row=>row.studentNumber===student);
assert.equal(exp(teacher),6,'교사 화면도 같은 경험치를 계산한다');

// 펫 저장의 레벨 제한도 연습 정답을 뺀 경험치를 쓴다: 경험치 6은 Lv1이라 펫 1마리까지.
const friends=list=>`set role service_role;select public.gugudan_save_friends(${student},'${JSON.stringify(list)}'::jsonb,null);`;
assert.equal(fails(friends(['penguin'])),false);
assert.equal(fails(friends(['penguin','otter'])),true,'연습 정답으로는 펫 슬롯이 늘지 않는다');

reset();
now=profile();
assert.equal(now.practiceCorrect,0,'전체 초기화는 연습 정답 수도 지운다');
assert.equal(exp(now),0);
play('practice');
assert.equal(exp(profile()),0,'초기화 뒤 연습만 해도 경험치는 0이다');
sql(`set role service_role;select public.gugudan_teacher_reset_all();`);
assert.equal(profile().practiceCorrect,0,'전원 초기화도 연습 정답 수를 지운다');
reset();
console.log('practice exp pg checks passed');
