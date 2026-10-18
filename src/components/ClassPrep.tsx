import { useEffect, useLayoutEffect, useRef } from 'react';
import { formatClassPrepSecondsLabel, getClassPrepWrapUpRatio } from '../game/classPrep';
import type { ClassPrepState } from '../game/classPrep';
import type { ClassPrepSource } from '../cloud/client';
import { useClassPrepState } from '../cloud/useClassPrep';
import '../class-prep.css';
// School_Timer StudentClassPrep in the 16-bit look: notice band → see-through wrap-up card → lock screen.
// Same image as School_Timer, served from this app so no other origin is needed.
const CHARACTER='/character.png?v=20260301';
const RING_RADIUS=52;
export function ClassPrep({source,onStageChange}:{readonly source:ClassPrepSource|null;readonly onStageChange:(stage:ClassPrepState['stage'])=>void}){
  const state=useClassPrepState(source);
  const lock=useRef<HTMLDivElement>(null);
  // Before paint, so a start can never slip through while the card is already on screen.
  useLayoutEffect(()=>{onStageChange(state.stage);},[state.stage,onStageChange]);
  const locked=state.stage==='locked';
  useEffect(()=>{if(locked)lock.current?.focus({preventScroll:true});},[locked]);
  if(state.stage==='idle')return null;
  if(state.stage==='locked')return <div ref={lock} className="class-prep-lock" role="dialog" aria-modal="true" aria-labelledby="class-prep-lock-title" aria-describedby="class-prep-lock-class" tabIndex={-1}>
    <img className="class-prep-lock-character" src={CHARACTER} alt="" width="160" height="160"/>
    <h2 id="class-prep-lock-title" className="class-prep-lock-title">크롬북 닫기</h2>
    <p id="class-prep-lock-class" className="class-prep-lock-class">{state.target.label}</p>
  </div>;
  const wrapUp=state.stage==='wrap-up';
  const ratio=wrapUp?getClassPrepWrapUpRatio(state.secondsUntilLock):state.remainingRatio;
  const progress={role:'progressbar','aria-label':'수업 준비까지 남은 시간','aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':Math.round(ratio*100),'aria-valuetext':`잠금까지 ${formatClassPrepSecondsLabel(state.secondsUntilLock)}`} as const;
  // See-through and click-through, and never takes focus, so the run underneath can be finished and saved.
  if(wrapUp)return <div className="class-prep-wrap-up">
    <div className="class-prep-ring" {...progress}>
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle className="class-prep-ring-track" cx="60" cy="60" r={RING_RADIUS}/>
        <circle className="class-prep-ring-fill" cx="60" cy="60" r={RING_RADIUS} pathLength={1} style={{strokeDashoffset:1-ratio}}/>
      </svg>
      <img className="class-prep-ring-character" src={CHARACTER} alt="" width="112" height="112"/>
    </div>
    <p className="class-prep-wrap-up-label" role="status">크롬북을 닫아주세요.</p>
  </div>;
  return <div className="class-prep-band">
    <p className="class-prep-band-label" role="status">하던 것 마무리하세요</p>
    <div className="class-prep-track" {...progress}><div className="class-prep-fill" style={{transform:`scaleX(${ratio})`}}/></div>
  </div>;
}
// "수업 후에 하세요": a short bubble above the start button that was just pressed.
export type BlockedHint={readonly key:number;readonly x:number;readonly y:number};
export function ClassPrepHint({hint,message}:{readonly hint:BlockedHint|null;readonly message:string}){
  if(!hint)return null;
  return <p key={hint.key} className="class-prep-hint" role="status" style={{left:hint.x,top:hint.y}}>{message}</p>;
}
