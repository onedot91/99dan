import { blockPieces, createBlockRun, reduceBlockRun } from '../src/game/blockRun.ts';
import { divisionSteps } from '../src/game/division.ts';
import { fits } from '../src/game/blocks.ts';

// 정해진 순서로 푸는 학생: 가끔 틀리고, 놓을 수 있는 첫 자리에 블록을 놓는다. stopAfter번째 놓기 뒤에 그만둔다.
export function playBlockRun(seed,{wrongEvery=7,stopAfter=Infinity,stopWhileSolving=false}={}){
  let run=createBlockRun(seed),inputs=0;
  while(run.phase!=='over'){
    if(run.phase==='solve'){
      if(stopWhileSolving&&run.moves.length>=stopAfter&&run.problem.stepIndex>0)return reduceBlockRun(run,{type:'stop'});
      const step=divisionSteps(run.problem.fact)[run.problem.stepIndex];
      if(++inputs%wrongEvery===0)run=reduceBlockRun(reduceBlockRun(run,{type:'input',key:String((step.expected+1)%10)}),{type:'input',key:'Enter',ms:700});
      for(const key of String(step.expected))run=reduceBlockRun(run,{type:'input',key});
      run=reduceBlockRun(run,{type:'input',key:'Enter',ms:1500+inputs});
    }else{
      if(run.moves.length>=stopAfter)return reduceBlockRun(run,{type:'stop'});
      const index=blockPieces(run).findIndex(p=>p&&Array.from({length:64}).some((_,i)=>fits(run.board,p,Math.floor(i/8),i%8)));
      const piece=blockPieces(run)[index],cell=Array.from({length:64},(_,i)=>i).find(i=>fits(run.board,piece,Math.floor(i/8),i%8));
      run=reduceBlockRun(run,{type:'place',piece:index,row:Math.floor(cell/8),col:cell%8});
    }
  }
  return run;
}
