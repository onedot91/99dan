import { useCallback, useEffect, useRef, useState } from 'react';
import type { RushGame } from '../game/useRushGame';
import { beginRun, cloudConfigured as configured, finishRun, loadCapabilities, loadProfile } from './client';
import { isSpare } from '../game/studentNumber';
import type { SharedProfile, SyncState } from './types';
import type { Run } from '../types/game';
export function useSharedGame(studentNumber:number,game:RushGame){
  const cloudConfigured=configured&&!isSpare(studentNumber);
  const [state,setState]=useState<SyncState>(cloudConfigured?'loading':'unconfigured');
  const [profile,setProfile]=useState<SharedProfile|null>(null);
  const [friendsSync,setFriendsSync]=useState(false);
  const pending=useRef(new Map<string,Promise<void>>());
  const saved=useRef(new Set<string>());
  const outbox=useRef(new Map<string,Run>());
  const busy=useRef(false);
  const hydrate=game.hydrate;
  const reload=useCallback(async()=>{
    if(!cloudConfigured)return;
    setState('loading');
    try{const [next,capabilities]=await Promise.all([loadProfile(studentNumber),loadCapabilities(studentNumber)]);game.setVariantsEnabled(capabilities.questionTypes);setFriendsSync(capabilities.friends&&next.friends!==null);setProfile(next);hydrate(next);setState('ready');}catch{setState('error');}
  },[studentNumber,hydrate]);
  useEffect(()=>{void reload();},[reload]);
  useEffect(()=>{
    if(!cloudConfigured||game.screen!=='play'||!game.run||pending.current.has(game.run.id))return;
    const id=game.run.id;
    const promise=beginRun(studentNumber,game.run);
    pending.current.set(id,promise);
    void promise.catch(()=>{pending.current.delete(id);setState('error');});
  },[game.screen,game.run?.id]);
  const save=async()=>{
    const run=game.run;
    if(!cloudConfigured)return;
    if(run&&game.screen==='result'&&!saved.current.has(run.id))outbox.current.set(run.id,run);
    if(busy.current)return;
    busy.current=true;setState('saving');
    try{
      do{
        for(const [id,completed] of outbox.current){
          await (pending.current.get(id)??beginRun(studentNumber,completed));
          await finishRun(studentNumber,completed);saved.current.add(id);outbox.current.delete(id);pending.current.delete(id);
        }
        const next=await loadProfile(studentNumber);
        if(!outbox.current.size){setProfile(next);hydrate(next);}
      }while(outbox.current.size);
      setState('ready');
    }catch{setState('error');}finally{busy.current=false;}
  };
  useEffect(()=>{if(game.screen==='result')void save();},[game.screen,game.run?.id]);
  return {state,profile,friendsSync,reload,retrySave:save,ready:profile!==null,blocking:cloudConfigured&&!profile};
}
