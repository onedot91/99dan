import { useState } from 'react';
import type { RushGame } from '../game/useRushGame';
import { levelFor } from '../game/learning';
import { DURATIONS, modeLabel } from '../types/game';
import type { Duration } from '../types/game';
import type { Best } from '../cloud/types';
import { Icon } from './Icon';
import { Stat } from './ResultScreen';
import { PixelArt } from './PixelArt';
import { Pager } from './Pager';
export function RecordsScreen({game:g,best:sharedBest}:{readonly game:RushGame;readonly best:readonly Best[]|undefined}){
  const [tab,setTab]=useState<'summary'|'history'>('summary');
  const [duration,setDuration]=useState<Duration>(1);
  const [page,setPage]=useState(0);
  const level=levelFor(g.totalCorrect);
  const attempts=Object.values(g.records).reduce((sum,r)=>sum+r.attempts,0);
  const mastered=Object.values(g.records).filter(r=>r.fastStreak>=3).length;
  const rushes=g.sessions.filter(s=>s.mode==='rush'&&!s.endedEarly&&s.duration===duration);
  const best=sharedBest?.find(b=>b.duration===duration)?.score??(rushes.length?rushes.reduce((n,s)=>Math.max(n,s.score),0):null);
  const history=[...g.sessions].reverse();
  return <main className="records-screen">
    <div className="screen-heading"><span className="level-badge"><Icon name="star"/>Lv.{level.number} {level.label}</span><h1>나의 플레이 기록</h1></div>
    <div className="record-tabs" role="group" aria-label="기록 종류"><button aria-pressed={tab==='summary'} onClick={()=>setTab('summary')}>성장 기록</button><button aria-pressed={tab==='history'} onClick={()=>setTab('history')}>최근 도전</button></div>
    {tab==='summary'&&<div className="duration-tabs" role="group" aria-label="개인 기록 단계">{DURATIONS.map(n=><button key={n} aria-pressed={duration===n} onClick={()=>setDuration(n)}>{n}분</button>)}</div>}
    {tab==='summary'?(attempts===0?<div className="empty-state"><PixelArt/><p>기록 없음</p></div>:<div className="stats-grid"><Stat icon="star" label={`${duration}분 최고 점수`} value={best===null?'—':best.toLocaleString()}/><Stat icon="target" label="푼 문제" value={`${attempts}개`}/><Stat icon="bolt" label="익숙한 식" value={`${mastered}개`}/><Stat icon="book" label="누적 정답" value={`${g.totalCorrect}개`}/></div>):<div className="history-panel">{history.length?<><div className="session-list">{history.slice(page*3,page*3+3).map((s,i)=><div className="session-row" key={page*3+i}><Icon name={s.mode==='rush'?'bolt':'book'}/><span><strong>{modeLabel(s.mode,s.duration)}</strong><span>{s.answered}문제 중 {s.correct}개 정답</span></span><b>{s.score.toLocaleString()}점</b></div>)}</div><Pager page={page} count={Math.ceil(history.length/3)} onPage={setPage}/></>:<div className="empty-state"><p>기록 없음</p></div>}</div>}
    <button className="primary-button" onClick={()=>g.weak.length?g.setScreen('weak'):g.setScreen('tables')}>계속 연습하기<Icon name="arrow"/></button>
  </main>;
}
