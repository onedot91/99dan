import { useLayoutEffect, useRef } from 'react';
import type { Best } from '../cloud/types';
import type { Fact } from '../types/game';
import type { RushGame } from './useRushGame';
import { FACTS, levelFor, masteredIds } from './learning';
import type { Level } from './learning';
type Snapshot={readonly runId:string;readonly best:number|null;readonly totalCorrect:number;readonly mastered:ReadonlySet<string>};
export type RunRewards={
  readonly newRecord:boolean;readonly firstRecord:boolean;readonly toBest:number|null;
  readonly levelBefore:Level;readonly levelAfter:Level;readonly levelUp:boolean;
  readonly expBefore:number;readonly expAfter:number;readonly newlyMastered:readonly Fact[];
};
function bestBefore(g:RushGame,shared:readonly Best[]|undefined):number|null{
  const run=g.run;if(!run||run.mode!=='rush')return null;
  const local=g.sessions.filter(s=>s.mode==='rush'&&s.duration===run.duration&&s.scoringVersion===5&&!s.endedEarly).map(s=>s.score);
  const remote=shared?.filter(b=>b.duration===run.duration).map(b=>b.score)??[];
  const all=[...local,...remote];
  return all.length?Math.max(...all):null;
}
// Snapshots progress when a run starts so the result screen can show what this run changed.
export function useRunRewards(g:RushGame,sharedBest:readonly Best[]|undefined):RunRewards|null{
  const snapshot=useRef<Snapshot|null>(null);
  const runId=g.run?.id;
  useLayoutEffect(()=>{
    if(g.screen!=='play'||!runId||snapshot.current?.runId===runId)return;
    snapshot.current={runId,best:bestBefore(g,sharedBest),totalCorrect:g.totalCorrect,mastered:masteredIds(g.records)};
  },[g.screen,runId]);
  const run=g.run,before=snapshot.current;
  if(g.screen!=='result'||!run||before?.runId!==run.id)return null;
  const completedRush=run.mode==='rush'&&!run.endedEarly;
  const newRecord=completedRush&&run.score>0&&(before.best===null||run.score>before.best);
  const now=masteredIds(g.records);
  const expAfter=Math.max(g.totalCorrect,before.totalCorrect+run.correct);
  const levelBefore=levelFor(before.totalCorrect),levelAfter=levelFor(expAfter);
  return {
    newRecord,firstRecord:newRecord&&before.best===null,
    toBest:completedRush&&!newRecord&&before.best!==null?before.best-run.score+1:null,
    levelBefore,levelAfter,levelUp:levelAfter.number>levelBefore.number,
    expBefore:before.totalCorrect,expAfter,
    newlyMastered:FACTS.filter(f=>now.has(f.id)&&!before.mastered.has(f.id))
  };
}
