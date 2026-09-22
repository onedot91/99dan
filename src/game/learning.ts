import type { Attempt, Fact, FactRecord, Records, Run } from '../types/game.ts';
import { TABLES } from '../types/game.ts';
export const FACTS:readonly Fact[]=TABLES.flatMap(a=>TABLES.map(b=>({id:`${a}×${b}`,a,b})));
export function isWeak(record:FactRecord):boolean {
  return record.fastStreak<3&&record.recent.some(r=>!r.correct||r.ms>4000);
}
export function weakFacts(records:Records):readonly Fact[]{
  return FACTS.filter(f=>{const r=records[f.id];return r?isWeak(r):false;}).sort((a,b)=>priority(records[b.id])-priority(records[a.id]));
}
function priority(record:FactRecord|undefined):number{
  if(!record)return 2;
  const recent=record.recent;
  const errors=recent.filter(r=>!r.correct).length/recent.length;
  const average=recent.reduce((sum,r)=>sum+r.ms,0)/recent.length;
  return record.fastStreak>=3?.2:1+errors*5+Math.min(4,average/2000);
}
export function updateRecord(previous:FactRecord|undefined,attempt:Attempt,ordinal:number):FactRecord{
  const last=previous??{attempts:0,correct:0,wrong:0,totalMs:0,streak:0,fastStreak:0,recent:[],reviewAt:null,interval:4,lastSeen:-1};
  const fast=attempt.correct&&attempt.ms<=3000;
  const interval=attempt.correct?Math.min(12,last.interval+2):4;
  return {attempts:last.attempts+1,correct:last.correct+Number(attempt.correct),wrong:last.wrong+Number(!attempt.correct),totalMs:last.totalMs+attempt.ms,streak:attempt.correct?last.streak+1:0,fastStreak:fast?last.fastStreak+1:0,recent:[...last.recent,attempt].slice(-5),reviewAt:fast&&last.fastStreak+1>=3?null:!attempt.correct?ordinal+4:ordinal+interval,interval,lastSeen:ordinal};
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
export function levelFor(correct:number){
  if(correct>=100)return {number:4,label:'구구단 마스터',next:100};
  if(correct>=50)return {number:3,label:'도전자',next:100};
  if(correct>=20)return {number:2,label:'연습생',next:50};
  return {number:1,label:'새싹',next:20};
}
