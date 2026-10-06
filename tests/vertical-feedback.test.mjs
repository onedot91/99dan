import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVerticalSession, reduceVertical, verticalScore, verticalSteps } from '../src/game/vertical.ts';
import { verticalFeedback } from '../src/game/verticalFeedback.ts';

const submit=(session,answer,ms=0)=>reduceVertical(reduceVertical(session,{type:'input',key:String(answer)}),{type:'input',key:'Enter',ms});

test('cell feedback uses the actual score change, including carry cells and time deductions',()=>{
  for(const fact of [{a:25,b:13},{a:99,b:99}]){
    let session=createVerticalSession(1,crypto.randomUUID(),Array(5).fill(fact),true);
    assert.equal(verticalFeedback(session),null);
    for(const step of verticalSteps(fact)){
      const before=verticalScore(session);
      session=submit(session,step.expected,20000);
      const feedback=verticalFeedback(session);
      assert.equal(feedback.correct,true);assert.equal(feedback.cellId,step.id);
      assert.equal(feedback.amount,verticalScore(session)-before);
      assert.ok(feedback.amount>0);
      assert.deepEqual(verticalFeedback(reduceVertical(session,{type:'input',key:'1'})),feedback);
    }
    session=reduceVertical(session,{type:'next'});
    assert.equal(verticalFeedback(session),null);
  }
});

test('wrong feedback never exposes the answer, does not invent a loss below zero, and restarts for each retry',()=>{
  let session=createVerticalSession(1);
  const steps=verticalSteps(session.questions[0]);
  session=submit(session,(steps[0].expected+1)%10);
  const first=verticalFeedback(session);
  assert.equal(first.correct,false);assert.equal(first.amount,0);
  assert.equal('expected' in first,false);
  session=submit(session,(steps[0].expected+1)%10);
  assert.notEqual(verticalFeedback(session).key,first.key);
  for(const step of steps)session=submit(session,step.expected);
  session=reduceVertical(session,{type:'next'});
  const before=verticalScore(session),step=verticalSteps(session.questions[1])[0];
  session=submit(session,(step.expected+1)%10);
  assert.equal(verticalFeedback(session).amount,-30);
  assert.equal(verticalScore(session),before-30);
});

test('last cell and final completion keep stable feedback without awarding duplicate points',()=>{
  let session=createVerticalSession(1);
  for(let i=0;i<5;i++){
    for(const step of verticalSteps(session.questions[i]))session=submit(session,step.expected);
    const last=verticalFeedback(session),score=verticalScore(session);
    assert.equal(last.correct,true);
    assert.deepEqual(verticalFeedback(reduceVertical(session,{type:'input',key:'Enter'})),last);
    assert.equal(verticalScore(session),score);
    session=reduceVertical(session,{type:'next'});
    if(i<4)assert.equal(verticalFeedback(session),null);
    else{assert.equal(session.completed,true);assert.deepEqual(verticalFeedback(session),last);}
  }
});
