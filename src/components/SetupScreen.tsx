import { useState } from 'react';
import type { RushGame } from '../game/useRushGame';
import { TABLES } from '../types/game';
import { Icon } from './Icon';
import { Pager } from './Pager';
export function SetupScreen({game:g}:{readonly game:RushGame}){
  const [page,setPage]=useState(0);
  const pageCount=Math.ceil(g.weak.length/6);
  const currentPage=Math.min(page,Math.max(0,pageCount-1));
  if(g.screen==='tables'){
    const startLabel=g.tables.length===TABLES.length?'전체 구구단 시작':g.tables.length?`${g.tables.length}개 단 · ${g.tables.length*8}문제 시작`:'단을 골라요';
    return <main className="setup-screen">
      <div className="screen-heading"><h1>단별 연습</h1></div>
      <div className="table-picker">{TABLES.map(n=><button key={n} aria-pressed={g.tables.includes(n)} className={g.tables.includes(n)?'selected':''} onClick={()=>g.toggleTable(n)}><strong>{n}</strong>단{g.tables.includes(n)&&<Icon name="check"/>}</button>)}</div>
      <button className="primary-button" disabled={!g.tables.length} onClick={()=>g.start('practice')}>{startLabel}<Icon name="arrow"/></button>
    </main>;
  }
  return <main className="setup-screen weak-screen">
    <div className="screen-heading"><h1>약점 연습</h1></div>
    {g.weakUnlocked?<><div className="fact-list">{g.weak.slice(currentPage*6,currentPage*6+6).map(f=><span key={f.id}>{f.a} × {f.b}</span>)}</div><Pager page={currentPage} count={pageCount} onPage={setPage}/></>:<div className="empty-state weak-locked"><p>틀린 문제 {Math.min(g.totalWrong,5)} / 5개</p><p>5개를 틀리면 약점 연습이 열려요.</p></div>}
    <button className="primary-button" disabled={!g.weakUnlocked} onClick={()=>g.start('weak')}>{g.weakUnlocked?'연습 시작':'틀린 문제 5개를 모으면 시작할 수 있어요'}{g.weakUnlocked&&<Icon name="arrow"/>}</button>
  </main>;
}
