import { useEffect, useState } from 'react';
import type { SyncState } from '../cloud/types';
import type { RushGame } from '../game/useRushGame';
import type { RunRewards } from '../game/useRunRewards';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { PixelArt, TROPHY } from './PixelArt';
import { ExpBar, expRatio } from './Progress';
import { STAR, Sprite } from './Sprite';
import type { Friends } from '../game/useFriends';
import type { CSSProperties } from 'react';
import { BACKGROUNDS } from '../game/background';
import type { BackgroundId } from '../game/background';
// Orbs fly one after another, then the bar fills, then the level-up stamp and unlocks land.
const ORB_STEP=70,MAX_ORBS=10;
export function Stat({icon,value,label}:{readonly icon:IconName;readonly value:string;readonly label:string}){
  return <div className="stat"><span><Icon name={icon}/>{label}</span><strong>{value}</strong></div>;
}
function useCountUp(target:number,skip:boolean,ms=900){
  const [value,setValue]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches?target:0);
  useEffect(()=>{
    if(skip||matchMedia('(prefers-reduced-motion: reduce)').matches){setValue(target);return;}
    const start=performance.now();let frame=0;
    const tick=(now:number)=>{
      const t=Math.min(1,(now-start)/ms);
      setValue(Math.round(target*(1-(1-t)**3)));
      if(t<1)frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(frame);
  },[target,ms,skip]);
  return value;
}
export function ResultScreen({game:g,rewards,friends,syncState,retrySave,unlocked,onUseBackground}:{readonly game:RushGame;readonly rewards:RunRewards|null;readonly friends:Friends;readonly syncState:SyncState;readonly retrySave:()=>Promise<void>;readonly unlocked:readonly BackgroundId[];readonly onUseBackground:(id:BackgroundId)=>void}){
  const r=g.run;
  // Tapping anywhere that isn't a button jumps every reward animation to its end.
  const [skip,setSkip]=useState(false);
  const [used,setUsed]=useState<BackgroundId|null>(null);
  const shown=useCountUp(r?.score??0,skip);
  if(!r)return null;
  const mastered=rewards?.newlyMastered??[];
  const gained=rewards?rewards.expAfter-rewards.expBefore:0;
  const orbs=Math.min(MAX_ORBS,gained);
  const timing={'--orbs':orbs,'--orb-step':`${ORB_STEP}ms`} as CSSProperties;
  return <main className={`result-screen${rewards?.newRecord?' new-record':''}${skip?' skip':''}`} style={timing} onPointerDown={event=>{if(!(event.target instanceof Element&&event.target.closest('button')))setSkip(true);}}>
    <div className="result-hero">
      <div className="trophy-celebration" aria-hidden="true"><PixelArt kind="trophy"/><span className="trophy-particles">{Array.from({length:10},(_,i)=><i key={i}/>)}</span></div>
      {rewards?.newRecord&&<p className="record-ribbon">{rewards.firstRecord?'첫 기록!':'최고 기록 갱신!'}</p>}
      <h1>오늘의 기록</h1>
      <div className="result-score" aria-label={`${r.score}점`}><strong aria-hidden="true">{shown.toLocaleString()}</strong><span aria-hidden="true">점</span></div>
      {rewards?.toBest!=null&&<p className="result-goal">최고 기록까지 {rewards.toBest.toLocaleString()}점!</p>}
    </div>
    <div className="result-details">
      <div className="stats-grid"><Stat icon="star" label="정답" value={`${r.correct}개`}/><Stat icon="target" label="다시 볼 문제" value={`${r.answered-r.correct}개`}/></div>
      {rewards&&<div className={`exp-card${rewards.levelUp?' level-up':''}`}>
        <div className="exp-head">
          <span className="level-number"><small>Lv</small>{rewards.levelAfter.number}</span>
          <strong>{rewards.levelUp?<span className="level-up-text">레벨 업!</span>:null}{rewards.levelAfter.label}</strong>
          <span className="exp-gain">+{rewards.expAfter-rewards.expBefore} EXP</span>
        </div>
        <ExpBar from={rewards.levelUp?0:expRatio(rewards.levelAfter,rewards.expBefore)} to={expRatio(rewards.levelAfter,rewards.expAfter)} label="레벨 경험치"/>
        {orbs>0&&<span className="exp-orbs" aria-hidden="true">{Array.from({length:orbs},(_,i)=><i key={i} style={{'--i':i,'--x':`${(i*37)%100}%`} as CSSProperties}/>)}</span>}
      </div>}
      {unlocked.map(id=>{const b=BACKGROUNDS.find(x=>x.id===id);if(!b)return null;return <div key={id} className="unlock-card">
        <span className="bg-preview" data-bg={id} aria-hidden="true"/>
        <p><small>새 배경</small><strong>{b.label}</strong> 배경이 열렸어요!</p>
        {used===id?<span className="unlock-used">적용됨</span>:<button className="quiet-button" onClick={()=>{onUseBackground(id);setUsed(id);}}>바로 쓰기</button>}
      </div>;})}
      {mastered.length>0&&<div className="mastered-card">
        <p><Sprite map={STAR} className="mastered-star"/>새로 익힌 식 <strong>{mastered.length}개</strong></p>
        <ul>{mastered.slice(0,6).map(f=><li key={f.id}>{f.a}×{f.b}</li>)}{mastered.length>6&&<li>+{mastered.length-6}</li>}</ul>
      </div>}
      <div className={`result-actions${friends.pending?' with-pick':''}`}>
        {friends.pending>0&&<button className="primary-button friend-cta" onClick={()=>g.setScreen('friends')}>새 펫 고르기 ({friends.pending})</button>}
        <button className={friends.pending?'quiet-button':'primary-button'} disabled={syncState==='saving'} onClick={()=>syncState==='error'?void retrySave():g.setScreen('hall')}><Sprite map={TROPHY} className="hall-trophy"/>{syncState==='saving'?'기록 저장 중':syncState==='error'?'저장 재시도':'명예의 전당'}</button>
      </div>
    </div>
  </main>;
}
