import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseMixedVerticalQuestions, createVerticalSession, difficultyOf, parseVerticalQuestions, parseVerticalSession, reduceVertical, verticalScore, verticalSteps, verticalTimePenalty } from '../src/game/vertical.ts';
import { verticalCounts } from '../src/game/verticalSets.ts';

const answer=(session,digit,ms=0)=>reduceVertical(reduceVertical(session,{type:'input',key:String(digit)}),{type:'input',key:'Enter',ms});

test('each difficulty supplies ten unique random questions with doubled carry proportions',()=>{
  for(const difficulty of [1,2,3])for(const random of [()=>0,()=>.5,()=>1]){
    const questions=chooseMixedVerticalQuestions(difficulty,random,10);
    assert.equal(questions.length,10);
    assert.equal(new Set(questions.map(f=>`${f.a}:${f.b}`)).size,10);
    assert.deepEqual([1,2,3].map(kind=>questions.filter(f=>difficultyOf(f)===kind).length),verticalCounts(difficulty,10));
    assert.deepEqual(parseVerticalQuestions(questions,difficulty,10),questions);
    assert.equal(parseVerticalQuestions(questions,difficulty,5),null);
    assert.equal(parseVerticalQuestions([...questions.slice(0,-1),questions[0]],difficulty,10),null);
    assert.equal(parseVerticalQuestions(questions.slice(0,9),difficulty,10),null);
  }
  assert.notDeepEqual(chooseMixedVerticalQuestions(1,()=>0,10),chooseMixedVerticalQuestions(1,()=>.5,10));
});

test('ten-question runs require all ten problems, preserve timing and wrong penalties, and replay safely',()=>{
  for(const difficulty of [1,2,3]){
    let session=createVerticalSession(difficulty,crypto.randomUUID(),chooseMixedVerticalQuestions(difficulty,()=>.2,10),true);
    assert.equal(session.mistakes.length,10);
    for(let q=0;q<10;q++){
      const steps=verticalSteps(session.questions[q]);
      assert.equal(reduceVertical(session,{type:'next'}),session);
      if(q===9)session=answer(session,(steps[0].expected+1)%10,1000);
      for(const step of steps)session=answer(session,step.expected,20000);
      assert.equal(session.completed,false);
      assert.ok(parseVerticalSession(JSON.parse(JSON.stringify(session))));
      session=reduceVertical(session,{type:'next'});
      assert.equal(session.completed,q===9);
      if(q===4)assert.equal(session.index,5);
    }
    assert.equal(verticalTimePenalty(session),40);
    assert.equal(verticalScore(session),1930);
    assert.deepEqual(parseVerticalSession(JSON.parse(JSON.stringify(session))),session);
    assert.equal(parseVerticalSession({...session,index:4,completed:true}),null);
    assert.equal(parseVerticalSession({...session,mistakes:session.mistakes.slice(0,5)}),null);
    assert.equal(parseVerticalSession({...session,events:session.events.slice(0,-1)}),null);
    assert.equal(parseVerticalSession({...session,version:3}),null);
    assert.equal(reduceVertical(session,{type:'next'}),session);
  }
});

test('five and ten question sets keep independent 1000 and 2000 point ceilings',()=>{
  for(const count of [5,10]){
    let session=createVerticalSession(1,crypto.randomUUID(),chooseMixedVerticalQuestions(1,Math.random,count));
    for(const fact of session.questions){for(const step of verticalSteps(fact))session=answer(session,step.expected);session=reduceVertical(session,{type:'next'});}
    assert.equal(verticalScore(session),count*200);
    assert.equal(session.completed,true);
    assert.ok(parseVerticalSession(session));
  }
});
