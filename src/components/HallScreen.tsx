import { useEffect, useState } from 'react';
import { DURATIONS } from '../types/game';
import type { Duration } from '../types/game';
import { cloudConfigured, loadLeaders, loadVerticalLeaders } from '../cloud/client';
import type { Standing } from '../cloud/types';
import { PixelArt } from './PixelArt';
import { Icon } from './Icon';
import { CROWN, Sprite } from './Sprite';
import { isSpare } from '../game/studentNumber';
import type { VerticalCount } from '../game/verticalSets';
export type HallPart='rush'|'vertical';
export function HallScreen({ready,studentNumber,initialDuration,initialPart='rush',initialCount=5}:{readonly ready:boolean;readonly studentNumber:number;readonly initialDuration:Duration;readonly initialPart?:HallPart;readonly initialCount?:VerticalCount}){
  const [part,setPart]=useState<HallPart>(initialPart);
  const [duration,setDuration]=useState<Duration>(initialDuration);
  const [count,setCount]=useState<VerticalCount>(initialCount);
  const [rows,setRows]=useState<readonly Standing[]>([]);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!ready||!cloudConfigured||isSpare(studentNumber))return;
    let active=true;
    const load=async()=>{try{const next=await (part==='vertical'?loadVerticalLeaders(studentNumber,count):loadLeaders(studentNumber,duration));if(active){setRows(next);setState('ready');}}catch{if(active)setState('error');}};
    setState('loading');void load();
    const poll=window.setInterval(()=>{if(!document.hidden)void load();},15000);
    return()=>{active=false;window.clearInterval(poll);};
  },[part,duration,count,ready,retry,studentNumber]);
  return <main className="hall-screen"><div className="screen-heading"><PixelArt kind="trophy"/><h1>명예의 전당</h1></div>
    <div className="hall-part-tabs" role="group" aria-label="기록 종류"><button aria-pressed={part==='rush'} onClick={()=>setPart('rush')}>구구단</button><button aria-pressed={part==='vertical'} onClick={()=>setPart('vertical')}>두 자리 수</button></div>
    {part==='rush'&&<div className="duration-tabs" role="group" aria-label="기록 단계">{DURATIONS.map(n=><button key={n} aria-pressed={duration===n} onClick={()=>setDuration(n)}>{n}분<span className="wide-only"> 도전</span></button>)}</div>}
    {part==='vertical'&&<><div className="duration-tabs hall-count-tabs" role="group" aria-label="문제 수">{([5,10] as const).map(n=><button key={n} aria-pressed={count===n} onClick={()=>setCount(n)}>{n}문제</button>)}</div><p className="hall-rule">최고 점수 · 최근 7일</p></>}
    {isSpare(studentNumber)?<div className="empty-state" role="status">예비 번호는 순위에 들어가지 않아요</div>:!cloudConfigured?<div className="empty-state" role="status">연결 필요</div>:!ready||state==='loading'?<div className="empty-state" role="status">불러오는 중</div>:state==='error'?<button className="quiet-button" onClick={()=>setRetry(n=>n+1)}>다시 불러오기</button>:rows.length?<ol className="podium">{rows.map((row,i)=><li className={`${['first','second','third'][i]??''}${row.studentNumber===studentNumber?' me':''}`} key={row.studentNumber}><strong className="rank">{i===0&&<Sprite map={CROWN} className="rank-crown"/>}{i+1}</strong>{row.avatar?<img src={row.avatar} alt="" width="56" height="56"/>:<Icon name="star" size={40}/>}<span>{row.studentNumber}번{row.studentNumber===studentNumber&&<em className="me-tag">나</em>}</span><b>{row.score.toLocaleString()}점</b></li>)}</ol>:<div className="empty-state">기록 없음</div>}
  </main>;
}
