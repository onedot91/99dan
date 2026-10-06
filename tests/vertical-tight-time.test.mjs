import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseMixedVerticalQuestions, createVerticalSession, parseVerticalSession, reduceVertical, verticalQuestionSteps, verticalScore, verticalTimePenalty, withDirectZeroQuestions, withVerticalPuzzles } from '../src/game/vertical.ts';

const answer=(s,n,ms)=>reduceVertical(reduceVertical(s,{type:'input',key:String(n)}),{type:'input',key:'Enter',ms});
function finish(s,time){
 for(const fact of s.questions){
  for(const [index,step] of verticalQuestionSteps(fact,s.manualZero).entries())s=answer(s,step.expected,typeof time==='function'?time(index):time);
  s=reduceVertical(s,{type:'next'});
 }
 return s;
}
test('tight timing distinguishes milliseconds and stays variable through 20 seconds per cell',()=>{
 for(const count of [5,10])for(const difficulty of [1,2,3]){
  const questions=withDirectZeroQuestions(withVerticalPuzzles(chooseMixedVerticalQuestions(difficulty,()=>.6,count),difficulty,()=>.5,true,true));
  for(const [ms,points] of [[0,200],[1999,200],[2000,200],[2299,200],[2300,199],[3000,197],[4000,194],[5000,190],[6000,187],[8000,180],[10000,174],[12000,167],[15000,157],[19999,141],[20000,140],[1000000000,140]]){
   const session=finish(createVerticalSession(difficulty,crypto.randomUUID(),questions,true,true,true),ms);
   assert.equal(verticalScore(session),points*count);assert.equal(verticalTimePenalty(session),(200-points)*count);
   assert.deepEqual(parseVerticalSession(JSON.parse(JSON.stringify(session))),session);
  }
 }
});
test('every cell is capped independently, so one slow cell cannot consume other cells’ fast points',()=>{
 let s=createVerticalSession(3,crypto.randomUUID(),Array(5).fill({a:59,b:96}),true,true,true);
 const steps=verticalQuestionSteps(s.questions[0],true);
 for(const [i,step] of steps.entries())s=answer(s,step.expected,i===0?1000000:2000);
 assert.equal(verticalTimePenalty(s),Math.floor(60/steps.length));
 assert.equal(verticalScore(s),200-Math.floor(60/steps.length));
});
test('wrong retries retain elapsed time, deduct 30, and only successful confirmation earns points',()=>{
 let s=createVerticalSession(1,crypto.randomUUID(),Array(5).fill({a:12,b:13}),true,true,true);
 const first=verticalQuestionSteps(s.questions[0],true)[0];
 s=answer(s,(first.expected+1)%10,3000);assert.equal(verticalScore(s),0);
 s=reduceVertical(s,{type:'input',key:String(first.expected)});assert.equal(verticalScore(s),0);
 s=reduceVertical(s,{type:'input',key:'Enter',ms:1000});assert.equal(s.events.at(-1).ms,3000);
 for(const step of verticalQuestionSteps(s.questions[0],true).slice(1))s=answer(s,step.expected,3000);
 assert.equal(verticalScore(s),167);
 assert.equal(verticalScore({...s,mistakes:[100,0,0,0,0]}),0);
});
test('tight scores change immediately after each confirmed cell, including carries and the shift zero',()=>{
 let s=createVerticalSession(3,crypto.randomUUID(),Array(5).fill({a:59,b:96}),true,true,true);
 const steps=verticalQuestionSteps(s.questions[0],true);
 for(const [i,step] of steps.entries()){
  const before=verticalScore(s);s=reduceVertical(s,{type:'input',key:String(step.expected)});assert.equal(verticalScore(s),before);
  s=reduceVertical(s,{type:'input',key:'Enter',ms:20000});
  assert.equal(verticalScore(s),Math.floor((i+1)*200/steps.length)-Math.floor((i+1)*60/steps.length));
 }
 assert.equal(verticalScore(s),140);
});
test('legacy timed and untimed sessions keep their previous scoring rule',()=>{
 const questions=chooseMixedVerticalQuestions(1,()=>.6);
 for(const timed of [false,true]){
  const s=finish(createVerticalSession(1,crypto.randomUUID(),questions,timed,true),8000);
  assert.equal(verticalScore(s),timed?995:1000);assert.equal(s.tightTime,undefined);
  assert.deepEqual(parseVerticalSession(s),s);
 }
 const s=createVerticalSession(1);
 for(const value of [{...s,tightTime:true},{...s,timeScoring:true,tightTime:false},{...s,timeScoring:true,tightTime:'true'},{...s,version:3,timeScoring:true,tightTime:true}])assert.equal(parseVerticalSession(value),null);
});
