import { useState } from 'react';
import type { RushGame } from '../game/useRushGame';
import type { Best } from '../cloud/types';
import { DURATIONS } from '../types/game';
import type { Duration } from '../types/game';
import { Stat } from './ResultScreen';
import { Icon } from './Icon';

export function RecordsScreen({game:g,best:sharedBest}:{readonly game:RushGame;readonly best:readonly Best[]|undefined}){
  const [duration,setDuration]=useState<Duration>(1);
  const localBest=g.sessions.filter(s=>s.mode==='rush'&&s.duration===duration&&s.scoringVersion===5).reduce<Best|undefined>((record,session)=>!record||session.score>record.score?{duration,score:session.score,correct:session.correct}:record,undefined);
  const sharedRecord=sharedBest?.find(record=>record.duration===duration);
  const best=sharedRecord&&localBest?(sharedRecord.score>=localBest.score?sharedRecord:localBest):sharedRecord??localBest;

  return <main className="records-screen">
    <div className="screen-heading"><h1>나의 플레이 기록</h1></div>
    <div className="duration-tabs" role="group" aria-label="도전 종목">
      {DURATIONS.map(n=><button key={n} aria-pressed={duration===n} onClick={()=>setDuration(n)}>{n}분 도전</button>)}
    </div>
    <div className="stats-grid">
      <Stat icon="star" label={`${duration}분 최고 점수`} value={best===undefined?'—':best.score.toLocaleString()}/>
      <Stat icon="target" label="맞힌 문제" value={`${best?.correct??0}개`}/>
    </div>
    <button className="primary-button" onClick={()=>g.weakUnlocked?g.setScreen('weak'):g.setScreen('tables')}>계속 연습하기<Icon name="arrow"/></button>
  </main>;
}
