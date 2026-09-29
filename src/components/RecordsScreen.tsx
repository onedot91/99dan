import { useState } from 'react';
import type { RushGame } from '../game/useRushGame';
import type { Best } from '../cloud/types';
import { DURATIONS } from '../types/game';
import type { Duration } from '../types/game';
import { Stat } from './ResultScreen';
import { Icon } from './Icon';
import { levelFor } from '../game/learning';
import { LevelCard, MasteryBoard } from './Progress';

export function RecordsScreen({game:g,best:sharedBest}:{readonly game:RushGame;readonly best:readonly Best[]|undefined}){
  const [duration,setDuration]=useState<Duration>(1);
  const [view,setView]=useState<'summary'|'board'>('summary');
  const localBest=g.sessions.filter(s=>s.mode==='rush'&&s.duration===duration&&s.scoringVersion===5).reduce<Best|undefined>((record,session)=>!record||session.score>record.score?{duration,score:session.score,correct:session.correct}:record,undefined);
  const sharedRecord=sharedBest?.find(record=>record.duration===duration);
  const best=sharedRecord&&localBest?(sharedRecord.score>=localBest.score?sharedRecord:localBest):sharedRecord??localBest;

  return <main className={`records-screen show-${view}`}>
    <div className="records-view-tabs duration-tabs" role="group" aria-label="보기 선택">
      <button aria-pressed={view==='summary'} onClick={()=>setView('summary')}>내 기록</button>
      <button aria-pressed={view==='board'} onClick={()=>setView('board')}>구구단 도감</button>
    </div>
    <section className="records-summary">
    <div className="screen-heading wide-only"><h1>나의 플레이 기록</h1></div>
    <LevelCard level={levelFor(g.totalCorrect)} exp={g.totalCorrect}/>
    <div className="duration-tabs" role="group" aria-label="도전 종목">
      {DURATIONS.map(n=><button key={n} aria-pressed={duration===n} onClick={()=>setDuration(n)}>{n}분<span className="wide-only"> 도전</span></button>)}
    </div>
    <div className="stats-grid">
      <Stat icon="star" label="최고 점수" value={best===undefined?'—':best.score.toLocaleString()}/>
      <Stat icon="target" label="정답 수" value={`${best?.correct??0}개`}/>
    </div>
    <button className="primary-button" onClick={()=>g.weakUnlocked?g.setScreen('weak'):g.setScreen('tables')}>연습하기<Icon name="arrow"/></button>
    </section>
    <section className="records-board" aria-labelledby="mastery-title"><h2 id="mastery-title">구구단 도감</h2><MasteryBoard records={g.records}/></section>
  </main>;
}
