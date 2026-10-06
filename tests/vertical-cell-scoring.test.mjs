import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseMixedVerticalQuestions, createVerticalSession, parseVerticalSession, reduceVertical, verticalCellPoints, verticalQuestionSteps, verticalScore, verticalTimePenalty, withDirectZeroQuestions, withVerticalPuzzles } from '../src/game/vertical.ts';
import { verticalFeedback } from '../src/game/verticalFeedback.ts';

const answer=(s,n,ms)=>reduceVertical(reduceVertical(s,{type:'input',key:String(n)}),{type:'input',key:'Enter',ms});
test('a 13-cell question gives visibly different points at every second band',()=>{
 const expectations=[15,15,14,13,12,12,11,10,9,9,8,7,6,6,5,4,3,3,2,1];
 for(let seconds=1;seconds<=20;seconds++)assert.equal(verticalCellPoints(13,0,seconds*1000),expectations[seconds-1]);
 assert.equal(verticalCellPoints(13,0,2000),15);
 assert.equal(verticalCellPoints(13,0,2001),14);
 assert.equal(verticalCellPoints(13,0,3000),14);
 assert.equal(verticalCellPoints(13,0,3001),13);
 assert.equal(verticalCellPoints(13,0,1000000000),1);
});
test('each cell gets its own timestamp, including entered zeros and carries, without averaging',()=>{
 let s=createVerticalSession(3,crypto.randomUUID(),Array(5).fill({a:59,b:96}),true,true,true,true);
 const steps=verticalQuestionSteps(s.questions[0],true),gains=[];
 for(const [i,step] of steps.entries()){
  const before=verticalScore(s),ms=i%2?10000:2000;
  s=answer(s,step.expected,ms);gains.push(verticalScore(s)-before);
  assert.equal(gains[i],verticalCellPoints(steps.length,i,ms));
  assert.equal(verticalFeedback(s).amount,gains[i]);
 }
 assert.ok(gains.some(n=>n<=9));assert.ok(gains.some(n=>n>=15));
 assert.equal(verticalTimePenalty(s),200-verticalScore(s));
});
test('wrong answers cost ten points, retries keep elapsed time and typing gives no points',()=>{
 let s=createVerticalSession(3,crypto.randomUUID(),Array(5).fill({a:59,b:96}),true,true,true,true);
 const steps=verticalQuestionSteps(s.questions[0],true);
 s=answer(s,steps[0].expected,2000);const previous=verticalScore(s);
 s=answer(s,(steps[1].expected+1)%10,3000);assert.equal(verticalScore(s),previous-10);assert.equal(verticalFeedback(s).amount,-10);
 s=answer(s,(steps[1].expected+1)%10,5000);assert.equal(verticalScore(s),0);
 s=reduceVertical(s,{type:'input',key:String(steps[1].expected)});assert.equal(verticalScore(s),0);
 s=reduceVertical(s,{type:'input',key:'Enter',ms:4000});assert.equal(s.events.at(-1).ms,5000);
 assert.equal(verticalScore(s),Math.max(0,previous+verticalCellPoints(steps.length,1,5000)-20));
});
test('five and ten questions have the same 200-point maximum per problem, including unordered puzzles',()=>{
 for(const count of [5,10])for(const difficulty of [1,2,3]){
  const facts=withDirectZeroQuestions(withVerticalPuzzles(chooseMixedVerticalQuestions(difficulty,()=>.6,count),difficulty,()=>.5,true,true));
  for(const ms of [2000,2001,3000,3001,5000,10000,15000,20000]){
   let s=createVerticalSession(difficulty,crypto.randomUUID(),facts,true,true,true,true),expected=0;
   for(const fact of facts){
    const steps=verticalQuestionSteps(fact,true),order=steps.map((_,i)=>i);
    if(fact.holes)order.reverse();
    for(const i of order){
     if(fact.holes)s=reduceVertical(s,{type:'select',step:i});
     s=answer(s,steps[i].expected,ms);expected+=verticalCellPoints(steps.length,i,ms);
    }
    s=reduceVertical(s,{type:'next'});
   }
   assert.equal(verticalScore(s),expected);
   if(ms===2000)assert.equal(expected,count*200);
   assert.deepEqual(parseVerticalSession(JSON.parse(JSON.stringify(s))),s);
  }
 }
});
test('previous sessions keep the old penalty and cell scoring requires timing flags',()=>{
 const facts=withDirectZeroQuestions(chooseMixedVerticalQuestions(3,()=>.6,5));
 let old=createVerticalSession(3,crypto.randomUUID(),facts,true,true,true);
 const steps=verticalQuestionSteps(facts[0],true);
 old=answer(old,steps[0].expected,2000);const before=verticalScore(old);
 old=answer(old,(steps[1].expected+1)%10,3000);assert.equal(verticalScore(old),Math.max(0,before-30));
 assert.deepEqual(parseVerticalSession(JSON.parse(JSON.stringify(old))),old);
 for(const invalid of [{...old,cellScoring:'true'},{...old,cellScoring:false},{...old,cellScoring:true,tightTime:undefined},{...old,cellScoring:true,timeScoring:undefined}])assert.equal(parseVerticalSession(invalid),null);
});
