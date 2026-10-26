import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STAIRS_GATE, STAIRS_LIVES, createStairsRun, reduceStairsRun, replayStairsRun, stairsDifficulty, stairsScore, stairsSteps } from '../src/game/stairsRun.ts';
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

test('a wrong move costs a life, stays put, and keeps the facing',()=>{
  let run=createStairsRun(12);
  const before=run;run=reduceStairsRun(run,{type:wrongMove(run)});
  assert.equal(run.height,0);assert.equal(run.lives,STAIRS_LIVES-1);assert.equal(run.facing,before.facing);assert.equal(run.slips,1);
  assert.equal(rightMove(run),rightMove(before));
  run=reduceStairsRun(run,{type:wrongMove(run)});run=reduceStairsRun(run,{type:wrongMove(run)});
  assert.equal(run.phase,'over');assert.equal(run.ended,'fallen');assert.equal(run.lives,0);
});

test('every fifth stair stops for a two-digit problem; climbing is locked until it is solved',()=>{
  let run=climbTo(createStairsRun(13),STAIRS_GATE);
  assert.equal(run.phase,'solve');assert.equal(run.height,STAIRS_GATE);
  assert.equal(reduceStairsRun(run,{type:'climb'}),run);
  for(const step of stairsSteps(run.problem))run=answer(run,step.expected,3000);
  assert.equal(run.phase,'climb');assert.equal(run.solved,1);
  assert.equal(stairsScore(run),STAIRS_GATE*10+200);
});

test('a plain wrong answer keeps lives; mashing (fast retry or third miss on a cell) costs one',()=>{
  let run=climbTo(createStairsRun(14),STAIRS_GATE);
  const step=stairsSteps(run.problem)[0],miss=(step.expected+1)%10;
  run=answer(run,miss,3000);assert.equal(run.lives,STAIRS_LIVES);assert.equal(run.mistakes,1);
  run=answer(run,miss,3500);assert.equal(run.lives,STAIRS_LIVES-1,'within a second of the last miss');
  run=answer(run,miss,9000);assert.equal(run.lives,STAIRS_LIVES-2,'third miss on the same cell');
  run=answer(run,miss,20000);assert.equal(run.phase,'over');assert.equal(run.ended,'fallen');
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
