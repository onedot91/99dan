import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseMixedVerticalQuestions, createVerticalSession, parseVerticalSession, reduceVertical, verticalScore, verticalSteps, verticalTimePenalty } from '../src/game/vertical.ts';
import { verticalFeedback } from '../src/game/verticalFeedback.ts';

const answer=(session,digit,ms=0)=>reduceVertical(reduceVertical(session,{type:'input',key:String(digit)}),{type:'input',key:'Enter',ms});

test('every two-digit multiplication inserts one manual zero before the tens partial without changing other cells',()=>{
  for(let a=10;a<=99;a++)for(let b=10;b<=99;b++){
    const legacy=verticalSteps({a,b}),manual=verticalSteps({a,b},true);
    const zero=manual.findIndex(s=>s.id==='tens:0');
    assert.equal(zero,legacy.findIndex(s=>s.stage==='tens'));
    assert.equal(manual[zero].expected,0);assert.equal(manual[zero].stage,'tens');
    assert.deepEqual(manual.filter(s=>s.id!=='tens:0'),legacy);
    assert.equal(manual.length,legacy.length+1);
    assert.equal(new Set(manual.map(s=>s.id)).size,manual.length);
  }
});

test('manual zero must be submitted, retries stay on the same cell and produce real score feedback',()=>{
  let session=createVerticalSession(1,crypto.randomUUID(),chooseMixedVerticalQuestions(1,()=>0),true,true);
  const steps=verticalSteps(session.questions[0],true),zero=steps.findIndex(s=>s.id==='tens:0');
  for(const step of steps.slice(0,zero))session=answer(session,step.expected);
  assert.equal(reduceVertical(session,{type:'next'}),session);
  assert.equal(reduceVertical(session,{type:'input',key:'Enter'}),session);
  const before=verticalScore(session);
  session=answer(session,1,1000);
  assert.equal(session.stepIndex,zero);assert.equal(session.mistakes[0],1);
  assert.equal(verticalFeedback(session).correct,false);
  assert.equal(verticalFeedback(session).cellId,'tens:0');
  assert.equal(verticalScore(session),Math.max(0,before-30));
  const wrongScore=verticalScore(session);
  session=answer(session,0,2000);
  assert.equal(session.stepIndex,zero+1);
  assert.equal(session.events.at(-1).answer,0);
  assert.equal(verticalFeedback(session).correct,true);
  assert.equal(verticalFeedback(session).cellId,'tens:0');
  assert.equal(verticalFeedback(session).amount,verticalScore(session)-wrongScore);
  assert.ok(verticalFeedback(session).amount>0);
});

test('manual-zero runs include zero timing, replay safely, and preserve old completed runs',()=>{
  for(const manualZero of [false,true])for(const count of [5,10])for(const difficulty of [1,2,3]){
    let session=createVerticalSession(difficulty,crypto.randomUUID(),chooseMixedVerticalQuestions(difficulty,()=>.2,count),true,manualZero);
    for(const fact of session.questions){
      for(const step of verticalSteps(fact,manualZero))session=answer(session,step.expected,20000);
      session=reduceVertical(session,{type:'next'});
    }
    assert.equal(verticalScore(session),count*196);
    assert.equal(verticalTimePenalty(session),count*4);
    assert.deepEqual(parseVerticalSession(JSON.parse(JSON.stringify(session))),session);
    assert.equal(session.events.length,session.questions.reduce((n,f)=>n+verticalSteps(f,manualZero).length,0));
    assert.equal(parseVerticalSession({...session,manualZero:!manualZero}),null);
    if(manualZero)assert.equal(parseVerticalSession({...session,events:session.events.filter(e=>verticalSteps(session.questions[e.question],true)[e.step].id!=='tens:0')}),null);
  }
});
