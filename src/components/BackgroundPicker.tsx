import { useEffect, useRef, useState } from 'react';
import { BACKGROUNDS, BACKGROUND_TIERS, backgroundsInTier, isUnlocked, tierOf } from '../game/background';
import type { BackgroundId } from '../game/background';
import { Icon } from './Icon';
// Locked backgrounds stay visible with their level so students know what to aim for.
// With dozens of backgrounds the menu shows one level band at a time, opening on the band of the current one.
export function BackgroundPicker({value,level,onChange}:{readonly value:BackgroundId;readonly level:number;readonly onChange:(id:BackgroundId)=>void}){
  const [open,setOpen]=useState(false);
  const current=BACKGROUNDS.find(b=>b.id===value);
  const [tier,setTier]=useState(()=>tierOf(current?.level??1));
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const close=(event:Event)=>{if(event instanceof KeyboardEvent?event.key==='Escape':!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',close);
    return ()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close);};
  },[open]);
  const toggle=()=>{if(!open)setTier(tierOf(current?.level??1));setOpen(o=>!o);};
  return <div className="background-picker" ref={root}>
    <button className="quiet-button background-button" aria-label={`배경 고르기, 지금 ${current?.label}`} aria-expanded={open} onClick={toggle}><Icon name="image"/><span>배경</span></button>
    {open&&<div className="background-menu" role="group" aria-label="배경">
      <div className="background-tabs" role="tablist" aria-label="레벨 구간">
        {BACKGROUND_TIERS.map((from,i)=><button key={from} role="tab" className={`background-tab${level>=from?' open':''}`} aria-selected={i===tier} aria-label={`Lv${from}부터`} onClick={()=>setTier(i)}>Lv{from}</button>)}
      </div>
      <div className="background-grid" role="tabpanel">
        {backgroundsInTier(tier).map(b=>{const unlocked=isUnlocked(b.id,level),chosen=b.id===value;return <button key={b.id} className="background-option" aria-pressed={chosen} disabled={!unlocked} aria-label={unlocked?b.label:`${b.label}, Lv${b.level}에 열림`} onClick={()=>{onChange(b.id);setOpen(false);}}>
          <span className="background-thumb"><span className="bg-preview" data-bg={b.id} aria-hidden="true"/>
            {!unlocked?<span className="bg-mark"><Icon name="lock" size={16}/>{b.level}</span>:chosen&&<span className="bg-mark"><Icon name="check"/></span>}</span>
          <strong>{b.label}</strong>
        </button>;})}
      </div>
    </div>}
  </div>;
}
