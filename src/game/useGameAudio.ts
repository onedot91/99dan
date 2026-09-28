import { useEffect, useRef, useState } from 'react';
import type { Run, Screen } from '../types/game';
import { COMBO_LADDER, GameAudio } from './audio';
import type { Cue } from './audio';
export function useGameAudio(run:Run|null,screen:Screen,resultCue:Cue='finish'){
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
    if(screen==='result')engine.current?.play(resultCue);
    else if(screen==='play'&&run?.phase==='correct'&&run.combo%5===0)engine.current?.play('combo',Math.min(run.combo/5-1,3)*2);
    else if(screen==='play'&&run?.phase==='correct')engine.current?.play('correct',COMBO_LADDER[(run.combo-1)%5]??0);
    else if(screen==='play'&&run?.phase==='wrong')engine.current?.play('wrong');
  },[screen,run?.answered,run?.phase,run?.combo,enabled,resultCue]);
  useEffect(()=>{
    const hide=()=>{if(document.hidden){engine.current?.mute();setEnabled(false);}};
    document.addEventListener('visibilitychange',hide);
    return()=>document.removeEventListener('visibilitychange',hide);
  },[]);
  useEffect(()=>()=>{
    const active=engine.current;engine.current=null;
    if(active)void active.dispose();
  },[]);
  return {enabled,available,pending,toggle,tap:()=>engine.current?.play('tap'),cue:(cue:Cue)=>engine.current?.play(cue)};
}
