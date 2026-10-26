import { useCallback, useRef, useState } from 'react';
import { createStairsRun, reduceStairsRun, stairsScore } from './stairsRun';
import type { StairsAction, StairsRun } from './stairsRun';

// 서버 저장은 useStairsSync가 맡는다. 연결이 없을 때도 결과 화면이 최고 기록을 보여 주도록 이 기기에도 번호별로 남긴다.
const bestKey=(studentNumber:number)=>`gugudan-rush.stairs-best.${studentNumber}`;
export function loadBest(studentNumber:number):number|null{
  try{const raw=localStorage.getItem(bestKey(studentNumber));const value=raw===null?NaN:Number(raw);return Number.isSafeInteger(value)&&value>=0?value:null;}
  catch{return null;}
}
export function useStairsGame(studentNumber:number){
  const [run,setRun]=useState<StairsRun|null>(null);
  const current=useRef(run);
  const [best,setBest]=useState(()=>loadBest(studentNumber));
  const [bestBefore,setBestBefore]=useState<number|null>(null);
  const cellStarted=useRef(performance.now());
  const finish=(next:StairsRun)=>{
    const score=stairsScore(next),previous=loadBest(studentNumber);
    setBestBefore(previous);
    if(previous===null||score>previous){try{localStorage.setItem(bestKey(studentNumber),String(score));}catch{/* 기록만 못 남기고 결과는 그대로 보여 준다 */}setBest(score);}
  };
  const dispatch=useCallback((action:StairsAction)=>{
    const previous=current.current;if(!previous)return previous;
    const next=reduceStairsRun(previous,action);
    if(next===previous)return previous;
    current.current=next;setRun(next);
    if(next.phase==='over'&&previous.phase!=='over')finish(next);
    return next;
  },[studentNumber]);
  const start=(seed?:number)=>{const fresh=createStairsRun(seed);current.current=fresh;setRun(fresh);setBestBefore(null);};
  // 문제 계단에 닿거나 칸을 맞히면 그 칸의 시간을 새로 잰다.
  const move=(type:'climb'|'turn')=>{const before=current.current,next=dispatch({type});if(next&&before&&next.phase==='solve'&&before.phase!=='solve')cellStarted.current=performance.now();return next;};
  const input=(key:string)=>{
    const ms=Math.floor(performance.now()-cellStarted.current);
    const before=current.current,next=dispatch({type:'input',key,ms});
    if(key==='Enter'&&next&&before&&next.problem?.stepIndex!==before.problem?.stepIndex)cellStarted.current=performance.now();
    return next;
  };
  const stop=()=>dispatch({type:'stop'});
  const exit=()=>{current.current=null;setRun(null);};
  return {run,best,bestBefore,start,climb:()=>move('climb'),turn:()=>move('turn'),input,stop,exit};
}
export type StairsGame=ReturnType<typeof useStairsGame>;
