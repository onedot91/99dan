import { useEffect, useState } from 'react';
import type { RushGame } from '../game/useRushGame';
import type { Best } from '../cloud/types';
import { DURATIONS } from '../types/game';
import type { Duration } from '../types/game';
import { Stat } from './ResultScreen';
import { Icon } from './Icon';
import { levelFor } from '../game/learning';
import { LevelCard, MasteryBoard } from './Progress';
import { cloudConfigured, loadBlockRecords, loadStairsRecords } from '../cloud/client';
import type { BlockRecord } from '../cloud/client';
import { loadBest as loadBlockBest } from '../game/useBlockGame';
import { loadBest as loadStairsBest } from '../game/useStairsGame';
import { isSpare } from '../game/studentNumber';
export function RecordsScreen({game:g,exp,best:sharedBest,studentNumber}:{readonly game:RushGame;readonly exp:number;readonly best:readonly Best[]|undefined;readonly studentNumber:number}){
  const [duration,setDuration]=useState<Duration>(1);
  // Stairs and Block runs are on the server; until they load (or offline) their tabs show dashes,
  // except each best, which this device also keeps.
  const [part,setPart]=useState<'stairs'|'block'|null>(null);
  const [stairsRecord,setStairsRecord]=useState<BlockRecord|null>(null);
  const [blockRecord,setBlockRecord]=useState<BlockRecord|null>(null);
  useEffect(()=>{
    if(!cloudConfigured||isSpare(studentNumber))return;
    let live=true;
    loadStairsRecords(studentNumber).then(record=>{if(live)setStairsRecord(record);}).catch(()=>{});
    loadBlockRecords(studentNumber).then(record=>{if(live)setBlockRecord(record);}).catch(()=>{});
    return ()=>{live=false;};
  },[studentNumber]);
  const higher=(...values:readonly (number|null|undefined)[])=>values.reduce<number|null>((max,v)=>v==null?max:max===null?v:Math.max(max,v),null);
  const record=part==='stairs'?stairsRecord:blockRecord,partBest=part==='stairs'?higher(stairsRecord?.best,loadStairsBest(studentNumber)):higher(blockRecord?.best,loadBlockBest(studentNumber));
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
    <LevelCard level={levelFor(exp)} exp={exp}/>
    <div className="duration-tabs records-challenge-tabs" role="group" aria-label="도전 종목">
      {DURATIONS.map(n=><button key={n} aria-pressed={part===null&&duration===n} onClick={()=>{setPart(null);setDuration(n);}}>{n}분</button>)}
      <button aria-pressed={part==='stairs'} onClick={()=>setPart('stairs')}>계단</button>
      <button aria-pressed={part==='block'} onClick={()=>setPart('block')}>블록</button>
    </div>
    {part===null?<div className="stats-grid">
      <Stat icon="star" label="최고 점수" value={best===undefined?'—':best.score.toLocaleString()}/>
      <Stat icon="target" label="정답 수" value={`${best?.correct??0}개`}/>
    </div>:<div className="stats-grid">
      <Stat icon="star" label="최고 점수" value={partBest===null?'—':partBest.toLocaleString()}/>
      <Stat icon="flag" label="도전 횟수" value={record===null?'—':`${record.runs}번`}/>
    </div>}
    <button className="primary-button" onClick={()=>g.weakUnlocked?g.setScreen('weak'):g.setScreen('tables')}>연습하기<Icon name="arrow"/></button>
    </section>
    <section className="records-board" aria-labelledby="mastery-title"><h2 id="mastery-title">구구단 도감</h2><MasteryBoard records={g.records}/></section>
  </main>;
}
