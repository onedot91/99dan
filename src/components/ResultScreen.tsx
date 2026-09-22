import type { SyncState } from '../cloud/types';
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
    <div className="result-hero"><PixelArt kind="trophy"/><h1>오늘의 기록</h1><div className="result-score"><strong>{r.score.toLocaleString()}</strong><span>점</span></div></div>
    <div className="result-details">
      <div className="stats-grid"><Stat icon="star" label="정답" value={`${r.correct}개`}/><Stat icon="target" label="다시 볼 문제" value={`${r.answered-r.correct}개`}/></div>
      <button className="primary-button" disabled={syncState==='saving'} onClick={()=>syncState==='error'?void retrySave():g.setScreen('hall')}><Icon name="star"/>{syncState==='saving'?'기록 저장 중':syncState==='error'?'저장 재시도':'명예의 전당'}</button>
    </div>
  </main>;
}
