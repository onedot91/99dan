import type { RushGame } from '../game/useRushGame';
import { DURATIONS } from '../types/game';
import { Icon } from './Icon';
import { PixelArt } from './PixelArt';
export function HomeScreen({game:g}:{readonly game:RushGame}){
  return <main className="home">
    <section className="home-stage">
      <h1>구구단 <br/><span>게임</span></h1>
      <div className="hero-scene"><PixelArt/><div className="pixel-ground"/></div>
    </section>
    <nav className="mode-menu" aria-label="게임 선택">
      <div className="rush-card">
        <div className="rush-durations" role="group" aria-label="도전 시간">{DURATIONS.map(n=><button key={n} aria-pressed={g.duration===n} onClick={()=>g.setDuration(n)}>{n}분</button>)}</div>
        <button className="rush-start" onClick={()=>g.start('rush')}><span className="mode-icon"><Icon name="bolt" size={30}/></span><strong>{g.duration}분 도전 시작</strong><Icon name="arrow"/></button>
      </div>
      <div className="practice-modes">
        <button className="mode-button" onClick={()=>g.setScreen('weak')}><span className="mode-icon"><Icon name="target" size={28}/></span><strong>약점 연습</strong><Icon name="arrow"/></button>
        <button className="mode-button" onClick={()=>g.setScreen('tables')}><span className="mode-icon"><Icon name="book" size={28}/></span><strong>단별 연습</strong><Icon name="arrow"/></button>
      </div>
      <button className="hall-button quiet-button" onClick={()=>g.setScreen('hall')}><Icon name="star"/>명예의 전당</button>
    </nav>
  </main>;
}
