import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TABLES } from '../types/game';
import type { Duration, Mode, Records, Run, Screen, SessionResult } from '../types/game';
import { chooseFact, isWeak, updateRecord, weakFacts } from './learning';
export function useRushGame(){
  const [duration,setDuration]=useState<Duration>(1);
  const [screen,setScreen]=useState<Screen>('home');
  const [tables,setTables]=useState<readonly number[]>(TABLES);
  const [records,setRecords]=useState<Records>({});
  const [sessions,setSessions]=useState<readonly SessionResult[]>([]);
  const [run,setRun]=useState<Run|null>(null);
  const history=useRef<Records>({});
  const ordinal=useRef(0);
  const started=useRef(0);
  const locked=useRef(false);
  const finished=useRef(false);
  const activeScreen=useRef<Screen>('home');
  useLayoutEffect(()=>{activeScreen.current=screen;},[screen]);
  const currentRun=useRef<Run|null>(null);
  useLayoutEffect(()=>{
    currentRun.current=run;
    if(screen==='play'&&run?.phase==='question'){started.current=performance.now();locked.current=false;}
  },[run?.answered,run?.fact.id,run?.phase,screen]);
  // Keep event/timer callbacks on the latest round without restarting reaction timing on input.
  useLayoutEffect(()=>{currentRun.current=run;},[run]);
  const end=(early=false)=>{
    const active=currentRun.current;
    if(!active||finished.current)return;
    finished.current=true;locked.current=true;
    const result={...active,endedEarly:early};setRun(result);currentRun.current=result;
    setSessions(s=>[...s,{id:active.id,duration:active.duration,mode:active.mode,score:active.score,correct:active.correct,answered:active.answered,bestCombo:active.bestCombo,fastest:active.fastest,accuracy:active.answered?Math.round(active.correct/active.answered*100):0,endedEarly:early}]);
    setScreen('result');
  };
  const start=(mode:Mode)=>{
    const focus=weakFacts(history.current).map(f=>f.id);
    if(mode==='weak'&&!focus.length){setScreen('weak');return;}
    const chosen=mode==='practice'?tables:TABLES;
    if(!chosen.length)return;
    const fact=chooseFact({records:history.current,ordinal:ordinal.current,tables:chosen,focusIds:focus,mode,currentId:null,seenIds:[]});
    const fresh:Run={id:crypto.randomUUID(),duration,events:[],mode,tables:chosen,focusIds:focus,fact,phase:'question',entry:'',score:0,correct:0,answered:0,combo:0,bestCombo:0,fastest:null,remaining:duration*60000,feedback:'',factIds:[],limit:mode==='weak'?Math.max(12,focus.length*3):mode==='practice'?chosen.length*8:64,deadline:mode==='rush'?performance.now()+duration*60000:null,endedEarly:false};
    finished.current=false;locked.current=false;currentRun.current=fresh;setRun(fresh);setScreen('play');
  };
  const submit=()=>{
    const active=currentRun.current;
    if(!active||active.phase!=='question'||!active.entry||locked.current||finished.current)return;
    if(active.deadline!==null&&performance.now()>=active.deadline){end();return;}
    locked.current=true;
    const ms=Math.max(1,Math.round(performance.now()-started.current));
    const correct=Number(active.entry)===active.fact.a*active.fact.b;
    const nextHistory={...history.current,[active.fact.id]:updateRecord(history.current[active.fact.id],{correct,ms},ordinal.current)};
    history.current=nextHistory;setRecords(nextHistory);ordinal.current+=1;
    const combo=correct?active.combo+1:0;
    const bonus=correct?(ms<=2000?10:0)+(combo%5===0?25:0):0;
    const feedback=correct?`+${100+bonus}`:'다시';
    const updated:Run={...active,phase:correct?'correct':'wrong',entry:active.entry,events:[...active.events,{a:active.fact.a,b:active.fact.b,answer:Number(active.entry),ms:Math.round(ms)}],answered:active.answered+1,correct:active.correct+Number(correct),score:active.score+(correct?100+bonus:0),combo,bestCombo:Math.max(active.bestCombo,combo),fastest:correct?Math.min(active.fastest??Infinity,ms):active.fastest,feedback,factIds:correct?[...active.factIds,active.fact.id]:active.factIds};
    currentRun.current=updated;setRun(updated);
  };
  const input=(key:string)=>{
    const active=currentRun.current;
    if(!active||active.phase!=='question'||locked.current||finished.current)return;
    if(key==='Enter'){submit();return;}
    const entry=key==='Backspace'?active.entry.slice(0,-1):key==='Delete'?'':/^\d$/.test(key)&&active.entry.length<2?(active.entry==='0'?key:active.entry+key):active.entry;
    const updated={...active,entry};currentRun.current=updated;setRun(updated);
  };
  useEffect(()=>{
    if(screen!=='play'||run?.phase==='question'||!run)return;
    const timer=window.setTimeout(()=>{
      const active=currentRun.current;
      if(!active||finished.current)return;
      if(active.deadline!==null&&performance.now()>=active.deadline){end();return;}
      if(active.phase==='wrong'){
        const retry={...active,phase:'question',entry:'',feedback:''} satisfies Run;
        currentRun.current=retry;setRun(retry);return;
      }
      const mastered=active.mode==='weak'&&active.focusIds.every(id=>{const r=history.current[id];return r?!isWeak(r):false;});
      if(active.mode!=='rush'&&(active.correct>=active.limit||mastered)){end();return;}
      if(active.deadline!==null&&performance.now()>=active.deadline){end();return;}
      const fact=chooseFact({records:history.current,ordinal:ordinal.current,tables:active.tables,focusIds:active.focusIds,mode:active.mode,currentId:active.fact.id,seenIds:active.factIds});
      const updated={...active,fact,phase:'question',entry:'',feedback:''} satisfies Run;
      currentRun.current=updated;setRun(updated);
    },run.phase==='correct'?450:350);
    return ()=>window.clearTimeout(timer);
  },[run?.phase,run?.answered,screen]);
  useEffect(()=>{
    if(screen!=='play'||run?.deadline===null||run?.deadline===undefined)return;
    const deadline=run.deadline;
    const timer=window.setInterval(()=>{
      const remaining=Math.max(0,deadline-performance.now());
      if(remaining===0){end();return;}
      setRun(r=>r?{...r,remaining}:r);
    },100);
    return ()=>window.clearInterval(timer);
  },[screen,run?.deadline]);
  useEffect(()=>{
    if(screen!=='play')return;
    const onKey=(event:KeyboardEvent)=>{
      if(event.ctrlKey||event.metaKey||event.altKey||event.repeat)return;
      if(event.key==='Escape'){event.preventDefault();end(true);return;}
      if(event.target instanceof HTMLButtonElement&&(event.key==='Enter'||event.key===' '))return;
      if(/^\d$/.test(event.key)||['Enter','Backspace','Delete'].includes(event.key)){event.preventDefault();input(event.key);}
    };
    window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey);
  },[screen]);
  const hydrate=useCallback((data:{readonly records:Records;readonly sessions:readonly SessionResult[]})=>{
    if(activeScreen.current==='play')return;
    history.current=data.records;ordinal.current=Object.values(data.records).reduce((n,r)=>n+r.attempts,0);setRecords(data.records);setSessions(data.sessions);
  },[]);
  const toggleTable=(n:number)=>setTables(previous=>previous.includes(n)?previous.filter(t=>t!==n):[...previous,n].sort((a,b)=>a-b));
  const totalCorrect=Object.values(records).reduce((sum,r)=>sum+r.correct,0);
  return {hydrate,screen,setScreen,duration,setDuration,tables,toggleTable,records,sessions,run,start,input,end,totalCorrect,weak:weakFacts(records)};
}
export type RushGame=ReturnType<typeof useRushGame>;
