import { createDivisionProblem, divisionSolved, nextDivisionFact, reduceDivision, seededGenerator } from './division.ts';
import type { DivisionFact, DivisionProblem } from './division.ts';
import { drawPieces, emptyBoard, fitsAnywhere, place, shapeById } from './blocks.ts';
import type { Board, Shape } from './blocks.ts';
import { VERTICAL_CORRECT_POINTS, WRONG_PENALTY } from './points.ts';

// 한 판: 블록 3개를 먼저 보여 주고, 나눗셈을 풀면 놓을 수 있다. 3개를 다 놓으면 다음 문제.
// 새로 받은 블록이나 남은 블록을 하나도 놓을 수 없으면 끝난다(무한 모드).
export type BlockPhase='solve'|'place'|'over';
export type BlockMove={readonly piece:number;readonly row:number;readonly col:number};
// 판 전체의 정답 확인(Enter) 기록. 문제별 기록(problem.events)과 달리 다음 문제로 넘어가도 남아 서버가 판을 재생한다.
export type BlockAnswer={readonly answer:number;readonly ms?:number};
// 연출용 기록(점수에는 영향 없음). combo: 블록 3개를 놓는 동안 한 번이라도 줄을 지우면 이어지는 연속 지우기 횟수.
export type BlockClear={readonly key:number;readonly rows:readonly number[];readonly cols:readonly number[];readonly points:number;readonly cells:readonly {readonly index:number;readonly color:number}[];readonly combo:number;readonly allClear:boolean};
export type BlockPlace={readonly key:number;readonly cells:readonly number[];readonly points:number};
export type BlockRun={
  readonly seed:number;readonly rng:number;readonly history:readonly DivisionFact[];readonly problem:DivisionProblem;
  readonly board:Board;readonly pieces:readonly (string|null)[];readonly phase:BlockPhase;readonly ended:'stuck'|'stopped'|null;
  readonly solved:number;readonly mistakes:number;readonly blockScore:number;readonly lines:number;readonly answers:readonly BlockAnswer[];readonly moves:readonly BlockMove[];readonly lastClear:BlockClear|null;
  readonly lastPlace:BlockPlace|null;readonly combo:number;readonly sinceClear:number;readonly bestCombo:number;
};
export type BlockAction={readonly type:'input';readonly key:string;readonly ms?:number}|{readonly type:'place';readonly piece:number;readonly row:number;readonly col:number}|{readonly type:'stop'};

export const blockPieces=(run:BlockRun):readonly (Shape|null)[]=>run.pieces.map(id=>id===null?null:shapeById(id)??null);
export const blockCalcScore=(run:BlockRun)=>run.solved*VERTICAL_CORRECT_POINTS-run.mistakes*WRONG_PENALTY;
export const blockScore=(run:BlockRun)=>Math.max(0,blockCalcScore(run)+run.blockScore);

function nextRound(run:Omit<BlockRun,'problem'|'pieces'|'phase'|'rng'|'history'>&{readonly rng:number;readonly history:readonly DivisionFact[]}):BlockRun{
  const generator=seededGenerator(run.rng);
  const pieces=drawPieces(generator.random,run.board,run.solved);
  const fact=nextDivisionFact(generator.random,run.history);
  const stuck=!pieces.some(p=>fitsAnywhere(run.board,p));
  return {...run,rng:generator.state,history:[...run.history,fact],problem:createDivisionProblem(fact),pieces:pieces.map(p=>p.id),phase:stuck?'over':'solve',ended:stuck?'stuck':null};
}
export function createBlockRun(seed:number=Math.floor(Math.random()*2**32)):BlockRun{
  return nextRound({seed,rng:seed>>>0,history:[],board:emptyBoard(),ended:null,solved:0,mistakes:0,blockScore:0,lines:0,answers:[],moves:[],lastClear:null,lastPlace:null,combo:0,sinceClear:0,bestCombo:0});
}

export function reduceBlockRun(run:BlockRun,action:BlockAction):BlockRun{
  if(run.phase==='over')return run;
  if(action.type==='stop')return {...run,phase:'over',ended:'stopped'};
  if(action.type==='input'){
    if(run.phase!=='solve')return run;
    const before=run.problem,problem=reduceDivision(before,action);
    if(problem===before)return run;
    const mistakes=run.mistakes+problem.mistakes-before.mistakes;
    const submitted=problem.events.length>before.events.length?problem.events.at(-1):undefined;
    const answers=submitted?[...run.answers,{answer:submitted.answer,...(submitted.ms!==undefined?{ms:submitted.ms}:{})}]:run.answers;
    return divisionSolved(problem)?{...run,problem,mistakes,answers,solved:run.solved+1,phase:'place'}:{...run,problem,mistakes,answers};
  }
  if(run.phase!=='place')return run;
  const piece=run.pieces[action.piece]?shapeById(run.pieces[action.piece]!):undefined;
  const result=piece?place(run.board,piece,action.row,action.col):null;
  if(!result)return run;
  const pieces=run.pieces.map((id,i)=>i===action.piece?null:id);
  const cleared=result.rows.length+result.cols.length,key=run.moves.length;
  const sinceClear=cleared?0:run.sinceClear+1;
  const combo=cleared?run.combo+1:sinceClear>=3?0:run.combo;
  const moved={...run,board:result.board,pieces,blockScore:run.blockScore+result.points,lines:run.lines+cleared,moves:[...run.moves,{piece:action.piece,row:action.row,col:action.col}],
    lastClear:cleared?{key,rows:result.rows,cols:result.cols,points:result.points,cells:result.cleared,combo,allClear:result.board.every(v=>!v)}:run.lastClear,
    lastPlace:{key,cells:result.placed,points:result.points},combo,sinceClear,bestCombo:Math.max(run.bestCombo,combo)};
  if(pieces.every(id=>id===null))return nextRound(moved);
  const left=blockPieces(moved).filter((p):p is Shape=>!!p);
  return left.some(p=>fitsAnywhere(moved.board,p))?moved:{...moved,phase:'over',ended:'stuck'};
}

// 서버 검증: 같은 시드로 새 판을 만들고 정답 확인 기록과 놓기 기록을 순서대로 재생한다. 풀 차례에는 다음 답을,
// 놓을 차례에는 다음 놓기를 쓴다. 효과 없는 입력·남는 기록·끝난 방식이 맞지 않으면 null이다.
export const BLOCK_REPLAY_LIMITS={answers:6000,moves:3000} as const;
export function replayBlockRun(seed:number,answers:readonly BlockAnswer[],moves:readonly BlockMove[],ended:'stuck'|'stopped'):BlockRun|null{
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||answers.length>BLOCK_REPLAY_LIMITS.answers||moves.length>BLOCK_REPLAY_LIMITS.moves)return null;
  let run=createBlockRun(seed),answered=0,moved=0;
  while(run.phase!=='over'){
    if(run.phase==='solve'){
      const next=answers[answered];if(!next)break;answered++;
      if(!Number.isInteger(next.answer)||next.answer<0||next.answer>9)return null;
      const typed=reduceBlockRun(run,{type:'input',key:String(next.answer)});
      const checked=reduceBlockRun(typed,{type:'input',key:'Enter',...(next.ms!==undefined?{ms:next.ms}:{})});
      if(checked===typed)return null;
      run=checked;
    }else{
      const next=moves[moved];if(!next)break;moved++;
      if(![next.piece,next.row,next.col].every(Number.isInteger))return null;
      const placed=reduceBlockRun(run,{type:'place',piece:next.piece,row:next.row,col:next.col});
      if(placed===run)return null;
      run=placed;
    }
  }
  if(answered!==answers.length||moved!==moves.length)return null;
  if(run.phase==='over')return run.ended===ended?run:null;
  return ended==='stopped'?reduceBlockRun(run,{type:'stop'}):null;
}
