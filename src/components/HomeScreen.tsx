import { useEffect, useState } from 'react';
import type { RushGame } from '../game/useRushGame';
import { WEAK_UNLOCK_THRESHOLD } from '../game/useRushGame';
import { levelFor } from '../game/learning';
import { DURATIONS } from '../types/game';
import { Icon } from './Icon';
import { LevelCard } from './Progress';
import { FriendSprite } from './FriendSprite';
import { Sprite } from './Sprite';
import { TROPHY } from './PixelArt';
import type { Friends } from '../game/useFriends';
import { friendById } from '../game/friends';
// The pet naps until the first home visit of the day on this device, then wakes up to say hi.
const greetKey=(n:number)=>`gugudan-rush.greeted.${n}`;
const today=()=>new Date().toLocaleDateString('sv');
function greetedToday(n:number):boolean{try{return localStorage.getItem(greetKey(n))===today();}catch{return true;}}
type Mood='sleep'|'wake'|null;
export function HomeScreen({game:g,friends,studentNumber}:{readonly game:RushGame;readonly friends:Friends;readonly studentNumber:number}){
  const [mood,setMood]=useState<Mood>(null);
  // The partner can arrive after the first render when it loads from the server.
  useEffect(()=>{if(friends.partner&&!greetedToday(studentNumber))setMood('sleep');},[friends.partner!==null,studentNumber]);
  useEffect(()=>{
    if(mood==='sleep'){try{localStorage.setItem(greetKey(studentNumber),today());}catch{/* the greeting may repeat; harmless */}const t=window.setTimeout(()=>setMood('wake'),1800);return ()=>window.clearTimeout(t);}
    if(mood==='wake'){const t=window.setTimeout(()=>setMood(null),1600);return ()=>window.clearTimeout(t);}
    return undefined;
  },[mood,studentNumber]);
  // A waiting pet pick makes the pet hop and call out until it is used.
  const state=mood??(friends.pending>0?'excited':null);
  const bubble=state==='sleep'?'Zz':state==='wake'?'반가워!':null;
  return <main className="home">
    <section className="home-stage">
      <h1><span className="title-line">곱셈</span> <span className="title-line title-accent">게임</span></h1>
      <div className="hero-scene">{friends.partner?<div className={`hero-friend tier-${friendById(friends.partner)?.tier??4} family-${friendById(friends.partner)?.family.id??''}${state?` mood-${state}`:''}`} onClick={state==='excited'?()=>g.setScreen('friends'):undefined}><FriendSprite id={friends.partner} fill/>{bubble&&<span className="pet-bubble" key={bubble} aria-hidden="true">{bubble}</span>}{state==='excited'&&<button className="pet-bubble pet-bubble-button" onClick={()=>g.setScreen('friends')}>새 펫!</button>}</div>:<p className="hero-empty">첫 펫을 기다리고 있어요</p>}<div className="pixel-ground"/></div>
      <LevelCard level={levelFor(g.totalCorrect)} exp={g.totalCorrect}/>
    </section>
    <nav className="mode-menu" aria-label="게임 선택">
      <div className="rush-card">
        <div className="rush-durations" role="group" aria-label="도전 시간">{DURATIONS.map(n=><button key={n} aria-pressed={g.duration===n} onClick={()=>g.setDuration(n)}>{n}분</button>)}</div>
        <button className="rush-start" onClick={()=>g.start('rush')}><span className="mode-icon"><Icon name="bolt" size={30}/></span><strong>{g.duration}분 도전 시작</strong><span className="start-cursor" aria-hidden="true">▶</span></button>
      </div>
      <div className="practice-modes">
        {/* Locked: a lock icon and a 5-pip gauge under the label, so it reads as "almost there", not broken. */}
        <button className="mode-button" disabled={!g.weakUnlocked} aria-label={g.weakUnlocked?undefined:`약점 연습, 틀린 문제 ${Math.min(g.totalWrong,WEAK_UNLOCK_THRESHOLD)}/${WEAK_UNLOCK_THRESHOLD}개, 다 모으면 열려요`} title={g.weakUnlocked?undefined:`틀린 문제 ${WEAK_UNLOCK_THRESHOLD}개를 모으면 열려요`} onClick={()=>g.setScreen('weak')}><span className="mode-icon"><Icon name={g.weakUnlocked?'target':'lock'} size={28}/></span>{g.weakUnlocked?<><strong>약점 연습</strong><Icon name="arrow"/></>:<span className="mode-label"><strong>약점 연습</strong><span className="lock-pips" aria-hidden="true">{Array.from({length:WEAK_UNLOCK_THRESHOLD},(_,i)=><i key={i} className={i<g.totalWrong?'on':''}/>)}</span></span>}</button>
        <button className="mode-button" onClick={()=>g.setScreen('tables')}><span className="mode-icon"><Icon name="book" size={28}/></span><strong>단별 연습</strong><Icon name="arrow"/></button>
      </div>
      <div className="home-extras">
        <button className="hall-button quiet-button" onClick={()=>g.setScreen('hall')}><Sprite map={TROPHY} className="hall-trophy"/>명예의 전당</button>
        <button className={`friends-button quiet-button${friends.pending?' has-pick':''}`} onClick={()=>g.setScreen('friends')}>{friends.pending?<>새 펫 고르기<b>{friends.pending}</b></>:<>{friends.partner&&<FriendSprite id={friends.partner} crop className="button-pet"/>}펫 {friends.owned.length}</>}</button>
      </div>
    </nav>
  </main>;
}
