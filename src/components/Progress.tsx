import type { CSSProperties } from 'react';
import { masteryOf } from '../game/learning';
import type { Level } from '../game/learning';
import { TABLES } from '../types/game';
import type { Records } from '../types/game';
export const expRatio=(level:Level,exp:number)=>level.next===null?1:Math.min(1,(exp-level.floor)/(level.next-level.floor));
export function ExpBar({from,to,label}:{readonly from?:number;readonly to:number;readonly label:string}){
  return <div className="exp-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(to*100)}>
    <span className={from===undefined?'':'exp-fill-animated'} style={{'--from':from??to,'--to':to} as CSSProperties}/>
  </div>;
}
export function LevelCard({level,exp}:{readonly level:Level;readonly exp:number}){
  return <div className="level-card">
    <span className="level-number"><small>Lv.</small>{level.number}</span>
    <div className="level-copy">
      <div className="level-line"><strong>{level.label}</strong></div>
      <ExpBar to={expRatio(level,exp)} label="다음 레벨까지 경험치"/>
      <small>{level.next===null?'최고 레벨 달성!':`다음 레벨까지 ${level.next-exp}문제`}</small>
    </div>
  </div>;
}
const MASTERY_LABEL={new:'아직 안 푼 식',practicing:'연습 중',weak:'다시 볼 식',mastered:'익힌 식'} as const;
export function MasteryBoard({records}:{readonly records:Records}){
  return <div className="mastery-board">
    <div className="mastery-grid" role="table" aria-label="구구단 도감">
      <span className="mastery-corner" aria-hidden="true">×</span>
      {TABLES.map(b=><span key={b} className="mastery-head" aria-hidden="true">{b}</span>)}
      {TABLES.map(a=><div key={a} className="mastery-row" role="row">
        <span className="mastery-head" role="rowheader">{a}단</span>
        {TABLES.map(b=>{const state=masteryOf(records[`${a}×${b}`]);return <span key={b} role="cell" className={`mastery-cell ${state}`} aria-label={`${a} 곱하기 ${b}, ${MASTERY_LABEL[state]}`}>{state==='new'?'':a*b}</span>;})}
      </div>)}
    </div>
    <ul className="mastery-legend" aria-hidden="true">{(['mastered','practicing','weak'] as const).map(state=><li key={state}><i className={`mastery-cell ${state}`}/>{MASTERY_LABEL[state]}</li>)}</ul>
  </div>;
}
