import { useCallback, useEffect, useRef, useState } from 'react';
import { createVerticalSession, parseVerticalSession, reduceVertical, verticalQuestionSteps } from './vertical';
import type { Difficulty, VerticalAction, VerticalFact, VerticalSession } from './vertical';

const storageKey=(studentNumber:number)=>`gugudan-rush.vertical.v1.${studentNumber}`;
function loadSession(studentNumber:number):VerticalSession|null{
  try{const raw=localStorage.getItem(storageKey(studentNumber));const session=raw?parseVerticalSession(JSON.parse(raw)):null;return session?.completed?session:null;}
  catch{return null;}
}
export function useVerticalGame(studentNumber:number){
  const [session,setSession]=useState(()=>loadSession(studentNumber));
  const current=useRef(session);
  const cellStarted=useRef(performance.now());
  const cellTimes=useRef(new Map<number,number>());
  const [saved,setSaved]=useState(true);
  const [feedback,setFeedback]=useState('');
  useEffect(()=>{
    try{if(session?.completed)localStorage.setItem(storageKey(studentNumber),JSON.stringify(session));else localStorage.removeItem(storageKey(studentNumber));setSaved(true);}
    catch{setSaved(false);}
  },[session,studentNumber]);
  const start=(difficulty:Difficulty,id?:string,questions?:readonly VerticalFact[],timeScoring=false,manualZero=false,tightTime=false,cellScoring=false)=>{const fresh=createVerticalSession(difficulty,id,questions,timeScoring,manualZero,tightTime,cellScoring);cellTimes.current.clear();cellStarted.current=performance.now();current.current=fresh;setSession(fresh);setFeedback('');};
  const dispatch=useCallback((action:VerticalAction)=>{
    const previous=current.current;
    if(!previous)return;
    const next=reduceVertical(previous,action);current.current=next;setSession(next);
  },[]);
  const input=(key:string)=>{
    const active=current.current;if(!active)return;
    const fact=active.questions[active.index];if(!fact)return;
    const step=verticalQuestionSteps(fact,active.manualZero)[active.stepIndex];
    if(!step)return;
    if(key==='Enter'&&active.entry){
      const correct=Number(active.entry)===step.expected;
      setFeedback(correct?'좋아요! 다음 칸으로 가요.':'이 칸을 다시 풀어 봐요.');
    }else if(/^\d$/.test(key)||key==='Backspace'||key==='Delete')setFeedback('');
    dispatch({type:'input',key,ms:Math.floor((cellTimes.current.get(active.stepIndex)??0)+performance.now()-cellStarted.current)});
    if(key==='Enter'&&active.entry&&Number(active.entry)===step.expected)cellStarted.current=performance.now();
  };
  const select=(step:number)=>{
    const active=current.current;if(!active||active.stepIndex===step)return;
    const selected=reduceVertical(active,{type:'select',step});if(selected===active)return;
    cellTimes.current.set(active.stepIndex,(cellTimes.current.get(active.stepIndex)??0)+performance.now()-cellStarted.current);
    cellStarted.current=performance.now();current.current=selected;setSession(selected);setFeedback('');
  };
  const next=()=>{setFeedback('');dispatch({type:'next'});cellTimes.current.clear();cellStarted.current=performance.now();};
  const exit=()=>{current.current=null;setSession(null);setFeedback('');};
  return {session,saved,feedback,start,input,select,next,exit};
}
export type VerticalGame=ReturnType<typeof useVerticalGame>;
