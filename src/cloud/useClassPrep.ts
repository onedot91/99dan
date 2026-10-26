import { useEffect, useMemo, useState } from 'react';
import { cloudConfigured, loadClassPrep } from './client';
import type { ClassPrepSource } from './client';
import { isSpare } from '../game/studentNumber';
import { CLASS_PREP_IDLE, getClassPrepState } from '../game/classPrep';
import type { ClassPrepState } from '../game/classPrep';
// The stage is computed on this device every second; the server is read only for schedule changes and a
// teacher release. A locked screen reads often so a release reaches it quickly.
const IDLE_SYNC_MS=60000;
const ACTIVE_SYNC_MS=5000;
// A source older than this (network down) stops showing anything rather than guess.
const STALE_MS=10*60000;
const TICK_MS=1000;
type Loaded={readonly source:ClassPrepSource;readonly at:number};
export function useClassPrepSource(studentNumber:number,stage:ClassPrepState['stage']):ClassPrepSource|null{
  const demo=useMemo(demoSource,[]);
  const configured=demo===null&&cloudConfigured&&!isSpare(studentNumber);
  const [loaded,setLoaded]=useState<Loaded|null>(null);
  const active=stage!=='idle';
  useEffect(()=>{
    setLoaded(null);
  },[studentNumber]);
  useEffect(()=>{
    if(!configured)return undefined;
    let alive=true,timer:number|undefined,busy=false;
    const read=async()=>{
      if(busy)return;
      window.clearTimeout(timer);busy=true;
      try{
        if(document.visibilityState==='visible'){
          // A failed read keeps the last good source; an older server without this action (null) shows nothing.
          try{const source=await loadClassPrep(studentNumber);if(alive)setLoaded(source?{source,at:Date.now()}:null);}catch{/* keep the last good source */}
        }
      }finally{busy=false;if(alive)timer=window.setTimeout(()=>void read(),active?ACTIVE_SYNC_MS:IDLE_SYNC_MS);}
    };
    const onVisible=()=>{if(document.visibilityState==='visible')void read();};
    void read();
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{alive=false;window.clearTimeout(timer);document.removeEventListener('visibilitychange',onVisible);};
  },[configured,studentNumber,active]);
  if(demo)return demo;
  if(!configured||!loaded||Date.now()-loaded.at>STALE_MS)return null;
  return loaded.source;
}
/** Re-evaluates the class prep stage every second while a schedule is known (School_Timer useClassPrepState). */
export function useClassPrepState(source:ClassPrepSource|null):ClassPrepState{
  const [nowMs,setNowMs]=useState(()=>Date.now());
  const hasSchedule=source!==null&&source.weeklySchedule!==null&&source.weeklySchedule!==undefined;
  useEffect(()=>{
    if(!hasSchedule)return undefined;
    setNowMs(Date.now());
    const id=window.setInterval(()=>setNowMs(Date.now()),TICK_MS);
    return ()=>window.clearInterval(id);
  },[hasSchedule]);
  return useMemo(()=>hasSchedule&&source?getClassPrepState({nowMs,clockOffsetSeconds:source.clockOffsetSeconds,weeklySchedule:source.weeklySchedule,weeklySubjects:source.weeklySubjects,release:source.release}):CLASS_PREP_IDLE,[hasSchedule,nowMs,source]);
}
// Dev only: `?classPrepDemo=75` pretends a 10-minute break ends 75 seconds after the page loads, so every
// stage can be checked without the real timetable. Production builds drop this branch.
function demoSource():ClassPrepSource|null{
  if(!import.meta.env.DEV)return null;
  const seconds=Number(new URLSearchParams(window.location.search).get('classPrepDemo'));
  if(!Number.isFinite(seconds)||seconds<=0)return null;
  const start=new Date(Date.now()+seconds*1000);
  const minute=start.getHours()*60+start.getMinutes()+start.getSeconds()/60;
  return {weeklySchedule:{[start.getDay()]:[
    {id:'demo-c1',name:'1교시',type:'class',start:minute-50,end:minute-10},
    {id:'demo-b1',name:'쉬는 시간',type:'break',start:minute-10,end:minute},
    {id:'demo-c2',name:'2교시',type:'class',start:minute,end:minute+40},
  ]},weeklySubjects:null,clockOffsetSeconds:0,release:null};
}
