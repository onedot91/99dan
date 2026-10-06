import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseMixedVerticalQuestions, chooseVerticalQuestions, createVerticalSession, difficultyOf, parseVerticalQuestions, parseVerticalSession, reduceVertical, verticalScore, verticalSteps, verticalTimePenalty } from '../src/game/vertical.ts';
import { VERTICAL_SETS } from '../src/game/verticalSets.ts';

test('all 8,100 two-digit products have correct partial products, sums and carry positions',()=>{
  const counts=[0,0,0,0];
  for(let a=10;a<=99;a++)for(let b=10;b<=99;b++){
    const fact={a,b},steps=verticalSteps(fact);
    const read=row=>steps.filter(s=>s.row===row).reduce((value,s)=>value+s.expected*10**s.place,0);
    assert.equal(read('ones'),a*(b%10));
    assert.equal(read('tens'),a*Math.floor(b/10)*10);
    assert.equal(read('sum'),a*b);
    assert.equal(new Set(steps.map(s=>s.id)).size,steps.length);
    for(const step of steps){assert.ok(Number.isInteger(step.expected)&&step.expected>=0&&step.expected<=9);assert.ok(step.place>=0&&step.place<4);}
    const multCarry=[b%10,Math.floor(b/10)].some(n=>(a%10)*n>=10);
    let first=a*(b%10),second=a*Math.floor(b/10)*10,carry=0,sumCarry=false;
    while(first||second){const total=first%10+second%10+carry;carry=Math.floor(total/10);sumCarry||=carry>0;first=Math.floor(first/10);second=Math.floor(second/10);}
    const expected=sumCarry?3:multCarry?2:1;
    assert.equal(difficultyOf(fact),expected);counts[expected]++;
    assert.equal(steps.some(s=>s.row==='carry-sum'),sumCarry);
    for(const row of ['carry-ones','carry-tens'])for(const step of steps.filter(s=>s.row===row))assert.equal(step.place,row==='carry-ones'?1:2);
  }
  assert.ok(counts.slice(1).every(n=>n>=5));
});

test('25 × 13 asks for 5, a small carry 1 above the tens, then 7',()=>{
  const steps=verticalSteps({a:25,b:13});
  assert.deepEqual(steps.slice(0,3).map(s=>[s.row,s.place,s.expected]),[['ones',0,5],['carry-ones',1,1],['ones',1,7]]);
});

test('58 × 41 places the carry 3 for the tens multiplier above the hundreds column',()=>{
  const steps=verticalSteps({a:58,b:41});
  const carryIndex=steps.findIndex(s=>s.row==='carry-tens');
  assert.equal(steps[carryIndex].place,2);
  assert.equal(steps[carryIndex].expected,3);
  assert.equal(steps[carryIndex-1].place,1);
  assert.equal(steps[carryIndex+1].place,2);
});

test('five questions stay in the chosen difficulty, are unique and have increasing carry complexity',()=>{
  for(const difficulty of [1,2,3])for(const sample of [0,.25,.5,.75,1]){
    const facts=chooseVerticalQuestions(difficulty,()=>sample);
    assert.equal(facts.length,5);assert.equal(new Set(facts.map(f=>`${f.a}×${f.b}`)).size,5);
    let previous=-1;
    for(const fact of facts){assert.equal(difficultyOf(fact),difficulty);const carries=verticalSteps(fact).filter(s=>s.row.startsWith('carry')).length;assert.ok(carries>=previous);previous=carries;}
  }
});

test('wrong answers retry only the current cell and cannot advance the problem',()=>{
  let session=createVerticalSession(2);
  session=reduceVertical(session,{type:'input',key:'9'});
  session=reduceVertical(session,{type:'input',key:'3'});
  assert.equal(session.entry,'3');
  session=reduceVertical(session,{type:'input',key:'Delete'});assert.equal(session.entry,'');
  const fact=session.questions[0],first=verticalSteps(fact)[0];
  const wrong=String((first.expected+1)%10);
  session=reduceVertical(session,{type:'input',key:wrong});
  session=reduceVertical(session,{type:'input',key:'Enter'});
  assert.equal(session.stepIndex,0);assert.equal(session.index,0);assert.equal(session.mistakes[0],1);assert.equal(session.entry,'');
  assert.equal(reduceVertical(session,{type:'next'}),session);
  session=reduceVertical(session,{type:'input',key:String(first.expected)});
  session=reduceVertical(session,{type:'input',key:'Enter'});assert.equal(session.stepIndex,1);
  const next=verticalSteps(fact)[1];
  session=reduceVertical(session,{type:'input',key:String((next.expected+1)%10)});
  session=reduceVertical(session,{type:'input',key:'Enter'});assert.equal(session.stepIndex,1);
});

test('all five complete only after every cell is confirmed, and saved state resumes exactly',()=>{
  let session=createVerticalSession(3);
  for(let index=0;index<5;index++){
    const steps=verticalSteps(session.questions[index]);
    for(const step of steps){
      session=reduceVertical(session,{type:'input',key:String(step.expected)});
      const saved=parseVerticalSession(JSON.parse(JSON.stringify(session)));assert.deepEqual(saved,session);
      session=reduceVertical(saved,{type:'input',key:'Enter'});
    }
    assert.equal(session.completed,false);assert.equal(session.index,index);
    session=reduceVertical(session,{type:'next'});
  }
  assert.equal(session.completed,true);assert.equal(session.index,4);
  assert.equal(reduceVertical(session,{type:'input',key:'5'}),session);
  assert.deepEqual(parseVerticalSession(JSON.parse(JSON.stringify(session))),session);
});

test('corrupted or incompatible saved states are rejected safely',()=>{
  const session=createVerticalSession(1);
  for(const value of [null,{},[],{...session,questions:[]},{...session,index:5},{...session,stepIndex:999},{...session,difficulty:'1'},{...session,completed:true},{...session,entry:'12'},{...session,mistakes:[-1,0,0,0,0]},{...session,questions:[{a:9,b:12},...session.questions.slice(1)]}])assert.equal(parseVerticalSession(value),null);
});

test('random teacher sets contain five unique questions with the agreed carry mix, including carries in easy',()=>{
  for(const [index,expected] of [[0,[2,2,1]],[1,[1,2,2]],[2,[0,1,4]]]){
    const set=VERTICAL_SETS[index],session=createVerticalSession(set.id);
    assert.equal(session.version,4);
    const counts=[1,2,3].map(type=>session.questions.filter(fact=>difficultyOf(fact)===type).length);
    assert.deepEqual(counts,expected);
    assert.deepEqual(parseVerticalSession(JSON.parse(JSON.stringify(session))),session);
    const changed={...session,questions:Array(5).fill(session.questions[0])};
    assert.equal(parseVerticalSession(changed),null);
  }
});

test('new sets vary with randomness while supplied server questions and restored runs stay fixed',()=>{
  for(const set of VERTICAL_SETS){
    const draws=[0,.25,.5,.75,1].map(sample=>chooseMixedVerticalQuestions(set.id,()=>sample));
    assert.equal(new Set(draws.map(JSON.stringify)).size,5);
    for(const questions of draws){
      assert.deepEqual(parseVerticalQuestions(questions,set.id),questions);
      assert.equal(new Set(questions.map(f=>`${f.a}:${f.b}`)).size,5);
      const session=createVerticalSession(set.id,crypto.randomUUID(),questions);
      assert.deepEqual(session.questions,questions);
      assert.deepEqual(parseVerticalSession(JSON.parse(JSON.stringify(session))),session);
    }
    assert.equal(parseVerticalQuestions(Array(5).fill({a:11,b:11}),set.id),null);
    assert.equal(parseVerticalQuestions([{a:100,b:12},...draws[0].slice(1)],set.id),null);
  }
});

test('previous homogeneous sessions resume unchanged while new sessions use mixed teacher sets',()=>{
  const legacy={...createVerticalSession(2),version:1,id:null,events:[],questions:chooseVerticalQuestions(2,()=>.5),stepIndex:3};
  assert.deepEqual(parseVerticalSession(JSON.parse(JSON.stringify(legacy))),legacy);
  assert.notDeepEqual(createVerticalSession(2).questions,legacy.questions);
});

test('scores reward confirmed cells, deduct every wrong digit including the first problem, and floor at zero',()=>{
  let session=createVerticalSession(1);
  const answer=(n)=>{session=reduceVertical(reduceVertical(session,{type:'input',key:String(n)}),{type:'input',key:'Enter'});};
  const first=verticalSteps(session.questions[0]);
  answer((first[0].expected+1)%10);assert.equal(verticalScore(session),0);
  for(const step of first){answer(step.expected);assert.equal(verticalScore(session),Math.max(0,Math.floor(session.stepIndex*200/first.length)-30));}
  assert.equal(verticalScore(session),170);
  session=reduceVertical(session,{type:'next'});
  const second=verticalSteps(session.questions[1]);
  answer((second[0].expected+1)%10);assert.equal(verticalScore(session),140);
  for(const step of second)answer(step.expected);
  assert.equal(verticalScore(session),340);
  for(let index=2;index<5;index++){
    session=reduceVertical(session,{type:'next'});
    for(const step of verticalSteps(session.questions[index]))answer(step.expected);
  }
  session=reduceVertical(session,{type:'next'});assert.equal(verticalScore(session),940);
  assert.equal(verticalScore({...session,mistakes:[40,0,0,0,0]}),0);
});

test('each confirmed digit earns a share of 200 points, including carries, without rewarding typing or automatic zeros',()=>{
  for(const fact of [{a:10,b:10},{a:20,b:99},{a:25,b:13},{a:99,b:99}]){
    let session=createVerticalSession(1,crypto.randomUUID(),Array(5).fill(fact));
    const steps=verticalSteps(fact);
    assert.equal(steps.some(s=>s.row==='tens'&&s.place===0),false);
    for(const [index,step] of steps.entries()){
      const before=verticalScore(session);
      session=reduceVertical(session,{type:'input',key:String(step.expected)});
      assert.equal(verticalScore(session),before);
      session=reduceVertical(session,{type:'input',key:'Enter'});
      const earned=Math.floor((index+1)*200/steps.length);
      assert.equal(verticalScore(session),earned);
      assert.ok(earned>before);
      session=reduceVertical(session,{type:'input',key:'Enter'});
      assert.equal(verticalScore(session),earned);
    }
    assert.equal(verticalScore(session),200);
    session=reduceVertical(session,{type:'next'});
    assert.equal(verticalScore(session),200);
  }
});

test('saved scoring transcripts reject altered mistakes, missing or reordered answers, and accept old version 2 sessions',()=>{
  let session=createVerticalSession(1);
  for(const step of verticalSteps(session.questions[0]).slice(0,2))session=reduceVertical(reduceVertical(session,{type:'input',key:String(step.expected)}),{type:'input',key:'Enter'});
  for(const value of [{...session,id:'bad'},{...session,events:[]},{...session,events:[...session.events].reverse()},{...session,mistakes:[1,0,0,0,0]}])assert.equal(parseVerticalSession(value),null);
  const legacy={...session,version:2,id:null,events:[],questions:VERTICAL_SETS[0].legacyQuestions,stepIndex:0};
  assert.deepEqual(parseVerticalSession(legacy),legacy);
});

test('previous fixed version 3 questions and scoring transcripts resume unchanged',()=>{
  let legacy={...createVerticalSession(2,crypto.randomUUID(),VERTICAL_SETS[1].legacyQuestions),version:3};
  for(const step of verticalSteps(legacy.questions[0]).slice(0,3))legacy=reduceVertical(reduceVertical(legacy,{type:'input',key:String(step.expected)}),{type:'input',key:'Enter'});
  assert.deepEqual(parseVerticalSession(JSON.parse(JSON.stringify(legacy))),legacy);
});

function timedComplete(difficulty,ms,wrong=false){
  let session=createVerticalSession(difficulty,crypto.randomUUID(),undefined,true);
  for(let question=0;question<5;question++){
    const steps=verticalSteps(session.questions[question]);
    if(wrong&&question===0)session=reduceVertical(reduceVertical(session,{type:'input',key:String((steps[0].expected+1)%10)}),{type:'input',key:'Enter',ms:1000});
    for(const [index,step] of steps.entries())session=reduceVertical(reduceVertical(session,{type:'input',key:String(step.expected)}),{type:'input',key:'Enter',ms:typeof ms==='function'?ms(question,index,steps.length):ms});
    session=reduceVertical(session,{type:'next'});
  }
  return session;
}

test('time uses individual cell durations, caps each problem at four points and normalizes different carry counts',()=>{
  for(const difficulty of [1,2,3])for(const [ms,penalty] of [[0,0],[4999,0],[5000,5],[10000,10],[20000,20],[1000000000,20]]){
    const session=timedComplete(difficulty,ms);
    assert.equal(verticalTimePenalty(session),penalty);
    assert.equal(verticalScore(session),1000-penalty);
    assert.deepEqual(parseVerticalSession(JSON.parse(JSON.stringify(session))),session);
  }
  const uneven=timedComplete(1,(_q,index)=>index%2?20000:0);
  const expected=uneven.questions.reduce((sum,fact)=>{const count=verticalSteps(fact).length;return sum+Math.floor(Math.floor(count/2)*20000/(count*5000));},0);
  assert.equal(verticalTimePenalty(uneven),expected);
  assert.ok(verticalScore(timedComplete(1,20000))>verticalScore(timedComplete(1,1000,true)));
});

test('retries keep cumulative cell time, count time once, and saved timed transcripts reject corrupt durations',()=>{
  let session=createVerticalSession(1,crypto.randomUUID(),undefined,true);
  const first=verticalSteps(session.questions[0])[0];
  const enter=(answer,ms)=>{session=reduceVertical(reduceVertical(session,{type:'input',key:String(answer)}),{type:'input',key:'Enter',ms});};
  enter((first.expected+1)%10,3000);enter(first.expected,7000);
  assert.equal(session.events[1].ms,7000);
  assert.equal(verticalTimePenalty(session),Math.floor(7000/(verticalSteps(session.questions[0]).length*5000)));
  assert.deepEqual(parseVerticalSession(session),session);
  for(const ms of [undefined,-1,1.5,1000000001,NaN,Infinity,2000])assert.equal(parseVerticalSession({...session,events:[session.events[0],{...session.events[1],ms}]}),null);
  assert.equal(parseVerticalSession({...session,timeScoring:undefined}),null);
  assert.equal(parseVerticalSession({...session,timeScoring:false}),null);
  const legacy=timedComplete(1,20000);
  const untimed={...legacy,timeScoring:undefined,events:legacy.events.map(({ms,...event})=>event)};
  assert.equal(verticalScore(untimed),1000);assert.ok(parseVerticalSession(untimed));
});
