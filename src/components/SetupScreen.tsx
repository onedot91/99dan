import { useState } from 'react';
import type { RushGame } from '../game/useRushGame';
import { TABLES } from '../types/game';
import { Icon } from './Icon';
import { PixelArt } from './PixelArt';
import { Pager } from './Pager';
export function SetupScreen({game:g}:{readonly game:RushGame}){
  const [page,setPage]=useState(0);
  const pageCount=Math.ceil(g.weak.length/6);
  const currentPage=Math.min(page,Math.max(0,pageCount-1));
  if(g.screen==='tables'){
    const startLabel=g.tables.length===TABLES.length?'전체 구구단 시작':g.tables.length?`${g.tables.length}개 단 · ${g.tables.length*8}문제 시작`:'연습할 단을 골라 줘';
    return <main className="setup-screen">
      <div className="screen-heading"><h1>단별 연습</h1></div>
      <div className="table-picker">{TABLES.map(n=><button key={n} aria-pressed={g.tables.includes(n)} className={g.tables.includes(n)?'selected':''} onClick={()=>g.toggleTable(n)}><strong>{n}</strong>단{g.tables.includes(n)&&<Icon name="check"/>}</button>)}</div>
      <button className="primary-button" disabled={!g.tables.length} onClick={()=>g.start('practice')}>{startLabel}<Icon name="arrow"/></button>
    </main>;
  }
  return <main className="setup-screen weak-screen">
    <div className="screen-heading"><h1>약점 연습</h1></div>
    {g.weak.length?<><div className="fact-list">{g.weak.slice(currentPage*6,currentPage*6+6).map(f=><span key={f.id}>{f.a} × {f.b}</span>)}</div><Pager page={currentPage} count={pageCount} onPage={setPage}/></>:<div className="empty-state"><PixelArt/><p>문제 없음</p></div>}
    <button className="primary-button" onClick={()=>g.weak.length?g.start('weak'):g.setScreen('tables')}>{g.weak.length?'연습 시작':'단별 연습 시작'}<Icon name="arrow"/></button>
  </main>;
}
