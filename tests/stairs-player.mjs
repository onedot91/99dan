import { createStairsRun, reduceStairsRun, stairsSteps } from '../src/game/stairsRun.ts';

// 정해진 순서로 노는 학생: slipEvery번째 조작마다 방향을 틀리고, wrongEvery번째 칸마다 한 번 틀린 뒤 푼다.
// stopAfter칸을 오르면 그만둔다(stopWhileSolving이면 문제를 푸는 중에 그만둔다).
export function playStairsRun(seed,{slipEvery=Infinity,wrongEvery=7,mashEvery=Infinity,stopAfter=Infinity,stopWhileSolving=false}={}){
  let run=createStairsRun(seed),moves=0,cells=0;
  while(run.phase!=='over'){
    if(run.phase==='climb'){
      if(run.height>=stopAfter)return reduceStairsRun(run,{type:'stop'});
      const right=run.steps[run.height]===run.facing?'climb':'turn';
      const type=++moves%slipEvery===0?(right==='climb'?'turn':'climb'):right;
      run=reduceStairsRun(run,{type});
    }else{
      if(stopWhileSolving&&run.height>=stopAfter&&run.problem.stepIndex>0)return reduceStairsRun(run,{type:'stop'});
      const step=stairsSteps(run.problem)[run.problem.stepIndex];
      cells++;
      if(cells%wrongEvery===0)run=reduceStairsRun(reduceStairsRun(run,{type:'input',key:String((step.expected+1)%10)}),{type:'input',key:'Enter',ms:1500});
      if(cells%mashEvery===0)run=reduceStairsRun(reduceStairsRun(run,{type:'input',key:String((step.expected+2)%10)}),{type:'input',key:'Enter',ms:1800});
      if(run.phase!=='solve')continue;
      run=reduceStairsRun(reduceStairsRun(run,{type:'input',key:String(step.expected)}),{type:'input',key:'Enter',ms:4000+cells});
    }
  }
  return run;
}
