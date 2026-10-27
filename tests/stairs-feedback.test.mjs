import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STAIRS_GATE, createStairsRun, reduceStairsRun, stairsScore, stairsSteps } from '../src/game/stairsRun.ts';
import { stairsStreak, stairsStreakTier } from '../src/game/stairsFeedback.ts';
import { playStairsRun } from './stairs-player.mjs';

const rightMove=run=>run.steps[run.height]===run.facing?'climb':'turn';
const answer=(run,digit,ms)=>reduceStairsRun(reduceStairsRun(run,{type:'input',key:String(digit)}),{type:'input',key:'Enter',ms});

test('streak tiers count successful stairs at 5, 10 and 20; visual feedback does not change points',()=>{
  for(const height of [0,4,5,9,10,19,20,40]){
    const run=playStairsRun(42,{stopAfter:height,wrongEvery:Infinity}),score=stairsScore(run);
    assert.equal(stairsStreak(run),height);
    assert.equal(stairsStreakTier(stairsStreak(run)),height>=20?3:height>=10?2:height>=5?1:0);
    assert.equal(stairsScore(run),score);
  }
});

test('a direction mistake clears the effect and the next successful stair starts at one',()=>{
  const stopped=playStairsRun(42,{stopAfter:21,wrongEvery:Infinity});
  const run={...stopped,phase:'climb',ended:null};
  const wrong=reduceStairsRun(run,{type:rightMove(run)==='climb'?'turn':'climb'});
  assert.equal(wrong.lives,run.lives-1);
  assert.equal(stairsStreak(wrong),0);
  assert.equal(stairsStreakTier(stairsStreak(wrong)),0);
  const next=reduceStairsRun(wrong,{type:rightMove(wrong)});
  assert.equal(stairsStreak(next),1);
});

test('an ordinary math error preserves the streak; losing a life to mashing resets it',()=>{
  let run=createStairsRun(42);
  while(run.height<STAIRS_GATE)run=reduceStairsRun(run,{type:rightMove(run)});
  const expected=stairsSteps(run.problem)[run.problem.stepIndex].expected;
  run=answer(run,(expected+1)%10,3000);
  assert.equal(stairsStreak(run),STAIRS_GATE);
  run=answer(run,(expected+1)%10,3500);
  assert.equal(stairsStreak(run),0);
  while(run.phase==='solve')run=answer(run,stairsSteps(run.problem)[run.problem.stepIndex].expected,6000);
  assert.equal(stairsStreak(run),0);
  run=reduceStairsRun(run,{type:rightMove(run)});
  assert.equal(stairsStreak(run),1);
});
