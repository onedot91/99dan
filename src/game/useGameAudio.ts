import { useEffect, useRef, useState } from 'react';
import type { Run, Screen } from '../types/game';
import { GameAudio } from './audio';
export function useGameAudio(run:Run|null,screen:Screen){
  const engine=useRef<GameAudio|null>(null);
  const [enabled,setEnabled]=useState(false);
  const [available,setAvailable]=useState(true);
  const [pending,setPending]=useState(false);
  const previous=useRef('');
  const toggle=async()=>{
    if(enabled){engine.current?.mute();setEnabled(false);return;}
    setPending(true);
    try{
      engine.current??=new GameAudio();
      await engine.current.activate();setEnabled(true);engine.current.play('enable');
    }catch(error){
      if(!(error instanceof Error))throw error;
      engine.current?.mute();setEnabled(false);setAvailable(false);
    }finally{setPending(false);}
  };
  useEffect(()=>{
    const key=`${screen}:${run?.answered}:${run?.phase}`;
    if(previous.current===key)return;
    previous.current=key;
    if(!enabled)return;
    if(screen==='result')engine.current?.play('finish');
    else if(screen==='play'&&run?.phase==='correct')engine.current?.play(run.combo%5===0?'combo':'correct');
    else if(screen==='play'&&run?.phase==='wrong')engine.current?.play('wrong');
  },[screen,run?.answered,run?.phase,run?.combo,enabled]);
  useEffect(()=>{
    const hide=()=>{if(document.hidden){engine.current?.mute();setEnabled(false);}};
    document.addEventListener('visibilitychange',hide);
    return()=>document.removeEventListener('visibilitychange',hide);
  },[]);
  useEffect(()=>()=>{
    const active=engine.current;engine.current=null;
    if(active)void active.dispose();
  },[]);
  return {enabled,available,pending,toggle,tap:()=>engine.current?.play('tap')};
}
