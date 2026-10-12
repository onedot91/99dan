import { useCallback, useRef, useState } from 'react';
import { blockScore, createBlockRun, reduceBlockRun } from './blockRun';
import type { BlockAction, BlockRun } from './blockRun';

// 서버 저장은 useBlockSync가 맡는다. 연결이 없을 때도 결과 화면이 최고 기록을 보여 주도록 이 기기에도 번호별로 남긴다.
const bestKey=(studentNumber:number)=>`gugudan-rush.block-best.${studentNumber}`;
function loadBest(studentNumber:number):number|null{
  try{const raw=localStorage.getItem(bestKey(studentNumber));const value=raw===null?NaN:Number(raw);return Number.isSafeInteger(value)&&value>=0?value:null;}
  catch{return null;}
}
export function useBlockGame(studentNumber:number){
  const [run,setRun]=useState<BlockRun|null>(null);
  const current=useRef(run);
  const [best,setBest]=useState(()=>loadBest(studentNumber));
  const [bestBefore,setBestBefore]=useState<number|null>(null);
  const cellStarted=useRef(performance.now());
  const finish=(next:BlockRun)=>{
    const score=blockScore(next),previous=loadBest(studentNumber);
    setBestBefore(previous);
    if(previous===null||score>previous){try{localStorage.setItem(bestKey(studentNumber),String(score));}catch{/* 기록만 못 남기고 결과는 그대로 보여 준다 */}setBest(score);}
  };
  const dispatch=useCallback((action:BlockAction)=>{
    const previous=current.current;if(!previous)return previous;
    const next=reduceBlockRun(previous,action);
    if(next===previous)return previous;
    current.current=next;setRun(next);
    if(next.phase==='over'&&previous.phase!=='over')finish(next);
    return next;
  },[studentNumber]);
  const start=(seed?:number)=>{const fresh=createBlockRun(seed);current.current=fresh;setRun(fresh);setBestBefore(null);cellStarted.current=performance.now();if(fresh.phase==='over')finish(fresh);};
  const input=(key:string)=>{
    const ms=Math.floor(performance.now()-cellStarted.current);
    const before=current.current,next=dispatch({type:'input',key,ms});
    if(key==='Enter'&&next&&before&&next.problem.stepIndex!==before.problem.stepIndex)cellStarted.current=performance.now();
    return next;
  };
  const placePiece=(piece:number,row:number,col:number)=>{const before=current.current,next=dispatch({type:'place',piece,row,col});if(next!==before)cellStarted.current=performance.now();return next!==before;};
  const stop=()=>dispatch({type:'stop'});
  const exit=()=>{current.current=null;setRun(null);};
  return {run,best,bestBefore,start,input,placePiece,stop,exit};
}
export type BlockGame=ReturnType<typeof useBlockGame>;
