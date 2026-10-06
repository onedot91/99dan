import { useCallback, useRef, useState } from 'react';
import { cloudConfigured, loadVerticalAssignment } from './client';
import { isSpare } from '../game/studentNumber';
import type { Difficulty } from '../game/vertical';

export function useVerticalAssignment(studentNumber:number){
  const configured=cloudConfigured&&!isSpare(studentNumber);
  const [state,setState]=useState<'ready'|'loading'|'error'>('ready');
  const pending=useRef<Promise<Difficulty|null>|null>(null);
  const reload=useCallback(()=>{
    if(pending.current)return pending.current;
    if(!configured){setState('ready');return Promise.resolve<Difficulty|null>(1);}
    setState('loading');
    const request=loadVerticalAssignment(studentNumber).then(difficulty=>{setState('ready');return difficulty;}).catch(()=>{setState('error');return null;}).finally(()=>{pending.current=null;});
    pending.current=request;
    return request;
  },[configured,studentNumber]);
  return {state,reload};
}
