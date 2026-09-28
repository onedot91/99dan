import type { RushGame } from '../game/useRushGame';
import { levelFor, masteredIds } from '../game/learning';
import { DURATIONS } from '../types/game';
import { Icon } from './Icon';
import { LevelCard } from './Progress';
import { FriendSprite } from './FriendSprite';
import type { Friends } from '../game/useFriends';
export function HomeScreen({game:g,friends}:{readonly game:RushGame;readonly friends:Friends}){
  return <main className="home">
    <section className="home-stage">
      <h1><span className="title-line">곱셈</span> <span className="title-line title-accent">게임</span></h1>
      <div className="hero-scene">{friends.partner?<div className="hero-friend"><FriendSprite id={friends.partner}/></div>:<p className="hero-empty">첫 펫을 기다리고 있어요</p>}<div className="pixel-ground"/></div>
      <LevelCard level={levelFor(g.totalCorrect)} exp={g.totalCorrect} mastered={masteredIds(g.records).size}/>
    </section>
    <nav className="mode-menu" aria-label="게임 선택">
      <div className="rush-card">
        <div className="rush-durations" role="group" aria-label="도전 시간">{DURATIONS.map(n=><button key={n} aria-pressed={g.duration===n} onClick={()=>g.setDuration(n)}>{n}분</button>)}</div>
        <button className="rush-start" onClick={()=>g.start('rush')}><span className="mode-icon"><Icon name="bolt" size={30}/></span><strong>{g.duration}분 도전 시작</strong><span className="start-cursor" aria-hidden="true">▶</span></button>
      </div>
      <div className="practice-modes">
        <button className="mode-button" disabled={!g.weakUnlocked} onClick={()=>g.setScreen('weak')}><span className="mode-icon"><Icon name="target" size={28}/></span><strong>약점 연습</strong><Icon name="arrow"/></button>
        <button className="mode-button" onClick={()=>g.setScreen('tables')}><span className="mode-icon"><Icon name="book" size={28}/></span><strong>단별 연습</strong><Icon name="arrow"/></button>
      </div>
      <div className="home-extras">
        <button className="hall-button quiet-button" onClick={()=>g.setScreen('hall')}><Icon name="star"/>명예의 전당</button>
        <button className={`friends-button quiet-button${friends.pending?' has-pick':''}`} onClick={()=>g.setScreen('friends')}>{friends.pending?<>새 펫 고르기<b>{friends.pending}</b></>:<>펫 {friends.owned.length}</>}</button>
      </div>
    </nav>
  </main>;
}
