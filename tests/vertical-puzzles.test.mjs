import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseMixedVerticalQuestions, createVerticalSession, parseVerticalQuestions, parseVerticalSession, reduceVertical, verticalQuestionSteps, verticalScore, verticalSolved, verticalSteps, verticalTimePenalty, withVerticalPuzzles } from '../src/game/vertical.ts';
import { verticalFeedback } from '../src/game/verticalFeedback.ts';

const answer=(session,digit,ms=0)=>reduceVertical(reduceVertical(session,{type:'input',key:String(digit)}),{type:'input',key:'Enter',ms});
const create=(difficulty,count=10)=>createVerticalSession(difficulty,crypto.randomUUID(),withVerticalPuzzles(chooseMixedVerticalQuestions(difficulty,()=>.3,count),difficulty,()=>0),true,true);

test('only middle/upper ten-question runs contain three/two-hole and five/three-hole puzzles',()=>{
  for(const count of [5,10])for(const difficulty of [1,2,3])for(const random of [()=>0,()=>.5,()=>1]){
    const questions=withVerticalPuzzles(chooseMixedVerticalQuestions(difficulty,random,count),difficulty,random);
    assert.equal(questions.filter(f=>f.holes).length,count===10?difficulty===2?3:difficulty===3?5:0:0);
    assert.deepEqual(parseVerticalQuestions(questions,difficulty,count,true),questions);
    if(questions.some(f=>f.holes))assert.equal(parseVerticalQuestions(questions,difficulty,count),null);
    for(const fact of questions.filter(f=>f.holes)){
      assert.equal(fact.holes.length,difficulty===2?2:3);
      const steps=verticalQuestionSteps(fact,true);
      assert.deepEqual(steps.map(s=>s.row),difficulty===2?['ones','tens']:['ones','tens','sum']);
      assert.equal(steps.every(s=>s.aPlace===null&&s.bPlace===null&&s.calculation===''),true);
    }
  }
});

test('every valid operand pair supplies visible partial products and distinct answerable holes',()=>{
  for(let a=10;a<=99;a++)for(let b=10;b<=99;b++)for(const difficulty of [2,3]){
    const fact=withVerticalPuzzles(Array(10).fill({a,b}),difficulty,()=>.9).find(f=>f.holes);
    const steps=verticalQuestionSteps(fact,true);
    assert.equal(steps.length,difficulty===2?2:3);
    assert.equal(new Set(fact.holes).size,steps.length);
    for(const step of steps)assert.equal(step.expected,verticalSteps(fact,true).find(s=>s.id===step.id).expected);
    assert.equal(fact.holes.includes('tens:0'),false);
  }
});

test('holes can be solved in reverse order, retries affect only the selected cell, and solved cells cannot earn twice',()=>{
  let session=create(3);
  const steps=verticalQuestionSteps(session.questions[0],true);
  session=reduceVertical(session,{type:'select',step:2});
  assert.equal(session.stepIndex,2);assert.equal(verticalScore(session),0);
  session=answer(session,steps[2].expected,1000);
  assert.equal(verticalScore(session),66);assert.equal(verticalSolved(session).has(2),true);
  assert.equal(verticalFeedback(session).amount,66);
  assert.equal(reduceVertical(session,{type:'select',step:2}),session);
  session=reduceVertical(session,{type:'select',step:1});
  session=answer(session,(steps[1].expected+1)%10,3000);
  assert.equal(session.stepIndex,1);assert.equal(verticalScore(session),36);assert.equal(verticalFeedback(session).amount,-30);
  session=reduceVertical(session,{type:'select',step:0});
  session=answer(session,steps[0].expected,4000);
  assert.equal(session.stepIndex,1);assert.equal(verticalScore(session),103);
  session=answer(session,steps[1].expected,7000);
  assert.equal(session.stepIndex,steps.length);assert.equal(verticalScore(session),170);
  assert.deepEqual(parseVerticalSession(session),session);
  assert.equal(parseVerticalSession({...session,events:session.events.map((event,index)=>index===session.events.length-1?{...event,ms:2999}:event)}),null);
  assert.equal(reduceVertical(session,{type:'select',step:0}),session);
  assert.equal(reduceVertical(session,{type:'input',key:'Enter'}),session);
  const duplicated=[...session.events,session.events[0]];
  assert.equal(parseVerticalSession({...session,events:duplicated}),null);
});

test('mixed sessions finish only after all holes and regular cells, with consistent scoring and transcript validation',()=>{
  for(const difficulty of [2,3]){
    let session=create(difficulty);
    for(const fact of session.questions){
      const steps=verticalQuestionSteps(fact,true);
      const order=steps.map((_,i)=>i);if(fact.holes)order.reverse();
      for(const index of order){
        if(fact.holes)session=reduceVertical(session,{type:'select',step:index});
        session=answer(session,steps[index].expected,20000);
        assert.ok(parseVerticalSession(session));
      }
      session=reduceVertical(session,{type:'next'});
    }
    assert.equal(session.completed,true);assert.equal(verticalTimePenalty(session),40);assert.equal(verticalScore(session),1960);
    assert.deepEqual(parseVerticalSession(JSON.parse(JSON.stringify(session))),session);
    const questions=session.questions.map(f=>f.holes?{...f,holes:['carry-ones:1',...f.holes.slice(1)]}:f);
    assert.equal(parseVerticalSession({...session,questions}),null);
    assert.equal(parseVerticalSession({...session,manualZero:undefined}),null);
    assert.equal(parseVerticalSession({...session,events:session.events.slice(0,-1)}),null);
  }
});
