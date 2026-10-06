import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { verticalSteps } from '../src/game/vertical.ts';
import { parseVerticalMetrics, recommendVertical } from '../src/game/verticalRecommendation.ts';

if(process.env.PGHOST!=='127.0.0.1'||!process.env.PGDATABASE?.startsWith('99dan_vertical_score_'))throw Error('Use an isolated local score test database');
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
function sql(query){
  const result=spawnSync(process.env.PSQL??'psql',['-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:6*1024*1024});
  if(result.status!==0)throw Error(result.stderr);
  return result.stdout.trim().split('\n').filter(line=>line.startsWith('{')||line.startsWith('[')||/^\d+$/.test(line));
}
function skills(fact){
  const steps=verticalSteps(fact);
  return steps.map(step=>{
    if(step.stage!=='sum')return (fact.a%10)*(step.stage==='ones'?fact.b%10:Math.floor(fact.b/10))>=10?2:1;
    return step.row==='carry-sum'||steps.some(carry=>carry.row==='carry-sum'&&(carry.place===step.place||carry.place===step.place+1))?3:1;
  });
}
function transcript(questions,every){
  const events=[],stats={first:{attempts:0,correct:0},multiply:{attempts:0,correct:0},sum:{attempts:0,correct:0}};
  let sumCount=0;
  questions.forEach((fact,question)=>verticalSteps(fact).forEach((step,index)=>{
    const skill=skills(fact)[index],wrong=skill===3&&every>0&&++sumCount%every===0;
    stats.first.attempts++;stats.first.correct+=Number(!wrong);
    if(skill>1){const target=skill===2?stats.multiply:stats.sum;target.attempts++;target.correct+=Number(!wrong);}
    if(wrong)for(let retry=0;retry<3;retry++)events.push({question,step:index,answer:(step.expected+1)%10});
    events.push({question,step:index,answer:step.expected});
  }));
  return {events,stats};
}
const facts=[];
for(let a=10;a<=99;a++)for(let b=10;b<=99;b++)facts.push({a,b,skills:skills({a,b})});
assert.equal(sql(`select count(*) from jsonb_array_elements(${literal(facts)}) f where to_jsonb(public.gugudan_vertical_skills((f->>'a')::integer,(f->>'b')::integer))<>f->'skills';`).at(-1),'0');
for(let student=1;student<=4;student++){
  sql(`set role service_role;select public.gugudan_teacher_set_vertical(${student},3);`);
  const summaries=[];
  for(let run=0;run<(student===4?2:4);run++){
    const start=JSON.parse(sql(`set role service_role;select public.gugudan_vertical_begin(${student},'${crypto.randomUUID()}');`).at(-1));
    const {events,stats}=transcript(start.questions,student===2?2:student===3?4:0);
    assert.deepEqual(JSON.parse(sql(`select public.gugudan_vertical_metrics(${literal(start.questions)},${literal(events)});`).at(-1)),stats);
    const statement=`select public.gugudan_vertical_finish(${student},'${start.id}',${literal(events)});`;
    sql(`set role service_role;${statement}${statement}`);
    const stored=JSON.parse(sql(`select skill_stats from public.gugudan_vertical_runs where id='${start.id}';`).at(-1));
    assert.deepEqual(stored,stats);summaries.push(stats);
  }
  const actual=JSON.parse(sql('set role service_role;select public.gugudan_teacher_vertical_metrics();').at(-1)).find(row=>row.studentNumber===student).stats;
  const expected={runs:Math.min(3,summaries.length),first:{attempts:0,correct:0},multiply:{attempts:0,correct:0},sum:{attempts:0,correct:0}};
  for(const stats of summaries.slice(-3))for(const key of ['first','multiply','sum']){expected[key].attempts+=stats[key].attempts;expected[key].correct+=stats[key].correct;}
  assert.deepEqual(actual,expected);
  const recommendation=recommendVertical(parseVerticalMetrics(actual));
  assert.equal(recommendation?.difficulty??null,student===1?3:student===2?1:student===3?2:null);
}
const before=JSON.parse(sql('select public.gugudan_teacher_vertical_metrics();').at(-1));
sql(`begin;insert into public.gugudan_vertical_runs(id,student_number,difficulty,questions,finished_at,score,mistakes) values(gen_random_uuid(),1,1,'[]',clock_timestamp(),1000,0);select public.gugudan_vertical_begin(1,'${crypto.randomUUID()}');commit;`);
assert.deepEqual(JSON.parse(sql('select public.gugudan_teacher_vertical_metrics();').at(-1)),before);
assert.equal(sql("select count(*) from (values ('anon'),('authenticated')) roles(role) where has_function_privilege(role,'public.gugudan_teacher_vertical_metrics()','execute') or has_function_privilege(role,'public.gugudan_vertical_metrics(jsonb,jsonb)','execute');").at(-1),'0');
process.stdout.write('8,100 skill classifications, first-attempt retry handling, validated persisted metrics, latest-three aggregation, idempotency, sparse/legacy exclusions, all recommendations and restricted grants passed\n');
