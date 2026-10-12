import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DIVISION_LESSONS, createDivisionProblem, divisionLessonOf, divisionPool, divisionSolved, divisionSteps, nextDivisionFact, reduceDivision, seededRandom } from '../src/game/division.ts';

const sequence=fact=>divisionSteps(fact).map(s=>s.expected).join(' ');
const read=(steps,row,stage)=>steps.filter(s=>s.row===row&&(stage===undefined||s.stage===stage)).reduce((value,s)=>value+s.expected*10**s.place,0);

test('textbook examples follow the reference order',()=>{
  assert.equal(sequence({dividend:42,divisor:2,lesson:3}),'2 4 2 1 2 0');
  assert.equal(sequence({dividend:60,divisor:3,lesson:2}),'2 0');
  assert.equal(sequence({dividend:70,divisor:5,lesson:4}),'1 5 2 0 4 2 0 0');
  assert.equal(sequence({dividend:75,divisor:3,lesson:5}),'2 6 1 5 5 1 5 0');
  assert.equal(sequence({dividend:55,divisor:4,lesson:7}),'1 4 1 5 3 1 2 3');
  assert.equal(sequence({dividend:25,divisor:3,lesson:7}),'8 2 4 1');
  assert.equal(sequence({dividend:61,divisor:3,lesson:6}),'2 6 1 0');
  assert.equal(sequence({dividend:612,divisor:3,lesson:9}),'2 6 1 0 2 4 1 2 0');
  assert.equal(sequence({dividend:252,divisor:6,lesson:10}),'4 2 4 1 2 2 1 2 0');
  assert.equal(sequence({dividend:55,divisor:4,lesson:8}),'1 4 1 5 3 1 2 3 52 55');
});

test('42 ÷ 2 skips the zero difference and marks the brought-down digit',()=>{
  const steps=divisionSteps({dividend:42,divisor:2,lesson:3});
  assert.deepEqual(steps.map(s=>[s.row,s.stage,s.place,s.bringDown??false]),[['quotient',0,1,false],['product',0,1,false],['rest',0,0,true],['quotient',1,0,false],['product',1,0,false],['rest',1,0,false]]);
});

test('every pooled problem rebuilds its quotient, products, remainder and check',()=>{
  for(const lesson of DIVISION_LESSONS)for(const variant of [false,true]){
    const pool=divisionPool(lesson,variant);
    if(variant&&![6,7,9,10].includes(lesson)){assert.equal(pool.length,0);continue;}
    assert.ok(pool.length>=5,`lesson ${lesson} variant ${variant}`);
    for(const fact of pool){
      const steps=divisionSteps(fact),q=Math.floor(fact.dividend/fact.divisor),r=fact.dividend%fact.divisor;
      assert.equal(new Set(steps.map(s=>s.id)).size,steps.length);
      assert.ok(steps.every(s=>Number.isInteger(s.expected)&&s.expected>=0&&s.expected<=(s.row.startsWith('check')?999:9)));
      assert.equal(read(steps,'quotient'),q);
      if(lesson===2){assert.ok(steps.every(s=>s.row==='quotient'));continue;}
      const stages=Math.max(...steps.filter(s=>s.row==='product').map(s=>s.stage));
      assert.equal(read(steps,'rest',stages),r);
      for(let stage=0;stage<=stages;stage++){
        const product=steps.filter(s=>s.row==='product'&&s.stage===stage);
        const place=Math.min(...product.map(s=>s.place));
        assert.equal(read(steps,'product',stage),Math.floor(q/10**place)%10*fact.divisor*10**place);
      }
      assert.equal(String(q).includes('0'),variant&&lesson!==7);
      if(lesson===8){assert.equal(read(steps,'check-product'),fact.divisor*q);assert.equal(read(steps,'check-sum'),fact.dividend);assert.ok(r>0);}
      else assert.ok(!steps.some(s=>s.row.startsWith('check')));
    }
  }
});

test('rows that would start with a zero (200 ÷ 2, 602 ÷ 3) are never asked',()=>{
  const has=(lesson,dividend,divisor)=>divisionPool(lesson,true).some(f=>f.dividend===dividend&&f.divisor===divisor);
  assert.ok(!has(9,200,2));assert.ok(!has(9,602,3));assert.ok(has(9,612,3));assert.ok(has(9,840,4));
});

test('lesson classification matches the curriculum rules',()=>{
  assert.deepEqual(divisionLessonOf(80,4),{lesson:2,variant:false});
  assert.deepEqual(divisionLessonOf(69,3),{lesson:3,variant:false});
  assert.deepEqual(divisionLessonOf(90,6),{lesson:4,variant:false});
  assert.deepEqual(divisionLessonOf(96,4),{lesson:5,variant:false});
  assert.deepEqual(divisionLessonOf(47,2),{lesson:6,variant:false});
  assert.deepEqual(divisionLessonOf(61,3),{lesson:6,variant:true});
  assert.deepEqual(divisionLessonOf(97,4),{lesson:7,variant:false});
  assert.deepEqual(divisionLessonOf(25,3),{lesson:7,variant:true});
  assert.deepEqual(divisionLessonOf(536,4),{lesson:9,variant:false});
  assert.deepEqual(divisionLessonOf(840,4),{lesson:9,variant:true});
  assert.deepEqual(divisionLessonOf(252,6),{lesson:10,variant:false});
  assert.equal(divisionLessonOf(24,3),null);
  assert.equal(divisionLessonOf(70,4),null);
  assert.equal(divisionLessonOf(10,3),null);
});

test('random questions cover every lesson, never triple a lesson and never repeat the previous fact',()=>{
  const random=seededRandom(7),history=[];
  for(let i=0;i<3000;i++)history.push(nextDivisionFact(random,history));
  assert.deepEqual([...new Set(history.map(f=>f.lesson))].sort((a,b)=>a-b),[...DIVISION_LESSONS]);
  for(let i=2;i<history.length;i++)assert.ok(!(history[i].lesson===history[i-1].lesson&&history[i].lesson===history[i-2].lesson));
  for(let i=1;i<history.length;i++)assert.ok(history[i].dividend!==history[i-1].dividend||history[i].divisor!==history[i-1].divisor);
  const variants=history.filter(f=>[6,7,9,10].includes(f.lesson)&&divisionLessonOf(f.dividend,f.divisor).variant).length/history.filter(f=>[6,7,9,10].includes(f.lesson)).length;
  assert.ok(variants>.12&&variants<.28,String(variants));
});

test('the same seed makes the same questions',()=>{
  const run=seed=>{const random=seededRandom(seed),history=[];for(let i=0;i<20;i++)history.push(nextDivisionFact(random,history));return history;};
  assert.deepEqual(run(123),run(123));
  assert.notDeepEqual(run(123),run(124));
});

test('a problem accepts one digit at a time and counts wrong answers without moving on',()=>{
  let problem=createDivisionProblem({dividend:42,divisor:2,lesson:3});
  const press=(key,ms)=>{problem=reduceDivision(problem,{type:'input',key,ms});};
  press('Enter');assert.equal(problem.events.length,0);
  press('3');press('Enter',900);
  assert.equal(problem.stepIndex,0);assert.equal(problem.mistakes,1);
  for(const digit of [2,4,2,1,2,0]){press(String(digit));press('Enter',500);}
  assert.ok(divisionSolved(problem));
  assert.equal(problem.mistakes,1);
  assert.deepEqual(problem.events.map(e=>[e.step,e.answer]),[[0,3],[0,2],[1,4],[2,2],[3,1],[4,2],[5,0]]);
  press('5');assert.equal(problem.entry,'');
});

test('the check rows take the whole number at once (5 × 17 = 85, 85 + 2 = 87)',()=>{
  let problem=createDivisionProblem({dividend:87,divisor:5,lesson:8});
  const steps=divisionSteps(problem.fact),press=key=>{problem=reduceDivision(problem,{type:'input',key});};
  assert.deepEqual(steps.slice(-2).map(s=>[s.row,s.expected]),[['check-product',85],['check-sum',87]]);
  for(const s of steps.slice(0,-2)){press(String(s.expected));press('Enter');}
  press('8');press('6');press('Backspace');press('5');assert.equal(problem.entry,'85');
  press('Enter');assert.equal(problem.stepIndex,steps.length-1);
  press('8');press('7');press('1');press('2');assert.equal(problem.entry,'871');
  press('Enter');assert.equal(problem.mistakes,1);
  press('8');press('7');press('Enter');assert.ok(divisionSolved(problem));
});
