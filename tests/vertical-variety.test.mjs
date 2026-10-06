import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseMixedVerticalQuestions, createVerticalSession, digitAt, difficultyOf, parseVerticalQuestions, parseVerticalSession, reduceVertical, verticalQuestionSteps, verticalScore, verticalSteps, withVerticalPuzzles } from '../src/game/vertical.ts';
import { verticalCounts } from '../src/game/verticalSets.ts';
const seeded=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};

test('zero-unit multipliers occur in at most one question and about a quarter of sets, with shuffled carry types',()=>{
 for(const count of [5,10])for(const difficulty of [1,2,3]){
   const random=seeded(17),orders=new Set();let zeroSets=0;
   for(let i=0;i<400;i++){
     const questions=chooseMixedVerticalQuestions(difficulty,random,count),zeros=questions.filter(f=>f.b%10===0);
     assert.ok(zeros.length<=1);zeroSets+=Number(zeros.length>0);
     assert.equal(new Set(questions.map(f=>`${f.a}:${f.b}`)).size,count);
     assert.deepEqual([1,2,3].map(kind=>questions.filter(f=>difficultyOf(f)===kind).length),verticalCounts(difficulty,count));
     orders.add(questions.map(difficultyOf).join(''));
   }
   assert.ok(zeroSets>60&&zeroSets<140,`zero sets ${zeroSets}/400`);assert.ok(orders.size>3);
 }
});

test('operand holes have one possible digit because an informative partial product remains fully shown',()=>{
 for(let a=10;a<=99;a++)for(let b=10;b<=99;b++){
   const facts=withVerticalPuzzles(Array(10).fill({a,b}),3,()=>.9,true);
   const patterns=new Set();
   for(const fact of facts.filter(f=>f.holes)){
     const id=fact.holes[0];patterns.add(id.startsWith('operand-a')?'a':id==='operand-b:0'?'b0':id==='operand-b:1'?'b1':'partial');
     if(!id.startsWith('operand-'))continue;
     const [row,placeText]=id.split(':'),place=Number(placeText),operand=row==='operand-a'?a:b;
     const knownPartial=id==='operand-b:0'?a*(b%10):a*Math.floor(b/10)*10;
     const matches=[];
     for(let digit=place===1?1:0;digit<=9;digit++){
       const candidate=operand+(digit-digitAt(operand,place))*10**place;
       const product=row==='operand-a'?candidate*Math.floor(b/10)*10:id==='operand-b:0'?a*(candidate%10):a*Math.floor(candidate/10)*10;
       if(product===knownPartial)matches.push(digit);
     }
     assert.deepEqual(matches,[digitAt(operand,place)]);
     assert.equal(verticalQuestionSteps(fact,true)[0].expected,digitAt(operand,place));
   }
   assert.deepEqual([...patterns].sort(),['a','b0','b1','partial']);
 }
});

test('new operand puzzles accept any hole order, replay safely, and preserve old puzzle descriptors',()=>{
 for(const difficulty of [2,3]){
   const random=seeded(difficulty),questions=withVerticalPuzzles(chooseMixedVerticalQuestions(difficulty,random,10),difficulty,random,true);
   assert.deepEqual(parseVerticalQuestions(questions,difficulty,10,true,true),questions);
   assert.equal(parseVerticalQuestions(questions,difficulty,10,true),null);
   let session=createVerticalSession(difficulty,crypto.randomUUID(),questions,true,true);
   for(const fact of questions){
     const steps=verticalQuestionSteps(fact,true),order=steps.map((_,i)=>i);if(fact.holes)order.reverse();
     for(const index of order){
       if(fact.holes)session=reduceVertical(session,{type:'select',step:index});
       session=reduceVertical(reduceVertical(session,{type:'input',key:String(steps[index].expected)}),{type:'input',key:'Enter',ms:1000});
       assert.ok(parseVerticalSession(session));
     }
     session=reduceVertical(session,{type:'next'});
   }
   assert.equal(session.completed,true);assert.equal(verticalScore(session),2000);assert.deepEqual(parseVerticalSession(session),session);
   const old=withVerticalPuzzles(chooseMixedVerticalQuestions(difficulty,()=>.5,10),difficulty,()=>.5);
   assert.deepEqual(parseVerticalQuestions(old,difficulty,10,true,true),old);
   const bad=questions.map(f=>f.holes?.[0].startsWith('operand-')?{...f,holes:['operand-a:0','tens:1',...(difficulty===3?['sum:0']:[])]}:f);
   assert.equal(parseVerticalQuestions(bad,difficulty,10,true,true),null);
 }
});

test('66 × 90 begins with the full zero product and does not highlight 9 while placing the shift zero',()=>{
 const steps=verticalSteps({a:66,b:90},true);
 assert.deepEqual(steps.slice(0,3).map(s=>[s.id,s.expected,s.calculation,s.bPlace]),[['ones:0',0,'66 × 0',0],['tens:0',0,'일의 자리에 0',null],['tens:1',4,'6 × 9',1]]);
});
