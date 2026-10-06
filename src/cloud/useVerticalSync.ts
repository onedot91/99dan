import { useCallback, useEffect, useRef, useState } from 'react';
import { beginVerticalRun, cloudConfigured, finishVerticalRun } from './client';
import { isSpare } from '../game/studentNumber';
import { chooseMixedVerticalQuestions, withVerticalPuzzles, withDirectZeroQuestions } from '../game/vertical';
import type { Difficulty, VerticalSession, VerticalStart } from '../game/vertical';
import type { VerticalCount } from '../game/verticalSets';

export type VerticalSyncState='local'|'idle'|'starting'|'saving'|'saved'|'error';
export function useVerticalSync(studentNumber:number,session:VerticalSession|null){
  const remote=cloudConfigured&&!isSpare(studentNumber);
  const [state,setState]=useState<VerticalSyncState>(remote?'idle':'local');
  const uploaded=useRef(new Set<string>());
  const busy=useRef(false);
  const [serverScore,setServerScore]=useState<number|null>(null);
  const sessionRef=useRef(session);sessionRef.current=session;
  const save=useCallback(async()=>{
    const completed=sessionRef.current;
    if(!remote||!completed||completed.version<3||!completed.completed||!completed.id||busy.current)return;
    if(uploaded.current.has(completed.id)){setState('saved');return;}
    busy.current=true;setState('saving');
    try{const score=await finishVerticalRun(studentNumber,completed);uploaded.current.add(completed.id);setServerScore(score);setState('saved');}
    catch{setState('error');}finally{busy.current=false;}
  },[remote,studentNumber]);
  useEffect(()=>{void save();},[session?.id,session?.completed,save]);
  const blocked=remote&&!!session&&session.version>=3&&session.completed&&!!session.id&&!uploaded.current.has(session.id);
  const begin=async(id:string,fallback:Difficulty,count:VerticalCount=5):Promise<VerticalStart|null>=>{
    if(blocked||busy.current)return null;
    setServerScore(null);
    if(!remote)return {id,difficulty:fallback,questions:withDirectZeroQuestions(withVerticalPuzzles(chooseMixedVerticalQuestions(fallback,Math.random,count),fallback,Math.random,true,true)),timeScoring:true,manualZero:true,tightTime:true,cellScoring:true};
    busy.current=true;setState('starting');
    try{const difficulty=await beginVerticalRun(studentNumber,id,count);setState('idle');return difficulty;}
    catch{setState('error');return null;}finally{busy.current=false;}
  };
  return {state,begin,retry:save,blocked,serverScore};
}
