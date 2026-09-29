import { useEffect, useRef, useState } from 'react';
import { BACKGROUNDS, isUnlocked } from '../game/background';
import type { BackgroundId } from '../game/background';
import { Icon } from './Icon';
// Locked backgrounds stay visible with their level so students know what to aim for.
export function BackgroundPicker({value,level,onChange}:{readonly value:BackgroundId;readonly level:number;readonly onChange:(id:BackgroundId)=>void}){
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const close=(event:Event)=>{if(event instanceof KeyboardEvent?event.key==='Escape':!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',close);
    return ()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close);};
  },[open]);
  const current=BACKGROUNDS.find(b=>b.id===value);
  return <div className="background-picker" ref={root}>
    <button className="quiet-button background-button" aria-label={`배경 고르기, 지금 ${current?.label}`} aria-expanded={open} onClick={()=>setOpen(o=>!o)}><Icon name="image"/><span>배경</span></button>
    {open&&<div className="background-menu" role="group" aria-label="배경">
      {BACKGROUNDS.map(b=>{const unlocked=isUnlocked(b.id,level);return <button key={b.id} className={`background-option bg-swatch-${b.id}`} aria-pressed={b.id===value} disabled={!unlocked} aria-label={unlocked?b.label:`${b.label}, Lv${b.level}에 열림`} onClick={()=>{onChange(b.id);setOpen(false);}}>
        <i aria-hidden="true"/><strong>{b.label}</strong>{unlocked?b.id===value&&<Icon name="check"/>:<small>Lv.{b.level}</small>}
      </button>;})}
    </div>}
  </div>;
}
