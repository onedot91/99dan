import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STAIRS_AHEAD, STAIRS_COIN_POINTS, STAIRS_GATE, STAIRS_LIVES, createStairsRun, reduceStairsRun, replayStairsRun, stairsDifficulty, stairsHasCoin, stairsPreviewSteps, stairsScore, stairsSteps, stairsToNextGate } from '../src/game/stairsRun.ts';
import { difficultyOf } from '../src/game/vertical.ts';
import { playStairsRun } from './stairs-player.mjs';

const rightMove=run=>run.steps[run.height]===run.facing?'climb':'turn';
const wrongMove=run=>rightMove(run)==='climb'?'turn':'climb';
const climbTo=(run,height)=>{while(run.height<height&&run.phase==='climb')run=reduceStairsRun(run,{type:rightMove(run)});return run;};
const answer=(run,digit,ms)=>reduceStairsRun(reduceStairsRun(run,{type:'input',key:String(digit)}),{type:'input',key:'Enter',ms});

test('the right move climbs one stair and keeps enough stairs ahead',()=>{
  let run=createStairsRun(11);
  assert.equal(run.lives,STAIRS_LIVES);
  for(let i=0;i<STAIRS_GATE-1;i++){const before=run;run=reduceStairsRun(run,{type:rightMove(run)});assert.equal(run.height,before.height+1);}
  assert.ok(run.steps.length>=run.height+20);
});

test('a tall scene can preview beyond the generated path without changing the run or future stairs',()=>{
  for(const seed of [1,42,99]){
    const run=createStairsRun(seed),rng=run.stairRng;
    Object.freeze(run.steps);Object.freeze(run);
    const preview=stairsPreviewSteps(run,200);
    assert.equal(preview.length,200);
    assert.equal(run.steps.length,STAIRS_AHEAD);
    assert.equal(run.stairRng,rng);
    assert.deepEqual(preview.slice(0,run.steps.length),run.steps);
    const played=playStairsRun(seed,{stopAfter:180,wrongEvery:Infinity});
    assert.deepEqual(played.steps.slice(0,200),preview);
    assert.equal(stairsPreviewSteps(played,2),played.steps,'reuse the existing path when it already covers the scene');
  }
});

test('a wrong move costs a life, stays put, and keeps the facing',()=>{
  let run=createStairsRun(12);
  const before=run;run=reduceStairsRun(run,{type:wrongMove(run)});
  assert.equal(run.height,0);assert.equal(run.lives,STAIRS_LIVES-1);assert.equal(run.facing,before.facing);assert.equal(run.slips,1);
  assert.equal(rightMove(run),rightMove(before));
  run=reduceStairsRun(run,{type:wrongMove(run)});run=reduceStairsRun(run,{type:wrongMove(run)});
  assert.equal(run.phase,'over');assert.equal(run.ended,'fallen');assert.equal(run.lives,0);
});

test('problems appear at floors 7, 14 and 21; climbing is locked until each is solved',()=>{
  let run=createStairsRun(13);const gates=[];
  assert.equal(stairsToNextGate(run),7);
  for(let height=1;height<=21;height++){
    run=reduceStairsRun(run,{type:rightMove(run)});
    assert.equal(stairsToNextGate(run),7-height%7);
    if(height%7!==0){assert.equal(run.phase,'climb',`floor ${height}`);continue;}
    gates.push(height);
    assert.equal(run.phase,'solve');assert.equal(run.height,height);
    assert.equal(reduceStairsRun(run,{type:'climb'}),run);
    for(const step of stairsSteps(run.problem))run=answer(run,step.expected,3000);
    assert.equal(run.phase,'climb');assert.equal(run.solved,gates.length);
    assert.equal(stairsScore(run),height*10+gates.length*200+run.coins*STAIRS_COIN_POINTS);
  }
  assert.deepEqual(gates,[7,14,21]);
});

test('coins vary by seed, stay fixed when previewing, and never occupy the starting or problem stairs',()=>{
  const heights=Array.from({length:200},(_,i)=>i);
  const positions=seed=>heights.filter(height=>stairsHasCoin(seed,height));
  const run=createStairsRun(42),before=positions(run.seed),rng=run.stairRng;
  assert.ok(before.length>0&&before.length<heights.length);
  assert.ok(before.every(height=>height>0&&height%STAIRS_GATE!==0));
  stairsPreviewSteps(run,300);
  assert.deepEqual(positions(run.seed),before);
  assert.equal(run.stairRng,rng);
  assert.notDeepEqual(positions(43),before);
});

test('landing collects each coin once, wrong moves do not, and replay includes the same bonus',()=>{
  for(const seed of [1,42,99]){
    const coinFloor=Array.from({length:100},(_,i)=>i+1).find(height=>stairsHasCoin(seed,height));
    const stopped=playStairsRun(seed,{stopAfter:coinFloor,wrongEvery:Infinity});
    const before=playStairsRun(seed,{stopAfter:coinFloor-1,wrongEvery:Infinity});
    assert.equal(stopped.coins,before.coins+1);
    assert.equal(stairsScore(stopped)-stairsScore(before),10+STAIRS_COIN_POINTS);
    const active={...stopped,phase:'climb',ended:null};
    const wrong=reduceStairsRun(active,{type:wrongMove(active)});
    assert.equal(wrong.coins,active.coins);
    assert.equal(stairsScore(wrong),stairsScore(active));
    const run=playStairsRun(seed,{stopAfter:60,wrongEvery:Infinity});
    const count=Array.from({length:run.height},(_,i)=>i+1).filter(height=>stairsHasCoin(seed,height)).length;
    assert.equal(run.coins,count);
    assert.equal(stairsScore(run),run.height*10+run.solved*200+count*STAIRS_COIN_POINTS);
    const replay=replayStairsRun(seed,run.log,run.ended);
    assert.equal(replay.coins,count);
    assert.equal(stairsScore(replay),stairsScore(run));
  }
});

test('a plain wrong answer keeps lives; mashing (fast retry or third miss on a problem) costs one',()=>{
  let run=climbTo(createStairsRun(14),STAIRS_GATE);
  const step=stairsSteps(run.problem)[0],miss=(step.expected+1)%10;
  run=answer(run,miss,3000);assert.equal(run.lives,STAIRS_LIVES);assert.equal(run.mistakes,1);
  run=answer(run,miss,3500);assert.equal(run.lives,STAIRS_LIVES-1,'within a second of the last miss');
  run=answer(run,miss,9000);assert.equal(run.lives,STAIRS_LIVES-2,'third miss on the same problem');
  run=answer(run,miss,20000);assert.equal(run.phase,'over');assert.equal(run.ended,'fallen');
});

test('wrong answers across different cells count toward the same problem, then reset',()=>{
  let run=climbTo(createStairsRun(14),STAIRS_GATE);
  for(let i=0;i<3;i++){
    const step=stairsSteps(run.problem)[run.problem.stepIndex];
    run=answer(run,(step.expected+1)%10,3000+i*10000);
    assert.equal(run.lives,i===2?STAIRS_LIVES-1:STAIRS_LIVES);
    run=answer(run,step.expected,8000+i*10000);
  }
  while(run.phase==='solve'){const step=stairsSteps(run.problem)[run.problem.stepIndex];run=answer(run,step.expected,50000);}
  run=climbTo(run,STAIRS_GATE*2);
  const step=stairsSteps(run.problem)[0];
  run=answer(run,(step.expected+1)%10,3000);
  assert.equal(run.lives,STAIRS_LIVES-1,'the next problem starts with no wrong answers');
  run=reduceStairsRun(run,{type:'stop'});
  assert.deepEqual(replayStairsRun(run.seed,run.log,run.ended),run);
});

test('problems get harder the more are solved',()=>{
  assert.deepEqual([0,2,3,7,8,30].map(stairsDifficulty),[1,1,2,2,3,3]);
  const run=playStairsRun(15,{stopAfter:STAIRS_GATE*12});
  assert.deepEqual(run.history.map(difficultyOf),run.history.map((_,i)=>stairsDifficulty(i)));
});

test('replaying the same seed and log reproduces fallen and stopped runs exactly',()=>{
  for(let seed=1;seed<=30;seed++){
    for(const options of [{slipEvery:9,mashEvery:11},{stopAfter:seed%17},{stopAfter:STAIRS_GATE*(seed%4+1),stopWhileSolving:true}]){
      const run=playStairsRun(seed*2654435761>>>0,options);
      const replayed=replayStairsRun(run.seed,run.log,run.ended);
      assert.ok(replayed,`seed ${seed} ${JSON.stringify(options)}`);
      assert.equal(stairsScore(replayed),stairsScore(run));assert.equal(replayed.height,run.height);assert.equal(replayed.lives,run.lives);
    }
  }
});

test('a tampered log is rejected',()=>{
  const run=playStairsRun(99,{slipEvery:13,mashEvery:7});
  assert.equal(run.ended,'fallen');
  assert.equal(replayStairsRun(run.seed,[...run.log,'climb'],'fallen'),null,'extra entry');
  assert.equal(replayStairsRun(run.seed,run.log,'stopped'),null,'wrong ending');
  assert.equal(replayStairsRun(run.seed,run.log.slice(0,-1),'fallen'),null,'missing the fatal entry');
  const answerAt=run.log.findIndex(e=>typeof e==='object');
  assert.equal(replayStairsRun(run.seed,run.log.map((e,i)=>i===answerAt-1?{answer:1}:e),'fallen'),null,'an answer while climbing');
  assert.equal(replayStairsRun(run.seed,run.log.map((e,i)=>i===answerAt?{answer:12}:e),'fallen'),null,'a two-digit cell answer');
  assert.equal(replayStairsRun(run.seed+1,run.log,'fallen'),null,'another seed');
});

test('the Edge Function replays with the same stairs engine',async()=>{
  const { readFile }=await import('node:fs/promises');
  const { STAIRS_ENGINE_FILES }=await import('../scripts/sync-edge-block.mjs');
  for(const file of STAIRS_ENGINE_FILES)assert.equal(await readFile(new URL(`../supabase/functions/gugudan-api/stairs/${file}`,import.meta.url),'utf8'),await readFile(new URL(`../src/game/${file}`,import.meta.url),'utf8'),`${file}: run node scripts/sync-edge-block.mjs`);
});
