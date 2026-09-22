import type { SyncState } from '../cloud/types';
import { modeLabel } from '../types/game';
import type { RushGame } from '../game/useRushGame';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { PixelArt } from './PixelArt';
export function Stat({icon,value,label}:{readonly icon:IconName;readonly value:string;readonly label:string}){
  return <div className="stat"><span><Icon name={icon}/>{label}</span><strong>{value}</strong></div>;
}
export function ResultScreen({game:g,syncState,retrySave}:{readonly game:RushGame;readonly syncState:SyncState;readonly retrySave:()=>Promise<void>}){
  const r=g.run;if(!r)return null;
  return <main className="result-screen">
    <div className="result-hero"><PixelArt kind="trophy"/><h1>오늘의 기록</h1><div className="result-score"><strong>{r.score.toLocaleString()}</strong><span>점</span></div>{!r.endedEarly&&<span className="level-badge">{`${modeLabel(r.mode,r.duration)} 완료`}</span>}</div>
    <div className="result-details">
      <div className="stats-grid"><Stat icon="star" label="정답" value={`${r.correct}개`}/><Stat icon="target" label="다시 볼 문제" value={`${r.answered-r.correct}개`}/><Stat icon="book" label="푼 문제" value={`${r.answered}개`}/><Stat icon="clock" label="최단 시간" value={r.fastest===null?'—':`${(r.fastest/1000).toFixed(1)}초`}/></div>
      <button className="primary-button" disabled={syncState==='saving'} onClick={()=>syncState==='error'?void retrySave():g.weak.length?g.setScreen('weak'):g.start(r.mode)}>{syncState==='saving'?'저장 중':syncState==='error'?'저장 재시도':g.weak.length?'약점 연습':'한 번 더 도전'}<Icon name="arrow"/></button>
      <button className="quiet-button result-home" onClick={()=>g.setScreen('home')}><Icon name="back"/>처음으로</button>
    </div>
  </main>;
}
