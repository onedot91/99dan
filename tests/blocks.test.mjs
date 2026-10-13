import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_SHAPES, BLOCK_COLORS, BLOCK_HELP, clearPotential, BOARD_SIZE, shapeColor, SHAPES, blockTier, drawPieces, emptyBoard, fits, fitsAnywhere, place, shapeById } from '../src/game/blocks.ts';
import { BLOCK_MASH_MS, BLOCK_MASH_PENALTY, blockScore, createBlockRun, reduceBlockRun, blockPieces } from '../src/game/blockRun.ts';
import { divisionSteps, seededRandom } from '../src/game/division.ts';

const boardWith=cells=>{const b=emptyBoard();for(const [r,c] of cells)b[r*BOARD_SIZE+c]=1;return b;};

test('shapes have unique ids, sizes match their group and start at the top-left',()=>{
  assert.equal(new Set(ALL_SHAPES.map(s=>s.id)).size,ALL_SHAPES.length);
  for(const s of SHAPES.small)assert.ok(s.cells.length<=3);
  for(const s of SHAPES.medium)assert.equal(s.cells.length,4);
  for(const s of SHAPES.large)assert.ok(s.cells.length>=5);
  for(const s of ALL_SHAPES){assert.equal(Math.min(...s.cells.map(c=>c[0])),0);assert.equal(Math.min(...s.cells.map(c=>c[1])),0);}
});

test('a piece fits only inside the board on empty cells',()=>{
  const h3=shapeById('h3');
  assert.ok(fits(emptyBoard(),h3,0,5));
  assert.ok(!fits(emptyBoard(),h3,0,6));
  assert.ok(!fits(boardWith([[2,3]]),h3,2,1));
  assert.ok(!fitsAnywhere(boardWith(Array.from({length:64},(_,i)=>[Math.floor(i/8),i%8]).filter(([r,c])=>!(r===0&&c===0))),h3));
});

test('filling a row and a column at once clears both and scores the bonus',()=>{
  const cells=[];for(let c=0;c<7;c++)cells.push([7,c]);for(let r=0;r<7;r++)cells.push([r,7]);
  const result=place(boardWith(cells),shapeById('dot'),7,7);
  assert.deepEqual(result.rows,[7]);assert.deepEqual(result.cols,[7]);
  assert.ok(result.board.every(v=>!v));
  assert.equal(result.points,1+2*20+10);
  assert.equal(place(emptyBoard(),shapeById('sq2'),0,0).points,4);
});

test('blocks get harder as more problems are solved',()=>{
  assert.deepEqual([0,2,3,9,10,19,20].map(n=>blockTier(n).guarantee),[3,3,3,3,1,1,0]);
  assert.ok(blockTier(0).large>0);
  assert.ok(blockTier(10).large>blockTier(0).large&&blockTier(30).large>blockTier(20).large);
  for(const n of [0,10,20,30,60]){const t=blockTier(n);assert.ok(Math.abs(t.small+t.medium+t.large-1)<1e-9);}
  const random=seededRandom(3),early=Array.from({length:200},()=>drawPieces(random,emptyBoard(),0)).flat();
  // 처음부터 세 크기가 모두 나와 다양하다.
  for(const group of [SHAPES.small,SHAPES.medium,SHAPES.large])assert.ok(early.filter(p=>group.includes(p)).length>60);
  assert.ok(new Set(early.map(p=>p.id)).size>=25);
  const late=Array.from({length:200},()=>drawPieces(random,emptyBoard(),40)).flat();
  assert.ok(late.filter(p=>SHAPES.large.includes(p)).length>100);
});

test('early draws always fit; a crowded board falls back to single cells',()=>{
  const crowded=boardWith(Array.from({length:64},(_,i)=>[Math.floor(i/8),i%8]).filter(([r,c])=>(r+c)%2===0||r===7));
  const pieces=drawPieces(seededRandom(9),crowded,0);
  assert.ok(pieces.every(p=>fitsAnywhere(crowded,p)));
  assert.ok(pieces.some(p=>p.id==='dot'));
});

const solve=run=>{for(const step of divisionSteps(run.problem.fact)){for(const key of String(step.expected))run=reduceBlockRun(run,{type:'input',key});run=reduceBlockRun(run,{type:'input',key:'Enter'});}return run;};
const placeAll=run=>{
  for(let i=0;i<3&&run.phase==='place';i++){
    const piece=blockPieces(run)[i];if(!piece)continue;
    let done=false;
    for(let r=0;r<8&&!done;r++)for(let c=0;c<8&&!done;c++){const next=reduceBlockRun(run,{type:'place',piece:i,row:r,col:c});if(next!==run){run=next;done=true;}}
  }
  return run;
};

test('a run alternates solving and placing, and a single wrong answer costs nothing',()=>{
  let run=createBlockRun(42);
  assert.equal(run.phase,'solve');
  assert.equal(reduceBlockRun(run,{type:'place',piece:0,row:0,col:0}),run);
  const wrong=String((divisionSteps(run.problem.fact)[0].expected+1)%10);
  run=reduceBlockRun(reduceBlockRun(run,{type:'input',key:wrong}),{type:'input',key:'Enter'});
  assert.equal(run.mistakes,1);
  run=solve(run);
  assert.equal(run.phase,'place');assert.equal(run.solved,1);
  const cells=blockPieces(run).reduce((n,p)=>n+p.cells.length,0);
  run=placeAll(run);
  assert.equal(run.phase,'solve');assert.equal(run.history.length,2);
  assert.equal(blockScore(run),200+cells);
});

test('only guessing costs points: a wrong answer within a second, or the third wrong answer on one cell',()=>{
  let run=createBlockRun(42);
  const expected=divisionSteps(run.problem.fact)[0].expected,wrong=String((expected+1)%10),other=String((expected+2)%10);
  const answer=(key,ms)=>{run=reduceBlockRun(reduceBlockRun(run,{type:'input',key,ms}),{type:'input',key:'Enter',ms});};
  answer(wrong,3000);
  assert.deepEqual([run.mistakes,run.mashes],[1,0]);
  answer(other,3000+BLOCK_MASH_MS);
  assert.deepEqual([run.mistakes,run.mashes],[2,0],'a second wrong try after a pause is free');
  answer(wrong,3000+BLOCK_MASH_MS+400);
  assert.deepEqual([run.mistakes,run.mashes],[3,1]);
  answer(String(expected),3000+BLOCK_MASH_MS+600);
  assert.equal(run.mashes,1,'a quick right answer is never a mash');
  // 천천히 하나씩 넣어 봐도 같은 칸에서 세 번째 오답부터는 감점한다.
  const cell=divisionSteps(run.problem.fact)[run.problem.stepIndex].expected,guesses=[1,2,3,4].map(n=>String((cell+n)%10));
  guesses.forEach((g,i)=>answer(g,(i+1)*5000));
  assert.equal(run.mashes,3,'tries 3 and 4 on one cell cost points');
  for(const step of divisionSteps(run.problem.fact).slice(run.problem.stepIndex))answer(String(step.expected),60000);
  assert.equal(run.phase,'place');
  assert.equal(blockScore(run),200-3*BLOCK_MASH_PENALTY);
});

test('the same seed replays the same problems and pieces',()=>{
  const play=seed=>{let run=createBlockRun(seed);const seen=[];for(let i=0;i<8&&run.phase!=='over';i++){seen.push([run.problem.fact,run.pieces]);run=placeAll(solve(run));}return seen;};
  assert.deepEqual(play(5),play(5));
  assert.notDeepEqual(play(5),play(6));
});

test('a long run ends when nothing fits, and stopping keeps the score',()=>{
  let run=createBlockRun(1);
  for(let i=0;i<500&&run.phase!=='over';i++)run=placeAll(solve(run));
  assert.equal(run.phase,'over');assert.equal(run.ended,'stuck');
  assert.equal(reduceBlockRun(run,{type:'stop'}),run);
  let stopped=solve(createBlockRun(2));const score=blockScore(stopped);
  stopped=reduceBlockRun(stopped,{type:'stop'});
  assert.equal(stopped.ended,'stopped');assert.equal(blockScore(stopped),score);
});

test('each shape paints its own color on the board',()=>{
  const colors=new Set(ALL_SHAPES.map(shapeColor));
  assert.equal(colors.size,BLOCK_COLORS);
  const placed=place(emptyBoard(),shapeById('h3'),2,1);
  assert.deepEqual(placed.board.slice(17,20),[shapeColor(shapeById('h3')),shapeColor(shapeById('h3')),shapeColor(shapeById('h3'))]);
  assert.equal(placed.board.filter(Boolean).length,3);
});

test('placing reports the placed cells and the colors of cleared cells for the effects',()=>{
  const cells=[];for(let c=0;c<7;c++)cells.push([0,c]);
  const result=place(boardWith(cells),shapeById('v2'),0,7);
  assert.deepEqual(result.placed,[7,15]);
  assert.deepEqual(result.cleared.map(c=>c.index),[0,1,2,3,4,5,6,7]);
  assert.equal(result.cleared[7].color,shapeColor(shapeById('v2')));
  assert.equal(result.board[15],shapeColor(shapeById('v2')));
});

test('early rounds quietly offer a line-clearing piece more often, later rounds do not',()=>{
  // 맨 아래 줄 7칸과 오른쪽 열 일부가 찬 판: h2·v2 같은 블록이면 줄을 지운다.
  const cells=[];for(let c=0;c<6;c++)cells.push([7,c]);for(let r=3;r<7;r++)cells.push([r,7]);
  const board=boardWith(cells);
  const rate=(solved,seed)=>{const random=seededRandom(seed);let hits=0;for(let i=0;i<400;i++)if(drawPieces(random,board,solved).some(p=>clearPotential(board,p)>=100))hits++;return hits/400;};
  const early=rate(0,11),late=rate(BLOCK_HELP.length,11);
  assert.ok(early>late+.2,`${early} vs ${late}`);
  assert.ok(early<1,'not every draw is helped, so it does not look rigged');
  // 거의 찬 줄이 없는 빈 판에서는 돕지 않는다(초반이어도 난수를 더 쓰지 않아 일반 뽑기와 같다).
  assert.deepEqual(drawPieces(seededRandom(5),emptyBoard(),0).map(p=>p.id),drawPieces(seededRandom(5),emptyBoard(),1).map(p=>p.id));
});
