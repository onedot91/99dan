import type { StairsRun } from './stairsRun';

// 목숨을 잃는 실수 뒤의 성공한 계단만 센다. 일반 세로셈 오답은 연속 상승을 끊지 않는다.
export function stairsStreak(run:StairsRun):number{
  const start=Math.max(run.lastSlip??-1,run.lastMash??-1)+1;
  return run.log.slice(start).filter(entry=>typeof entry==='string').length;
}
export const stairsStreakTier=(streak:number):0|1|2|3=>streak>=20?3:streak>=10?2:streak>=5?1:0;
