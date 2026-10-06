import type { Attempt, Fact, FactRecord, Records, Run } from '../types/game.ts';
import { TABLES } from '../types/game.ts';
export const FACTS:readonly Fact[]=TABLES.flatMap(a=>TABLES.map(b=>({id:`${a}×${b}`,a,b})));
export function isWeak(record:FactRecord):boolean {
  return record.streak<3&&record.recent.some(r=>!r.correct);
}
export function weakFacts(records:Records):readonly Fact[]{
  return FACTS.filter(f=>{const r=records[f.id];return r?isWeak(r):false;}).sort((a,b)=>priority(records[b.id])-priority(records[a.id]));
}
function priority(record:FactRecord|undefined):number{
  if(!record)return 2;
  const recent=record.recent;
  const errors=recent.filter(r=>!r.correct).length/recent.length;
  return record.streak>=3?.2:1+errors*5;
}
export function updateRecord(previous:FactRecord|undefined,attempt:Attempt,ordinal:number):FactRecord{
  const last=previous??{attempts:0,correct:0,wrong:0,totalMs:0,streak:0,fastStreak:0,recent:[],reviewAt:null,interval:4,lastSeen:-1};
  const fast=attempt.correct&&attempt.ms<=3000;
  const streak=attempt.correct?last.streak+1:0;
  const interval=attempt.correct?Math.min(12,last.interval+2):4;
  return {attempts:last.attempts+1,correct:last.correct+Number(attempt.correct),wrong:last.wrong+Number(!attempt.correct),totalMs:last.totalMs+attempt.ms,streak,fastStreak:fast?last.fastStreak+1:0,recent:[...last.recent,attempt].slice(-5),reviewAt:streak>=3?null:!attempt.correct?ordinal+4:ordinal+interval,interval,lastSeen:ordinal};
}
type Draw={readonly records:Records;readonly ordinal:number;readonly tables:readonly number[];readonly focusIds:readonly string[];readonly mode:Run['mode'];readonly currentId:string|null;readonly seenIds:readonly string[]};
export function chooseFact(draw:Draw):Fact{
  const base=FACTS.filter(f=>draw.tables.includes(f.a));
  const focused=draw.mode==='weak'?base.filter(f=>{const record=draw.records[f.id];return draw.focusIds.includes(f.id)&&(!record||isWeak(record));}):base;
  const ready=(f:Fact)=>{
    const r=draw.records[f.id];
    return f.id!==draw.currentId&&(!r||r.reviewAt===null||r.reviewAt<=draw.ordinal);
  };
  const unseen=base.filter(f=>f.id!==draw.currentId&&!draw.seenIds.includes(f.id));
  if(draw.mode!=='weak'&&unseen.length)return unseen[Math.floor(Math.random()*unseen.length)]??unseen[0]??base[0]??{id:'2×2',a:2,b:2};
  const due=focused.filter(f=>{const r=draw.records[f.id];return ready(f)&&r?.reviewAt!==null&&r?.reviewAt!==undefined&&r.reviewAt<=draw.ordinal;});
  const earliest=due.sort((a,b)=>(draw.records[a.id]?.reviewAt??Infinity)-(draw.records[b.id]?.reviewAt??Infinity))[0];
  if(earliest)return earliest;
  // Small weak lists need intervening recall questions to preserve the requested spacing.
  const available=focused.filter(ready);
  const candidates=available.length?available:base.filter(ready);
  const pool=candidates.length?candidates:base.filter(f=>f.id!==draw.currentId);
  let sample=Math.random()*pool.reduce((sum,f)=>sum+priority(draw.records[f.id]),0);
  for(const fact of pool){sample-=priority(draw.records[fact.id]);if(sample<=0)return fact;}
  return pool[0]??{id:'2×7',a:2,b:7};
}
export type Mastery='new'|'practicing'|'weak'|'mastered';
export function masteryOf(record:FactRecord|undefined):Mastery{
  if(!record)return 'new';
  if(record.streak>=3)return 'mastered';
  return isWeak(record)?'weak':'practicing';
}
export function masteredIds(records:Records):ReadonlySet<string>{
  return new Set(FACTS.filter(f=>masteryOf(records[f.id])==='mastered').map(f=>f.id));
}
// Early levels come fast so new players get pets quickly: 10, 20, 30, 40 lifetime correct
// answers, then a flat 50 per level with no cap. Each level grants one friend pick.
// Keep in sync with supabase/migrations/20260929000000_slower_levels.sql.
export const LEVEL_STEP=50;
const EARLY_STEPS=[10,20,30,40] as const;
// Lifetime correct answers needed to reach a level.
export function levelFloor(level:number):number{
  let floor=0;
  for(let n=1;n<level;n++)floor+=EARLY_STEPS[n-1]??LEVEL_STEP;
  return floor;
}
// Titles only name ranges of levels; they never change how fast levels come.
export const TITLES=[[1,'초보 모험가'],[3,'숫자 탐험가'],[6,'곱셈 전사'],[10,'룬의 기사'],[15,'숫자 마법사'],[20,'곱셈 영웅'],[30,'별의 수호자'],[40,'전설의 대마법사'],[50,'곱셈 제왕'],[60,'곱셈 황제'],[70,'은하 정복자'],[80,'우주의 수호신'],[90,'불멸의 전설'],[100,'곱셈의 신']] as const;
export type Level={readonly number:number;readonly label:string;readonly floor:number;readonly next:number|null};
export function titleFor(level:number):string{
  return TITLES.reduce<string>((found,[from,label])=>level>=from?label:found,TITLES[0][1]);
}
export function levelFor(correct:number):Level{
  const c=Math.max(0,correct),early=levelFloor(EARLY_STEPS.length+1);
  const number=c>=early?EARLY_STEPS.length+1+Math.floor((c-early)/LEVEL_STEP):1+EARLY_STEPS.filter((_,i)=>c>=levelFloor(i+2)).length;
  return {number,label:titleFor(number),floor:levelFloor(number),next:levelFloor(number+1)};
}
