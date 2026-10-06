import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseMixedVerticalQuestions, createVerticalSession, difficultyOf, parseVerticalQuestions, parseVerticalSession, reduceVertical, verticalQuestionSteps, verticalScore, verticalSteps, withDirectZeroQuestions, withVerticalPuzzles } from '../src/game/vertical.ts';

test('all 810 zero-unit multipliers write the final product once, retaining only multiplication carries',()=>{
 for(let a=10;a<=99;a++)for(let b=10;b<=90;b+=10){
   const fact={a,b,directZero:true},steps=verticalQuestionSteps(fact,true);
   assert.equal(steps[0].id,'sum:0');assert.equal(steps[0].expected,0);
   assert.ok(steps.every(s=>s.stage==='tens'&&(s.row==='sum'||s.row==='carry-tens')));
   const digits=steps.filter(s=>s.row==='sum');
   assert.equal(digits.reduce((value,s)=>value+s.expected*10**s.place,0),a*b);
   assert.equal(digits.length,String(a*b).length);
   assert.equal(difficultyOf(fact),difficultyOf({a,b}));
 }
 assert.deepEqual(verticalSteps({a:66,b:90,directZero:true},true).map(s=>[s.id,s.expected]),[['sum:0',0],['sum:1',4],['carry-tens:2',5],['sum:2',9],['sum:3',5]]);
 assert.equal(verticalSteps({a:66,b:90},true)[0].id,'ones:0');
});

test('new five/ten-question sets preserve difficulty quotas and puzzles while zero multipliers use one row',()=>{
 let seed=123;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(const count of [5,10])for(const difficulty of [1,2,3])for(let n=0;n<100;n++){
   const original=chooseMixedVerticalQuestions(difficulty,random,count);
   const questions=withDirectZeroQuestions(withVerticalPuzzles(original,difficulty,random,true,true));
   assert.deepEqual(parseVerticalQuestions(questions,difficulty,count,true,true,true),questions);
   assert.deepEqual(questions.map(difficultyOf),original.map(difficultyOf));
   assert.equal(questions.filter(f=>f.holes).length,count===10&&difficulty>1?difficulty===2?3:5:0);
   assert.ok(questions.filter(f=>f.b%10===0).every(f=>f.directZero===true&&!f.holes));
 }
});

test('single-row transcripts validate real zero inputs, wrong penalties, individual cell times and replay',()=>{
 for(const count of [5,10]){
   const original=[...chooseMixedVerticalQuestions(1,()=>.6,count)];
   original[original.findIndex(f=>difficultyOf(f)===2)]={a:66,b:90};
   const questions=withDirectZeroQuestions(original);
   let session=createVerticalSession(1,crypto.randomUUID(),questions,true,true);
   for(const fact of questions){
     const steps=verticalQuestionSteps(fact,true);
     for(const step of steps){
       if(fact.directZero&&step.id==='sum:0'){
         const old=session.stepIndex;
         session=reduceVertical(reduceVertical(session,{type:'input',key:'1'}),{type:'input',key:'Enter',ms:2000});
         assert.equal(session.stepIndex,old);
       }
       session=reduceVertical(reduceVertical(session,{type:'input',key:String(step.expected)}),{type:'input',key:'Enter',ms:10000});
       assert.deepEqual(parseVerticalSession(session),session);
     }
     session=reduceVertical(session,{type:'next'});
   }
   assert.equal(session.completed,true);assert.equal(verticalScore(session),count*198-30);
   assert.deepEqual(parseVerticalSession(session),session);
   assert.equal(parseVerticalSession({...session,questions:questions.map(({directZero,...f})=>f)}),null);
 }
});

test('direct mode rejects invalid flags, nonzero multipliers, puzzles and mode mismatches',()=>{
 const questions=withDirectZeroQuestions(chooseMixedVerticalQuestions(1,()=>0));
 assert.ok(questions.some(f=>f.directZero));
 assert.equal(parseVerticalQuestions(questions,1,5,true,true),null);
 const index=questions.findIndex(f=>f.directZero);
 for(const changed of [{...questions[index],directZero:false},{...questions[index],b:11},{...questions[index],holes:['ones:0','tens:1']}]){
   const corrupted=[...questions];corrupted[index]=changed;
   assert.equal(parseVerticalQuestions(corrupted,1,5,true,true,true),null);
 }
 const session=createVerticalSession(1,crypto.randomUUID(),questions,true,true);
 assert.equal(parseVerticalSession({...session,manualZero:undefined}),null);
 const previous=chooseMixedVerticalQuestions(1,()=>0);
 assert.deepEqual(parseVerticalSession(createVerticalSession(1,crypto.randomUUID(),previous,true,true)).questions,previous);
});
