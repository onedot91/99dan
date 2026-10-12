import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { blockScore, replayBlockRun } from '../src/game/blockRun.ts';
import { playBlockRun } from './block-player.mjs';
import { BLOCK_ENGINE_FILES } from '../scripts/sync-edge-block.mjs';

test('every answer check is logged across problems, with its time',()=>{
  const run=playBlockRun(77,{stopAfter:9});
  const perProblem=run.answers.filter(a=>a.ms===700).length;
  assert.equal(perProblem,run.mistakes);
  assert.ok(run.answers.every(a=>Number.isInteger(a.answer)&&a.answer>=0&&a.answer<=999&&Number.isInteger(a.ms)));
});

test('replaying the same seed and logs reproduces stuck and stopped runs exactly',()=>{
  for(let seed=1;seed<=40;seed++){
    for(const options of [{},{stopAfter:seed%12},{stopAfter:seed%9+1,stopWhileSolving:true}]){
      const run=playBlockRun(seed*2654435761>>>0,options);
      const replayed=replayBlockRun(run.seed,run.answers,run.moves,run.ended);
      assert.ok(replayed,`seed ${seed} ${JSON.stringify(options)}`);
      assert.equal(blockScore(replayed),blockScore(run));
      assert.deepEqual([replayed.solved,replayed.mistakes,replayed.lines,replayed.ended,replayed.board],[run.solved,run.mistakes,run.lines,run.ended,run.board]);
    }
  }
});

test('replay rejects logs that do not fit the seed',()=>{
  const run=playBlockRun(4242),stopped=playBlockRun(4242,{stopAfter:6});
  assert.equal(run.ended,'stuck');assert.equal(stopped.ended,'stopped');
  // 다른 시드, 끝난 방식 바꾸기, 남는 기록, 판 밖·이미 찬 자리, 숫자가 아닌 답.
  assert.equal(replayBlockRun(run.seed+1,run.answers,run.moves,'stuck'),null);
  assert.equal(replayBlockRun(run.seed,run.answers,run.moves,'stopped'),null);
  assert.equal(replayBlockRun(stopped.seed,stopped.answers,stopped.moves,'stuck'),null);
  assert.equal(replayBlockRun(run.seed,[...run.answers,{answer:1}],run.moves,'stuck'),null);
  assert.equal(replayBlockRun(run.seed,run.answers,[...run.moves,{piece:0,row:0,col:0}],'stuck'),null);
  assert.equal(replayBlockRun(stopped.seed,stopped.answers,[...stopped.moves.slice(0,-1),{piece:0,row:9,col:9}],'stopped'),null);
  assert.equal(replayBlockRun(stopped.seed,stopped.answers,[...stopped.moves.slice(0,1),stopped.moves[0]],'stopped'),null);
  assert.equal(replayBlockRun(stopped.seed,stopped.answers.map((a,i)=>i===0?{answer:10}:a),stopped.moves,'stopped'),null);
  assert.equal(replayBlockRun(stopped.seed,stopped.answers,stopped.moves.map((m,i)=>i===0?{...m,row:.5}:m),'stopped'),null);
  assert.equal(replayBlockRun(-1,[],[],'stopped'),null);
  // 아무것도 하지 않고 그만둔 판은 0점으로 재생된다.
  assert.equal(blockScore(replayBlockRun(9,[],[],'stopped')),0);
});

test('the edge function replays with an identical copy of the block engine',async()=>{
  for(const file of BLOCK_ENGINE_FILES)assert.equal(await readFile(new URL(`../supabase/functions/gugudan-api/block/${file}`,import.meta.url),'utf8'),await readFile(new URL(`../src/game/${file}`,import.meta.url),'utf8'),`${file}: run node scripts/sync-edge-block.mjs`);
});
