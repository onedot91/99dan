import { useEffect, useState } from 'react';
import type { RushGame } from '../game/useRushGame';
import type { Best } from '../cloud/types';
import { DURATIONS } from '../types/game';
import type { Duration } from '../types/game';
import { Stat } from './ResultScreen';
import { Icon } from './Icon';
import { levelFor } from '../game/learning';
import { LevelCard, MasteryBoard } from './Progress';
import { cloudConfigured, loadBlockRecords, loadStairsRecords, loadVerticalRecords } from '../cloud/client';
import type { BlockRecord, VerticalRecord } from '../cloud/client';
import { loadBest as loadBlockBest } from '../game/useBlockGame';
import { loadBest as loadStairsBest } from '../game/useStairsGame';
import { stairsUnlocked } from '../game/teacherDevice';
import type { VerticalCount } from '../game/verticalSets';
import { isSpare } from '../game/studentNumber';
const VERTICAL_COUNTS:readonly VerticalCount[]=[5,10];

export function RecordsScreen({game:g,exp,best:sharedBest,studentNumber}:{readonly game:RushGame;readonly exp:number;readonly best:readonly Best[]|undefined;readonly studentNumber:number}){
  const [duration,setDuration]=useState<Duration>(1);
  // Two-digit and Block runs are on the server; until they load (or offline) their tabs show dashes,
  // except Block's best, which this device also keeps.
  const [count,setCount]=useState<VerticalCount|'block'|'stairs'|null>(null);
  const [stairsRecord,setStairsRecord]=useState<BlockRecord|null>(null);
  const [verticalRecords,setVerticalRecords]=useState<readonly VerticalRecord[]|null>(null);
  const [blockRecord,setBlockRecord]=useState<BlockRecord|null>(null);
  useEffect(()=>{
    if(!cloudConfigured||isSpare(studentNumber))return;
    let live=true;
    loadVerticalRecords(studentNumber).then(records=>{if(live)setVerticalRecords(records);}).catch(()=>{});
    loadBlockRecords(studentNumber).then(record=>{if(live)setBlockRecord(record);}).catch(()=>{});
    if(stairsUnlocked())loadStairsRecords(studentNumber).then(record=>{if(live)setStairsRecord(record);}).catch(()=>{});
    return ()=>{live=false;};
  },[studentNumber]);
  const vertical=typeof count==='number'?verticalRecords?.find(r=>r.count===count):undefined;
  const higher=(...values:readonly (number|null|undefined)[])=>values.reduce<number|null>((max,v)=>v==null?max:max===null?v:Math.max(max,v),null);
  const blockBest=higher(blockRecord?.best,loadBlockBest(studentNumber)),stairsBest=higher(stairsRecord?.best,loadStairsBest(studentNumber));
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
      {DURATIONS.map(n=><button key={n} aria-pressed={count===null&&duration===n} onClick={()=>{setCount(null);setDuration(n);}}>{n}분</button>)}
      {VERTICAL_COUNTS.map(n=><button key={n} aria-pressed={count===n} aria-label={`두 자리 수 ${n}문제`} onClick={()=>setCount(n)}>{n}문제</button>)}
      {stairsUnlocked()&&<button aria-pressed={count==='stairs'} onClick={()=>setCount('stairs')}>계단</button>}
      <button aria-pressed={count==='block'} onClick={()=>setCount('block')}>블록</button>
    </div>
    {count===null?<div className="stats-grid">
      <Stat icon="star" label="최고 점수" value={best===undefined?'—':best.score.toLocaleString()}/>
      <Stat icon="target" label="정답 수" value={`${best?.correct??0}개`}/>
    </div>:count==='stairs'?<div className="stats-grid">
      <Stat icon="star" label="최고 점수" value={stairsBest===null?'—':stairsBest.toLocaleString()}/>
      <Stat icon="flag" label="도전 횟수" value={stairsRecord===null?'—':`${stairsRecord.runs}번`}/>
    </div>:count==='block'?<div className="stats-grid">
      <Stat icon="star" label="최고 점수" value={blockBest===null?'—':blockBest.toLocaleString()}/>
      <Stat icon="flag" label="도전 횟수" value={blockRecord===null?'—':`${blockRecord.runs}번`}/>
    </div>:<div className="stats-grid">
      <Stat icon="star" label="최고 점수" value={vertical?.best==null?'—':vertical.best.toLocaleString()}/>
      <Stat icon="flag" label="도전 횟수" value={vertical===undefined?'—':`${vertical.runs}번`}/>
    </div>}
    <button className="primary-button" onClick={()=>g.weakUnlocked?g.setScreen('weak'):g.setScreen('tables')}>연습하기<Icon name="arrow"/></button>
    </section>
    <section className="records-board" aria-labelledby="mastery-title"><h2 id="mastery-title">구구단 도감</h2><MasteryBoard records={g.records}/></section>
  </main>;
}
